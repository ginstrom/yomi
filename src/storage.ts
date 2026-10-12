/**
 * The browser's storage, or null where there is none. It can be missing or
 * throw (private windows, blocked site data), and so can every call on it:
 * callers wrap theirs in a try, and what they meant to keep then lasts the
 * session.
 */
export function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}
