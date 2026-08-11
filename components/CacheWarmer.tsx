"use client";

import { useEffect } from "react";
import { warmAllData } from "@/app/actions";

declare global {
  interface Window {
    __msWarmed?: boolean;
  }
}

/**
 * Fires once per browser session, shortly after the dashboard paints, to
 * pre-load Analytics/Expenses/CRM data in the background. Renders nothing.
 */
export function CacheWarmer() {
  useEffect(() => {
    if (typeof window === "undefined" || window.__msWarmed) return;
    window.__msWarmed = true;
    const timer = setTimeout(() => {
      warmAllData().catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
