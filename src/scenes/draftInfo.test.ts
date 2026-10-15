import { describe, expect, it } from 'vitest'
import { deriveCombatStats } from '../character/character.ts'
import { draftCharacter, newDraft } from '../character/creation.ts'
import { READY_MADE } from '../game/party.ts'
import { draftInfo } from './draftInfo.ts'

describe('draftInfo', () => {
  it("tells the soldier's skill, numbers, attributes, gear and perks", () => {
    const [aldric] = READY_MADE
    const stats = deriveCombatStats(draftCharacter(aldric))
    const lines = draftInfo(aldric)
    expect(lines[0]).toMatch(/^Melee Weapons \d+%$/)
    expect(lines[1]).toBe(`HP ${stats.maxHp}  AP ${stats.actionPoints}  AC ${stats.ac}  Mana -`)
    expect(lines[2]).toBe('STR 9  PER 3  END 7  INT 3  AGI 6  LUC 4')
    expect(lines[3]).toBe('Holds: Iron Longsword, Oak Shield')
    expect(lines[4]).toBe('Perks: Weapon Training, Toughness, Heavy Hand')
  })

  it('gives a caster its mana', () => {
    const delwyn = READY_MADE[2]
    expect(draftInfo(delwyn)[1]).toContain(`Mana ${deriveCombatStats(draftCharacter(delwyn)).magic!.maxMana}`)
  })

  it('counts the ranks of a perk taken twice, and says so of a draft with nothing chosen', () => {
    expect(draftInfo({ ...READY_MADE[0], perks: ['weapon_training', 'weapon_training', 'toughness'] })[4]).toBe(
      'Perks: Weapon Training x2, Toughness',
    )
    const blank = draftInfo(newDraft())
    expect(blank[0]).toBe('No tagged skill')
    expect(blank[4]).toBe('Perks: none')
  })
})
