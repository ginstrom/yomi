import { describe, expect, it } from 'vitest'
import type { AbilityId } from '../combat/abilities.ts'
import { GOBLIN_STATS, type CombatantStats } from '../combat/combat.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { hex } from '../grid/hex.ts'
import { describeStatuses, skillMenuRows, targetingHint } from './skillMenu.ts'

const MAGIC = { maxMana: 5, skill: 60, spells: [] as const }

/** A hero of `stats` beside a goblin (or with the goblin `gap` hexes off), and the engine's view of it. */
function battle(stats: Partial<CombatantStats>, gap = 1) {
  const hero = { ...GOBLIN_STATS, name: 'Aldric', ...stats }
  const engine = new BattleEngine({
    board: { cols: 10, rows: 3 },
    units: [
      { id: 'hero', side: 'player', stats: hero, position: hex(0, 1) },
      { id: 'goblin', side: 'enemy', stats: GOBLIN_STATS, position: hex(gap, 1) },
    ],
  })
  const state = engine.getState()
  return { engine, unit: state.units[0], units: state.units, legal: engine.legalActions('hero') }
}

const abilities = (...ids: AbilityId[]) => ({ abilities: ids })

describe('skillMenuRows', () => {
  it('lists every spell the unit knows, enabled when a cast of it is legal now', () => {
    const { unit, units, legal } = battle({ magic: { ...MAGIC, spells: ['heal', 'fireball', 'magic_arrow'] } }, 4)
    expect(skillMenuRows(unit, legal, units)).toEqual([
      { kind: 'spell', id: 'magic_arrow', label: 'Magic Arrow  3 mana  4 AP', enabled: true },
      // Too dear for 5 mana.
      { kind: 'spell', id: 'fireball', label: 'Fireball  10 mana  6 AP', enabled: false, why: 'Needs 10 mana' },
      { kind: 'spell', id: 'heal', label: 'Heal  3 mana  4 AP', enabled: true },
    ])
  })

  it('gives a spell the AP the caster pays, its discounts taken off', () => {
    const { unit, legal } = battle({ magic: { ...MAGIC, spells: ['heal'], apDiscount: { heal: 1 } } })
    expect(skillMenuRows(unit, legal)[0].label).toBe('Heal  3 mana  3 AP')
  })

  it('lists spells first, then abilities in ABILITY_IDS order', () => {
    const { unit, legal } = battle({ ...abilities('sprint', 'taunt', 'pin'), magic: { ...MAGIC, spells: ['heal'] } })
    expect(skillMenuRows(unit, legal).map(({ kind, id }) => `${kind}:${id}`)).toEqual(['spell:heal', 'ability:taunt', 'ability:pin', 'ability:sprint'])
  })

  it('labels a technique with its mana and the AP of the weapon held now', () => {
    const sword = battle({ ...abilities('taunt', 'pin', 'power_attack'), magic: MAGIC })
    expect(skillMenuRows(sword.unit, sword.legal).map((row) => row.label)).toEqual(['Power Attack  7 AP', 'Taunt  3 AP', 'Pin  3 mana  6 AP'])
    const dagger = battle({ ...abilities('pin', 'power_attack'), magic: MAGIC, attackApCost: 3 })
    expect(skillMenuRows(dagger.unit, dagger.legal).map((row) => row.label)).toEqual(['Power Attack  5 AP', 'Pin  3 mana  4 AP'])
  })

  it('enables an ability only when the engine lists a use of it', () => {
    const near = battle({ ...abilities('taunt', 'pin'), magic: MAGIC })
    expect(skillMenuRows(near.unit, near.legal).map((row) => row.enabled)).toEqual([true, true])
    // Too far for Pin's blow, and for Taunt's 2 hexes.
    const far = battle({ ...abilities('taunt', 'pin'), magic: MAGIC }, 4)
    expect(skillMenuRows(far.unit, far.legal, far.units).map(({ enabled, why }) => [enabled, why])).toEqual([
      [false, 'No foe in range'],
      [false, 'No foe in range'],
    ])
  })

  it('says how long a recharging ability has left', () => {
    const { engine } = battle({ ...abilities('taunt'), actionPoints: 20 })
    engine.step({ type: 'ability', unit: 'hero', ability: 'taunt', at: hex(0, 1) })
    const [row] = skillMenuRows(engine.getState().units[0], engine.legalActions('hero'), engine.getState().units)
    expect(row).toEqual({ kind: 'ability', id: 'taunt', label: 'Taunt  3 AP', enabled: false, readyIn: 2, why: 'Recharging (ready in 2)' })
  })

  it('says a technique needs a melee or a ranged weapon when the one held is not', () => {
    const bow = battle({ ...abilities('power_attack', 'aimed_shot'), attackRange: 5, attackApCost: 4 }, 3)
    expect(skillMenuRows(bow.unit, bow.legal)).toEqual([
      { kind: 'ability', id: 'power_attack', label: 'Power Attack  6 AP', enabled: false, why: 'Needs a melee weapon' },
      { kind: 'ability', id: 'aimed_shot', label: 'Aimed Shot  6 AP', enabled: true },
    ])
    const sword = battle({ ...abilities('power_attack', 'aimed_shot') })
    expect(skillMenuRows(sword.unit, sword.legal)[1]).toMatchObject({ enabled: false, why: 'Needs a ranged weapon' })
    // A reach weapon is a melee weapon.
    const spear = battle({ ...abilities('aimed_shot'), attackRange: 2, reach: true })
    expect(skillMenuRows(spear.unit, spear.legal)[0].why).toBe('Needs a ranged weapon')
  })

  it('lists nothing for a unit with neither spells nor abilities', () => {
    const { engine } = battle({})
    expect(skillMenuRows(engine.getState().units[1], engine.legalActions())).toEqual([])
  })
})

