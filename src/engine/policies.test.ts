import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { deriveCombatStats } from '../character/character.ts'
import { autoAdvance, levelUp } from '../character/progression.ts'
import { mulberry32 } from '../combat/rng.ts'
import { ENCOUNTERS, ENCOUNTER_BANDS, type EncounterId } from '../game/encounters.ts'
import { partyFighters, readyMadeParty } from '../game/party.ts'
import { GOBLIN_STATS, KOBOLD_STATS, TROLL_STATS, type CombatantStats } from '../combat/combat.ts'
import { hex, type Hex } from '../grid/hex.ts'
import { BattleEngine, abilityTouches, areaTouches, castTouches, type Action } from './battleEngine.ts'
import { ABILITIES, type AbilityId } from '../combat/abilities.ts'
import type { ActiveStatus, SpellId, StatusId } from '../combat/spells.ts'
import { MANA_WEIGHT, POLICIES, STATUS_VALUE, isPolicyName, techniqueScore, type PolicyContext } from './policies.ts'

function engineWith(playerAt: Hex, enemyAt: Hex): BattleEngine {
  return new BattleEngine({
    board: { cols: 8, rows: 3 },
    units: [
      { id: 'p1', side: 'player', stats: GOBLIN_STATS, position: playerAt },
      { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: enemyAt },
    ],
  })
}

function context(legal: readonly Action[], rngValue = 0): PolicyContext {
  const engine = engineWith(hex(0, 1), hex(1, 1))
  return { state: engine.getState(), legal, rng: () => rngValue }
}

const choose = (engine: BattleEngine) =>
  POLICIES.aggressive({ state: engine.getState(), legal: engine.legalActions(), rng: () => 0 })

const unitAt = (engine: BattleEngine, id: string) => engine.getState().units.find((u) => u.id === id)!

/** The ids of the units an area ability action would touch. */
function castTouchesArea(engine: BattleEngine, action: Action): string[] {
  if (action.type !== 'ability' || !('at' in action)) throw new Error('expected an area ability')
  const { units } = engine.getState()
  const self = units.find((u) => u.id === action.unit)!
  return areaTouches(units, self, ABILITIES[action.ability].area!, action.at, true).map((u) => u.id)
}

const ATTACK_E1: Action = { type: 'attack', unit: 'p1', target: 'e1' }
const END_TURN: Action = { type: 'end_turn' }

