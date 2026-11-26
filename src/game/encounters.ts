import {
  ARMORED_TROLL_STATS,
  GIANT_SPIDER_STATS,
  SALAMANDER_STATS,
  BLIGHT_HORROR_STATS,
  GOBLIN_SHAMAN_STATS,
  GOBLIN_STATS,
  HOBGOBLIN_CHIEF_STATS,
  KOBOLD_STATS,
  OGRE_STATS,
  TROLL_STATS,
  WOLF_STATS,
  WORG_RIDER_STATS,
  WYVERN_STATS,
  foeAtLevel,
  type CombatantStats,
} from '../combat/combat.ts'
import type { BattleSetup, UnitId, UnitSetup } from '../engine/battleEngine.ts'
import { offsetToHex } from '../grid/hex.ts'
import { BANDIT_ROLE, banditGear, banditStats } from './bandits.ts'
import type { Material } from './territory.ts'

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
export type MonsterKind = 'goblin' | 'kobold' | 'shaman' | 'horror' | 'hobgoblin' | 'troll' | 'armored_troll' | 'giant_spider' | 'salamander' | 'wolf' | 'worg_rider' | 'ogre' | 'wyvern'

/** Humanoids built by hero rules (bandits.ts). */
export type BanditKind = 'bandit_cutthroat' | 'bandit_archer' | 'bandit_brute' | 'bandit_mage' | 'bandit_captain' | 'bandit_crossbowman'

/** What a foe can be: a monster, or a bandit. */
export type FoeKind = MonsterKind | BanditKind

/** What a unit is, for drawing it; the engine only knows its stats. */
export type UnitKind = 'warrior' | FoeKind

/** What beating one foe of a kind adds to the stock (gear-and-runes §4.3): the hide tiers' material. */
export interface Trophy {
  material: Material
  amount: number
}

/**
 * The trophy of each foe kind that leaves one, granted after a win
 * (`takeTrophies`, loot.ts), from gear §4.3's table. It fills ring by ring
 * as long-campaign stage 11 adds the kinds: wolves and worg riders wolfhide 1
 * a foe (ring 7), wyverns wyvern hide 3 (ring 9); still to come, basilisks
 * basilisk scale 3, young dragons drake scale 6, elder wyrms drake scale 10.
 * No partner sells a trophy: Elder Glade's wyvern hide went when wyverns came.
 */
export const TROPHIES: Partial<Record<FoeKind, Trophy>> = {
  wolf: { material: 'wolfhide', amount: 1 },
  worg_rider: { material: 'wolfhide', amount: 1 },
  wyvern: { material: 'wyvern_hide', amount: 3 },
}

/**
 * The experience beating a level 1 unit of each kind is worth. An even match for a
 * hero of level L is worth about `EVEN_FOE_XP_PER_LEVEL * L` and a weak foe
 * half that (see progression.ts): the Goblin is a little weaker than a new
 * hero, the Kobold weak, and the Goblin Shaman, frail but a healer and a
 * curse, worth a little more than a Goblin; the Hobgoblin Chief, in mail,
 * and the Troll, which regenerates, about two Goblins, and the Armoured Troll
 * more; the Blight Horror, which guards the Source, as much as four Goblins.
 * The Giant Spider and the Salamander are priced near an even foe of their
 * native level (`EVEN_FOE_XP_PER_LEVEL`), the Salamander a little above for
 * its spit and its ward; first values, for the simulator to tune.
 * The kinds of long-campaign stage 11 (first values too): the Wolf a weak
 * foe of its level, the Worg Rider an even one, the Ogre well above one,
 * the Wyvern above one too, for its poison.
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
  giant_spider: 100,
  salamander: 120,
  wolf: 80,
  worg_rider: 100,
  ogre: 140,
  wyvern: 150,
  bandit_cutthroat: 100,
  bandit_archer: 100,
  bandit_brute: 100,
  bandit_mage: 100,
  bandit_captain: 100,
  bandit_crossbowman: 100,
}

export interface Encounter {
  setup: BattleSetup
  kinds: Record<UnitId, UnitKind>
  /** How dangerous the battle was made, which is also the level of its foes. */
  threat: number
}

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
  giant_spider: GIANT_SPIDER_STATS,
  salamander: SALAMANDER_STATS,
  wolf: WOLF_STATS,
  worg_rider: WORG_RIDER_STATS,
  ogre: OGRE_STATS,
  wyvern: WYVERN_STATS,
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
  giant_spider: 4,
  salamander: 5,
  wolf: 6,
  worg_rider: 7,
  ogre: 7,
  wyvern: 9,
}

