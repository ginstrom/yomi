#!/usr/bin/env node
// Headless battle simulator for balancing: runs the same BattleEngine the
// game uses many times, with each side driven by a named policy, and writes
// every event to a JSONL file plus a summary of win rate / damage / hit rate.
// Each battle's battle_start event records its seed and policies, so any
// single battle can be replayed.
//
// With --campaign each of --battles is a whole campaign instead: a new party
// sets out on a new world with the blight spreading, fights its nests,
// carrying its wounds and spending its levels, and marches on the Source when
// ready, until it beats it, falls, or loses the encampment. That is how
// scaling is judged; see the rules of scaling in CLAUDE.md.
//
// Usage: node scripts/simulate.ts [--battles 1000] [--out logs/battles.jsonl] [--seed 1] [--max-rounds 200]
//                                 [--player-policy aggressive] [--enemy-policy aggressive]
//                                 [--player-weapon iron_sword]
//                                 [--encounter goblin_raid] [--threat 1] [--party-level 1]
//                                 [--campaign] [--ready-level 7] [--parties 3]
import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'
import { mulberry32, randomSeed } from '../src/combat/rng.ts'
import { BattleEngine, type BattleEvent, type BattleSetup, type Side, type UnitId } from '../src/engine/battleEngine.ts'
import { POLICIES, isPolicyName, type PolicyName } from '../src/engine/policies.ts'
import { autoAdvance, levelUp } from '../src/character/progression.ts'
import { ENCOUNTERS, heroId, xpReward, type EncounterId } from '../src/game/encounters.ts'
import { PREROLLS, autoHeal, readyMadeParty, partyFighters, rewardVictory, type Party } from '../src/game/party.ts'
import { blightedShare, monsterStrength, type WorldEvent } from '../src/game/blight.ts'
import {
  OUTPOST_COST,
  SHRINE_COSTS,
  TOWER_COST,
  canAfford,
  canBuildOutpost,
  canBuildTower,
  raiseShrine,
} from '../src/game/buildings.ts'
import { WORKSHOP_COSTS, craft, craftRefusal, craftTier, highestGrade, upgradeWorkshop } from '../src/game/crafting.ts'
import { MAX_PARTIES, presenceOf, type DayAction, type Expedition } from '../src/game/expedition.ts'
import { newGame, partyById, type GameState } from '../src/game/gameState.ts'
import {
  GUILD_HALL_LEVELS,
  MAX_RESERVES,
  RECRUIT_COST,
  atGuildHall,
  company,
  companyLimit,
  homeParties,
  maxParties,
  partyLimit,
  recruit,
  recruitRefusal,
  toParty,
  upgradeCost,
  upgradeGuildHall,
} from '../src/game/guildHall.ts'
import { canCamp, partyWounded } from '../src/game/camp.ts'
import {
  advance,
  defaultPartyName,
  exchange,
  formParty,
  moveHero,
  orderAction,
  setOrder,
  startTravel,
  wipeParty,
  type DayReport,
  type ExchangeMove,
  type OrderRequest,
} from '../src/game/company.ts'
import { INFIRMARY_COSTS, raiseInfirmary } from '../src/game/infirmary.ts'
import { TRADING_POST_COSTS, buy, buyPrice, raiseTradingPost, salePrice, sell, sellMaterial, wares } from '../src/game/tradingPost.ts'
import { daysToFall, sites, type Material, type Stock } from '../src/game/territory.ts'
import {
  ENCAMPMENT_ID,
  clearLocation,
  encampment,
  monstersHere,
  worldActive,
  type MonsterLocation,
  type QuietLocation,
  type WorldState,
} from '../src/game/worldMap.ts'
import { hexDistance, hexEquals, type Hex } from '../src/grid/hex.ts'
import type { FamilyId } from '../src/inventory/catalog.ts'
import { GRADES, type Grade } from '../src/inventory/grades.ts'
import { baseItem, craftedItem, itemById, type EquipmentSlot, type Item } from '../src/inventory/inventory.ts'
import { MODIFIERS, type ModifierId } from '../src/inventory/modifiers.ts'
import { RANKS, pouchCount, pouchKeys, runeFits, runeKey, slotClass, socketsOf, type RuneId, type RuneKey, type SlotClass } from '../src/inventory/runes.ts'
import { clampHp, maxHp } from '../src/character/character.ts'
import { replaceAt, type ItemPlace } from '../src/game/itemPlace.ts'
import { takeRunes } from '../src/game/loot.ts'
import { embed, extract, extractCost, extractRefusal, fuse, fuseCost, fuseRefusal, embedCost } from '../src/game/runecraft.ts'
import { buyRune, buyRuneRefusal, runePrice, runeWares } from '../src/game/tradingPost.ts'

export interface CliArgs {
  /** How many battles to fight, or with `campaign` how many campaigns. */
  battles: number
  outPath: string
  seed: number | null
  maxRounds: number
  policies: Record<Side, PolicyName>
  /** The weapon every party member fights with, graded or modified if its id says so; null leaves the starting gear as it is. */
  playerWeapon: Item | null
  encounter: EncounterId
  /** How dangerous the encounter is made: 1 is the party's home country. */
  threat: number
  /** The level every party member is raised to before the battle, its skill points and perks spent (`autoAdvance`), at full hit points. */
  partyLevel: number
  /** Play whole campaigns over the world map instead of one encounter over and over. */
  campaign: boolean
  /** With `campaign`, the level every member must reach before the party marches on the Source, unless nothing else is left. */
  readyLevel: number
  /**
   * With `campaign`, how many parties the company may field (1 to `MAX_PARTIES`): a vanguard and the rest
   * home guards, formed at the guild hall once its level allows them (`HALL_FOR_PARTIES`).
   */
  parties: number
}


function positiveInt(flag: string, raw: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) throw new Error(`${flag} must be a positive integer, got "${raw}"`)
  return n
}

function policyName(flag: string, raw: string): PolicyName {
  if (!isPolicyName(raw)) throw new Error(`${flag} must be one of ${Object.keys(POLICIES).join(', ')}, got "${raw}"`)
  return raw
}

/** Any item that goes in the weapon hand, by any id `itemById` builds: graded and modified ones too. */
function weapon(flag: string, raw: string): Item {
  const item = itemById(raw)
  if (!item || item.slot !== 'mainHand') throw new Error(`${flag} must be the id of a weapon, such as iron_sword, yew_bow@2 or iron_sword+light1, got "${raw}"`)
  return item
}

function encounterId(flag: string, raw: string): EncounterId {
  if (!Object.hasOwn(ENCOUNTERS, raw)) throw new Error(`${flag} must be one of ${Object.keys(ENCOUNTERS).join(', ')}, got "${raw}"`)
  return raw as EncounterId
}

/** The flags that pick one battle to fight, which a campaign picks for itself. */
const SINGLE_BATTLE_FLAGS = ['--encounter', '--threat', '--party-level']

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    battles: 1000,
    outPath: 'logs/battles.jsonl',
    seed: null,
    maxRounds: 200,
    policies: { player: 'aggressive', enemy: 'aggressive' },
    playerWeapon: null,
    encounter: 'goblin_raid',
    threat: 1,
    partyLevel: 1,
    campaign: false,
    readyLevel: SOURCE_READY_LEVEL,
    parties: MAX_PARTIES,
  }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`Missing value for ${flag}`)
      return v
    }
    switch (flag) {
      case '--battles':
        args.battles = positiveInt(flag, value())
        break
      case '--out':
        args.outPath = value()
        break
      case '--seed':
        args.seed = Number(value())
        if (!Number.isInteger(args.seed)) throw new Error(`--seed must be an integer`)
        break
      case '--max-rounds':
        args.maxRounds = positiveInt(flag, value())
        break
      case '--player-policy':
        args.policies.player = policyName(flag, value())
        break
      case '--enemy-policy':
        args.policies.enemy = policyName(flag, value())
        break
      case '--player-weapon':
        args.playerWeapon = weapon(flag, value())
        break
      case '--encounter':
        args.encounter = encounterId(flag, value())
        break
      case '--threat':
        args.threat = positiveInt(flag, value())
        break
      case '--party-level':
        args.partyLevel = positiveInt(flag, value())
        break
      case '--campaign':
        args.campaign = true
        break
      case '--ready-level':
        args.readyLevel = positiveInt(flag, value())
        break
      case '--parties': {
        const raw = value()
        const n = Number(raw)
        if (!Number.isInteger(n) || n < 1 || n > MAX_PARTIES) throw new Error(`--parties must be from 1 to ${MAX_PARTIES}, got "${raw}"`)
        args.parties = n
        break
      }
      default:
        throw new Error(`Unknown argument: ${flag}`)
    }
  }
  const refused = SINGLE_BATTLE_FLAGS.filter((flag) => argv.includes(flag))
  if (args.campaign && refused.length > 0) {
    throw new Error(`${refused.join(', ')} cannot be used with --campaign, which fights each location at its own threat`)
  }
  if (!args.campaign && argv.includes('--ready-level')) {
    throw new Error('--ready-level applies only to --campaign, which marches on the Source when the party is ready')
  }
  if (!args.campaign && argv.includes('--parties')) {
    throw new Error('--parties applies only to --campaign, whose company fields its parties')
  }
  return args
}

export type LoggedEvent = BattleEvent & { battleId: number }

/** A new game's party, with the weapon the run asks for in every hand. */
function startingParty(args: CliArgs): Party {
  const party = readyMadeParty()
  if (args.playerWeapon) {
    for (const member of party) {
      const before = maxHp(member)
      member.equipment.mainHand = args.playerWeapon
      clampHp(member, before)
    }
  }
  return party
}

/** Fights one battle out with the run's policies, and returns the engine with its log complete. */
function fight(setup: BattleSetup, seed: number, party: Party, args: CliArgs, meta: Record<string, unknown>): BattleEngine {
  const engine = new BattleEngine(setup, {
    seed,
    meta: {
      source: 'simulate',
      policies: args.policies,
      // Each member's, in party order: the starting heroes do not all hold the same.
      playerWeapons: party.map((member) => member.equipment.mainHand?.id ?? null),
      ...meta,
    },
  })
  // Policies get their own stream so swapping one doesn't change the dice.
  const policyRng = mulberry32(seed ^ 0x9e3779b9)

  for (let state = engine.getState(); state.phase !== 'over'; state = engine.getState()) {
    // Aimless policies (e.g. random) can circle forever; log those as abandoned.
    if (state.round > args.maxRounds) {
      engine.abandon()
      break
    }
    const policy = POLICIES[args.policies[state.phase]]
    engine.step(policy({ state, legal: engine.legalActions(), rng: policyRng }))
  }
  return engine
}

function runBattle(battleId: number, seed: number, args: CliArgs): LoggedEvent[] {
  const party = startingParty(args)
  for (const member of party) {
    // Spent a level at a time, as a player would: a perk is chosen at the level that brings it.
    while (member.level < args.partyLevel) {
      levelUp(member)
      autoAdvance(member)
    }
  }
  const { setup } = ENCOUNTERS[args.encounter](partyFighters(party), args.threat)
  const meta = { encounter: args.encounter, threat: args.threat, partyLevel: args.partyLevel }
  return fight(setup, seed, party, args, meta).getLog().map((event) => ({ ...event, battleId }))
}

/** Seeds apart for the battles of one campaign: more than a campaign fights. */
export const CAMPAIGN_SEED_STEP = 1000

