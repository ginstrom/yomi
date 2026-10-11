/** Where the game's registry keeps the seed from the page's address, or null when it gave none. */
export const SEED_KEY = 'seed'

/**
 * The seed in a page address's query, as in `?seed=42`: a whole number, which
 * every battle of the session is then fought with, so it plays out the same
 * way each time the same actions are taken. Null when there is none.
 */
export function seedFromUrl(search: string): number | null {
  const value = new URLSearchParams(search).get('seed')
  if (value === null || !/^\d+$/.test(value)) return null
  return Number(value) >>> 0
}
