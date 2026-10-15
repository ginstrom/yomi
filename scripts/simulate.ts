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
//                                 [--campaign]
import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'
import { mulberry32, randomSeed } from '../src/combat/rng.ts'
import { BattleEngine, type BattleEvent, type BattleSetup, type Side, type UnitId } from '../src/engine/battleEngine.ts'
import { POLICIES, isPolicyName, type PolicyName } from '../src/engine/policies.ts'
import { autoAdvance, levelUp } from '../src/character/progression.ts'
import { ENCOUNTERS, heroId, xpReward, type EncounterId } from '../src/game/encounters.ts'
import { PREROLLS, readyMadeParty, partyFighters, rewardVictory, type Party } from '../src/game/party.ts'
import { blightedShare, monsterStrength, type WorldEvent } from '../src/game/blight.ts'
import { buildTower, canAfford, canBuildTower } from '../src/game/buildings.ts'
import { newGame, type GameState } from '../src/game/gameState.ts'
import {
  RECRUIT_COST,
  atGuildHall,
  partyLimit,
  recruit,
  recruitRefusal,
  toParty,
  upgradeCost,
  upgradeGuildHall,
} from '../src/game/guildHall.ts'
import { campUntilHealed, canCamp, partyWounded } from '../src/game/camp.ts'
import { daysToFall, sites } from '../src/game/territory.ts'
import {
  ENCAMPMENT_ID,
  clearLocation,
  travel,
  worldActive,
  type MonsterLocation,
  type WorldState,
} from '../src/game/worldMap.ts'
import { hexDistance, hexEquals, type Hex } from '../src/grid/hex.ts'
import { MAGIC_ITEMS, WEAPONS, type Item } from '../src/inventory/inventory.ts'

export interface CliArgs {
  /** How many battles to fight, or with `campaign` how many campaigns. */
  battles: number
  outPath: string
  seed: number | null
  maxRounds: number
  policies: Record<Side, PolicyName>
  /** The weapon every party member fights with; null leaves the starting gear as it is. */
  playerWeapon: Item | null
  encounter: EncounterId
  /** How dangerous the encounter is made: 1 is the party's home country. */
  threat: number
  /** The level every party member is raised to before the battle, its skill points and perks spent (`autoAdvance`), at full hit points. */
  partyLevel: number
  /** Play whole campaigns over the world map instead of one encounter over and over. */
  campaign: boolean
}

/** Every item that goes in the weapon hand, the enchanted ones included. */
const HAND_WEAPONS: readonly Item[] = [...WEAPONS, ...MAGIC_ITEMS.filter((item) => item.slot === 'mainHand')]

function positiveInt(flag: string, raw: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) throw new Error(`${flag} must be a positive integer, got "${raw}"`)
  return n
}

function policyName(flag: string, raw: string): PolicyName {
  if (!isPolicyName(raw)) throw new Error(`${flag} must be one of ${Object.keys(POLICIES).join(', ')}, got "${raw}"`)
  return raw
}

function weapon(flag: string, raw: string): Item {
  const item = HAND_WEAPONS.find((w) => w.id === raw)
  if (!item) throw new Error(`${flag} must be one of ${HAND_WEAPONS.map((w) => w.id).join(', ')}, got "${raw}"`)
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
      default:
        throw new Error(`Unknown argument: ${flag}`)
    }
  }
  const refused = SINGLE_BATTLE_FLAGS.filter((flag) => argv.includes(flag))
  if (args.campaign && refused.length > 0) {
    throw new Error(`${refused.join(', ')} cannot be used with --campaign, which fights each location at its own threat`)
  }
  return args
}

export type LoggedEvent = BattleEvent & { battleId: number }

/** A new game's party, with the weapon the run asks for in every hand. */
function startingParty(args: CliArgs): Party {
  const party = readyMadeParty()
  if (args.playerWeapon) for (const member of party) member.equipment.mainHand = args.playerWeapon
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
const CAMPAIGN_SEED_STEP = 1000

/** The days a campaign may last before it is called off. */
export const MAX_CAMPAIGN_DAYS = 2000
/** The level every member must reach before the party marches on the Source, unless nothing else is left. */
export const SOURCE_READY_LEVEL = 7

/** How a campaign ended: the Source beaten, the party fallen, the encampment lost, or out of days (or of routes). */
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
  /** Heroes hired at the guild hall, and its level at the end. */
  recruits: number
  hallLevel: number
}

