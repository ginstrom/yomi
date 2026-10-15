import { GOBLIN_STATS, KOBOLD_STATS, foeAtLevel, type CombatantStats } from '../combat/combat.ts'
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
 * The experience beating a level 1 unit of each kind is worth. An even match for a
 * hero of level L is worth about `EVEN_FOE_XP_PER_LEVEL * L` and a weak foe
 * half that (see progression.ts): the Goblin is a little weaker than a new
 * hero, the Kobold weak.
 */
export const FOE_XP: Record<UnitKind, number> = { warrior: 0, goblin: 80, kobold: 50 }

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
const FOES_AT_THREAT = [2, 3, 3, 3, 3]

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

const FOE_STATS: Record<FoeSlot['kind'], CombatantStats> = { goblin: GOBLIN_STATS, kobold: KOBOLD_STATS }

const BOARD = { cols: 8, rows: 5 }

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
  { id: 'goblin', kind: 'goblin', name: 'Goblin', at: [6, 2] },
  { id: 'kobold', kind: 'kobold', name: 'Kobold', at: [7, 0] },
  { id: 'cutter', kind: 'goblin', name: 'Goblin Cutter', at: [6, 4] },
  { id: 'sneak', kind: 'kobold', name: 'Kobold Sneak', at: [7, 3] },
  { id: 'brute', kind: 'goblin', name: 'Goblin Brute', at: [7, 1] },
]

const KOBOLD_SCOUTS: readonly FoeSlot[] = [
  { id: 'scout', kind: 'kobold', name: 'Kobold Scout', at: [6, 0] },
  { id: 'tracker', kind: 'kobold', name: 'Kobold Tracker', at: [6, 4] },
  { id: 'trapper', kind: 'kobold', name: 'Kobold Trapper', at: [7, 2] },
  { id: 'overseer', kind: 'goblin', name: 'Goblin Overseer', at: [6, 2] },
  { id: 'whip', kind: 'goblin', name: 'Goblin Whip', at: [7, 4] },
]

/**
 * A Goblin and a Kobold across the board from the party, and more of both
 * where the threat is higher, up to five. The simulator fights this one unless told
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
} satisfies Record<string, (party: readonly Fighter[], threat?: number) => Encounter>

export type EncounterId = keyof typeof ENCOUNTERS
