#!/usr/bin/env node
// Headless battle simulator for balancing: runs the same BattleEngine the
// game uses many times, with each side driven by a named policy, and writes
// every event to a JSONL file plus a summary of win rate / damage / hit rate.
// Each battle's battle_start event records its seed and policies, so any
// single battle can be replayed.
//
// Usage: node scripts/simulate.ts [--battles 1000] [--out logs/battles.jsonl] [--seed 1] [--max-rounds 200]
//                                 [--player-policy aggressive] [--enemy-policy aggressive]
//                                 [--player-weapon iron_sword]
//                                 [--encounter goblin_raid] [--threat 1] [--party-level 1]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { mulberry32, randomSeed } from '../src/combat/rng.ts'
import { BattleEngine, type BattleEvent, type Side, type UnitId } from '../src/engine/battleEngine.ts'
import { POLICIES, isPolicyName, type PolicyName } from '../src/engine/policies.ts'
import { autoAdvance, levelUp } from '../src/character/progression.ts'
import { ENCOUNTERS, type EncounterId } from '../src/game/encounters.ts'
import { newParty, partyFighters } from '../src/game/party.ts'
import { WEAPONS, type Item } from '../src/inventory/inventory.ts'

interface CliArgs {
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

function weapon(flag: string, raw: string): Item {
  const item = WEAPONS.find((w) => w.id === raw)
  if (!item) throw new Error(`${flag} must be one of ${WEAPONS.map((w) => w.id).join(', ')}, got "${raw}"`)
  return item
}

function encounterId(flag: string, raw: string): EncounterId {
  if (!Object.hasOwn(ENCOUNTERS, raw)) throw new Error(`${flag} must be one of ${Object.keys(ENCOUNTERS).join(', ')}, got "${raw}"`)
  return raw as EncounterId
}

function parseArgs(argv: string[]): CliArgs {
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
      default:
        throw new Error(`Unknown argument: ${flag}`)
    }
  }
  return args
}

export type LoggedEvent = BattleEvent & { battleId: number }

function runBattle(battleId: number, seed: number, args: CliArgs): LoggedEvent[] {
  const party = newParty()
  if (args.playerWeapon) for (const member of party) member.equipment.mainHand = args.playerWeapon
  for (const member of party) {
    // Spent a level at a time, as a player would: a perk is chosen at the level that brings it.
    while (member.level < args.partyLevel) {
      levelUp(member)
      autoAdvance(member)
    }
  }
  const engine = new BattleEngine(ENCOUNTERS[args.encounter](partyFighters(party), args.threat).setup, {
    seed,
    meta: {
      source: 'simulate',
      policies: args.policies,
      // Each member's, in party order: the starting heroes do not all hold the same.
      playerWeapons: party.map((member) => member.equipment.mainHand?.id ?? null),
      encounter: args.encounter,
      threat: args.threat,
      partyLevel: args.partyLevel,
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

  return engine.getLog().map((event) => ({ ...event, battleId }))
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
}

export function summarize(events: LoggedEvent[], battles: number): Summary {
  let playerWins = 0
  let enemyWins = 0
  let totalRounds = 0
  let playerDamage = 0
  let enemyDamage = 0
  let playerAttacks = 0
  let enemyAttacks = 0
  let playerHits = 0
  let enemyHits = 0
  let playerCrits = 0
  let enemyCrits = 0
  let opportunityAttacks = 0
  let sideAttacks = 0
  let rearAttacks = 0
  // Attacks name units; each battle's battle_start says which side they're on.
  let sideOf = new Map<UnitId, Side>()

  for (const event of events) {
    if (event.type === 'battle_start') sideOf = new Map(event.units.map((u) => [u.id, u.side]))
    if (event.type === 'battle_end' && event.winner) {
      totalRounds += event.round
      if (event.winner === 'player') playerWins++
      else enemyWins++
    }
    if (event.type === 'attack') {
      if (event.opportunity) opportunityAttacks++
      if (event.arc === 'side') sideAttacks++
      if (event.arc === 'rear') rearAttacks++
      if (sideOf.get(event.attacker) === 'player') {
        playerAttacks++
        playerDamage += event.damage
        if (event.hit) playerHits++
        if (event.critical) playerCrits++
      } else {
        enemyAttacks++
        enemyDamage += event.damage
        if (event.hit) enemyHits++
        if (event.critical) enemyCrits++
      }
    }
  }

  const decided = playerWins + enemyWins
  return {
    battles,
    playerWins,
    enemyWins,
    unresolved: battles - decided,
    avgRounds: decided ? totalRounds / decided : 0,
    avgPlayerDamageDealt: playerDamage / battles,
    avgEnemyDamageDealt: enemyDamage / battles,
    playerHitRate: playerAttacks ? playerHits / playerAttacks : 0,
    enemyHitRate: enemyAttacks ? enemyHits / enemyAttacks : 0,
    playerCritRate: playerAttacks ? playerCrits / playerAttacks : 0,
    enemyCritRate: enemyAttacks ? enemyCrits / enemyAttacks : 0,
    avgOpportunityAttacks: opportunityAttacks / battles,
    avgSideAttacks: sideAttacks / battles,
    avgRearAttacks: rearAttacks / battles,
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const baseSeed = args.seed ?? randomSeed()

  const allEvents: LoggedEvent[] = []
  for (let battleId = 0; battleId < args.battles; battleId++) {
    allEvents.push(...runBattle(battleId, (baseSeed + battleId) >>> 0, args))
  }

  mkdirSync(dirname(args.outPath), { recursive: true })
  writeFileSync(args.outPath, allEvents.map((event) => JSON.stringify(event)).join('\n') + '\n')

  const summary = summarize(allEvents, args.battles)
  console.log(
    `Simulated ${args.battles} battles of ${args.encounter} at threat ${args.threat}, party level ${args.partyLevel} (seed ${baseSeed}, player ${args.policies.player} vs enemy ${args.policies.enemy}) -> ${args.outPath}`,
  )
  console.table(summary)
}

if (import.meta.main) main()
