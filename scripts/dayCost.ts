#!/usr/bin/env node
// The world's cost a day: times N days of `passTurn` (the blight, territory
// and sight) on a new game's world, with the ready-made party resting at the
// encampment, and then N days of `advanceDay` alone on a second world of the
// same seed. It draws nothing beyond what those calls draw and writes no file.
// Long-campaign stage 9 measures it before the map grows (step 01) and after
// (step 08).
//
// Usage: node scripts/dayCost.ts [--days 1000] [--seed 1]
import { parseArgs } from 'node:util'
import { performance } from 'node:perf_hooks'
import { newGame, type GameState } from '../src/game/gameState.ts'
import { passTurn, type WorldState } from '../src/game/worldMap.ts'
import { advanceDay } from '../src/game/blight.ts'
import { presences } from '../src/game/expedition.ts'

const { values } = parseArgs({ options: { days: { type: 'string', default: '1000' }, seed: { type: 'string', default: '1' } } })
const days = Number(values.days)
const seed = Number(values.seed)
if (!Number.isInteger(days) || days < 1 || !Number.isInteger(seed)) throw new Error('--days must be a positive integer and --seed an integer')

function timeDays(day: (world: WorldState, game: GameState) => void): { ms: number; world: WorldState } {
  const game = newGame(undefined, null, seed)
  const start = performance.now()
  for (let i = 0; i < days; i++) day(game.world, game)
  const ms = (performance.now() - start) / days
  return { ms, world: game.world }
}

const report = (name: string, { ms, world }: { ms: number; world: WorldState }): void => {
  const monsters = world.locations.filter((location) => location.kind === 'monsters').length
  console.log(`${name}: ${ms.toFixed(3)} ms a day over ${days} days; board ${world.board.cols} × ${world.board.rows}; ${monsters} monster locations at the end`)
}

report('passTurn', timeDays((world, game) => passTurn(world, presences(game.parties))))
report('advanceDay', timeDays((world, game) => advanceDay(world, presences(game.parties))))
