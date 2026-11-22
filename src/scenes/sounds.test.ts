import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ABILITIES, ABILITY_IDS, type AbilityId } from '../combat/abilities.ts'
import { mulberry32 } from '../combat/rng.ts'
import { ALL_SPELL_IDS, type SpellId } from '../combat/spells.ts'
import { BattleEngine, type AbilityEvent, type AttackEvent, type BattleEndEvent, type BattleEvent, type CastEvent, type Side, type StatusTickEvent } from '../engine/battleEngine.ts'
import { POLICIES } from '../engine/policies.ts'
import { ENCOUNTERS, FOE_XP, type UnitKind } from '../game/encounters.ts'
import { partyFighters, readyMadeParty } from '../game/party.ts'
import { FAMILIES } from '../inventory/catalog.ts'
import { MAGIC_ITEMS, type ItemIcon } from '../inventory/inventory.ts'
import manifest from '../../audio/sfx.manifest.json'
import { MOVE_STEP_MS, impactMs } from './battleEffects.ts'
import {
  BANKS,
  CUES,
  ABILITY_SOUNDS,
  DEATH,
  FOE_SOUNDS,
  GLOBAL_VOICE_CAP,
  MUSIC_KEYS,
  STING_DELAY_MS,
  WEAPON_SOUNDS,
  admitPlay,
  bankFiles,
  cueBank,
  cueDurationMs,
  cueMarkers,
  eventSounds,
  levelUpDelayMs,
  musicFiles,
  newLimitState,
  newVariantState,
  pickVariant,
  spellSound,
  stepCue,
  refusalCue,
  buttonCue,
  reportEvents,
  runeCue,
  worldSounds,
  WORLD_SOUND_GAP_MS,
  type CueId,
  type SoundContext,
  type SoundCue,
} from './sounds.ts'

const ROOT = join(import.meta.dirname, '../..')
const CUE_IDS = Object.keys(CUES) as CueId[]

function attack(hit: boolean, critical = false): AttackEvent {
  return {
    type: 'attack', seq: 0, round: 1, attacker: 'goblin', defender: 'hero', opportunity: false,
    weapon: null, distance: 1, melee: true, apCost: 2, apAfter: 0, toHit: 70, defenderAc: 15, defenderResistance: 0, armorPierce: 0,
    damageDice: { count: 1, sides: 6, bonus: 0 }, rolled: 3, defenderHpBefore: 10,
    flankers: [], flankBonus: 0, defenderTurned: false, defenderFacing: 0, arc: 'front', arcBonus: 0, attackerFacing: 3, helpless: false, image: false,
    attackRoll: 40, chance: 55, hit, critical, fumble: false, damage: hit ? 3 : 0, defenderHpAfter: 7, bonus: [],
  }
}

function cast(hit: boolean, critical = false, spell: SpellId = 'magic_arrow'): CastEvent {
  return {
    type: 'cast', seq: 0, round: 1, caster: 'hero', spell, target: 'goblin', at: { q: 4, r: 0 }, distance: 4,
    apCost: 4, apAfter: 4, manaCost: 3, manaAfter: 15, casterFacing: 0, skill: 76, drained: 0,
    outcomes: [
      {
        unit: 'goblin', attackRoll: 40, chance: 61, defenderAc: 15, hit, critical, fumble: false, image: false,
        damage: hit ? 5 : 0, warded: 0, half: false, healed: 0, hpBefore: 12, hpAfter: hit ? 7 : 12, status: null,
      },
    ],
  }
}

function battleEnd(winner: Side | null): BattleEndEvent {
  return { type: 'battle_end', seq: 0, round: 3, winner, reason: winner ? 'defeat' : 'abandoned', survivors: {} }
}

describe('the cue table', () => {
  it('has exactly the manifest’s cues, all 85 of the W1 catalogue', () => {
    expect(CUE_IDS.sort()).toEqual(Object.keys(manifest.cues).sort())
    expect(CUE_IDS).toHaveLength(85)
  })

  it('finds every marker of every cue in its bank’s spritemap', () => {
    const spritemaps = Object.fromEntries(
      BANKS.map((bank) => [bank, JSON.parse(readFileSync(join(ROOT, 'public', bankFiles(bank).json), 'utf8')).spritemap]),
    )
    for (const cue of CUE_IDS) {
      const markers = cueMarkers(cue)
      expect(markers.length, cue).toBeGreaterThan(0)
      for (const marker of markers) expect(spritemaps[cueBank(cue)][marker], marker).toBeDefined()
      expect(cueDurationMs(cue)).toBeGreaterThan(0)
    }
  })

  it('names bank and theme files that exist on disk', () => {
    expect(BANKS).toEqual(['ui', 'battle', 'world', 'stings'])
    expect(bankFiles('battle')).toEqual({
      json: 'assets/audio/sfx/battle.json',
      audio: ['assets/audio/sfx/battle.opus', 'assets/audio/sfx/battle.mp3'],
    })
    for (const bank of BANKS) {
      const { json, audio } = bankFiles(bank)
      for (const file of [json, ...audio]) expect(existsSync(join(ROOT, 'public', file)), file).toBe(true)
    }
    expect(MUSIC_KEYS).toEqual(['music_battle', 'music_world_map'])
    expect(musicFiles('music_battle')).toEqual(['assets/audio/music_battle.opus', 'assets/audio/music_battle.mp3'])
    for (const key of MUSIC_KEYS) for (const file of musicFiles(key)) expect(existsSync(join(ROOT, 'public', file))).toBe(true)
  })

  it('puts each cue on its bus by its bank', () => {
    for (const cue of CUE_IDS) {
      const bus = cue.startsWith('ui.') ? 'ui' : cue.startsWith('stings.') ? 'music' : 'effects'
      expect(CUES[cue].bus, cue).toBe(bus)
    }
  })

  it('jitters pitch and volume by the defaults, steps most, stings and the Source not at all', () => {
    expect(CUES['battle.hit.slash']).toMatchObject({ detuneCents: 40, volumeJitterDb: 1.5 })
    expect(CUES['world.coins']).toMatchObject({ detuneCents: 40, volumeJitterDb: 1.5 })
    expect(CUES['battle.step.light']).toMatchObject({ detuneCents: 100, volumeJitterDb: 1.5 })
    expect(CUES['ui.click']).toMatchObject({ detuneCents: 20, volumeJitterDb: 0.5 })
    expect(CUES['stings.victory']).toMatchObject({ detuneCents: 0, volumeJitterDb: 0 })
    expect(CUES['world.source']).toMatchObject({ detuneCents: 0, volumeJitterDb: 1.5 })
  })

  it('limits steps and impacts to 3 voices and elements to 2', () => {
    for (const cue of ['battle.step.armored', 'battle.step.skitter', 'battle.hit.slash', 'battle.miss.shot', 'battle.impact.heal'] as const) {
      expect(CUES[cue].maxVoices, cue).toBe(3)
    }
    expect(CUES['battle.element.fire'].maxVoices).toBe(2)
    expect(CUES['battle.element.blight'].maxVoices).toBe(2)
    for (const cue of ['battle.swing.blade', 'battle.armor.metal', 'battle.death.human', 'ui.click', 'world.coins'] as const) {
      expect(CUES[cue].maxVoices, cue).toBeUndefined()
    }
  })
})

