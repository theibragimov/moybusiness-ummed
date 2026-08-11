import "server-only";
import { buildFilter, entityHref, fetchAllRows, msGet, type MsListResponse } from "./moysklad";
import { dayOf, momentFrom, momentTo, lastMonths } from "./tashkent";
import { cached } from "./cache";

// ---------- shared types ----------

interface MetaRef {
  meta: { href: string };
  name?: string;
}

interface DemandRow {
  id: string;
  moment: string;
  sum: number;
  name: string;
  agent?: MetaRef;
}

interface CashoutRow {
  id: string;
  moment: string;
  sum: number;
  description?: string;
  expenseItem?: { meta: { href: string } };
}

interface ExpenseItemRow {
  id: string;
  name: string;
}

function idFromHref(href: string): string {
  return href.split("/").pop() ?? href;
}

// MoySklad silently stops resolving `expand` once `limit` exceeds ~100, so for
// cashout lists (which can run into the thousands) we resolve category names
// ourselves via a small separate lookup instead of relying on expand.
let expenseItemNamesCache: Map<string, string> | null = null;
async function getExpenseItemNames(): Promise<Map<string, string>> {
  if (expenseItemNamesCache) return expenseItemNamesCache;
  const rows = await fetchAllRows<ExpenseItemRow>("entity/expenseitem", {}, 1000);
  expenseItemNamesCache = new Map(rows.map((r) => [r.id, r.name]));
  return expenseItemNamesCache;
}

function categoryName(row: CashoutRow, names: Map<string, string>): string {
  const href = row.expenseItem?.meta.href;
  if (!href) return "Boshqa";
  return names.get(idFromHref(href)) ?? "Boshqa";
}

interface ProfitByProductRow {
  assortment: { name: string; code?: string };
  sellQuantity: number;
  sellSum: number;
  sellCostSum: number;
  profit: number;
  margin: number;
}

interface CounterpartyReportRow {
  counterparty: { id: string; name: string; phone?: string };
  demandsCount: number;
  demandsSum: number;
  averageReceipt: number;
  lastDemandDate: string | null;
  balance: number;
}

// ---------- helpers ----------

function dateRangeFilter(from: string, to: string) {
  return buildFilter([`moment>=${momentFrom(from)}`, `moment<=${momentTo(to)}`]);
}

async function listDemands(from: string, to: string): Promise<DemandRow[]> {
  return fetchAllRows<DemandRow>("entity/demand", {
    filter: dateRangeFilter(from, to),
    order: "moment,desc",
  });
}

// ---------- dashboard ----------

export interface DashboardData {
  todaySalesSum: number;
  todaySalesCount: number;
  monthRevenueSum: number;
  monthShipmentsCount: number;
  monthShipmentsSum: number;
  monthExpensesSum: number;
  cashBalance: number;
  salesByDay: { day: string; sum: number; count: number }[];
  topProducts: { name: string; qty: number; sum: number }[];
  recentShipments: { id: string; name: string; moment: string; sum: number; agent: string }[];
  expensesByCategory: { category: string; sum: number }[];
}

export function getDashboardData(todayYmd: string, monthStartYmd: string): Promise<DashboardData> {
  return cached(`dashboard:${todayYmd}:${monthStartYmd}`, () => getDashboardDataImpl(todayYmd, monthStartYmd));
}

