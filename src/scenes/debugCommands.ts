import { maxHp, maxMana, manaOf, type Character } from '../character/character.ts'
import { gainXp, xpToNextLevel } from '../character/progression.ts'
import type { BattleState } from '../engine/battleEngine.ts'
import type { GameState } from '../game/gameState.ts'
import type { Material } from '../game/territory.ts'
import { updateSight } from '../game/vision.ts'
import { isNotable, monstersHere, passTurn, worldActive, type WorldLocation } from '../game/worldMap.ts'
import { HexBoard, hexToOffset, offsetToHex } from '../grid/hex.ts'
import { MAGIC_ITEMS, WEAPONS, itemById } from '../inventory/inventory.ts'
import { describeWorldEvent } from './worldEvents.ts'

/**
 * The debug console's commands (debugConsole.ts lays the console over the game, in dev
 * builds, opened by ~). Each command reads or changes the game the scene in front shows;
 * the console finds that scene's `DebugSource` and hands it here as a `DebugContext`.
 * Commands that change the game run only on the world map, which redraws and saves after
 * them: a battle's engine knows nothing of characters, so a change there would not reach it.
 */

/** What a scene offers the debug console: its game, its battle if it fights one, and how it takes a change. */
export interface DebugSource {
  game: GameState
  battle?: { state: BattleState; names: Readonly<Record<string, string>> }
  /** Redraws and saves after a command changed the game; absent where changes are refused. */
  changed?: () => void
}

export interface DebugContext {
  /** The scenes running, a paused one marked so. */
  scenes: string[]
  /** The session's seed, from the page's address, or null when each battle draws its own. */
  seed: number | null
  source: DebugSource | null
}

export interface DebugResult {
  lines: string[]
  /** Whether the command changed the game, so the scene must redraw and save. */
  changed: boolean
}

interface Command {
  usage: string
  summary: string
  /** Changes the game, and so needs the world map in front: always, or only when given arguments. */
  changes?: true | 'withArgs'
  run(args: string[], context: DebugContext): string[]
}

/** Every material a stock may hold, for `stock`'s help and checks. */
const MATERIALS = Object.keys({
  gold: 0, iron: 0, timber: 0, silver: 0, stone: 0, salt: 0, copper: 0, crystal: 0, peat: 0,
} satisfies Record<Material, number>) as Material[]

class DebugError extends Error {}

function gameOf(context: DebugContext): GameState {
  if (!context.source) throw new DebugError('No game is running.')
  return context.source.game
}

/** A whole number from an argument, or an error naming what it was for. */
function integer(text: string | undefined, what: string): number {
  const n = Number(text)
  if (text === undefined || !Number.isInteger(n)) throw new DebugError(`Expected a whole number for ${what}, got "${text ?? ''}".`)
  return n
}

/** The members a command names: by number (from 1) or by the start of a name, or all of them with none named. */
function members(game: GameState, who: string | undefined): Character[] {
  if (who === undefined || who === 'all') return game.party
  const index = Number(who)
  if (Number.isInteger(index)) {
    const member = game.party[index - 1]
    if (!member) throw new DebugError(`No party member ${who}; there are ${game.party.length}.`)
    return [member]
  }
  const named = game.party.filter((member) => member.name.toLowerCase().startsWith(who.toLowerCase()))
  if (named.length !== 1) throw new DebugError(named.length === 0 ? `No party member named "${who}".` : `"${who}" names ${named.length} members.`)
  return named
}

const offset = (location: { position: WorldLocation['position'] }): string => {
  const { col, row } = hexToOffset(location.position)
  return `${col},${row}`
}

