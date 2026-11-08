import { describe, expect, it, vi } from 'vitest'
import { maxHp } from '../character/character.ts'
import { setOrder } from '../game/company.ts'
import { newExpedition } from '../game/expedition.ts'
import { newGame, type GameState } from '../game/gameState.ts'
import { readyMadeParty } from '../game/party.ts'
import { UNEXPLORED } from '../game/vision.ts'
import { SOURCE_ID, threatAt } from '../game/worldMap.ts'
import { hexToOffset, offsetToHex } from '../grid/hex.ts'
import { completions, runCommand, COMMAND_NAMES, type DebugContext } from './debugCommands.ts'

/** A context on the world map that can start battles, recording the ones it was asked for. */
function withFight(game: GameState = newGame(undefined, null, 7)): DebugContext & { fight: ReturnType<typeof vi.fn> } {
  const fight = vi.fn()
  return { scenes: ['World'], seed: 42, source: { game, changed: vi.fn(), fight }, fight }
}

/** A context on the world map, which takes changes, unless `changed` is left out. */
function onWorldMap(game: GameState = newGame(undefined, null, 7)): DebugContext & { changed: ReturnType<typeof vi.fn> } {
  const changed = vi.fn()
  return { scenes: ['World'], seed: 42, source: { game, changed }, changed }
}

