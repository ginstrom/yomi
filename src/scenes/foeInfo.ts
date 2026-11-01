import { ABILITIES } from '../combat/abilities.ts'
import { ELEMENTS } from '../combat/combat.ts'
import type { UnitSnapshot } from '../engine/battleEngine.ts'

/** What hovering a foe tells: a line per ability ("Fire Spit: ready", "Web: recharging, 2 rounds"), then its wards ("Wards: fire 99"); [] for a unit with neither. */
export function foeInfoLines(unit: UnitSnapshot): string[] {
  const lines = (unit.abilities ?? []).map((id) => {
    const rounds = unit.recharging[id] ?? 0
    const state = rounds > 0 ? `recharging, ${rounds} round${rounds === 1 ? '' : 's'}` : 'ready'
    return `${ABILITIES[id].name}: ${state}`
  })
  const wards = ELEMENTS.filter((e) => (unit.wards?.[e] ?? 0) > 0).map((e) => `${e} ${unit.wards![e]}`)
  if (wards.length > 0) lines.push(`Wards: ${wards.join(', ')}`)
  return lines
}
