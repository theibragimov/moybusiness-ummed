import "server-only";
import { buildFilter, entityHref, fetchAllRows, msGet, type MsListResponse } from "./moysklad";
import { dayOf, momentFrom, momentTo, lastMonths, todayYmd, daysAgoYmd, hoursAgoMoment } from "./tashkent";
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

// Goods purchases are already reflected in COGS (sellCostSum from the profit
// report), so counting them again under operating expenses would double them up.
function isGoodsPurchaseCategory(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("закуп") || n.includes("покупк") || n.includes("xarid") || n.includes("zakup");
}

// "Перемещение" (transfer) is money moving between the company's own accounts
// (card <-> cash), not money leaving the business — it must never be counted
// as an expense.
function isTransferCategory(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("перемещен") || n.includes("ko'chirish") || n.includes("kochirish");
}

function isNonExpenseCategory(name: string): boolean {
  return isGoodsPurchaseCategory(name) || isTransferCategory(name);
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

// Expenses can be recorded as either a cash outflow (entity/cashout) or a bank
// outgoing payment (entity/paymentout) — both are real expenses in MoySklad's own
// "Платежи" list, so anything reading expenses must pull both or it silently
// undercounts categories that are usually paid by card/bank transfer.
async function listCashOutflows(from: string, to: string): Promise<CashoutRow[]> {
  const [cashouts, paymentouts] = await Promise.all([
    fetchAllRows<CashoutRow>("entity/cashout", { filter: dateRangeFilter(from, to) }),
    fetchAllRows<CashoutRow>("entity/paymentout", { filter: dateRangeFilter(from, to) }).catch(
      () => [] as CashoutRow[]
    ),
  ]);
  return [...cashouts, ...paymentouts].sort((a, b) => (a.moment < b.moment ? 1 : -1));
}

async function listDemands(from: string, to: string): Promise<DemandRow[]> {
  return fetchAllRows<DemandRow>("entity/demand", {
    filter: dateRangeFilter(from, to),
    order: "moment,desc",
  });
}

// ---------- dashboard ----------

export interface MonthlyPLRow {
  label: string; // "YYYY-MM"
  revenue: number;
  cogs: number; // cost of goods sold (sellCostSum) — revenue - cogs = grossProfit
  grossProfit: number;
  netProfit: number;
  expenses: number; // operating expenses (excludes goods purchases, already in COGS)
  expensesByCategory: { category: string; sum: number }[];
}

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
  // P&L
  monthCostSum: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpensesSum: number;
  netProfit: number;
  netMargin: number;
  // last 12 real calendar months, for the monthly revenue/profit/expenses trend chart
  monthlyPL: MonthlyPLRow[];
}

/**
 * Revenue, gross profit, net profit and operating expenses for each of the last
 * `count` real calendar months (oldest first), for the dashboard trend chart.
 */
async function getMonthlyPL(count: number): Promise<MonthlyPLRow[]> {
  const months = lastMonths(count);
  const [profitByMonth, opexRows, expenseItemNames] = await Promise.all([
    Promise.all(
      months.map((m) =>
        fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
          momentFrom: momentFrom(m.start),
          momentTo: momentTo(m.end),
        }).catch(() => [] as ProfitByProductRow[])
      )
    ),
    listCashOutflows(months[0].start, months[months.length - 1].end),
    getExpenseItemNames(),
  ]);

  const opexByMonth = new Map<string, number>();
  const opexByMonthCategory = new Map<string, Map<string, number>>();
  for (const r of opexRows) {
    const cat = categoryName(r, expenseItemNames);
    if (isNonExpenseCategory(cat)) continue;
    const month = dayOf(r.moment).slice(0, 7);
    opexByMonth.set(month, (opexByMonth.get(month) ?? 0) + r.sum);
    const catMap = opexByMonthCategory.get(month) ?? new Map<string, number>();
    catMap.set(cat, (catMap.get(cat) ?? 0) + r.sum);
    opexByMonthCategory.set(month, catMap);
  }

  return months.map((m, i) => {
    const revenue = profitByMonth[i].reduce((s, r) => s + r.sellSum, 0);
    const cogs = profitByMonth[i].reduce((s, r) => s + r.sellCostSum, 0);
    const grossProfit = profitByMonth[i].reduce((s, r) => s + r.profit, 0);
    const expenses = opexByMonth.get(m.label) ?? 0;
    const expensesByCategory = [...(opexByMonthCategory.get(m.label) ?? new Map<string, number>()).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, sum]) => ({ category, sum }));
    return {
      label: m.label,
      revenue,
      cogs,
      grossProfit,
      netProfit: grossProfit - expenses,
      expenses,
      expensesByCategory,
    };
  });
}

export function getDashboardData(todayYmd: string, monthStartYmd: string): Promise<DashboardData> {
  return cached(`dashboard:${todayYmd}:${monthStartYmd}`, () => getDashboardDataImpl(todayYmd, monthStartYmd));
}

