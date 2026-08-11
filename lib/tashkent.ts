const TZ = "Asia/Tashkent";

function partsInTashkent(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: year }, , { value: month }, , { value: day }] = fmt.formatToParts(date);
  return { year, month, day };
}

/** Today's date in Tashkent, as YYYY-MM-DD */
export function todayYmd(): string {
  const { year, month, day } = partsInTashkent(new Date());
  return `${year}-${month}-${day}`;
}

/** First day of the current month in Tashkent, as YYYY-MM-DD */
export function monthStartYmd(): string {
  const { year, month } = partsInTashkent(new Date());
  return `${year}-${month}-01`;
}

/** Last day of the current month in Tashkent, as YYYY-MM-DD */
export function monthEndYmd(): string {
  const { year, month } = partsInTashkent(new Date());
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
}

/** N days ago (inclusive range start) in Tashkent, as YYYY-MM-DD */
export function daysAgoYmd(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  const { year, month, day } = partsInTashkent(d);
  return `${year}-${month}-${day}`;
}

export function momentFrom(ymd: string): string {
  return `${ymd} 00:00:00`;
}

export function momentTo(ymd: string): string {
  return `${ymd} 23:59:59`;
}

/** Given a MoySklad "moment" string ("YYYY-MM-DD HH:mm:ss"), return its date part. */
export function dayOf(moment: string): string {
  return moment.slice(0, 10);
}

/**
 * The last `count` calendar months up to and including the current one, oldest first.
 * Each entry gives the month's label ("YYYY-MM") and its first/last day as YYYY-MM-DD.
 */
export function lastMonths(count: number): { label: string; start: string; end: string; monthIndex: number }[] {
  const { year, month } = partsInTashkent(new Date());
  const result: { label: string; start: string; end: string; monthIndex: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(year), Number(month) - 1 - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const label = `${y}-${String(m + 1).padStart(2, "0")}`;
    const start = `${label}-01`;
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const end = `${label}-${String(lastDay).padStart(2, "0")}`;
    result.push({ label, start, end, monthIndex: m });
  }
  return result;
}