describe('policies', () => {
  it('aggressive stops an archer as soon as its target is in range, then shoots', () => {
    const archer = { ...GOBLIN_STATS, attackApCost: 4, attackRange: 3 }
    const engine = new BattleEngine({
      board: { cols: 8, rows: 3 },
      units: [
        { id: 'p1', side: 'player', stats: archer, position: hex(0, 1) },
        { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(5, 1) },
      ],
    })
    expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(2, 1) })
    engine.step(choose(engine))
    expect(choose(engine)).toEqual(ATTACK_E1)
    engine.step(ATTACK_E1)
    // 2 AP left and the foe in range: it holds its ground rather than walking up.
    expect(choose(engine)).toEqual(END_TURN)
  })

  it('aggressive thrusts with a spear from two hexes rather than walking up', () => {
    const spearman = { ...GOBLIN_STATS, attackRange: 2, reach: true as const }
    const engine = new BattleEngine({
      board: { cols: 8, rows: 3 },
      units: [
        { id: 'p1', side: 'player', stats: spearman, position: hex(0, 1) },
        { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 1) },
      ],
    })
    expect(choose(engine)).toEqual(ATTACK_E1)
    // Only reach makes it a melee blow, which the foe may turn to meet.
    const events = engine.step(ATTACK_E1)
    expect(events.find((e) => e.type === 'attack')).toMatchObject({ melee: true, distance: 2 })
  })

  describe('aggressive with a caster', () => {
    // A wand that reaches 4 hexes for 5 AP, and Magic Arrow, which reaches 5 for 4 AP and 3 mana.
    const mage = (maxMana: number) => ({
      ...GOBLIN_STATS,
      attackApCost: 5,
      attackRange: 4,
      magic: { maxMana, skill: 70, spells: ['magic_arrow' as const] },
    })
    const facing = (maxMana: number, ...foes: Array<[id: string, at: Hex, hp?: number]>) =>
      new BattleEngine({
        board: { cols: 8, rows: 3 },
        units: [
          { id: 'p1', side: 'player', stats: mage(maxMana), position: hex(0, 1) },
          ...foes.map(([id, position, hp]) => ({ id, side: 'enemy' as const, stats: GOBLIN_STATS, position, hp })),
        ],
      })

    it('casts on the weakest foe in range before it would strike with its weapon', () => {
      const engine = facing(18, ['e1', hex(3, 1)], ['e2', hex(4, 1), 5], ['e3', hex(4, 0), 5])
      expect(engine.legalActions()).toContainEqual({ type: 'attack', unit: 'p1', target: 'e1' })
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'magic_arrow', target: 'e2' })
    })

    it('stops at its spell’s range while it has the mana, and holds there', () => {
      const engine = facing(6, ['e1', hex(7, 1)])
      expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(2, 1) })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'magic_arrow', target: 'e1' })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual(END_TURN)
    })

    it('closes to its wand’s range once its mana is spent', () => {
      const engine = facing(2, ['e1', hex(7, 1)])
      expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(3, 1) })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual(ATTACK_E1)
    })
  })

  describe('aggressive with spells of every kind (A14)', () => {
    const caster = (spells: SpellId[], maxMana = 40) => ({
      ...GOBLIN_STATS,
      actionPoints: 12,
      magic: { maxMana, skill: 70, spells },
    })
    type Placing = { id: string; side: 'player' | 'enemy'; at: Hex; hp?: number; stats?: CombatantStats }
    const field = (spells: SpellId[], others: Placing[], maxMana?: number, rng?: () => number) =>
      new BattleEngine(
        {
          board: { cols: 9, rows: 4 },
          units: [
            { id: 'p1', side: 'player', stats: caster(spells, maxMana), position: hex(0, 1) },
            ...others.map(({ id, side, at, hp, stats }) => ({ id, side, stats: stats ?? GOBLIN_STATS, position: at, hp })),
          ],
        },
        rng ? { rng } : {},
      )

    it('heals an ally at half its hit points or less before it strikes', () => {
      const engine = field(['magic_arrow', 'heal'], [
        { id: 'p2', side: 'player', at: hex(1, 1), hp: 6 },
        { id: 'e1', side: 'enemy', at: hex(4, 1), hp: 3 },
      ])
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'heal', target: 'p2' })
      // Above half, it strikes instead.
      const hale = field(['magic_arrow', 'heal'], [
        { id: 'p2', side: 'player', at: hex(1, 1), hp: 7 },
        { id: 'e1', side: 'enemy', at: hex(4, 1) },
      ])
      expect(choose(hale)).toEqual({ type: 'cast', unit: 'p1', spell: 'magic_arrow', target: 'e1' })
    })

    it("counts the healer's bonus (Mending) before the cap when it picks a heal", () => {
      // An ally down 8 of 12: Greater Heal (mean 13) restores all 8, Heal (mean 6.5) only 6.5, unless the bonus lifts Heal to 8.
      const healer = (healBonus: number) =>
        new BattleEngine({
          board: { cols: 9, rows: 4 },
          units: [
            { id: 'p1', side: 'player', stats: { ...caster(['heal', 'greater_heal']), magic: { maxMana: 40, skill: 70, spells: ['heal', 'greater_heal'], healBonus } }, position: hex(0, 1) },
            { id: 'p2', side: 'player', stats: GOBLIN_STATS, position: hex(1, 1), hp: 4 },
            { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(8, 1) },
          ],
        })
      expect(choose(healer(0))).toEqual({ type: 'cast', unit: 'p1', spell: 'greater_heal', target: 'p2' })
      expect(choose(healer(4))).toEqual({ type: 'cast', unit: 'p1', spell: 'heal', target: 'p2' })
    })

    it('throws a hostile area spell only where it touches two foes or more and no ally', () => {
      const foes: Placing[] = [
        { id: 'e1', side: 'enemy', at: hex(4, 1) },
        { id: 'e2', side: 'enemy', at: hex(5, 1) },
      ]
      const engine = field(['fireball'], foes)
      const cast = choose(engine)
      expect(cast).toMatchObject({ type: 'cast', spell: 'fireball' })
      const touched = castTouches(engine.getState().units, unitAt(engine, 'p1'), 'fireball', { at: (cast as { at: Hex }).at })
      expect(touched.map((u) => u.id)).toEqual(['e1', 'e2'])
      // An ally beside them leaves no centre that touches both foes and not it.
      const crowded = field(['fireball'], [...foes, { id: 'p2', side: 'player', at: hex(4, 2) }, { id: 'p3', side: 'player', at: hex(5, 0) }])
      expect(choose(crowded).type).not.toBe('cast')
    })

    it('keeps the mana for its cheapest heal rather than spend it on a strike', () => {
      const shaman = field(['magic_arrow', 'heal'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }], 5)
      expect(choose(shaman)).not.toMatchObject({ type: 'cast' })
      const flush = field(['magic_arrow', 'heal'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }], 6)
      expect(choose(flush)).toMatchObject({ type: 'cast', spell: 'magic_arrow' })
    })

    it('guards itself with Mirror Image, then Shield, when a foe stands beside it', () => {
      const engine = field(['shield', 'mirror_image', 'magic_arrow'], [{ id: 'e1', side: 'enemy', at: hex(1, 1) }])
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'mirror_image', target: 'p1' })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'shield', target: 'p1' })
      engine.step(choose(engine))
      expect(choose(engine)).toMatchObject({ spell: 'magic_arrow' })
    })

    it('blesses two allies or more not yet blessed, and puts the healthiest foe to sleep while two stand', () => {
      const engine = field(['bless', 'sleep'], [
        { id: 'p2', side: 'player', at: hex(1, 1) },
        { id: 'e1', side: 'enemy', at: hex(4, 1), hp: 5 },
        { id: 'e2', side: 'enemy', at: hex(4, 2) },
      ])
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'bless', at: hex(0, 1) })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'sleep', target: 'e2' })
    })

    describe('with wards and monster spells (stage 2)', () => {
      const warded = (wards: CombatantStats['wards']): CombatantStats => ({ ...GOBLIN_STATS, wards })

      it('scores a strike after the target’s ward: of two equal foes, the one without', () => {
        const engine = field(['flame_arrow'], [
          { id: 'e1', side: 'enemy', at: hex(4, 1), stats: warded({ fire: 5 }) },
          { id: 'e2', side: 'enemy', at: hex(4, 2) },
        ])
        expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'flame_arrow', target: 'e2' })
        // Unwarded, the first of two equal foes, as ever.
        const even = field(['flame_arrow'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }, { id: 'e2', side: 'enemy', at: hex(4, 2) }])
        expect(choose(even)).toEqual({ type: 'cast', unit: 'p1', spell: 'flame_arrow', target: 'e1' })
      })

      it('casts a weaker spell where a ward would stop its hardest-hitting one', () => {
        const engine = field(['magic_arrow', 'flame_arrow'], [{ id: 'e1', side: 'enemy', at: hex(4, 1), stats: warded({ fire: 99 }) }])
        expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'magic_arrow', target: 'e1' })
        const bare = field(['magic_arrow', 'flame_arrow'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }])
        expect(choose(bare)).toEqual({ type: 'cast', unit: 'p1', spell: 'flame_arrow', target: 'e1' })
      })

      it('counts no foe a hostile area spell’s element is fully warded against towards its two foes; a partly warded one still counts', () => {
        // Fireball's 3d6 averages 10.5: a fire ward of 99 stops it all, a ward of 5 leaves 5.5.
        const shut = field(['fireball'], [{ id: 'e1', side: 'enemy', at: hex(4, 1), stats: warded({ fire: 99 }) }, { id: 'e2', side: 'enemy', at: hex(5, 1) }])
        expect(choose(shut)).not.toMatchObject({ type: 'cast' })
        const partly = field(['fireball'], [{ id: 'e1', side: 'enemy', at: hex(4, 1), stats: warded({ fire: 5 }) }, { id: 'e2', side: 'enemy', at: hex(5, 1) }])
        expect(choose(partly)).toMatchObject({ type: 'cast', spell: 'fireball' })
      })

      it('strikes with Drain Life as with any damaging spell of one foe', () => {
        const engine = field(['drain_life'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }])
        expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'drain_life', target: 'e1' })
      })

      it('throws Lightning Bolt where its line touches two foes and no ally', () => {
        const engine = field(['lightning_bolt'], [{ id: 'e1', side: 'enemy', at: hex(3, 1) }, { id: 'e2', side: 'enemy', at: hex(5, 1) }])
        const cast = choose(engine)
        expect(cast).toMatchObject({ type: 'cast', spell: 'lightning_bolt' })
        const touched = castTouches(engine.getState().units, unitAt(engine, 'p1'), 'lightning_bolt', { at: (cast as { at: Hex }).at })
        expect(touched.map((u) => u.id)).toEqual(['e1', 'e2'])
      })

      it('casts Web on one foe not yet webbed, never on an ally, and not again on a webbed foe', () => {
        // Every roll a 1: the web always lands.
        const engine = field(['web'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }], undefined, () => 0.999)
        const cast = choose(engine)
        expect(cast).toMatchObject({ type: 'cast', spell: 'web' })
        engine.step(cast)
        expect(unitAt(engine, 'e1').statuses.map((s) => s.id)).toEqual(['webbed'])
        expect(choose(engine)).not.toMatchObject({ type: 'cast' })
        // With an ally beside the foe on every side but the far one, no centre touches the foe alone.
        const crowded = field(['web'], [
          { id: 'e1', side: 'enemy', at: hex(4, 1) },
          { id: 'p2', side: 'player', at: hex(3, 1) },
          { id: 'p3', side: 'player', at: hex(3, 2) },
          { id: 'p4', side: 'player', at: hex(4, 0) },
          { id: 'p5', side: 'player', at: hex(5, 0) },
          { id: 'p6', side: 'player', at: hex(4, 2) },
          { id: 'p7', side: 'player', at: hex(5, 1) },
        ])
        expect(choose(crowded)).not.toMatchObject({ type: 'cast', spell: 'web' })
      })

      it('curses the healthiest foe not yet cursed while two stand', () => {
        const engine = field(['curse'], [
          { id: 'e1', side: 'enemy', at: hex(4, 1), hp: 5 },
          { id: 'e2', side: 'enemy', at: hex(4, 2) },
        ], undefined, () => 0.999)
        expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'curse', target: 'e2' })
        engine.step(choose(engine))
        expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'curse', target: 'e1' })
        const alone = field(['curse'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }])
        expect(choose(alone)).not.toMatchObject({ type: 'cast' })
      })

      it('guards itself with Dark Shield when a foe stands beside it and it is not shielded', () => {
        const engine = field(['magic_arrow', 'dark_shield'], [{ id: 'e1', side: 'enemy', at: hex(1, 1) }])
        expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'dark_shield', target: 'p1' })
        engine.step(choose(engine))
        expect(choose(engine)).toMatchObject({ spell: 'magic_arrow' })
        const far = field(['magic_arrow', 'dark_shield'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }])
        expect(choose(far)).toMatchObject({ spell: 'magic_arrow' })
        // Shield first, and Dark Shield not on top of it.
        const both = field(['shield', 'magic_arrow', 'dark_shield'], [{ id: 'e1', side: 'enemy', at: hex(1, 1) }])
        expect(choose(both)).toMatchObject({ spell: 'shield' })
        both.step(choose(both))
        expect(choose(both)).toMatchObject({ spell: 'magic_arrow' })
      })
    })

    it('casts Haste on an ally, and Protect only on an ally with a foe beside it (skill trees step 24; before, neither)', () => {
      const engine = field(['protect', 'haste'], [{ id: 'p2', side: 'player', at: hex(1, 1) }, { id: 'e1', side: 'enemy', at: hex(7, 1) }])
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'haste', target: 'p2' })
      expect(choose(field(['protect'], [{ id: 'p2', side: 'player', at: hex(1, 1) }, { id: 'e1', side: 'enemy', at: hex(7, 1) }])).type).toBe('move')
    })

    describe('the stage-3 casts (skill trees step 21)', () => {
      type Snapshot = ReturnType<BattleEngine['snapshot']>
      /** `engine` again with its snapshot changed by `edit`, as a save would carry it. */
      const edited = (engine: BattleEngine, edit: (snapshot: Snapshot) => void) => {
        const snapshot = engine.snapshot()
        edit(snapshot)
        return BattleEngine.restore(snapshot)
      }
      const unitOf = (snapshot: Snapshot, id: string) => snapshot.units.find((u) => u.id === id)!
      /** `engine` with `statuses` laid on unit `id`, each for 2 turns. */
      const laid = (engine: BattleEngine, id: string, ...statuses: StatusId[]) =>
        edited(engine, (s) => {
          unitOf(s, id).statuses = statuses.map((status) => ({ id: status, turnsLeft: 2 }))
        })
      const cast = (spell: SpellId, aim: { target: string } | { at: Hex }): Action => ({ type: 'cast', unit: 'p1', spell, ...aim })

      describe('reviveCast (1)', () => {
        /** p2 fell this battle beside the caster; p3 is at 2 of its 12 hit points. */
        const scene = (usedOnce: SpellId[] = []) =>
          edited(
            field(['heal', 'revive'], [
              { id: 'p2', side: 'player', at: hex(1, 1), hp: 0 },
              { id: 'p3', side: 'player', at: hex(1, 0), hp: 2 },
              { id: 'e1', side: 'enemy', at: hex(7, 1) },
            ]),
            (s) => {
              unitOf(s, 'p2').fallenThisBattle = true
              if (usedOnce.length > 0) unitOf(s, 'p1').usedOnce = usedOnce
            },
          )

        it('revives a fallen ally before it heals a wounded one', () => {
          expect(choose(scene())).toEqual(cast('revive', { target: 'p2' }))
        })

        it('not once it has used Revive this battle: it heals instead', () => {
          expect(choose(scene(['revive']))).toEqual(cast('heal', { target: 'p3' }))
        })

        it('keeps no heal reserve from Revive: it casts it with only its mana', () => {
          const poor = edited(scene(), (s) => {
            unitOf(s, 'p1').mana = 20
          })
          expect(choose(poor)).toEqual(cast('revive', { target: 'p2' }))
        })
      })

      describe('purifyCast (3)', () => {
        const scene = (hp?: number) =>
          field(['magic_arrow', 'purify'], [
            { id: 'p2', side: 'player', at: hex(1, 1), hp },
            { id: 'e1', side: 'enemy', at: hex(4, 1) },
          ])

        it('purifies an ally that is asleep, frozen, poisoned, corroded or pinned', () => {
          for (const status of ['asleep', 'frozen', 'poisoned', 'corroded', 'pinned'] as const) {
            expect(choose(laid(scene(), 'p2', status)), status).toEqual(cast('purify', { target: 'p2' }))
          }
        })

        it('not an ally only blessed, nor one only wounded: Purify is no heal', () => {
          expect(choose(laid(scene(), 'p2', 'blessed'))).toEqual(cast('magic_arrow', { target: 'e1' }))
          expect(choose(scene(2))).toEqual(cast('magic_arrow', { target: 'e1' }))
        })

        it('keeps no heal reserve for Purify: a caster with 5 mana still strikes for 3', () => {
          const engine = edited(scene(), (s) => {
            unitOf(s, 'p1').mana = 5
          })
          expect(choose(engine)).toEqual(cast('magic_arrow', { target: 'e1' }))
        })
      })

      describe('supportCast (6)', () => {
        const allies = (at2: Hex, at3: Hex, hp?: number): Placing[] => [
          { id: 'p2', side: 'player', at: at2, hp },
          { id: 'p3', side: 'player', at: at3, hp },
          { id: 'e1', side: 'enemy', at: hex(7, 1) },
        ]
        const self = { at: hex(0, 1) }

        it('hastes the side in its first two rounds when two allies or more not hasted are within 2 hexes', () => {
          const engine = field(['mass_haste'], allies(hex(1, 1), hex(2, 1)))
          expect(choose(engine)).toEqual(cast('mass_haste', self))
          expect(choose(edited(engine, (s) => void (s.round = 2)))).toEqual(cast('mass_haste', self))
        })

        it('not in round 3, nor when it would touch only one ally not hasted', () => {
          const engine = field(['mass_haste'], allies(hex(1, 1), hex(2, 1)))
          expect(choose(edited(engine, (s) => void (s.round = 3)))).not.toMatchObject({ type: 'cast' })
          // p2 and p3 out of its radius: only the caster would be touched.
          expect(choose(field(['mass_haste'], allies(hex(5, 1), hex(5, 2))))).not.toMatchObject({ type: 'cast' })
          // p2 and p3 hasted already: only the caster is fresh.
          const hasted = edited(engine, (s) => {
            for (const id of ['p2', 'p3']) unitOf(s, id).statuses = [{ id: 'hasted', turnsLeft: 2 }]
          })
          expect(choose(hasted)).not.toMatchObject({ type: 'cast' })
        })

        it('renews when two allies within its radius are at 75% or less and none is renewing', () => {
          expect(choose(field(['renew'], allies(hex(1, 1), hex(2, 1), 9)))).toEqual(cast('renew', self))
        })

        it('not when one is renewing, nor with only one ally at 75% or less', () => {
          expect(choose(laid(field(['renew'], allies(hex(1, 1), hex(2, 1), 9)), 'p3', 'renewing'))).not.toMatchObject({ type: 'cast' })
          // At 10 of 12 (83%), neither is low enough.
          expect(choose(field(['renew'], allies(hex(1, 1), hex(2, 1), 10)))).not.toMatchObject({ type: 'cast' })
          const one = edited(field(['renew'], allies(hex(1, 1), hex(2, 1))), (s) => void (unitOf(s, 'p2').hp = 9))
          expect(choose(one)).not.toMatchObject({ type: 'cast' })
        })

        it('hastes the first ally in roster order other than itself that is not hasted (skill trees step 24)', () => {
          const engine = field(['haste'], allies(hex(1, 1), hex(2, 1)))
          expect(choose(engine)).toEqual(cast('haste', { target: 'p2' }))
          expect(choose(laid(engine, 'p2', 'hasted'))).toEqual(cast('haste', { target: 'p3' }))
        })

        it('hastes no one when every ally is hasted, nor itself', () => {
          const engine = edited(field(['haste'], allies(hex(1, 1), hex(2, 1))), (s) => {
            for (const id of ['p2', 'p3']) unitOf(s, id).statuses = [{ id: 'hasted', turnsLeft: 2 }]
          })
          expect(choose(engine)).not.toMatchObject({ type: 'cast' })
        })

        it('protects an ally with a foe beside it that is not protected, the most hurt first (skill trees step 24)', () => {
          const scene = field(['protect'], [
            { id: 'p2', side: 'player', at: hex(3, 1) },
            { id: 'p3', side: 'player', at: hex(3, 2), hp: 5 },
            { id: 'e1', side: 'enemy', at: hex(4, 1) },
          ])
          expect(choose(scene)).toEqual(cast('protect', { target: 'p3' }))
          expect(choose(laid(scene, 'p3', 'protected'))).toEqual(cast('protect', { target: 'p2' }))
          // With no foe beside an ally, it protects no one.
          expect(choose(field(['protect'], allies(hex(1, 1), hex(2, 1))))).not.toMatchObject({ type: 'cast' })
        })
      })

      describe('a status-only hostile area spell (Bane, skill trees step 24)', () => {
        const foes: Placing[] = [
          { id: 'e1', side: 'enemy', at: hex(4, 1) },
          { id: 'e2', side: 'enemy', at: hex(5, 1) },
        ]

        it('banes two foes or more not yet baned', () => {
          expect(choose(field(['bane'], foes))).toMatchObject({ type: 'cast', spell: 'bane' })
        })

        it('not where only one foe it would touch is not yet baned', () => {
          expect(choose(laid(field(['bane'], foes), 'e1', 'baned'))).not.toMatchObject({ type: 'cast' })
        })

        it('counts no foe immune to a status that ticks (Death Cloud), and still counts it for one that does not (stage 11 step 03)', () => {
          const immune: Placing[] = [foes[0], { ...foes[1], stats: { ...GOBLIN_STATS, immune: true } }]
          expect(choose(field(['death_cloud'], foes))).toMatchObject({ type: 'cast', spell: 'death_cloud' })
          expect(choose(field(['death_cloud'], immune))).not.toMatchObject({ type: 'cast' })
          expect(choose(field(['bane'], immune))).toMatchObject({ type: 'cast', spell: 'bane' })
        })
      })

      describe('prisonCast (8)', () => {
        const foes = (): Placing[] => [
          { id: 'e1', side: 'enemy', at: hex(4, 1), hp: 5 },
          { id: 'e2', side: 'enemy', at: hex(4, 2) },
        ]

        it('freezes the healthiest of two standing foes', () => {
          expect(choose(field(['glacial_prison'], foes()))).toEqual(cast('glacial_prison', { target: 'e2' }))
        })

        it('skips a frozen or sleeping foe', () => {
          expect(choose(laid(field(['glacial_prison'], foes()), 'e2', 'frozen'))).toEqual(cast('glacial_prison', { target: 'e1' }))
          expect(choose(laid(field(['glacial_prison'], foes()), 'e2', 'asleep'))).toEqual(cast('glacial_prison', { target: 'e1' }))
        })

        it('not on the last foe standing', () => {
          expect(choose(field(['glacial_prison'], [{ id: 'e1', side: 'enemy', at: hex(4, 1) }]))).not.toMatchObject({ type: 'cast' })
        })

        it('puts no frozen foe to sleep', () => {
          expect(choose(laid(field(['sleep'], foes()), 'e2', 'frozen'))).toEqual(cast('sleep', { target: 'e1' }))
        })

        it('puts no foe to sleep with one of its own side beside it, whose blows would wake it (skill trees step 24)', () => {
          const engaged = field(['sleep'], [...foes(), { id: 'p2', side: 'player', at: hex(5, 2) }])
          expect(choose(engaged)).toEqual(cast('sleep', { target: 'e1' }))
          const both = field(['sleep'], [...foes(), { id: 'p2', side: 'player', at: hex(5, 2) }, { id: 'p3', side: 'player', at: hex(3, 1) }])
          expect(choose(both)).not.toMatchObject({ spell: 'sleep' })
        })
      })

      describe('strikeCast (10)', () => {
        it("counts the caster's spell power by element: Frostbite with Numbing Cold over Magic Arrow (skill trees step 24)", () => {
          const frosty = (frost: number) =>
            new BattleEngine({
              board: { cols: 9, rows: 4 },
              units: [
                { id: 'p1', side: 'player', stats: { ...caster(['magic_arrow', 'frostbite']), magic: { maxMana: 40, skill: 70, spells: ['magic_arrow', 'frostbite'], power: { all: 2, frost } } }, position: hex(0, 1) },
                { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(4, 1) },
              ],
            })
          // Magic Arrow 5.5 + 2 against Frostbite 4.5 + 2 + frost.
          expect(choose(frosty(0))).toEqual(cast('magic_arrow', { target: 'e1' }))
          expect(choose(frosty(3))).toEqual(cast('frostbite', { target: 'e1' }))
        })

        it('lances the chilled foe over an equal one, counting its bonus dice', () => {
          const engine = field(['ice_lance'], [
            { id: 'e1', side: 'enemy', at: hex(4, 1) },
            { id: 'e2', side: 'enemy', at: hex(4, 2) },
          ])
          expect(choose(engine)).toEqual(cast('ice_lance', { target: 'e1' }))
          expect(choose(laid(engine, 'e2', 'chilled'))).toEqual(cast('ice_lance', { target: 'e2' }))
        })

        it('strikes the regenerating foe with Holy Light over an equal plain one, its dice doubled as bane', () => {
          const engine = field(['holy_light'], [
            { id: 'e1', side: 'enemy', at: hex(4, 1) },
            { id: 'e2', side: 'enemy', at: hex(4, 2), stats: { ...GOBLIN_STATS, regeneration: 1 } },
          ])
          expect(choose(engine)).toEqual(cast('holy_light', { target: 'e2' }))
        })

        it('reckons a foe’s ward with its statuses: of two equal foes, the one not Warded', () => {
          const engine = field(['flame_arrow'], [
            { id: 'e1', side: 'enemy', at: hex(4, 1) },
            { id: 'e2', side: 'enemy', at: hex(4, 2) },
          ])
          expect(choose(laid(engine, 'e1', 'warded'))).toEqual(cast('flame_arrow', { target: 'e2' }))
        })
      })

      it('aims Glacial Prison and Ice Lance only at its taunter while it stands', () => {
        const foes = (): Placing[] => [
          { id: 'e1', side: 'enemy', at: hex(4, 1) },
          { id: 'e2', side: 'enemy', at: hex(4, 2), hp: 5 },
        ]
        const taunted = (spells: SpellId[]) =>
          edited(field(spells, foes()), (s) => {
            unitOf(s, 'p1').statuses = [{ id: 'taunted', turnsLeft: 1, source: 'e2' }]
            unitOf(s, 'e1').statuses = [{ id: 'chilled', turnsLeft: 2 }]
          })
        expect(choose(field(['glacial_prison'], foes()))).toEqual(cast('glacial_prison', { target: 'e1' }))
        expect(choose(taunted(['glacial_prison']))).toEqual(cast('glacial_prison', { target: 'e2' }))
        expect(choose(taunted(['ice_lance']))).toEqual(cast('ice_lance', { target: 'e2' }))
      })
    })
  })

  it('aggressive attacks whenever attacking is legal, and otherwise ends the turn', () => {
    expect(POLICIES.aggressive(context([END_TURN, ATTACK_E1]))).toEqual(ATTACK_E1)
    expect(POLICIES.aggressive(context([END_TURN]))).toEqual(END_TURN)
  })

  it('aggressive attacks the foe it flanks most', () => {
    // p1 at (1,1) touches both e2 (2,0) and e1 (2,1); p3 at (3,1) touches e1
    // alone, so e1 is flanked though e2 comes first in the legal actions.
    const engine = new BattleEngine({
      board: { cols: 8, rows: 3 },
      units: [
        { id: 'p1', side: 'player', stats: GOBLIN_STATS, position: hex(1, 1) },
        { id: 'p3', side: 'player', stats: GOBLIN_STATS, position: hex(3, 1) },
        { id: 'e2', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 0) },
        { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 1) },
      ],
    })
    expect(engine.legalActions('p1').filter((a) => a.type === 'attack')).toEqual([
      { type: 'attack', unit: 'p1', target: 'e2' },
      ATTACK_E1,
    ])
    expect(choose(engine)).toEqual(ATTACK_E1)
  })

  it('aggressive attacks a foe from behind before one it faces, unless the foe can still turn', () => {
    // Both touch p1 at (1,1); e1 at (2,1) faces west towards it, e2 at (2,0) faces away.
    const engine = new BattleEngine({
      board: { cols: 8, rows: 3 },
      units: [
        { id: 'p1', side: 'player', stats: GOBLIN_STATS, position: hex(1, 1) },
        { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 1) },
        { id: 'e2', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 0), facing: 1 },
      ],
    })
    expect(choose(engine)).toEqual({ type: 'attack', unit: 'p1', target: 'e1' }) // e2 would turn: no better than e1
    const state = engine.getState()
    state.units.find((u) => u.id === 'e2')!.turnReady = false
    expect(POLICIES.aggressive({ state, legal: engine.legalActions(), rng: () => 0 })).toEqual({
      type: 'attack',
      unit: 'p1',
      target: 'e2',
    })
  })

  it('aggressive closes the distance, ends its turn when spent, and attacks next turn', () => {
    const engine = engineWith(hex(0, 1), hex(6, 1))
    // Speed 4, 3 AP: reaching the foe takes 2 AP, leaving too few to strike.
    expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(5, 1) })
    engine.step(choose(engine))
    expect(choose(engine)).toEqual(END_TURN)
    engine.step(END_TURN)
    expect(choose(engine)).toEqual({ type: 'attack', unit: 'e1', target: 'p1' })
  })

  it('aggressive prefers a hex it can still strike from', () => {
    const engine = engineWith(hex(0, 1), hex(4, 1))
    expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(3, 1) }) // 3 AP, 5 left
    engine.step(choose(engine))
    expect(choose(engine)).toEqual(ATTACK_E1)
  })

  describe('aggressive with a hero’s techniques (step 12)', () => {
    type Placing = { id: string; side?: 'player' | 'enemy'; at: Hex; stats?: CombatantStats; hp?: number; statuses?: ActiveStatus[] }
    /** A hero (`p1`) of `stats` at `at`, and the others; statuses laid through a snapshot, as a save would carry them. */
    const stage = (stats: CombatantStats, at: Hex, others: Placing[], hp?: number, cols = 8) => {
      const engine = new BattleEngine({
        board: { cols, rows: 3 },
        units: [
          { id: 'p1', side: 'player', stats, position: at, hp },
          ...others.map(({ id, side = 'enemy', at, stats = GOBLIN_STATS, hp }) => ({ id, side, stats, position: at, hp })),
        ],
      })
      if (others.every((o) => !o.statuses)) return engine
      const snapshot = engine.snapshot()
      for (const o of others) if (o.statuses) snapshot.units.find((u) => u.id === o.id)!.statuses = o.statuses
      return BattleEngine.restore(snapshot)
    }
    const hero = (abilities: AbilityId[], extra: Partial<CombatantStats> = {}): CombatantStats => ({
      ...GOBLIN_STATS, name: 'Hero', abilities, magic: { maxMana: 20, skill: 50, spells: [] }, ...extra,
    })
    const use = (ability: AbilityId, target: string): Action => ({ type: 'ability', unit: 'p1', ability, target })
    const isUse = (ability: AbilityId) => (action: Action) => action.type === 'ability' && action.ability === ability

    it('exports the status values and the mana weight', () => {
      expect(STATUS_VALUE).toEqual({ chilled: 3, slowed: 3, pinned: 3, poisoned: 7, baned: 4 })
      expect(MANA_WEIGHT).toBe(0.5)
    })

    describe('a technique against a plain attack (1)', () => {
      const ARMOURED: CombatantStats = { ...GOBLIN_STATS, maxHp: 60, resistance: 4 }

      it('power-attacks an armoured foe, where +6 damage outweighs −10 to hit, though two plain blows fit in 12 AP', () => {
        const engine = stage(hero(['power_attack'], { actionPoints: 12 }), hex(1, 1), [{ id: 'e1', at: hex(2, 1), stats: ARMOURED }])
        const state = engine.getState()
        // 45% of (4.5 + 6 − 4), one Power Attack in 12 AP against two plain blows of 55% of 1.
        expect(techniqueScore(state, unitAt(engine, 'p1'), 'power_attack', unitAt(engine, 'e1'))).toBeCloseTo((0.45 * 6.5) / 2, 10)
        expect(engine.legalActions('p1')).toContainEqual(ATTACK_E1)
        expect(choose(engine)).toEqual(use('power_attack', 'e1'))
      })

      it('makes the plain attack where −10 to hit costs more than +6 damage gains', () => {
        // AC 60: a plain blow at 10% for 4.5 (0.45), the technique at the floor of 5% for 10.5, one against two (0.2625).
        const engine = stage(hero(['power_attack'], { actionPoints: 12 }), hex(1, 1), [{ id: 'e1', at: hex(2, 1), stats: { ...GOBLIN_STATS, ac: 60, resistance: 0 } }])
        expect(engine.legalActions('p1')).toContainEqual(use('power_attack', 'e1'))
        expect(choose(engine)).toEqual(ATTACK_E1)
      })

      it('power-attacks with a level-4 swordmaster’s iron sword at 8 AP, where either blow fits once (the step-15 review’s case)', () => {
        const aldric = readyMadeParty()[0]
        while (aldric.level < 4) {
          levelUp(aldric)
          autoAdvance(aldric, 'swordmaster')
        }
        const stats = deriveCombatStats(aldric)
        expect(stats.abilities).toContain('power_attack')
        expect([stats.attackApCost, stats.actionPoints]).toEqual([5, 8])
        const engine = stage(stats, hex(1, 1), [{ id: 'e1', at: hex(2, 1), stats: { ...GOBLIN_STATS, maxHp: 60, resistance: 0 } }])
        // 7 AP and 5 AP each fit once in 8: Power Attack's +6 outweighs its −10 to hit, as one blow against one.
        expect(choose(engine)).toEqual(use('power_attack', 'e1'))
      })

      it('weighs blows that fit, not the AP ratio: at 10 AP two plain blows fit and one Power Attack', () => {
        const engine = stage(hero(['power_attack'], { actionPoints: 10 }), hex(1, 1), [{ id: 'e1', at: hex(2, 1), stats: { ...GOBLIN_STATS, maxHp: 60, resistance: 4 } }])
        // One Power Attack (45% of 6.5) against two plain blows (2 × 55% of 1), in a plain blow's units: halved.
        expect(techniqueScore(engine.getState(), unitAt(engine, 'p1'), 'power_attack', unitAt(engine, 'e1'))).toBeCloseTo((0.45 * 6.5) / 2, 10)
      })

      it('counts a recharging technique once a turn, however many fit', () => {
        const big = { ...GOBLIN_STATS, maxHp: 60, resistance: 0 }
        const score = (ap: number) => {
          const engine = stage(hero(['cleave'], { actionPoints: ap }), hex(1, 1), [{ id: 'e1', at: hex(2, 1), stats: big }])
          return techniqueScore(engine.getState(), unitAt(engine, 'p1'), 'cleave', unitAt(engine, 'e1'))
        }
        // 14 AP fits two Cleaves (7 AP) and two plain blows; Cleave recharges, so one Cleave against two blows.
        expect(score(14)).toBeCloseTo(score(7) / 2, 10)
      })

      it('counts a mana technique no more times than its mana pays for, the heal reserve kept', () => {
        const foe = { ...GOBLIN_STATS, maxHp: 60, resistance: 0 }
        // At 12 AP two Frost Strikes (6 AP, 3 mana) fit by AP, and two plain blows.
        const score = (mana: number, spells: SpellId[] = []) => {
          const engine = stage(hero(['frost_strike'], { actionPoints: 12, magic: { maxMana: mana, skill: 50, spells } }), hex(1, 1), [{ id: 'e1', at: hex(2, 1), stats: foe }])
          return techniqueScore(engine.getState(), unitAt(engine, 'p1'), 'frost_strike', unitAt(engine, 'e1'))
        }
        const twice = score(6)
        // Mana for one: one Frost Strike against two blows.
        expect(score(3)).toBeCloseTo(twice / 2, 10)
        // Mana for two, but Heal's 3 kept back: one use, as the next choice would allow.
        expect(score(6, ['heal'])).toBeCloseTo(twice / 2, 10)
        expect(score(9, ['heal'])).toBeCloseTo(twice, 10)
      })

      it('scores Cleave’s second blow on the other foe in reach', () => {
        const big = { ...GOBLIN_STATS, maxHp: 60 }
        const pair = stage(hero(['cleave'], { actionPoints: 12 }), hex(1, 1), [{ id: 'e1', at: hex(2, 1), stats: big }, { id: 'e2', at: hex(2, 0), stats: { ...big, ac: 90 } }])
        const alone = stage(hero(['cleave'], { actionPoints: 12 }), hex(1, 1), [{ id: 'e1', at: hex(2, 1), stats: big }])
        const score = (engine: BattleEngine) => techniqueScore(engine.getState(), unitAt(engine, 'p1'), 'cleave', unitAt(engine, 'e1'))
        // The second blow goes to e2, whom it hits at 5% only.
        expect(score(pair)).toBeLessThan(score(alone))
      })
    })

    describe('status value (2)', () => {
      it('counts Venom Strike’s poison at 0 against an immune foe, as against one already poisoned (stage 11 step 03)', () => {
        const immune = stage(hero(['venom_strike']), hex(1, 1), [{ id: 'e1', at: hex(2, 1), stats: { ...GOBLIN_STATS, immune: true } }])
        const poisoned = stage(hero(['venom_strike']), hex(1, 1), [{ id: 'e1', at: hex(2, 1), statuses: [{ id: 'poisoned', turnsLeft: 2 }] }])
        const fresh = stage(hero(['venom_strike']), hex(1, 1), [{ id: 'e1', at: hex(2, 1) }])
        const score = (engine: BattleEngine) => techniqueScore(engine.getState(), unitAt(engine, 'p1'), 'venom_strike', unitAt(engine, 'e1'))
        expect(score(immune)).toBeCloseTo(score(poisoned), 10)
        expect(score(fresh) - score(immune)).toBeCloseTo(STATUS_VALUE.poisoned! * 0.55, 10)
        // A status that does not tick is worth what it is on any foe.
        const pin = (stats: CombatantStats) => {
          const engine = stage(hero(['pin']), hex(1, 1), [{ id: 'e1', at: hex(2, 1), stats }])
          return techniqueScore(engine.getState(), unitAt(engine, 'p1'), 'pin', unitAt(engine, 'e1'))
        }
        expect(pin({ ...GOBLIN_STATS, immune: true })).toBeCloseTo(pin(GOBLIN_STATS), 10)
      })

      it('counts Venom Strike’s poison at 7 times the chance, only against a foe not already poisoned', () => {
        const fresh = stage(hero(['venom_strike']), hex(1, 1), [{ id: 'e1', at: hex(2, 1) }])
        const poisoned = stage(hero(['venom_strike']), hex(1, 1), [{ id: 'e1', at: hex(2, 1), statuses: [{ id: 'poisoned', turnsLeft: 2 }] }])
        const score = (engine: BattleEngine) => techniqueScore(engine.getState(), unitAt(engine, 'p1'), 'venom_strike', unitAt(engine, 'e1'))
        // 55% to hit; at 8 AP one Venom Strike (6 AP) fits, as one plain blow (5 AP) does.
        expect(score(fresh) - score(poisoned)).toBeCloseTo(STATUS_VALUE.poisoned! * 0.55, 10)
        expect(score(poisoned)).toBeCloseTo(0.55 * 3.5 - MANA_WEIGHT * 2, 10)
      })

      it('counts Flame Strike’s searing at the target’s regeneration', () => {
        const at = (regeneration: number) => stage(hero(['flame_strike']), hex(1, 1), [{ id: 'e1', at: hex(2, 1), stats: { ...GOBLIN_STATS, regeneration } }])
        const score = (engine: BattleEngine) => techniqueScore(engine.getState(), unitAt(engine, 'p1'), 'flame_strike', unitAt(engine, 'e1'))
        expect(score(at(3)) - score(at(0))).toBeCloseTo(3 * 0.55, 10)
      })
    })

    it('counts Deathblow: a blow that would leave a foe at a quarter or less is worth all it has left (step 21)', () => {
      // e1: 13 of 40, hard to hit; an average blow (3.5 through its 1 resistance) leaves it at 9.5, within a quarter (10).
      const foes: Placing[] = [
        { id: 'e1', at: hex(2, 1), hp: 13, stats: { ...GOBLIN_STATS, maxHp: 40, ac: 30 } },
        { id: 'e2', at: hex(2, 0) },
      ]
      expect(choose(stage(hero([]), hex(1, 1), foes))).toEqual({ type: 'attack', unit: 'p1', target: 'e2' })
      expect(choose(stage(hero([], { traits: ['deathblow'] }), hex(1, 1), foes))).toEqual(ATTACK_E1)
      // Not against the blightborn.
      const blightborn = foes.map((f) => (f.id === 'e1' ? { ...f, stats: { ...f.stats!, blightborn: true as const } } : f))
      expect(choose(stage(hero([], { traits: ['deathblow'] }), hex(1, 1), blightborn))).toEqual({ type: 'attack', unit: 'p1', target: 'e2' })
    })

    it('keeps the mana for its cheapest heal rather than pin (3)', () => {
      // Pin is worth it here: 95% to hit a foe a 1d2 barely hurts, for 3 pinned. Heal costs 3.
      const pinner = (maxMana: number) =>
        stage(
          hero(['pin'], { toHit: 110, damage: { count: 1, sides: 2, bonus: 0 }, magic: { maxMana, skill: 50, spells: ['heal'] } }),
          hex(1, 1),
          [{ id: 'e1', at: hex(2, 1), stats: { ...GOBLIN_STATS, resistance: 0, maxHp: 60 } }],
        )
      expect(pinner(5).legalActions('p1')).toContainEqual(use('pin', 'e1'))
      expect(choose(pinner(5))).toEqual(ATTACK_E1)
      expect(choose(pinner(6))).toEqual(use('pin', 'e1'))
    })

    describe('area techniques (4)', () => {
      const ARCHER = hero(['volley'], { attackApCost: 4, attackRange: 5 })

      it('volleys two foes together, its weapon’s dice counted', () => {
        const engine = stage(ARCHER, hex(0, 1), [{ id: 'e1', at: hex(4, 1) }, { id: 'e2', at: hex(5, 1) }])
        const chosen = choose(engine)
        expect(isUse('volley')(chosen)).toBe(true)
        expect(castTouchesArea(engine, chosen).sort()).toEqual(['e1', 'e2'])
      })

      it('counts the foes’ resistance: two armoured foes are worth less than one bare one', () => {
        // Through resistance 4, each shot of 1d6+1 does 1: 2 × 55%, against a plain shot's 4.5 × 55% at the bare goblin.
        const armoured = { ...GOBLIN_STATS, resistance: 4 }
        const bare = { ...GOBLIN_STATS, resistance: 0 }
        const engine = stage(ARCHER, hex(1, 1), [
          { id: 'e1', at: hex(5, 1), stats: armoured },
          { id: 'e2', at: hex(6, 1), stats: armoured },
          { id: 'e3', at: hex(0, 0), stats: bare },
        ])
        expect(engine.legalActions('p1').some(isUse('volley'))).toBe(true)
        expect(choose(engine)).toEqual({ type: 'attack', unit: 'p1', target: 'e3' })
      })

      it('volleys not where an ally would take as much as the foe', () => {
        const engine = stage(ARCHER, hex(0, 1), [{ id: 'e1', at: hex(4, 1) }, { id: 'p2', side: 'player', at: hex(3, 1) }])
        expect(engine.legalActions('p1').some(isUse('volley'))).toBe(true)
        expect(choose(engine)).toEqual(ATTACK_E1)
      })

      it('consecrates foes about it and never counts an ally', () => {
        const engine = stage(hero(['consecrate']), hex(1, 1), [
          { id: 'e1', at: hex(2, 1) },
          { id: 'e2', at: hex(1, 0) },
          { id: 'p2', side: 'player', at: hex(0, 1) },
        ])
        const chosen = choose(engine)
        expect(chosen).toEqual({ type: 'ability', unit: 'p1', ability: 'consecrate', at: hex(1, 1) })
        const touched = abilityTouches(engine.getState().units, unitAt(engine, 'p1'), 'consecrate', hex(1, 1), 1)
        expect(touched.map((u) => u.id)).toEqual(['e1', 'e2'])
      })

      it('doubles Consecrate’s dice against the regenerating', () => {
        // A 2d6+1 blow (some 3.85 through the goblin's hide) beats 2d6 on one plain foe less 2.5 for the mana, not 4d6.
        const strong = hero(['consecrate'], { damage: { count: 2, sides: 6, bonus: 1 } })
        expect(choose(stage(strong, hex(1, 1), [{ id: 'e1', at: hex(2, 1) }]))).toEqual(ATTACK_E1)
        const troll = stage(strong, hex(1, 1), [{ id: 'e1', at: hex(2, 1), stats: { ...GOBLIN_STATS, regeneration: 1 } }])
        expect(isUse('consecrate')(choose(troll))).toBe(true)
      })
    })

    describe('tauntUse (5)', () => {
      const TAUNTER = hero(['taunt'], { maxHp: 20 })
      const taunt: Action = { type: 'ability', unit: 'p1', ability: 'taunt', at: hex(2, 1) }

      it('taunts two foes or more within its radius at half its hit points or more', () => {
        expect(choose(stage(TAUNTER, hex(2, 1), [{ id: 'e1', at: hex(3, 1) }, { id: 'e2', at: hex(4, 1) }], 10))).toEqual(taunt)
      })

      it('not below half its hit points', () => {
        expect(choose(stage(TAUNTER, hex(2, 1), [{ id: 'e1', at: hex(3, 1) }, { id: 'e2', at: hex(4, 1) }], 9))).not.toEqual(taunt)
      })

      it('not when every foe in its radius is already taunted', () => {
        const taunted: ActiveStatus[] = [{ id: 'taunted', turnsLeft: 1, source: 'p1' }]
        const engine = stage(TAUNTER, hex(2, 1), [{ id: 'e1', at: hex(3, 1), statuses: taunted }, { id: 'e2', at: hex(4, 1), statuses: taunted }])
        expect(engine.legalActions('p1')).toContainEqual(taunt)
        expect(choose(engine)).not.toEqual(taunt)
      })

      it('taunts one foe that threatens a worse-hurt ally, but not one that threatens only the user', () => {
        // e1 at (4,1) is beside p2 at (5,1) and 2 hexes from the user.
        const hurt = stage(TAUNTER, hex(2, 1), [{ id: 'e1', at: hex(4, 1) }, { id: 'p2', side: 'player', at: hex(5, 1), hp: 6 }])
        expect(choose(hurt)).toEqual(taunt)
        const hale = stage(TAUNTER, hex(2, 1), [{ id: 'e1', at: hex(4, 1) }, { id: 'p2', side: 'player', at: hex(5, 1) }])
        expect(choose(hale)).not.toEqual(taunt)
        const far = stage(TAUNTER, hex(2, 1), [{ id: 'e1', at: hex(4, 1) }, { id: 'p2', side: 'player', at: hex(7, 1), hp: 6 }])
        expect(choose(far)).not.toEqual(taunt)
      })
    })

    describe('markUse (6)', () => {
      const HUNTER = (ap: number) => hero(['hunters_mark'], { attackApCost: 4, attackRange: 5, actionPoints: ap })
      const foes = (marked: string[] = []): Placing[] =>
        (
          [
            ['e1', hex(3, 1), 10],
            ['e2', hex(4, 1), 12],
            ['e3', hex(4, 0), 12],
          ] as const
        ).map(([id, at, hp]) => ({ id, at, hp, ...(marked.includes(id) ? { statuses: [{ id: 'marked' as const, turnsLeft: 2 }] } : {}) }))

      it('marks the unmarked foe with the most hit points, the first on a tie, when it can then attack', () => {
        expect(choose(stage(HUNTER(8), hex(0, 1), foes()))).toEqual(use('hunters_mark', 'e2'))
      })

      it('never marks a foe again', () => {
        expect(choose(stage(HUNTER(8), hex(0, 1), foes(['e2'])))).toEqual(use('hunters_mark', 'e3'))
        expect(isUse('hunters_mark')(choose(stage(HUNTER(8), hex(0, 1), foes(['e1', 'e2', 'e3']))))).toBe(false)
      })

      it('not without the AP to attack after', () => {
        const engine = stage(HUNTER(5), hex(0, 1), foes())
        expect(engine.legalActions('p1')).toContainEqual(use('hunters_mark', 'e2'))
        expect(choose(engine)).toMatchObject({ type: 'attack' })
      })
    })

    describe('sprintUse (7)', () => {
      // 8 AP and a 5 AP blow: four hexes walked leave too few to strike, but enough with Sprint's 3.
      const SPRINTER = hero(['sprint'])
      const at = (q: number) => stage(SPRINTER, hex(0, 1), [{ id: 'e1', at: hex(q, 1) }], undefined, 12)

      it('sprints when only 3 more AP let it close and strike, then closes and strikes', () => {
        const engine = at(5)
        expect(choose(engine)).toEqual(use('sprint', 'p1'))
        engine.step(choose(engine))
        expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(4, 1) })
        engine.step(choose(engine))
        expect(choose(engine)).toEqual(ATTACK_E1)
      })

      it('not when it can close and strike without it, nor when 3 AP would not do, nor with a foe in reach', () => {
        expect(choose(at(3)).type).toBe('move')
        expect(choose(at(10)).type).toBe('move')
        expect(choose(at(1))).toEqual(ATTACK_E1)
      })
    })

    describe('taunted units (8)', () => {
      const byE2: ActiveStatus[] = [{ id: 'taunted', turnsLeft: 1, source: 'e2' }]
      /** p1 taunted by e2, with e1 first in the roster. */
      const taunted = (stats: CombatantStats, at: Hex, e1: Hex, e2: Hex, e2Hp?: number, e2Stats?: CombatantStats) => {
        const engine = stage(stats, at, [{ id: 'e1', at: e1, hp: 5, stats: { ...GOBLIN_STATS, resistance: 0 } }, { id: 'e2', at: e2, hp: e2Hp, stats: e2Stats }])
        const snapshot = engine.snapshot()
        snapshot.units[0].statuses = byE2
        return BattleEngine.restore(snapshot)
      }

      it('attacks its taunter, not the foe it would otherwise', () => {
        // Even at −25, a blow at the bare e1 (30% of 4.5) outscores one at the armoured e2 (55% of 1.5): only the rule turns it.
        const armoured = { ...GOBLIN_STATS, resistance: 3 }
        expect(choose(stage(GOBLIN_STATS, hex(1, 1), [{ id: 'e1', at: hex(2, 1) }, { id: 'e2', at: hex(2, 0), stats: armoured }]))).toEqual(ATTACK_E1)
        expect(choose(taunted(GOBLIN_STATS, hex(1, 1), hex(2, 1), hex(2, 0), undefined, armoured))).toEqual({ type: 'attack', unit: 'p1', target: 'e2' })
      })

      it('aims its hostile spell at its taunter', () => {
        const mage = { ...GOBLIN_STATS, magic: { maxMana: 20, skill: 70, spells: ['magic_arrow' as const] } }
        expect(choose(taunted(mage, hex(0, 1), hex(3, 1), hex(4, 1)))).toEqual({ type: 'cast', unit: 'p1', spell: 'magic_arrow', target: 'e2' })
      })

      it('closes on its taunter rather than the nearest foe, and as before once the taunter has fallen', () => {
        const toward = (engine: BattleEngine) => (choose(engine) as { to: Hex }).to
        const closing = taunted(GOBLIN_STATS, hex(3, 1), hex(0, 1), hex(7, 1))
        expect(toward(closing).q).toBeGreaterThan(3)
        const fallen = taunted(GOBLIN_STATS, hex(3, 1), hex(0, 1), hex(7, 1), 0)
        expect(toward(fallen).q).toBeLessThan(3)
      })
    })

    it('judges a caster’s reach at its spell’s cost to it (Quickened Casting)', () => {
      // Magic Arrow: 4 AP, range 5. Ten hexes off with 8 AP, a step of 5 leaves 3: enough only at a discount of 1.
      const caster = (apDiscount?: { all: number }) =>
        stage({ ...GOBLIN_STATS, magic: { maxMana: 20, skill: 70, spells: ['magic_arrow'], ...(apDiscount ? { apDiscount } : {}) } }, hex(0, 1), [{ id: 'e1', at: hex(10, 1) }], undefined, 12)
      expect(choose(caster({ all: 1 }))).toEqual({ type: 'move', unit: 'p1', to: hex(5, 1) })
      expect(choose(caster())).toEqual({ type: 'move', unit: 'p1', to: hex(8, 1) })
    })
  })

  describe('aggressive with a strike routine', () => {
    const versus = (stats: CombatantStats, trollAt: Hex, foe: CombatantStats = GOBLIN_STATS) =>
      new BattleEngine({
        board: { cols: 8, rows: 3 },
        units: [
          { id: 'p1', side: 'player', stats, position: trollAt },
          { id: 'e1', side: 'enemy', stats: foe, position: hex(2, 1) },
        ],
      })
    const routine = (ability: 'troll_claws' | 'spider_bite'): Action => ({ type: 'ability', unit: 'p1', ability, target: 'e1' })

    it('uses the Troll’s claws, two strikes, rather than one claw standing still', () => {
      const engine = versus(TROLL_STATS, hex(1, 1))
      expect(engine.legalActions('p1')).toContainEqual(ATTACK_E1)
      expect(choose(engine)).toEqual(routine('troll_claws'))
    })

    it('claws once with its weapon when it has moved and the routine is beyond its AP', () => {
      const engine = versus(TROLL_STATS, hex(0, 1))
      expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(1, 1) })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual(ATTACK_E1)
      engine.step(choose(engine))
      expect(choose(engine)).toEqual(END_TURN)
    })

    it('takes a routine on a tie with its weapon, and the weapon when it does more harm', () => {
      // Two bites of 1d6+2 against one blow of 2d6+4 or 2d6+5, at a foe nothing armours.
      const biter = (bonus: number) => ({ ...GOBLIN_STATS, damage: { count: 2, sides: 6, bonus }, abilities: ['spider_bite' as const] })
      expect(choose(versus(biter(4), hex(1, 1), KOBOLD_STATS))).toEqual(routine('spider_bite'))
      expect(choose(versus(biter(5), hex(1, 1), KOBOLD_STATS))).toEqual(ATTACK_E1)
    })

    it('counts the unit’s ability damage bonus in a routine’s harm', () => {
      const biter = { ...GOBLIN_STATS, damage: { count: 2, sides: 6, bonus: 5 }, abilities: ['spider_bite' as const], abilityDamageBonus: 1 }
      expect(choose(versus(biter, hex(1, 1), KOBOLD_STATS))).toEqual(routine('spider_bite'))
    })

    it('strikes with its weapon while its routine recharges', () => {
      const biter = { ...GOBLIN_STATS, attackApCost: 4, abilities: ['spider_bite' as const] }
      const engine = versus(biter, hex(1, 1), { ...GOBLIN_STATS, maxHp: 60 })
      expect(choose(engine)).toEqual(routine('spider_bite'))
      engine.step(choose(engine))
      expect(engine.legalActions('p1').some((a) => a.type === 'ability')).toBe(false)
      expect(choose(engine)).toEqual(ATTACK_E1)
    })
  })

  describe('aggressive with an on-hit weapon', () => {
    const EMBER: CombatantStats = { ...GOBLIN_STATS, onHit: [{ damage: 3, element: 'fire' }] }
    const FOE: CombatantStats = { ...GOBLIN_STATS, maxHp: 60 }
    const WARDED: CombatantStats = { ...FOE, wards: { fire: 3 } }
    const pair = (self: CombatantStats, e1: CombatantStats, e2: CombatantStats) =>
      new BattleEngine({
        board: { cols: 8, rows: 3 },
        units: [
          { id: 'p1', side: 'player', stats: self, position: hex(1, 1) },
          { id: 'e1', side: 'enemy', stats: e1, position: hex(2, 1) },
          { id: 'e2', side: 'enemy', stats: e2, position: hex(2, 0) },
        ],
      })
    const at = (target: string): Action => ({ type: 'attack', unit: 'p1', target })

    it('strikes the foe its fire gets through to', () => {
      expect(choose(pair(GOBLIN_STATS, FOE, FOE))).toEqual(at('e1'))
      expect(choose(pair(EMBER, WARDED, FOE))).toEqual(at('e2'))
      expect(choose(pair(EMBER, FOE, WARDED))).toEqual(at('e1'))
    })

    it('makes today’s choice without one, wards or not', () => {
      expect(choose(pair(GOBLIN_STATS, WARDED, FOE))).toEqual(at('e1'))
    })

    it('counts a bane only against the regenerating', () => {
      const dawn: CombatantStats = { ...GOBLIN_STATS, onHit: [{ damage: 3, element: 'blight', bane: true }] }
      expect(choose(pair(dawn, FOE, { ...FOE, regeneration: 1 }))).toEqual(at('e2'))
      expect(choose(pair(dawn, { ...FOE, regeneration: 1 }, FOE))).toEqual(at('e1'))
    })
  })

  describe('aggressive with an area ability', () => {
    // At (3,1), a cone of fire west of it covers (2,1), then (1,1), (1,2) and (2,0).
    const SPITTER: CombatantStats = { ...GOBLIN_STATS, name: 'Salamander', toHit: 80, attackApCost: 4, abilities: ['fire_spit'] }
    const BIG_GOBLIN: CombatantStats = { ...GOBLIN_STATS, maxHp: 60 }
    type Placing = [id: string, side: 'player' | 'enemy', at: Hex, stats?: CombatantStats]
    const field = (self: CombatantStats, selfAt: Hex, ...others: Placing[]) =>
      new BattleEngine({
        board: { cols: 8, rows: 3 },
        units: [
          { id: 'p1', side: 'player', stats: self, position: selfAt },
          ...others.map(([id, side, position, stats = BIG_GOBLIN]) => ({ id, side, stats, position })),
        ],
      })
    const isSpit = (action: Action) => action.type === 'ability' && action.ability === 'fire_spit'

    it('breathes where it touches two foes and no ally, but not where it would touch two allies and one foe', () => {
      const foes = field(SPITTER, hex(3, 1), ['e1', 'enemy', hex(2, 1)], ['e2', 'enemy', hex(2, 0)])
      const chosen = choose(foes)
      expect(isSpit(chosen)).toBe(true)
      expect(castTouchesArea(foes, chosen).sort()).toEqual(['e1', 'e2'])

      const crowded = field(SPITTER, hex(3, 1), ['e1', 'enemy', hex(2, 1)], ['p2', 'player', hex(1, 1)], ['p3', 'player', hex(1, 2)])
      expect(crowded.legalActions('p1').some(isSpit)).toBe(true)
      expect(choose(crowded)).toEqual(ATTACK_E1)
    })

    it('takes an area over a strike only when its net harm is greater', () => {
      // A 6d6+10 blow, some 19.5 a turn on a goblin, against fire's 13.2.
      const heavy = { ...SPITTER, damage: { count: 6, sides: 6, bonus: 10 } }
      expect(choose(field(heavy, hex(3, 1), ['e1', 'enemy', hex(2, 1)]))).toEqual(ATTACK_E1)
      expect(isSpit(choose(field(SPITTER, hex(3, 1), ['e1', 'enemy', hex(2, 1)])))).toBe(true)
    })

    it('scores a fire-warded foe lower', () => {
      // A 4d6+4 blow, 11.05 through the goblin's hide at 65%: under the cone's 13.2, over its 10.2 against a ward of 3.
      const armed = { ...SPITTER, damage: { count: 4, sides: 6, bonus: 4 } }
      expect(isSpit(choose(field(armed, hex(3, 1), ['e1', 'enemy', hex(2, 1)])))).toBe(true)
      const warded = { ...BIG_GOBLIN, wards: { fire: 3 } }
      expect(choose(field(armed, hex(3, 1), ['e1', 'enemy', hex(2, 1), warded]))).toEqual(ATTACK_E1)
      expect(choose(field(SPITTER, hex(3, 1), ['e1', 'enemy', hex(2, 1), { ...BIG_GOBLIN, wards: { fire: 99 } }]))).toEqual(ATTACK_E1)
    })

    it('strikes while its area recharges', () => {
      const engine = field(SPITTER, hex(3, 1), ['e1', 'enemy', hex(2, 1)])
      engine.step(choose(engine))
      expect(engine.getState().units[0].recharging).toEqual({ fire_spit: 2 })
      expect(choose(engine)).toEqual(ATTACK_E1)
    })

    describe('a status-only area (Web)', () => {
      const SPINNER: CombatantStats = { ...GOBLIN_STATS, name: 'Spider', abilities: ['spider_web'] }
      const isWeb = (action: Action) => action.type === 'ability' && action.ability === 'spider_web'

      it('webs a foe from range when no strike is in reach', () => {
        const engine = field(SPINNER, hex(0, 1), ['e1', 'enemy', hex(4, 1)])
        const chosen = choose(engine)
        expect(isWeb(chosen)).toBe(true)
        expect(castTouchesArea(engine, chosen)).toEqual(['e1'])
      })

      it('strikes instead when a foe is in reach', () => {
        expect(choose(field(SPINNER, hex(0, 1), ['e1', 'enemy', hex(1, 1)]))).toEqual(ATTACK_E1)
      })

      it('never webs where it would touch an ally, nor a foe already webbed', () => {
        const near = field(SPINNER, hex(0, 1), ['e1', 'enemy', hex(4, 1)], ['p2', 'player', hex(3, 1)])
        expect(near.legalActions('p1').some(isWeb)).toBe(true)
        expect(choose(near).type).toBe('move')

        const seeded = new BattleEngine(
          { board: { cols: 8, rows: 3 }, units: [{ id: 'p1', side: 'player', stats: SPINNER, position: hex(0, 1) }, { id: 'e1', side: 'enemy', stats: BIG_GOBLIN, position: hex(4, 1) }] },
          { seed: 1 },
        )
        const snapshot = seeded.snapshot()
        snapshot.units[1].statuses = [{ id: 'webbed', turnsLeft: 2 }]
        const webbed = BattleEngine.restore(snapshot)
        expect(webbed.legalActions('p1').some(isWeb)).toBe(true)
        expect(choose(webbed).type).toBe('move')
      })
    })
  })

  it('random picks among legal actions using the supplied rng', () => {
    const legal: Action[] = [ATTACK_E1, END_TURN]
    expect(POLICIES.random(context(legal, 0))).toEqual(ATTACK_E1)
    expect(POLICIES.random(context(legal, 0.99))).toEqual(END_TURN)
  })

  it('recognises only registered policy names', () => {
    expect(isPolicyName('aggressive')).toBe(true)
    expect(isPolicyName('toString')).toBe(false)
  })

  describe('the choices of today’s encounters (a snapshot, re-recorded in skill trees step 13 when heroes and bandits learned techniques, in step 16 when a technique came to be weighed by the blows that fit this turn and the Captain took Pin before Heavy Hand, in step 28 when nodes came to cost perk points and the heroes and bandits to save for them, and in step 30 when the knight, swordmaster and evoker_healer plans moved and the bandits at threat 4 went back to plain gear; and in long-campaign stage 9 step 01, when the Bandit Company and Freebooter Host came and the Spider Nest’s, Salamander Pool’s and Source’s bands widened, and in its step 09, when the Source’s guardians were raised to level 6 at most; and in long-campaign stage 10 step 02, when bandits from threat 9 took tiers 3 to 5; and in long-campaign stage 11 step 08, when ring 7’s wolves, worg riders and ogres came: their encounters’ lines added after the rest, every earlier line unchanged; and in long-campaign stage 11 step 09, when the Wyvern Roost came: its lines added after those, every earlier line unchanged; and in long-campaign stage 11 step 10, when ring 12’s wights, basilisks and giants came: their encounters’ lines added after those, every earlier line unchanged)', () => {
    /** Every action `aggressive` chooses, both sides, over each encounter at each threat of its band against the ready-made party of that level, a few seeds, 8 rounds at most. */
    function choices(): string[] {
      const lines: string[] = []
      for (const id of Object.keys(ENCOUNTERS) as EncounterId[]) {
        const { min, max } = ENCOUNTER_BANDS[id]
        for (let threat = min; threat <= max; threat++) {
          const party = readyMadeParty()
          for (const member of party) {
            while (member.level < threat) {
              levelUp(member)
              autoAdvance(member)
            }
          }
          for (const seed of [1, 2, 3]) {
            const { setup } = ENCOUNTERS[id](partyFighters(party), threat)
            const engine = new BattleEngine(setup, { seed })
            const rng = mulberry32(seed ^ 0x9e3779b9)
            for (let state = engine.getState(); state.phase !== 'over' && state.round <= 8; state = engine.getState()) {
              const action = POLICIES.aggressive({ state, legal: engine.legalActions(), rng })
              lines.push(`${id} ${threat} ${seed}: ${JSON.stringify(action)}`)
              engine.step(action)
            }
          }
        }
      }
      return lines
    }

    it('are what they were', () => {
      const lines = choices()
      const sha = (of: readonly string[]) => createHash('sha256').update(of.join('\n')).digest('hex')
      // The encounters before stage 11, as recorded in stage 10 step 02: the high roster's lines come after them (`ENCOUNTERS` order).
      const EARLIER = 14242
      expect(sha(lines.slice(0, EARLIER))).toBe('b9cef6e182080a3fa26d796534ec1b631e6628d6a140c11525ebee8fabb728ac')
      // With ring 7's (stage 11 step 08), as recorded there: ring 9's lines come after them.
      const RING_7 = 16403
      expect(new Set(lines.slice(EARLIER, RING_7).map((line) => line.split(' ')[0]))).toEqual(new Set(['wolf_pack', 'worg_riders', 'ogre_camp']))
      expect(sha(lines.slice(0, RING_7))).toBe('082484296b928e87debbded89fc5b7b04d81e8513f3a2eab59e23096f076ebc1')
      // With ring 9's (step 09), as recorded there, the Wyvern Roost's lines only: ring 12's lines come after them.
      const RING_9 = 17051
      expect(new Set(lines.slice(RING_7, RING_9).map((line) => line.split(' ')[0]))).toEqual(new Set(['wyvern_roost']))
      expect(sha(lines.slice(0, RING_9))).toBe('8e432c095a9a75e2639402953d9fefb423c92aaeeda5c631ea5b233ca8514c60')
      // Ring 12's (step 10): the Barrow Wights', the Basilisk Lair's and the Hill Giant Steading's lines only.
      expect(new Set(lines.slice(RING_9).map((line) => line.split(' ')[0]))).toEqual(new Set(['barrow_wights', 'basilisk_lair', 'hill_giant_steading']))
      expect(lines.length).toBe(19649)
      expect(sha(lines)).toBe('96ec580b1bd37e00f14c2c1b4df2f33f528dc178aa964bc8fe91fc85e6ca9136')
    }, 60_000)
  })
})