async function getDashboardDataImpl(todayYmd: string, monthStartYmd: string): Promise<DashboardData> {
  const [monthDemands, monthCashouts, moneyReport, expenseItemNames, recentDemandsExpanded, monthlyPL] =
    await Promise.all([
      listDemands(monthStartYmd, todayYmd),
      listCashOutflows(monthStartYmd, todayYmd),
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
      getMonthlyPL(12),
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
  const profitRows = await fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
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
  let operatingExpensesSum = 0;
  for (const c of monthCashouts) {
    const cat = categoryName(c, expenseItemNames);
    // Transfers between the company's own accounts (card <-> cash) are never spending.
    if (isTransferCategory(cat)) continue;
    monthExpensesSum += c.sum;
    if (!isNonExpenseCategory(cat)) {
      operatingExpensesSum += c.sum;
      // Goods purchases are COGS, already reflected in the P&L above — leave them
      // out of the category breakdown so it matches the Expenses page.
      expenseMap.set(cat, (expenseMap.get(cat) ?? 0) + c.sum);
    }
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

  // P&L: derived from the profit-by-product report so revenue/cost/profit stay
  // internally consistent (report/dashboard/money's own figures can diverge slightly).
  const plRevenue = profitRows.reduce((s, r) => s + r.sellSum, 0);
  const monthCostSum = profitRows.reduce((s, r) => s + r.sellCostSum, 0);
  const grossProfit = profitRows.reduce((s, r) => s + r.profit, 0);
  const grossMargin = plRevenue > 0 ? grossProfit / plRevenue : 0;
  const netProfit = grossProfit - operatingExpensesSum;
  const netMargin = plRevenue > 0 ? netProfit / plRevenue : 0;

  return {
    todaySalesSum: todayDemands.reduce((s, d) => s + d.sum, 0),
    todaySalesCount: todayDemands.length,
    monthRevenueSum: monthDemands.reduce((s, d) => s + d.sum, 0),
    monthShipmentsCount: monthDemands.length,
    monthShipmentsSum: monthDemands.reduce((s, d) => s + d.sum, 0),
    monthExpensesSum,
    cashBalance: moneyReport.money?.balance ?? 0,
    monthCostSum,
    grossProfit,
    grossMargin,
    operatingExpensesSum,
    netProfit,
    netMargin,
    salesByDay,
    topProducts,
    recentShipments,
    expensesByCategory,
    monthlyPL,
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

export interface StockValueRow {
  name: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  currentStock: number;
  stockValue: number;
}

export interface DeadStockRow {
  name: string;
  currentStock: number;
  qty6mo: number;
  stockValue: number;
}

export interface WeeklyDeclineRow {
  name: string;
  prevWeekQty: number;
  thisWeekQty: number;
  change: number;
}

export interface AnalyticsData {
  topSold: ProductAnalyticsRow[];
  abc: (ProductAnalyticsRow & { share: number; cumulative: number; group: "A" | "B" | "C" })[];
  abcSummary: { group: "A" | "B" | "C"; count: number; revenueShare: number }[];
  abcTotalRevenue: number;
  stockValue: StockValueRow[];
  deadStock6mo: DeadStockRow[];
  declining: WeeklyDeclineRow[];
}

export function getAnalyticsData(from: string, to: string): Promise<AnalyticsData> {
  return cached(`analytics:${from}:${to}`, () => getAnalyticsDataImpl(from, to));
}

export interface StockSnapshotRow {
  name: string;
  stock: number;
  price: number;
}

/**
 * The full-catalog `report/stock/all` snapshot doesn't depend on any period, so
 * analytics, warehouse, and company-health all share one cached fetch instead of
 * each re-pulling the whole catalog (previously up to 3 independent 5-page fetches
 * per cache warm-up, which was the main cause of slow first loads).
 */
function getStockSnapshot(): Promise<StockSnapshotRow[]> {
  return cached("stock-snapshot", () =>
    fetchAllRows<StockSnapshotRow>("report/stock/all", {}, 5000).catch(() => [] as StockSnapshotRow[])
  );
}

async function getAnalyticsDataImpl(from: string, to: string): Promise<AnalyticsData> {
  const sixMonthsAgo = lastMonths(6)[0].start;
  const today = todayYmd();
  const thisWeekFrom = daysAgoYmd(6);
  const prevWeekFrom = daysAgoYmd(13);
  const prevWeekTo = daysAgoYmd(7);

  const [rows, stockRows, rows6mo, thisWeekRows, prevWeekRows] = await Promise.all([
    fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
      momentFrom: momentFrom(from),
      momentTo: momentTo(to),
    }),
    getStockSnapshot(),
    fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
      momentFrom: momentFrom(sixMonthsAgo),
      momentTo: momentTo(today),
    }).catch(() => [] as ProfitByProductRow[]),
    fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
      momentFrom: momentFrom(thisWeekFrom),
      momentTo: momentTo(today),
    }).catch(() => [] as ProfitByProductRow[]),
    fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
      momentFrom: momentFrom(prevWeekFrom),
      momentTo: momentTo(prevWeekTo),
    }).catch(() => [] as ProfitByProductRow[]),
  ]);

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

  const topSold = [...mapped].sort((a, b) => b.qty - a.qty);

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

  // ----- money tied up in stock (current stock, at cost, regardless of period sales) -----
  const perfByName = new Map(mapped.map((r) => [r.name, r]));
  const stockValue: StockValueRow[] = stockRows
    .filter((r) => r.stock > 0)
    .map((r) => {
      const perf = perfByName.get(r.name);
      return {
        name: r.name,
        qty: perf?.qty ?? 0,
        revenue: perf?.revenue ?? 0,
        cost: perf?.cost ?? 0,
        profit: perf?.profit ?? 0,
        margin: perf?.margin ?? 0,
        currentStock: r.stock,
        stockValue: r.stock * r.price,
      };
    })
    .sort((a, b) => b.stockValue - a.stockValue);

  // ----- dead stock: in stock now, but not a single unit sold in the last 6 real months -----
  const qty6moByName = new Map<string, number>();
  for (const r of rows6mo) {
    if (r.sellQuantity <= 0) continue;
    qty6moByName.set(r.assortment.name, (qty6moByName.get(r.assortment.name) ?? 0) + r.sellQuantity);
  }
  const deadStock6mo: DeadStockRow[] = stockRows
    .filter((r) => r.stock > 0 && (qty6moByName.get(r.name) ?? 0) === 0)
    .map((r) => ({
      name: r.name,
      currentStock: r.stock,
      qty6mo: qty6moByName.get(r.name) ?? 0,
      stockValue: r.stock * r.price,
    }))
    .sort((a, b) => b.stockValue - a.stockValue);

  // ----- week-over-week decline: sold less this week (last 7 days) than the week before -----
  const thisWeekMap = new Map<string, number>();
  for (const r of thisWeekRows) {
    if (r.sellQuantity <= 0) continue;
    thisWeekMap.set(r.assortment.name, (thisWeekMap.get(r.assortment.name) ?? 0) + r.sellQuantity);
  }
  const prevWeekMap = new Map<string, number>();
  for (const r of prevWeekRows) {
    if (r.sellQuantity <= 0) continue;
    prevWeekMap.set(r.assortment.name, (prevWeekMap.get(r.assortment.name) ?? 0) + r.sellQuantity);
  }
  const declineNames = new Set([...thisWeekMap.keys(), ...prevWeekMap.keys()]);
  const declining: WeeklyDeclineRow[] = [...declineNames]
    .map((name) => {
      const prevWeekQty = prevWeekMap.get(name) ?? 0;
      const thisWeekQty = thisWeekMap.get(name) ?? 0;
      return { name, prevWeekQty, thisWeekQty, change: thisWeekQty - prevWeekQty };
    })
    .filter((r) => r.thisWeekQty < r.prevWeekQty)
    .sort((a, b) => a.change - b.change);

  return {
    topSold,
    abc,
    abcSummary,
    abcTotalRevenue: totalRevenue,
    stockValue,
    deadStock6mo,
    declining,
  };
}

