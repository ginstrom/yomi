import { GOBLIN_STATS, KOBOLD_STATS, type CombatantStats } from '../combat/combat.ts'
import type { BattleSetup, UnitId, UnitSetup } from '../engine/battleEngine.ts'
import { offsetToHex } from '../grid/hex.ts'

/** A party member as it enters a battle: its stats, and the hit points it has left if wounded. */
export interface Fighter {
  stats: CombatantStats
  hp?: number
}

/** The id, in every encounter, of the unit for the party member at `index`. */
export function heroId(index: number): UnitId {
  return `hero_${index + 1}`
}

/**
 * Where the party lines up, as [column, row], in party order: the first three
 * down the second column with a hex between them, so their sprites and
 * nameplates stand clear of each other, and the rest in the gaps behind.
 * Every encounter's board must have these hexes, and keep its foes off them.
 */
const PARTY_START: ReadonlyArray<readonly [number, number]> = [[1, 2], [1, 0], [1, 4], [0, 1], [0, 3], [0, 2]]

function partyUnits(party: readonly Fighter[]): UnitSetup[] {
  if (party.length > PARTY_START.length) throw new Error(`No room for a party of ${party.length}`)
  return party.map(({ stats, hp }, i) => ({
    id: heroId(i),
    side: 'player',
    stats,
    hp,
    position: offsetToHex(...PARTY_START[i]),
  }))
}

function partyKinds(party: readonly Fighter[]): Record<UnitId, UnitKind> {
  return Object.fromEntries(party.map((_, i) => [heroId(i), 'warrior']))
}

/** What a unit is, for drawing it; the engine only knows its stats. */
export type UnitKind = 'warrior' | 'goblin' | 'kobold'

/**
 * The experience beating a unit of each kind is worth. An even match for a
 * hero of level L is worth about `EVEN_FOE_XP_PER_LEVEL * L` and a weak foe
 * half that (see progression.ts): the Goblin is a little weaker than a new
 * hero, the Kobold weak.
 */
export const FOE_XP: Record<UnitKind, number> = { warrior: 0, goblin: 80, kobold: 50 }

export interface Encounter {
  setup: BattleSetup
  kinds: Record<UnitId, UnitKind>
}

/**
 * A Goblin and a Kobold across the board from the party. The simulator fights
 * this one, so balancing runs fight a battle the game has.
 */
export function goblinRaid(party: readonly Fighter[]): Encounter {
  return {
    setup: {
      board: { cols: 8, rows: 5 },
      units: [
        ...partyUnits(party),
        { id: 'goblin', side: 'enemy', stats: GOBLIN_STATS, position: offsetToHex(6, 2) },
        { id: 'kobold', side: 'enemy', stats: KOBOLD_STATS, position: offsetToHex(7, 0) },
      ],
    },
    kinds: { ...partyKinds(party), goblin: 'goblin', kobold: 'kobold' },
  }
}

/** Two Kobolds that come at the party from both ends of the far side. */
export function koboldScouts(party: readonly Fighter[]): Encounter {
  return {
    setup: {
      board: { cols: 8, rows: 5 },
      units: [
        ...partyUnits(party),
        { id: 'scout', side: 'enemy', stats: { ...KOBOLD_STATS, name: 'Kobold Scout' }, position: offsetToHex(6, 0) },
        { id: 'tracker', side: 'enemy', stats: { ...KOBOLD_STATS, name: 'Kobold Tracker' }, position: offsetToHex(6, 4) },
      ],
    },
    kinds: { ...partyKinds(party), scout: 'kobold', tracker: 'kobold' },
  }
}

/** The experience each party member earns for winning `encounter`: what its foes are worth together. */
export function xpReward(encounter: Encounter): number {
  return encounter.setup.units
    .filter((u) => u.side === 'enemy')
    .reduce((total, u) => total + FOE_XP[encounter.kinds[u.id]], 0)
}

/** Every battle a monster location on the world map can lead to, by id. */
export const ENCOUNTERS = {
  goblin_raid: goblinRaid,
  kobold_scouts: koboldScouts,
} satisfies Record<string, (party: readonly Fighter[]) => Encounter>

export type EncounterId = keyof typeof ENCOUNTERS
