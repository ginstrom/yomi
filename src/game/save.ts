import type { Character } from '../character/character.ts'
import { PERK_IDS } from '../character/perks.ts'
import { SKILL_IDS } from '../character/skills.ts'
import type { BattleSnapshot } from '../engine/battleEngine.ts'
import { itemById, type Equipment, type Item } from '../inventory/inventory.ts'
import type { GameState } from './gameState.ts'
import type { GroundPile } from './ground.ts'
import type { WorldLocation } from './worldMap.ts'

/**
 * The save format: a game, and the battle it is in if any, as a string and
 * back. Storage-free; saveSlots.ts keeps the strings.
 *
 * Raise `SAVE_VERSION` whenever the shape of `GameState`, `Character`,
 * `WorldState` or `BattleSnapshot` changes: there is no migration, so a save
 * of another version reads as unreadable. Rules and item numbers may change
 * freely, as a character stores no derived number and an item is saved by
 * its id.
 */
export const SAVE_VERSION = 5

/** One slot's contents. */
export interface SaveFile {
  game: GameState
  /** The battle being fought, if any. */
  battle: SavedBattle | null
  /** When it was written, in milliseconds since the epoch: what Continue goes by. */
  savedAt: number
}

/**
 * A battle as it stood when the player's turn began. The `game` saved with it
 * is the game as it stands mid-battle: gear changed since the attack is in
 * its characters, whose hit points are still those they entered with, the
 * engine's units having the present ones.
 */
export interface SavedBattle {
  /** The monster location's id in `game.world`. */
  location: string
  engine: BattleSnapshot
  /** Where the enemy policy's RNG stands. */
  enemyRng: number
  ground: GroundPile[]
}

/** Thrown inside `parseSave` for anything that makes a save unreadable. */
class Unreadable extends Error {}

function check(condition: unknown): asserts condition {
  if (!condition) throw new Unreadable()
}

const itemId = (item: Item | null): string | null => item?.id ?? null

function itemOf(id: unknown): Item {
  const item = typeof id === 'string' ? itemById(id) : undefined
  check(item)
  return item
}

const itemsOf = (ids: unknown): Item[] => {
  check(Array.isArray(ids))
  return ids.map(itemOf)
}

/** A copy of `value` with every key of `changes` replaced. */
const withKeys = <T extends object>(value: T, changes: Record<string, unknown>): T => ({ ...value, ...changes })

/** The file as JSON, with every item written as its id. */
export function serializeSave(file: SaveFile): string {
  const { game, battle } = file
  return JSON.stringify({
    version: SAVE_VERSION,
    savedAt: file.savedAt,
    game: withKeys(game, {
      party: game.party.map((member) =>
        withKeys(member, {
          equipment: Object.fromEntries(Object.entries(member.equipment).map(([slot, item]) => [slot, item.id])),
          backpack: member.backpack.map(itemId),
        }),
      ),
      baggage: game.baggage.map(itemId),
      world: withKeys(game.world, {
        locations: game.world.locations.map((location) =>
          location.kind === 'monsters' ? withKeys(location, { loot: location.loot.map(itemId) }) : location,
        ),
      }),
    }),
    battle: battle && withKeys(battle, { ground: battle.ground.map(({ hex, items }) => ({ hex, items: items.map(itemId) })) }),
  })
}

function characterOf(saved: Character): Character {
  check(saved && typeof saved === 'object' && typeof saved.name === 'string')
  check(Object.keys(saved.perks).every((id) => (PERK_IDS as string[]).includes(id)))
  check(Array.isArray(saved.tagged) && saved.tagged.every((id) => SKILL_IDS.includes(id)))
  check(SKILL_IDS.every((id) => typeof saved.trained[id] === 'number'))
  check(Array.isArray(saved.backpack))
  return {
    ...saved,
    equipment: Object.fromEntries(Object.entries(saved.equipment).map(([slot, id]) => [slot, itemOf(id)])) as Equipment,
    backpack: saved.backpack.map((id) => (id === null ? null : itemOf(id))),
  }
}

function locationOf(saved: WorldLocation): WorldLocation {
  check(saved && typeof saved === 'object' && typeof saved.id === 'string')
  return saved.kind === 'monsters' ? { ...saved, loot: itemsOf(saved.loot) } : saved
}

/** Null for anything that is not a save of this version, or names an item, perk or skill the game does not have. */
export function parseSave(raw: string | null): SaveFile | null {
  if (raw === null) return null
  try {
    // What `serializeSave` wrote has the file's shape but for its items, which are ids until put back below.
    const saved = JSON.parse(raw) as SaveFile & { version: unknown }
    check(saved && typeof saved === 'object' && saved.version === SAVE_VERSION)
    check(typeof saved.savedAt === 'number')
    const { game, battle } = saved
    check(game && typeof game === 'object' && Array.isArray(game.party) && game.party.length > 0)
    check(game.world && typeof game.world === 'object' && Array.isArray(game.world.locations))
    const { world } = game
    check(world.board && Array.isArray(world.blight) && Array.isArray(world.shift) && world.blight.length === world.board.cols * world.board.rows)
    check(Array.isArray(world.seen) && world.seen.length === world.blight.length && Array.isArray(world.sighted))
    check(Array.isArray(world.held) && Array.isArray(world.threatened) && world.stock && typeof world.stock === 'object')
    check(typeof world.rng === 'number' && typeof world.spawnPressure === 'number' && typeof world.status === 'string')
    check(typeof game.partyLimit === 'number' && (game.slot === null || typeof game.slot === 'number'))
    check(battle === null || (typeof battle === 'object' && typeof battle.location === 'string'))
    check(battle === null || (typeof battle.enemyRng === 'number' && Array.isArray(battle.ground)))
    check(battle === null || (battle.engine && Array.isArray(battle.engine.units) && Array.isArray(battle.engine.events)))
    return {
      game: {
        ...game,
        party: game.party.map(characterOf),
        baggage: itemsOf(game.baggage),
        world: { ...game.world, locations: game.world.locations.map(locationOf) },
      },
      battle: battle && { ...battle, ground: battle.ground.map(({ hex, items }) => ({ hex, items: itemsOf(items) })) },
      savedAt: saved.savedAt,
    }
  } catch {
    // Not JSON, not a save, or a save from a game with other items: unreadable all the same.
    return null
  }
}

/** What the Load list shows of a slot. */
export interface SaveSummary {
  names: string[]
  /** The party's highest. */
  level: number
  turn: number
  /** The name of the monsters being fought, or null on the world map. */
  battle: string | null
  savedAt: number
}

export function saveSummary({ game, battle, savedAt }: SaveFile): SaveSummary {
  const fought = battle && game.world.locations.find((location) => location.id === battle.location)
  return {
    names: game.party.map((member) => member.name),
    level: Math.max(...game.party.map((member) => member.level)),
    turn: game.world.turn,
    battle: battle ? (fought?.name ?? 'a battle') : null,
    savedAt,
  }
}

/** A slot's line in the Load list: "Aldric, Brenna    Level 2    Turn 14    12 Oct 21:40", or the battle for the date. */
export function describeSave(summary: SaveSummary): string {
  const when = new Date(summary.savedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const month = when.toLocaleString('en', { month: 'short' })
  const stamp = `${when.getDate()} ${month} ${pad(when.getHours())}:${pad(when.getMinutes())}`
  return [
    summary.names.join(', '),
    `Level ${summary.level}`,
    `Turn ${summary.turn}`,
    summary.battle ? `In battle: ${summary.battle}` : stamp,
  ].join('    ')
}
