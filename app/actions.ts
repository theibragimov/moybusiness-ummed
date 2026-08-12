"use server";

import { revalidatePath } from "next/cache";
import { bumpCacheEpoch } from "@/lib/cache";
import {
  searchProducts,
  getProductForecast,
  getAnalyticsData,
  getExpensesData,
  getCounterparties,
  getWarehouseData,
} from "@/lib/reports";
import { monthStartYmd, monthEndYmd } from "@/lib/tashkent";
import {
  addManualDebt,
  updateManualDebt,
  deleteManualDebt,
  type DebtDirection,
} from "@/lib/manualDebts";

export async function refreshAllData() {
  bumpCacheEpoch();
  revalidatePath("/", "layout");
}

/**
 * Pre-populates the cache for every other section right after the dashboard
 * loads, so navigating to them is instant. Requests still go out one at a
 * time (see lib/moysklad.ts's queue), so this just uses idle time productively
 * instead of racing the user's own navigation.
 */
export async function warmAllData() {
  const from = monthStartYmd();
  const to = monthEndYmd();
  await Promise.allSettled([
    getAnalyticsData(from, to),
    getExpensesData(from, to),
    getCounterparties(),
    getWarehouseData(),
  ]);
}

export async function searchProductsAction(query: string) {
  return searchProducts(query);
}

export async function getProductForecastAction(
  productId: string,
  historyMonths: number,
  forecastMonths: number
) {
  return getProductForecast(productId, historyMonths, forecastMonths);
}

export async function addManualDebtAction(direction: DebtDirection, name: string, amount: number) {
  const row = await addManualDebt({ direction, name, amount });
  revalidatePath("/company");
  return row;
}

export async function updateManualDebtAction(id: string, name: string, amount: number) {
  await updateManualDebt(id, { name, amount });
  revalidatePath("/company");
}

export async function deleteManualDebtAction(id: string) {
  await deleteManualDebt(id);
  revalidatePath("/company");
}