/** The days a campaign may last before it is called off. */
export const MAX_CAMPAIGN_DAYS = 2000
/** The level every member must reach before the party marches on the Source, unless nothing else is left. */
export const SOURCE_READY_LEVEL = 7

/** How a campaign ended: the Source beaten, the company fallen (no hero left), the encampment lost, or out of days (or of routes). */
export type CampaignOutcome = 'source' | 'fallen' | 'encampment' | 'timeout'

/** What a campaign did besides its battles. */
export interface CampaignRecord {
  outcome: CampaignOutcome
  /** The world turn it ended on. */
  days: number
  battles: number
  spawns: number
  captured: number
  lost: number
  /** The share of the map blighted or worse when it ended. */
  blighted: number
  /** Hit points restored by rest and spells between battles, and the days camped for them. */
  healedHp: number
  campDays: number
  /** Watchtowers built, and lost to the blight. */
  towersBuilt: number
  towersLost: number
  /** Heroes who fell in a won battle, gone for good; those of a wiped party are not counted (see `wipes`). */
  deaths: number
  /** Heroes hired at the guild hall, and its level at the end. */
  recruits: number
  hallLevel: number
  /** The shrine's level at the end, and the outposts built. */
  shrineLevel: number
  outpostsBuilt: number
  /** The trading post's, workshop's and infirmary's levels at the end. */
  tradingPostLevel: number
  workshopLevel: number
  infirmaryLevel: number
  /** Gold spent on gear at the trading post, and taken there for the baggage and surplus materials. */
  goldOnGear: number
  goldFromSales: number
  /** Tier-2 items bought. */
  tierTwoBought: number
  /** Items crafted, in the field and at the workshop, and the days the field crafts took. */
  crafted: number
  fieldCraftDays: number
  /** Runes taken as loot after wins, bought at the trading post, and made by fusing. */
  runesFound: number
  runesBought: number
  runesFused: number
  /** Runes sitting in the company's worn gear at the end, or as the last party fell. */
  socketsFilled: number
  /** Gold spent on runes: buying, fusing, embedding and extracting. */
  goldOnRunes: number
  /** Each member's level when the campaign ended. */
  finalLevels: number[]
  /** The level of each hero who died in a won battle, in the order they fell. */
  deathsAtLevel: number[]
  /** For 5, 10, 15 and 20: how many battles had been fought when the party's lowest level first reached it; absent if never. */
  battlesToLevel: Partial<Record<LevelMark, number>>
  /** By role: battles fought, battles lost (each a party wiped), and each party's member levels at the end, in list order. */
  roles: Record<Role, { battles: number; wipes: number; finalLevels: number[][] }>
  /** Parties wiped out in a lost battle, of any role. */
  wipes: number
  /** Heroes moved from a guard to the vanguard (step 10). */
  promotions: number
  /** Days the vanguard walked on its way home to the guild hall. */
  vanguardWalkHomeDays: number
  /** Battles fought by guards. */
  guardBattles: number
}

/** A party's part in the company: the vanguard marches on the nests and the Source, a guard keeps the land near home. */
export type Role = 'vanguard' | 'guard'

/** The levels a campaign's record notes the battles to. */
export const LEVEL_MARKS = [5, 10, 15, 20] as const
export type LevelMark = (typeof LEVEL_MARKS)[number]

export interface Campaign {
  battles: LoggedEvent[][]
  record: CampaignRecord
}

/**
 * The guild hall level the careful company raises the hall to, by `--parties`:
 * all that its parties use (level 3 for one party of five, 4 for a second
 * party, 5 for a third).
 */
export const HALL_FOR_PARTIES = [3, 4, 5] as const

/** The hall level a company of at most `parties` parties raises the hall to. */
export const hallCap = (parties: number): number => HALL_FOR_PARTIES[parties - 1]

/** The fewest heroes a new guard is formed with. */
export const GUARD_MIN_SIZE = 3

const lowestLevel = (party: Party) => Math.min(...party.map((member) => member.level))
const meanLevel = (party: Party) => party.reduce((sum, member) => sum + member.level, 0) / party.length

/** How many heroes a new guard could have now: the reserves and the recruits the stock affords and the hall has room for. */
function heroesForGuard(game: GameState): number {
  const { world } = game
  const affordable = Math.floor((world.stock.gold ?? 0) / (RECRUIT_COST.gold ?? 1))
  return game.reserves.length + Math.max(0, Math.min(affordable, companyLimit(world) - company(game).length))
}

/** Whether the hall could hire a recruit now, wherever the party stands: the stock affords one and the company and the reserves have room. */
function canHire(game: GameState): boolean {
  const { world } = game
  return canAfford(world.stock, RECRUIT_COST) && company(game).length < companyLimit(world) && game.reserves.length < MAX_RESERVES
}

/** Whether the company should form another party: the hall allows one, it fields fewer than `parties`, and a guard of `GUARD_MIN_SIZE` can be had. */
function guardWanted(game: GameState, parties: number): boolean {
  return game.parties.length < Math.min(parties, maxParties(game.world)) && heroesForGuard(game) >= GUARD_MIN_SIZE
}

/**
 * Whether the careful party should go home to the guild hall: to raise it,
 * once the stock affords the next level up to `hallCap(parties)` and no held
 * site is under threat; or to fill an empty place in the party when the stock
 * affords a recruit, unless `guarded` (the vanguard of a company with a guard,
 * whose places the guard fills by promotion). It never walks home only to
 * form a guard: `formGuard` forms one when the party is home for another
 * errand (stage 6 step 11 measured that walk as costing walking days for no
 * more wins).
 */
export function hallErrand(game: GameState, party: Expedition, parties = 1, guarded = false): boolean {
  const { world } = game
  const cost = world.guildHall < hallCap(parties) ? upgradeCost(world) : null
  if (cost && canAfford(world.stock, cost) && world.threatened.length === 0) return true
  return !guarded && party.members.length < partyLimit(world) && canAfford(world.stock, RECRUIT_COST)
}

/** Hires the next pre-roll into the reserves (renamed when the name is taken), the `at`th in turn, through party `party` at the hall; whether it did. */
function hire(game: GameState, party: Expedition, at: number): boolean {
  const taken = company(game).map((member) => member.name)
  const base = PREROLLS[at % PREROLLS.length].draft
  let name = base.name
  for (let n = 2; taken.includes(name); n++) name = `${base.name} ${n}`
  return recruit(game, party, { ...base, name }) === null
}

/**
 * At the guild hall: raises it as far as the stock allows, up to
 * `hallCap(parties)`, then fills the party's empty places with recruits, the
 * pre-rolls in turn (renamed when the name is taken), their points spent by
 * `autoAdvance`. Returns how many it hired.
 */
export function visitGuildHall(game: GameState, party: Expedition, parties = 1): number {
  while (game.world.guildHall < hallCap(parties) && upgradeGuildHall(game, party) === null);
  let hired = 0
  while (party.members.length < partyLimit(game.world) && recruitRefusal(game, party) === null) {
    if (!hire(game, party, party.members.length + game.reserves.length)) break
    toParty(game, party, game.reserves.length - 1)
    autoAdvance(party.members.at(-1)!)
    hired++
  }
  return hired
}

/**
 * At the guild hall, after `visitGuildHall`: forms a guard when the hall
 * allows another party, the company fields fewer than `parties` and at least
 * `GUARD_MIN_SIZE` heroes can be had: from the reserves first, then recruits
 * at the hall's level (the pre-rolls in turn), up to the party limit, each
 * spent by `autoAdvance`. Returns the new party and the recruits it took, or
 * null when it formed none.
 */
export function formGuard(game: GameState, parties: number): { party: Expedition; hired: number } | null {
  const { world } = game
  const at = homeParties(game)[0]
  if (!at || !guardWanted(game, parties)) return null
  let hired = 0
  const more = () => {
    if (!hire(game, at, company(game).length)) return false
    hired++
    return true
  }
  if (game.reserves.length === 0 && !more()) return null
  const formed = formParty(game, defaultPartyName(game), { from: 'reserves', index: 0 })
  if (typeof formed === 'string') throw new Error(`The guard could not be formed: ${formed}`)
  autoAdvance(formed.members[0])
  while (formed.members.length < partyLimit(world)) {
    if (game.reserves.length === 0 && !more()) break
    if (moveHero(game, { from: 'reserves', index: 0 }, { party: formed.id }) !== null) break
    autoAdvance(formed.members.at(-1)!)
  }
  return { party: formed, hired }
}

/** What a home visit or a field craft traded and made, for the campaign's record. */
export interface Trade {
  goldOnGear: number
  goldFromSales: number
  crafted: number
  /** Tier-2 items bought. */
  tierTwoBought: number
  /** Runes bought, fused and embedded, and the gold spent on them, extractions included. */
  runesBought: number
  runesFused: number
  runesEmbedded: number
  goldOnRunes: number
}

/**
 * The modifier the careful party wants on each plain item, best first: the
 * first of them the place makes is the one put on. Chosen by comparing one
 * cell of scaling (`--player-weapon <id> --encounter goblin_raid --threat 3
 * --party-level 5`) against the plain item; the field's modifiers come first
 * where the workshop's were no better.
 */
export const PREFERRED_MODIFIERS: Readonly<Partial<Record<FamilyId, readonly ModifierId[]>>> = {
  dagger: ['keen'],
  shortsword: ['keen', 'balanced'],
  longsword: ['light', 'balanced', 'keen'],
  battle_axe: ['light', 'bearded'],
  greatsword: ['balanced'],
  bow: ['recurve', 'long'],
  shield: ['braced'],
  breastplate: ['reinforced'],
}

/** The slots whose gear the careful party buys better grades of and crafts: its weapon, shield and armour. */
const GEAR_SLOTS: readonly EquipmentSlot[] = ['mainHand', 'offHand', 'armor']

/** How a modifier at a grade ranks for an item: lower is better; an item without one ranks last. */
function modifierRank(family: FamilyId | undefined, mod: { id: ModifierId; grade: Grade } | undefined): number {
  const preferred = (family && PREFERRED_MODIFIERS[family]) || []
  const at = mod ? preferred.indexOf(mod.id) : -1
  return at < 0 ? Infinity : at * 10 - mod!.grade
}

/**
 * Walks the crafts the careful party wants, in its order: every member's
 * weapon, shield and armour, the first preferred modifier unlocked where the
 * party stands, the grades best first, skipping any not better than what the
 * item has. `attempt` tries one and says whether it was made, which moves on
 * to the next piece; `done` stops the walk before the next piece.
 */
function eachWantedCraft(game: GameState, party: Expedition, done: () => boolean, attempt: (place: ItemPlace, modifier: ModifierId, grade: Grade) => boolean): void {
  const tier = craftTier(game.world, party)
  for (const [member, hero] of party.members.entries()) {
    for (const slot of GEAR_SLOTS) {
      const item = hero.equipment[slot]
      const base = item && baseItem(item)
      if (!item || !base || done()) continue
      for (const id of (base.family && PREFERRED_MODIFIERS[base.family]) || []) {
        const unlocked = MODIFIERS[id].unlock <= (tier === 'field' ? 0 : tier)
        if (!unlocked) continue
        for (const grade of [...GRADES].reverse()) {
          if (grade > highestGrade(tier) || modifierRank(base.family, { id, grade }) >= modifierRank(base.family, item.mod)) continue
          if (attempt({ from: 'worn', party: party.id, member, slot, itemId: item.id }, id, grade)) break
        }
        break
      }
    }
  }
}