// ---------- expenses ----------

export interface ExpensesData {
  total: number;
  revenue: number;
  opexToRevenue: number;
  budgetAvg: number;
  budgetUsage: number;
  byCategory: { category: string; sum: number }[];
  byDay: { day: string; sum: number }[];
  categoryDaily: { category: string; days: { day: string; sum: number }[] }[];
  recent: { id: string; moment: string; sum: number; category: string; description: string }[];
}

export function getExpensesData(from: string, to: string): Promise<ExpensesData> {
  return cached(`expenses:${from}:${to}`, () => getExpensesDataImpl(from, to));
}

/** Average monthly OPEX (goods purchases excluded) over the last 6 real calendar months, used as a rough budget line. */
async function getOpexBudgetAvg(): Promise<number> {
  const months = lastMonths(6);
  const [rows, expenseItemNames] = await Promise.all([
    listCashOutflows(months[0].start, months[months.length - 1].end),
    getExpenseItemNames(),
  ]);
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    const cat = categoryName(r, expenseItemNames);
    if (isNonExpenseCategory(cat)) continue;
    const month = dayOf(r.moment).slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + r.sum);
  }
  const sum = [...byMonth.values()].reduce((s, v) => s + v, 0);
  return sum / months.length;
}

async function getExpensesDataImpl(from: string, to: string): Promise<ExpensesData> {
  const [rows, expenseItemNames, periodDemands, budgetAvg] = await Promise.all([
    listCashOutflows(from, to),
    getExpenseItemNames(),
    listDemands(from, to),
    getOpexBudgetAvg(),
  ]);
  const revenue = periodDemands.reduce((s, d) => s + d.sum, 0);

  const byCategoryMap = new Map<string, number>();
  const byDayMap = new Map<string, number>();
  const byCategoryDayMap = new Map<string, Map<string, number>>();
  let total = 0;
  for (const r of rows) {
    const cat = categoryName(r, expenseItemNames);
    // Goods purchases are COGS, not an operating expense — same exclusion as the
    // dashboard's P&L, so this page's totals and category breakdown don't double-count them.
    if (isNonExpenseCategory(cat)) continue;
    const day = dayOf(r.moment);
    byCategoryMap.set(cat, (byCategoryMap.get(cat) ?? 0) + r.sum);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + r.sum);
    const dayMap = byCategoryDayMap.get(cat) ?? new Map<string, number>();
    dayMap.set(day, (dayMap.get(day) ?? 0) + r.sum);
    byCategoryDayMap.set(cat, dayMap);
    total += r.sum;
  }

  const byCategory = [...byCategoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, sum]) => ({ category, sum }));

  const byDay = [...byDayMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, sum]) => ({ day, sum }));

  const dayLabels = byDay.map((d) => d.day);
  const categoryDaily = byCategory.map(({ category }) => {
    const dayMap = byCategoryDayMap.get(category) ?? new Map<string, number>();
    return { category, days: dayLabels.map((day) => ({ day, sum: dayMap.get(day) ?? 0 })) };
  });

  const recent = rows.slice(0, 100).map((r) => ({
    id: r.id,
    moment: r.moment,
    sum: r.sum,
    category: categoryName(r, expenseItemNames),
    description: r.description ?? "",
  }));

  return {
    total,
    revenue,
    opexToRevenue: revenue > 0 ? total / revenue : 0,
    budgetAvg,
    budgetUsage: budgetAvg > 0 ? total / budgetAvg : 0,
    byCategory,
    byDay,
    categoryDaily,
    recent,
  };
}