async function getDashboardDataImpl(todayYmd: string, monthStartYmd: string): Promise<DashboardData> {
  const [monthDemands, monthCashouts, moneyReport, expenseItemNames, recentDemandsExpanded] = await Promise.all([
    listDemands(monthStartYmd, todayYmd),
    fetchAllRows<CashoutRow>("entity/cashout", {
      filter: dateRangeFilter(monthStartYmd, todayYmd),
    }),
    msGet<{ money: { balance: number } }>("report/dashboard/money", {
      momentFrom: momentFrom(todayYmd),
      momentTo: momentTo(todayYmd),
    }).catch(() => ({ money: { balance: 0 } })),
    getExpenseItemNames(),
    // small dedicated page so `expand` (capped at ~100 rows by MoySklad) still resolves
    msGet<MsListResponse<DemandRow>>("entity/demand", {
      filter: dateRangeFilter(monthStartYmd, todayYmd),
      order: "moment,desc",
      limit: 8,
      expand: "agent",
    }).catch(() => ({ rows: [] as DemandRow[] })),
  ]);

  const todayDemands = monthDemands.filter((d) => dayOf(d.moment) === todayYmd);

  const byDayMap = new Map<string, { sum: number; count: number }>();
  for (const d of monthDemands) {
    const day = dayOf(d.moment);
    const cur = byDayMap.get(day) ?? { sum: 0, count: 0 };
    cur.sum += d.sum;
    cur.count += 1;
    byDayMap.set(day, cur);
  }
  const salesByDay = [...byDayMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, v]) => ({ day, ...v }));

  const productMap = new Map<string, { qty: number; sum: number }>();
  // top products this month, from the profit-by-product report (already aggregated server-side)
  const profitRows = await fetchAllRows<ProfitByProductRow>("report/profit/byproduct", {
    momentFrom: momentFrom(monthStartYmd),
    momentTo: momentTo(todayYmd),
  }).catch(() => [] as ProfitByProductRow[]);
  for (const r of profitRows) {
    productMap.set(r.assortment.name, { qty: r.sellQuantity, sum: r.sellSum });
  }
  const topProducts = [...productMap.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 6)
    .map(([name, v]) => ({ name, ...v }));

  const expenseMap = new Map<string, number>();
  let monthExpensesSum = 0;
  for (const c of monthCashouts) {
    const cat = categoryName(c, expenseItemNames);
    expenseMap.set(cat, (expenseMap.get(cat) ?? 0) + c.sum);
    monthExpensesSum += c.sum;
  }
  const expensesByCategory = [...expenseMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, sum]) => ({ category, sum }));

  const recentShipments = recentDemandsExpanded.rows.map((d) => ({
    id: d.id,
    name: d.name,
    moment: d.moment,
    sum: d.sum,
    agent: d.agent?.name ?? "",
  }));

  return {
    todaySalesSum: todayDemands.reduce((s, d) => s + d.sum, 0),
    todaySalesCount: todayDemands.length,
    monthRevenueSum: monthDemands.reduce((s, d) => s + d.sum, 0),
    monthShipmentsCount: monthDemands.length,
    monthShipmentsSum: monthDemands.reduce((s, d) => s + d.sum, 0),
    monthExpensesSum,
    cashBalance: moneyReport.money?.balance ?? 0,
    salesByDay,
    topProducts,
    recentShipments,
    expensesByCategory,
  };
}

// ---------- product analytics ----------

export interface ProductAnalyticsRow {
  name: string;
  code?: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export interface AnalyticsData {
  topSold: ProductAnalyticsRow[];
  topMargin: ProductAnalyticsRow[];
  abc: (ProductAnalyticsRow & { share: number; cumulative: number; group: "A" | "B" | "C" })[];
  abcSummary: { group: "A" | "B" | "C"; count: number; revenueShare: number }[];
  slowMovers: ProductAnalyticsRow[];
}

export function getAnalyticsData(from: string, to: string): Promise<AnalyticsData> {
  return cached(`analytics:${from}:${to}`, () => getAnalyticsDataImpl(from, to));
}

async function getAnalyticsDataImpl(from: string, to: string): Promise<AnalyticsData> {
  const rows = await fetchAllRows<ProfitByProductRow>("report/profit/byproduct", {
    momentFrom: momentFrom(from),
    momentTo: momentTo(to),
  });

  const mapped: ProductAnalyticsRow[] = rows
    .filter((r) => r.sellQuantity > 0)
    .map((r) => ({
      name: r.assortment.name,
      code: r.assortment.code,
      qty: r.sellQuantity,
      revenue: r.sellSum,
      cost: r.sellCostSum,
      profit: r.profit,
      margin: r.margin,
    }));

  const topSold = [...mapped].sort((a, b) => b.qty - a.qty).slice(0, 50);
  const topMargin = [...mapped]
    .filter((r) => r.revenue > 0)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 50);