/**
 * Crafts what the careful party wants on every member's weapon, shield and
 * armour that the place makes better than what it has: the first preferred
 * modifier unlocked here, at the best grade the stock affords. In the field
 * that is a day each, so it does `limit` at most. Returns how many it made and
 * the events of the days it took (none at a workshop), for the caller to tally.
 */
export function craftGear(game: GameState, party: Expedition, limit = Infinity): { crafted: number; events: WorldEvent[] } {
  let crafted = 0
  const events: WorldEvent[] = []
  eachWantedCraft(game, party, () => crafted >= limit, (place, id, grade) => {
    const result = craft(game, place, id, grade)
    if (result.refusal !== null) return false
    crafted++
    events.push(...result.events)
    return true
  })
  return { crafted, events }
}

/** The field craft `craftGear(game, party, 1)` would make, as a day's action, without making it; null if it would make none. */
export function fieldCraft(game: GameState, party: Expedition): Extract<DayAction, { kind: 'craft' }> | null {
  let action: Extract<DayAction, { kind: 'craft' }> | null = null
  eachWantedCraft(game, party, () => action !== null, (place, modifier, grade) => {
    if (craftRefusal(game, place, modifier, grade) !== null) return false
    action = { kind: 'craft', place, modifier, grade }
    return true
  })
  return action
}

/** What the stock should keep of each material for what the careful party still means to buy: every level left of every building, and a craft for each place in the party. */
export function materialNeeds(game: GameState, parties = 1): Stock {
  const { world } = game
  const needs: Stock = {}
  const add = (cost: Stock) => {
    for (const [material, amount] of Object.entries(cost)) needs[material as Material] = (needs[material as Material] ?? 0) + (amount ?? 0)
  }
  GUILD_HALL_LEVELS.slice(world.guildHall, hallCap(parties)).forEach(({ cost }) => add(cost))
  SHRINE_COSTS.slice(world.shrine).forEach(add)
  TRADING_POST_COSTS.slice(world.tradingPost).forEach(add)
  WORKSHOP_COSTS.slice(world.workshop).forEach(add)
  INFIRMARY_COSTS.slice(world.infirmary).forEach(add)
  add(TOWER_COST)
  add(OUTPOST_COST)
  for (const material of ['iron', 'timber', 'copper', 'crystal'] as const) add({ [material]: 5 * partyLimit(world) })
  return needs
}

/** The careful party's rune order by where the rune sits; the ward of the next ring's element waits for a ring of one element (stage 9). */
export const RUNE_ORDER: Record<SlotClass, readonly RuneId[]> = {
  weapon: ['ember', 'storm', 'stone'],
  shield: ['stone', 'life'],
  armour: ['stone', 'life'],
}

/** The rune of the pouch, less what is claimed, that the order puts in `item` next: the first kind that fits and is held, at the highest rank held. */
function nextRune(item: Item, kinds: readonly RuneId[], held: (key: RuneKey) => number): RuneKey | null {
  for (const id of kinds) {
    if (!runeFits(id, item)) continue
    for (const rank of [...RANKS].reverse()) if (held(runeKey(id, rank)) > 0) return runeKey(id, rank)
  }
  return null
}

/**
 * At a workshop: fuses every Lesser triple it may; buys, for each empty
 * socket of each member's weapon, shield and armour that the pouch cannot
 * fill, a Lesser rune of the first kind of `RUNE_ORDER` the post sells; then
 * embeds by `RUNE_ORDER`, a kind's highest rank first, until a socket is
 * refused. Nothing in the field: embedding there would cost days.
 */
export function runecraftGear(game: GameState, party: Expedition): { embedded: number; fused: number; bought: number; gold: number } {
  const done = { embedded: 0, fused: 0, bought: 0, gold: 0 }
  const { world } = game
  if (craftTier(world, party) === 'field') return done
  for (const key of pouchKeys(game.runes)) {
    if (!key.endsWith('1')) continue
    while (fuseRefusal(game, party, key) === null) {
      done.gold += fuseCost(key).gold ?? 0
      fuse(game, party, key)
      done.fused++
    }
  }
  const sold = runeWares(world)
  const claimed: Partial<Record<RuneKey, number>> = {}
  const unclaimed = (key: RuneKey) => pouchCount(game.runes, key) - (claimed[key] ?? 0)
  for (const hero of party.members) {
    for (const slot of GEAR_SLOTS) {
      const item = hero.equipment[slot]
      if (!item) continue
      const kinds = RUNE_ORDER[slotClass(slot)]
      for (let empty = socketsOf(item) - (item.runes?.length ?? 0); empty > 0; empty--) {
        let key = nextRune(item, kinds, unclaimed)
        if (!key) {
          const kind = kinds.find((id) => runeFits(id, item) && sold.includes(runeKey(id, 1)))
          if (!kind || buyRuneRefusal(game, party, runeKey(kind, 1)) !== null) continue
          key = runeKey(kind, 1)
          buyRune(game, party, key)
          done.bought++
          done.gold += runePrice(key)
        }
        claimed[key] = (claimed[key] ?? 0) + 1
      }
    }
  }
  for (const [member, hero] of party.members.entries()) {
    for (const slot of GEAR_SLOTS) {
      for (let item = hero.equipment[slot]; item && (item.runes?.length ?? 0) < socketsOf(item); item = hero.equipment[slot]) {
        const key = nextRune(item, RUNE_ORDER[slotClass(slot)], (k) => pouchCount(game.runes, k))
        if (!key || embed(game, { from: 'worn', party: party.id, member, slot, itemId: item.id }, key).refusal !== null) break
        done.embedded++
        done.gold += embedCost(key).gold ?? 0
      }
    }
  }
  return done
}

/**
 * At the encampment, after the guild hall: sells the baggage (the careful
 * party fights without loot, so all of it is surplus) and the materials
 * beyond `materialNeeds`; raises the trading post, the workshop and the
 * infirmary as the stock allows; buys each member the best grade it can of
 * its weapon, shield and armour, the old one sold (its runes taken out first
 * where the workshop can, else sold with it); fuses, buys and embeds runes (`runecraftGear`);
 * crafts the best it can on them (`craftGear`); and raises the shrine with
 * what is left.
 */
export function visitFacilities(game: GameState, party: Expedition, parties = 1): Trade {
  const { world } = game
  const trade: Trade = {
    goldOnGear: 0, goldFromSales: 0, crafted: 0, tierTwoBought: 0, runesBought: 0, runesFused: 0, runesEmbedded: 0, goldOnRunes: 0,
  }
  const gold = () => world.stock.gold ?? 0
  const sellAll = () => {
    while (party.baggage.length > 0) {
      trade.goldFromSales += salePrice(party.baggage[0])
      sell(game, { from: 'baggage', party: party.id, index: 0, itemId: party.baggage[0].id })
    }
  }
  sellAll()
  const needs = materialNeeds(game, parties)
  for (const [material, amount] of Object.entries(world.stock) as [Material, number][]) {
    const surplus = amount - (needs[material] ?? 0)
    const lots = surplus - (surplus % 2)
    if (material !== 'gold' && lots >= 2 && sellMaterial(game, party, material, lots) === null) trade.goldFromSales += lots / 2
  }
  while (raiseTradingPost(game, party) === null);
  while (upgradeWorkshop(game, party) === null);
  while (raiseInfirmary(game, party) === null);
  for (const [member, hero] of party.members.entries()) {
    for (const slot of GEAR_SLOTS) {
      const worn = hero.equipment[slot]
      const base = worn && baseItem(worn)
      if (!worn || !base) continue
      if (!worn.family) continue
      // The dearest item of the family the post sells that costs more than the worn one (modifier aside); a tie goes to the later, the higher tier or grade.
      const wornPrice = buyPrice(craftedItem(base, worn.grade ?? 1))!
      let bought: Item | undefined
      for (const candidate of wares(world, { family: worn.family })) {
        const price = buyPrice(candidate)!
        if (price > wornPrice && price <= gold() && (!bought || price >= buyPrice(bought)!)) bought = candidate
      }
      if (!bought || buy(game, party, bought.id) !== null) continue
      trade.goldOnGear += buyPrice(bought)!
      if (bought.tier === 2) trade.tierTwoBought += 1
      party.baggage.pop()
      // The old item's runes come back to the pouch where the workshop can take them out; any left are sold with it.
      for (let old = worn; old.runes?.length; old = hero.equipment[slot]!) {
        const place = { from: 'worn', party: party.id, member, slot, itemId: old.id } as const
        if (extractRefusal(game, place, 0) !== null) break
        trade.goldOnRunes += extractCost(old.runes[0]).gold ?? 0
        extract(game, place, 0)
      }
      const old = hero.equipment[slot]!
      replaceAt(game, { from: 'worn', party: party.id, member, slot, itemId: old.id }, bought)
      party.baggage.push(old)
    }
  }
  // What was replaced is sold before the runes and the crafts, which the gold may pay for.
  sellAll()
  const runes = runecraftGear(game, party)
  trade.runesBought += runes.bought
  trade.runesFused += runes.fused
  trade.runesEmbedded += runes.embedded
  trade.goldOnRunes += runes.gold
  // Without a workshop, crafting here would be the field's, a day each: that waits for the road.
  if (craftTier(world, party) !== 'field') trade.crafted += craftGear(game, party).crafted
  while (raiseShrine(world, party) === null);
  return trade
}

/** How far the careful party goes out of its way, after a win, to put an outpost on a held site. */
export const OUTPOST_ERRAND_RADIUS = 6

/**
 * The held site the careful party should build an outpost on after a win: the
 * nearest within `OUTPOST_ERRAND_RADIUS` that has none, when the stock affords
 * one; the encampment has its shrine instead.
 */
export function outpostErrand(world: WorldState, party: Expedition): QuietLocation | null {
  if (!canAfford(world.stock, OUTPOST_COST)) return null
  const near = sites(world).filter(
    (site) =>
      site.id !== ENCAMPMENT_ID &&
      world.held.includes(site.id) &&
      !world.outposts.includes(site.id) &&
      hexDistance(site.position, party.position) <= OUTPOST_ERRAND_RADIUS,
  )
  if (near.length === 0) return null
  return near.reduce((a, b) => (hexDistance(party.position, b.position) < hexDistance(party.position, a.position) ? b : a))
}

/**
 * Where a careful party goes next. First the nest pushing hardest on the held
 * site nearest to falling, if the party is up to its threat; then the nearest
 * nest it is up to (a threat no higher than its lowest level), or the nearest
 * of all if none; and the Source once every member has `readyLevel`
 * (`SOURCE_READY_LEVEL` unless told otherwise) or nothing else is left.
 */
export function nextTarget(world: WorldState, party: Expedition, readyLevel = SOURCE_READY_LEVEL, taken: ReadonlySet<string> = new Set()): MonsterLocation | null {
  const members = party.members
  const all = world.locations.filter((l): l is MonsterLocation => l.kind === 'monsters')
  const source = all.find((l) => l.source) ?? null
  const every = all.filter((l) => !l.source)
  if (source && (every.length === 0 || lowestLevel(members) >= readyLevel)) return source
  // The nests a guard is after are left to it, unless they are all that is left.
  const free = every.filter((l) => !taken.has(l.id))
  const nests = free.length > 0 ? free : every
  const upTo = nests.filter((l) => l.threat <= Math.max(1, lowestLevel(members)))
  const threatened = sites(world)
    .filter((site) => world.threatened.includes(site.id))
    .map((site) => ({ site, days: daysToFall(world, [presenceOf(party)], site) ?? Infinity }))
    .sort((a, b) => a.days - b.days)
  for (const { site } of threatened) {
    const push = (l: MonsterLocation) => monsterStrength(l) - hexDistance(l.position, site.position)
    const pushing = upTo.filter((l) => push(l) > 0)
    if (pushing.length > 0) return pushing.reduce((a, b) => (push(b) > push(a) ? b : a))
  }
  const pool = upTo.length > 0 ? upTo : nests
  if (pool.length === 0) return null
  return pool.reduce((a, b) => (hexDistance(party.position, b.position) < hexDistance(party.position, a.position) ? b : a))
}