describe('why a skill is greyed', () => {
  it('says how much AP it needs when the unit has too few left', () => {
    const { unit, units } = battle({ ...abilities('taunt'), magic: { ...MAGIC, spells: ['heal'] } })
    const spent = { ...unit, ap: 2 }
    expect(skillMenuRows(spent, [], units).map((row) => row.why)).toEqual(['Needs 4 AP', 'Needs 3 AP'])
  })

  it('says how much mana it needs when the unit has too little left', () => {
    const { unit, units } = battle({ ...abilities('pin'), magic: { ...MAGIC, spells: ['heal'] } })
    expect(skillMenuRows({ ...unit, mana: 2 }, [], units).map((row) => row.why)).toEqual(['Needs 3 mana', 'Needs 3 mana'])
  })

  it('checks the weapon first, then once a battle, the recharge, mana, AP and range, in that order', () => {
    const { unit, units } = battle({ ...abilities('aimed_shot', 'taunt') }, 4)
    const rows = skillMenuRows({ ...unit, ap: 0, recharging: { taunt: 1 } }, [], units)
    expect(rows.map((row) => row.why)).toEqual(['Recharging (ready in 1)', 'Needs a ranged weapon'])
  })

  it('says a hostile area has no foe within its reach, its radius included', () => {
    const near = battle({ magic: { ...MAGIC, maxMana: 30, spells: ['fireball'] } }, 7)
    // Fireball reaches 6 hexes and bursts 1 more.
    expect(skillMenuRows(near.unit, [], near.units)[0].why).toBe('Not now')
    const far = battle({ magic: { ...MAGIC, maxMana: 30, spells: ['fireball'] } }, 8)
    expect(skillMenuRows(far.unit, [], far.units)[0].why).toBe('No foe in range')
  })

  it('falls back on "Not now" only when nothing else tells', () => {
    const { unit, units } = battle({ ...abilities('taunt') })
    expect(skillMenuRows(unit, [], units)[0].why).toBe('Not now')
    // An enabled row gives no reason.
    expect(skillMenuRows(unit, battle({ ...abilities('taunt') }).legal, units)[0].why).toBeUndefined()
  })
})

