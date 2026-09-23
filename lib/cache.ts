import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";

// MoySklad-backed report data is cached via Next's persistent Data Cache
// (not a plain in-process Map) so it survives cold serverless invocations —
// on Vercel, a fresh Lambda instance wipes in-process memory on essentially
// every request for a low-traffic app, which was forcing a full, slowly
// rate-limited MoySklad re-fetch (see lib/moysklad.ts's request queue) on
// nearly every page load. Data Cache entries are shared across instances and
// persist between requests, so navigation only pays that cost once per TTL.
const CACHE_TAG = "moysklad";
const REVALIDATE_SECONDS = 15 * 60;

/**
 * Values passed through here must be JSON-serializable (the Data Cache
 * round-trips them through JSON) — a `Map`, `Set`, or class instance will
 * silently come back as `{}`. Use plain objects/arrays/records instead.
 */
export function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return unstable_cache(fn, [key], { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAG] })();
}

export function bumpCacheEpoch() {
  revalidateTag(CACHE_TAG);
}