/**
 * Where a party stands in the careful party's round, which runs: home to the
 * guild hall when there is a hall errand (`home`), the hall's and facilities'
 * errands there (`hall`), the walk to the next target (`target`), the battle
 * (`fight`, then `won`), a watchtower (`tower`), the outpost errand
 * (`outpost`, then `build` once there), a field craft (`craft`, then
 * `crafted`), camping until healed (`heal`, casting the party's heals, then
 * `camp`, the camp order), and back to the top (`start`). A guard's round
 * (`decideGuard`) chooses at `start` and walks in its choice's phase
 * (`reinforce`, `defend`, `train`, `garrison`, or `return` home, then `idle`
 * there), sharing the vanguard's from `fight` to `camp`.
 */
export type Phase =
  | 'start'
  | 'reinforce'
  | 'defend'
  | 'train'
  | 'garrison'
  | 'return'
  | 'idle'
  | 'home'
  | 'hall'
  | 'choose'
  | 'target'
  | 'fight'
  | 'won'
  | 'tower'
  | 'outpost'
  | 'build'
  | 'craft'
  | 'crafted'
  | 'heal'
  | 'camp'

/** A party's place in the round, and what it is walking to. */
export interface Plan {
  phase: Phase
  /** Where the walk of a walking phase (`home`, `target`, `build`) is going. */
  to: Hex | null
  /** The nest or the Source it is walking to and fights. */
  target: MonsterLocation | null
  /** Whether the walk's last order got the party nowhere: no way there, or a nest on the road's first hex. */
  stalled: boolean
  /** The order whose days the next `advance` runs for it, if any. */
  running: 'travel' | 'camp' | 'day' | 'meet' | null
  /** A guard's: the held site it garrisons or walks to garrison. */
  site: string | null
  /** A guard's: reinforcing was refused (a meet or an exchange), so it takes its next priority until days pass. */
  skipReinforce: boolean
  /** A guard's: it promoted a hero and goes home before anything else. */
  recall: boolean
  /** A guard's: the day it last ran the hall's errands, and last waited on monsters, so neither repeats within a day. */
  hallDay: number
  waitDay: number
}

export function newPlan(): Plan {
  return { phase: 'start', to: null, target: null, stalled: false, running: null, site: null, skipReinforce: false, recall: false, hallDay: -1, waitDay: -1 }
}

/** What the policy has a party do next. */
export type Decision =
  | { kind: 'finish'; outcome: CampaignOutcome }
  /** At the guild hall: `visitGuildHall`, then `visitFacilities`; no time passes. */
  | { kind: 'hall' }
  /** Fight the target it confronts. */
  | { kind: 'fight'; target: MonsterLocation }
  /** A standing order, whose days `advance` runs (none for idle or garrison). */
  | { kind: 'order'; order: OrderRequest }
  /** A guard's: its highest-level hero joins the vanguard on its hex (`exchange`). */
  | { kind: 'promote' }
  /** A guard's: it stands as it is (idle, or garrisoned) while the days run. */
  | { kind: 'stand' }
  /** A one-day action. */
  | { kind: 'act'; action: DayAction }
  /** One craft: at a workshop `craftGear` with a limit of 1, at once; in the field the one it would make (`fieldCraft`), a day's act. */
  | { kind: 'craft' }
  /** Cast the party's heals (`autoHeal`); no time passes. */
  | { kind: 'heal' }

/** A campaign under way: the game, what it has fought and recorded, and each party's plan by id. */
export interface CampaignRun {
  campaign: number
  seed: number
  args: CliArgs
  firstBattleId: number
  game: GameState
  battles: LoggedEvent[][]
  record: CampaignRecord
  plans: Map<string, Plan>
  /** The vanguard's party id: the party that marches on the nests and the Source, whose levels the record ends with. */
  vanguard: string
  /** Each party's role, by id; `vanguard` is the one truth for which party is the vanguard. */
  roles: Map<string, Role>
}

/** Party `party`'s role in the run, a guard's for a party the run has no role for. */
export function roleOf(run: CampaignRun, party: Expedition): Role {
  return run.roles.get(party.id) ?? 'guard'
}

/** Makes party `id` the vanguard, the one it replaces a guard. */
export function setVanguard(run: CampaignRun, id: string): void {
  if (run.roles.get(run.vanguard) === 'vanguard') run.roles.set(run.vanguard, 'guard')
  run.vanguard = id
  run.roles.set(id, 'vanguard')
}

/** A campaign about to begin, from a new game of the run's party unless one is given. */
export function startCampaign(campaign: number, seed: number, args: CliArgs, firstBattleId = 0, game = newGame(startingParty(args), null, seed)): CampaignRun {
  const record: CampaignRecord = {
    outcome: 'timeout', days: 0, battles: 0, spawns: 0, captured: 0, lost: 0, blighted: 0, healedHp: 0, campDays: 0,
    towersBuilt: 0, towersLost: 0, deaths: 0, recruits: 0, hallLevel: 1, shrineLevel: 0, outpostsBuilt: 0,
    tradingPostLevel: 1, workshopLevel: 0, infirmaryLevel: 0, goldOnGear: 0, goldFromSales: 0, tierTwoBought: 0, crafted: 0, fieldCraftDays: 0,
    runesFound: 0, runesBought: 0, runesFused: 0, socketsFilled: 0, goldOnRunes: 0,
    finalLevels: [], deathsAtLevel: [], battlesToLevel: {},
    roles: { vanguard: { battles: 0, wipes: 0, finalLevels: [] }, guard: { battles: 0, wipes: 0, finalLevels: [] } },
    wipes: 0, promotions: 0, vanguardWalkHomeDays: 0, guardBattles: 0,
  }
  const vanguard = game.parties[0].id
  const roles = new Map<string, Role>(game.parties.map((party) => [party.id, party.id === vanguard ? 'vanguard' : 'guard']))
  return { campaign, seed, args, firstBattleId, game, battles: [], record, plans: new Map(game.parties.map((party) => [party.id, newPlan()])), vanguard, roles }
}

/** The plan of party `party`, a new one if it has none yet. */
export function planOf(run: CampaignRun, party: Expedition): Plan {
  let plan = run.plans.get(party.id)
  if (!plan) run.plans.set(party.id, (plan = newPlan()))
  return plan
}

/** Starts a walk to `to` in the plan's next phase. */
function walk(plan: Plan, phase: Phase, to: Hex): void {
  plan.phase = phase
  plan.to = to
  plan.stalled = false
}

/**
 * Where a walk stands: arrived (true), given up (false: its last order got
 * nowhere, the game is over or the days are out), or `'go'`, a fresh travel
 * order wanted, planned from where the party stands.
 */
function walking(world: WorldState, party: Expedition, plan: Plan): boolean | 'go' {
  if (plan.stalled) return false
  if (hexEquals(party.position, plan.to!)) return true
  if (!worldActive(world) || world.turn > MAX_CAMPAIGN_DAYS) return false
  return 'go'
}

/**
 * The careful party's policy: what `party` does next, moving its plan on
 * through the phases that need nothing done. Asked whenever the party is idle
 * or its order was cut short; a walk cut short is ordered again to the same
 * hex, and a camp cut short casts the party's heals again before its next
 * camp order, as calling `travel` and `campUntilHealed` again did.
 */
export function decide(run: CampaignRun, party: Expedition): Decision {
  const { game, args } = run
  const { world } = game
  const plan = planOf(run, party)
  const finish = (outcome: CampaignOutcome): Decision => ({ kind: 'finish', outcome })
  for (;;) {
    switch (plan.phase) {
      case 'start': {
        if (world.status === 'lost') return finish('encampment')
        if (world.turn > MAX_CAMPAIGN_DAYS) return finish('timeout')
        // A guard made the vanguard may come upon the nest it was walking to: that it fights first.
        const facing = world.locations.find((l): l is MonsterLocation => l.kind === 'monsters' && l.id === party.confronting)
        if (facing) {
          plan.target = facing
          walk(plan, 'target', facing.position)
          continue
        }
        const home = world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
        const guarded = game.parties.some((p) => p !== party && roleOf(run, p) === 'guard')
        if (hallErrand(game, party, args.parties, guarded) && !hexEquals(party.position, home)) walk(plan, 'home', home)
        else plan.phase = 'hall'
        continue
      }
      case 'home': {
        const walked = walking(world, party, plan)
        if (walked === 'go') return { kind: 'order', order: { kind: 'travel', to: plan.to! } }
        if (!walked) return finish(worldActive(world) ? 'timeout' : 'encampment')
        plan.phase = 'hall'
        continue
      }
      case 'hall':
        // Done at once, whatever brought the party home.
        plan.phase = 'choose'
        if (atGuildHall(world, party)) return { kind: 'hall' }
        continue
      case 'choose': {
        const next = nextTarget(world, party, args.readyLevel, takenTargets(run, party))
        if (!next) return finish('timeout')
        plan.target = next
        walk(plan, 'target', next.position)
        continue
      }
      case 'target': {
        // A guard may have beaten it first: the party chooses again.
        if (plan.target && !world.locations.some((l) => l.id === plan.target!.id)) {
          plan.phase = 'choose'
          continue
        }
        // The journey stops for what happens on the way; the careful party takes note and goes on.
        const walked = walking(world, party, plan)
        if (walked === 'go') return { kind: 'order', order: { kind: 'travel', to: plan.to! } }
        if (!worldActive(world)) return finish('encampment')
        if (!walked) return finish('timeout')
        plan.phase = 'fight'
        continue
      }
      default: {
        const next = afterBattle(world, party, plan)
        if (next) return next
        continue
      }
    }
  }
}

/**
 * One step of the round the vanguard and a guard share, from the battle to
 * camping until healed (`fight` to `camp`): the decision it makes, or null
 * when the plan moved on with nothing to do (to `start` at its end).
 */