export interface Campaign {
  battles: LoggedEvent[][]
  record: CampaignRecord
}

const lowestLevel = (party: Party) => Math.min(...party.map((member) => member.level))

/**
 * Whether the careful party should go home to the guild hall: to raise it,
 * once the stock affords the next level and no held site is under threat, or
 * to fill an empty place in the party when the stock affords a recruit.
 */
export function hallErrand(game: GameState): boolean {
  const { world } = game
  const cost = upgradeCost(world)
  if (cost && canAfford(world.stock, cost) && world.threatened.length === 0) return true
  return game.party.length < partyLimit(world) && canAfford(world.stock, RECRUIT_COST)
}

/**
 * At the guild hall: raises it as far as the stock allows, then fills the
 * party's empty places with recruits, the pre-rolls in turn (renamed when the
 * name is taken), their points spent by `autoAdvance`.
 */
export function visitGuildHall(game: GameState): number {
  while (upgradeGuildHall(game) === null);
  let hired = 0
  while (game.party.length < partyLimit(game.world) && recruitRefusal(game) === null) {
    const taken = [...game.party, ...game.reserves].map((member) => member.name)
    const base = PREROLLS[(game.party.length + game.reserves.length) % PREROLLS.length].draft
    let name = base.name
    for (let n = 2; taken.includes(name); n++) name = `${base.name} ${n}`
    if (recruit(game, { ...base, name }) !== null) break
    toParty(game, game.reserves.length - 1)
    autoAdvance(game.party.at(-1)!)
    hired++
  }
  return hired
}

/**
 * Where a careful party goes next. First the nest pushing hardest on the held
 * site nearest to falling, if the party is up to its threat; then the nearest
 * nest it is up to (a threat no higher than its lowest level), or the nearest
 * of all if none; and the Source once every member has `SOURCE_READY_LEVEL`
 * or nothing else is left.
 */
export function nextTarget(world: WorldState, party: Party): MonsterLocation | null {
  const all = world.locations.filter((l): l is MonsterLocation => l.kind === 'monsters')
  const source = all.find((l) => l.source) ?? null
  const nests = all.filter((l) => !l.source)
  if (source && (nests.length === 0 || lowestLevel(party) >= SOURCE_READY_LEVEL)) return source
  const upTo = nests.filter((l) => l.threat <= Math.max(1, lowestLevel(party)))
  const threatened = sites(world)
    .filter((site) => world.threatened.includes(site.id))
    .map((site) => ({ site, days: daysToFall(world, party, site) ?? Infinity }))
    .sort((a, b) => a.days - b.days)
  for (const { site } of threatened) {
    const push = (l: MonsterLocation) => monsterStrength(l) - hexDistance(l.position, site.position)
    const pushing = upTo.filter((l) => push(l) > 0)
    if (pushing.length > 0) return pushing.reduce((a, b) => (push(b) > push(a) ? b : a))
  }
  const pool = upTo.length > 0 ? upTo : nests
  if (pool.length === 0) return null
  return pool.reduce((a, b) => (hexDistance(world.party, b.position) < hexDistance(world.party, a.position) ? b : a))
}

/**
 * Plays one campaign and returns each battle's events, in the order fought,
 * with a record of the rest. A new party sets out from the encampment of a
 * new world (seeded with the campaign's seed) and goes where `nextTarget`
 * sends it, walking there a day a hex as the blight goes on, each nest at
 * its own threat. It carries its hit points from battle to battle, takes
 * `rewardVictory` after each win and spends what that brought with
 * `autoAdvance`, and camps where it won until its wounds are healed
 * (`campUntilHealed`, again whenever an event breaks camp). The campaign ends
 * when the Source is beaten, a battle is not won, the encampment falls, or
 * `MAX_CAMPAIGN_DAYS` pass. Loot is left alone: the heroes keep their
 * starting gear.
 */
