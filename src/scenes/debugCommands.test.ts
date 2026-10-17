import { describe, expect, it, vi } from 'vitest'
import { maxHp } from '../character/character.ts'
import { newGame, type GameState } from '../game/gameState.ts'
import { UNEXPLORED } from '../game/vision.ts'
import { SOURCE_ID } from '../game/worldMap.ts'
import { hexToOffset } from '../grid/hex.ts'
import { completions, runCommand, COMMAND_NAMES, type DebugContext } from './debugCommands.ts'

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
    const [first, second] = context.source!.game.party
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
    expect(runCommand('party', reading).lines).toHaveLength(game.party.length)
    expect(runCommand('stock', reading).changed).toBe(false)
    expect(runCommand('stock gold 5', reading).changed).toBe(false)
  })

  it('gives experience, raising levels', () => {
    const context = onWorldMap()
    runCommand('xp 10000 1', context)
    expect(context.source!.game.party[0].level).toBeGreaterThan(1)
    expect(context.source!.game.party[1].level).toBe(1)
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
    expect(context.source!.game.baggage.map((item) => item.id)).toEqual(['yew_bow', 'yew_bow'])
    expect(runCommand('give nothing', context).lines[0]).toMatch(/No item/)
  })

  it('reveals the map, and moves the party onto a location, confronting its monsters', () => {
    const context = onWorldMap()
    const { world } = context.source!.game
    runCommand('reveal', context)
    expect(world.seen.includes(UNEXPLORED)).toBe(false)
    expect(world.sighted).toContain(SOURCE_ID)
    runCommand(`goto ${SOURCE_ID}`, context)
    expect(world.confronting).toBe(SOURCE_ID)
    runCommand('goto 2 3', context)
    expect(hexToOffset(world.party)).toEqual({ col: 2, row: 3 })
    expect(world.confronting).toBeNull()
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

  it('lists units only in battle', () => {
    expect(runCommand('units', onWorldMap()).lines).toEqual(['No battle is being fought.'])
  })

  it('completes command names', () => {
    expect(completions('he')).toEqual(['help', 'heal'])
    expect(completions('rev')).toEqual(['reveal'])
  })
})
