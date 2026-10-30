import {
  ARMORED_TROLL_STATS,
  BLIGHT_HORROR_STATS,
  GOBLIN_SHAMAN_STATS,
  GOBLIN_STATS,
  HOBGOBLIN_CHIEF_STATS,
  KOBOLD_STATS,
  TROLL_STATS,
  foeAtLevel,
  type CombatantStats,
} from '../combat/combat.ts'
import type { BattleSetup, UnitId, UnitSetup } from '../engine/battleEngine.ts'
import { offsetToHex } from '../grid/hex.ts'
import { BANDIT_ROLE, banditGrade, banditStats } from './bandits.ts'

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

/** Monsters: stat blocks scaled by `foeAtLevel` from their native level. */
export type MonsterKind = 'goblin' | 'kobold' | 'shaman' | 'horror' | 'hobgoblin' | 'troll' | 'armored_troll'

/** Humanoids built by hero rules (bandits.ts). */
export type BanditKind = 'bandit_cutthroat' | 'bandit_archer' | 'bandit_brute' | 'bandit_mage' | 'bandit_captain'

/** What a foe can be: a monster, or a bandit. */
export type FoeKind = MonsterKind | BanditKind

/** What a unit is, for drawing it; the engine only knows its stats. */
export type UnitKind = 'warrior' | FoeKind

/**
 * The experience beating a level 1 unit of each kind is worth. An even match for a
 * hero of level L is worth about `EVEN_FOE_XP_PER_LEVEL * L` and a weak foe
 * half that (see progression.ts): the Goblin is a little weaker than a new
 * hero, the Kobold weak, and the Goblin Shaman, frail but a healer and a
 * curse, worth a little more than a Goblin; the Hobgoblin Chief, in mail,
 * and the Troll, which regenerates, about two Goblins, and the Armoured Troll
 * more; the Blight Horror, which guards the Source, as much as four Goblins.
 * Bandits, built by hero rules (bandits.ts), are even foes for a hero of
 * their level, whatever their role, and so worth `EVEN_FOE_XP_PER_LEVEL`.
 */
export const FOE_XP: Record<UnitKind, number> = {
  warrior: 0,
  goblin: 80,
  kobold: 50,
  shaman: 90,
  horror: 320,
  hobgoblin: 150,
  troll: 160,
  armored_troll: 220,
  bandit_cutthroat: 100,
  bandit_archer: 100,
  bandit_brute: 100,
  bandit_mage: 100,
  bandit_captain: 100,
}

export interface Encounter {
  setup: BattleSetup
  kinds: Record<UnitId, UnitKind>
  /** How dangerous the battle was made, which is also the level of its foes. */
  threat: number
}

/** The highest threat on today's map, and `threatAt`'s cap until the map grows. */
export const MAX_THREAT = 5

/** The threats an encounter is fought at, from `min` to `max`; any threat outside is fought as the nearest in it. */
export interface ThreatBand {
  min: number
  max: number
}

/** A foe an encounter can field; a setup fields the first few of its list. */
interface FoeSlot {
  id: UnitId
  kind: FoeKind
  /** Each foe of a battle has a name of its own, so the log tells them apart. */
  name: string
  at: readonly [number, number]
  /** The lowest threat it takes the field at; below it, the slots after it fill its place. Any threat when left out. */
  fromThreat?: number
}

const FOE_STATS: Record<MonsterKind, CombatantStats> = {
  goblin: GOBLIN_STATS,
  kobold: KOBOLD_STATS,
  shaman: GOBLIN_SHAMAN_STATS,
  horror: BLIGHT_HORROR_STATS,
  hobgoblin: HOBGOBLIN_CHIEF_STATS,
  troll: TROLL_STATS,
  armored_troll: ARMORED_TROLL_STATS,
}