// ---------- CRM / counterparties ----------

export type CounterpartySegment = "customer" | "supplier" | "employee";

export interface CounterpartyRow {
  id: string;
  name: string;
  phone: string;
  demandsCount: number;
  demandsSum: number;
  averageReceipt: number;
  lastDemandDate: string | null;
  balance: number;
  segment: CounterpartySegment;
}

interface CounterpartyEntityRow {
  id: string;
  name: string;
  state?: { meta: { href: string } };
}

/**
 * Counterparties are segmented by their MoySklad "state" (a free-text pipeline
 * status like "Поставшик" or "Сатрудник" — account-specific, typo and all).
 * Everything that isn't tagged supplier/employee is a customer, whether it's
 * a pharmacy, hospital, wholesaler, or medical-equipment buyer.
 */
function classifySegment(stateName: string | undefined): CounterpartySegment {
  if (!stateName) return "customer";
  const n = stateName.toLowerCase();
  if (n.includes("постав")) return "supplier";
  if (n.includes("сотруд") || n.includes("сатруд")) return "employee";
  return "customer";
}

interface CounterpartyMeta {
  name: string;
  segment: CounterpartySegment;
}

async function getCounterpartyMeta(): Promise<Map<string, CounterpartyMeta>> {
  const [rows, meta] = await Promise.all([
    fetchAllRows<CounterpartyEntityRow>("entity/counterparty", {}, 5000),
    msGet<{ states: { id: string; name: string }[] }>("entity/counterparty/metadata", {}),
  ]);
  const stateNames = new Map(meta.states.map((s) => [s.id, s.name]));
  const result = new Map<string, CounterpartyMeta>();
  for (const r of rows) {
    const stateId = r.state?.meta.href ? idFromHref(r.state.meta.href) : undefined;
    const stateName = stateId ? stateNames.get(stateId) : undefined;
    result.set(r.id, { name: r.name, segment: classifySegment(stateName) });
  }
  return result;
}

export function getCounterparties(): Promise<CounterpartyRow[]> {
  return cached("counterparties", getCounterpartiesImpl);
}

async function getCounterpartiesImpl(): Promise<CounterpartyRow[]> {
  const [rows, meta] = await Promise.all([
    fetchAllRows<CounterpartyReportRow>("report/counterparty", {}, 2000),
    getCounterpartyMeta(),
  ]);
  return rows.map((r) => ({
    id: r.counterparty.id,
    name: r.counterparty.name,
    phone: r.counterparty.phone ?? "",
    demandsCount: r.demandsCount,
    demandsSum: r.demandsSum,
    averageReceipt: r.averageReceipt,
    lastDemandDate: r.lastDemandDate,
    balance: r.balance,
    segment: meta.get(r.counterparty.id)?.segment ?? "customer",
  }));
}

// ---------- CRM / ABC customer analysis ----------

export interface CustomerAbcRow {
  id: string;
  name: string;
  revenue: number;
  share: number;
  cumulative: number;
  group: "A" | "B" | "C";
}

export interface CustomerAbcData {
  from: string;
  to: string;
  rows: CustomerAbcRow[];
  totalRevenue: number;
  summary: { group: "A" | "B" | "C"; count: number; revenueShare: number }[];
}

export function getCustomerAbc(from: string, to: string): Promise<CustomerAbcData> {
  return cached(`customer-abc:${from}:${to}`, () => getCustomerAbcImpl(from, to));
}

