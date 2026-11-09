import { describe, expect, it } from 'vitest'
import { maxHp, maxMana } from '../character/character.ts'
import { NATURAL_HEALING_PER_DAY, campDay, campUntilHealed, canCamp, describeCamp, partyWounded } from './camp.ts'
import { presences } from './expedition.ts'
import { newGame } from './gameState.ts'
import { restHealing } from './infirmary.ts'
import { readyMadeParty } from './party.ts'
import { monstersHere, passTurn, travel, type MonsterLocation, type WorldState } from './worldMap.ts'

/** A new game on world 1 with the ready-made three, the mage (Heal, 3 mana for 6 hp) last: the game, its world, its party and the party's members. */
function solo() {
  const game = newGame(readyMadeParty(), null, 1)
  const party = game.parties[0]
  return { game, world: game.world, party, members: party.members }
}

describe('campDay', () => {
  it('passes a turn, heals each member a hit point and fills every caster’s mana', () => {
    const { game, world, party, members } = solo()
    const [aldric, brenna, delwyn] = members
    aldric.hp = 5
    delwyn.mana = 0
    expect(campDay(game, party)?.healed).toBe(NATURAL_HEALING_PER_DAY)
    expect(world.turn).toBe(2)
    expect(aldric.hp).toBe(5 + NATURAL_HEALING_PER_DAY)
    expect(brenna.hp).toBe(maxHp(brenna))
    expect(delwyn.mana).toBe(maxMana(delwyn))
    expect(aldric.mana).toBe(0)
  })

  it('is refused among monsters', () => {
    const { game, world, party, members } = solo()
    const raiders = world.locations.find((l) => l.id === 'goblin_raiders')!
    // A sighting on the way stops the party; it goes on.
    while (!monstersHere(world, party)) travel(game, party, raiders.position)
    expect(monstersHere(world, party)).not.toBeNull()
    expect(canCamp(world, party)).toBe(false)
    members[0].hp = 1
    expect(campDay(game, party)).toBeNull()
    expect(campUntilHealed(game, party)).toBeNull()
    expect(members[0].hp).toBe(1)
  })
})

describe('campUntilHealed', () => {
  it('casts, camps a day and casts again until no one is wounded', () => {
    const { game, world, party, members } = solo()
    const [aldric, brenna, delwyn] = members
    aldric.hp = 1
    brenna.hp = 1
    delwyn.mana = 0
    const lost = members.reduce((sum, m) => sum + maxHp(m) - m.hp, 0)
    const result = campUntilHealed(game, party)!
    expect(partyWounded(members)).toBe(false)
    expect(result.rested + result.cast).toBe(lost)
    expect(result.cast).toBeGreaterThan(0)
    expect(world.turn).toBe(1 + result.days)
    // Fewer days than rest alone would take: the mage heals with each day's mana.
    expect(result.days).toBeLessThan(maxHp(aldric) - 1)
  })

  it('spends the mana in hand before camping, and camps no day for a party it heals', () => {
    const { game, world, party, members } = solo()
    members[0].hp = maxHp(members[0]) - 6
    expect(campUntilHealed(game, party)).toMatchObject({ days: 0, rested: 0, cast: 6, interruptedBy: null })
    expect(world.turn).toBe(1)
  })

  it('heals by rest alone without a caster', () => {
    const { game, party, members } = solo()
    members.pop()
    members[0].hp = maxHp(members[0]) - 4
    expect(campUntilHealed(game, party)).toMatchObject({ days: 4, rested: 4, cast: 0, interruptedBy: null })
  })

  it('keeps the day reports, for the map to tell what the other parties did', () => {
    const { game, party, members } = solo()
    members.pop()
    members[0].hp = maxHp(members[0]) - 2
    const result = campUntilHealed(game, party)!
    expect(result.reports).toHaveLength(2)
    expect(result.reports.at(-1)!.interrupt?.event).toEqual({ type: 'order_done', party: party.id })
  })
})

/** A threat-5 nest put down beside a held site, which threatens it from the next day. */
function besiege(world: WorldState, site: string): void {
  const { position } = world.locations.find((l) => l.id === site)!
  const nest: MonsterLocation = {
    id: 'besiegers', kind: 'monsters', name: 'Besiegers', position: { q: position.q + 2, r: position.r },
    encounter: 'goblin_raid', threat: 5, loot: [],
  }
  world.locations.push(nest)
}

