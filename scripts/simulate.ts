#!/usr/bin/env node
// Headless battle simulator for balancing: runs the same BattleEngine the
// game uses many times, with each side driven by a named policy, and writes
// every event to a JSONL file plus a summary of win rate / damage / hit rate.
// Each battle's battle_start event records its seed and policies, so any
// single battle can be replayed.
//
// Usage: node scripts/simulate.ts [--battles 1000] [--out logs/battles.jsonl] [--seed 1] [--max-rounds 200]
//                                 [--player-policy aggressive] [--enemy-policy aggressive]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createWarrior, deriveCombatStats } from '../src/character/character.ts'
import { GOBLIN_STATS } from '../src/combat/combat.ts'
import { mulberry32, randomSeed } from '../src/combat/rng.ts'
import { BattleEngine, type BattleEvent, type Side } from '../src/engine/battleEngine.ts'
import { POLICIES, isPolicyName, type PolicyName } from '../src/engine/policies.ts'

const WARRIOR_STATS = deriveCombatStats(createWarrior())

interface CliArgs {
  battles: number
  outPath: string
  seed: number | null
  maxRounds: number
  policies: Record<Side, PolicyName>
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

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    battles: 1000,
    outPath: 'logs/battles.jsonl',
    seed: null,
    maxRounds: 200,
    policies: { player: 'aggressive', enemy: 'aggressive' },
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
      default:
        throw new Error(`Unknown argument: ${flag}`)
    }
  }
  return args
}

type LoggedEvent = BattleEvent & { battleId: number }

function runBattle(battleId: number, seed: number, args: CliArgs): LoggedEvent[] {
  const engine = new BattleEngine(
    { player: WARRIOR_STATS, enemy: GOBLIN_STATS },
    { seed, meta: { source: 'simulate', policies: args.policies } },
  )
  // Policies get their own stream so swapping one doesn't change the dice.
  const policyRng = mulberry32(seed ^ 0x9e3779b9)

  for (let state = engine.getState(); state.phase !== 'over'; state = engine.getState()) {
    if (state.round > args.maxRounds) {
      throw new Error(`Battle ${battleId} (seed ${seed}) did not resolve within ${args.maxRounds} rounds`)
    }
    const side = state.phase
    const policy = POLICIES[args.policies[side]]
    engine.step(policy({ state, side, legal: engine.legalActions(), rng: policyRng }))
  }

  return engine.getLog().map((event) => ({ ...event, battleId }))
}

interface Summary {
  battles: number
  playerWins: number
  enemyWins: number
  avgRounds: number
  avgPlayerDamageDealt: number
  avgEnemyDamageDealt: number
  playerHitRate: number
  enemyHitRate: number
  playerCritRate: number
  enemyCritRate: number
}

function summarize(events: LoggedEvent[], battles: number): Summary {
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

  for (const event of events) {
    if (event.type === 'battle_end') {
      totalRounds += event.round
      if (event.winner === 'player') playerWins++
      else if (event.winner === 'enemy') enemyWins++
    }
    if (event.type === 'attack') {
      if (event.attacker === 'player') {
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

  return {
    battles,
    playerWins,
    enemyWins,
    avgRounds: totalRounds / battles,
    avgPlayerDamageDealt: playerDamage / battles,
    avgEnemyDamageDealt: enemyDamage / battles,
    playerHitRate: playerAttacks ? playerHits / playerAttacks : 0,
    enemyHitRate: enemyAttacks ? enemyHits / enemyAttacks : 0,
    playerCritRate: playerAttacks ? playerCrits / playerAttacks : 0,
    enemyCritRate: enemyAttacks ? enemyCrits / enemyAttacks : 0,
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
    `Simulated ${args.battles} battles (seed ${baseSeed}, player ${args.policies.player} vs enemy ${args.policies.enemy}) -> ${args.outPath}`,
  )
  console.table(summary)
}

main()