async function getCustomerAbcImpl(from: string, to: string): Promise<CustomerAbcData> {
  const [demands, meta] = await Promise.all([
    fetchAllRows<DemandRow>("entity/demand", { filter: dateRangeFilter(from, to) }, 20000),
    getCounterpartyMeta(),
  ]);

  const revenueById = new Map<string, number>();
  for (const d of demands) {
    const href = d.agent?.meta.href;
    if (!href) continue;
    const id = idFromHref(href);
    if (meta.get(id)?.segment === "supplier" || meta.get(id)?.segment === "employee") continue;
    revenueById.set(id, (revenueById.get(id) ?? 0) + d.sum);
  }

  const totalRevenue = [...revenueById.values()].reduce((s, v) => s + v, 0);
  const sorted = [...revenueById.entries()].sort((a, b) => b[1] - a[1]);
  let cumulative = 0;
  const rows: CustomerAbcRow[] = sorted.map(([id, revenue]) => {
    const share = totalRevenue > 0 ? revenue / totalRevenue : 0;
    cumulative += share;
    const group: "A" | "B" | "C" = cumulative <= 0.8 ? "A" : cumulative <= 0.95 ? "B" : "C";
    return { id, name: meta.get(id)?.name ?? id, revenue, share, cumulative, group };
  });

  const summary = (["A", "B", "C"] as const).map((group) => {
    const items = rows.filter((r) => r.group === group);
    return { group, count: items.length, revenueShare: items.reduce((s, r) => s + r.share, 0) };
  });

  return { from, to, rows, totalRevenue, summary };
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
      msGet<MsListResponse<ProfitByProductRow>>("report/profit/byvariant", {
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

// ---------- company health ----------

type HealthFactor = "good" | "ok" | "bad";

export interface CompanyHealth {
  cashPosition: number;
  bankBalance: number;
  kassaBalance: number;
  debitorQarz: number;
  kreditorQarz: number;
  revenue: number;
  salesGrowth: number;
  averageCheck: number;
  grossProfit: number;
  grossMargin: number;
  netProfit: number;
  netMargin: number;
  stockValue: number;
  deadStockCount: number;
  deadStockValue: number;
  stockoutCount: number;
  topProfitable: { name: string; profit: number }[];
  lowMargin: { name: string; margin: number; qty: number }[];
  expiryDetectedCount: number;
  expiringSoonCount: number;
  expiringSoon: { name: string; year: number; month: number; stock: number }[];
  score: number;
  verdict: "good" | "average" | "bad";
  factors: {
    margin: HealthFactor;
    growth: HealthFactor;
    receivables: HealthFactor;
    deadStock: HealthFactor;
    stockouts: HealthFactor;
  };
}

function parseExpiryFromName(name: string): { year: number; month: number } | null {
  const m = name.match(/(\d{4})\.(\d{1,2})\)/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

export function getCompanyHealth(todayYmd: string, monthStartYmd: string): Promise<CompanyHealth> {
  return cached(`company-health:${todayYmd}:${monthStartYmd}`, () =>
    getCompanyHealthImpl(todayYmd, monthStartYmd)
  );
}

interface MoneySumRow {
  sum: number;
}

/**
 * Bank vs. cash-on-hand split, from all-time running totals — MoySklad's own
 * balance report only gives one combined figure. cashin/cashout are physical
 * cash (kassa); paymentin/paymentout are bank transfers.
 */
async function getCashBreakdown(): Promise<{ bankBalance: number; kassaBalance: number }> {
  const [cashin, cashout, paymentin, paymentout] = await Promise.all([
    fetchAllRows<MoneySumRow>("entity/cashin", {}, 20000),
    fetchAllRows<MoneySumRow>("entity/cashout", {}, 20000),
    fetchAllRows<MoneySumRow>("entity/paymentin", {}, 20000),
    fetchAllRows<MoneySumRow>("entity/paymentout", {}, 20000),
  ]);
  const sum = (rows: MoneySumRow[]) => rows.reduce((s, r) => s + r.sum, 0);
  return {
    kassaBalance: sum(cashin) - sum(cashout),
    bankBalance: sum(paymentin) - sum(paymentout),
  };
}

/**
 * Average MTD-equivalent Net Profit (gross profit − OPEX) over the last 6 real
 * calendar months, used as a rough budget line. Doesn't depend on the caller's
 * selected from/to, so it's cached under its own key (by current month) —
 * otherwise every distinct Net Profit period would redundantly recompute it.
 */
function getNetProfitBudgetAvg(): Promise<number> {
  return cached(`net-profit-budget:${lastMonths(1)[0].label}`, getNetProfitBudgetAvgImpl);
}

async function getNetProfitBudgetAvgImpl(): Promise<number> {
  const months = lastMonths(6);
  const [profitByMonth, opexRows, expenseItemNames] = await Promise.all([
    Promise.all(
      months.map((m) =>
        fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
          momentFrom: momentFrom(m.start),
          momentTo: momentTo(m.end),
        }).catch(() => [] as ProfitByProductRow[])
      )
    ),
    listCashOutflows(months[0].start, months[months.length - 1].end),
    getExpenseItemNames(),
  ]);

  const opexByMonth = new Map<string, number>();
  for (const r of opexRows) {
    const cat = categoryName(r, expenseItemNames);
    if (isNonExpenseCategory(cat)) continue;
    const month = dayOf(r.moment).slice(0, 7);
    opexByMonth.set(month, (opexByMonth.get(month) ?? 0) + r.sum);
  }

  const netProfits = months.map((m, i) => {
    const grossProfit = profitByMonth[i].reduce((s, r) => s + r.profit, 0);
    const opex = opexByMonth.get(m.label) ?? 0;
    return grossProfit - opex;
  });
  return netProfits.reduce((s, v) => s + v, 0) / months.length;
}

export interface NetProfitData {
  from: string;
  to: string;
  revenue: number;
  cogs: number;
  opex: number;
  grossProfit: number;
  grossMargin: number;
  netProfit: number;
  netMargin: number;
  budgetAvg: number;
  budgetUsage: number;
}

export function getNetProfitData(from: string, to: string): Promise<NetProfitData> {
  return cached(`net-profit:${from}:${to}`, () => getNetProfitDataImpl(from, to));
}

async function getNetProfitDataImpl(from: string, to: string): Promise<NetProfitData> {
  const [profitRows, opexRows, expenseItemNames, budgetAvg] = await Promise.all([
    fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
      momentFrom: momentFrom(from),
      momentTo: momentTo(to),
    }),
    listCashOutflows(from, to),
    getExpenseItemNames(),
    getNetProfitBudgetAvg(),
  ]);

  const revenue = profitRows.reduce((s, r) => s + r.sellSum, 0);
  const cogs = profitRows.reduce((s, r) => s + r.sellCostSum, 0);
  const grossProfit = profitRows.reduce((s, r) => s + r.profit, 0);
  const grossMargin = revenue > 0 ? grossProfit / revenue : 0;

  let opex = 0;
  for (const r of opexRows) {
    const cat = categoryName(r, expenseItemNames);
    if (isNonExpenseCategory(cat)) continue;
    opex += r.sum;
  }

  const netProfit = grossProfit - opex;
  const netMargin = revenue > 0 ? netProfit / revenue : 0;

  return {
    from,
    to,
    revenue,
    cogs,
    opex,
    grossProfit,
    grossMargin,
    netProfit,
    netMargin,
    budgetAvg,
    budgetUsage: budgetAvg !== 0 ? netProfit / budgetAvg : 0,
  };
}

