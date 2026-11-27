import type { RNG } from '../combat/combat.ts'
import { mulberry32 } from '../combat/rng.ts'
import { RUNE_IDS, addToPouch, runeKey, type Rank, type RuneId, type RuneKey } from '../inventory/runes.ts'
import type { UnitId } from '../engine/battleEngine.ts'
import { TROPHIES, type EncounterId, type FoeKind, type Trophy, type UnitKind } from './encounters.ts'
import type { GameState } from './gameState.ts'
import type { Stock } from './territory.ts'
import { SOURCE_THREAT } from './worldMap.ts'

/**
 * Rune loot after a won battle (docs/designs/long-campaign/stage-04-runes.md,
 * "Loot"): drawn from a stream of its own, seeded from the battle's seed, so
 * the battle's and the enemy's dice are untouched. The rows go by threat
 * (docs/designs/long-campaign/reference/gear-and-runes.md §4.5): up to 3, a
 * rune of rank 1 half the time; 4 to 8, one of rank 1 or 2; 9 to 13, one and
 * a second at half, of rank 2 or 3; 14 up to the Source's, two of rank 2 to
 * 4; the Source's threat, three of rank 3 or 4. The Source rolls its threat's
 * row, so near home (threat 5) it rolls threat 5's. Each rune draws its kind
 * and then its rank. Items are `takeLoot`'s, not this. Trophies (stage 10) are
 * granted after a win too, by kind and with no draw (`takeTrophies`).
 */

/** Mixed into the battle's seed for the rune stream. A fixed constant: changing it changes every game's loot. */
export const RUNE_LOOT_SALT = 0x52554e45

/** The rune loot's own stream for a battle. */
export function lootRng(battleSeed: number): RNG {
  return mulberry32((battleSeed ^ RUNE_LOOT_SALT) >>> 0)
}

/** The element a nest's leader favours, at `FAVOURED_CHANCE`. */
export const FAVOURED_RUNES: Partial<Record<EncounterId, RuneId>> = { salamander_pool: 'ember', spider_nest: 'venom', wyvern_roost: 'venom', basilisk_lair: 'rime', blight_cult: 'storm', young_dragon: 'ember' }
export const FAVOURED_CHANCE = 0.5

/** The highest threat that may yield nothing, and rolls rank 1 only. */
const LOW_THREAT = 3
/** The chance that a battle at a low threat yields a rune at all. */
export const LOW_THREAT_DROP_CHANCE = 0.5
const RANK_ONE_CHANCE = 0.7
/** The highest threat of the one-rune row of ranks 1 and 2. */
const MID_THREAT = 8
/** The highest threat of the row of one or two runes of ranks 2 and 3. */
const FAR_THREAT = 13
/** At threats 9 to 13: the chance of a second rune, and of each being rank 2 rather than 3. */
const SECOND_RUNE_CHANCE = 0.5
const RANK_TWO_CHANCE = 0.6
/** At threats 14 up to the Source's: each rune is rank 4 below the first, rank 3 below the second, else rank 2. */
const RANK_FOUR_BELOW = 0.15
const RANK_THREE_BELOW = 0.75
/** At the Source's threat: each rune is rank 3 at this chance, else 4. */
const SOURCE_RANK_THREE_CHANCE = 0.5

/** The kind of one rune: the nest leader's favoured element at `FAVOURED_CHANCE`, else any, uniformly. */
function runeKind(encounter: EncounterId, rng: RNG): RuneId {
  const favoured = FAVOURED_RUNES[encounter]
  return favoured && rng() < FAVOURED_CHANCE ? favoured : RUNE_IDS[Math.floor(rng() * RUNE_IDS.length)]
}

/** `count` runes, each drawing its kind and then its rank. */
function runes(count: number, encounter: EncounterId, rng: RNG, rank: () => Rank): RuneKey[] {
  const found: RuneKey[] = []
  for (let i = 0; i < count; i++) {
    const id = runeKind(encounter, rng)
    found.push(runeKey(id, rank()))
  }
  return found
}

/** The runes a won battle at `threat` against `encounter` yields. Up to threat 8 the draws are those from before stage 9, in their order. */
export function rollRunes(threat: number, encounter: EncounterId, rng: RNG): RuneKey[] {
  if (threat <= LOW_THREAT) return rng() >= LOW_THREAT_DROP_CHANCE ? [] : runes(1, encounter, rng, () => 1)
  if (threat <= MID_THREAT) return runes(1, encounter, rng, () => (rng() < RANK_ONE_CHANCE ? 1 : 2))
  if (threat <= FAR_THREAT) {
    const count = rng() < SECOND_RUNE_CHANCE ? 2 : 1
    return runes(count, encounter, rng, () => (rng() < RANK_TWO_CHANCE ? 2 : 3))
  }
  if (threat < SOURCE_THREAT) {
    return runes(2, encounter, rng, () => {
      const roll = rng()
      return roll < RANK_FOUR_BELOW ? 4 : roll < RANK_THREE_BELOW ? 3 : 2
    })
  }
  return runes(3, encounter, rng, () => (rng() < SOURCE_RANK_THREE_CHANCE ? 3 : 4))
}

/** Rolls the runes of a won battle at a monster location into the game's pouch and returns them. */
export function takeRunes(game: GameState, threat: number, encounter: EncounterId, battleSeed: number): RuneKey[] {
  const found = rollRunes(threat, encounter, lootRng(battleSeed))
  for (const key of found) addToPouch(game.runes, key)
  return found
}

/** The trophies of a won battle's foes: each foe its kind's trophy in `table`, summed; a hero ('warrior') leaves none. Draws nothing. */
export function trophiesFor(kinds: Iterable<UnitKind>, table: Partial<Record<FoeKind, Trophy>> = TROPHIES): Stock {
  const found: Stock = {}
  for (const kind of kinds) {
    const trophy = kind === 'warrior' ? undefined : table[kind]
    if (trophy) found[trophy.material] = (found[trophy.material] ?? 0) + trophy.amount
  }
  return found
}

/** Adds the trophies of a won battle's foes (every unit of `kinds` not a hero) to the stock and returns what it added. Draws nothing. */
export function takeTrophies(game: GameState, kinds: Record<UnitId, UnitKind>, table: Partial<Record<FoeKind, Trophy>> = TROPHIES): Stock {
  const found = trophiesFor(Object.values(kinds), table)
  for (const [material, amount] of Object.entries(found) as Array<[keyof Stock, number]>) {
    game.world.stock[material] = (game.world.stock[material] ?? 0) + amount
  }
  return found
}
