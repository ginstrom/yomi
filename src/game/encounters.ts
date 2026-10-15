import { BLIGHT_HORROR_STATS, GOBLIN_SHAMAN_STATS, GOBLIN_STATS, KOBOLD_STATS, foeAtLevel, type CombatantStats } from '../combat/combat.ts'
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
 * down the fourth column with a hex between them, so their sprites and
 * nameplates stand clear of each other, and the rest in the gaps behind.
 * Every encounter's board must have these hexes, and keep its foes off them.
 */
const PARTY_START: ReadonlyArray<readonly [number, number]> = [[3, 4], [3, 2], [3, 6], [2, 3], [2, 5], [2, 4]]

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
export type UnitKind = 'warrior' | 'goblin' | 'kobold' | 'shaman' | 'horror'

/**
 * The experience beating a level 1 unit of each kind is worth. An even match for a
 * hero of level L is worth about `EVEN_FOE_XP_PER_LEVEL * L` and a weak foe
 * half that (see progression.ts): the Goblin is a little weaker than a new
 * hero, the Kobold weak, and the Goblin Shaman, frail but a healer and a
 * curse, worth a little more than a Goblin; the Blight Horror, which guards
 * the Source, as much as four Goblins.
 */
export const FOE_XP: Record<UnitKind, number> = { warrior: 0, goblin: 80, kobold: 50, shaman: 90, horror: 320 }

export interface Encounter {
  setup: BattleSetup
  kinds: Record<UnitId, UnitKind>
  /** How dangerous the battle was made, which is also the level of its foes. */
  threat: number
}

/**
 * How many foes a battle has at each threat, from 1 up, tuned for a new
 * game's ready-made party of three. Numbers tell more than levels do, and they tell
 * twice: a foe more is a harder battle now and, by the experience it is
 * worth, a stronger party in every battle after. So a count raised at one
 * threat can make the next threat easier; judge a change by a campaign run
 * (`npm run simulate -- --campaign`), not by the battle it changes.
 */
const FOES_AT_THREAT = [2, 3, 3, 3, 4]

/** The most dangerous a battle gets; any threat above it is fought as this. */
export const MAX_THREAT = FOES_AT_THREAT.length

/** A foe an encounter can field; a setup fields the first few of its list. */
interface FoeSlot {
  id: UnitId
  kind: Exclude<UnitKind, 'warrior'>
  /** Each foe of a battle has a name of its own, so the log tells them apart. */
  name: string
  at: readonly [number, number]
}

const FOE_STATS: Record<FoeSlot['kind'], CombatantStats> = {
  goblin: GOBLIN_STATS,
  kobold: KOBOLD_STATS,
  shaman: GOBLIN_SHAMAN_STATS,
  horror: BLIGHT_HORROR_STATS,
}

/**
 * Both sides line up in the middle, two hexes in from every edge, so there is
 * ground on all sides to flank, fall back and come round on; shifting the
 * lines by whole pairs of rows keeps the odd-r board's shape between them.
 */
const BOARD = { cols: 12, rows: 9 }

/**
 * The party against the foes `threat` calls for: the first `FOES_AT_THREAT`
 * of `slots`, every one at level `threat` (`foeAtLevel`). The numbers behind
 * both were chosen with the simulator; see the rules of scaling in CLAUDE.md.
 */
function encounter(party: readonly Fighter[], slots: readonly FoeSlot[], threat: number): Encounter {
  const level = Math.min(Math.max(1, Math.floor(threat)), MAX_THREAT)
  const foes = slots.slice(0, FOES_AT_THREAT[level - 1])
  return {
    setup: {
      board: BOARD,
      units: [
        ...partyUnits(party),
        ...foes.map(({ id, kind, name, at }): UnitSetup => ({
          id,
          side: 'enemy',
          stats: { ...foeAtLevel(FOE_STATS[kind], level), name },
          position: offsetToHex(...at),
        })),
      ],
    },
    kinds: { ...partyKinds(party), ...Object.fromEntries(foes.map((foe) => [foe.id, foe.kind])) },
    threat: level,
  }
}