async function getCompanyHealthImpl(todayYmd: string, monthStartYmd: string): Promise<CompanyHealth> {
  const threeMonthsAgo = lastMonths(3)[0].start;
  const prevMonth = lastMonths(2)[0];

  const [dashboard, debts, stockRows, profitRowsMonth, profitRows3mo, prevMonthDemands, cashBreakdown] =
    await Promise.all([
      getDashboardData(todayYmd, monthStartYmd),
      getDebtsData(),
      getStockSnapshot(),
      fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
        momentFrom: momentFrom(monthStartYmd),
        momentTo: momentTo(todayYmd),
      }),
      fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
        momentFrom: momentFrom(threeMonthsAgo),
        momentTo: momentTo(todayYmd),
      }),
      fetchAllRows<DemandRow>("entity/demand", {
        filter: dateRangeFilter(prevMonth.start, prevMonth.end),
      }),
      getCashBreakdown(),
    ]);

  const revenue = dashboard.monthRevenueSum;
  const daysElapsed = Number(todayYmd.slice(8, 10));
  const thisMonthDailyAvg = daysElapsed > 0 ? revenue / daysElapsed : 0;
  const prevMonthRevenue = prevMonthDemands.reduce((s, d) => s + d.sum, 0);
  const prevMonthDays = Number(prevMonth.end.slice(8, 10));
  const prevMonthDailyAvg = prevMonthDays > 0 ? prevMonthRevenue / prevMonthDays : 0;
  const salesGrowth = prevMonthDailyAvg > 0 ? (thisMonthDailyAvg - prevMonthDailyAvg) / prevMonthDailyAvg : 0;

  const averageCheck = dashboard.monthShipmentsCount > 0 ? revenue / dashboard.monthShipmentsCount : 0;

  const stockValue = stockRows.reduce((s, r) => s + r.stock * r.price, 0);

  const soldNames3mo = new Set(profitRows3mo.filter((r) => r.sellQuantity > 0).map((r) => r.assortment.name));
  const deadStockRows = stockRows.filter((r) => r.stock > 0 && !soldNames3mo.has(r.name));
  const deadStockCount = deadStockRows.length;
  const deadStockValue = deadStockRows.reduce((s, r) => s + r.stock * r.price, 0);
  const stockoutCount = stockRows.filter((r) => r.stock <= 0 && soldNames3mo.has(r.name)).length;

  const topProfitable = [...profitRowsMonth]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5)
    .map((r) => ({ name: r.assortment.name, profit: r.profit }));
  const lowMargin = profitRowsMonth
    .filter((r) => r.sellQuantity > 0)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 5)
    .map((r) => ({ name: r.assortment.name, margin: r.margin, qty: r.sellQuantity }));

  const now = new Date();
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth() + 1;
  const withExpiry = stockRows
    .filter((r) => r.stock > 0)
    .map((r) => ({ ...r, expiry: parseExpiryFromName(r.name) }))
    .filter((r): r is StockSnapshotRow & { expiry: { year: number; month: number } } => r.expiry !== null);
  const expiringSoon = withExpiry
    .filter((r) => {
      const monthsAway = (r.expiry.year - curYear) * 12 + (r.expiry.month - curMonth);
      return monthsAway >= 0 && monthsAway <= 6;
    })
    .map((r) => ({ name: r.name, year: r.expiry.year, month: r.expiry.month, stock: r.stock }));

  // Scoring is an automated heuristic to flag attention areas, not financial advice.
  let score = 0;
  let margin: HealthFactor;
  if (dashboard.netMargin > 0.15) {
    margin = "good";
    score += 2;
  } else if (dashboard.netMargin > 0) {
    margin = "ok";
    score += 1;
  } else {
    margin = "bad";
    score -= 2;
  }

  const growth: HealthFactor = salesGrowth >= 0 ? "good" : "bad";
  score += growth === "good" ? 1 : -1;

  const netReceivable = debts.totalDebtToUs - debts.totalDebtByUs;
  const receivables: HealthFactor = netReceivable > revenue * 2 ? "bad" : "good";
  score += receivables === "good" ? 1 : -1;

  const deadStock: HealthFactor = stockValue > 0 && deadStockValue > stockValue * 0.3 ? "bad" : "good";
  score += deadStock === "good" ? 1 : -1;

  const stockouts: HealthFactor = stockoutCount > 5 ? "bad" : "good";
  score += stockouts === "good" ? 1 : -1;

  const verdict: "good" | "average" | "bad" = score >= 3 ? "good" : score >= 0 ? "average" : "bad";

  return {
    cashPosition: dashboard.cashBalance,
    bankBalance: cashBreakdown.bankBalance,
    kassaBalance: cashBreakdown.kassaBalance,
    debitorQarz: debts.totalDebtToUs,
    kreditorQarz: debts.totalDebtByUs,
    revenue,
    salesGrowth,
    averageCheck,
    grossProfit: dashboard.grossProfit,
    grossMargin: dashboard.grossMargin,
    netProfit: dashboard.netProfit,
    netMargin: dashboard.netMargin,
    stockValue,
    deadStockCount,
    deadStockValue,
    stockoutCount,
    topProfitable,
    lowMargin,
    expiryDetectedCount: withExpiry.length,
    expiringSoonCount: expiringSoon.length,
    expiringSoon: expiringSoon.slice(0, 20),
    score,
    verdict,
    factors: { margin, growth, receivables, deadStock, stockouts },
  };
}