function isBandit(kind: FoeKind): kind is BanditKind {
  return kind in BANDIT_ROLE
}

/**
 * A foe of `kind` at `level`: a monster by `foeAtLevel` from its native
 * level; a bandit by `banditStats`, in the gear its level's threat calls for.
 */
export function foeStats(kind: FoeKind, level: number): CombatantStats {
  // A foe's level is its battle's threat (clamped to the encounter's band), so the level picks the gear grade.
  if (isBandit(kind)) return banditStats(BANDIT_ROLE[kind], level, banditGear(level))
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
  /** The highest level its foes are raised to, if lower than the threat's (the Source's provisional block, stage 9). */
  maxFoeLevel?: number
}

/**
 * The party against the foes `threat` calls for. The level is the threat
 * (a whole number) held within the band; the foes are the slots that take the
 * field at that level (`fromThreat`), cut to the band's count for it, each
 * a foe at that level (`foeStats`). The numbers behind the counts were
 * chosen with the simulator; see `.claude/skills/yomi-balance/levers.md`.
 */
function encounter(party: readonly Fighter[], { slots, band, counts, maxFoeLevel = Infinity }: EncounterDef, threat: number): Encounter {
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
          stats: { ...foeStats(kind, Math.min(level, maxFoeLevel)), name },
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

// The Spider first, the Sneak beside it, and two more Spiders: three at threat 4 and all four from threat 5 (the fourth,
// the Nest Spider, added in skill trees step 24, when a party of level 5 won three foes 500 times in 500).
const SPIDER_NEST_SLOTS: readonly FoeSlot[] = [
  { id: 'spider', kind: 'giant_spider', name: 'Giant Spider', at: [8, 4] },
  { id: 'sneak', kind: 'kobold', name: 'Kobold Sneak', at: [9, 2] },
  { id: 'spider2', kind: 'giant_spider', name: 'Brood Spider', at: [8, 6] },
  { id: 'spider3', kind: 'giant_spider', name: 'Nest Spider', at: [9, 6] },
]

// The Salamander in the middle, a Kobold either side: its cone burns them too.
const SALAMANDER_POOL_SLOTS: readonly FoeSlot[] = [
  { id: 'salamander', kind: 'salamander', name: 'Salamander', at: [8, 4] },
  { id: 'kobold', kind: 'kobold', name: 'Kobold Stoker', at: [8, 2] },
  { id: 'kobold2', kind: 'kobold', name: 'Kobold Warden', at: [8, 6] },
]

// The Horror first, so it takes the field at any threat; all five from threat 6, as at the Source's threat in the far ring.
const SOURCE_GUARDIANS_SLOTS: readonly FoeSlot[] = [
  { id: 'horror', kind: 'horror', name: 'Blight Horror', at: [8, 4] },
  { id: 'brute', kind: 'goblin', name: 'Goblin Brute', at: [8, 2] },
  { id: 'shaman', kind: 'shaman', name: 'Blight Shaman', at: [9, 4] },
  { id: 'sneak', kind: 'kobold', name: 'Kobold Sneak', at: [8, 6] },
  { id: 'cutter', kind: 'goblin', name: 'Goblin Cutter', at: [9, 6] },
]

// The Captain first, so it leads at every threat; then the Archer from threat 5, the Hedge-Mage from threat 4 and the
// Crossbowman from threat 6, ahead of the Brute, so that each threat of today's map has its own second bandit (the
// Brute at 3, the Hedge-Mage at 4, the Archer at 5) and threats 6 and 7 field the Captain, Archer, Hedge-Mage and
// Crossbowman; the Brute waits for a count of 5 there, and the Cutthroat is last.
const BANDIT_CAMP_SLOTS: readonly FoeSlot[] = [
  { id: 'captain', kind: 'bandit_captain', name: 'Bandit Captain', at: [8, 4] },
  { id: 'archer', kind: 'bandit_archer', name: 'Bandit Archer', at: [9, 6], fromThreat: 5 },
  { id: 'mage', kind: 'bandit_mage', name: 'Hedge-Mage', at: [9, 4], fromThreat: 4 },
  { id: 'crossbowman', kind: 'bandit_crossbowman', name: 'Bandit Crossbowman', at: [9, 2], fromThreat: 6 },
  { id: 'brute', kind: 'bandit_brute', name: 'Bandit Brute', at: [8, 2] },
  { id: 'cutthroat', kind: 'bandit_cutthroat', name: 'Cutthroat', at: [8, 6] },
]

// The Bandit Company of the far rings (threats 8 to 13): a Sergeant in the Captain's place (a Brute, axe and breastplate),
// and four of the camp's shooters and blades; four take the field, so the Cutthroat waits.
const BANDIT_COMPANY_SLOTS: readonly FoeSlot[] = [
  { id: 'sergeant', kind: 'bandit_brute', name: 'Bandit Sergeant', at: [8, 4] },
  { id: 'crossbowman', kind: 'bandit_crossbowman', name: 'Company Crossbowman', at: [9, 2] },
  { id: 'mage', kind: 'bandit_mage', name: 'Company Hedge-Mage', at: [9, 4] },
  { id: 'archer', kind: 'bandit_archer', name: 'Company Archer', at: [9, 6] },
  { id: 'cutthroat', kind: 'bandit_cutthroat', name: 'Company Cutthroat', at: [8, 6] },
]
// The Freebooter Host of the farthest rings (threats 14 to 20): a Freebooter Captain leading a Brute, a Crossbowman and a
// Hedge-Mage, and from threat 17 an Archer behind them.
const FREEBOOTER_HOST_SLOTS: readonly FoeSlot[] = [
  { id: 'captain', kind: 'bandit_captain', name: 'Freebooter Captain', at: [8, 4] },
  { id: 'brute', kind: 'bandit_brute', name: 'Freebooter Brute', at: [8, 2] },
  { id: 'crossbowman', kind: 'bandit_crossbowman', name: 'Freebooter Crossbowman', at: [9, 2] },
  { id: 'mage', kind: 'bandit_mage', name: 'Freebooter Hedge-Mage', at: [9, 4] },
  { id: 'archer', kind: 'bandit_archer', name: 'Freebooter Archer', at: [9, 6] },
]
// Ring 7 (long-campaign stage 11). The Pack Leader in the middle and the pack about it: wolves only, which run round
// the front rank to whoever stands behind it.
const WOLF_PACK_SLOTS: readonly FoeSlot[] = [
  { id: 'leader', kind: 'wolf', name: 'Pack Leader', at: [8, 4] },
  { id: 'grey', kind: 'wolf', name: 'Grey Wolf', at: [8, 2] },
  { id: 'lean', kind: 'wolf', name: 'Lean Wolf', at: [8, 6] },
  { id: 'scarred', kind: 'wolf', name: 'Scarred Wolf', at: [9, 4] },
  { id: 'young', kind: 'wolf', name: 'Young Wolf', at: [9, 6] },
]

// The Chief first. Below threat 8 the wolves stay away and three riders fight (the Chief, the Rider and the Outrider);
// from 8 the wolves run with them, taking their places in the order, so five field the Chief, a Rider and three
// wolves and the Outrider waits. Tuned against the cells: a fourth foe at threat 7 was a cliff (184 wins of 500).
const WORG_RIDERS_SLOTS: readonly FoeSlot[] = [
  { id: 'chief', kind: 'worg_rider', name: 'Worg Rider Chief', at: [8, 4] },
  { id: 'wolf', kind: 'wolf', name: 'Grey Wolf', at: [8, 2], fromThreat: 8 },
  { id: 'rider', kind: 'worg_rider', name: 'Worg Rider', at: [8, 6] },
  { id: 'wolf2', kind: 'wolf', name: 'Lean Wolf', at: [9, 4], fromThreat: 8 },
  { id: 'wolf3', kind: 'wolf', name: 'Young Wolf', at: [9, 6], fromThreat: 8 },
  { id: 'outrider', kind: 'worg_rider', name: 'Worg Outrider', at: [9, 2] },
]

// An Ogre first, a Worg Rider beside it, then the second Ogre and the camp's wolf: the Ogres hold the middle while
// the rider and the wolf go round.
const OGRE_CAMP_SLOTS: readonly FoeSlot[] = [
  { id: 'ogre', kind: 'ogre', name: 'Ogre', at: [8, 4] },
  { id: 'rider', kind: 'worg_rider', name: 'Worg Rider', at: [8, 2] },
  { id: 'brute', kind: 'ogre', name: 'Ogre Brute', at: [8, 6] },
  { id: 'wolf', kind: 'wolf', name: 'Camp Wolf', at: [9, 4] },
]

// Ring 9 (long-campaign stage 11): wyverns only, the roost's pair first and their young.
const WYVERN_ROOST_SLOTS: readonly FoeSlot[] = [
  { id: 'wyvern', kind: 'wyvern', name: 'Wyvern', at: [8, 4] },
  { id: 'mate', kind: 'wyvern', name: 'Wyvern Mate', at: [8, 2] },
  { id: 'young', kind: 'wyvern', name: 'Young Wyvern', at: [8, 6] },
]

/** Today's encounters are fought at threats 1 to 5, with these many foes at each. */
const TODAY = { band: { min: 1, max: 5 }, counts: [2, 3, 3, 3, 4] } as const satisfies Omit<EncounterDef, 'slots'>

const GOBLIN_RAID: EncounterDef = { slots: GOBLIN_RAID_SLOTS, ...TODAY }
const KOBOLD_SCOUTS: EncounterDef = { slots: KOBOLD_SCOUTS_SLOTS, ...TODAY }
const HOBGOBLIN_WARBAND: EncounterDef = { slots: HOBGOBLIN_WARBAND_SLOTS, ...TODAY }
const TROLL_LAIR: EncounterDef = { slots: TROLL_LAIR_SLOTS, ...TODAY }
/**
 * The level the Source's guardians are raised to at most (stage 9 step 09, the user's decision: the Source made
 * winnable). Raised from native level 1 to 20 they were barely hit (hit rate about 0.28; AC 105 to 115 against a
 * level-18 party's to-hit of about 100); at 6 a ready-made level-18 party wins 28 battles of 500 and the long campaign 8 of 50 (7 and above:
 * no `sg20-18` win). It is at least 5, so the Source near home (threats 1 to 5) fights as before.
 */
export const SOURCE_FOE_LEVEL = 6
/**
 * The Source's guardians: today's counts at threats 1 to 5, where the Source near home is fought, and all five from
 * 6 to 20, where it stands in the far ring (`SOURCE_THREAT`), raised to `SOURCE_FOE_LEVEL` at most. The block past 5
 * is provisional (long-campaign stage 9; stage 11 replaces it).
 */
const SOURCE_GUARDIANS: EncounterDef = {
  slots: SOURCE_GUARDIANS_SLOTS,
  band: { min: 1, max: 20 },
  counts: [...TODAY.counts, ...Array<number>(15).fill(5)],
  maxFoeLevel: SOURCE_FOE_LEVEL,
}
/**
 * The Giant Spider's nest, fought at threats 4 to 9: three at 4 and all four from 5 (long-campaign stage 9; at stage
 * 2 the user kept it to threat 5, when at threat 4 its two foes were won 500 times in 500). The counts past 5 are
 * first values, for the simulator to judge.
 */
const SPIDER_NEST: EncounterDef = { slots: SPIDER_NEST_SLOTS, band: { min: 4, max: 9 }, counts: [3, 4, 4, 4, 4, 4] }
/** The Salamander's pool, fought at threats 5 to 9, three at each (the range from long-campaign stage 9). */
const SALAMANDER_POOL: EncounterDef = { slots: SALAMANDER_POOL_SLOTS, band: { min: 5, max: 9 }, counts: [3, 3, 3, 3, 3] }
/**
 * Bandits are fought from threat 3. Two at threats 3 to 5, tuned by the simulator (a third made the camp a wall:
 * a party of the threat's level won about 2 in 5 at threat 3 and 1 in 3 at 4); the counts past 5 are the first guess, for the
 * stage that grows the map to tune.
 */
const BANDIT_CAMP: EncounterDef = { slots: BANDIT_CAMP_SLOTS, band: { min: 3, max: 7 }, counts: [2, 2, 2, 4, 4] }
/** The Bandit Company, four at each of threats 8 to 13 (long-campaign stage 9; first values, for the simulator to judge). */
const BANDIT_COMPANY: EncounterDef = { slots: BANDIT_COMPANY_SLOTS, band: { min: 8, max: 13 }, counts: [4, 4, 4, 4, 4, 4] }
/** The Freebooter Host, four at threats 14 to 16 and five from 17 to 20 (long-campaign stage 9; first values). */
const FREEBOOTER_HOST: EncounterDef = { slots: FREEBOOTER_HOST_SLOTS, band: { min: 14, max: 20 }, counts: [4, 4, 4, 5, 5, 5, 5] }
/**
 * Ring 7's encounters (long-campaign stage 11 step 08), their counts tuned against the ring's cells (a party of the
 * threat's level in the expected kit, 300 to 475 wins of 500 at both ends of the band; the plan's log has the trials).
 * The Wolf Pack, threats 6 to 9: four wolves, and all five at 9 (three at threat 6 were won 497 times in 500; four, 418).
 */
const WOLF_PACK: EncounterDef = { slots: WOLF_PACK_SLOTS, band: { min: 6, max: 9 }, counts: [4, 4, 4, 5] }
/**
 * The Worg Riders, threats 7 to 9 (the rider is native to 7): three at 7 and 8, five at 9. At 7 the three are riders
 * (463 of 500); two riders and two wolves there were won 184 times, and four foes at 9 498 times, five 326.
 */
const WORG_RIDERS: EncounterDef = { slots: WORG_RIDERS_SLOTS, band: { min: 7, max: 9 }, counts: [3, 3, 5] }
/** The Ogre Camp, threats 7 to 10: both Ogres and the rider to 9, the wolf too at 10 (an Ogre and a rider alone at 7 were won 500 times in 500). */
const OGRE_CAMP: EncounterDef = { slots: OGRE_CAMP_SLOTS, band: { min: 7, max: 10 }, counts: [3, 3, 3, 4] }
/**
 * Ring 9's encounter (stage 11 step 09). The Wyvern Roost, threats 9 to 12: three at every threat (a pair at 9 was won
 * 500 times in 500). Not settled: with one block and three wyverns the cells at 9 and 12 do not both sit in the
 * reading (498 and 399 here; 459 and 175 with a stronger block); the plan's log has the trials.
 */
const WYVERN_ROOST: EncounterDef = { slots: WYVERN_ROOST_SLOTS, band: { min: 9, max: 12 }, counts: [3, 3, 3, 3] }

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
 * Giant Spiders that web a hero from range, then close and bite twice, the
 * second bite poisoning: two of them with a Kobold Sneak at threat 4, and
 * three from threat 5 to 9.
 */
export function spiderNest(party: readonly Fighter[], threat = 5): Encounter {
  return encounter(party, SPIDER_NEST, threat)
}

/**
 * A Salamander, warded against fire, spitting a cone of fire that burns its
 * own two Kobolds as well as the party; fought at threats 5 to 9.
 */
export function salamanderPool(party: readonly Fighter[], threat = 5): Encounter {
  return encounter(party, SALAMANDER_POOL, threat)
}

/**
 * What guards the blight's Source: the Blight Horror, with a Goblin Brute
 * beside it and, at threat 5, where the Source near home is fought, a shaman
 * and a Kobold Sneak behind; from threat 6 a Goblin Cutter too, so the Source
 * in the far ring (threat 20) fields all five at the threat's level,
 * SOURCE_FOE_LEVEL (6) at most.
 */
export function sourceGuardians(party: readonly Fighter[], threat = 1): Encounter {
  return encounter(party, SOURCE_GUARDIANS, threat)
}

/**
 * Bandits, built by the rules heroes are: a Bandit Captain with sword, shield
 * and breastplate, and a Brute with an axe and breastplate at threat 3; at
 * threat 4 a Hedge-Mage in the Brute's place, and at threat 5 an Archer, their
 * gear Fine iron. From threat 6 four fight, the Captain, Archer, Hedge-Mage and
 * Crossbowman, in Fine steel and ironwood; the Brute and the Cutthroat wait
 * for a count of 5, which the camp does not reach (the far rings have the
 * Bandit Company and the Freebooter Host instead).
 */
export function banditCamp(party: readonly Fighter[], threat = 3): Encounter {
  return encounter(party, BANDIT_CAMP, threat)
}

/**
 * Bandits of the far rings, threats 8 to 13, in Masterwork steel and
 * ironwood at 8, Fine mithril and elderwood at 9 to 11 and Fine adamant and
 * wyrmwood at 12 and 13 (`banditGear`): a Bandit Sergeant with axe and breastplate, a Crossbowman, a
 * Hedge-Mage and an Archer.
 */
export function banditCompany(party: readonly Fighter[], threat = 8): Encounter {
  return encounter(party, BANDIT_COMPANY, threat)
}

/**
 * Bandits of the farthest rings, threats 14 to 20, in Fine adamant and
 * wyrmwood to 17 and Masterwork starmetal and heartwood from 18
 * (`banditGear`): a Freebooter Captain with sword, shield and breastplate, a Brute,
 * a Crossbowman and a Hedge-Mage, and from threat 17 an Archer.
 */
export function freebooterHost(party: readonly Fighter[], threat = 14): Encounter {
  return encounter(party, FREEBOOTER_HOST, threat)
}

/**
 * A pack of wolves, four of them and five at threat 9, fought at threats 6
 * to 9: fast, so they are round the front rank and on the archer and the
 * mage in their first turn, each biting once a turn through some of any
 * armour.
 */
export function wolfPack(party: readonly Fighter[], threat = 6): Encounter {
  return encounter(party, WOLF_PACK, threat)
}

/**
 * Goblins on worgs, fought at threats 7 to 9: each rider strikes with spear
 * and bite in one action. Three riders at 7; from 8 wolves run beside them,
 * and at 9 the Chief, a Rider and three wolves fight.
 */
export function worgRiders(party: readonly Fighter[], threat = 7): Encounter {
  return encounter(party, WORG_RIDERS, threat)
}

/**
 * Two Ogres, which sweep their clubs round at everyone beside them, with a
 * Worg Rider between them and, at threat 10, a wolf of their camp; fought at
 * threats 7 to 10.
 */
export function ogreCamp(party: readonly Fighter[], threat = 7): Encounter {
  return encounter(party, OGRE_CAMP, threat)
}

/**
 * A roost of wyverns, fought at threats 9 to 12: each closes fast, bites
 * hard through armour and stings with its tail, and the sting's poison works
 * on whatever the armour is.
 */
export function wyvernRoost(party: readonly Fighter[], threat = 9): Encounter {
  return encounter(party, WYVERN_ROOST, threat)
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
  spider_nest: spiderNest,
  salamander_pool: salamanderPool,
  bandit_company: banditCompany,
  freebooter_host: freebooterHost,
  wolf_pack: wolfPack,
  worg_riders: worgRiders,
  ogre_camp: ogreCamp,
  wyvern_roost: wyvernRoost,
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
  spider_nest: SPIDER_NEST.band,
  salamander_pool: SALAMANDER_POOL.band,
  bandit_company: BANDIT_COMPANY.band,
  freebooter_host: FREEBOOTER_HOST.band,
  wolf_pack: WOLF_PACK.band,
  worg_riders: WORG_RIDERS.band,
  ogre_camp: OGRE_CAMP.band,
  wyvern_roost: WYVERN_ROOST.band,
}

/** How many foes each encounter fields at each threat of its band, from `band.min` up, from its definition. */
export const ENCOUNTER_COUNTS: Record<EncounterId, readonly number[]> = {
  goblin_raid: GOBLIN_RAID.counts,
  kobold_scouts: KOBOLD_SCOUTS.counts,
  hobgoblin_warband: HOBGOBLIN_WARBAND.counts,
  troll_lair: TROLL_LAIR.counts,
  source_guardians: SOURCE_GUARDIANS.counts,
  bandit_camp: BANDIT_CAMP.counts,
  spider_nest: SPIDER_NEST.counts,
  salamander_pool: SALAMANDER_POOL.counts,
  bandit_company: BANDIT_COMPANY.counts,
  freebooter_host: FREEBOOTER_HOST.counts,
  wolf_pack: WOLF_PACK.counts,
  worg_riders: WORG_RIDERS.counts,
  ogre_camp: OGRE_CAMP.counts,
  wyvern_roost: WYVERN_ROOST.counts,
}

/** The encounters whose band holds `threat`, in `ENCOUNTERS` order. */
export function encountersFor(threat: number): EncounterId[] {
  return (Object.keys(ENCOUNTERS) as EncounterId[]).filter(
    (id) => threat >= ENCOUNTER_BANDS[id].min && threat <= ENCOUNTER_BANDS[id].max,
  )
}
