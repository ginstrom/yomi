import { describe, expect, it } from 'vitest'
import { manaOf, maxHp, maxMana } from './character.ts'
import { levelUp } from './progression.ts'
import { castOnWorldMap, worldHealing, worldSpells } from './worldCasting.ts'
import { autoHeal, readyMadeParty } from '../game/party.ts'

/** The ready-made three, the mage (Heal and Magic Arrow, 18 mana) last. */
const party = () => readyMadeParty()

describe('worldSpells', () => {
  it('lists the healing spells a character knows, with whether it has the mana', () => {
    const [aldric, , delwyn] = party()
    expect(worldSpells(aldric)).toEqual([])
    expect(worldSpells(delwyn)).toEqual([{ spell: 'heal', affordable: true }])
    delwyn.mana = 2
    expect(worldSpells(delwyn)).toEqual([{ spell: 'heal', affordable: false }])
  })
})

describe('castOnWorldMap (A12)', () => {
  it('pays the mana and restores the average of the dice, never above the maximum', () => {
    const [aldric, , delwyn] = party()
    delwyn.mana = 7
    aldric.hp = 3
    expect(worldHealing('heal')).toBe(6)
    expect(castOnWorldMap(delwyn, 'heal', party(), aldric)).toBe(true)
    expect([delwyn.mana, aldric.hp]).toEqual([4, 9])
    aldric.hp = maxHp(aldric) - 1
    expect(castOnWorldMap(delwyn, 'heal', party(), aldric)).toBe(true)
    expect([delwyn.mana, aldric.hp]).toEqual([1, maxHp(aldric)])
  })

  it('refuses, changing nothing, without the mana, the spell or a target', () => {
    const [aldric, , delwyn] = party()
    aldric.hp = 3
    delwyn.mana = 2
    expect(castOnWorldMap(delwyn, 'heal', party(), aldric)).toBe(false)
    delwyn.mana = 18
    expect(castOnWorldMap(delwyn, 'heal', party())).toBe(false)
    expect(castOnWorldMap(delwyn, 'heal_all', party())).toBe(false)
    expect(castOnWorldMap(delwyn, 'magic_arrow', party(), aldric)).toBe(false)
    expect(castOnWorldMap(aldric, 'heal', party(), aldric)).toBe(false)
    expect([delwyn.mana, aldric.hp]).toEqual([18, 3])
  })

  it('heals the whole party with a spell centred on the caster', () => {
    const members = party()
    const delwyn = members[2]
    delwyn.perks = { ...delwyn.perks, heal_all: 1 }
    delwyn.level = 3
    delwyn.mana = 20
    for (const member of members) member.hp = 2
    expect(castOnWorldMap(delwyn, 'heal_all', members)).toBe(true)
    expect(members.map((m) => m.hp)).toEqual([6, 6, 6])
    expect(delwyn.mana).toBe(12)
  })

  it('reads the mana carried within the maximum as it stands', () => {
    const [, , delwyn] = party()
    delwyn.mana = 100
    expect(manaOf(delwyn)).toBe(maxMana(delwyn))
  })
})

describe('autoHeal', () => {
  it('spends the party’s leftover mana on whoever has lost most, while a heal is not wasted', () => {
    const members = party()
    const [aldric, brenna, delwyn] = members
    aldric.hp = 2
    brenna.hp = maxHp(brenna) - 3
    delwyn.mana = 10
    expect(autoHeal(members)).toBe(18)
    expect(aldric.hp).toBe(20)
    // Three Heals cost 9; Brenna's 3 lost is less than a Heal restores.
    expect(delwyn.mana).toBe(1)
  })

  it('heals nothing without a healer, a wound or the mana', () => {
    const members = party()
    expect(autoHeal(members)).toBe(0)
    members[0].hp = 1
    members[2].mana = 0
    expect(autoHeal(members)).toBe(0)
  })
})

describe('mana on the character', () => {
  it('is full after a level', () => {
    const [, , delwyn] = party()
    delwyn.mana = 1
    levelUp(delwyn)
    expect(delwyn.mana).toBe(maxMana(delwyn))
  })
})
