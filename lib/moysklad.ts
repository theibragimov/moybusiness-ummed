import "server-only";

const BASE = "https://api.moysklad.ru/api/remap/1.2";

export function entityHref(type: string, id: string): string {
  return `${BASE}/entity/${type}/${id}`;
}

function token(): string {
  const t = process.env.MOYSKLAD_TOKEN;
  if (!t) throw new Error("MOYSKLAD_TOKEN is not set");
  return t;
}

export class MoySkladError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// MoySklad rejects overlapping requests from the same token (error 1073). Serialize
// every call through a single queue with a small gap between requests, and retry on 429.
let queue: Promise<unknown> = Promise.resolve();
const MIN_GAP_MS = 220;
let lastCallAt = 0;

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_GAP_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });
  // keep the chain alive even if this call rejects
  queue = run.catch(() => undefined);
  return run as Promise<T>;
}

async function rawFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json;charset=utf-8",
    },
    cache: "no-store",
  });
}

async function request<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const href = url.toString();

  return enqueue(async () => {
    let attempt = 0;
    for (;;) {
      const res = await rawFetch(href);
      if (res.status === 429 && attempt < 4) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new MoySkladError(res.status, `MoySklad ${res.status}: ${body.slice(0, 300)}`);
      }
      return res.json() as Promise<T>;
    }
  });
}

export interface MsListResponse<T> {
  meta: { size: number; limit: number; offset: number };
  rows: T[];
}

/** GET on a report/list endpoint, single page. */
export function msGet<T>(path: string, params: Record<string, string | number | undefined> = {}) {
  return request<T>(path, params);
}

/** Combine filter clauses with MoySklad's `;` filter syntax. */
export function buildFilter(clauses: string[]): string {
  return clauses.join(";");
}

/**
 * Fetch every row of a paginated list/report endpoint, following offset pagination.
 * Capped at maxRows to keep requests bounded.
 */
export async function fetchAllRows<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  maxRows = 5000
): Promise<T[]> {
  const limit = 1000;
  let offset = 0;
  const all: T[] = [];
  for (;;) {
    const page = await msGet<MsListResponse<T>>(path, { ...params, limit, offset });
    all.push(...page.rows);
    offset += limit;
    if (page.rows.length < limit || offset >= page.meta.size || all.length >= maxRows) break;
  }
  return all;
}