  const totalRevenue = mapped.reduce((s, r) => s + r.revenue, 0);
  const sortedByRevenue = [...mapped].sort((a, b) => b.revenue - a.revenue);
  let cumulative = 0;
  const abc = sortedByRevenue.map((r) => {
    const share = totalRevenue > 0 ? r.revenue / totalRevenue : 0;
    cumulative += share;
    const group: "A" | "B" | "C" = cumulative <= 0.8 ? "A" : cumulative <= 0.95 ? "B" : "C";
    return { ...r, share, cumulative, group };
  });

  const abcSummary = (["A", "B", "C"] as const).map((group) => {
    const items = abc.filter((r) => r.group === group);
    return {
      group,
      count: items.length,
      revenueShare: items.reduce((s, r) => s + r.share, 0),
    };
  });

  const slowMovers = [...mapped]
    .filter((r) => r.qty > 0)
    .sort((a, b) => a.qty - b.qty)
    .slice(0, 50);

  return { topSold, topMargin, abc, abcSummary, slowMovers };
}

// ---------- expenses ----------

export interface ExpensesData {
  total: number;
  byCategory: { category: string; sum: number }[];
  byDay: { day: string; sum: number }[];
  recent: { id: string; moment: string; sum: number; category: string; description: string }[];
}

export function getExpensesData(from: string, to: string): Promise<ExpensesData> {
  return cached(`expenses:${from}:${to}`, () => getExpensesDataImpl(from, to));
}

async function getExpensesDataImpl(from: string, to: string): Promise<ExpensesData> {
  const [rows, expenseItemNames] = await Promise.all([
    fetchAllRows<CashoutRow>("entity/cashout", {
      filter: dateRangeFilter(from, to),
      order: "moment,desc",
    }),
    getExpenseItemNames(),
  ]);

  const byCategoryMap = new Map<string, number>();
  const byDayMap = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    const cat = categoryName(r, expenseItemNames);
    byCategoryMap.set(cat, (byCategoryMap.get(cat) ?? 0) + r.sum);
    const day = dayOf(r.moment);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + r.sum);
    total += r.sum;
  }

  const byCategory = [...byCategoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, sum]) => ({ category, sum }));

  const byDay = [...byDayMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, sum]) => ({ day, sum }));

  const recent = rows.slice(0, 100).map((r) => ({
    id: r.id,
    moment: r.moment,
    sum: r.sum,
    category: categoryName(r, expenseItemNames),
    description: r.description ?? "",
  }));

  return { total, byCategory, byDay, recent };
}

// ---------- CRM / counterparties ----------

export interface CounterpartyRow {
  id: string;
  name: string;
  phone: string;
  demandsCount: number;
  demandsSum: number;
  averageReceipt: number;
  lastDemandDate: string | null;
  balance: number;
}

export function getCounterparties(): Promise<CounterpartyRow[]> {
  return cached("counterparties", getCounterpartiesImpl);
}

async function getCounterpartiesImpl(): Promise<CounterpartyRow[]> {
  const rows = await fetchAllRows<CounterpartyReportRow>("report/counterparty", {}, 2000);
  return rows.map((r) => ({
    id: r.counterparty.id,
    name: r.counterparty.name,
    phone: r.counterparty.phone ?? "",
    demandsCount: r.demandsCount,
    demandsSum: r.demandsSum,
    averageReceipt: r.averageReceipt,
    lastDemandDate: r.lastDemandDate,
    balance: r.balance,
  }));
}

// ---------- company debts ----------

export interface DebtsData {
  theyOweUs: CounterpartyRow[];
  weOweThem: CounterpartyRow[];
  totalDebtToUs: number;
  totalDebtByUs: number;
}

export async function getDebtsData(): Promise<DebtsData> {
  const rows = await getCounterparties();
  // MoySklad balance sign: negative => counterparty has been shipped more than paid (owes us).
  // positive => counterparty has paid more than shipped (we owe them / advance held).
  const theyOweUs = rows
    .filter((r) => r.balance < 0)
    .sort((a, b) => a.balance - b.balance);
  const weOweThem = rows
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  return {
    theyOweUs,
    weOweThem,
    totalDebtToUs: theyOweUs.reduce((s, r) => s + Math.abs(r.balance), 0),
    totalDebtByUs: weOweThem.reduce((s, r) => s + r.balance, 0),
  };
}