describe('pickVariant', () => {
  function plays(cue: CueId, n: number): string[] {
    const state = newVariantState()
    return Array.from({ length: n }, () => pickVariant(state, cue, Math.random).marker)
  }

  it.each(['battle.element.fire', 'battle.hit.slash'] as const)('never repeats the marker just played (%s)', (cue) => {
    const markers = plays(cue, 10_000)
    for (let i = 1; i < markers.length; i++) expect(markers[i]).not.toBe(markers[i - 1])
  })

  it.each(['battle.element.fire', 'battle.hit.slash'] as const)('uses each marker evenly, a bag at a time (%s)', (cue) => {
    const v = cueMarkers(cue).length
    const markers = plays(cue, 10_000)
    const counts = new Map<string, number>()
    markers.forEach((marker, i) => {
      counts.set(marker, (counts.get(marker) ?? 0) + 1)
      const n = i + 1
      for (const m of cueMarkers(cue)) {
        const count = counts.get(m) ?? 0
        expect(Math.abs(count - n / v)).toBeLessThanOrEqual(1)
        if (n % v === 0) expect(count).toBe(n / v)
      }
    })
  })

  it('jitters within the cue’s ranges, and not at all for a sting', () => {
    const state = newVariantState()
    for (let i = 0; i < 1000; i++) {
      const { detune, volumeDb } = pickVariant(state, 'battle.hit.slash', Math.random)
      expect(Math.abs(detune)).toBeLessThanOrEqual(40)
      expect(Math.abs(volumeDb)).toBeLessThanOrEqual(1.5)
    }
    const spread = Array.from({ length: 200 }, () => pickVariant(state, 'battle.step.light', Math.random).detune)
    expect(Math.max(...spread)).toBeGreaterThan(50)
    expect(Math.min(...spread)).toBeLessThan(-50)
    for (let i = 0; i < 20; i++) expect(pickVariant(state, 'stings.victory', Math.random)).toEqual({ marker: 'stings.victory#0', detune: 0, volumeDb: 0 })
  })

  it('plays a one-variant cue’s marker every time', () => {
    expect(new Set(plays('battle.death.horror', 50))).toEqual(new Set(['battle.death.horror#0']))
  })

  it('draws only from the random it is given', () => {
    const scripted = () => 0.5
    const a = newVariantState()
    const b = newVariantState()
    for (let i = 0; i < 30; i++) expect(pickVariant(a, 'ui.gear', scripted)).toEqual(pickVariant(b, 'ui.gear', scripted))
  })

  it('never reaches the battle’s or the world’s seeded random', () => {
    for (const file of ['sounds.ts', 'soundPlayer.ts']) {
      const text = readFileSync(join(import.meta.dirname, file), 'utf8')
      expect(text, file).not.toMatch(/mulberry32|combat\/rng|from '\.\.\/engine\/(?!battleEngine)/)
      // battleEngine.ts is imported for its event types only.
      expect(text, file).not.toMatch(/^import (?!type)[^\n]*battleEngine/m)
    }
  })
})

describe('admitPlay', () => {
  it('drops a fourth concurrent step and admits one once a step ends', () => {
    const state = newLimitState()
    for (let i = 0; i < 3; i++) expect(admitPlay(state, 'battle.step.light', 0, 200)).toBe(true)
    expect(admitPlay(state, 'battle.step.light', 100, 300)).toBe(false)
    expect(admitPlay(state, 'battle.step.heavy', 100, 300)).toBe(true)
    expect(admitPlay(state, 'battle.step.light', 200, 400)).toBe(true)
  })

  it('drops a play within the cue’s minimum gap', () => {
    const state = newLimitState()
    const spec = CUES['ui.click']
    const before = spec.minGapMs
    spec.minGapMs = 50
    try {
      expect(admitPlay(state, 'ui.click', 0, 60)).toBe(true)
      expect(admitPlay(state, 'ui.click', 30, 90)).toBe(false)
      expect(admitPlay(state, 'ui.click', 50, 110)).toBe(true)
    } finally {
      spec.minGapMs = before
    }
  })

  it('drops the newest effects or ui play beyond the global cap', () => {
    const state = newLimitState()
    const free = CUE_IDS.filter((cue) => CUES[cue].maxVoices === undefined && CUES[cue].bus !== 'music')
    for (let i = 0; i < GLOBAL_VOICE_CAP; i++) expect(admitPlay(state, free[i % free.length], 0, 1000)).toBe(true)
    expect(admitPlay(state, 'ui.click', 0, 1000)).toBe(false)
    expect(admitPlay(state, 'world.coins', 0, 1000)).toBe(false)
    // The music bus is not counted.
    expect(admitPlay(state, 'stings.victory', 0, 1000)).toBe(true)
    expect(admitPlay(state, 'ui.click', 1000, 1060)).toBe(true)
  })
})

// ---- battle mapping ----------------------------------------------------------

type Stub = { kinds?: Record<string, UnitKind>; held?: Record<string, ItemIcon | null>; body?: Record<string, ItemIcon | null> }
const ctx = ({ kinds = {}, held = {}, body = {} }: Stub): SoundContext => ({
  kind: (u) => kinds[u] ?? null,
  held: (u) => held[u] ?? null,
  body: (u) => body[u] ?? null,
})
const hero = (icon: ItemIcon | null, body: ItemIcon | null = null): Stub => ({ kinds: { hero: 'warrior' }, held: { hero: icon }, body: { hero: body } })
const cues = (events: SoundCue[]) => events.map((e) => e.cue)

function strike(patch: Partial<AttackEvent> = {}, attacker = 'hero', defender = 'goblin'): AttackEvent {
  return { ...attack(true), attacker, defender, ...patch }
}

describe('eventSounds: attacks by class', () => {
  const impact = impactMs(attack(true))
  it.each([
    ['dagger', 'battle.swing.light', 'battle.hit.pierce', 'battle.miss.swing'],
    ['shortsword', 'battle.swing.light', 'battle.hit.slash', 'battle.miss.swing'],
    ['sword', 'battle.swing.blade', 'battle.hit.slash', 'battle.miss.swing'],
    ['greatsword', 'battle.swing.heavy', 'battle.hit.slash', 'battle.miss.swing'],
    ['mace', 'battle.swing.heavy', 'battle.hit.crush', 'battle.miss.swing'],
    ['spear', 'battle.swing.thrust', 'battle.hit.pierce', 'battle.miss.swing'],
    ['bow', 'battle.shot.bow', 'battle.hit.pierce', 'battle.miss.shot'],
    ['crossbow', 'battle.shot.crossbow', 'battle.hit.pierce', 'battle.miss.shot'],
    ['wand', 'battle.shot.wand', 'battle.hit.magic', 'battle.miss.magic'],
  ] as const)('a hero with a %s releases %s, then %s or %s', (icon, release, hit, miss) => {
    const c = ctx(hero(icon))
    const shot = release.startsWith('battle.shot')
    const e = (h: boolean) => strike({ hit: h, melee: !shot, distance: shot ? 3 : 1 })
    expect(eventSounds(e(true), c)).toEqual([
      { cue: release, delayMs: 0 },
      { cue: hit, delayMs: impactMs(e(true)) },
    ])
    expect(eventSounds(e(false), c)).toEqual([
      { cue: release, delayMs: 0 },
      { cue: miss, delayMs: impactMs(e(false)) },
    ])
  })

  it('treats bare hands as the light class, landing as a crush', () => {
    expect(eventSounds(strike(), ctx(hero(null)))).toEqual([
      { cue: 'battle.swing.light', delayMs: 0 },
      { cue: 'battle.hit.crush', delayMs: impact },
    ])
  })

  it.each([
    ['goblin', 'battle.swing.light', 'battle.hit.slash'],
    ['kobold', 'battle.swing.light', 'battle.hit.pierce'],
    ['bandit_captain', 'battle.swing.blade', 'battle.hit.slash'],
    ['hobgoblin', 'battle.swing.heavy', 'battle.hit.crush'],
    ['troll', 'battle.swing.claw', 'battle.hit.claw'],
    ['giant_spider', 'battle.swing.bite', 'battle.hit.claw'],
    ['bandit_archer', 'battle.shot.bow', 'battle.hit.pierce'],
    ['bandit_crossbowman', 'battle.shot.crossbow', 'battle.hit.pierce'],
    ['bandit_mage', 'battle.shot.wand', 'battle.hit.magic'],
  ] as const)('a %s releases %s and hits with %s', (kind, release, hit) => {
    const got = cues(eventSounds(strike({ attacker: 'foe', defender: 'hero' }), ctx({ kinds: { foe: kind, hero: 'warrior' } })))
    expect(got.slice(0, 2)).toEqual([release, hit])
  })

  it('hears a routine’s strikes as the attacker’s class', () => {
    const e = strike({ attacker: 'foe', defender: 'hero', ability: 'troll_claws', strike: 'claw' })
    expect(cues(eventSounds(e, ctx({ kinds: { foe: 'troll', hero: 'warrior' } })))).toEqual(['battle.swing.claw', 'battle.hit.claw'])
  })

  it('adds the metal sweetener for a breastplate, plate, a hobgoblin and not for leather or a goblin', () => {
    const armoured = (defender: string, s: Stub) => cues(eventSounds(strike({ attacker: 'foe', defender }), ctx({ ...s, kinds: { foe: 'goblin', ...s.kinds } })))
    expect(armoured('h', { kinds: { h: 'warrior' }, body: { h: 'armor' } })).toContain('battle.armor.metal')
    expect(armoured('h', { kinds: { h: 'warrior' }, body: { h: 'plate' } })).toContain('battle.armor.metal')
    expect(armoured('h', { kinds: { h: 'hobgoblin' } })).toContain('battle.armor.metal')
    expect(armoured('h', { kinds: { h: 'bandit_brute' } })).toContain('battle.armor.metal')
    expect(armoured('h', { kinds: { h: 'goblin' } })).not.toContain('battle.armor.metal')
    expect(armoured('h', { kinds: { h: 'warrior' }, body: { h: 'leather' } })).not.toContain('battle.armor.metal')
    expect(armoured('h', { kinds: { h: 'warrior' }, body: { h: 'robe' } })).not.toContain('battle.armor.metal')
    expect(armoured('h', { kinds: { h: 'warrior' } })).not.toContain('battle.armor.metal')
    // Never on a miss.
    const miss = cues(eventSounds(strike({ hit: false, defender: 'h' }), ctx({ kinds: { h: 'hobgoblin' } })))
    expect(miss).not.toContain('battle.armor.metal')
  })

  it('adds the crit sweetener', () => {
    const got = eventSounds(strike({ critical: true }), ctx(hero('sword')))
    expect(got).toContainEqual({ cue: 'battle.hit.crit', delayMs: impact })
  })

  it('adds an element sweetener at +30 ms for each of the first two on-hit entries, a bane as blight', () => {
    const one = eventSounds(strike({ bonus: [{ element: 'fire', rolled: 3, damage: 3 }] }), ctx(hero('sword')))
    expect(one).toContainEqual({ cue: 'battle.element.fire', delayMs: impact + 30 })
    const bonus = [
      { element: 'frost', rolled: 2, damage: 2 },
      { bane: true, rolled: 2, damage: 2 },
      { element: 'lightning', rolled: 2, damage: 2 },
    ] as AttackEvent['bonus']
    const three = eventSounds(strike({ bonus }), ctx(hero('sword')))
    expect(cues(three).filter((c) => c.startsWith('battle.element.'))).toEqual(['battle.element.frost', 'battle.element.blight'])
    // An entry with neither an element nor a bane is silent.
    expect(cues(eventSounds(strike({ bonus: [{ rolled: 2, damage: 2 }] }), ctx(hero('sword'))))).toEqual(['battle.swing.blade', 'battle.hit.slash'])
    // Warded to nothing: silent.
    expect(cues(eventSounds(strike({ bonus: [{ element: 'fire', rolled: 3, damage: 0 }] }), ctx(hero('sword'))))).not.toContain('battle.element.fire')
  })

  it('adds a small heal at +60 ms when the hit healed the attacker', () => {
    expect(eventSounds(strike({ healed: 2 }), ctx(hero('sword')))).toContainEqual({ cue: 'battle.heal.small', delayMs: impact + 60 })
  })

  it('hears a blow that struck a mirror image as that and nothing else after the release', () => {
    expect(eventSounds(strike({ image: true }), ctx(hero('sword')))).toEqual([
      { cue: 'battle.swing.blade', delayMs: 0 },
      { cue: 'battle.hit.image', delayMs: impact },
    ])
  })

  it('falls back to a blade for a melee blow and a bow for a shot when it knows nothing of the attacker', () => {
    expect(cues(eventSounds(strike()))).toEqual(['battle.swing.blade', 'battle.hit.slash'])
    expect(cues(eventSounds(strike({ melee: false, distance: 3, hit: false })))).toEqual(['battle.shot.bow', 'battle.miss.shot'])
    expect(cues(eventSounds(strike(), ctx({})))).toEqual(['battle.swing.blade', 'battle.hit.slash'])
  })
})

describe('eventSounds: spells and abilities', () => {
  const at = (e: CastEvent) => impactMs(e)
  it.each([
    ['magic_arrow', 'battle.cast.arcane', 'battle.impact.arcane'],
    ['flame_arrow', 'battle.cast.fire', 'battle.impact.fire'],
    ['frost_blast', 'battle.cast.frost', 'battle.impact.frost'],
    ['lightning_bolt', 'battle.cast.storm', 'battle.impact.lightning'],
    ['acid_arrow', 'battle.cast.venom', 'battle.impact.acid'],
    ['death_cloud', 'battle.cast.venom', 'battle.impact.poison'],
    ['heal', 'battle.cast.holy', 'battle.impact.heal'],
    ['protect', 'battle.cast.ward', 'battle.impact.buff'],
    ['fireball', 'battle.cast.fire', 'battle.impact.fireball'],
    ['sleep', 'battle.cast.arcane', 'battle.impact.hex'],
    ['curse', 'battle.cast.shadow', 'battle.impact.hex'],
    ['drain_life', 'battle.cast.shadow', 'battle.impact.shadow'],
    ['bless', 'battle.cast.holy', 'battle.impact.buff'],
    ['dark_shield', 'battle.cast.shadow', 'battle.impact.buff'],
    ['web', 'battle.cast.arcane', 'battle.impact.web'],
    ['holy_light', 'battle.cast.holy', 'battle.element.blight'],
    ['meteor', 'battle.cast.fire', 'battle.impact.fireball'],
    ['glacial_prison', 'battle.cast.frost', 'battle.impact.frost'],
    ['ice_lance', 'battle.cast.frost', 'battle.impact.frost'],
    ['renew', 'battle.cast.holy', 'battle.impact.buff'],
    ['purify', 'battle.cast.holy', 'battle.impact.heal'],
    ['revive', 'battle.cast.holy', 'battle.impact.heal'],
  ] as const)('%s casts %s and lands as %s', (spell, release, impactCue) => {
    expect(spellSound(spell)).toEqual({ cast: release, impact: impactCue })
  })

  it('casts, then lands a hostile spell as its impact, with a crit sweetener', () => {
    const e = cast(true, true, 'flame_arrow')
    expect(eventSounds(e)).toEqual([
      { cue: 'battle.cast.fire', delayMs: 0 },
      { cue: 'battle.impact.fire', delayMs: at(e) },
      { cue: 'battle.hit.crit', delayMs: at(e) },
    ])
  })

  it('chimes a friendly spell, and hears an image-only cast and a miss', () => {
    const heal = cast(true, false, 'heal')
    expect(eventSounds(heal)).toEqual([
      { cue: 'battle.cast.holy', delayMs: 0 },
      { cue: 'battle.impact.heal', delayMs: at(heal) },
    ])
    const image = cast(true)
    image.outcomes[0].image = true
    expect(cues(eventSounds(image))).toEqual(['battle.cast.arcane', 'battle.hit.image'])
    expect(cues(eventSounds(cast(false)))).toEqual(['battle.cast.arcane', 'battle.miss.magic'])
  })

  it('adds a small heal 150 ms after the landing of a drain', () => {
    const e = { ...cast(true, false, 'drain_life'), drained: 3 }
    expect(eventSounds(e)).toContainEqual({ cue: 'battle.heal.small', delayMs: at(e) + 150 })
  })

  describe('an area ability', () => {
    const ability = (id: AbilityId, hit: boolean, half: boolean): AbilityEvent => ({
      type: 'ability', seq: 0, round: 1, unit: 'foe', ability: id, at: { q: 2, r: 0 }, shape: 'cone',
      hexes: [], distance: 2, apCost: 4, apAfter: 4, facing: 0, skill: 70,
      outcomes: [
        {
          unit: 'hero', attackRoll: 40, chance: 61, defenderAc: 15, hit, critical: false, fumble: false, image: false,
          damage: hit ? 9 : half ? 4 : 0, warded: 0, half, healed: 0, hpBefore: 12, hpAfter: 5, status: null,
        },
      ],
    })
    it.each([
      ['fire_spit', 'battle.ability.spit', 'battle.impact.fire'],
      ['spider_web', 'battle.ability.web', 'battle.impact.web'],
    ] as const)('%s releases %s and lands as %s, also on half damage, and misses as magic', (id, release, impactCue) => {
      const struck = ability(id, true, false)
      expect(eventSounds(struck)).toEqual([
        { cue: release, delayMs: 0 },
        { cue: impactCue, delayMs: impactMs(struck) },
      ])
      expect(cues(eventSounds(ability(id, false, true)))).toEqual([release, impactCue])
      expect(cues(eventSounds(ability(id, false, false)))).toEqual([release, 'battle.miss.magic'])
    })

    it.each([
      ['taunt', 'battle.armor.metal', 'battle.impact.hex'],
      ['consecrate', 'battle.cast.holy', 'battle.element.blight'],
    ] as const)('%s releases %s and lands as %s', (id, release, impactCue) => {
      expect(cues(eventSounds(ability(id, true, false)))).toEqual([release, impactCue])
    })

    it('rings an Unbreakable save after the landing', () => {
      const spit = ability('fire_spit', true, false)
      const endured = { ...spit, outcomes: [{ ...spit.outcomes[0], endured: true as const }] }
      expect(eventSounds(endured)).toContainEqual({ cue: 'battle.impact.buff', delayMs: impactMs(endured) + 60 })
    })

    it('hears a Volley as a bow shot, landing as arrows do and missing as a shot', () => {
      expect(cues(eventSounds(ability('volley', true, false)))).toEqual(['battle.shot.bow', 'battle.hit.pierce'])
      expect(cues(eventSounds(ability('volley', false, false)))).toEqual(['battle.shot.bow', 'battle.miss.shot'])
    })

    it.each([
      ['hunters_mark', 'battle.impact.hex'],
      ['sprint', 'battle.impact.buff'],
    ] as const)('lands %s, a status laid with no roll, as %s and nothing else', (id, impactCue) => {
      const e = ability(id, true, false)
      expect(eventSounds(e)).toEqual([{ cue: impactCue, delayMs: impactMs(e) }])
    })
  })
})

describe('eventSounds for the skill trees’ events', () => {
  it('shimmers a restore of hit points, and leaves mana alone silent', () => {
    expect(eventSounds({ type: 'restore', seq: 0, round: 1, unit: 'hero', hp: 3, cause: 'renewing' })).toEqual([{ cue: 'battle.heal.small', delayMs: 0 }])
    expect(eventSounds({ type: 'restore', seq: 0, round: 1, unit: 'hero', mana: 2, cause: 'serenity' })).toEqual([])
  })

  it('rings a Shadowdancer’s image as Mirror Image lands, and lays Rooted in silence', () => {
    const laid = { type: 'status_laid', seq: 0, round: 1, unit: 'hero', turns: 2 } as const
    expect(eventSounds({ ...laid, status: 'mirrored', cause: 'shadowdancer' })).toEqual([{ cue: spellSound('mirror_image').impact, delayMs: 0 }])
    expect(eventSounds({ ...laid, status: 'rooted', cause: 'rooted' })).toEqual([])
  })

  it('hears a Revive as any friendly heal', () => {
    const revive = cast(true, false, 'revive')
    expect(cues(eventSounds({ ...revive, outcomes: [{ ...revive.outcomes[0], revived: true }] }))).toEqual(['battle.cast.holy', 'battle.impact.heal'])
  })

  it('lands a counter as any hit, a deathblow with a critical’s weight, and an Unbreakable save with a ward’s ring', () => {
    const hit = cues(eventSounds(attack(true)))
    expect(cues(eventSounds({ ...attack(true), counter: true }))).toEqual(hit)
    expect(cues(eventSounds({ ...attack(true), deathblow: true }))).toEqual([...hit, 'battle.hit.crit'])
    const at = impactMs(attack(true))
    expect(eventSounds({ ...attack(true), endured: true })).toContainEqual({ cue: 'battle.impact.buff', delayMs: at + 60 })
  })

  it('rings an Unbreakable save on a spell and a tick as on a blow', () => {
    const spell = cast(true, false, 'flame_arrow')
    const endured = { ...spell, outcomes: [{ ...spell.outcomes[0], endured: true as const }] }
    expect(eventSounds(endured)).toContainEqual({ cue: 'battle.impact.buff', delayMs: impactMs(endured) + 60 })
    expect(cues(eventSounds(spell))).not.toContain('battle.impact.buff')
    const tick: StatusTickEvent = { type: 'status_tick', seq: 0, round: 1, unit: 'hero', status: 'poisoned', damage: 2, warded: 0, hpBefore: 2, hpAfter: 1 }
    expect(eventSounds({ ...tick, endured: true })).toEqual([
      { cue: 'battle.element.poison', delayMs: 0 },
      { cue: 'battle.impact.buff', delayMs: 60 },
    ])
    expect(eventSounds(tick)).toEqual([{ cue: 'battle.element.poison', delayMs: 0 }])
  })

  it('hears an Ambush as the critical it is', () => {
    expect(cues(eventSounds({ ...attack(true, true), ambush: true }))).toContain('battle.hit.crit')
  })
})

describe('eventSounds: ticks, regeneration, falls, steps and the end', () => {
  const tick = (status: StatusTickEvent['status']): StatusTickEvent => ({ type: 'status_tick', seq: 0, round: 1, unit: 'goblin', status, damage: 2, warded: 0, hpBefore: 5, hpAfter: 3 })
  it('ticks by the status’s element, and not at all without one', () => {
    expect(eventSounds(tick('poisoned'))).toEqual([{ cue: 'battle.element.poison', delayMs: 0 }])
    expect(eventSounds(tick('corroded'))).toEqual([{ cue: 'battle.element.acid', delayMs: 0 }])
    expect(eventSounds(tick('asleep'))).toEqual([])
  })

  it('regenerates', () => {
    expect(eventSounds({ type: 'regenerate', seq: 0, round: 1, unit: 'troll', healed: 2, hpBefore: 7, hpAfter: 9 })).toEqual([{ cue: 'battle.regen', delayMs: 0 }])
  })

  it.each([
    ['goblin', 'battle.death.goblinoid'],
    ['kobold', 'battle.death.goblinoid'],
    ['shaman', 'battle.death.goblinoid'],
    ['hobgoblin', 'battle.death.goblinoid'],
    ['troll', 'battle.death.brute'],
    ['armored_troll', 'battle.death.brute'],
    ['giant_spider', 'battle.death.spider'],
    ['salamander', 'battle.death.salamander'],
    ['horror', 'battle.death.horror'],
    ['bandit_archer', 'battle.death.human'],
  ] as const)('a fallen %s is %s', (kind, cue) => {
    expect(eventSounds({ type: 'unit_down', seq: 0, round: 1, unit: 'u' }, ctx({ kinds: { u: kind } }))).toEqual([{ cue, delayMs: 0 }])
  })

  it('tolls for a fallen hero as well as a human fall, and a unit of no known kind falls as a human', () => {
    const down = { type: 'unit_down', seq: 0, round: 1, unit: 'u' } as const
    expect(cues(eventSounds(down, ctx({ kinds: { u: 'warrior' } })))).toEqual(['battle.death.human', 'battle.death.hero'])
    expect(cues(eventSounds(down))).toEqual(['battle.death.human'])
  })

  const walk = (n: number): BattleEvent => ({
    type: 'move', seq: 0, round: 1, unit: 'u', from: { q: 0, r: 0 }, to: { q: n, r: 0 },
    path: Array.from({ length: n }, (_, i) => ({ q: i + 1, r: 0 })), destination: { q: n, r: 0 }, apCost: n, apAfter: 4, facing: 0,
  })
  it.each([
    ['an armoured hero', { kinds: { u: 'warrior' }, body: { u: 'armor' } }, 'battle.step.armored'],
    ['a plate hero', { kinds: { u: 'warrior' }, body: { u: 'plate' } }, 'battle.step.armored'],
    ['a light hero', { kinds: { u: 'warrior' }, body: { u: 'leather' } }, 'battle.step.light'],
    ['a brute', { kinds: { u: 'bandit_brute' } }, 'battle.step.armored'],
    ['a hobgoblin', { kinds: { u: 'hobgoblin' } }, 'battle.step.armored'],
    ['a troll', { kinds: { u: 'troll' } }, 'battle.step.heavy'],
    ['a horror', { kinds: { u: 'horror' } }, 'battle.step.heavy'],
    ['a spider', { kinds: { u: 'giant_spider' } }, 'battle.step.skitter'],
    ['a salamander', { kinds: { u: 'salamander' } }, 'battle.step.skitter'],
    ['a goblin', { kinds: { u: 'goblin' } }, 'battle.step.light'],
    ['a unit of no kind', {}, 'battle.step.light'],
  ] as const)('%s takes a step mid-way through each hex', (_name, stub, cue) => {
    expect(eventSounds(walk(3), ctx(stub))).toEqual([
      { cue, delayMs: MOVE_STEP_MS / 2 },
      { cue, delayMs: MOVE_STEP_MS * 1.5 },
      { cue, delayMs: MOVE_STEP_MS * 2.5 },
    ])
    expect(MOVE_STEP_MS / 2).toBe(70)
  })

  it('plays the sting for the winner after the last blow, and nothing for neither', () => {
    expect(eventSounds(battleEnd('player'))).toEqual([{ cue: 'stings.victory', delayMs: STING_DELAY_MS }])
    expect(eventSounds(battleEnd('enemy'))).toEqual([{ cue: 'stings.defeat', delayMs: STING_DELAY_MS }])
    expect(eventSounds(battleEnd(null))).toEqual([])
  })

  it('stays quiet for turn changes', () => {
    expect(eventSounds({ type: 'end_turn', seq: 0, round: 1, side: 'player', unspentAp: {} })).toEqual([])
  })

  it('starts the level-up sting 150 ms after the victory sting ends', () => {
    expect(levelUpDelayMs()).toBe(STING_DELAY_MS + cueDurationMs('stings.victory') + 150)
  })
})

describe('AC3: every weapon, foe, spell and ability has a sound', () => {
  it('has a class for every main-hand weapon icon', () => {
    const icons = new Set([...FAMILIES, ...MAGIC_ITEMS].filter((i) => i.slot === 'mainHand').map((i) => i.icon))
    expect(icons.size).toBeGreaterThan(10)
    for (const icon of icons) expect(WEAPON_SOUNDS[icon], `weapon icon ${icon}`).toBeDefined()
  })

  it('has a class, a fall and a step for every kind', () => {
    const kinds = Object.keys(FOE_XP) as UnitKind[]
    expect(kinds).toContain('warrior')
    for (const kind of kinds) {
      expect(DEATH[kind], `death of ${kind}`).toBeDefined()
      expect(stepCue(kind, null), `step of ${kind}`).toBeDefined()
      if (kind !== 'warrior') expect(FOE_SOUNDS[kind], `attack of ${kind}`).toBeDefined()
    }
  })

  it('resolves every spell and ability to cues the manifest has', () => {
    for (const id of ALL_SPELL_IDS) {
      const { cast: release, impact } = spellSound(id)
      expect(CUES[release], `${id} cast`).toBeDefined()
      expect(CUES[impact], `${id} impact`).toBeDefined()
    }
    for (const ability of Object.values(ABILITY_SOUNDS)) {
      for (const cue of [ability.release, ability.impact, ability.miss]) if (cue !== undefined) expect(CUES[cue], cue).toBeDefined()
    }
    for (const sound of [...Object.values(WEAPON_SOUNDS), ...Object.values(FOE_SOUNDS)]) {
      for (const cue of [sound.release, sound.hit, sound.miss]) expect(CUES[cue]).toBeDefined()
    }
  })

  /** Every kind of battle event, and whether `eventSounds` has a case for it or is silent on purpose. */
  const EVENT_SOUNDS: Record<BattleEvent['type'], 'sounds' | 'silent'> = {
    battle_start: 'silent',
    move: 'sounds',
    attack: 'sounds',
    cast: 'sounds',
    ability: 'sounds',
    status_tick: 'sounds',
    regenerate: 'sounds',
    restore: 'sounds',
    status_end: 'silent',
    status_laid: 'sounds',
    equip: 'silent',
    unit_down: 'sounds',
    end_turn: 'silent',
    battle_end: 'sounds',
  }

  /** Abilities that are only strikes, which sound as the attacks they are. Any other needs an `ABILITY_SOUNDS` entry. */
  const SOUNDS_AS_ATTACKS: readonly AbilityId[] = [
    'troll_claws', 'spider_bite',
    'power_attack', 'cleave', 'pin', 'flame_strike', 'frost_strike', 'thunder_strike', 'aimed_shot', 'pinning_shot',
    'dirty_trick', 'venom_strike', 'hamstring', 'smite',
  ]

  it('knows, for every kind of battle event, whether it sounds (a new kind fails the typecheck here until listed)', () => {
    const source = readFileSync(join(ROOT, 'src/scenes/sounds.ts'), 'utf8')
    const body = source.slice(source.indexOf('export function eventSounds'), source.indexOf('export function levelUpDelayMs'))
    for (const [type, kind] of Object.entries(EVENT_SOUNDS)) {
      expect(body.includes(`case '${type}'`), `eventSounds' case for ${type}`).toBe(kind === 'sounds')
    }
  })

  it('gives every ability, status-only ones included, a sound or an entry saying it sounds as attacks', () => {
    for (const id of ABILITY_IDS) {
      const ability = ABILITIES[id]
      if (SOUNDS_AS_ATTACKS.includes(id)) {
        expect(ability.strikes, `${id} is only strikes`).toBeDefined()
        expect(ability.area, `${id} is only strikes`).toBeUndefined()
        expect(ABILITY_SOUNDS[id], `${id} sounds as attacks, so has no entry of its own`).toBeUndefined()
      } else {
        expect(ABILITY_SOUNDS[id], `ability ${id} would sound nothing: give it an ABILITY_SOUNDS entry or list it in SOUNDS_AS_ATTACKS`).toBeDefined()
      }
    }
  })
})

describe('AC6: choosing sounds leaves the battle’s log and dice alone', () => {
  it('plays a seeded battle out the same with eventSounds called on every event', () => {
    const play = (listen: boolean) => {
      const fight = ENCOUNTERS.goblin_raid(partyFighters(readyMadeParty()), 2)
      const engine = new BattleEngine(fight.setup, { seed: 7 })
      const policyRng = mulberry32(99)
      const context = ctx({ kinds: fight.kinds })
      let heard = 0
      for (let state = engine.getState(); state.phase !== 'over'; state = engine.getState()) {
        const events = engine.step(POLICIES.aggressive({ state, legal: engine.legalActions(), rng: policyRng }))
        if (listen) for (const event of events) heard += eventSounds(event, context).length
      }
      return { log: JSON.stringify(engine.getLog()), rng: engine.snapshot().rng, heard }
    }
    const plain = play(false)
    const listened = play(true)
    expect(listened.heard).toBeGreaterThan(20)
    expect(listened.log).toBe(plain.log)
    expect(listened.rng).toBe(plain.rng)
  })
})


describe('AC1: one player', () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return sources(path)
      return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : []
    })
  }

  it('finds no raw sound.play, no sound.add outside the player, and no placeholder key', () => {
    const files = sources(join(ROOT, 'src'))
    expect(files.length).toBeGreaterThan(50)
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toContain('sound.play(')
      expect(text, file).not.toContain('sfx_')
      if (!file.endsWith('soundPlayer.ts')) expect(text, file).not.toContain('sound.add(')
    }
  })
})