/** The level each monster kind's stat block is written for; it grows from there (`foeAtLevel`). */
export const FOE_NATIVE_LEVEL: Record<MonsterKind, number> = {
  goblin: 1,
  kobold: 1,
  shaman: 1,
  horror: 1,
  hobgoblin: 1,
  troll: 1,
  armored_troll: 1,
}

function isBandit(kind: FoeKind): kind is BanditKind {
  return kind in BANDIT_ROLE
}

/**
 * A foe of `kind` at `level`: a monster by `foeAtLevel` from its native
 * level; a bandit by `banditStats`, in the gear its level's threat calls for.
 */
export function foeStats(kind: FoeKind, level: number): CombatantStats {
  if (isBandit(kind)) return banditStats(BANDIT_ROLE[kind], level, banditGrade(level))
  return foeAtLevel(FOE_STATS[kind], level, FOE_NATIVE_LEVEL[kind])
}

/**
 * Both sides line up in the middle, two hexes in from every edge, so there is
 * ground on all sides to flank, fall back and come round on; shifting the
 * lines by whole pairs of rows keeps the odd-r board's shape between them.
 */
const BOARD = { cols: 12, rows: 9 }

/**
 * An encounter as data: the foes it can field, in the order they take the
 * field, the threats it is fought at, and how many of them fight at each.
 */
interface EncounterDef {
  slots: readonly FoeSlot[]
  band: ThreatBand
  /**
   * How many foes fight at each threat of the band, from `band.min` up, tuned
   * for a new game's ready-made party of three. Numbers tell more than
   * levels do, and they tell twice: a foe more is a harder battle now and, by
   * the experience it is worth, a stronger party in every battle after. So a
   * count raised at one threat can make the next threat easier; judge a change
   * by a campaign run (`npm run simulate -- --campaign`), not by the battle it
   * changes. One count for each threat of the band.
   */
  counts: readonly number[]
}

/**
 * The party against the foes `threat` calls for. The level is the threat
 * (a whole number) held within the band; the foes are the slots that take the
 * field at that level (`fromThreat`), cut to the band's count for it, each
 * a monster at that level (`foeStats`). The numbers behind the counts were
 * chosen with the simulator; see the rules of scaling in CLAUDE.md.
 */
function encounter(party: readonly Fighter[], { slots, band, counts }: EncounterDef, threat: number): Encounter {
  if (counts.length !== band.max - band.min + 1) throw new Error('An encounter needs a foe count for each threat of its band')
  const level = Math.min(Math.max(Math.floor(threat), band.min), band.max)
  const foes = slots.filter((slot) => (slot.fromThreat ?? 1) <= level).slice(0, counts[level - band.min])
  return {
    setup: {
      board: BOARD,
      units: [
        ...partyUnits(party),
        ...foes.map(({ id, kind, name, at }): UnitSetup => ({
          id,
          side: 'enemy',
          stats: { ...foeStats(kind, level), name },
          position: offsetToHex(...at),
        })),
      ],
    },
    kinds: { ...partyKinds(party), ...Object.fromEntries(foes.map((foe) => [foe.id, foe.kind])) },
    threat: level,
  }
}

const GOBLIN_RAID_SLOTS: readonly FoeSlot[] = [
  { id: 'goblin', kind: 'goblin', name: 'Goblin', at: [8, 4] },
  { id: 'kobold', kind: 'kobold', name: 'Kobold', at: [9, 2] },
  // Third, so it takes the field from threat 2; at the back, off the party's hexes.
  { id: 'shaman', kind: 'shaman', name: 'Goblin Shaman', at: [9, 4] },
  { id: 'sneak', kind: 'kobold', name: 'Kobold Sneak', at: [9, 5] },
  { id: 'cutter', kind: 'goblin', name: 'Goblin Cutter', at: [8, 6] },
  { id: 'brute', kind: 'goblin', name: 'Goblin Brute', at: [9, 3] },
]