const GOBLIN_RAID: readonly FoeSlot[] = [
  { id: 'goblin', kind: 'goblin', name: 'Goblin', at: [8, 4] },
  { id: 'kobold', kind: 'kobold', name: 'Kobold', at: [9, 2] },
  // Third, so it takes the field from threat 2; at the back, off the party's hexes.
  { id: 'shaman', kind: 'shaman', name: 'Goblin Shaman', at: [9, 4] },
  { id: 'sneak', kind: 'kobold', name: 'Kobold Sneak', at: [9, 5] },
  { id: 'cutter', kind: 'goblin', name: 'Goblin Cutter', at: [8, 6] },
  { id: 'brute', kind: 'goblin', name: 'Goblin Brute', at: [9, 3] },
]

const KOBOLD_SCOUTS: readonly FoeSlot[] = [
  { id: 'scout', kind: 'kobold', name: 'Kobold Scout', at: [8, 2] },
  { id: 'tracker', kind: 'kobold', name: 'Kobold Tracker', at: [8, 6] },
  { id: 'trapper', kind: 'kobold', name: 'Kobold Trapper', at: [9, 4] },
  { id: 'overseer', kind: 'goblin', name: 'Goblin Overseer', at: [8, 4] },
  { id: 'whip', kind: 'goblin', name: 'Goblin Whip', at: [9, 6] },
]

// The Horror first, so it takes the field at any threat; the Source is fought at the top.
const SOURCE_GUARDIANS: readonly FoeSlot[] = [
  { id: 'horror', kind: 'horror', name: 'Blight Horror', at: [8, 4] },
  { id: 'brute', kind: 'goblin', name: 'Goblin Brute', at: [8, 2] },
  { id: 'shaman', kind: 'shaman', name: 'Blight Shaman', at: [9, 4] },
  { id: 'sneak', kind: 'kobold', name: 'Kobold Sneak', at: [8, 6] },
  { id: 'cutter', kind: 'goblin', name: 'Goblin Cutter', at: [9, 6] },
]

/**
 * A Goblin and a Kobold across the board from the party; where the threat is
 * higher a Goblin Shaman behind them, and more of both, up to five. The simulator fights this one unless told
 * otherwise, so balancing runs fight a battle the game has.
 */
export function goblinRaid(party: readonly Fighter[], threat = 1): Encounter {
  return encounter(party, GOBLIN_RAID, threat)
}

/** Two Kobolds that come at the party from both ends of the far side; where the threat is higher, more of them and a Goblin to drive them. */
export function koboldScouts(party: readonly Fighter[], threat = 1): Encounter {
  return encounter(party, KOBOLD_SCOUTS, threat)
}

/**
 * What guards the blight's Source: the Blight Horror, with a Goblin Brute
 * beside it and, at the threat the Source is fought at, a shaman and a
 * Kobold Sneak behind.
 */
export function sourceGuardians(party: readonly Fighter[], threat = 1): Encounter {
  return encounter(party, SOURCE_GUARDIANS, threat)
}

/**
 * The experience each party member earns for winning `encounter`: what its
 * foes are worth together, a foe of level L being worth L times its kind's
 * `FOE_XP`, as the yardstick has it.
 */
export function xpReward(encounter: Encounter): number {
  return encounter.setup.units
    .filter((u) => u.side === 'enemy')
    .reduce((total, u) => total + FOE_XP[encounter.kinds[u.id]] * encounter.threat, 0)
}

/** Every battle a monster location on the world map can lead to, by id. */
export const ENCOUNTERS = {
  goblin_raid: goblinRaid,
  kobold_scouts: koboldScouts,
  source_guardians: sourceGuardians,
} satisfies Record<string, (party: readonly Fighter[], threat?: number) => Encounter>

export type EncounterId = keyof typeof ENCOUNTERS