describe('debug commands', () => {
  it('help lists every command, and tells how to use one', () => {
    const { lines } = runCommand('help', onWorldMap())
    for (const name of COMMAND_NAMES) expect(lines.some((line) => line.startsWith(name))).toBe(true)
    expect(runCommand('help goto', onWorldMap()).lines[0]).toMatch(/^goto/)
    expect(runCommand('help nonsense', onWorldMap()).lines).toEqual(['No command "nonsense".'])
  })

  it('tells of an unknown command, and does nothing for an empty line', () => {
    expect(runCommand('fly', onWorldMap()).lines[0]).toMatch(/Unknown command "fly"/)
    expect(runCommand('   ', onWorldMap())).toEqual({ lines: [], changed: false })
  })

  it('heals a member named by the start of its name, and says the game changed', () => {
    const context = onWorldMap()
    const [first, second] = context.source!.game.parties[0].members
    first.hp = 1
    second.hp = 1
    const result = runCommand(`heal ${first.name.slice(0, 3).toLowerCase()}`, context)
    expect(result.changed).toBe(true)
    expect(first.hp).toBe(maxHp(first))
    expect(second.hp).toBe(1)
  })

  it('refuses a change off the world map, but reads there', () => {
    const game = newGame(undefined, null, 7)
    const reading: DebugContext = { scenes: ['Battle'], seed: null, source: { game } }
    expect(runCommand('xp 500', reading)).toEqual({ lines: ['xp changes the game, which works only on the world map.'], changed: false })
    expect(runCommand('party', reading).lines).toHaveLength(1 + game.parties[0].members.length)
    expect(runCommand('stock', reading).changed).toBe(false)
    expect(runCommand('stock gold 5', reading).changed).toBe(false)
  })

  it('gives experience, raising levels', () => {
    const context = onWorldMap()
    runCommand('xp 10000 1', context)
    expect(context.source!.game.parties[0].members[0].level).toBeGreaterThan(1)
    expect(context.source!.game.parties[0].members[1].level).toBe(1)
  })

  it('adds to the stock, and checks the material', () => {
    const context = onWorldMap()
    expect(runCommand('stock gold 50', context)).toEqual({ lines: ['Stock: gold 50'], changed: true })
    expect(runCommand('stock gold -80', context).lines).toEqual(['Stock: gold 0'])
    expect(runCommand('stock mithril 5', context).lines[0]).toMatch(/No material "mithril"/)
  })

  it('puts items in the baggage by id', () => {
    const context = onWorldMap()
    runCommand('give yew_bow 2', context)
    expect(context.source!.game.parties[0].baggage.map((item) => item.id)).toEqual(['yew_bow', 'yew_bow'])
    expect(runCommand('give nothing', context).lines[0]).toMatch(/No item/)
  })

  it('puts runes in the pouch, lists them, and lists the rune keys', () => {
    const context = onWorldMap()
    expect(runCommand('runes', context).lines).toEqual(['The pouch is empty.'])
    const answer = runCommand('give storm1 3', context)
    expect(answer).toEqual({ lines: ['3 × Lesser Storm Rune put in the pouch.'], changed: true })
    expect(context.source!.game.runes.storm1).toBe(3)
    expect(runCommand('runes', context).lines[0]).toMatch(/storm1\s+3 × Lesser Storm Rune/)
    runCommand('give iron_sword@3#ember1', context)
    expect(context.source!.game.parties[0].baggage.at(-1)!.id).toBe('iron_sword@3#ember1')
    expect(runCommand('give storm1 0', context).lines[0]).toMatch(/at least 1/)
    const items = runCommand('items', context).lines.join('\n')
    expect(items).toContain('storm1')
    expect(items).toContain('Runes: <id>#')
  })

  it('reveals the map, and moves the party onto a location, confronting its monsters', () => {
    const context = onWorldMap()
    const { world } = context.source!.game
    const party = context.source!.game.parties[0]
    runCommand('reveal', context)
    expect(world.seen.includes(UNEXPLORED)).toBe(false)
    expect(world.sighted).toContain(SOURCE_ID)
    runCommand(`goto ${SOURCE_ID}`, context)
    expect(party.confronting).toBe(SOURCE_ID)
    runCommand('goto 2 3', context)
    expect(hexToOffset(party.position)).toEqual({ col: 2, row: 3 })
    expect(party.confronting).toBeNull()
    expect(runCommand('goto 999 0', context).lines[0]).toMatch(/off the map/)
  })

  it('passes days', () => {
    const context = onWorldMap()
    const { world } = context.source!.game
    const turn = world.turn
    runCommand('days 5', context)
    expect(world.turn).toBe(turn + 5)
    expect(runCommand('days x', context).lines[0]).toMatch(/whole number/)
  })

  it('passes days through the day loop, so the party carries out its order', () => {
    const context = onWorldMap()
    const game = context.source!.game
    const party = game.parties[0]
    game.world.sighted = game.world.locations.filter((l) => l.kind === 'monsters').map((l) => l.id)
    expect(setOrder(game, party.id, { kind: 'travel', to: offsetToHex(3, 1) })).toBeNull()
    const route = party.order.kind === 'travel' ? [...party.order.route] : []
    runCommand('days 2', context)
    expect(party.position).toEqual(route[1])
  })

  it('stops passing days, saying why, while the party faces monsters', () => {
    const context = onWorldMap()
    const { world, parties } = context.source!.game
    parties[0].confronting = 'goblin_raiders'
    const turn = world.turn
    expect(runCommand('days 3', context).lines).toEqual([
      `0 days pass; it is turn ${turn}.`,
      '  The party stands before the Goblin Raiders: scout, wait or attack.',
    ])
    expect(world.turn).toBe(turn)
  })

  it('lists units only in battle', () => {
    expect(runCommand('units', onWorldMap()).lines).toEqual(['No battle is being fought.'])
  })

  it('completes command names', () => {
    expect(completions('he')).toEqual(['help', 'heal'])
    expect(completions('rev')).toEqual(['reveal'])
  })

  it('sets a facility’s level, within its levels, and gives graded and modified items', () => {
    const context = onWorldMap()
    const { world } = context.source!.game
    const { baggage } = context.source!.game.parties[0]
    expect(runCommand('facility workshop 2', context).changed).toBe(true)
    expect(world.workshop).toBe(2)
    expect(runCommand('facility workshop 4', context).lines[0]).toMatch(/from 0 to 3/)
    expect(runCommand('facility trading_post 0', context).lines[0]).toMatch(/from 1 to 4/)
    runCommand('give iron_sword@3+light2', context)
    expect(baggage.at(-1)!.name).toBe('Light Masterwork Iron Longsword (II)')
  })

  describe('fight', () => {
    it('starts a battle of the encounter at the threat given', () => {
      const context = withFight()
      const result = runCommand('fight goblin_raid 3', context)
      expect(context.fight).toHaveBeenCalledWith('goblin_raid', 3, 'party_1')
      expect(result.lines).toEqual(['Fighting goblin_raid at threat 3.'])
    })

    it('fights at the threat of the party’s hex when none is given', () => {
      const context = withFight()
      const { world } = context.source!.game
      const party = context.source!.game.parties[0]
      runCommand('fight kobold_scouts', context)
      expect(context.fight).toHaveBeenLastCalledWith('kobold_scouts', threatAt(party.position), 'party_1')
      const far = world.locations.find((location) => location.id === 'bandit_camp')!
      party.position = far.position
      expect(threatAt(party.position)).toBe(3)
      runCommand('fight kobold_scouts', context)
      expect(context.fight).toHaveBeenLastCalledWith('kobold_scouts', 3, 'party_1')
    })

    it('refuses an unknown or missing encounter and a threat below 1 or not a whole number', () => {
      const context = withFight()
      expect(runCommand('fight dragons 2', context).lines[0]).toMatch(/No encounter "dragons"; there are .*goblin_raid.*bandit_camp/)
      expect(runCommand('fight', context).lines[0]).toMatch(/No encounter ""/)
      expect(runCommand('fight goblin_raid 0', context).lines[0]).toMatch(/at least 1/)
      expect(runCommand('fight goblin_raid -1', context).lines[0]).toMatch(/at least 1/)
      expect(runCommand('fight goblin_raid x', context).lines[0]).toMatch(/whole number/)
      expect(context.fight).not.toHaveBeenCalled()
    })

    it('is refused where battles cannot start, and off the world map', () => {
      expect(runCommand('fight goblin_raid 2', onWorldMap()).lines).toEqual(['Battles start only from the world map.'])
      const game = newGame(undefined, null, 7)
      const fight = vi.fn()
      const inBattle: DebugContext = { scenes: ['Battle'], seed: null, source: { game, fight } }
      expect(runCommand('fight goblin_raid 2', inBattle)).toEqual({ lines: ['fight changes the game, which works only on the world map.'], changed: false })
      expect(fight).not.toHaveBeenCalled()
    })

    it('is listed by help', () => {
      expect(runCommand('help', onWorldMap()).lines.some((line) => line.startsWith('fight <encounter> [threat]'))).toBe(true)
    })
  })

  describe('naming a party with @', () => {
    /** A game of two parties, to tell them apart; the second has its own members and baggage. */
    function twoParties(): DebugContext & { changed: ReturnType<typeof vi.fn> } {
      const context = onWorldMap()
      const game = context.source!.game
      game.parties.push({ ...newExpedition(readyMadeParty(), game.parties[0].position), id: 'party_2', name: 'Second Company' })
      return context
    }

    it('selects a party by id or by the start of its name, ignoring case', () => {
      const context = twoParties()
      const [first, second] = context.source!.game.parties
      runCommand('give yew_bow @party_2', context)
      runCommand('give iron_sword @first', context)
      runCommand('give iron_spear @SEC', context)
      expect(first.baggage.map((item) => item.id)).toEqual(['iron_sword'])
      expect(second.baggage.map((item) => item.id)).toEqual(['yew_bow', 'iron_spear'])
    })

    it('acts on the source’s party without one, else on the first', () => {
      const context = twoParties()
      const [first, second] = context.source!.game.parties
      runCommand('give yew_bow', context)
      context.source!.party = 'party_2'
      runCommand('give iron_sword', context)
      context.source!.party = 'nobody'
      runCommand('give iron_spear', context)
      expect(first.baggage.map((item) => item.id)).toEqual(['yew_bow', 'iron_spear'])
      expect(second.baggage.map((item) => item.id)).toEqual(['iron_sword'])
    })

    it('reads the member and the hex within the named party', () => {
      const context = twoParties()
      const [first, second] = context.source!.game.parties
      first.members[0].hp = 1
      second.members[0].hp = 1
      expect(runCommand(`heal 1 @party_2`, context).changed).toBe(true)
      expect(first.members[0].hp).toBe(1)
      expect(second.members[0].hp).toBe(maxHp(second.members[0]))
      runCommand('goto 3 4 @second', context)
      expect(hexToOffset(second.position)).toEqual({ col: 3, row: 4 })
      expect(hexToOffset(first.position)).not.toEqual({ col: 3, row: 4 })
    })

    it('fights with the named party', () => {
      const context = Object.assign(twoParties(), { fight: vi.fn() })
      context.source!.fight = context.fight
      runCommand('fight goblin_raid 2 @party_2', context)
      expect(context.fight).toHaveBeenCalledWith('goblin_raid', 2, 'party_2')
    })

    it('tells an unknown party, naming the company’s', () => {
      const context = onWorldMap()
      const result = runCommand('heal @nobody', context)
      expect(result.changed).toBe(false)
      expect(result.lines).toEqual(['No party "@nobody"; there are party_1 (First Company).'])
    })

    it('refuses a bare @, naming no party', () => {
      const context = twoParties()
      const result = runCommand('give yew_bow @', context)
      expect(result.changed).toBe(false)
      expect(result.lines[0]).toMatch(/^No party "@"/)
      expect(context.source!.game.parties.every((party) => party.baggage.length === 0)).toBe(true)
    })

    it('lists the company with `party`, or one party with `party @name`', () => {
      const context = twoParties()
      const all = runCommand('party', context).lines
      expect(all[0]).toMatch(/^party_1 \(First Company\) at \d+,\d+, order idle$/)
      expect(all[1]).toMatch(/^1\. /)
      expect(all[1 + context.source!.game.parties[0].members.length]).toMatch(/^party_2 \(Second Company\)/)
      const one = runCommand('party @second', context).lines
      expect(one).toHaveLength(1 + context.source!.game.parties[1].members.length)
      expect(one[0]).toMatch(/^party_2 /)
    })

    it('lists where each party stands with `locations`', () => {
      const lines = runCommand('locations', twoParties()).lines
      expect(lines.filter((line) => /^party_\d \(/.test(line))).toHaveLength(2)
    })
  })
})