// ---------- product search + per-product forecast ----------

export interface ProductSearchResult {
  id: string;
  name: string;
  code?: string;
}

export function searchProducts(query: string): Promise<ProductSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return Promise.resolve([]);
  return cached(`product-search:${q.toLowerCase()}`, () => searchProductsImpl(q));
}

async function searchProductsImpl(query: string): Promise<ProductSearchResult[]> {
  interface ProductRow {
    id: string;
    name: string;
    code?: string;
  }
  const rows = await fetchAllRows<ProductRow>(
    "entity/product",
    { filter: buildFilter([`name~${query}`]) },
    20
  );
  return rows.map((r) => ({ id: r.id, name: r.name, code: r.code }));
}

export interface ModificationForecast {
  name: string;
  stock: number;
  history: { label: string; qty: number }[];
  forecast: { label: string; qty: number }[];
  historyTotalQty: number;
  forecastTotalQty: number;
}

export interface ProductForecastData {
  productName: string;
  currentStock: number;
  modifications: ModificationForecast[];
  history: { label: string; qty: number; sum: number }[];
  forecast: { label: string; qty: number }[];
  historyTotalQty: number;
  forecastTotalQty: number;
  suggestedPurchaseQty: number;
}

export function getProductForecast(
  productId: string,
  historyMonths = 12,
  forecastMonths = 12
): Promise<ProductForecastData> {
  return cached(`product-forecast:${productId}:${historyMonths}:${forecastMonths}`, () =>
    getProductForecastImpl(productId, historyMonths, forecastMonths)
  );
}

interface ProductDetailRow {
  id: string;
  name: string;
  variantsCount?: number;
}

interface VariantRow {
  id: string;
  name: string;
  characteristics?: { name: string; value: string }[];
}

interface FutureMonth {
  label: string;
  monthIndex: number;
}

function buildFutureMonths(count: number): FutureMonth[] {
  return Array.from({ length: count }).map((_, i) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + i + 1, 1);
    return { label: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, monthIndex: d.getUTCMonth() };
  });
}

/**
 * Seasonal-naive forecast: a linear trend across the known months, shaped by each
 * calendar month's share of the average (its "season"). Approximate by design —
 * flagged as an estimate in the UI, not a guarantee. With less than a full year of
 * history, future months outside the covered calendar months fall back to neutral (1x).
 */
function seasonalTrendForecast(qtys: number[], historyMonthIndexes: number[], future: FutureMonth[]): number[] {
  const n = qtys.length;
  const avgQty = qtys.reduce((s, v) => s + v, 0) / (n || 1);
  const meanIdx = (n - 1) / 2;
  let num = 0;
  let den = 0;
  qtys.forEach((v, i) => {
    num += (i - meanIdx) * (v - avgQty);
    den += (i - meanIdx) ** 2;
  });
  const slope = den > 0 ? num / den : 0;
  const intercept = avgQty - slope * meanIdx;

  const seasonalIndex = new Map<number, number>();
  historyMonthIndexes.forEach((mi, i) => seasonalIndex.set(mi, avgQty > 0 ? qtys[i] / avgQty : 1));

  return future.map((f, i) => {
    const baseline = intercept + slope * (n + i);
    const seasonal = seasonalIndex.get(f.monthIndex) ?? 1;
    return Math.max(0, Math.round(baseline * seasonal));
  });
}

async function monthlySoldQty(assortmentHref: string, months: { start: string; end: string }[]): Promise<number[]> {
  const rows = await Promise.all(
    months.map((m) =>
      msGet<MsListResponse<ProfitByProductRow>>("report/profit/byproduct", {
        momentFrom: momentFrom(m.start),
        momentTo: momentTo(m.end),
        filter: buildFilter([`product=${assortmentHref}`]),
      }).catch(() => ({ rows: [] as ProfitByProductRow[] }))
    )
  );
  return rows.map((r) => r.rows[0]?.sellQuantity ?? 0);
}