function afterBattle(world: WorldState, party: Expedition, plan: Plan): Decision | null {
  const finish = (outcome: CampaignOutcome): Decision => ({ kind: 'finish', outcome })
  for (;;) {
    switch (plan.phase) {
      case 'fight':
        plan.phase = 'won'
        return { kind: 'fight', target: plan.target! }
      case 'won':
        if (world.status === 'won') return finish('source')
        plan.phase = 'tower'
        continue
      case 'tower':
        // A watchtower wherever the party stops on land that takes one and the stock affords it.
        plan.phase = 'outpost'
        if (canBuildTower(world, party) === null) return { kind: 'act', action: { kind: 'tower' } }
        continue
      case 'outpost': {
        // An outpost on a held site nearby, if the stock affords one; the party camps there.
        const site = outpostErrand(world, party)
        if (site) walk(plan, 'build', site.position)
        else plan.phase = 'craft'
        continue
      }
      case 'build': {
        const walked = walking(world, party, plan)
        if (walked === 'go') return { kind: 'order', order: { kind: 'travel', to: plan.to! } }
        plan.phase = 'craft'
        if (walked && canBuildOutpost(world, party) === null) return { kind: 'act', action: { kind: 'outpost' } }
        continue
      }
      case 'craft':
        // A field craft on one piece of gear the stock affords, a day's work.
        plan.phase = 'crafted'
        if (canCamp(world, party)) return { kind: 'craft' }
        continue
      case 'crafted':
        if (!worldActive(world)) return finish('encampment')
        plan.phase = 'heal'
        continue
      case 'heal':
        if (partyWounded(party.members) && canCamp(world, party)) {
          plan.phase = 'camp'
          return { kind: 'heal' }
        }
        plan.phase = 'start'
        return null
      case 'camp':
        // Whole after the cast, it camps no day and stands under no order.
        plan.phase = 'heal'
        return { kind: 'order', order: partyWounded(party.members) ? { kind: 'camp' } : { kind: 'idle' } }
      default:
        throw new Error(`Not a phase after a battle: ${plan.phase}`)
    }
  }
}

/** The nests the other parties' plans are after (a cleared one is gone from the map, and so harmless). */
export function takenTargets(run: CampaignRun, party: Expedition): Set<string> {
  const taken = new Set<string>()
  for (const other of run.game.parties) {
    const target = other === party ? null : run.plans.get(other.id)?.target
    if (target) taken.add(target.id)
  }
  return taken
}

/** The held sites the other parties garrison or walk to garrison. */
function takenSites(run: CampaignRun, party: Expedition): Set<string> {
  const taken = new Set<string>()
  for (const other of run.game.parties) {
    const site = other === party ? null : run.plans.get(other.id)?.site
    if (site) taken.add(site)
  }
  return taken
}

/** What a guard means to do, by its priorities (decision 16). */
export type GuardChoice =
  | { kind: 'reinforce' }
  | { kind: 'defend'; target: MonsterLocation }
  | { kind: 'train'; target: MonsterLocation }
  | { kind: 'garrison'; site: QuietLocation }
  | { kind: 'home' }

/** How many levels a guard's best must outrank a full vanguard's lowest by for the two to swap (decision 16 as amended by the user). */
export const SWAP_LEVELS = 2

/**
 * Whether `guard` can reinforce `vanguard`: by joining it, when the vanguard
 * is under the party limit and the guard has two heroes or more, one within 3
 * levels of the vanguard's lowest; or by a swap, when the vanguard is full and
 * the guard's best outranks its lowest by `SWAP_LEVELS` or more.
 */
export function canReinforce(world: WorldState, guard: Expedition, vanguard: Expedition): boolean {
  const lowest = lowestLevel(vanguard.members)
  if (vanguard.members.length >= partyLimit(world)) return guard.members[promotedIndex(guard)].level >= lowest + SWAP_LEVELS
  if (guard.members.length < 2) return false
  return guard.members.some((member) => member.level >= lowest - 3)
}

/** The guard's hero a promotion sends to the vanguard: the highest level, the first on a tie. */
export function promotedIndex(guard: Expedition): number {
  return guard.members.reduce((best, member, i) => (member.level > guard.members[best].level ? i : best), 0)
}

/** The vanguard's hero a swap sends to the guard: the lowest level, the first on a tie. */
export function weakestIndex(party: Expedition): number {
  return party.members.reduce((worst, member, i) => (member.level < party.members[worst].level ? i : worst), 0)
}

/** Ties go to the lower location id. */
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * A guard's choice, in order (decision 16): reinforce the vanguard, by
 * meeting it; defend the threatened held site nearest to falling from the
 * nest pushing hardest on it; train on the nearest nest; garrison the
 * threatened held resource site with the fewest days to fall; else go home.
 * Only nests of a threat no higher than the guard's lowest level (at least 1),
 * never the Source, and none another party's plan is after; no site another
 * guard garrisons. Back home first after a promotion, and home to refill
 * when worn below `GUARD_MIN_SIZE` while a recruit can be had.
 */
export function guardChoice(run: CampaignRun, party: Expedition): GuardChoice {
  const { world } = run.game
  const plan = planOf(run, party)
  if (plan.recall) return { kind: 'home' }
  const vanguard = partyById(run.game, run.vanguard)
  if (!plan.skipReinforce && vanguard && vanguard !== party && canReinforce(world, party, vanguard)) return { kind: 'reinforce' }
  // Worn below a guard's smallest size, it goes home to refill while a recruit can be had.
  if (party.members.length < GUARD_MIN_SIZE && canHire(run.game)) return { kind: 'home' }
  const level = Math.max(1, lowestLevel(party.members))
  const taken = takenTargets(run, party)
  const nests = world.locations
    .filter((l): l is MonsterLocation => l.kind === 'monsters' && !l.source && l.threat <= level && !taken.has(l.id))
    .sort(byId)
  const threatened = sites(world)
    .filter((site) => world.threatened.includes(site.id) && world.held.includes(site.id))
    .map((site) => ({ site, days: daysToFall(world, [presenceOf(party)], site) ?? Infinity }))
    .sort((a, b) => a.days - b.days || byId(a.site, b.site))
  for (const { site } of threatened) {
    const push = (l: MonsterLocation) => monsterStrength(l) - hexDistance(l.position, site.position)
    const pushing = nests.filter((l) => push(l) > 0)
    if (pushing.length > 0) return { kind: 'defend', target: pushing.reduce((a, b) => (push(b) > push(a) ? b : a)) }
  }
  if (nests.length > 0) {
    const distance = (l: MonsterLocation) => hexDistance(party.position, l.position)
    return { kind: 'train', target: nests.reduce((a, b) => (distance(b) < distance(a) ? b : a)) }
  }
  const held = takenSites(run, party)
  const garrison = threatened.find(({ site }) => site.kind !== 'encampment' && !held.has(site.id))
  if (garrison) return { kind: 'garrison', site: garrison.site }
  return { kind: 'home' }
}

/**
 * A guard's policy (decision 16), over the same plan and decisions as the
 * vanguard's: asked whenever it is idle, garrisoned, or its order was cut
 * short, it answers monsters it confronts (fights a nest it is up to and no
 * one else is after, else waits a day), then makes its choice afresh
 * (`guardChoice`) and goes on with it: meets the vanguard and promotes a hero
 * on its hex; walks to a nest and fights it, then the vanguard's round after
 * a battle; walks to a site and garrisons it; or goes home, where it runs the
 * hall's errands on arrival and whenever there is a hall errand, and stands
 * idle. A walk that gets nowhere stands for the days, to choose again.
 */
export function decideGuard(run: CampaignRun, party: Expedition): Decision {
  const { game, args } = run
  const { world } = game
  const plan = planOf(run, party)
  const stand = (): Decision => {
    plan.phase = 'start'
    plan.target = null
    plan.site = null
    return { kind: 'stand' }
  }
  for (;;) {
    if (AFTER_BATTLE.has(plan.phase)) {
      const next = afterBattle(world, party, plan)
      if (next) return next
      continue
    }
    if (world.status === 'lost') return { kind: 'finish', outcome: 'encampment' }
    if (!worldActive(world)) return { kind: 'finish', outcome: 'source' }
    if (world.turn > MAX_CAMPAIGN_DAYS) return { kind: 'finish', outcome: 'timeout' }
    if (party.confronting !== null) {
      const here = world.locations.find((l): l is MonsterLocation => l.id === party.confronting && l.kind === 'monsters')
      const vanguard = partyById(game, run.vanguard)
      const withVanguard = vanguard && vanguard !== party && hexEquals(vanguard.position, party.position)
      if (withVanguard && !plan.skipReinforce && !plan.recall && canReinforce(world, party, vanguard)) return { kind: 'promote' }
      if (here && !withVanguard && !here.source && here.threat <= Math.max(1, lowestLevel(party.members)) && !takenTargets(run, party).has(here.id)) {
        plan.target = here
        plan.site = null
        plan.phase = 'fight'
        continue
      }
      // Not its to fight: it waits a day, and walks off after.
      if (plan.waitDay === world.turn) return stand()
      plan.waitDay = world.turn
      return { kind: 'act', action: { kind: 'wait' } }
    }
    const choice = guardChoice(run, party)
    switch (choice.kind) {
      case 'reinforce': {
        plan.phase = 'reinforce'
        plan.target = null
        plan.site = null
        const vanguard = partyById(game, run.vanguard)!
        if (hexEquals(vanguard.position, party.position)) return { kind: 'promote' }
        return { kind: 'order', order: { kind: 'meet', party: vanguard.id } }
      }
      case 'defend':
      case 'train': {
        if (plan.phase !== choice.kind || plan.target?.id !== choice.target.id) {
          walk(plan, choice.kind, choice.target.position)
          plan.target = choice.target
          plan.site = null
        }
        const walked = walking(world, party, plan)
        if (walked === 'go') return { kind: 'order', order: { kind: 'travel', to: plan.to! } }
        if (!walked) return stand()
        plan.phase = 'fight'
        continue
      }
      case 'garrison': {
        if (plan.phase !== 'garrison' || plan.site !== choice.site.id) {
          walk(plan, 'garrison', choice.site.position)
          plan.target = null
          plan.site = choice.site.id
        }
        const walked = walking(world, party, plan)
        if (walked === 'go') return { kind: 'order', order: { kind: 'travel', to: plan.to! } }
        if (!walked) return stand()
        if (party.order.kind === 'garrison') return { kind: 'stand' }
        return { kind: 'order', order: { kind: 'garrison' } }
      }
      case 'home': {
        const home = encampment(world).position
        plan.target = null
        plan.site = null
        if (!hexEquals(party.position, home)) {
          if (plan.phase !== 'return') walk(plan, 'return', home)
          if (walking(world, party, plan) === 'go') return { kind: 'order', order: { kind: 'home' } }
          return stand()
        }
        // Home: the hall's errands on arrival, and again when there is one, once a day at most.
        const arrived = plan.phase !== 'idle'
        plan.phase = 'idle'
        plan.recall = false
        if (plan.hallDay !== world.turn && (arrived || hallErrand(game, party, args.parties))) {
          plan.hallDay = world.turn
          return { kind: 'hall' }
        }
        return { kind: 'stand' }
      }
    }
  }
}

/** The phases from the battle to camping until healed, which the vanguard and a guard share (`afterBattle`). */
const AFTER_BATTLE: ReadonlySet<Phase> = new Set(['fight', 'won', 'tower', 'outpost', 'build', 'craft', 'crafted', 'heal', 'camp'])

/** Sums what a stretch of days brought into the record: the world's events counted by `tally`. */
function tally(record: CampaignRecord, events: readonly WorldEvent[]): void {
  for (const event of events) {
    if (event.type === 'spawned') record.spawns++
    if (event.type === 'site_captured') record.captured++
    if (event.type === 'site_lost') record.lost++
    if (event.type === 'tower_built') record.towersBuilt++
    if (event.type === 'tower_lost') record.towersLost++
    if (event.type === 'outpost_built') record.outpostsBuilt++
  }
}

/**
 * Fights `target`, which the party confronts: the battle logged, and on a win
 * the party's wounds, rewards and runes taken and the location cleared
 * (`'won'`). A battle not won wipes the party out (`wipeParty`, its gear and
 * baggage left on the location): `'fallen'` when no hero is left in the
 * company, else `'wiped'`, the campaign going on without it.
 */
