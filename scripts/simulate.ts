#!/usr/bin/env node
// Headless battle simulator for balancing: runs the same BattleEngine the
// game uses, many times with a "always attack" policy, and writes every
// event to a JSONL file plus a summary of win rate / damage / hit rate.
//
// Usage: node scripts/simulate.ts [--battles 1000] [--out battles.jsonl] [--seed 1] [--max-rounds 200]
import { writeFileSync } from 'node:fs'
import { createWarrior, deriveCombatStats } from '../src/character/character.ts'
import { GOBLIN_STATS, type RNG } from '../src/combat/combat.ts'
import { BattleEngine, type BattleEvent } from '../src/engine/battleEngine.ts'

const WARRIOR_STATS = deriveCombatStats(createWarrior())

interface CliArgs {
  battles: number
  outPath: string
  seed: number | null
  maxRounds: number
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { battles: 1000, outPath: 'battles.jsonl', seed: null, maxRounds: 200 }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`Missing value for ${flag}`)
      return v
    }
    switch (flag) {
      case '--battles':
        args.battles = Number(value())
        break
      case '--out':
        args.outPath = value()
        break
      case '--seed':
        args.seed = Number(value())
        break
      case '--max-rounds':
        args.maxRounds = Number(value())
        break
      default:
        throw new Error(`Unknown argument: ${flag}`)
    }
  }
  return args
}

// Small, fast, seedable PRNG (mulberry32) so runs are reproducible.
function mulberry32(seed: number): RNG {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type LoggedEvent = BattleEvent & { battleId: number }

function runBattle(battleId: number, rng: RNG, maxRounds: number): LoggedEvent[] {
  const engine = new BattleEngine({ player: WARRIOR_STATS, enemy: GOBLIN_STATS }, rng)

  let guard = 0
  while (engine.getState().phase !== 'over') {
    if (guard++ > maxRounds * 2) {
      throw new Error(`Battle ${battleId} did not resolve within ${maxRounds} rounds`)
    }
    engine.playerAttack()
    if (engine.getState().phase === 'enemy') engine.enemyTurn()
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
      else enemyWins++
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
  const baseSeed = args.seed ?? Date.now()

  const allEvents: LoggedEvent[] = []
  for (let battleId = 0; battleId < args.battles; battleId++) {
    allEvents.push(...runBattle(battleId, mulberry32(baseSeed + battleId), args.maxRounds))
  }

  writeFileSync(args.outPath, allEvents.map((event) => JSON.stringify(event)).join('\n') + '\n')

  const summary = summarize(allEvents, args.battles)
  console.log(`Simulated ${args.battles} battles (seed ${baseSeed}) -> ${args.outPath}`)
  console.table(summary)
}

main()
