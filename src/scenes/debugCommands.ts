import { maxHp, maxMana, manaOf, type Character } from '../character/character.ts'
import { gainXp, xpToNextLevel } from '../character/progression.ts'
import type { BattleState } from '../engine/battleEngine.ts'
import { advanceRefusal, passDay, setOrder } from '../game/company.ts'
import { facilities, setFacilityLevel, type FacilityId } from '../game/encampment.ts'
import { presences, type Expedition, type Order } from '../game/expedition.ts'
import { ENCOUNTERS, type EncounterId } from '../game/encounters.ts'
import { selectedParty, type GameState } from '../game/gameState.ts'
import type { Material } from '../game/territory.ts'
import { updateSight } from '../game/vision.ts'
import { isNotable, monstersHere, theName, threatAt, worldActive, type WorldLocation } from '../game/worldMap.ts'
import { HexBoard, hexToOffset, offsetToHex } from '../grid/hex.ts'
import { BASE_ITEMS, MAGIC_ITEMS, itemById } from '../inventory/inventory.ts'
import { MODIFIER_IDS } from '../inventory/modifiers.ts'
import { RANKS, RUNE_IDS, addToPouch, isRuneKey, pouchKeys, runeKey, runeName } from '../inventory/runes.ts'
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
  /** Starts a battle of `encounter` at `threat` against the party, as if a location were attacked; absent where battles can't start. */
  fight?: (encounter: EncounterId, threat: number, party: string) => void
  /** The id of the party the scene shows or has selected, which a command acts on when it is given no `@<party>`. */
  party?: string
}

export interface DebugContext {
  /** The scenes running, a paused one marked so. */
  scenes: string[]
  /** The session's seed, from the page's address, or null when each battle draws its own. */
  seed: number | null
  source: DebugSource | null
  /** The party a command's `@<party>` named, as typed; `runCommand` sets it. */
  party?: string
}

export interface DebugResult {
  lines: string[]
  /** Whether the command changed the game, so the scene must redraw and save. */
  changed: boolean
}