describe('worldSounds (step 07)', () => {
  const at = { q: 1, r: 1 }
  const ev = {
    lost: { type: 'encampment_lost', name: 'Oakvale' },
    confront: { type: 'confronting', party: 'party_1', location: 'x' },
    sighted: { type: 'sighted', location: 'a', name: 'A', at, threat: 1 },
    source: { type: 'sighted', location: 'src', name: 'S', at, threat: 5, source: true },
    siteLost: { type: 'site_lost', site: 's', name: 'S' },
    towerLost: { type: 'tower_lost', tower: 't', at },
    threatened: { type: 'site_threatened', site: 's', name: 'S', days: 3 },
    captured: { type: 'site_captured', site: 's', name: 'S' },
    tower: { type: 'tower_built', tower: 't', at },
    outpost: { type: 'site_improved', site: 's', name: 'S', level: 1, building: 'Outpost' },
    arrived: { type: 'arrived', party: 'party_1', at },
    met: { type: 'met', party: 'party_1', other: 'party_2' },
  } as const

  it('is empty when nothing sounds', () => {
    expect(worldSounds([])).toEqual([])
    expect(
      worldSounds([
        { type: 'level_changed', at, from: 0, to: 1 },
        { type: 'spawned', location: 'a', name: 'A', at, threat: 1 },
        { type: 'order_done', party: 'party_1' },
        { type: 'yield', site: 's', name: 'S', material: 'wood' as never, amount: 1 },
      ]),
    ).toEqual([])
  })

  it('maps each kind of event to its cue', () => {
    const cue = (e: Parameters<typeof worldSounds>[0][number]) => worldSounds([e])[0]?.cue
    expect(cue(ev.lost)).toBe('stings.defeat')
    expect(cue(ev.confront)).toBe('world.confront')
    expect(cue(ev.sighted)).toBe('world.sighted')
    expect(cue(ev.source)).toBe('world.source')
    expect(cue(ev.siteLost)).toBe('world.lost')
    expect(cue(ev.towerLost)).toBe('world.lost')
    expect(cue(ev.threatened)).toBe('world.threatened')
    expect(cue(ev.captured)).toBe('world.captured')
    expect(cue(ev.tower)).toBe('world.build')
    expect(cue(ev.outpost)).toBe('world.build')
    expect(cue(ev.arrived)).toBe('world.arrive')
    expect(cue(ev.met)).toBe('world.arrive')
  })

  it('plays the two highest kinds, the second a gap after the first', () => {
    const all = [ev.arrived, ev.captured, ev.sighted, ev.confront, ev.threatened]
    expect(worldSounds(all)).toEqual([
      { cue: 'world.confront', delayMs: 0 },
      { cue: 'world.sighted', delayMs: WORLD_SOUND_GAP_MS },
    ])
    expect(WORLD_SOUND_GAP_MS).toBe(250)
  })

  it('puts the encampment lost first and the Source above a plain sighting', () => {
    expect(worldSounds([ev.confront, ev.lost])[0].cue).toBe('stings.defeat')
    expect(worldSounds([ev.source]).map((c) => c.cue)).toEqual(['world.source'])
    expect(worldSounds([ev.sighted, ev.source]).map((c) => c.cue)).toEqual(['world.source', 'world.sighted'])
    expect(worldSounds([ev.sighted, ev.source, ev.arrived]).map((c) => c.cue)).toEqual(['world.source', 'world.sighted'])
    expect(worldSounds([ev.threatened, ev.siteLost, ev.sighted]).map((c) => c.cue)).toEqual(['world.lost', 'world.sighted'])
  })

  it('collapses duplicates of a kind', () => {
    expect(worldSounds([ev.sighted, ev.sighted, ev.sighted])).toEqual([{ cue: 'world.sighted', delayMs: 0 }])
    expect(worldSounds([ev.siteLost, ev.towerLost, ev.arrived]).map((c) => c.cue)).toEqual(['world.lost', 'world.arrive'])
    expect(worldSounds([ev.tower, ev.outpost])).toEqual([{ cue: 'world.build', delayMs: 0 }])
    expect(worldSounds([ev.arrived, ev.met])).toEqual([{ cue: 'world.arrive', delayMs: 0 }])
  })
})

