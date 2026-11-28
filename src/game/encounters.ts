import {
  BARROW_WIGHT_STATS,
  BASILISK_STATS,
  ARMORED_TROLL_STATS,
  GIANT_SPIDER_STATS,
  SALAMANDER_STATS,
  BLIGHT_HORROR_STATS,
  GOBLIN_SHAMAN_STATS,
  GOBLIN_STATS,
  HILL_GIANT_STATS,
  HOBGOBLIN_CHIEF_STATS,
  KOBOLD_STATS,
  STONE_GOLEM_STATS,
  BLIGHT_CULTIST_STATS,
  YOUNG_DRAGON_STATS,
  BLIGHT_LICH_STATS,
  ELDER_WYRM_STATS,
  SOURCE_HORROR_STATS,
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
export type MonsterKind = 'goblin' | 'kobold' | 'shaman' | 'horror' | 'hobgoblin' | 'troll' | 'armored_troll' | 'giant_spider' | 'salamander' | 'wolf' | 'worg_rider' | 'ogre' | 'wyvern' | 'barrow_wight' | 'basilisk' | 'hill_giant' | 'stone_golem' | 'blight_cultist' | 'young_dragon' | 'blight_lich' | 'elder_wyrm' | 'source_horror'

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
 * a foe (ring 7), wyverns wyvern hide 3 (ring 9), basilisks basilisk scale 3
 * (ring 12), young dragons drake scale 6 (ring 15), elder wyrms drake scale
 * 10 (ring 18): all of gear §4.3's.
 * No partner sells a trophy: Elder Glade's wyvern hide went when wyverns came.
 */
export const TROPHIES: Partial<Record<FoeKind, Trophy>> = {
  wolf: { material: 'wolfhide', amount: 1 },
  worg_rider: { material: 'wolfhide', amount: 1 },
  wyvern: { material: 'wyvern_hide', amount: 3 },
  basilisk: { material: 'basilisk_scale', amount: 3 },
  young_dragon: { material: 'drake_scale', amount: 6 },
  elder_wyrm: { material: 'drake_scale', amount: 10 },
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
 * the Wyvern above one too, for its poison; ring 12's Barrow Wight an even
 * one, the Basilisk above it and the Hill Giant well above; ring 15's Stone
 * Golem well above one, the Blight Cultist an even one and the Young Dragon,
 * a boss, worth three; ring 18's Blight Lich, a caster boss, worth three
 * and the Elder Wyrm, the top threat, worth four and a half.
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
  barrow_wight: 110,
  basilisk: 150,
  hill_giant: 200,
  stone_golem: 180,
  blight_cultist: 100,
  young_dragon: 300,
  blight_lich: 300,
  elder_wyrm: 450,
  source_horror: 500,
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
  /**
   * Its hex as [column, row]. No two foes stand in neighbouring hexes of adjacent rows, where the lower's sprite
   * would hide the upper's nameplate: a foe in an odd row of column 8 has its neighbours in the even rows beside it
   * at columns 8 and 9, so those beside it stand in column 10 (the Blight Cult); or the odd rows' foes stand in
   * column 7 and the even rows' in column 9 (the Barrow Wights and the Lich's Court, which with the even rows' in
   * column 10 were won 483 times in 500 at 12 and 499 at 18; the stage 11 verification's tuning, in the plan's log).
   */
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
  barrow_wight: BARROW_WIGHT_STATS,
  basilisk: BASILISK_STATS,
  hill_giant: HILL_GIANT_STATS,
  stone_golem: STONE_GOLEM_STATS,
  blight_cultist: BLIGHT_CULTIST_STATS,
  young_dragon: YOUNG_DRAGON_STATS,
  blight_lich: BLIGHT_LICH_STATS,
  elder_wyrm: ELDER_WYRM_STATS,
  source_horror: SOURCE_HORROR_STATS,
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
  barrow_wight: 11,
  basilisk: 11,
  hill_giant: 12,
  stone_golem: 14,
  blight_cultist: 14,
  young_dragon: 15,
  blight_lich: 17,
  elder_wyrm: 18,
  source_horror: 20,
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
}

/**
 * The party against the foes `threat` calls for. The level is the threat
 * (a whole number) held within the band; the foes are the slots that take the
 * field at that level (`fromThreat`), cut to the band's count for it, each
 * a foe at that level (`foeStats`). The numbers behind the counts were
 * chosen with the simulator; see `.claude/skills/yomi-balance/levers.md`.
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

// The Horror first, so it takes the field at any threat; all four at threat 5, where the Source near home is fought.
const SOURCE_GUARDIANS_SLOTS: readonly FoeSlot[] = [
  { id: 'horror', kind: 'horror', name: 'Blight Horror', at: [8, 4] },
  { id: 'brute', kind: 'goblin', name: 'Goblin Brute', at: [8, 2] },
  { id: 'shaman', kind: 'shaman', name: 'Blight Shaman', at: [9, 4] },
  { id: 'sneak', kind: 'kobold', name: 'Kobold Sneak', at: [8, 6] },
]

// The Source at 20 (long-campaign stage 11 step 13): the Blight Horror, with two Blight Cultists behind it.
const SOURCE_AT_20_SLOTS: readonly FoeSlot[] = [
  { id: 'horror', kind: 'source_horror', name: 'Blight Horror', at: [8, 4] },
  { id: 'acolyte', kind: 'blight_cultist', name: 'Blight Acolyte', at: [9, 2] },
  { id: 'zealot', kind: 'blight_cultist', name: 'Blight Zealot', at: [9, 6] },
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

// Ring 9 (long-campaign stage 11): wyverns only, the roost's pair first and their young; the Old Wyvern last, so it is the one that is gone from threat 11.
const WYVERN_ROOST_SLOTS: readonly FoeSlot[] = [
  { id: 'wyvern', kind: 'wyvern', name: 'Wyvern', at: [8, 4] },
  { id: 'mate', kind: 'wyvern', name: 'Wyvern Mate', at: [8, 2] },
  { id: 'young', kind: 'wyvern', name: 'Young Wyvern', at: [8, 6] },
  { id: 'old', kind: 'wyvern', name: 'Old Wyvern', at: [9, 4] },
]

// Ring 12 (long-campaign stage 11): the barrow's dead, its king first, and at 11 a living kobold robbing their graves; a pair of basilisks and the ogre that keeps
// them; a steading of two hill giants and their ogre. Three foes are each line-up's whole (a fourth was won 0 times
// in 500 at the lair's top threat and 19 at the steading's), so the plan's second ogre of each has no slot.
const BARROW_WIGHTS_SLOTS: readonly FoeSlot[] = [
  { id: 'king', kind: 'barrow_wight', name: 'Barrow King', at: [9, 4] },
  { id: 'wight', kind: 'barrow_wight', name: 'Barrow Wight', at: [7, 3] },
  { id: 'grave', kind: 'barrow_wight', name: 'Grave Wight', at: [7, 5] },
  { id: 'pale', kind: 'barrow_wight', name: 'Pale Wight', at: [9, 2] },
  { id: 'robber', kind: 'kobold', name: 'Grave Robber', at: [7, 1] },
]

const BASILISK_LAIR_SLOTS: readonly FoeSlot[] = [
  { id: 'basilisk', kind: 'basilisk', name: 'Basilisk', at: [8, 4] },
  { id: 'keeper', kind: 'ogre', name: 'Ogre Keeper', at: [8, 2] },
  { id: 'mate', kind: 'basilisk', name: 'Basilisk Mate', at: [8, 6] },
]

const HILL_GIANT_STEADING_SLOTS: readonly FoeSlot[] = [
  { id: 'giant', kind: 'hill_giant', name: 'Hill Giant', at: [8, 4] },
  { id: 'chief', kind: 'hill_giant', name: 'Giant Chief', at: [8, 2] },
  { id: 'ogre', kind: 'ogre', name: 'Ogre Thrall', at: [8, 6] },
]

// Ring 15 (long-campaign stage 11): a ruin's golems and the wights that haunt it, the Stone Sentinel waking at the
// band's top; a cult of the blight and the dead it has raised; a young dragon and the wyverns of its lair.
const GOLEM_RUIN_SLOTS: readonly FoeSlot[] = [
  { id: 'golem', kind: 'stone_golem', name: 'Stone Golem', at: [8, 4] },
  { id: 'wight', kind: 'barrow_wight', name: 'Ruin Wight', at: [9, 3] },
  { id: 'warden', kind: 'stone_golem', name: 'Stone Warden', at: [8, 2] },
  { id: 'pale', kind: 'barrow_wight', name: 'Pale Wight', at: [9, 5] },
  { id: 'sentinel', kind: 'stone_golem', name: 'Stone Sentinel', at: [8, 6] },
]

const BLIGHT_CULT_SLOTS: readonly FoeSlot[] = [
  { id: 'cultist', kind: 'blight_cultist', name: 'Blight Cultist', at: [10, 4] },
  { id: 'wight', kind: 'barrow_wight', name: 'Risen Wight', at: [8, 3] },
  { id: 'acolyte', kind: 'blight_cultist', name: 'Cult Acolyte', at: [10, 2] },
  { id: 'grave', kind: 'barrow_wight', name: 'Grave Wight', at: [8, 5] },
  { id: 'elder', kind: 'blight_cultist', name: 'Cult Elder', at: [10, 6] },
]

const YOUNG_DRAGON_SLOTS: readonly FoeSlot[] = [
  { id: 'dragon', kind: 'young_dragon', name: 'Young Dragon', at: [8, 4] },
  { id: 'wyvern', kind: 'wyvern', name: 'Lair Wyvern', at: [8, 2] },
  { id: 'mate', kind: 'wyvern', name: 'Wyvern Mate', at: [8, 6] },
]

// Ring 18 (long-campaign stage 11): a lich's court of the dead and the cultists who serve it; an elder wyrm and the
// young dragon of its brood (the second, the Brood Drake, sits out; see ELDER_WYRM).
const BLIGHT_LICH_COURT_SLOTS: readonly FoeSlot[] = [
  { id: 'lich', kind: 'blight_lich', name: 'Blight Lich', at: [9, 4] },
  { id: 'guard', kind: 'barrow_wight', name: 'Barrow Guard', at: [7, 3] },
  { id: 'acolyte', kind: 'blight_cultist', name: 'Lich\'s Acolyte', at: [9, 2] },
  { id: 'warden', kind: 'barrow_wight', name: 'Crypt Warden', at: [7, 5] },
  { id: 'herald', kind: 'blight_cultist', name: 'Lich\'s Herald', at: [9, 6] },
]

const ELDER_WYRM_SLOTS: readonly FoeSlot[] = [
  { id: 'wyrm', kind: 'elder_wyrm', name: 'Elder Wyrm', at: [8, 4] },
  { id: 'wyrmling', kind: 'young_dragon', name: 'Wyrmling', at: [8, 2] },
  { id: 'brood', kind: 'young_dragon', name: 'Brood Drake', at: [8, 6] },
]

/** Today's encounters are fought at threats 1 to 5, with these many foes at each. */
const TODAY = { band: { min: 1, max: 5 }, counts: [2, 3, 3, 3, 4] } as const satisfies Omit<EncounterDef, 'slots'>

const GOBLIN_RAID: EncounterDef = { slots: GOBLIN_RAID_SLOTS, ...TODAY }
const KOBOLD_SCOUTS: EncounterDef = { slots: KOBOLD_SCOUTS_SLOTS, ...TODAY }
const HOBGOBLIN_WARBAND: EncounterDef = { slots: HOBGOBLIN_WARBAND_SLOTS, ...TODAY }
const TROLL_LAIR: EncounterDef = { slots: TROLL_LAIR_SLOTS, ...TODAY }
/** The Source near home: today's slots and counts at threats 1 to 5, the Horror at its native level 1 raised to the threat. */
const SOURCE_GUARDIANS: EncounterDef = { slots: SOURCE_GUARDIANS_SLOTS, ...TODAY }
/**
 * The Source in the far ring (`SOURCE_THREAT`), long-campaign stage 11 step 13: the Blight Horror of native 20 and two
 * Blight Cultists, three foes fought at 20 whatever the threat above 5.
 */
const SOURCE_AT_20: EncounterDef = { slots: SOURCE_AT_20_SLOTS, band: { min: 20, max: 20 }, counts: [3] }
/** The threats past which the Source is `SOURCE_AT_20`: the near-home Source's band's top. */
const SOURCE_NEAR_MAX = SOURCE_GUARDIANS.band.max
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
 * Ring 9's encounter (stage 11 step 09). The Wyvern Roost, threats 9 to 12: four at 9 and 10, three at 11 and 12,
 * one of the four encounters whose numbers fall as the threat rises (the user's decision; with the Barrow Wights, the
 * Blight Cult and the Lich's Court). The expected kit is the same
 * across the band while the wyverns grow, so three were won 498 times in 500 at 9 and 399 at 12; four at 9, 312.
 * A pair at 9 was won 500 times. The plan's log has the trials.
 */
const WYVERN_ROOST: EncounterDef = { slots: WYVERN_ROOST_SLOTS, band: { min: 9, max: 12 }, counts: [4, 4, 3, 3] }
/**
 * Ring 12's encounters (stage 11 step 10); the cells' tuning is in the plan's log. Each is the same line-up at every
 * threat of its band, but that the Barrow Wights field a fifth at 11: the expected kit steps up at 13, so the top of the band is far the harder end. The Barrow
 * Wights, threats 11 to 14: four (three at 11 were won 500 times in 500), and at 11 a kobold Grave Robber with them
 * (four were won 486 times in 500 there, 485 in the old placement; the stage 11 verification's tuning). So one of the
 * four encounters whose numbers fall as the threat rises (the Wyvern Roost, the Barrow Wights, the Blight Cult and the Lich's Court).
 */
const BARROW_WIGHTS: EncounterDef = { slots: BARROW_WIGHTS_SLOTS, band: { min: 11, max: 14 }, counts: [5, 4, 4, 4] }
/** The Basilisk Lair, threats 11 to 14: a Basilisk, its keeper and its mate (two foes are no battle for a party in the expected kit, and a second Ogre at 14 was never beaten). */
const BASILISK_LAIR: EncounterDef = { slots: BASILISK_LAIR_SLOTS, band: { min: 11, max: 14 }, counts: [3, 3, 3, 3] }
/** The Hill Giant Steading, threats 12 to 15: the Hill Giant, the Giant Chief and their Ogre (an Ogre raised to these levels is the tougher of the two kinds, so the steading fields one, not two). */
const HILL_GIANT_STEADING: EncounterDef = { slots: HILL_GIANT_STEADING_SLOTS, band: { min: 12, max: 15 }, counts: [3, 3, 3, 3] }
/**
 * Ring 15's encounters (stage 11 step 11); the cells' tuning is in the plan's log. The expected kit steps up at 17
 * (tier 5), by more than the foes do, so here the top of a band is the easier end and the counts rise to it. The
 * Golem Ruin, threats 14 to 17: two golems and two wights, the Stone Sentinel with them at 17 (three foes were won
 * 500 times in 500, and four at 17).
 */
const GOLEM_RUIN: EncounterDef = { slots: GOLEM_RUIN_SLOTS, band: { min: 14, max: 17 }, counts: [4, 4, 4, 5] }
/**
 * The Blight Cult, threats 14 to 18: three cultists and the two wights they have raised, but at 15 and 16 without
 * the Cult Elder (the user's decision, stage 11 step 11). From 14 to 15 every foe gains 5 armour class, to hit and
 * spell skill while the expected kit does not move until 17: five were won 345 times in 500 at 14 and 99 at 15.
 * So one of the four encounters whose numbers fall as the threat rises (the Wyvern Roost, the Barrow Wights, the Blight Cult and the Lich's Court).
 */
const BLIGHT_CULT: EncounterDef = { slots: BLIGHT_CULT_SLOTS, band: { min: 14, max: 18 }, counts: [5, 4, 4, 5, 5] }
/**
 * The Dragon Lair, threats 15 to 18: the Young Dragon and a wyvern, the Wyvern Mate from 17 (a wyvern raised to 15
 * is the harder of the two kinds to hit: with two of them at 15 the lair was won 64 times in 500).
 */
const YOUNG_DRAGON: EncounterDef = { slots: YOUNG_DRAGON_SLOTS, band: { min: 15, max: 18 }, counts: [2, 2, 3, 3] }
/**
 * Ring 18's encounters (stage 11 step 12); the cells' tuning is in the plan's log. The Blight Lich's Court, threats 17
 * to 20: the Blight Lich, two wights and two cultists; four at 20, the Lich's Herald sitting out (five at 20 were won
 * 287 times in 500, and five at 17 to 19 as few as 464; with the stage 11 verification's placement, 484 at 17, 439 at 18
 * and 309 at 20). So one of the four encounters whose numbers fall as the threat rises (the Wyvern Roost, the Barrow Wights, the Blight Cult and the Lich's Court).
 */
const BLIGHT_LICH_COURT: EncounterDef = { slots: BLIGHT_LICH_COURT_SLOTS, band: { min: 17, max: 20 }, counts: [5, 5, 5, 4] }
/**
 * The Elder Wyrm's lair, threats 18 to 20: the Elder Wyrm and a young dragon at every threat. The Brood Drake, a second
 * young dragon, is not fielded at these counts: with it at 20 the lair was won 6 times in 500.
 */
const ELDER_WYRM: EncounterDef = { slots: ELDER_WYRM_SLOTS, band: { min: 18, max: 20 }, counts: [2, 2, 2] }

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
 * What guards the blight's Source. Near home (threats 1 to 5): the Blight
 * Horror, with a Goblin Brute beside it, a shaman behind from threat 2 and,
 * at threat 5, a Kobold Sneak, each at the threat's level. Above threat 5, where the
 * Source stands in the far ring (threat 20): `SOURCE_AT_20`, the Blight Horror
 * of native 20 and two Blight Cultists, fought at 20 whatever the threat.
 */
export function sourceGuardians(party: readonly Fighter[], threat = 1): Encounter {
  return encounter(party, Math.floor(threat) > SOURCE_NEAR_MAX ? SOURCE_AT_20 : SOURCE_GUARDIANS, threat)
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
 * Worg Rider beside the first and, at threat 10, a wolf of their camp; fought at
 * threats 7 to 10.
 */
export function ogreCamp(party: readonly Fighter[], threat = 7): Encounter {
  return encounter(party, OGRE_CAMP, threat)
}

/**
 * A roost of wyverns, four at threats 9 and 10 and three at 11 and 12: each closes fast, bites
 * hard through armour and stings with its tail, and the sting's poison works
 * on whatever the armour is.
 */
export function wyvernRoost(party: readonly Fighter[], threat = 9): Encounter {
  return encounter(party, WYVERN_ROOST, threat)
}

/** A barrow's wights, fought at threats 11 to 14: each drains the life of a hero from afar, healing by it, then closes with its blade. */
export function barrowWights(party: readonly Fighter[], threat = 11): Encounter {
  return encounter(party, BARROW_WIGHTS, threat)
}

/** A lair of two basilisks and the ogre that keeps them, fought at threats 11 to 14: the gaze chills a cone of heroes while the ogre closes. */
export function basiliskLair(party: readonly Fighter[], threat = 11): Encounter {
  return encounter(party, BASILISK_LAIR, threat)
}

/** A steading of two hill giants and their ogre, fought at threats 12 to 15: rocks thrown as the party closes, then clubs. */
export function hillGiantSteading(party: readonly Fighter[], threat = 12): Encounter {
  return encounter(party, HILL_GIANT_STEADING, threat)
}

/** A ruin's stone golems and the wights that haunt it, fought at threats 14 to 17: the golems wall the party off while the wights drain it. */
export function golemRuin(party: readonly Fighter[], threat = 14): Encounter {
  return encounter(party, GOLEM_RUIN, threat)
}

/** A cult of the blight and the dead it has raised, fought at threats 14 to 18: lightning down the party's line, curses, and healing for its own. */
export function blightCult(party: readonly Fighter[], threat = 14): Encounter {
  return encounter(party, BLIGHT_CULT, threat)
}

/** A young dragon and the wyverns of its lair, fought at threats 15 to 18: its breath burns a cone of heroes, then it bites and claws. */
export function youngDragon(party: readonly Fighter[], threat = 15): Encounter {
  return encounter(party, YOUNG_DRAGON, threat)
}

/** A blight lich's court of wights and cultists, fought at threats 17 to 20: death clouds and lightning, life drained, and the dead to guard it. */
export function blightLichCourt(party: readonly Fighter[], threat = 17): Encounter {
  return encounter(party, BLIGHT_LICH_COURT, threat)
}

/** An elder wyrm and a young dragon of its brood (the Brood Drake sits out; see ELDER_WYRM), fought at threats 18 to 20: a breath 4 hexes long, then bite and claws. */
export function elderWyrm(party: readonly Fighter[], threat = 18): Encounter {
  return encounter(party, ELDER_WYRM, threat)
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
  barrow_wights: barrowWights,
  basilisk_lair: basiliskLair,
  hill_giant_steading: hillGiantSteading,
  golem_ruin: golemRuin,
  blight_cult: blightCult,
  young_dragon: youngDragon,
  blight_lich_court: blightLichCourt,
  elder_wyrm: elderWyrm,
} satisfies Record<string, (party: readonly Fighter[], threat?: number) => Encounter>

export type EncounterId = keyof typeof ENCOUNTERS

/** The threats each encounter is fought at, from its definition. */
export const ENCOUNTER_BANDS: Record<EncounterId, ThreatBand> = {
  goblin_raid: GOBLIN_RAID.band,
  kobold_scouts: KOBOLD_SCOUTS.band,
  hobgoblin_warband: HOBGOBLIN_WARBAND.band,
  troll_lair: TROLL_LAIR.band,
  source_guardians: { min: SOURCE_GUARDIANS.band.min, max: SOURCE_AT_20.band.max },
  bandit_camp: BANDIT_CAMP.band,
  spider_nest: SPIDER_NEST.band,
  salamander_pool: SALAMANDER_POOL.band,
  bandit_company: BANDIT_COMPANY.band,
  freebooter_host: FREEBOOTER_HOST.band,
  wolf_pack: WOLF_PACK.band,
  worg_riders: WORG_RIDERS.band,
  ogre_camp: OGRE_CAMP.band,
  wyvern_roost: WYVERN_ROOST.band,
  barrow_wights: BARROW_WIGHTS.band,
  basilisk_lair: BASILISK_LAIR.band,
  hill_giant_steading: HILL_GIANT_STEADING.band,
  golem_ruin: GOLEM_RUIN.band,
  blight_cult: BLIGHT_CULT.band,
  young_dragon: YOUNG_DRAGON.band,
  blight_lich_court: BLIGHT_LICH_COURT.band,
  elder_wyrm: ELDER_WYRM.band,
}

/** How many foes each encounter fields at each threat of its band, from `band.min` up, from its definition. */
export const ENCOUNTER_COUNTS: Record<EncounterId, readonly number[]> = {
  goblin_raid: GOBLIN_RAID.counts,
  kobold_scouts: KOBOLD_SCOUTS.counts,
  hobgoblin_warband: HOBGOBLIN_WARBAND.counts,
  troll_lair: TROLL_LAIR.counts,
  // The near-home counts at 1 to 5, then the Source at 20's three at each threat from 6 to 20 (all fought at 20).
  source_guardians: [...SOURCE_GUARDIANS.counts, ...Array<number>(SOURCE_AT_20.band.max - SOURCE_NEAR_MAX).fill(SOURCE_AT_20.counts[0])],
  bandit_camp: BANDIT_CAMP.counts,
  spider_nest: SPIDER_NEST.counts,
  salamander_pool: SALAMANDER_POOL.counts,
  bandit_company: BANDIT_COMPANY.counts,
  freebooter_host: FREEBOOTER_HOST.counts,
  wolf_pack: WOLF_PACK.counts,
  worg_riders: WORG_RIDERS.counts,
  ogre_camp: OGRE_CAMP.counts,
  wyvern_roost: WYVERN_ROOST.counts,
  barrow_wights: BARROW_WIGHTS.counts,
  basilisk_lair: BASILISK_LAIR.counts,
  hill_giant_steading: HILL_GIANT_STEADING.counts,
  golem_ruin: GOLEM_RUIN.counts,
  blight_cult: BLIGHT_CULT.counts,
  young_dragon: YOUNG_DRAGON.counts,
  blight_lich_court: BLIGHT_LICH_COURT.counts,
  elder_wyrm: ELDER_WYRM.counts,
}

/** The encounters whose band holds `threat`, in `ENCOUNTERS` order. */
export function encountersFor(threat: number): EncounterId[] {
  return (Object.keys(ENCOUNTERS) as EncounterId[]).filter(
    (id) => threat >= ENCOUNTER_BANDS[id].min && threat <= ENCOUNTER_BANDS[id].max,
  )
}