const COMMANDS: Record<string, Command> = {
  help: {
    usage: 'help [command]',
    summary: 'List the commands, or tell how to use one.',
    run([name]) {
      if (name !== undefined) {
        const command = COMMANDS[name]
        if (!command) throw new DebugError(`No command "${name}".`)
        return [command.usage, `  ${command.summary}`, ...(command.changes ? [`  Changes the game${command.changes === 'withArgs' ? ' when given arguments' : ''}: only on the world map.`] : [])]
      }
      const width = Math.max(...Object.values(COMMANDS).map((command) => command.usage.length))
      return [
        ...Object.values(COMMANDS).map((command) => `${command.usage.padEnd(width)}  ${command.summary}${command.changes ? ' *' : ''}`),
        '* changes the game, and runs only on the world map. Tab completes, Up/Down recall, ~ or Esc closes.',
      ]
    },
  },
  clear: {
    usage: 'clear',
    summary: 'Clear the console.',
    run: () => [],
  },
  scenes: {
    usage: 'scenes',
    summary: 'The scenes running, and the paused ones.',
    run: (_args, context) => [context.scenes.join(', ') || 'none'],
  },
  seed: {
    usage: 'seed',
    summary: "The session's battle seed and where the world's RNG stands.",
    run: (_args, context) => [
      `Battle seed: ${context.seed ?? 'none (each battle draws its own; give one as ?seed=N)'}`,
      ...(context.source ? [`World RNG state: ${context.source.game.world.rng}`] : []),
    ],
  },
  party: {
    usage: 'party',
    summary: 'The party: level, experience, hit points, mana and what each has to spend.',
    run(_args, context) {
      const game = gameOf(context)
      const row = (character: Character, i: number | null): string => {
        const mana = maxMana(character) > 0 ? ` mana ${manaOf(character)}/${maxMana(character)}` : ''
        const spend = [
          character.skillPoints > 0 ? `${character.skillPoints} skill pts` : '',
          character.perkPicks > 0 ? `${character.perkPicks} perks` : '',
          character.spellPicks > 0 ? `${character.spellPicks} spells` : '',
        ].filter(Boolean)
        return `${i === null ? ' -' : `${i + 1}.`} ${character.name.padEnd(12)} L${character.level} xp ${character.xp}/${xpToNextLevel(character.level)} hp ${character.hp}/${maxHp(character)}${mana}${spend.length ? `  (${spend.join(', ')})` : ''}`
      }
      return [
        ...game.party.map((character, i) => row(character, i)),
        ...(game.reserves.length ? ['Reserves:', ...game.reserves.map((character) => row(character, null))] : []),
      ]
    },
  },
  heal: {
    usage: 'heal [member|all]',
    summary: 'Restore hit points and mana in full.',
    changes: true,
    run([who], context) {
      const healed = members(gameOf(context), who)
      for (const character of healed) {
        character.hp = maxHp(character)
        character.mana = maxMana(character)
      }
      return [`Healed ${healed.map((character) => character.name).join(', ')}.`]
    },
  },
  xp: {
    usage: 'xp <amount> [member|all]',
    summary: 'Give experience, which may raise levels.',
    changes: true,
    run([amount, who], context) {
      const xp = integer(amount, 'the experience')
      if (xp <= 0) throw new DebugError('Experience must be more than 0.')
      return members(gameOf(context), who).map((character) => {
        const gain = gainXp(character, xp)
        return `${character.name} gains ${gain.xp} xp${gain.levelsGained ? `, now level ${character.level}` : ''}.`
      })
    },
  },
  stock: {
    usage: 'stock [material amount]',
    summary: "Show the encampment's stock, or add to it (a negative amount takes away).",
    changes: 'withArgs',
    run([material, amount], context) {
      const { world } = gameOf(context)
      if (material !== undefined) {
        if (!MATERIALS.includes(material as Material)) throw new DebugError(`No material "${material}"; there are ${MATERIALS.join(', ')}.`)
        const key = material as Material
        world.stock[key] = Math.max(0, (world.stock[key] ?? 0) + integer(amount, 'the amount'))
      }
      const held = Object.entries(world.stock).map(([name, n]) => `${name} ${n}`)
      return [`Stock: ${held.join(', ') || 'nothing'}`]
    },
  },
  items: {
    usage: 'items',
    summary: 'The ids of the items `give` knows.',
    run: () => [...WEAPONS, ...MAGIC_ITEMS].map((item) => `${item.id.padEnd(18)} ${item.name}`),
  },
  give: {
    usage: 'give <item> [count]',
    summary: "Put an item, by its id, in the party's baggage.",
    changes: true,
    run([id, count], context) {
      const item = id === undefined ? undefined : itemById(id)
      if (!item) throw new DebugError(`No item "${id ?? ''}"; \`items\` lists them.`)
      const n = count === undefined ? 1 : integer(count, 'the count')
      if (n < 1) throw new DebugError('The count must be at least 1.')
      gameOf(context).baggage.push(...Array.from({ length: n }, () => item))
      return [`${n} × ${item.name} put in the baggage.`]
    },
  },
  locations: {
    usage: 'locations [all]',
    summary: 'The locations known (or all of them): id, kind, threat and col,row.',
    run([all], context) {
      const { world } = gameOf(context)
      const known = (location: WorldLocation) =>
        location.kind !== 'monsters' || world.sighted.includes(location.id)
      const listed = world.locations.filter((location) => all === 'all' || known(location))
      return [
        ...listed.map((location) => {
          const what = location.kind === 'monsters' ? `monsters, threat ${location.threat}` : location.kind
          const tags = [world.held.includes(location.id) ? 'held' : '', known(location) ? '' : 'unknown'].filter(Boolean)
          return `${location.id.padEnd(16)} ${location.name} (${what}) at ${offset(location)}${tags.length ? ` [${tags.join(', ')}]` : ''}`
        }),
        `Party at ${offset({ position: world.party })}.`,
      ]
    },
  },
  reveal: {
    usage: 'reveal',
    summary: 'Explore the whole map and sight every monster location.',
    changes: true,
    run(_args, context) {
      const { world } = gameOf(context)
      world.seen = [...world.blight]
      world.sighted = world.locations.filter((location) => location.kind === 'monsters').map((location) => location.id)
      return ['The whole map is revealed.']
    },
  },
  goto: {
    usage: 'goto <col> <row> | goto <location>',
    summary: 'Put the party on a hex, or on a location by id, with no time passing.',
    changes: true,
    run(args, context) {
      const { world } = gameOf(context)
      let to
      if (args.length >= 2) {
        to = offsetToHex(integer(args[0], 'the column'), integer(args[1], 'the row'))
        if (!new HexBoard(world.board).contains(to)) throw new DebugError(`${args[0]},${args[1]} is off the map (${world.board.cols}×${world.board.rows}).`)
      } else {
        const location = world.locations.find((l) => l.id === args[0])
        if (!location) throw new DebugError(`No location "${args[0] ?? ''}"; \`locations all\` lists them.`)
        to = location.position
      }
      world.party = to
      const here = monstersHere(world)
      world.confronting = here?.id ?? null
      updateSight(world)
      return [`The party stands at ${offset({ position: to })}${here ? `, before the ${here.name}` : ''}.`]
    },
  },
  days: {
    usage: 'days <count>',
    summary: 'Pass days where the party stands, as waiting does, telling what they brought.',
    changes: true,
    run([count], context) {
      const game = gameOf(context)
      const n = integer(count, 'the days')
      if (n < 1) throw new DebugError('Pass at least 1 day.')
      const told: string[] = []
      let passed = 0
      while (passed < n && worldActive(game.world)) {
        const events = passTurn(game.world, game.party)
        passed += 1
        for (const event of events) {
          if (isNotable(game.world, event) || event.type === 'spawned') {
            told.push(`  day ${game.world.turn}: ${describeWorldEvent(event) || `${event.type} ${'name' in event ? event.name : ''}`}`)
          }
        }
      }
      return [`${passed} ${passed === 1 ? 'day passes' : 'days pass'}; it is turn ${game.world.turn}.`, ...told]
    },
  },
  units: {
    usage: 'units',
    summary: "In battle: every unit's side, hit points, AP, mana, statuses and hex.",
    run(_args, context) {
      const battle = context.source?.battle
      if (!battle) throw new DebugError('No battle is being fought.')
      const { state, names } = battle
      return [
        `Round ${state.round}, ${state.phase === 'over' ? `over, won by ${state.winner}` : `${state.phase}'s turn`}.`,
        ...state.units.map((unit) => {
          const { col, row } = hexToOffset(unit.position)
          const statuses = unit.statuses.map((status) => `${status.id} ${status.turnsLeft}`).join(', ')
          return `${unit.side.padEnd(6)} ${(names[unit.id] ?? unit.id).padEnd(14)} hp ${unit.hp}/${unit.maxHp} ap ${unit.ap} mana ${unit.mana} at ${col},${row}${statuses ? ` [${statuses}]` : ''}`
        }),
      ]
    },
  },
}

export const COMMAND_NAMES: readonly string[] = Object.keys(COMMANDS)

/** Runs a line typed at the console. An empty line does nothing; a mistake is told, not thrown. */
export function runCommand(line: string, context: DebugContext): DebugResult {
  const [name, ...args] = line.trim().split(/\s+/).filter(Boolean)
  if (name === undefined) return { lines: [], changed: false }
  const command = COMMANDS[name.toLowerCase()]
  if (!command) return { lines: [`Unknown command "${name}". Type help for the list.`], changed: false }
  const changes = command.changes === true || (command.changes === 'withArgs' && args.length > 0)
  if (changes && !context.source?.changed) {
    return { lines: [`${name} changes the game, which works only on the world map.`], changed: false }
  }
  try {
    return { lines: command.run(args, context), changed: changes }
  } catch (error) {
    if (error instanceof DebugError) return { lines: [error.message], changed: false }
    throw error
  }
}

/** The command names a typed start could complete to. */
export function completions(start: string): string[] {
  const prefix = start.trim().toLowerCase()
  return COMMAND_NAMES.filter((name) => name.startsWith(prefix))
}