describe('worldSounds for trade events (stage 8 step 05)', () => {
  const cue = (e: Parameters<typeof worldSounds>[0][number]) => worldSounds([e]).map((c) => c.cue)
  const raided = (days: number) => ({ type: 'route_raided', route: 'route_millbrook', partner: 'millbrook', name: 'Millbrook', cause: 'silent', days }) as const

  it('reuses the existing cues', () => {
    expect(cue(raided(0))).toEqual(['world.threatened'])
    expect(cue({ type: 'partner_silent', partner: 'millbrook', name: 'Millbrook' })).toEqual(['world.threatened'])
    expect(cue({ type: 'route_abandoned', route: 'r', partner: 'millbrook', name: 'Millbrook' })).toEqual(['world.lost'])
    expect(cue({ type: 'route_restored', route: 'r', partner: 'millbrook', name: 'Millbrook' })).toEqual(['world.captured'])
    expect(cue({ type: 'partner_restored', partner: 'millbrook', name: 'Millbrook' })).toEqual(['world.captured'])
    expect(cue({ type: 'partner_contacted', partner: 'millbrook', name: 'Millbrook', home: 'Oakvale' })).toEqual(['world.build'])
    expect(cue({ type: 'route_opened', route: 'r', partner: 'millbrook', name: 'Millbrook', length: 5 })).toEqual(['world.build'])
  })

  it('sounds nothing for the yield days\' counts of a raid', () => {
    expect(cue(raided(1))).toEqual([])
    expect(cue(raided(2))).toEqual([])
    expect(cue(raided(5))).toEqual([])
  })
})

