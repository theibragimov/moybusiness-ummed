/** MoySklad stores sums in the minor unit x100 (tiyin). */
export function fromMs(sum: number): number {
  return sum / 100;
}

/**
 * Group digits with a thousands separator. Deliberately avoids Intl.NumberFormat's
 * locale data, which can differ between the Node SSR runtime and the browser (e.g. for
 * "uz-UZ") and causes hydration mismatches.
 */
function groupDigits(n: number, separator: string): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded).toString();
  const withSeparators = digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return sign + withSeparators;
}

export function formatMoney(sum: number, locale: "uz" | "ru" = "uz"): string {
  return groupDigits(fromMs(sum), locale === "ru" ? " " : ",");
}

export function formatCompactMoney(sum: number, locale: "uz" | "ru" = "uz"): string {
  const value = fromMs(sum);
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} mlrd`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} mln`;
  return formatMoney(sum, locale);
}

export function formatNumber(n: number, locale: "uz" | "ru" = "uz"): string {
  return groupDigits(n, locale === "ru" ? " " : ",");
}

export function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
