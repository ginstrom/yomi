import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AbilityEvent, AttackEvent, BattleEndEvent, CastEvent, Side } from '../engine/battleEngine.ts'
import type { SpellId } from '../combat/spells.ts'
import manifest from '../../audio/sfx.manifest.json'
import { impactMs } from './battleEffects.ts'
import {
  BANKS,
  CUES,
  GLOBAL_VOICE_CAP,
  MUSIC_KEYS,
  STING_DELAY_MS,
  admitPlay,
  bankFiles,
  cueBank,
  cueDurationMs,
  cueMarkers,
  eventSounds,
  musicFiles,
  newLimitState,
  newVariantState,
  pickVariant,
  type CueId,
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

describe('eventSounds (today’s mapping on the new cues)', () => {
  it('swings, then lands a hit, a critical or a miss', () => {
    const swing = { cue: 'battle.swing.blade', delayMs: 0 }
    expect(eventSounds(attack(true))).toEqual([swing, { cue: 'battle.hit.slash', delayMs: impactMs(attack(true)) }])
    expect(eventSounds(attack(true, true))).toEqual([swing, { cue: 'battle.hit.crit', delayMs: impactMs(attack(true, true)) }])
    expect(eventSounds(attack(false))).toEqual([swing, { cue: 'battle.miss.swing', delayMs: impactMs(attack(false)) }])
  })

  it('sounds a spell, then how it lands; a friendly one chimes', () => {
    const spell = { cue: 'battle.cast.arcane', delayMs: 0 }
    expect(eventSounds(cast(true))).toEqual([spell, { cue: 'battle.hit.slash', delayMs: impactMs(cast(true)) }])
    expect(eventSounds(cast(true, true))).toEqual([spell, { cue: 'battle.hit.crit', delayMs: impactMs(cast(true, true)) }])
    expect(eventSounds(cast(false))).toEqual([spell, { cue: 'battle.miss.swing', delayMs: impactMs(cast(false)) }])
    expect(eventSounds(cast(true, false, 'heal'))).toEqual([spell, { cue: 'battle.impact.heal', delayMs: impactMs(cast(true, false, 'heal')) }])
  })

  it('ticks, regenerates and marks a fallen unit', () => {
    expect(eventSounds({ type: 'status_tick', seq: 0, round: 1, unit: 'goblin', status: 'poisoned', damage: 2, warded: 0, hpBefore: 5, hpAfter: 3 })).toEqual([
      { cue: 'battle.hit.slash', delayMs: 0 },
    ])
    expect(eventSounds({ type: 'regenerate', seq: 0, round: 1, unit: 'troll', healed: 2, hpBefore: 7, hpAfter: 9 })).toEqual([
      { cue: 'battle.regen', delayMs: 0 },
    ])
    expect(eventSounds({ type: 'unit_down', seq: 0, round: 1, unit: 'goblin' })).toEqual([{ cue: 'battle.death.human', delayMs: 0 }])
  })

  it('plays a sting for victory or defeat, and nothing for an abandoned battle', () => {
    expect(eventSounds(battleEnd('player'))).toEqual([{ cue: 'stings.victory', delayMs: STING_DELAY_MS }])
    expect(eventSounds(battleEnd('enemy'))).toEqual([{ cue: 'stings.defeat', delayMs: STING_DELAY_MS }])
    expect(eventSounds(battleEnd(null))).toEqual([])
  })

  it('stays quiet for moves and turn changes', () => {
    expect(eventSounds({ type: 'end_turn', seq: 0, round: 1, side: 'player', unspentAp: {} })).toEqual([])
  })

  describe('for an area ability', () => {
    const ability = (hit: boolean, half: boolean, critical = false): AbilityEvent => ({
      type: 'ability', seq: 0, round: 1, unit: 'salamander', ability: 'fire_spit', at: { q: 2, r: 0 }, shape: 'cone',
      hexes: [], distance: 2, apCost: 4, apAfter: 4, facing: 0, skill: 70,
      outcomes: [
        {
          unit: 'hero', attackRoll: 40, chance: 61, defenderAc: 15, hit, critical, fumble: false, image: false,
          damage: hit ? 9 : half ? 4 : 0, warded: 0, half, healed: 0, hpBefore: 12, hpAfter: 5, status: null,
        },
      ],
    })

    it('casts, then lands as the best outcome does; a half-damage miss is still heard to strike', () => {
      const cue = { cue: 'battle.cast.arcane', delayMs: 0 }
      expect(eventSounds(ability(true, false))).toEqual([cue, { cue: 'battle.hit.slash', delayMs: impactMs(ability(true, false)) }])
      expect(eventSounds(ability(true, false, true))[1].cue).toBe('battle.hit.crit')
      expect(eventSounds(ability(false, true))[1].cue).toBe('battle.hit.slash')
      expect(eventSounds(ability(false, false))[1].cue).toBe('battle.miss.swing')
    })
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
