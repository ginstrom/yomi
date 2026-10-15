import { describe, expect, it } from 'vitest'
import { maxHp, maxMana } from '../character/character.ts'
import { NATURAL_HEALING_PER_DAY, campDay, campUntilHealed, canCamp, describeCamp, partyWounded } from './camp.ts'
import { readyMadeParty } from './party.ts'
import { monstersHere, newWorld, travel } from './worldMap.ts'

/** The ready-made three, the mage (Heal, 3 mana for 6 hp) last. */
const party = () => readyMadeParty()

describe('campDay', () => {
  it('passes a turn, heals each member a hit point and fills every caster’s mana', () => {
    const world = newWorld()
    const members = party()
    const [aldric, brenna, delwyn] = members
    aldric.hp = 5
    delwyn.mana = 0
    expect(campDay(world, members)).toBe(NATURAL_HEALING_PER_DAY)
    expect(world.turn).toBe(2)
    expect(aldric.hp).toBe(5 + NATURAL_HEALING_PER_DAY)
    expect(brenna.hp).toBe(maxHp(brenna))
    expect(delwyn.mana).toBe(maxMana(delwyn))
    expect(aldric.mana).toBe(0)
  })

  it('is refused among monsters', () => {
    const world = newWorld()
    const raiders = world.locations.find((l) => l.id === 'goblin_raiders')!
    travel(world, raiders.position)
    expect(monstersHere(world)).not.toBeNull()
    expect(canCamp(world)).toBe(false)
    const members = party()
    members[0].hp = 1
    expect(campDay(world, members)).toBeNull()
    expect(campUntilHealed(world, members)).toBeNull()
    expect(members[0].hp).toBe(1)
  })
})

describe('campUntilHealed', () => {
  it('casts, camps a day and casts again until no one is wounded', () => {
    const world = newWorld()
    const members = party()
    const [aldric, brenna, delwyn] = members
    aldric.hp = 1
    brenna.hp = 1
    delwyn.mana = 0
    const lost = members.reduce((sum, m) => sum + maxHp(m) - m.hp, 0)
    const result = campUntilHealed(world, members)!
    expect(partyWounded(members)).toBe(false)
    expect(result.rested + result.cast).toBe(lost)
    expect(result.cast).toBeGreaterThan(0)
    expect(world.turn).toBe(1 + result.days)
    // Fewer days than rest alone would take: the mage heals with each day's mana.
    expect(result.days).toBeLessThan(maxHp(aldric) - 1)
  })

  it('spends the mana in hand before camping, and camps no day for a party it heals', () => {
    const world = newWorld()
    const members = party()
    members[0].hp = maxHp(members[0]) - 6
    expect(campUntilHealed(world, members)).toEqual({ days: 0, rested: 0, cast: 6 })
    expect(world.turn).toBe(1)
  })

  it('heals by rest alone without a caster', () => {
    const world = newWorld()
    const members = party()
    members.pop()
    members[0].hp = maxHp(members[0]) - 4
    expect(campUntilHealed(world, members)).toEqual({ days: 4, rested: 4, cast: 0 })
  })
})

describe('describeCamp', () => {
  it('tells the days and the hit points healed by each means', () => {
    expect(describeCamp({ days: 3, rested: 5, cast: 12 })).toBe('Camped 3 days: 17 hp healed (5 by rest, 12 by spells).')
    expect(describeCamp({ days: 1, rested: 1, cast: 0 })).toBe('Camped 1 day: 1 hp healed (1 by rest).')
    expect(describeCamp({ days: 0, rested: 0, cast: 6 })).toBe('Your casters heal 6 hp, and no one is wounded.')
    expect(describeCamp({ days: 0, rested: 0, cast: 0 })).toBe('No one is wounded.')
  })
})