function fightAt(run: CampaignRun, party: Expedition, target: MonsterLocation): 'won' | 'wiped' | 'fallen' {
  const { game, record, battles } = run
  const members = party.members
  const role = roleOf(run, party)
  const encounter = ENCOUNTERS[target.encounter](partyFighters(members), target.threat)
  const meta = {
    campaign: run.campaign,
    location: target.id,
    encounter: target.encounter,
    threat: target.threat,
    day: game.world.turn,
    partyLevels: members.map((member) => member.level),
    party: party.id,
    role,
  }
  const battleId = run.firstBattleId + battles.length
  const battleSeed = (run.seed + battles.length) >>> 0
  const engine = fight(encounter.setup, battleSeed, members, run.args, meta)
  battles.push(engine.getLog().map((event) => ({ ...event, battleId })))
  record.roles[role].battles++
  if (role === 'guard') record.guardBattles++

  const state = engine.getState()
  if (state.winner !== 'player') return wipe(run, party, target)
  // The party's wounds and mana left are its own from here on, as BattleScene makes them.
  members.forEach((member, i) => {
    const unit = state.units.find((u) => u.id === heroId(i))!
    member.hp = unit.hp
    member.mana = unit.mana
  })
  const { dead } = rewardVictory(members, xpReward(encounter), party.baggage)
  record.deaths += dead.length
  // The fallen are buried before the experience is given, so each keeps the level it died at.
  record.deathsAtLevel.push(...dead.map((member) => member.level))
  for (const member of members) autoAdvance(member)
  for (const mark of LEVEL_MARKS) {
    if (record.battlesToLevel[mark] === undefined && lowestLevel(members) >= mark) record.battlesToLevel[mark] = battles.length
  }
  record.runesFound += takeRunes(game, target.threat, target.encounter, battleSeed).length
  clearLocation(game, target.id)
  return 'won'
}

/**
 * Party `party`, beaten at `target`, is wiped out (`wipeParty`) and leaves the
 * run: its plan and role go. The vanguard's levels as it fell are the record's
 * until another vanguard ends the campaign, and if the vanguard was wiped the
 * company's first party (or the one the reserves formed) takes its place.
 */
function wipe(run: CampaignRun, party: Expedition, target: MonsterLocation): 'wiped' | 'fallen' {
  const { game, record } = run
  const role = roleOf(run, party)
  record.wipes++
  record.roles[role].wipes++
  if (role === 'vanguard') record.finalLevels = party.members.map((member) => member.level)
  // Counted before the wipe takes the party's gear, so a fallen company's sockets are those it fell with.
  const sockets = socketsFilled(game.parties)
  const { lost, reformed } = wipeParty(game, party.id, target)
  run.plans.delete(party.id)
  run.roles.delete(party.id)
  if (lost) {
    record.socketsFilled = sockets
    return 'fallen'
  }
  if (role === 'vanguard') {
    // The party the reserves formed, as the only one left; else the strongest left takes the lead, its round begun afresh.
    const next = reformed ?? strongestParty(game.parties)
    setVanguard(run, next.id)
    const plan = newPlan()
    // A guard that stands before the nest it walked to fights it first, as the vanguard's round would.
    const facing = game.world.locations.find((l): l is MonsterLocation => l.kind === 'monsters' && l.id === next.confronting)
    if (facing) Object.assign(plan, { phase: 'target', to: { ...facing.position }, target: facing })
    // Its walk was a guard's: it stops, to be asked at once as the vanguard.
    else setOrder(game, next.id, { kind: 'idle' })
    run.plans.set(next.id, plan)
  }
  return 'wiped'
}

/** The strongest of `parties`: the highest lowest level, then the highest mean level, then the lowest id. */
export function strongestParty(parties: readonly Expedition[]): Expedition {
  const better = (a: Expedition, b: Expedition) =>
    lowestLevel(b.members) - lowestLevel(a.members) || meanLevel(b.members) - meanLevel(a.members) || (b.id < a.id ? 1 : -1)
  return parties.reduce((best, party) => (better(best, party) > 0 ? party : best))
}

/** The runes in the worn gear of every member of `parties`. */
function socketsFilled(parties: readonly Expedition[]): number {
  return parties.flatMap((party) => party.members).reduce((n, member) => n + Object.values(member.equipment).reduce((m, item) => m + (item?.runes?.length ?? 0), 0), 0)
}

/**
 * Carries out a decision for `party`: an errand or a day's act at once, or an
 * order given for `advance` to run. Returns the outcome when the campaign
 * ends, `'standing'` when the party now holds an order whose days are to run,
 * else null, to be asked again.
 */
export function carryOut(run: CampaignRun, party: Expedition, decision: Decision): CampaignOutcome | 'standing' | null {
  const { game, record } = run
  const { world } = game
  const plan = planOf(run, party)
  plan.running = null
  switch (decision.kind) {
    case 'finish':
      return decision.outcome
    case 'hall': {
      record.recruits += visitGuildHall(game, party, run.args.parties)
      // Then a guard, or two, where the hall allows them and the company can man them.
      for (let formed; (formed = formGuard(game, run.args.parties)); ) {
        record.recruits += formed.hired
        run.roles.set(formed.party.id, 'guard')
        run.plans.set(formed.party.id, newPlan())
      }
      const trade = visitFacilities(game, party, run.args.parties)
      record.goldOnGear += trade.goldOnGear
      record.goldFromSales += trade.goldFromSales
      record.tierTwoBought += trade.tierTwoBought
      record.crafted += trade.crafted
      record.runesBought += trade.runesBought
      record.runesFused += trade.runesFused
      record.goldOnRunes += trade.goldOnRunes
      return null
    }
    case 'fight': {
      const result = fightAt(run, party, decision.target)
      // A wiped party is gone, with nothing more to ask of it.
      return result === 'won' ? null : result === 'wiped' ? 'standing' : 'fallen'
    }
    case 'act':
      // A day order, whose day the next `advance` runs with every other party's.
      if (orderAction(game, party.id, decision.action) !== null) return null
      plan.running = 'day'
      return 'standing'
    case 'craft': {
      if (craftTier(world, party) !== 'field') {
        record.crafted += craftGear(game, party, 1).crafted
        return null
      }
      const action = fieldCraft(game, party)
      if (!action || orderAction(game, party.id, action) !== null) return null
      plan.running = 'day'
      return 'standing'
    }
    case 'heal':
      record.healedHp += autoHeal(party.members)
      return null
    case 'promote': {
      const vanguard = partyById(game, run.vanguard)
      // Into an empty place, or, the vanguard full, in place of its weakest, who joins the guard.
      const move: ExchangeMove | null = !vanguard || vanguard === party ? null
        : vanguard.members.length >= partyLimit(world) ? { kind: 'swap', a: promotedIndex(party), b: weakestIndex(vanguard) }
        : { kind: 'member', from: party.id, index: promotedIndex(party) }
      const moved = move ? exchange(game, party.id, vanguard!.id, [move]) : 'No vanguard.'
      plan.phase = 'start'
      if (moved !== null) {
        // Refused (the vanguard full by now, or one of them facing monsters): the guard takes its next priority.
        plan.skipReinforce = true
        return null
      }
      record.promotions++
      plan.recall = true
      return null
    }
    case 'stand':
      if (party.order.kind !== 'garrison') setOrder(game, party.id, { kind: 'idle' })
      return 'standing'
    case 'order': {
      const { order } = decision
      switch (order.kind) {
        case 'idle':
          setOrder(game, party.id, order)
          return null
        case 'camp':
          setOrder(game, party.id, order)
          plan.running = 'camp'
          return 'standing'
        case 'garrison':
          if (setOrder(game, party.id, order) !== null) {
            plan.stalled = true
            return null
          }
          return 'standing'
        case 'meet':
          if (setOrder(game, party.id, order) !== null) {
            plan.skipReinforce = true
            return null
          }
          plan.running = 'meet'
          return 'standing'
        case 'home':
          if (setOrder(game, party.id, order) !== null) {
            plan.stalled = true
            return null
          }
          plan.running = 'travel'
          return 'standing'
        case 'travel':
          // A fresh route from where the party stands; one that cannot start (no way there, or a nest on its first hex) gets it nowhere.
          if (startTravel(game, party, order.to) !== 'started') {
            plan.stalled = true
            return null
          }
          plan.running = 'travel'
          return 'standing'
      }
    }
  }
}

/**
 * Takes in the days `advance` ran: the events tallied, and each running
 * order's walk, camp or day's craft recorded on its party. A day any party
 * camped counts once in `campDays`; healing from every party counts,
 * including natural healing while idle or garrisoned.
 */
export function takeDays(run: CampaignRun, reports: readonly DayReport[]): void {
  const { game, record } = run
  for (const report of reports) tally(record, report.events)
  if (game.parties.some((party) => planOf(run, party).running === 'camp')) record.campDays += reports.length
  for (const party of game.parties) {
    const plan = planOf(run, party)
    const days = reports.map((report) => report.parties.find((day) => day.party === party.id))
    if (reports.length > 0) plan.skipReinforce = false
    if (plan.running === 'travel') {
      // Stopped a hex short of monsters another party stands on, it waits for them: not stalled.
      plan.stalled = !days.some((day) => day?.walked) && !besideOthersMonsters(game, party)
      if (party.id === run.vanguard && plan.phase === 'home') record.vanguardWalkHomeDays += days.filter((day) => day?.walked).length
      party.confronting = monstersHere(game.world, party)?.id ?? null
    }
    for (const day of days) record.healedHp += (day?.rested ?? 0) + (day?.cast ?? 0)
    if (plan.running === 'day') {
      // A field craft made is a day in the field; the simulator embeds only at the workshop.
      const made = days.filter((day) => day?.made).length
      record.crafted += made
      record.fieldCraftDays += made
    }
  }
}

/** Whether another party stands on monsters beside `party`, as a walk stops a hex short of them. */
function besideOthersMonsters(game: GameState, party: Expedition): boolean {
  return game.parties.some((other) => other !== party && hexDistance(other.position, party.position) === 1 && monstersHere(game.world, other) !== null)
}

/**
 * Whether `party` is to be asked again after the days `advance` ran: it is
 * idle, or what stopped the days concerns it or every party; and a garrisoned
 * guard always, so that it answers a threatened site or a weakened vanguard.
 */
export function needsDecision(run: CampaignRun, party: Expedition, last: DayReport | undefined): boolean {
  if (party.order.kind === 'idle' || !last || !worldActive(run.game.world)) return true
  if (party.order.kind === 'garrison' && roleOf(run, party) === 'guard') return true
  return !last.interrupt || last.interrupt.party === null || last.interrupt.party === party.id
}

/** The days `advance` runs at most when no party holds an order whose days run (all garrisoned or idle), to ask them again. */
export const IDLE_DAYS = 10

/** How many days the next `advance` may run: until an interrupt while some party walks, meets, camps or has a day's act; else `IDLE_DAYS`. */
export function advanceLimit(game: GameState): number {
  return game.parties.some((party) => party.order.kind !== 'idle' && party.order.kind !== 'garrison') ? Infinity : IDLE_DAYS
}

