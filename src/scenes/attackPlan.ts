import {
  ARC_BONUS,
  arcStruck,
  isMelee,
  type Action,
  type BattleEngine,
  type MovePreview,
  type UnitId,
} from '../engine/battleEngine.ts'
import { hexDistance } from '../grid/hex.ts'

type MoveAction = Extract<Action, { type: 'move' }>

/**
 * What clicking a foe does: an optional move, then an attack if `attack` is
 * set. A move comes only with an attack. With neither, there is nothing to do
 * (the attack cannot be made this turn).
 */
export interface AttackPlan {
  move: MoveAction | null
  attack: boolean
}

/**
 * Plans `unit` going for `target`. If it can strike now, it does. Otherwise, if
 * a hex within its attack range of the foe leaves AP for an attack, it moves there and strikes:
 * provoking the fewest free attacks, then hitting the weakest arc, then
 * walking the least. Failing that it does nothing: a click on a foe asks
 * for an attack, and a walk that leaves too few AP for it (a halberd's blow
 * costs every AP its bearer has, and a bow would walk up to the foe) would
 * spend the turn on something the player did not ask for. Closing in is a
 * plain move, a click on a hex.
 */
export function planAttack(engine: BattleEngine, unit: UnitId, target: UnitId): AttackPlan {
  const state = engine.getState()
  const actor = state.units.find((u) => u.id === unit)
  const foe = state.units.find((u) => u.id === target)
  if (!actor || !foe || foe.hp <= 0 || foe.side === actor.side) return { move: null, attack: false }
  if (engine.previewAttack(unit, target)) return { move: null, attack: true }
  if (hexDistance(actor.position, foe.position) <= actor.attackRange) return { move: null, attack: false }

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
    (m) =>
      hexDistance(m.action.to, foe.position) <= actor.attackRange &&
      m.preview.apCost + actor.attackApCost <= actor.ap,
  )
  if (strikes.length > 0) {
    const move = pick(strikes, (m) => [
      m.preview.provokes.length,
      -ARC_BONUS[arcStruck(foe, m.action.to, isMelee(actor))],
      m.preview.path.length,
    ])
    return { move, attack: true }
  }
  return { move: null, attack: false }
}

/** The battle's hint for a foe a click cannot strike this turn: `distance` to it, the unit's `range`. */
export function noStrikeHint(distance: number, range: number): string {
  return distance <= range ? 'Too few AP to strike' : 'Too few AP to reach and strike'
}