describe('Revive in the Skills list', () => {
  const reviver = { magic: { ...MAGIC, maxMana: 30, spells: ['revive'] as const } }
  const revive = { type: 'cast', unit: 'hero', spell: 'revive', target: 'ally' } as const

  it('is enabled only when the engine lists a cast of it', () => {
    const { unit } = battle(reviver)
    expect(skillMenuRows(unit, [])[0]).toMatchObject({ id: 'revive', enabled: false })
    expect(skillMenuRows(unit, [revive])[0]).toMatchObject({ id: 'revive', enabled: true })
  })

  it('is greyed with "Once a battle" for a caster that has used it', () => {
    const { unit } = battle(reviver)
    expect(skillMenuRows({ ...unit, usedOnce: ['revive'] }, [])[0]).toMatchObject({ enabled: false, why: 'Once a battle' })
    expect(skillMenuRows({ ...unit, usedOnce: [] }, [])[0].why).not.toBe('Once a battle')
    // A spell that may be cast again and again never says so.
    expect(skillMenuRows({ ...unit, magic: { ...MAGIC, spells: ['heal'] }, usedOnce: ['revive'] }, [])[0].why).not.toBe('Once a battle')
  })

  it('says there is no target in range with no fallen ally near', () => {
    const { unit, units } = battle(reviver)
    expect(skillMenuRows(unit, [], units)[0].why).toBe('No target in range')
  })

  it('asks for a fallen ally', () => {
    expect(targetingHint({ kind: 'spell', id: 'revive' }, { name: 'Sera', attackApCost: 5, magic: { ...MAGIC } })).toMatch(
      /^Revive: choose a fallen ally \(\d+ mana, \d+ AP\)\. Esc or Cancel to go back\.$/,
    )
  })
})

describe('targetingHint', () => {
  const caster = { name: 'Aldric', attackApCost: 5, magic: { ...MAGIC } }

  it('asks for what the spell is aimed at', () => {
    expect(targetingHint({ kind: 'spell', id: 'fireball' }, caster)).toBe('Fireball: choose where (10 mana, 6 AP). Esc or Cancel to go back.')
    expect(targetingHint({ kind: 'spell', id: 'heal' }, caster)).toBe('Heal: choose an ally (3 mana, 4 AP). Esc or Cancel to go back.')
    expect(targetingHint({ kind: 'spell', id: 'bless' }, caster)).toBe('Bless: click the caster (4 mana, 4 AP). Esc or Cancel to go back.')
    expect(targetingHint({ kind: 'spell', id: 'sleep' }, caster)).toBe('Sleep: choose a foe (5 mana, 4 AP). Esc or Cancel to go back.')
    expect(targetingHint({ kind: 'spell', id: 'heal' }, { ...caster, magic: { ...MAGIC, apDiscount: { all: 1 } } })).toBe(
      'Heal: choose an ally (3 mana, 3 AP). Esc or Cancel to go back.',
    )
  })

  it('asks for a foe for a strike or a foe status, the user for a self status or an area round it, and a hex for an area', () => {
    expect(targetingHint({ kind: 'ability', id: 'pin' }, caster)).toBe('Pin: choose a foe (3 mana, 6 AP). Esc or Cancel to go back.')
    expect(targetingHint({ kind: 'ability', id: 'hunters_mark' }, caster)).toBe("Hunter's Mark: choose a foe (2 AP). Esc or Cancel to go back.")
    expect(targetingHint({ kind: 'ability', id: 'sprint' }, caster)).toBe('Sprint: click Aldric (0 AP). Esc or Cancel to go back.')
    expect(targetingHint({ kind: 'ability', id: 'taunt' }, caster)).toBe('Taunt: click Aldric (3 AP). Esc or Cancel to go back.')
    expect(targetingHint({ kind: 'ability', id: 'volley' }, { ...caster, attackApCost: 4 })).toBe('Volley: choose where (6 AP). Esc or Cancel to go back.')
  })
})

describe('describeStatuses', () => {
  it('names each status and its turns left', () => {
    expect(describeStatuses([{ id: 'blessed', turnsLeft: 2 }, { id: 'shielded', turnsLeft: 1 }])).toBe('Blessed 2, Shielded 1')
    expect(describeStatuses([])).toBe('')
  })
})