async function getVariantStock(variantId: string): Promise<number> {
  const rows = await fetchAllRows<{ stock: number }>(
    "report/stock/all",
    { filter: buildFilter([`variant=${entityHref("variant", variantId)}`]) },
    5
  ).catch(() => []);
  return rows[0]?.stock ?? 0;
}

async function getProductForecastImpl(
  productId: string,
  historyMonths: number,
  forecastMonths: number
): Promise<ProductForecastData> {
  const href = entityHref("product", productId);
  const months = lastMonths(historyMonths);
  const monthIndexes = months.map((m) => m.monthIndex);
  const future = buildFutureMonths(forecastMonths);

  const detail = await msGet<ProductDetailRow>(`entity/product/${productId}`, {}).catch(
    () => null as ProductDetailRow | null
  );

  if (!detail?.variantsCount) {
    const [qtys, stockRows] = await Promise.all([
      monthlySoldQty(href, months),
      fetchAllRows<{ stock: number; name: string }>(
        "report/stock/all",
        { filter: buildFilter([`product=${href}`]) },
        5
      ).catch(() => []),
    ]);

    const history = months.map((m, i) => ({ label: m.label, qty: qtys[i], sum: 0 }));
    const forecastQtys = seasonalTrendForecast(qtys, monthIndexes, future);
    const forecast = future.map((f, i) => ({ label: f.label, qty: forecastQtys[i] }));
    const currentStock = stockRows[0]?.stock ?? 0;
    const historyTotalQty = qtys.reduce((s, v) => s + v, 0);
    const forecastTotalQty = forecastQtys.reduce((s, v) => s + v, 0);

    return {
      productName: detail?.name ?? stockRows[0]?.name ?? "",
      currentStock,
      modifications: [],
      history,
      forecast,
      historyTotalQty,
      forecastTotalQty,
      suggestedPurchaseQty: Math.max(0, Math.round(forecastTotalQty - currentStock)),
    };
  }

  // Has modifications: MoySklad tracks stock and sales per variant, not on the
  // parent product, so each modification gets its own history + forecast, and the
  // totals are simply summed across them.
  const variants = await fetchAllRows<VariantRow>(
    "entity/variant",
    { filter: buildFilter([`productid=${productId}`]) },
    200
  ).catch(() => []);

  const perVariant = await Promise.all(
    variants.map(async (v) => {
      const variantHref = entityHref("variant", v.id);
      const [qtys, stock] = await Promise.all([monthlySoldQty(variantHref, months), getVariantStock(v.id)]);
      const forecastQtys = seasonalTrendForecast(qtys, monthIndexes, future);
      const name = v.characteristics?.[0]?.value ?? v.name;
      const modification: ModificationForecast = {
        name,
        stock,
        history: months.map((m, i) => ({ label: m.label, qty: qtys[i] })),
        forecast: future.map((f, i) => ({ label: f.label, qty: forecastQtys[i] })),
        historyTotalQty: qtys.reduce((s, x) => s + x, 0),
        forecastTotalQty: forecastQtys.reduce((s, x) => s + x, 0),
      };
      return modification;
    })
  );

  perVariant.sort((a, b) => b.historyTotalQty - a.historyTotalQty);

  const history = months.map((m, i) => ({
    label: m.label,
    qty: perVariant.reduce((s, v) => s + v.history[i].qty, 0),
    sum: 0,
  }));
  const forecast = future.map((f, i) => ({
    label: f.label,
    qty: perVariant.reduce((s, v) => s + v.forecast[i].qty, 0),
  }));
  const currentStock = perVariant.reduce((s, v) => s + v.stock, 0);
  const historyTotalQty = perVariant.reduce((s, v) => s + v.historyTotalQty, 0);
  const forecastTotalQty = perVariant.reduce((s, v) => s + v.forecastTotalQty, 0);

  return {
    productName: detail.name,
    currentStock,
    modifications: perVariant,
    history,
    forecast,
    historyTotalQty,
    forecastTotalQty,
    suggestedPurchaseQty: Math.max(0, Math.round(forecastTotalQty - currentStock)),
  };
}