const KOBOLD_SCOUTS_SLOTS: readonly FoeSlot[] = [
  { id: 'scout', kind: 'kobold', name: 'Kobold Scout', at: [8, 2] },
  { id: 'tracker', kind: 'kobold', name: 'Kobold Tracker', at: [8, 6] },
  { id: 'trapper', kind: 'kobold', name: 'Kobold Trapper', at: [9, 4] },
  { id: 'overseer', kind: 'goblin', name: 'Goblin Overseer', at: [8, 4] },
  { id: 'whip', kind: 'goblin', name: 'Goblin Whip', at: [9, 6] },
]

// The Chief first, so it takes the field at any threat: the armoured foe of the near lands.
const HOBGOBLIN_WARBAND_SLOTS: readonly FoeSlot[] = [
  { id: 'chief', kind: 'hobgoblin', name: 'Hobgoblin Chief', at: [8, 4] },
  { id: 'goblin', kind: 'goblin', name: 'Goblin', at: [8, 2] },
  { id: 'shaman', kind: 'shaman', name: 'Goblin Shaman', at: [9, 4] },
  { id: 'cutter', kind: 'goblin', name: 'Goblin Cutter', at: [8, 6] },
  { id: 'sneak', kind: 'kobold', name: 'Kobold Sneak', at: [9, 2] },
]

// The Armoured Troll only at threat 5, a minion of the far lands; below that a goblin fills its place. At
// threat 4 the ready-made party, a longsword, a bow and a wand, could not get through its armour and its
// regeneration together (7 battles won in 500 at the party's level).
const TROLL_LAIR_SLOTS: readonly FoeSlot[] = [
  { id: 'troll', kind: 'troll', name: 'Troll', at: [8, 4] },
  { id: 'goblin', kind: 'goblin', name: 'Goblin Herder', at: [8, 2] },
  { id: 'armored', kind: 'armored_troll', name: 'Armoured Troll', at: [9, 4], fromThreat: 5 },
  { id: 'cutter', kind: 'goblin', name: 'Goblin Cutter', at: [8, 6] },
  { id: 'whelp', kind: 'troll', name: 'Troll Whelp', at: [9, 6] },
]

// The Horror first, so it takes the field at any threat; the Source is fought at the top.
const SOURCE_GUARDIANS_SLOTS: readonly FoeSlot[] = [
  { id: 'horror', kind: 'horror', name: 'Blight Horror', at: [8, 4] },
  { id: 'brute', kind: 'goblin', name: 'Goblin Brute', at: [8, 2] },
  { id: 'shaman', kind: 'shaman', name: 'Blight Shaman', at: [9, 4] },
  { id: 'sneak', kind: 'kobold', name: 'Kobold Sneak', at: [8, 6] },
  { id: 'cutter', kind: 'goblin', name: 'Goblin Cutter', at: [9, 6] },
]

// The Captain first, so it leads at every threat; the Hedge-Mage from threat 4, ahead of the Brute and the Archer
// so that it takes the field there, and the Cutthroat last.
const BANDIT_CAMP_SLOTS: readonly FoeSlot[] = [
  { id: 'captain', kind: 'bandit_captain', name: 'Bandit Captain', at: [8, 4] },
  { id: 'mage', kind: 'bandit_mage', name: 'Hedge-Mage', at: [9, 4], fromThreat: 4 },
  { id: 'brute', kind: 'bandit_brute', name: 'Bandit Brute', at: [8, 2] },
  { id: 'archer', kind: 'bandit_archer', name: 'Bandit Archer', at: [9, 6] },
  { id: 'cutthroat', kind: 'bandit_cutthroat', name: 'Cutthroat', at: [8, 6] },
]

/** Today's encounters are fought at threats 1 to 5, with these many foes at each. */
const TODAY = { band: { min: 1, max: 5 }, counts: [2, 3, 3, 3, 4] } as const satisfies Omit<EncounterDef, 'slots'>