// ---------- warehouse ----------

/**
 * MoySklad doesn't carry a per-supplier lead time, so we assume a flat lead time
 * (days between placing and receiving a purchase order) for every SKU. Adjust here
 * if the real average lead time differs — it drives the reorder point / min / max levels.
 */
const WAREHOUSE_LEAD_TIME_DAYS = 14;
/** Assumed days between purchase order cycles, used to size the max-stock ceiling. */
const WAREHOUSE_ORDER_CYCLE_DAYS = 30;
/** Below this many days of stock left is still "normal"; above it, a moving SKU is flagged slow. */
const SLOW_MOVING_DAYS_THRESHOLD = 120;

export type WarehouseStatus = "normal" | "slow" | "dead" | "expiring";

export interface WarehouseRow {
  name: string;
  code?: string;
  stock: number;
  stockValue: number;
  qty30: number;
  avgDailySales: number;
  daysOfStockLeft: number | null;
  leadTimeDays: number;
  reorderPoint: number;
  minStock: number;
  maxStock: number;
  excessStock: number;
  status: WarehouseStatus;
  expiry: { year: number; month: number } | null;
}

export interface WarehouseData {
  rows: WarehouseRow[];
  summary: { status: WarehouseStatus; count: number; value: number }[];
  leadTimeDays: number;
}

export function getWarehouseData(): Promise<WarehouseData> {
  return cached(`warehouse:${todayYmd()}`, getWarehouseDataImpl);
}

function monthsUntil(expiry: { year: number; month: number }, todayYmdStr: string): number {
  const year = Number(todayYmdStr.slice(0, 4));
  const month = Number(todayYmdStr.slice(5, 7));
  return (expiry.year - year) * 12 + (expiry.month - month);
}

async function getWarehouseDataImpl(): Promise<WarehouseData> {
  const today = todayYmd();
  const from30 = daysAgoYmd(29);
  const sixMonthsAgo = lastMonths(6)[0].start;

  const [stockRows, rows30, rows6mo] = await Promise.all([
    getStockSnapshot(),
    fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
      momentFrom: momentFrom(from30),
      momentTo: momentTo(today),
    }).catch(() => [] as ProfitByProductRow[]),
    fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
      momentFrom: momentFrom(sixMonthsAgo),
      momentTo: momentTo(today),
    }).catch(() => [] as ProfitByProductRow[]),
  ]);

  const qty30ByName = new Map<string, number>();
  for (const r of rows30) {
    if (r.sellQuantity <= 0) continue;
    qty30ByName.set(r.assortment.name, (qty30ByName.get(r.assortment.name) ?? 0) + r.sellQuantity);
  }
  const qty6moByName = new Map<string, number>();
  for (const r of rows6mo) {
    if (r.sellQuantity <= 0) continue;
    qty6moByName.set(r.assortment.name, (qty6moByName.get(r.assortment.name) ?? 0) + r.sellQuantity);
  }

  const rows: WarehouseRow[] = stockRows
    .filter((r) => r.stock > 0)
    .map((r) => {
      const qty30 = qty30ByName.get(r.name) ?? 0;
      const qty6mo = qty6moByName.get(r.name) ?? 0;
      const avgDailySales = qty30 / 30;
      const daysOfStockLeft = avgDailySales > 0 ? r.stock / avgDailySales : null;

      const minStock = Math.ceil(avgDailySales * (WAREHOUSE_LEAD_TIME_DAYS / 2));
      const reorderPoint = Math.ceil(avgDailySales * WAREHOUSE_LEAD_TIME_DAYS) + minStock;
      const maxStock = reorderPoint + Math.ceil(avgDailySales * WAREHOUSE_ORDER_CYCLE_DAYS);
      const excessStock = Math.max(0, r.stock - maxStock);

      const expiry = parseExpiryFromName(r.name);
      const expiringSoon = expiry !== null && (() => {
        const away = monthsUntil(expiry, today);
        return away >= 0 && away <= 6;
      })();

      let status: WarehouseStatus;
      if (expiringSoon) status = "expiring";
      else if (qty6mo === 0) status = "dead";
      else if (daysOfStockLeft !== null && daysOfStockLeft > SLOW_MOVING_DAYS_THRESHOLD) status = "slow";
      else status = "normal";

      return {
        name: r.name,
        stock: r.stock,
        stockValue: r.stock * r.price,
        qty30,
        avgDailySales,
        daysOfStockLeft,
        leadTimeDays: WAREHOUSE_LEAD_TIME_DAYS,
        reorderPoint,
        minStock,
        maxStock,
        excessStock,
        status,
        expiry,
      };
    })
    .sort((a, b) => b.stockValue - a.stockValue);

  const summary = (["expiring", "dead", "slow", "normal"] as const).map((status) => {
    const items = rows.filter((r) => r.status === status);
    return { status, count: items.length, value: items.reduce((s, r) => s + r.stockValue, 0) };
  });

  return { rows, summary, leadTimeDays: WAREHOUSE_LEAD_TIME_DAYS };
}

