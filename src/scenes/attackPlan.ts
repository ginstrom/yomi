import {
  ARC_BONUS,
  ATTACK_AP_COST,
  attackArc,
  type Action,
  type BattleEngine,
  type MovePreview,
  type UnitId,
} from '../engine/battleEngine.ts'
import { hexDistance } from '../grid/hex.ts'

type MoveAction = Extract<Action, { type: 'move' }>

/**
 * What clicking a foe does: an optional move, then an attack if `attack` is
 * set. With neither, there is nothing to do (e.g. already beside the foe
 * with too few AP to strike).
 */
export interface AttackPlan {
  move: MoveAction | null
  attack: boolean
}

/**
 * Plans `unit` going for `target`. If it can strike now, it does. Otherwise, if
 * a hex beside the foe leaves AP for an attack, it moves there and strikes:
 * provoking the fewest free attacks, then hitting the weakest arc, then
 * walking the least. Failing that it closes in without attacking: to the
 * nearest hex beside the foe, or as near as it can get.
 */
export function planAttack(engine: BattleEngine, unit: UnitId, target: UnitId): AttackPlan {
  const state = engine.getState()
  const actor = state.units.find((u) => u.id === unit)
  const foe = state.units.find((u) => u.id === target)
  if (!actor || !foe || foe.hp <= 0 || foe.side === actor.side) return { move: null, attack: false }
  if (engine.previewAttack(unit, target)) return { move: null, attack: true }
  if (hexDistance(actor.position, foe.position) === 1) return { move: null, attack: false }

  const moves = engine
    .legalActions(unit)
    .filter((a): a is MoveAction => a.type === 'move')
    .map((action) => ({ action, preview: engine.previewMove(unit, action.to)! }))
  const pick = (
    candidates: { action: MoveAction; preview: MovePreview }[],
    key: (c: { action: MoveAction; preview: MovePreview }) => number[],
  ) => {
    let best = candidates[0]
    for (const c of candidates.slice(1)) {
      const a = key(c)
      const b = key(best)
      const i = a.findIndex((v, j) => v !== b[j])
      if (i >= 0 && a[i] < b[i]) best = c
    }
    return best?.action ?? null
  }

  const strikes = moves.filter(
    (m) => hexDistance(m.action.to, foe.position) === 1 && m.preview.apCost + ATTACK_AP_COST <= actor.ap,
  )
  if (strikes.length > 0) {
    const move = pick(strikes, (m) => [
      m.preview.provokes.length,
      -ARC_BONUS[attackArc(foe, m.action.to)],
      m.preview.path.length,
    ])
    return { move, attack: true }
  }
  const distance = hexDistance(actor.position, foe.position)
  const closer = moves.filter((m) => hexDistance(m.action.to, foe.position) < distance)
  const move = pick(closer, (m) => [
    hexDistance(m.action.to, foe.position),
    m.preview.path.length,
    m.preview.provokes.length,
  ])
  return { move, attack: false }
}
