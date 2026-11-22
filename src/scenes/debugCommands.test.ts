import { describe, expect, it, vi } from 'vitest'
import { maxHp } from '../character/character.ts'
import { setOrder } from '../game/company.ts'
import { newExpedition } from '../game/expedition.ts'
import { newGame, type GameState } from '../game/gameState.ts'
import { readyMadeParty } from '../game/party.ts'
import { UNEXPLORED } from '../game/vision.ts'
import { boardIndex } from '../game/blight.ts'
import { SOURCE_ID, earlyHex, threatAt } from '../game/worldMap.ts'
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

  it('party counts what each member has to spend in words of the right number', () => {
    const context = onWorldMap()
    const [aldric, brenna] = context.source!.game.parties[0].members
    aldric.skillPoints = 1
    aldric.perkPoints = 1
    brenna.skillPoints = 3
    brenna.perkPoints = 2
    const lines = runCommand('party', context).lines
    expect(lines.find((line) => line.includes('Aldric'))).toMatch(/\(1 skill point, 1 perk point\)$/)
    expect(lines.find((line) => line.includes('Brenna'))).toMatch(/\(3 skill points, 2 perk points\)$/)
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
    expect(runCommand('stock unobtainium 5', context).lines[0]).toMatch(/No material "unobtainium"/)
  })

  it('adds several material pairs at once, checking every pair before applying any', () => {
    const context = onWorldMap()
    const { world } = context.source!.game
    world.stock = {}
    expect(runCommand('stock gold 300 stone 50 iron 50', context)).toEqual({ lines: ['Stock: gold 300, stone 50, iron 50'], changed: true })
    for (const bad of ['stock gold 5 unobtainium 5', 'stock gold 5 iron', 'stock gold 5 iron x', 'stock gold 5 stone 1.5']) {
      const before = { ...world.stock }
      const result = runCommand(bad, context)
      expect(result.lines[0], bad).toMatch(/No material "unobtainium"|whole number/)
      expect(result.changed).toBe(false)
      expect(world.stock).toEqual(before)
    }
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

  it('leaves a party it moves idle, so that the days after walk no old route', () => {
    const context = onWorldMap()
    const { game } = context.source!
    const party = game.parties[0]
    expect(setOrder(game, party.id, { kind: 'travel', to: earlyHex(30, 10) })).toBeNull()
    runCommand('goto 2 3', context)
    expect(party.order).toEqual({ kind: 'idle' })
    runCommand('days 2', context)
    expect(hexToOffset(party.position)).toEqual({ col: 2, row: 3 })
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
    expect(setOrder(game, party.id, { kind: 'travel', to: earlyHex(3, 1) })).toBeNull()
    const route = party.order.kind === 'travel' ? [...party.order.route] : []
    runCommand('days 2', context)
    expect(party.position).toEqual(route[1])
  })

  it('adds a line of the yields over the days passed, by source', () => {
    const context = onWorldMap()
    const { world } = context.source!.game
    world.tradingPost = 4
    world.turn = 0
    world.stock = {}
    const lines = runCommand('days 5', context).lines
    expect(lines.at(-1)).toMatch(/^Yields over 5 days: .*market 2 gold$/)
    expect(world.stock.gold).toBeGreaterThanOrEqual(2)
    // None when nothing yielded: a day short of a yield day.
    expect(runCommand('days 1', context).lines.some((line) => line.startsWith('Yield'))).toBe(false)
    expect(runCommand('days 1', context).lines).toHaveLength(1)
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
    expect(runCommand('facility trading_post 0', context).lines[0]).toMatch(/from 1 to 6/)
    expect(runCommand('facility guild_hall 4', context).changed).toBe(true)
    expect(world.guildHall).toBe(4)
    expect(runCommand('facility guild_hall 6', context).lines[0]).toMatch(/from 1 to 5/)
    expect(runCommand('facility builders_lodge 2', context).changed).toBe(true)
    expect(world.lodge).toBe(2)
    expect(runCommand('facility builders_lodge 3', context).changed).toBe(true)
    expect(runCommand('facility builders_lodge 4', context).lines[0]).toMatch(/from 0 to 3/)
    runCommand('give iron_sword@3+light2', context)
    expect(baggage.at(-1)!.name).toBe('Light Masterwork Iron Longsword (II)')
  })

  describe('spawn', () => {
    it('places a nest of the kind at a hex, with the next id and the hex’s threat, drawing no RNG', () => {
      const context = onWorldMap()
      const { world } = context.source!.game
      // Stage 8's (20, 20), moved with home (earlyHex): offset (19, 37).
      const at = offsetToHex(19, 37)
      const before = { rng: world.rng, pressure: world.spawnPressure, spawns: world.spawns, count: world.locations.length }
      const result = runCommand('spawn goblin_raid 19 37', context)
      expect(result.changed).toBe(true)
      expect(result.lines[0]).toMatch(/Goblin Brood/)
      const placed = world.locations.at(-1)!
      expect(placed).toMatchObject({ id: `spawn_${before.spawns + 1}`, kind: 'monsters', name: 'Goblin Brood', encounter: 'goblin_raid', threat: threatAt(at), loot: [] })
      expect(placed.position).toEqual(at)
      expect(world.locations).toHaveLength(before.count + 1)
      expect(world.spawns).toBe(before.spawns + 1)
      expect(world.rng).toBe(before.rng)
      expect(world.spawnPressure).toBe(before.pressure)
      expect(world.blight[37 * world.board.cols + 19]).toBe(3)
      expect(world.sighted).toContain(placed.id)
    })

    it('updates sight: a nest placed in sight shows its corrupted hex as seen (verification round 1)', () => {
      const context = onWorldMap()
      const { world } = context.source!.game
      // Stage 8's (10, 21), moved with home (earlyHex): offset (10, 38).
      const at = offsetToHex(10, 38)
      const index = boardIndex(world.board, at)
      expect(world.seen[index]).toBeGreaterThanOrEqual(0)
      expect(world.seen[index]).toBeLessThan(3)
      runCommand('spawn goblin_raid 10 38', context)
      expect(world.seen[index]).toBe(3)
    })

    it('takes a location’s hex, and the other kinds; the next spawn has the next id', () => {
      const context = onWorldMap()
      const { world, parties } = context.source!.game
      const site = world.locations.find((l) => l.id !== 'encampment' && l.kind === 'resource')!
      // Stage 8's (10, 14), (11, 12) and (4, 5), moved with home (earlyHex).
      parties[0].position = offsetToHex(9, 31)
      runCommand(`spawn kobold_scouts 10 29`, context)
      expect(world.locations.at(-1)).toMatchObject({ name: 'Kobold Nest', encounter: 'kobold_scouts', position: offsetToHex(10, 29) })
      expect(runCommand(`spawn kobold_scouts ${site.id}`, context).changed).toBe(false)
      runCommand('spawn bandit_camp 4 22', context)
      expect(world.locations.at(-1)).toMatchObject({ name: 'Bandit Gang', id: `spawn_${world.spawns}` })
      const first = world.locations.at(-2)!.id
      expect(first).not.toBe(world.locations.at(-1)!.id)
    })

    it('refuses an unknown kind, an occupied hex, a hex off the map and a missing kind, changing nothing', () => {
      const context = onWorldMap()
      const { world } = context.source!.game
      const before = JSON.stringify(world)
      expect(runCommand('spawn dragon 20 20', context)).toMatchObject({ changed: false, lines: [expect.stringMatching(/goblin_raid, kobold_scouts, bandit_camp/)] })
      expect(runCommand('spawn goblin_raid encampment', context).lines[0]).toMatch(/already stands/)
      expect(runCommand('spawn goblin_raid millbrook', context).changed).toBe(false)
      expect(runCommand('spawn goblin_raid 999 999', context).lines[0]).toMatch(/off the map/)
      expect(runCommand('spawn', context).changed).toBe(false)
      expect(JSON.stringify(world)).toBe(before)
    })

    it('needs a hex, and refuses the one a party stands on, here included, so no party stands on a nest unconfronted', () => {
      const context = onWorldMap()
      const { world, parties } = context.source!.game
      parties[0].position = earlyHex(10, 14)
      const count = world.locations.length
      expect(runCommand('spawn goblin_raid', context)).toMatchObject({ changed: false, lines: [expect.stringMatching(/Name the hex/)] })
      expect(runCommand('spawn goblin_raid here', context).lines[0]).toMatch(/A party stands/)
      const { col, row } = hexToOffset(parties[0].position)
      expect(runCommand(`spawn goblin_raid ${col} ${row}`, context).changed).toBe(false)
      expect(world.locations).toHaveLength(count)
      expect(world.spawns).toBe(0)
    })

    it('needs the world map', () => {
      const context = onWorldMap()
      context.scenes = ['Battle']
      context.source!.changed = undefined
      expect(runCommand('spawn goblin_raid 20 20', context)).toMatchObject({ changed: false })
    })
  })

  describe('contact', () => {
    it('contacts a partner by id, and says so when it is contacted already', () => {
      const context = onWorldMap()
      const { world } = context.source!.game
      const result = runCommand('contact millbrook', context)
      expect(result.changed).toBe(true)
      expect(result.lines[0]).toMatch(/Millbrook/)
      expect(world.contacted).toEqual(['millbrook'])
      const again = runCommand('contact millbrook', context)
      expect(again.lines[0]).toMatch(/already/)
      expect(world.contacted).toEqual(['millbrook'])
    })

    it('contacts every partner with all, in locations order', () => {
      const context = onWorldMap()
      const { world } = context.source!.game
      runCommand('contact all', context)
      expect(world.contacted).toEqual(['millbrook', 'saltmere', 'stonehollow', 'elder_glade', 'emberwatch'])
    })

    it('refuses an unknown id, naming the partners, and no argument', () => {
      const context = onWorldMap()
      expect(runCommand('contact nowhere', context)).toMatchObject({ changed: false, lines: [expect.stringMatching(/millbrook, saltmere/)] })
      expect(runCommand('contact', context).changed).toBe(false)
      expect(runCommand('contact encampment', context).changed).toBe(false)
      expect(context.source!.game.world.contacted).toEqual([])
    })
  })

  describe('blight', () => {
    const level = (context: DebugContext, col: number, row: number) => {
      const { world } = context.source!.game
      return [world.blight[row * world.board.cols + col], world.shift[row * world.board.cols + col]]
    }

    it('sets the level of the party’s hex, by default, and resets its shift', () => {
      const context = onWorldMap()
      const { world, parties } = context.source!.game
      const { col, row } = hexToOffset(parties[0].position)
      world.shift[row * world.board.cols + col] = 5
      const result = runCommand('blight 2', context)
      expect(result.changed).toBe(true)
      expect(result.lines[0]).toMatch(/blight level 2/)
      expect(level(context, col, row)).toEqual([2, 0])
      expect(runCommand('blight 1 here', context).changed).toBe(true)
      expect(level(context, col, row)).toEqual([1, 0])
    })

    it('takes a location by id, or a hex by column and row, and names what stands there', () => {
      const context = onWorldMap()
      const { world } = context.source!.game
      const site = world.locations.find((l) => l.id !== 'encampment' && l.kind === 'resource')!
      const { col, row } = hexToOffset(site.position)
      world.shift[row * world.board.cols + col] = 3
      expect(runCommand(`blight 3 ${site.id}`, context).lines[0]).toContain(site.name)
      expect(level(context, col, row)).toEqual([3, 0])
      expect(runCommand('blight 1 4 5', context).lines[0]).toContain('(4, 5)')
      expect(level(context, 4, 5)).toEqual([1, 0])
      expect(runCommand('blight 1 encampment', context).changed).toBe(true)
    })

    it('refuses a level out of range, an unknown location and a hex off the map, changing nothing', () => {
      const context = onWorldMap()
      const before = JSON.stringify(context.source!.game.world.blight)
      expect(runCommand('blight 4', context)).toMatchObject({ changed: false, lines: [expect.stringMatching(/0 to 3/)] })
      expect(runCommand('blight -1', context).changed).toBe(false)
      expect(runCommand('blight 1 nowhere', context).lines[0]).toMatch(/No location "nowhere"/)
      expect(runCommand('blight 1 999 999', context).lines[0]).toMatch(/off the map/)
      expect(runCommand('blight x', context).lines[0]).toMatch(/whole number/)
      expect(JSON.stringify(context.source!.game.world.blight)).toBe(before)
    })

    it('needs the world map, as every change does', () => {
      const reading: DebugContext = { scenes: ['Battle'], seed: null, source: { game: newGame(undefined, null, 7) } }
      expect(runCommand('blight 1', reading).changed).toBe(false)
    })
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

    it('sets hit points with `hp`, for one member or all of a named party, kept within 0 and the maximum', () => {
      const context = twoParties()
      const [first, second] = context.source!.game.parties
      const result = runCommand('hp 1 1', context)
      expect(result.changed).toBe(true)
      expect(result.lines).toEqual([`${first.members[0].name} now has 1/${maxHp(first.members[0])} hit points.`])
      expect(first.members.map((m) => m.hp)).toEqual([1, maxHp(first.members[1]), maxHp(first.members[2])])
      expect(runCommand('hp 0 all @second', context).lines).toHaveLength(3)
      expect(second.members.every((m) => m.hp === 0)).toBe(true)
      runCommand('hp 9999 2', context)
      expect(first.members[1].hp).toBe(maxHp(first.members[1]))
    })

    it('refuses `hp` without a whole number of 0 or more, changing nothing', () => {
      const context = twoParties()
      const before = structuredClone(context.source!.game)
      for (const line of ['hp', 'hp -1', 'hp 1.5 1', 'hp x', 'hp 1 9']) {
        const result = runCommand(line, context)
        expect(result.changed).toBe(false)
        expect(result.lines[0]).toMatch(/whole number|0 or more|No party member/)
      }
      expect(context.source!.game).toEqual(before)
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
      const [first, second] = context.source!.game.parties
      first.order = { kind: 'meet', party: 'party_2' }
      second.order = { kind: 'travel', to: earlyHex(4, 2), route: [earlyHex(4, 2)] }
      const orders = runCommand('party', context).lines.filter((line) => /^party_\d /.test(line))
      expect(orders).toEqual([expect.stringMatching(/, order meet party_2$/), expect.stringMatching(/, order travel to 3,19$/)])
      first.order = { kind: 'garrison' }
      second.order = { kind: 'day', action: { kind: 'camp' } }
      expect(runCommand('party', context).lines.filter((line) => /^party_\d /.test(line))).toEqual([
        expect.stringMatching(/, order garrison$/),
        expect.stringMatching(/, order day camp$/),
      ])
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