interface Command {
  usage: string
  summary: string
  /** Acts on a party, so may end in `@<party>` (an id, or the start of a name). */
  acts?: true
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

const partyLabel = (party: Expedition): string => `${party.id} (${party.name})`

/** The party `@<name>` means: an exact id, else the first whose name starts with it, ignoring case. */
function namedParty(game: GameState, name: string): Expedition {
  const found = name === '' ? undefined : game.parties.find((party) => party.id === name) ?? game.parties.find((party) => party.name.toLowerCase().startsWith(name.toLowerCase()))
  if (!found) throw new DebugError(`No party "@${name}"; there are ${game.parties.map(partyLabel).join(', ')}.`)
  return found
}

/** The party a command acts on: the one `@<party>` named, else the scene's own, else the first. */
function partyOf(context: DebugContext): Expedition {
  const game = gameOf(context)
  return context.party !== undefined ? namedParty(game, context.party) : selectedParty(game, context.source?.party)
}

/** The members of `party` a command names: by number (from 1) or by the start of a name, or all of them with none named. */
function members(party: Expedition, who: string | undefined): Character[] {
  if (who === undefined || who === 'all') return party.members
  const index = Number(who)
  if (Number.isInteger(index)) {
    const member = party.members[index - 1]
    if (!member) throw new DebugError(`No party member ${who}; there are ${party.members.length}.`)
    return [member]
  }
  const named = party.members.filter((member) => member.name.toLowerCase().startsWith(who.toLowerCase()))
  if (named.length !== 1) throw new DebugError(named.length === 0 ? `No party member named "${who}".` : `"${who}" names ${named.length} members.`)
  return named
}

const offset = (location: { position: WorldLocation['position'] }): string => {
  const { col, row } = hexToOffset(location.position)
  return `${col},${row}`
}

/** A party's order in a few words, for `party`: its kind, and where a travel goes or whom a meet seeks. */
function orderDetail(order: Order): string {
  switch (order.kind) {
    case 'travel':
      return `travel to ${offset({ position: order.to })}`
    case 'meet':
      return `meet ${order.party}`
    case 'day':
      return `day ${order.action.kind}`
    default:
      return order.kind
  }
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
    usage: 'party [@party]',
    summary: 'The company: each party (id, name, hex, order, confrontation) with its members: level, experience, hit points, mana and what each has to spend.',
    acts: true,
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
      const listed = context.party !== undefined ? [namedParty(game, context.party)] : game.parties
      return [
        ...listed.flatMap((party) => [
          `${partyLabel(party)} at ${offset(party)}, order ${orderDetail(party.order)}${party.confronting ? `, before ${party.confronting}` : ''}`,
          ...party.members.map((character, i) => row(character, i)),
        ]),
        ...(game.reserves.length ? ['Reserves:', ...game.reserves.map((character) => row(character, null))] : []),
      ]
    },
  },
  heal: {
    usage: 'heal [member|all] [@party]',
    acts: true,
    summary: 'Restore hit points and mana in full.',
    changes: true,
    run([who], context) {
      const healed = members(partyOf(context), who)
      for (const character of healed) {
        character.hp = maxHp(character)
        character.mana = maxMana(character)
      }
      return [`Healed ${healed.map((character) => character.name).join(', ')}.`]
    },
  },
  xp: {
    usage: 'xp <amount> [member|all] [@party]',
    acts: true,
    summary: 'Give experience, which may raise levels.',
    changes: true,
    run([amount, who], context) {
      const xp = integer(amount, 'the experience')
      if (xp <= 0) throw new DebugError('Experience must be more than 0.')
      return members(partyOf(context), who).map((character) => {
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
    summary: 'The ids of the items `give` knows; a plain one takes a grade and a modifier, as iron_sword@2+light1.',
    run: () => [
      ...[...BASE_ITEMS, ...MAGIC_ITEMS].map((item) => `${item.id.padEnd(18)} ${item.name}`),
      `Grades: <id>@2 (Fine), <id>@3 (Masterwork). Modifiers: <id>+<modifier><1-3>, of ${MODIFIER_IDS.join(', ')}.`,
      'Runes: <id>#<rune>[.<rune>…], as iron_sword@3#ember1; a unique item takes runes only, as emberblade#dawn1.',
      ...RUNE_IDS.map((id) => `${id.padEnd(6)} ${RANKS.map((rank) => runeKey(id, rank)).join(' ')}  (${runeName(runeKey(id, 2))})`),
    ],
  },
  facility: {
    usage: 'facility [id level]',
    summary: "Show the encampment's facilities' levels, or set one's.",
    changes: 'withArgs',
    run([id, level], context) {
      const game = gameOf(context)
      if (id !== undefined) {
        const facility = facilities(game, partyOf(context)).find((f) => f.id === id)
        if (!facility) throw new DebugError(`No facility "${id}"; there are ${facilities(game, partyOf(context)).map((f) => f.id).join(', ')}.`)
        const n = integer(level, 'the level')
        const lowest = id === 'guild_hall' || id === 'trading_post' ? 1 : 0
        if (n < lowest || n > facility.maxLevel) throw new DebugError(`${facility.name}'s level goes from ${lowest} to ${facility.maxLevel}.`)
        setFacilityLevel(game, id as FacilityId, n)
      }
      return facilities(game, partyOf(context)).map((f) => `${f.id.padEnd(14)} level ${f.level} of ${f.maxLevel}`)
    },
  },
  give: {
    usage: 'give <item|rune> [count] [@party]',
    acts: true,
    summary: "Put an item, by its id, in a party's baggage, or a rune, by its key (storm1), in the pouch.",
    changes: true,
    run([id, count], context) {
      if (id !== undefined && isRuneKey(id)) {
        const n = count === undefined ? 1 : integer(count, 'the count')
        if (n < 1) throw new DebugError('The count must be at least 1.')
        addToPouch(gameOf(context).runes, id, n)
        return [`${n} × ${runeName(id)} put in the pouch.`]
      }
      const item = id === undefined ? undefined : itemById(id)
      if (!item) throw new DebugError(`No item "${id ?? ''}"; \`items\` lists them.`)
      const n = count === undefined ? 1 : integer(count, 'the count')
      if (n < 1) throw new DebugError('The count must be at least 1.')
      partyOf(context).baggage.push(...Array.from({ length: n }, () => item))
      return [`${n} × ${item.name} put in the baggage.`]
    },
  },
  runes: {
    usage: 'runes',
    summary: "The party's rune pouch.",
    run: (_args, context) => {
      const { runes } = gameOf(context)
      const keys = pouchKeys(runes)
      return keys.length === 0 ? ['The pouch is empty.'] : keys.map((key) => `${key.padEnd(8)} ${runes[key]} × ${runeName(key)}`)
    },
  },
  locations: {
    usage: 'locations [all]',
    summary: 'The locations known (or all of them): id, kind, threat and col,row.',
    run([all], context) {
      const game = gameOf(context)
      const { world } = game
      const known = (location: WorldLocation) =>
        location.kind !== 'monsters' || world.sighted.includes(location.id)
      const listed = world.locations.filter((location) => all === 'all' || known(location))
      return [
        ...listed.map((location) => {
          const what = location.kind === 'monsters' ? `monsters, threat ${location.threat}` : location.kind
          const tags = [world.held.includes(location.id) ? 'held' : '', known(location) ? '' : 'unknown'].filter(Boolean)
          return `${location.id.padEnd(16)} ${location.name} (${what}) at ${offset(location)}${tags.length ? ` [${tags.join(', ')}]` : ''}`
        }),
        ...game.parties.map((party) => `${partyLabel(party)} at ${offset(party)}.`),
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
    usage: 'goto <col> <row> | goto <location> [@party]',
    acts: true,
    summary: 'Put the party on a hex, or on a location by id, with no time passing; its order ends.',
    changes: true,
    run(args, context) {
      const game = gameOf(context)
      const { world } = game
      let to
      if (args.length >= 2) {
        to = offsetToHex(integer(args[0], 'the column'), integer(args[1], 'the row'))
        if (!new HexBoard(world.board).contains(to)) throw new DebugError(`${args[0]},${args[1]} is off the map (${world.board.cols}×${world.board.rows}).`)
      } else {
        const location = world.locations.find((l) => l.id === args[0])
        if (!location) throw new DebugError(`No location "${args[0] ?? ''}"; \`locations all\` lists them.`)
        to = location.position
      }
      const party = partyOf(context)
      party.position = to
      // An order given where it stood is no order here.
      setOrder(game, party.id, { kind: 'idle' })
      const here = monstersHere(world, party)
      party.confronting = here?.id ?? null
      updateSight(world, presences(game.parties))
      return [`The party stands at ${offset({ position: to })}${here ? `, before ${theName(here.name)}` : ''}.`]
    },
  },
  days: {
    usage: 'days <count>',
    summary: 'Pass days through the day loop, each party carrying out its order, telling what they brought.',
    changes: true,
    run([count], context) {
      const game = gameOf(context)
      const n = integer(count, 'the days')
      if (n < 1) throw new DebugError('Pass at least 1 day.')
      const told: string[] = []
      let passed = 0
      while (passed < n && worldActive(game.world)) {
        const report = passDay(game)
        if (!report) {
          told.push(`  ${advanceRefusal(game)}`)
          break
        }
        passed += 1
        const present = presences(game.parties)
        for (const event of report.events) {
          if (isNotable(game.world, event, present) || event.type === 'spawned') {
            told.push(`  day ${game.world.turn}: ${describeWorldEvent(event) || `${event.type} ${'name' in event ? event.name : ''}`}`)
          }
        }
      }
      return [`${passed} ${passed === 1 ? 'day passes' : 'days pass'}; it is turn ${game.world.turn}.`, ...told]
    },
  },
  fight: {
    usage: 'fight <encounter> [threat] [@party]',
    acts: true,
    summary: "Fight an encounter at a threat (default: the party's hex's), clearing no location and taking no loot.",
    changes: true,
    run([id, threat], context) {
      const party = partyOf(context)
      if (id === undefined || !Object.hasOwn(ENCOUNTERS, id)) {
        throw new DebugError(`No encounter "${id ?? ''}"; there are ${Object.keys(ENCOUNTERS).join(', ')}.`)
      }
      const at = threat === undefined ? threatAt(party.position) : integer(threat, 'the threat')
      if (at < 1) throw new DebugError('The threat must be at least 1.')
      const fight = context.source?.fight
      if (!fight) throw new DebugError('Battles start only from the world map.')
      // The world map is redrawn and saved after this, as after any change, before the
      // scene manager starts the battle on its next step: the game is unchanged until then.
      fight(id as EncounterId, at, party.id)
      return [`Fighting ${id} at threat ${at}.`]
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
  const [name, ...typed] = line.trim().split(/\s+/).filter(Boolean)
  if (name === undefined) return { lines: [], changed: false }
  const command = COMMANDS[name.toLowerCase()]
  if (!command) return { lines: [`Unknown command "${name}". Type help for the list.`], changed: false }
  // A last argument starting with @ names the party a command acts on; it is not one of the command's own.
  const last = typed.at(-1)
  const named = command.acts && last?.startsWith('@') ? last.slice(1) : undefined
  const args = named === undefined ? typed : typed.slice(0, -1)
  if (named !== undefined) context = { ...context, party: named }
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
