#!/usr/bin/env node
// Headless battle simulator for balancing: runs the same BattleEngine the
// game uses many times, with each side driven by a named policy, and writes
// every event to a JSONL file plus a summary of win rate / damage / hit rate.
// Each battle's battle_start event records its seed and policies, so any
// single battle can be replayed.
//
// With --campaign each of --battles is a whole campaign instead: a new party
// fights the world map's monster locations nearest first, carrying its wounds
// and spending its levels, until it has cleared the map or fallen. That is
// how scaling is judged; see the rules of scaling in CLAUDE.md.
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
import { autoHeal, readyMadeParty, partyFighters, rewardVictory, type Party } from '../src/game/party.ts'
import { clearLocation, newWorld, type MonsterLocation } from '../src/game/worldMap.ts'
import { hexDistance } from '../src/grid/hex.ts'
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

/** Seeds apart for the battles of one campaign: more than a map has monster locations. */
const CAMPAIGN_SEED_STEP = 1000

/**
 * Plays one campaign and returns each battle's events, in the order fought. A
 * new party fights the monster locations of a new world nearest first, by
 * hexes from where it stands (home, then the last location beaten; the first
 * in the world's list on a tie), each at its own threat. It carries its hit
 * points from battle to battle, takes `rewardVictory` after each win and
 * spends what that brought with `autoAdvance`, and heals what it can with the
 * mana left (`autoHeal`, adding what it restored to `healed`), until the map
 * is clear or a battle is not won. Loot is left alone: the heroes keep their
 * starting gear.
 */
export function runCampaign(
  campaign: number,
  seed: number,
  args: CliArgs,
  firstBattleId = 0,
  healed: { hp: number } = { hp: 0 },
): LoggedEvent[][] {
  const party = startingParty(args)
  const world = newWorld()
  const battles: LoggedEvent[][] = []
  for (;;) {
    const lairs = world.locations.filter((l): l is MonsterLocation => l.kind === 'monsters')
    if (lairs.length === 0) break
    const next = lairs.reduce((a, b) => (hexDistance(world.party, b.position) < hexDistance(world.party, a.position) ? b : a))
    const encounter = ENCOUNTERS[next.encounter](partyFighters(party), next.threat)
    const meta = {
      campaign,
      location: next.id,
      encounter: next.encounter,
      threat: next.threat,
      partyLevels: party.map((member) => member.level),
    }
    const battleId = firstBattleId + battles.length
    const engine = fight(encounter.setup, (seed + battles.length) >>> 0, party, args, meta)
    battles.push(engine.getLog().map((event) => ({ ...event, battleId })))

    const state = engine.getState()
    if (state.winner !== 'player') break
    // The party's wounds and mana left are its own from here on, as BattleScene makes them.
    party.forEach((member, i) => {
      const unit = state.units.find((u) => u.id === heroId(i))!
      member.hp = unit.hp
      member.mana = unit.mana
    })
    rewardVictory(party, xpReward(encounter))
    for (const member of party) autoAdvance(member)
    healed.hp += autoHeal(party)
    clearLocation(world, next.id)
    world.party = next.position
  }
  return battles
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
  /** Campaigns that beat every monster location of the map. */
  cleared: number
  clearedShare: number
  avgLocationsCleared: number
  /** In rising order of threat; a threat no campaign reached has no row. */
  byThreat: ThreatRow[]
}

/** Adds up what `summarizeCampaigns` reports, an event at a time. */
class CampaignTally {
  private wins = new Map<number, number>()
  private threats = new Map<number, { battles: number; won: number }>()
  private campaign = 0
  private threat = 0

  add(event: BattleEvent): void {
    if (event.type === 'battle_start') {
      this.campaign = Number(event.meta.campaign ?? 0)
      this.threat = Number(event.meta.threat ?? 0)
      const row = this.threats.get(this.threat) ?? { battles: 0, won: 0 }
      row.battles++
      this.threats.set(this.threat, row)
    }
    if (event.type === 'battle_end' && event.winner === 'player') {
      this.threats.get(this.threat)!.won++
      this.wins.set(this.campaign, (this.wins.get(this.campaign) ?? 0) + 1)
    }
  }

  /** `locations` is how many monster locations the map has: a campaign with that many wins cleared it. */
  summary(campaigns: number, locations: number): CampaignSummary {
    const cleared = [...this.wins.values()].filter((wins) => wins >= locations).length
    const won = [...this.wins.values()].reduce((a, b) => a + b, 0)
    return {
      campaigns,
      cleared,
      clearedShare: cleared / campaigns,
      avgLocationsCleared: won / campaigns,
      byThreat: [...this.threats.entries()]
        .sort(([a], [b]) => a - b)
        .map(([threat, row]) => ({ threat, ...row, winRate: row.won / row.battles })),
    }
  }
}

export function summarizeCampaigns(events: readonly LoggedEvent[], campaigns: number, locations: number): CampaignSummary {
  const tally = new CampaignTally()
  for (const event of events) tally.add(event)
  return tally.summary(campaigns, locations)
}

/** How many monster locations a new world has. */
export function monsterLocations(): number {
  return newWorld().locations.filter((l) => l.kind === 'monsters').length
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const baseSeed = args.seed ?? randomSeed()
  const tally = new Tally()
  const campaigns = new CampaignTally()

  // Written a battle at a time: a run of campaigns is too long to hold in memory.
  mkdirSync(dirname(args.outPath), { recursive: true })
  const out = openSync(args.outPath, 'w')
  let battles = 0
  const healed = { hp: 0 }
  const log = (events: readonly LoggedEvent[]) => {
    battles++
    writeSync(out, events.map((event) => JSON.stringify(event)).join('\n') + '\n')
    for (const event of events) {
      tally.add(event)
      campaigns.add(event)
    }
  }
  for (let run = 0; run < args.battles; run++) {
    if (args.campaign) runCampaign(run, (baseSeed + run * CAMPAIGN_SEED_STEP) >>> 0, args, battles, healed).forEach(log)
    else log(runBattle(run, (baseSeed + run) >>> 0, args))
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
  const { byThreat, ...summary } = campaigns.summary(args.battles, monsterLocations())
  console.log(`Simulated ${args.battles} campaigns, ${battles} battles in all (${versus}) -> ${args.outPath}`)
  console.log(
    `Cleared the map: ${summary.cleared} of ${summary.campaigns} (${(summary.clearedShare * 100).toFixed(1)}%); locations cleared a campaign: ${summary.avgLocationsCleared.toFixed(2)} of ${monsterLocations()}`,
  )
  console.log(`Hit points healed between battles: ${(healed.hp / args.battles).toFixed(1)} a campaign`)
  console.table(byThreat.map((row) => ({ ...row, winRate: Number(row.winRate.toFixed(3)) })))
  console.table(tally.summary(battles))
}

if (import.meta.main) main()