export function runCampaign(campaign: number, seed: number, args: CliArgs, firstBattleId = 0): Campaign {
  const game = newGame(startingParty(args), null, seed)
  const { party, world } = game
  const home = world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
  const battles: LoggedEvent[][] = []
  const record: CampaignRecord = {
    outcome: 'timeout', days: 0, battles: 0, spawns: 0, captured: 0, lost: 0, blighted: 0, healedHp: 0, campDays: 0,
    towersBuilt: 0, towersLost: 0, recruits: 0, hallLevel: 1,
  }
  const tally = (events: readonly WorldEvent[]) => {
    for (const event of events) {
      if (event.type === 'spawned') record.spawns++
      if (event.type === 'site_captured') record.captured++
      if (event.type === 'site_lost') record.lost++
      if (event.type === 'tower_built') record.towersBuilt++
      if (event.type === 'tower_lost') record.towersLost++
    }
  }
  const finish = (outcome: CampaignOutcome): Campaign => {
    record.outcome = outcome
    record.days = world.turn
    record.battles = battles.length
    record.blighted = blightedShare(world)
    record.hallLevel = world.guildHall
    return { battles, record }
  }
  /** Walks to `to`, going on whenever something on the way stops the party; false if it never gets there. */
  const walkTo = (to: Hex): boolean => {
    while (!hexEquals(world.party, to) && worldActive(world) && world.turn <= MAX_CAMPAIGN_DAYS) {
      const journey = travel(world, to, party)
      tally(journey.events)
      if (journey.walked.length === 0) return false
    }
    return hexEquals(world.party, to)
  }
  for (;;) {
    if (world.status === 'lost') return finish('encampment')
    if (world.turn > MAX_CAMPAIGN_DAYS) return finish('timeout')
    if (hallErrand(game) && !hexEquals(world.party, home)) {
      if (!walkTo(home)) return finish(worldActive(world) ? 'timeout' : 'encampment')
    }
    // Done at once, whatever brought the party home.
    if (atGuildHall(world)) record.recruits += visitGuildHall(game)
    const next = nextTarget(world, party)
    if (!next) return finish('timeout')
    // The journey stops for what happens on the way; the careful party takes note and goes on.
    const arrived = walkTo(next.position)
    if (!worldActive(world)) return finish('encampment')
    if (!arrived) return finish('timeout')

    const encounter = ENCOUNTERS[next.encounter](partyFighters(party), next.threat)
    const meta = {
      campaign,
      location: next.id,
      encounter: next.encounter,
      threat: next.threat,
      day: world.turn,
      partyLevels: party.map((member) => member.level),
    }
    const battleId = firstBattleId + battles.length
    const engine = fight(encounter.setup, (seed + battles.length) >>> 0, party, args, meta)
    battles.push(engine.getLog().map((event) => ({ ...event, battleId })))

    const state = engine.getState()
    if (state.winner !== 'player') return finish('fallen')
    // The party's wounds and mana left are its own from here on, as BattleScene makes them.
    party.forEach((member, i) => {
      const unit = state.units.find((u) => u.id === heroId(i))!
      member.hp = unit.hp
      member.mana = unit.mana
    })
    rewardVictory(party, xpReward(encounter))
    for (const member of party) autoAdvance(member)
    clearLocation(world, next.id)
    if (world.status === 'won') return finish('source')
    // A watchtower wherever the party stops on land that takes one and the stock affords it.
    if (canBuildTower(world) === null) tally(buildTower(world, party)!)
    while (partyWounded(party) && canCamp(world)) {
      const camp = campUntilHealed(world, party)!
      tally(camp.events)
      record.healedHp += camp.rested + camp.cast
      record.campDays += camp.days
    }
  }
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
  /** Hit points restored by spells in battle, per battle, by the caster's side. */
  avgPlayerHealing: number
  avgEnemyHealing: number
  /** Statuses laid by spells, per battle, by the caster's side. */
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
      this.damage[side] += event.damage
      if (event.hit) this.hits[side]++
      if (event.critical) this.crits[side]++
    }
    if (event.type === 'cast') {
      const side = this.sideOf.get(event.caster) === 'player' ? 'player' : 'enemy'
      this.casts[side]++
      for (const outcome of event.outcomes) {
        this.damage[side] += outcome.damage
        this.healing[side] += outcome.healed
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
  avgHallLevel: number
  /** In rising order of threat; a threat no campaign reached has no row. */
  byThreat: ThreatRow[]
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
    avgHallLevel: avg((r) => r.hallLevel),
    byThreat: threats.rows(),
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
  console.log(`Guild hall: level ${summary.avgHallLevel.toFixed(1)} at the end, ${summary.avgRecruits.toFixed(1)} recruits a campaign`)
  console.log(
    `Hit points healed between battles: ${summary.avgHealedHp.toFixed(1)} a campaign, in ${summary.avgCampDays.toFixed(1)} days of camping`,
  )
  console.table(summary.byThreat.map((row) => ({ ...row, winRate: Number(row.winRate.toFixed(3)) })))
  console.table(tally.summary(battles))
}

if (import.meta.main) main()