/** The campaign's record filled in at its end: the vanguard's levels (as it fell, if it was wiped), each role's, and the sockets of every party. */
export function finishCampaign(run: CampaignRun, outcome: CampaignOutcome): Campaign {
  const { game, record, battles } = run
  const { world } = game
  const vanguard = game.parties.find((party) => party.id === run.vanguard)
  record.outcome = outcome
  record.days = world.turn
  record.battles = battles.length
  record.blighted = blightedShare(world)
  record.hallLevel = world.guildHall
  record.shrineLevel = world.shrine
  record.tradingPostLevel = world.tradingPost
  record.workshopLevel = world.workshop
  record.infirmaryLevel = world.infirmary
  if (vanguard) record.finalLevels = vanguard.members.map((member) => member.level)
  for (const role of ['vanguard', 'guard'] as const) {
    record.roles[role].finalLevels = game.parties.filter((party) => roleOf(run, party) === role).map((party) => party.members.map((member) => member.level))
  }
  // A fallen company's were counted as its last party fell (`wipe`).
  if (game.parties.length > 0) record.socketsFilled = socketsFilled(game.parties)
  return { battles, record }
}

/**
 * Plays one campaign and returns each battle's events, in the order fought,
 * with a record of the rest. A new party sets out from the encampment of a
 * new world (seeded with the campaign's seed) and goes where `nextTarget`
 * sends it, each nest at its own threat. Its days run on the company's day
 * loop (company.ts): the policy (`decide`) gives the party its next order,
 * errand or day's act whenever it is idle or its order was cut short, and
 * `advance` runs the orders' days, the blight going on. It carries its hit
 * points from battle to battle, takes `rewardVictory` after each win and
 * spends what that brought with `autoAdvance`, and camps where it won until
 * its wounds are healed, again whenever an event breaks camp. The campaign
 * ends when the Source is beaten, a battle is not won, the encampment falls,
 * or `MAX_CAMPAIGN_DAYS` pass. Item loot is left alone: the heroes keep their
 * starting gear, bettered at the trading post and by crafting; rune loot is
 * taken after each win (`takeRunes`) and embedded at the workshop.
 */
export function runCampaign(campaign: number, seed: number, args: CliArgs, firstBattleId = 0): Campaign {
  const run = startCampaign(campaign, seed, args, firstBattleId)
  let last: DayReport | undefined
  for (;;) {
    const round = playRound(run, last)
    if (!Array.isArray(round)) return finishCampaign(run, round)
    last = round.at(-1)
  }
}

/**
 * One round of the campaign: each party asked once, in list order (a party a
 * wipe or the hall formed included, a wiped one left out), if it needs a
 * decision (`needsDecision`), the vanguard by `decide` and a guard by
 * `decideGuard`, until it stands under an order; then the days `advance`
 * runs (`advanceLimit`), taken in. Returns those days, or how the campaign ended.
 */
export function playRound(run: CampaignRun, last: DayReport | undefined): DayReport[] | CampaignOutcome {
  const { game } = run
  const asked = new Set<Expedition>()
  for (let party; (party = game.parties.find((p) => !asked.has(p))); ) {
    asked.add(party)
    if (!needsDecision(run, party, last)) continue
    for (;;) {
      const policy = roleOf(run, party) === 'guard' ? decideGuard : decide
      const done = carryOut(run, party, policy(run, party))
      if (done === 'standing') break
      if (done !== null) return done
    }
  }
  const reports = advance(game, advanceLimit(game))
  takeDays(run, reports)
  return reports
}

export interface Summary {
  battles: number
  playerWins: number
  enemyWins: number
  /** Battles abandoned at --max-rounds. */
  unresolved: number
  /** Rounds per decided battle; battles counted under `unresolved` are left out. */
  avgRounds: number
  avgPlayerDamageDealt: number
  avgEnemyDamageDealt: number
  playerHitRate: number
  enemyHitRate: number
  playerCritRate: number
  enemyCritRate: number
  /** Free attacks provoked by leaving a zone of control, per battle. */
  avgOpportunityAttacks: number
  /** Attacks on a defender's side or rear arc, given its facing, per battle. */
  avgSideAttacks: number
  avgRearAttacks: number
  /** Spells cast, per battle. A spell's damage counts in the damage dealt, and so does a status's damage, to the side it hurt the foes of; the hit and critical rates are of weapon attacks only. */
  avgPlayerCasts: number
  avgEnemyCasts: number
  /** Area abilities used, per battle. Their damage counts in the damage dealt by the user's side, and their statuses in its statuses laid. */
  avgPlayerAreaAttacks: number
  avgEnemyAreaAttacks: number
  /** Hit points restored by spells in battle, a drain's included, per battle, by the caster's side. */
  avgPlayerHealing: number
  avgEnemyHealing: number
  /** Statuses laid by spells and area abilities, per battle, by the caster's or user's side. */
  avgPlayerStatuses: number
  avgEnemyStatuses: number
}

/** Adds up what `summarize` reports, an event at a time, so a long run need not be held in memory. */
class Tally {
  private playerWins = 0
  private enemyWins = 0
  private totalRounds = 0
  private damage: Record<Side, number> = { player: 0, enemy: 0 }
  private attacks: Record<Side, number> = { player: 0, enemy: 0 }
  private hits: Record<Side, number> = { player: 0, enemy: 0 }
  private crits: Record<Side, number> = { player: 0, enemy: 0 }
  private casts: Record<Side, number> = { player: 0, enemy: 0 }
  private areaAttacks: Record<Side, number> = { player: 0, enemy: 0 }
  private healing: Record<Side, number> = { player: 0, enemy: 0 }
  private statuses: Record<Side, number> = { player: 0, enemy: 0 }
  private opportunityAttacks = 0
  private sideAttacks = 0
  private rearAttacks = 0
  // Attacks and casts name units; each battle's battle_start says which side they're on.
  private sideOf = new Map<UnitId, Side>()

  add(event: BattleEvent): void {
    if (event.type === 'battle_start') this.sideOf = new Map(event.units.map((u) => [u.id, u.side]))
    if (event.type === 'battle_end' && event.winner) {
      this.totalRounds += event.round
      if (event.winner === 'player') this.playerWins++
      else this.enemyWins++
    }
    if (event.type === 'attack') {
      if (event.opportunity) this.opportunityAttacks++
      if (event.arc === 'side') this.sideAttacks++
      if (event.arc === 'rear') this.rearAttacks++
      const side = this.sideOf.get(event.attacker) === 'player' ? 'player' : 'enemy'
      this.attacks[side]++
      // The weapon's damage, then its on-hit damage, heal and statuses (runes).
      this.damage[side] += event.damage
      for (const bonus of event.bonus) this.damage[side] += bonus.damage
      this.healing[side] += event.healed ?? 0
      this.statuses[side] += event.onHitStatuses?.length ?? 0
      if (event.hit) this.hits[side]++
      if (event.critical) this.crits[side]++
    }
    if (event.type === 'cast') {
      const side = this.sideOf.get(event.caster) === 'player' ? 'player' : 'enemy'
      this.casts[side]++
      this.healing[side] += event.drained
      for (const outcome of event.outcomes) {
        this.damage[side] += outcome.damage
        this.healing[side] += outcome.healed
        if (outcome.status) this.statuses[side]++
      }
    }
    if (event.type === 'ability') {
      const side = this.sideOf.get(event.unit) === 'player' ? 'player' : 'enemy'
      this.areaAttacks[side]++
      for (const outcome of event.outcomes) {
        this.damage[side] += outcome.damage
        if (outcome.status) this.statuses[side]++
      }
    }
    if (event.type === 'status_tick') {
      this.damage[this.sideOf.get(event.unit) === 'player' ? 'enemy' : 'player'] += event.damage
    }
  }

  summary(battles: number): Summary {
    const decided = this.playerWins + this.enemyWins
    const rate = (count: number, of: number) => (of ? count / of : 0)
    return {
      battles,
      playerWins: this.playerWins,
      enemyWins: this.enemyWins,
      unresolved: battles - decided,
      avgRounds: rate(this.totalRounds, decided),
      avgPlayerDamageDealt: this.damage.player / battles,
      avgEnemyDamageDealt: this.damage.enemy / battles,
      playerHitRate: rate(this.hits.player, this.attacks.player),
      enemyHitRate: rate(this.hits.enemy, this.attacks.enemy),
      playerCritRate: rate(this.crits.player, this.attacks.player),
      enemyCritRate: rate(this.crits.enemy, this.attacks.enemy),
      avgOpportunityAttacks: this.opportunityAttacks / battles,
      avgSideAttacks: this.sideAttacks / battles,
      avgRearAttacks: this.rearAttacks / battles,
      avgPlayerCasts: this.casts.player / battles,
      avgEnemyCasts: this.casts.enemy / battles,
      avgPlayerAreaAttacks: this.areaAttacks.player / battles,
      avgEnemyAreaAttacks: this.areaAttacks.enemy / battles,
      avgPlayerHealing: this.healing.player / battles,
      avgEnemyHealing: this.healing.enemy / battles,
      avgPlayerStatuses: this.statuses.player / battles,
      avgEnemyStatuses: this.statuses.enemy / battles,
    }
  }
}

export function summarize(events: readonly LoggedEvent[], battles: number): Summary {
  const tally = new Tally()
  for (const event of events) tally.add(event)
  return tally.summary(battles)
}

/** How the battles at one threat went, over every campaign of a run. */
export interface ThreatRow {
  threat: number
  battles: number
  won: number
  winRate: number
}

export interface CampaignSummary {
  campaigns: number
  /** How many campaigns ended each way. */
  outcomes: Record<CampaignOutcome, number>
  /** The share that beat the Source: the measure the game is tuned by. */
  sourceShare: number
  avgDays: number
  avgSpawns: number
  avgCaptured: number
  avgLost: number
  avgBlighted: number
  avgBattles: number
  avgHealedHp: number
  avgCampDays: number
  avgTowersBuilt: number
  avgTowersLost: number
  avgRecruits: number
  avgDeaths: number
  avgHallLevel: number
  avgShrineLevel: number
  avgOutpostsBuilt: number
  avgTradingPostLevel: number
  avgWorkshopLevel: number
  avgInfirmaryLevel: number
  avgGoldOnGear: number
  avgTierTwoBought: number
  avgGoldFromSales: number
  avgCrafted: number
  avgFieldCraftDays: number
  /** Runes found, bought and fused, sockets filled at the end, and gold on runes, a campaign. */
  avgRunesFound: number
  avgRunesBought: number
  avgRunesFused: number
  avgSocketsFilled: number
  avgGoldOnRunes: number
  /** The party's lowest and highest level at the end, on average; a campaign with no one left is left out. */
  avgLowestFinalLevel: number
  avgHighestFinalLevel: number
  /** How many heroes died at each level, in rising level; only the levels some hero died at. */
  deathsByLevel: Array<{ level: number; deaths: number }>
  /** For each mark, how many campaigns' lowest level reached it and the battles that took on average over those (0 if none did). */
  toLevel: Array<{ level: LevelMark; campaigns: number; avgBattles: number }>
  /** In rising order of threat; a threat no campaign reached has no row. */
  byThreat: ThreatRow[]
  /** Parties wiped, heroes promoted to the vanguard, the vanguard's days walking home and the guards' battles, a campaign. */
  avgWipes: number
  avgPromotions: number
  avgVanguardWalkHomeDays: number
  avgGuardBattles: number
  /** How many campaigns ended with the guild hall at level 4 or more (a second party allowed), and at 5 (a third). */
  hallFour: number
  hallFive: number
  /** By role: battles and wipes a campaign, and the lowest and highest level of its parties at the end, over the campaigns that ended with one. */
  roles: Record<Role, RoleSummary>
}

export interface RoleSummary {
  avgBattles: number
  avgWipes: number
  /** The campaigns that ended with a party of the role, which the levels are averaged over. */
  campaigns: number
  avgLowestFinalLevel: number
  avgHighestFinalLevel: number
}