describe('refusalCue and runeCue (step 07)', () => {
  it('plays the error for a refusal and the success sound otherwise', () => {
    expect(refusalCue('Not enough gold.', 'world.coins')).toBe('ui.error')
    expect(refusalCue(null, 'world.coins')).toBe('world.coins')
    expect(refusalCue('', 'world.coins')).toBe('ui.error')
  })

  it('maps runecraft actions to their cues', () => {
    expect(runeCue('embed')).toBe('world.rune.embed')
    expect(runeCue('fuse')).toBe('world.rune.fuse')
    expect(runeCue('extract')).toBe('world.rune.extract')
  })
})

describe('buttonCue (step 07)', () => {
  it('sounds a back for buttons that close or step back, a click for the rest', () => {
    for (const label of ['Close', 'Back', 'Leave', 'Cancel']) expect(buttonCue(label)).toBe('ui.back')
    for (const label of ['Buy', 'Next', 'Enter the guild hall']) expect(buttonCue(label)).toBe('ui.click')
  })
})

describe('reportEvents (step 07)', () => {
  it('flattens the days world and party events, leaving out one party\'s own on request', () => {
    const at = { q: 0, r: 0 }
    const day = (events: never[], partyEvents: never[]) => ({ events, partyEvents, parties: [], interrupt: null })
    const reports = [
      day([{ type: 'tower_built', tower: 't', at }] as never, [{ type: 'arrived', party: 'party_1', at }, { type: 'arrived', party: 'party_2', at }] as never),
    ]
    expect(reportEvents(reports).map((e) => e.type)).toEqual(['tower_built', 'arrived', 'arrived'])
    expect(reportEvents(reports, 'party_1')).toHaveLength(2)
  })
})
