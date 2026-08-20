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