/** Adds up the battles at each threat, an event at a time. */
class ThreatTally {
  private threats = new Map<number, { battles: number; won: number }>()
  private threat = 0

  add(event: BattleEvent): void {
    if (event.type === 'battle_start') {
      this.threat = Number(event.meta.threat ?? 0)
      const row = this.threats.get(this.threat) ?? { battles: 0, won: 0 }
      row.battles++
      this.threats.set(this.threat, row)
    }
    if (event.type === 'battle_end' && event.winner === 'player') this.threats.get(this.threat)!.won++
  }

  rows(): ThreatRow[] {
    return [...this.threats.entries()]
      .sort(([a], [b]) => a - b)
      .map(([threat, row]) => ({ threat, ...row, winRate: row.won / row.battles }))
  }
}

export function summarizeCampaigns(events: readonly LoggedEvent[], records: readonly CampaignRecord[]): CampaignSummary {
  const threats = new ThreatTally()
  for (const event of events) threats.add(event)
  const campaigns = records.length
  const avg = (of: (record: CampaignRecord) => number) => records.reduce((sum, r) => sum + of(r), 0) / campaigns
  const outcomes: Record<CampaignOutcome, number> = { source: 0, fallen: 0, encampment: 0, timeout: 0 }
  for (const record of records) outcomes[record.outcome]++
  const mean = (values: readonly number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0)
  const ended = records.filter((r) => r.finalLevels.length > 0)
  const deaths = new Map<number, number>()
  for (const level of records.flatMap((r) => r.deathsAtLevel)) deaths.set(level, (deaths.get(level) ?? 0) + 1)
  const toLevel = LEVEL_MARKS.map((level) => {
    const reached = records.flatMap((r) => r.battlesToLevel[level] ?? [])
    return { level, campaigns: reached.length, avgBattles: mean(reached) }
  })
  return {
    campaigns,
    outcomes,
    sourceShare: outcomes.source / campaigns,
    avgDays: avg((r) => r.days),
    avgSpawns: avg((r) => r.spawns),
    avgCaptured: avg((r) => r.captured),
    avgLost: avg((r) => r.lost),
    avgBlighted: avg((r) => r.blighted),
    avgBattles: avg((r) => r.battles),
    avgHealedHp: avg((r) => r.healedHp),
    avgCampDays: avg((r) => r.campDays),
    avgTowersBuilt: avg((r) => r.towersBuilt),
    avgTowersLost: avg((r) => r.towersLost),
    avgRecruits: avg((r) => r.recruits),
    avgDeaths: avg((r) => r.deaths),
    avgHallLevel: avg((r) => r.hallLevel),
    avgShrineLevel: avg((r) => r.shrineLevel),
    avgOutpostsBuilt: avg((r) => r.outpostsBuilt),
    avgTradingPostLevel: avg((r) => r.tradingPostLevel),
    avgWorkshopLevel: avg((r) => r.workshopLevel),
    avgInfirmaryLevel: avg((r) => r.infirmaryLevel),
    avgGoldOnGear: avg((r) => r.goldOnGear),
    avgTierTwoBought: avg((r) => r.tierTwoBought),
    avgGoldFromSales: avg((r) => r.goldFromSales),
    avgCrafted: avg((r) => r.crafted),
    avgFieldCraftDays: avg((r) => r.fieldCraftDays),
    avgRunesFound: avg((r) => r.runesFound),
    avgRunesBought: avg((r) => r.runesBought),
    avgRunesFused: avg((r) => r.runesFused),
    avgSocketsFilled: avg((r) => r.socketsFilled),
    avgGoldOnRunes: avg((r) => r.goldOnRunes),
    avgLowestFinalLevel: mean(ended.map((r) => Math.min(...r.finalLevels))),
    avgHighestFinalLevel: mean(ended.map((r) => Math.max(...r.finalLevels))),
    deathsByLevel: [...deaths.entries()].sort(([a], [b]) => a - b).map(([level, deaths]) => ({ level, deaths })),
    toLevel,
    byThreat: threats.rows(),
    avgWipes: avg((r) => r.wipes),
    avgPromotions: avg((r) => r.promotions),
    avgVanguardWalkHomeDays: avg((r) => r.vanguardWalkHomeDays),
    avgGuardBattles: avg((r) => r.guardBattles),
    hallFour: records.filter((r) => r.hallLevel >= 4).length,
    hallFive: records.filter((r) => r.hallLevel >= 5).length,
    roles: { vanguard: roleSummary('vanguard'), guard: roleSummary('guard') },
  }

  function roleSummary(role: Role): RoleSummary {
    const levels = records.map((r) => r.roles[role].finalLevels.flat()).filter((l) => l.length > 0)
    return {
      avgBattles: avg((r) => r.roles[role].battles),
      avgWipes: avg((r) => r.roles[role].wipes),
      campaigns: levels.length,
      avgLowestFinalLevel: mean(levels.map((l) => Math.min(...l))),
      avgHighestFinalLevel: mean(levels.map((l) => Math.max(...l))),
    }
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const baseSeed = args.seed ?? randomSeed()
  const tally = new Tally()
  const threats = new ThreatTally()
  const records: CampaignRecord[] = []

  // Written a battle at a time: a run of campaigns is too long to hold in memory.
  mkdirSync(dirname(args.outPath), { recursive: true })
  const out = openSync(args.outPath, 'w')
  let battles = 0
  const log = (events: readonly LoggedEvent[]) => {
    battles++
    writeSync(out, events.map((event) => JSON.stringify(event)).join('\n') + '\n')
    for (const event of events) {
      tally.add(event)
      threats.add(event)
    }
  }
  for (let run = 0; run < args.battles; run++) {
    if (args.campaign) {
      const { battles: fought, record } = runCampaign(run, (baseSeed + run * CAMPAIGN_SEED_STEP) >>> 0, args, battles)
      fought.forEach(log)
      records.push(record)
    } else log(runBattle(run, (baseSeed + run) >>> 0, args))
  }
  closeSync(out)

  const versus = `seed ${baseSeed}, player ${args.policies.player} vs enemy ${args.policies.enemy}`
  if (!args.campaign) {
    console.log(
      `Simulated ${args.battles} battles of ${args.encounter} at threat ${args.threat}, party level ${args.partyLevel} (${versus}) -> ${args.outPath}`,
    )
    console.table(tally.summary(battles))
    return
  }
  // The battles were tallied as they were written; the records hold the rest.
  const summary = { ...summarizeCampaigns([], records), byThreat: threats.rows() }
  const { outcomes } = summary
  const pct = (n: number) => `${((n / summary.campaigns) * 100).toFixed(1)}%`
  console.log(`Simulated ${args.battles} campaigns, ${battles} battles in all (${versus}) -> ${args.outPath}`)
  console.log(
    `Beat the Source: ${outcomes.source} of ${summary.campaigns} (${pct(outcomes.source)}); party fell: ${outcomes.fallen} (${pct(outcomes.fallen)}); encampment lost: ${outcomes.encampment} (${pct(outcomes.encampment)}); out of days: ${outcomes.timeout}`,
  )
  console.log(
    `A campaign: ${summary.avgDays.toFixed(0)} days, ${summary.avgBattles.toFixed(1)} battles, ${summary.avgSpawns.toFixed(1)} spawns, ${summary.avgCaptured.toFixed(1)} sites captured and ${summary.avgLost.toFixed(1)} lost, ${(summary.avgBlighted * 100).toFixed(0)}% of the land blighted at the end`,
  )
  console.log(`Watchtowers: ${summary.avgTowersBuilt.toFixed(1)} built a campaign, ${summary.avgTowersLost.toFixed(1)} lost`)
  console.log(`Shrine: level ${summary.avgShrineLevel.toFixed(1)} at the end; outposts: ${summary.avgOutpostsBuilt.toFixed(1)} built a campaign`)
  console.log(
    `Trading post, workshop, infirmary: levels ${summary.avgTradingPostLevel.toFixed(1)}, ${summary.avgWorkshopLevel.toFixed(1)}, ${summary.avgInfirmaryLevel.toFixed(1)} at the end; ${summary.avgGoldOnGear.toFixed(0)} gold on gear and ${summary.avgGoldFromSales.toFixed(0)} from sales, ${summary.avgCrafted.toFixed(1)} items crafted (${summary.avgFieldCraftDays.toFixed(1)} days in the field) a campaign`,
  )
  console.log(`Tier-2 items bought: ${summary.avgTierTwoBought.toFixed(1)} a campaign`)
  console.log(
    `Runes: ${summary.avgRunesFound.toFixed(1)} found, ${summary.avgRunesBought.toFixed(1)} bought and ${summary.avgRunesFused.toFixed(1)} fused a campaign, ${summary.avgGoldOnRunes.toFixed(0)} gold on runes; ${summary.avgSocketsFilled.toFixed(1)} sockets filled at the end`,
  )
  console.log(
    `Guild hall: level ${summary.avgHallLevel.toFixed(1)} at the end, ${summary.avgRecruits.toFixed(1)} recruits and ${summary.avgDeaths.toFixed(1)} heroes dead in battles won (a wiped party's not counted) a campaign`,
  )
  console.log(
    `Hit points healed between battles: ${summary.avgHealedHp.toFixed(1)} a campaign, in ${summary.avgCampDays.toFixed(1)} days of camping`,
  )
  const diedAt = summary.deathsByLevel.length > 0 ? summary.deathsByLevel.map(({ level, deaths }) => `${level} (${deaths})`).join(', ') : 'none'
  console.log(
    `Levels at the end (the vanguard's, or as the company fell): lowest ${summary.avgLowestFinalLevel.toFixed(1)}, highest ${summary.avgHighestFinalLevel.toFixed(1)} on average (ready level ${args.readyLevel}); heroes died at level ${diedAt}`,
  )
  console.log(
    `Battles to level ${summary.toLevel.map(({ level, campaigns, avgBattles }) => `${level}: ${campaigns > 0 ? avgBattles.toFixed(1) : '—'} (${campaigns} campaigns)`).join('; ')}`,
  )
  console.log(
    `Company (${args.parties} ${args.parties === 1 ? 'party' : 'parties'} allowed, the hall raised to ${hallCap(args.parties)} at most): ${summary.avgWipes.toFixed(1)} parties wiped, ${summary.avgPromotions.toFixed(1)} promotions, ${summary.avgVanguardWalkHomeDays.toFixed(1)} days the vanguard walked home and ${summary.avgGuardBattles.toFixed(1)} guard battles a campaign; the hall at level 4 or more at the end in ${summary.hallFour} campaigns, 5 in ${summary.hallFive}`,
  )
  for (const role of ['vanguard', 'guard'] as const) {
    const r = summary.roles[role]
    console.log(
      `${role === 'vanguard' ? 'Vanguard' : 'Guards'}: ${r.avgBattles.toFixed(1)} battles and ${r.avgWipes.toFixed(1)} wipes a campaign; levels at the end, over the ${r.campaigns} campaigns ending with ${role === 'vanguard' ? 'a vanguard' : 'a guard'}, lowest ${r.avgLowestFinalLevel.toFixed(1)}, highest ${r.avgHighestFinalLevel.toFixed(1)}`,
    )
  }
  console.table(summary.byThreat.map((row) => ({ ...row, winRate: Number(row.winRate.toFixed(3)) })))
  console.table(tally.summary(battles))
}

if (import.meta.main) main()
