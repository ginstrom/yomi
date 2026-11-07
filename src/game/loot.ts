import type { RNG } from '../combat/combat.ts'
import { mulberry32 } from '../combat/rng.ts'
import { RUNE_IDS, addToPouch, runeKey, type RuneId, type RuneKey } from '../inventory/runes.ts'
import type { EncounterId } from './encounters.ts'
import type { GameState } from './gameState.ts'

/**
 * Rune loot after a won battle (docs/designs/long-campaign/stage-04-runes.md,
 * "Loot"): drawn from a stream of its own, seeded from the battle's seed, so
 * the battle's and the enemy's dice are untouched. Only the rows for threats 1
 * to 7 exist: the Source (threat 5) rolls threat 5's row, and the rows past 7
 * and the Source's own wait for stage 9. Items are `takeLoot`'s, not this.
 */

/** Mixed into the battle's seed for the rune stream. A fixed constant: changing it changes every game's loot. */
export const RUNE_LOOT_SALT = 0x52554e45

/** The rune loot's own stream for a battle. */
export function lootRng(battleSeed: number): RNG {
  return mulberry32((battleSeed ^ RUNE_LOOT_SALT) >>> 0)
}

/** The element a nest's leader favours, at `FAVOURED_CHANCE`. */
export const FAVOURED_RUNES: Partial<Record<EncounterId, RuneId>> = { salamander_pool: 'ember', spider_nest: 'venom' }
export const FAVOURED_CHANCE = 0.5

/** The highest threat that may yield nothing, and rolls rank 1 only. */
const LOW_THREAT = 3
const RANK_ONE_CHANCE = 0.7

/** The runes a won battle at `threat` against `encounter` yields. */
export function rollRunes(threat: number, encounter: EncounterId, rng: RNG): RuneKey[] {
  const low = threat <= LOW_THREAT
  if (low && !(rng() < 0.5)) return []
  const favoured = FAVOURED_RUNES[encounter]
  const id = favoured && rng() < FAVOURED_CHANCE ? favoured : RUNE_IDS[Math.floor(rng() * RUNE_IDS.length)]
  const rank = low || rng() < RANK_ONE_CHANCE ? 1 : 2
  return [runeKey(id, rank)]
}

/** Rolls the runes of a won battle at a monster location into the game's pouch and returns them. */
export function takeRunes(game: GameState, threat: number, encounter: EncounterId, battleSeed: number): RuneKey[] {
  const found = rollRunes(threat, encounter, lootRng(battleSeed))
  for (const key of found) addToPouch(game.runes, key)
  return found
}
