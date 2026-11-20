import type { BattleEvent, UnitId, UnitSnapshot } from '../engine/battleEngine.ts'

/** One hero's share of what a battle cost the party. */
export interface HeroCost {
  id: UnitId
  name: string
  lost: number
}

/** The widest a result line may be, in characters. */
const DEFAULT_WIDTH = 72

/** The most lines the cost sentence takes. */
const MAX_LINES = 2

/**
 * What each hero lost, in hit points, over a battle: the hit points they started with (the log's `battle_start`)
 * less the ones they end on. A hero who fell counts for all they started with; one who ends above their start costs
 * nothing. Most lost first, ties in the party's order; only heroes who lost something are listed.
 */
export function battleCost(log: readonly BattleEvent[], finalUnits: readonly UnitSnapshot[], names: Record<UnitId, string>): HeroCost[] {
  const first = log[0]
  if (first?.type !== 'battle_start') return []
  const costs: HeroCost[] = []
  for (const start of first.units) {
    if (start.side !== 'player') continue
    const end = finalUnits.find((unit) => unit.id === start.id)
    const lost = Math.max(0, start.hp - (end?.hp ?? 0))
    if (lost > 0) costs.push({ id: start.id, name: names[start.id] ?? start.id, lost })
  }
  return costs.sort((a, b) => b.lost - a.lost)
}

/** Breaks `text` at spaces into lines of at most `width` characters (a longer word keeps a line of its own). */
function wrap(text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line === '') line = word
    else if (line.length + 1 + word.length <= width) line += ` ${word}`
    else {
      lines.push(line)
      line = word
    }
  }
  return line === '' ? lines : [...lines, line]
}

/**
 * The result screen's words for the cost: "The battle cost 23 HP: Aiko 12, Ren 8, Mia 3.", over at most two lines of
 * `width` characters; the heroes that do not fit collapse to "and N more". None for a battle that cost nothing.
 */
export function costLines(costs: readonly HeroCost[], width = DEFAULT_WIDTH): string[] {
  if (costs.length === 0) return []
  const total = costs.reduce((sum, cost) => sum + cost.lost, 0)
  const head = `The battle cost ${total} HP`
  for (let shown = costs.length; shown > 0; shown--) {
    const parts = costs.slice(0, shown).map((cost) => `${cost.name} ${cost.lost}`)
    if (shown < costs.length) parts.push(`and ${costs.length - shown} more`)
    const lines = wrap(`${head}: ${parts.join(', ')}.`, width)
    if (lines.length <= MAX_LINES) return lines
  }
  return wrap(`${head}.`, width)
}
