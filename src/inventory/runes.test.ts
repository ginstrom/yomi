import { describe, expect, it } from 'vitest'
import type { Element, OnHit } from '../combat/combat.ts'
import { itemById, type ItemStats } from './inventory.ts'
import {
  MAX_RANK,
  RANKS,
  RUNE_IDS,
  RUNES,
  addToPouch,
  isRuneKey,
  onHitParts,
  parseRuneKey,
  pouchCount,
  pouchKeys,
  rankNumeral,
  runeFits,
  runeLabel,
  runeName,
  runeStats,
  slotClass,
  socketLines,
  socketsOf,
  takeFromPouch,
  type Pouch,
  type Rank,
  type RuneId,
  type SlotClass,
} from './runes.ts'

const item = (id: string) => {
  const found = itemById(id)
  if (!found) throw new Error(`no item ${id}`)
  return found
}

type Ladder = [number, number, number, number]
const ward = (element: Element, ladder: Ladder) => (rank: Rank): ItemStats => ({ wards: { [element]: ladder[rank - 1] } })
const field = (key: keyof ItemStats, ladder: Ladder) => (rank: Rank): ItemStats => ({ [key]: ladder[rank - 1] })
const onHit = (entry: (rank: Rank) => OnHit) => (rank: Rank): ItemStats => ({ onHit: [entry(rank)] })
const WARDS: Ladder = [2, 4, 6, 9]

/** C1's table, written out cell by cell. */
const TABLE: Record<RuneId, Record<SlotClass, (rank: Rank) => ItemStats>> = {
  ember: {
    weapon: onHit((r) => ({ damage: [1, 2, 3, 5][r - 1], element: 'fire', ...(r >= 3 ? { status: { id: 'seared', turns: 1 } } : {}) })),
    armour: ward('fire', WARDS),
    shield: ward('fire', WARDS),
  },
  rime: {
    weapon: onHit((r) => ({ damage: [1, 2, 3, 5][r - 1], element: 'frost', ...(r >= 3 ? { status: { id: 'chilled', turns: 1 }, onCrit: true } : {}) })),
    armour: ward('frost', WARDS),
    shield: ward('frost', WARDS),
  },
  storm: { weapon: field('toHit', [3, 6, 9, 12]), armour: ward('lightning', WARDS), shield: ward('lightning', WARDS) },
  venom: {
    weapon: onHit((r) => ({ damage: [1, 2, 3, 4][r - 1], element: 'poison', ...(r >= 2 ? { status: { id: 'poisoned', turns: 3 }, onCrit: true } : {}) })),
    armour: ward('poison', WARDS),
    shield: ward('poison', WARDS),
  },
  acid: { weapon: field('armorPierce', [1, 1, 2, 3]), armour: ward('acid', WARDS), shield: ward('acid', WARDS) },
  stone: {
    weapon: (r) => ({ damage: { count: 0, sides: 0, bonus: [1, 1, 2, 3][r - 1] } }),
    armour: field('resistance', [1, 1, 2, 3]),
    shield: field('acBonus', [3, 5, 7, 10]),
  },
  wind: { weapon: field('critChance', [3, 6, 9, 12]), armour: field('acBonus', [3, 5, 7, 10]), shield: field('acBonus', [2, 4, 6, 8]) },
  life: { weapon: onHit((r) => ({ damage: 0, heal: [1, 1, 2, 3][r - 1] })), armour: field('maxHp', [4, 8, 12, 18]), shield: field('maxHp', [4, 8, 12, 18]) },
  mind: { weapon: field('spellSkill', [3, 6, 9, 12]), armour: field('maxMana', [3, 6, 9, 12]), shield: field('maxMana', [3, 6, 9, 12]) },
  dawn: {
    weapon: onHit((r) => ({ damage: [2, 3, 5, 7][r - 1], element: 'blight', bane: true })),
    armour: ward('blight', WARDS),
    shield: ward('blight', WARDS),
  },
}

describe('the runes', () => {
  it('give exactly the table in every slot class at every rank', () => {
    expect(RUNE_IDS).toHaveLength(10)
    expect(RANKS).toEqual([1, 2, 3, 4])
    expect(MAX_RANK).toBe(4)
    for (const id of RUNE_IDS) {
      for (const cls of ['weapon', 'armour', 'shield'] as const) {
        for (const rank of RANKS) expect(runeStats(id, rank, cls), `${id}${rank} ${cls}`).toEqual(TABLE[id][cls](rank))
      }
    }
  })

  it('act by slot: the main hand a weapon, the off hand a shield, every other slot armour', () => {
    expect(slotClass('mainHand')).toBe('weapon')
    expect(slotClass('offHand')).toBe('shield')
    for (const slot of ['head', 'neck', 'armor', 'cloak', 'gloves', 'belt', 'boots', 'ring1', 'ring2'] as const) expect(slotClass(slot)).toBe('armour')
  })

  it('are named by rank, and labelled with a numeral to IV', () => {
    expect(['ember1', 'ember2', 'ember3', 'ember4'].map((k) => runeName(k as 'ember1'))).toEqual([
      'Lesser Ember Rune',
      'Ember Rune',
      'Greater Ember Rune',
      'Grand Ember Rune',
    ])
    expect(runeName('storm2')).toBe('Storm Rune')
    expect(runeName('stone4')).toBe('Grand Stone Rune')
    expect(runeLabel('ember1')).toBe('Ember I')
    expect(runeLabel('storm2')).toBe('Storm II')
    expect(RANKS.map(rankNumeral)).toEqual(['I', 'II', 'III', 'IV'])
  })

  it('parse good keys and refuse bad ones', () => {
    expect(parseRuneKey('ember1')).toEqual({ id: 'ember', rank: 1 })
    expect(parseRuneKey('dawn4')).toEqual({ id: 'dawn', rank: 4 })
    for (const bad of ['ember0', 'ember5', 'fire1', 'ember', '1', 'Ember1', 'ember12', '']) {
      expect(parseRuneKey(bad), bad).toBeNull()
      expect(isRuneKey(bad), bad).toBe(false)
    }
    expect(isRuneKey('mind3')).toBe(true)
  })
})