describe('camping, interrupted', () => {
  it('breaks camp when a held site comes under threat, saying why', () => {
    const { game, world, party, members } = solo()
    members[0].hp = 1
    members.pop()
    besiege(world, 'gold_seam')
    const result = campUntilHealed(game, party)!
    expect(result.interruptedBy).toMatchObject({ type: 'site_threatened', site: 'gold_seam' })
    expect(result.days).toBe(1)
    expect(partyWounded(members)).toBe(true)
    expect(world.threatened).toContain('gold_seam')
  })

  it('does not camp once the game is over', () => {
    const { world, party } = solo()
    world.status = 'lost'
    expect(canCamp(world, party)).toBe(false)
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

describe('campUntilHealed, as it is (characterization)', () => {
  it('changes nothing where it cannot camp', () => {
    const { game, world, party, members } = solo()
    members[0].hp = 1
    world.status = 'won'
    const before = structuredClone({ world, party })
    expect(campUntilHealed(game, party)).toBeNull()
    expect(structuredClone({ world, party })).toEqual(before)
  })

  it('heals a wounded party by rest and spells, day by day, to the same hit points and mana', () => {
    const { game, world, party, members } = solo()
    const [aldric, brenna, delwyn] = members
    aldric.hp = 1
    brenna.hp = 3
    delwyn.hp = 2
    delwyn.mana = 1
    // The reports, added after the day loop, are left out: what they hold is in the rest.
    const { reports: _reports, ...result } = campUntilHealed(game, party)!
    expect({ ...result, events: result.events.length }).toEqual(RESULT)
    expect(world.turn).toBe(1 + result.days)
    expect(members.map((m) => [m.hp, m.mana])).toEqual(MEMBERS)
  })

  it('stops after the day the game ends', () => {
    const { game, world, party, members } = solo()
    members.pop()
    members[0].hp = 1
    let turn = world.turn
    Object.defineProperty(world, 'turn', {
      get: () => turn,
      set: (next: number) => {
        turn = next
        if (next === 3) world.status = 'won'
      },
    })
    expect(campUntilHealed(game, party)).toMatchObject({ days: 2, rested: 2, cast: 0, interruptedBy: null })
    expect(members[0].hp).toBe(3)
  })
})

const RESULT = { days: 7, rested: 13, cast: 48, events: 36, interruptedBy: null }
const MEMBERS = [[32, 0], [18, 0], [17, 18]]

/** Two games built alike by `setup`, each moved on to the first day that brings an event. */
function eventfulTwins<T extends ReturnType<typeof solo>>(setup: () => T): [T, T] {
  const scout = setup()
  let quiet = 0
  while (passTurn(scout.world, presences(scout.game.parties)).length === 0) quiet++
  const make = () => {
    const it = setup()
    for (let day = 0; day < quiet; day++) passTurn(it.world, presences(it.game.parties))
    return it
  }
  return [make(), make()]
}

describe('campDay, as it is (characterization)', () => {
  it('rests through a day of the world: the same result, events and game as resting by hand around passTurn', () => {
    const [now, then] = eventfulTwins(() => {
      const it = solo()
      it.members[0].hp = 5
      it.members[2].hp = 3
      it.members[2].mana = 0
      return it
    })
    const turn = now.world.turn
    // By hand, as campDay did: judged where it camps, then the day, then the rest.
    const before = then.members.reduce((sum, m) => sum + m.hp, 0)
    const healing = then.members.map((m) => restHealing(then.world, then.party, m))
    const events = passTurn(then.world, presences(then.game.parties))
    for (const [i, m] of then.members.entries()) {
      m.hp = Math.min(maxHp(m), m.hp + healing[i])
      m.mana = maxMana(m)
    }
    const healed = then.members.reduce((sum, m) => sum + m.hp, 0) - before
    expect(events.length).toBeGreaterThan(0)
    expect(healed).toBe(2 * NATURAL_HEALING_PER_DAY)
    expect(campDay(now.game, now.party)).toEqual({ healed, events })
    expect(now.world.turn).toBe(turn + 1)
    expect(now.party.confronting).toBeNull()
    expect(JSON.stringify(now.game)).toBe(JSON.stringify(then.game))
  })

  it.each(['lost', 'won'] as const)('is refused, changing nothing, once the game is %s', (status) => {
    const { game, world, party, members } = solo()
    members[0].hp = 1
    world.status = status
    const before = JSON.stringify(game)
    expect(campDay(game, party)).toBeNull()
    expect(JSON.stringify(game)).toBe(before)
  })
})