// ---------- telegram alerts ----------

/**
 * A product needs restocking when it sold at least this many units in the last
 * 15 days AND current stock is less than that 15-day quantity — i.e. at the
 * recent pace, stock won't last another 15 days.
 */
const ALERT_QTY15_MIN = 3;

export interface RestockAlertRow {
  name: string;
  stock: number;
  qty15: number;
}

/** Well-selling products whose stock has fallen below their own last-15-days sales pace. */
export async function getRestockAlerts(): Promise<RestockAlertRow[]> {
  const today = todayYmd();
  const from15 = daysAgoYmd(14);
  const [stockRows, rows15] = await Promise.all([
    getStockSnapshot(),
    fetchAllRows<ProfitByProductRow>("report/profit/byvariant", {
      momentFrom: momentFrom(from15),
      momentTo: momentTo(today),
    }).catch(() => [] as ProfitByProductRow[]),
  ]);

  const qty15ByName = new Map<string, number>();
  for (const r of rows15) {
    if (r.sellQuantity <= 0) continue;
    qty15ByName.set(r.assortment.name, (qty15ByName.get(r.assortment.name) ?? 0) + r.sellQuantity);
  }

  return stockRows
    .map((r) => ({ name: r.name, stock: r.stock, qty15: qty15ByName.get(r.name) ?? 0 }))
    .filter((r) => r.qty15 >= ALERT_QTY15_MIN && r.stock < r.qty15)
    .sort((a, b) => a.stock - b.stock);
}

/** "Selling well" floor: at least this many units sold in the last 30 days. */
const ALERT_MIN_QTY30 = 5;

export interface WellSellingLowStockRow {
  name: string;
  stock: number;
  avgDailySales: number;
  daysOfStockLeft: number | null;
  reorderPoint: number;
}

/** Products that move well but have fallen to (or below) their reorder point — candidates for a restock alert. */
export async function getWellSellingLowStockAlerts(): Promise<WellSellingLowStockRow[]> {
  const { rows } = await getWarehouseData();
  return rows
    .filter((r) => r.status === "normal" && r.qty30 >= ALERT_MIN_QTY30 && r.stock <= r.reorderPoint)
    .sort((a, b) => (a.daysOfStockLeft ?? 0) - (b.daysOfStockLeft ?? 0))
    .map((r) => ({
      name: r.name,
      stock: r.stock,
      avgDailySales: r.avgDailySales,
      daysOfStockLeft: r.daysOfStockLeft,
      reorderPoint: r.reorderPoint,
    }));
}

/** Below this margin (as a fraction, e.g. 0.10 = 10%) a sold line item is flagged. */
const LOW_MARGIN_THRESHOLD = 0.1;

export interface LowMarginItem {
  name: string;
  margin: number;
  sum: number;
}

export interface LowMarginSaleRow {
  demandId: string;
  demandName: string;
  moment: string;
  agent: string;
  items: LowMarginItem[];
}

interface DemandPositionRow {
  id: string;
  quantity: number;
  price: number;
  assortment: { name: string; buyPrice?: { value: number } };
}

/**
 * MoySklad has no per-sale profit report (only aggregates by product/variant), so
 * margin here is computed line-by-line from each position's sale price against the
 * assortment's current purchase price — a live approximation, not the FIFO-costed
 * margin shown elsewhere in the app.
 */
async function getDemandPositions(demandId: string): Promise<DemandPositionRow[]> {
  return fetchAllRows<DemandPositionRow>(`entity/demand/${demandId}/positions`, { expand: "assortment" }, 200);
}

/** Sales in the last `sinceHours` containing at least one line item sold at ≤10% margin. */
export async function getLowMarginSalesAlerts(sinceHours: number): Promise<LowMarginSaleRow[]> {
  const demands = await fetchAllRows<DemandRow>(
    "entity/demand",
    { filter: buildFilter([`moment>=${hoursAgoMoment(sinceHours)}`]), expand: "agent" },
    500
  );

  const results: LowMarginSaleRow[] = [];
  for (const d of demands) {
    const positions = await getDemandPositions(d.id).catch(() => [] as DemandPositionRow[]);
    const items: LowMarginItem[] = positions
      .filter((p) => p.price > 0 && p.assortment?.buyPrice)
      .map((p) => ({
        name: p.assortment.name,
        margin: (p.price - p.assortment.buyPrice!.value) / p.price,
        sum: p.price * p.quantity,
      }))
      .filter((p) => p.margin <= LOW_MARGIN_THRESHOLD);
    if (items.length > 0) {
      results.push({ demandId: d.id, demandName: d.name, moment: d.moment, agent: d.agent?.name ?? "", items });
    }
  }
  return results;
}