describe('sockets', () => {
  it('come by tier, one more at Masterwork, a small slot at most 1, the uniques their own', () => {
    const sockets = (id: string) => socketsOf(item(id))
    expect(sockets('iron_sword')).toBe(0)
    expect(sockets('iron_sword@2')).toBe(0)
    expect(sockets('iron_sword@3')).toBe(1)
    expect(sockets('iron_sword@3+balanced1')).toBe(1)
    expect(sockets('steel_longsword')).toBe(1)
    expect(sockets('steel_longsword@3')).toBe(2)
    expect(sockets('steel_helm@3')).toBe(1)
    expect(sockets('emberblade')).toBe(1)
    expect(sockets('storm_wand')).toBe(1)
    expect(sockets('hawk_bow')).toBe(1)
    expect(sockets('ring_protection')).toBe(0)
    expect(sockets('shadow_cloak')).toBe(0)
  })

  it('are the same on a runed item as on its unruned one', () => {
    expect(socketsOf(item('steel_longsword@3#ember1'))).toBe(2)
    expect(socketsOf(item('emberblade#dawn1'))).toBe(1)
  })

  it('take Mind in a weapon only if it strikes with Magic', () => {
    expect(runeFits('mind', item('spark_wand'))).toBe(true)
    expect(runeFits('mind', item('ash_staff@3'))).toBe(true)
    expect(runeFits('mind', item('iron_sword@3'))).toBe(false)
    expect(runeFits('mind', item('iron_breastplate@3'))).toBe(true)
    expect(runeFits('ember', item('iron_sword@3'))).toBe(true)
  })

  it('are told in the tooltip in one line, the runes by name only (the stat lines above already hold what they do)', () => {
    expect(socketLines(item('iron_sword'))).toEqual([])
    expect(socketLines(item('steel_longsword@3'))).toEqual(['Sockets: 0 of 2'])
    expect(socketLines(item('steel_longsword@3#ember1.storm2'))).toEqual(['Sockets: 2 of 2 (Ember I, Storm II)'])
    expect(socketLines(item('steel_longsword@3#rime3'))).toEqual(['Sockets: 1 of 2 (Rime III)'])
    expect(socketLines(item('iron_sword@3#ember3'))).toEqual(['Sockets: 1 of 1 (Ember III)'])
    expect(socketLines(item('iron_sword@3#ember3')).join('\n')).not.toContain('fire')
  })
})

describe('the pouch', () => {
  it('counts what is added and taken, and leaves a key at 0 out', () => {
    const pouch: Pouch = {}
    expect(pouchCount(pouch, 'ember1')).toBe(0)
    addToPouch(pouch, 'ember1')
    addToPouch(pouch, 'ember1', 2)
    expect(pouchCount(pouch, 'ember1')).toBe(3)
    expect(takeFromPouch(pouch, 'ember1', 4)).toBe(false)
    expect(pouchCount(pouch, 'ember1')).toBe(3)
    expect(takeFromPouch(pouch, 'ember1', 2)).toBe(true)
    expect(takeFromPouch(pouch, 'ember1')).toBe(true)
    expect(pouch).toEqual({})
    expect(takeFromPouch(pouch, 'storm1')).toBe(false)
  })

  it('lists its keys in rune order, then rank', () => {
    const pouch: Pouch = {}
    addToPouch(pouch, 'dawn1')
    addToPouch(pouch, 'storm2')
    addToPouch(pouch, 'ember3')
    addToPouch(pouch, 'storm1')
    expect(pouchKeys(pouch)).toEqual(['ember3', 'storm1', 'storm2', 'dawn1'])
  })
})

describe('the words of an on-hit effect', () => {
  const entries: OnHit[] = [
    { damage: 3, element: 'frost', status: { id: 'chilled', turns: 1 }, onCrit: true },
    { damage: 0, heal: 1 },
    { damage: 2, element: 'blight', bane: true },
    { damage: 3, element: 'fire', status: { id: 'seared', turns: 1 } },
    { damage: 1 },
  ]

  it('are in the engine\'s order, damage then healing then statuses, each status by its own name', () => {
    expect(onHitParts(entries)).toEqual([
      '+3 frost',
      '+2 blight to the regenerating and the blighted',
      '+3 fire',
      '+1 damage',
      'heals 1',
      'lays Chilled on a critical',
      'lays Seared',
    ])
  })

  it('have a short form for the narrow stat column', () => {
    expect(onHitParts(entries, 'short')).toEqual(['+3 frost', '+2 blight (bane)', '+3 fire', '+1 damage', 'heals 1', 'lays Chilled on crit', 'lays Seared'])
  })

  it('are what a rune says it does in a weapon', () => {
    expect(RUNES.ember.describe.weapon(1)).toBe('On a hit, +1 fire')
    expect(RUNES.ember.describe.weapon(3)).toBe('On a hit, +3 fire, lays Seared')
    expect(RUNES.rime.describe.weapon(3)).toBe('On a hit, +3 frost, lays Chilled on a critical')
    expect(RUNES.dawn.describe.weapon(1)).toBe('On a hit, +2 blight to the regenerating and the blighted')
    expect(RUNES.life.describe.weapon(1)).toBe('On a hit, heals 1')
    expect(RUNES.ember.describe.armour(1)).toBe('Fire ward 2')
  })
})
