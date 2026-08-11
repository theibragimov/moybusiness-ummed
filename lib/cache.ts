import "server-only";

// Simple in-process cache for MoySklad-backed report data. Navigating between
// pages should feel instant and never re-hit the MoySklad API; data only
// refreshes when the epoch is bumped (the top-bar "refresh" button) or the
// safety TTL below expires.
const MAX_AGE_MS = 15 * 60 * 1000;

let epoch = 0;
const store = new Map<string, { epoch: number; data: unknown; time: number }>();
// In-flight requests, keyed the same way, so a background warm-up and a real
// navigation for the same data share one MoySklad round trip instead of two.
const inflight = new Map<string, Promise<unknown>>();

export function bumpCacheEpoch() {
  epoch += 1;
  inflight.clear();
}

export function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.epoch === epoch && Date.now() - hit.time < MAX_AGE_MS) {
    return Promise.resolve(hit.data as T);
  }

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fn()
    .then((data) => {
      store.set(key, { epoch, data, time: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}