const GOBLIN_RAID: EncounterDef = { slots: GOBLIN_RAID_SLOTS, ...TODAY }
const KOBOLD_SCOUTS: EncounterDef = { slots: KOBOLD_SCOUTS_SLOTS, ...TODAY }
const HOBGOBLIN_WARBAND: EncounterDef = { slots: HOBGOBLIN_WARBAND_SLOTS, ...TODAY }
const TROLL_LAIR: EncounterDef = { slots: TROLL_LAIR_SLOTS, ...TODAY }
const SOURCE_GUARDIANS: EncounterDef = { slots: SOURCE_GUARDIANS_SLOTS, ...TODAY }
/**
 * Bandits are fought from threat 3. Two at threats 3 to 5, tuned by the simulator (a third made the camp a wall:
 * a party of the threat's level won about 2 in 5 at threat 3 and 1 in 3 at 4); the counts past 5 are the first guess, for the
 * stage that grows the map to tune.
 */
const BANDIT_CAMP: EncounterDef = { slots: BANDIT_CAMP_SLOTS, band: { min: 3, max: 7 }, counts: [2, 2, 2, 4, 4] }

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

/** A Hobgoblin Chief in mail with a Goblin; where the threat is higher, a shaman and more goblins behind it. */
export function hobgoblinWarband(party: readonly Fighter[], threat = 1): Encounter {
  return encounter(party, HOBGOBLIN_WARBAND, threat)
}

/**
 * A Troll, which regenerates, with a Goblin to herd it; at threat 5 an
 * Armoured Troll beside it, which only the heavy weapons and the spells hurt.
 */
export function trollLair(party: readonly Fighter[], threat = 1): Encounter {
  return encounter(party, TROLL_LAIR, threat)
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
 * Bandits, built by the rules heroes are: a Bandit Captain with sword, shield
 * and breastplate, a Brute with an axe and an Archer; from threat 4 a
 * Hedge-Mage who casts in the Archer's place, and both from threat 5, when
 * their gear turns Fine.
 */
export function banditCamp(party: readonly Fighter[], threat = 3): Encounter {
  return encounter(party, BANDIT_CAMP, threat)
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
  hobgoblin_warband: hobgoblinWarband,
  troll_lair: trollLair,
  source_guardians: sourceGuardians,
  bandit_camp: banditCamp,
} satisfies Record<string, (party: readonly Fighter[], threat?: number) => Encounter>

export type EncounterId = keyof typeof ENCOUNTERS

/** The threats each encounter is fought at, from its definition. */
export const ENCOUNTER_BANDS: Record<EncounterId, ThreatBand> = {
  goblin_raid: GOBLIN_RAID.band,
  kobold_scouts: KOBOLD_SCOUTS.band,
  hobgoblin_warband: HOBGOBLIN_WARBAND.band,
  troll_lair: TROLL_LAIR.band,
  source_guardians: SOURCE_GUARDIANS.band,
  bandit_camp: BANDIT_CAMP.band,
}

/** How many foes each encounter fields at each threat of its band, from `band.min` up, from its definition. */
export const ENCOUNTER_COUNTS: Record<EncounterId, readonly number[]> = {
  goblin_raid: GOBLIN_RAID.counts,
  kobold_scouts: KOBOLD_SCOUTS.counts,
  hobgoblin_warband: HOBGOBLIN_WARBAND.counts,
  troll_lair: TROLL_LAIR.counts,
  source_guardians: SOURCE_GUARDIANS.counts,
  bandit_camp: BANDIT_CAMP.counts,
}

/** The encounters whose band holds `threat`, in `ENCOUNTERS` order. */
export function encountersFor(threat: number): EncounterId[] {
  return (Object.keys(ENCOUNTERS) as EncounterId[]).filter(
    (id) => threat >= ENCOUNTER_BANDS[id].min && threat <= ENCOUNTER_BANDS[id].max,
  )
}
