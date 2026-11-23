#!/usr/bin/env node
// The auto-resolve estimate's cost: times `forecast` (src/game/forecast.ts) for
// fixed starts, the ready-made party raised to 6, 12, 15 and 18 (as the
// simulator's `raisedParty`), each member's worn weapon, shield and armour the
// same family at tier 2, 3, 4 and 5 (Fine), against bandit_company 9,
// bandit_company 12, freebooter_host 15 and freebooter_host 18; and a
// mid-battle start (a snapshot a few steps into the level-15 battle). Each is
// run once to warm up, then `--runs` times; it prints the median ms an
// estimate takes (wall clock, and the process's CPU time, which another load on
// the machine disturbs less) and a sample, and the rounds a sample lasts on average. It writes
// no file. Long-campaign stage 10 step 07 measures it before and after its
// speed-ups.
//
// Usage: node scripts/forecastCost.ts [--samples 40] [--runs 3]
import { parseArgs } from 'node:util'
import { performance } from 'node:perf_hooks'
import { mulberry32 } from '../src/combat/rng.ts'
import { AUTO_POLICY, ENEMY_POLICY, autoLastRound, playOut, playStep } from '../src/engine/autoPlay.ts'
import { BattleEngine } from '../src/engine/battleEngine.ts'
import { ENCOUNTERS, type EncounterId } from '../src/game/encounters.ts'
import { FORECAST_SAMPLES, battleForecastBase, forecast, forecastSeed, type ForecastStart } from '../src/game/forecast.ts'
import { partyFighters } from '../src/game/party.ts'
import { MATERIALS, type Tier } from '../src/inventory/catalog.ts'
import { itemById, type EquipmentSlot } from '../src/inventory/inventory.ts'
import { clampHp, maxHp } from '../src/character/character.ts'
import { parseArgs as parseSimulateArgs, raisedParty } from './simulate.ts'

const { values } = parseArgs({ options: { samples: { type: 'string', default: String(FORECAST_SAMPLES) }, runs: { type: 'string', default: '5' } } })
const samples = Number(values.samples)
const runs = Number(values.runs)
if (!Number.isInteger(samples) || samples < 1 || !Number.isInteger(runs) || runs < 1) throw new Error('--samples and --runs must be positive integers')

const KIT_SLOTS: readonly EquipmentSlot[] = ['mainHand', 'offHand', 'armor']

/** The ready-made party at `level`, its worn weapon, shield and armour remade at `tier`, Fine. */
function partyAt(level: number, tier: Tier) {
  const party = raisedParty(parseSimulateArgs(['--party-level', String(level)]))
  for (const member of party) {
    const before = maxHp(member)
    for (const slot of KIT_SLOTS) {
      const worn = member.equipment[slot]
      if (!worn?.family) continue
      const kind = MATERIALS.find((m) => m.id === worn.material)!.kind
      const material = MATERIALS.find((m) => m.tier === tier && m.kind === kind)!
      const item = itemById(`${material.id}_${worn.family}@2`)
      if (!item) throw new Error(`no ${material.id}_${worn.family}@2`)
      member.equipment[slot] = item
    }
    clampHp(member, before)
    member.hp = maxHp(member)
  }
  return party
}

interface Case {
  name: string
  start: ForecastStart
  base: number
}

function worldCase(level: number, tier: Tier, encounter: EncounterId, threat: number): Case {
  const { setup } = ENCOUNTERS[encounter](partyFighters(partyAt(level, tier)), threat)
  return { name: `level ${level}, tier ${tier} vs ${encounter} ${threat}`, start: { setup }, base: level * 1000 + threat }
}

/** The level-15 battle a few steps in, as the battle screen would estimate it. */
function midBattleCase(): Case {
  const { setup } = ENCOUNTERS.freebooter_host(partyFighters(partyAt(15, 4)), 15)
  const engine = new BattleEngine(setup, { seed: 99, meta: { source: 'forecastCost' } })
  const options = {
    policies: { player: AUTO_POLICY, enemy: ENEMY_POLICY },
    rngs: { enemy: mulberry32(100), player: mulberry32(101) },
    lastRound: autoLastRound(1),
  }
  for (let i = 0; i < 6; i++) playStep(engine, options)
  return { name: 'level 15, tier 4 vs freebooter_host 15, 6 steps in', start: { snapshot: engine.snapshot() }, base: battleForecastBase(engine.getLog()) }
}

/** The rounds each sample lasts, averaged (played again, untimed). */
function meanRounds({ start, base }: Case): number {
  let total = 0
  for (let i = 0; i < samples; i++) {
    const s = forecastSeed(base, i)
    const engine = 'setup' in start ? new BattleEngine(start.setup, { seed: s }) : BattleEngine.restore({ ...start.snapshot, rng: s })
    const first = 'setup' in start ? 1 : start.snapshot.round
    playOut(engine, {
      policies: { player: AUTO_POLICY, enemy: ENEMY_POLICY },
      rngs: { enemy: mulberry32(s + 1), player: mulberry32(s + 2) },
      lastRound: autoLastRound(first),
    })
    total += engine.getState().round - first + 1
  }
  return total / samples
}

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

const cases: Case[] = [
  worldCase(6, 2, 'bandit_company', 9),
  worldCase(12, 3, 'bandit_company', 12),
  worldCase(15, 4, 'freebooter_host', 15),
  worldCase(18, 5, 'freebooter_host', 18),
  midBattleCase(),
]

console.log(`${samples} samples an estimate, median of ${runs} runs after a warm-up`)
for (const c of cases) {
  const result = forecast(c.start, c.base, samples)
  const wall: number[] = []
  const cpu: number[] = []
  for (let r = 0; r < runs; r++) {
    const t0 = performance.now()
    const c0 = process.cpuUsage()
    forecast(c.start, c.base, samples)
    const used = process.cpuUsage(c0)
    wall.push(performance.now() - t0)
    cpu.push((used.user + used.system) / 1000)
  }
  const ms = median(cpu)
  console.log(
    `${c.name}: ${median(wall).toFixed(0)} ms an estimate (CPU ${ms.toFixed(0)}), ${(ms / samples).toFixed(1)} CPU ms a sample, ${meanRounds(c).toFixed(1)} rounds a sample; ` +
      `wins ${result.wins}, heroLost ${result.heroLost}, stalled ${result.stalled}`,
  )
}
