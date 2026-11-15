import { maxMana, type Character } from '../character/character.ts'
import { PERK_IDS, nodesCost, type PerkId } from '../character/perks.ts'
import { pointsAt } from '../character/progression.ts'
import { SKILL_IDS } from '../character/skills.ts'
import type { BattleSnapshot } from '../engine/battleEngine.ts'
import { GRADES } from '../inventory/grades.ts'
import { EQUIPMENT_SLOT_LABELS, itemById, type Equipment, type Item } from '../inventory/inventory.ts'
import { MODIFIER_IDS } from '../inventory/modifiers.ts'
import { isRuneKey } from '../inventory/runes.ts'
import { FIRST_PARTY_ID, FIRST_PARTY_NAME, MAX_PARTIES, ORDER_KINDS, type Expedition } from './expedition.ts'
import { MAX_GUILD_HALL_LEVEL } from './guildHall.ts'
import type { GameState } from './gameState.ts'
import type { GroundPile } from './ground.ts'
import type { WorldLocation } from './worldMap.ts'
import { CUTSCENE_IDS } from '../story/cutscenes.ts'

/**
 * The save format: a game, and the battle it is in if any, as a string and
 * back. Storage-free; saveSlots.ts keeps the strings.
 *
 * Raise `SAVE_VERSION` whenever the shape of `GameState`, `Character`,
 * `WorldState` or `BattleSnapshot` changes. A migration is written only when
 * a design asks for one; otherwise a save of another version reads as
 * unreadable. Stage 5's asked for `migrateFrom18`, reading a version-18 save
 * as a company of one in version 22's shape (versions 19 and 21 were never
 * released, and they and stage 5's 20 read as unreadable). Version 22
 * (stage 6) adds the home, garrison and meet orders. Version 23 (the skill
 * trees) drops a character's `spellPicks` and holds every node at one rank
 * under the trees' ids; the skill trees' design asked for `migrateFrom22`,
 * which puts a version-22 game's heroes on the trees, and a version-18 save
 * goes through `migrateFrom18` and then it. Version 24 (skill trees step 11)
 * keeps whether each unit of a saved battle has moved this turn; a version-23
 * save loads as it is, `BattleEngine.restore` taking `moved` up as false.
 * Version 25 (skill trees step 17) keeps each unit's stage-3 fields
 * (`attackedYet`, `endured`, `refunded`, `fallenThisBattle`, `usedOnce`); a
 * version-24 save loads as it is, `restore` taking them up at their defaults.
 * Version 26 (skill trees step 28) gives a character `perkPoints` in place of
 * `perkPicks`; the node-cost design asked for `migrateFrom25`, which every
 * older save readable (25, 24, 23, and 22 and 18 after `migrateFrom22`) goes
 * through: every node kept and the points recomputed from the level.
 * Rules and item numbers may change
 * freely, as a character stores no derived number and an item is saved by
 * its id.
 */
export const SAVE_VERSION = 26

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
  /** The id of the expedition fighting, one of `game.parties`. */
  party: string
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
      parties: game.parties.map((party) => withKeys(party, { members: party.members.map(characterIds), baggage: party.baggage.map(itemId) })),
      reserves: game.reserves.map(characterIds),
      world: withKeys(game.world, {
        locations: game.world.locations.map((location) =>
          location.kind === 'monsters' ? withKeys(location, { loot: location.loot.map(itemId) }) : location,
        ),
      }),
    }),
    battle: battle && withKeys(battle, { ground: battle.ground.map(({ hex, items }) => ({ hex, items: items.map(itemId) })) }),
  })
}

/** A character with every item written as its id. */
const characterIds = (member: Character) =>
  withKeys(member, {
    equipment: Object.fromEntries(Object.entries(member.equipment).map(([slot, item]) => [slot, item.id])),
    backpack: member.backpack.map(itemId),
  })

function characterOf(saved: Character): Character {
  check(saved && typeof saved === 'object' && typeof saved.name === 'string')
  check(Object.entries(saved.perks).every(([id, ranks]) => (PERK_IDS as string[]).includes(id) && ranks === 1))
  check(Array.isArray(saved.tagged) && saved.tagged.every((id) => SKILL_IDS.includes(id)))
  check(SKILL_IDS.every((id) => typeof saved.trained[id] === 'number'))
  check(Array.isArray(saved.backpack))
  check(Number.isInteger(saved.perkPoints) && saved.perkPoints >= 0)
  check(!('perkPicks' in saved))
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

/**
 * A version-18 game (one `party` and one `baggage`, the world holding where it
 * stands and what it confronts) as a version-22 one: a company of one, the
 * party's position and confrontation its expedition's. `migrateFrom22` then
 * takes it on to this version.
 */
function migrateFrom18(game: Record<string, unknown>): void {
  check(Array.isArray(game.party) && Array.isArray(game.baggage))
  const world = game.world as Record<string, unknown> | undefined
  check(world && typeof world === 'object')
  game.parties = [
    {
      id: FIRST_PARTY_ID,
      name: FIRST_PARTY_NAME,
      members: game.party,
      baggage: game.baggage,
      position: world.party,
      order: { kind: 'idle' },
      confronting: world.confronting,
    },
  ]
  delete game.party
  delete game.baggage
  delete world.party
  delete world.confronting
}

/** Perks of version 22 that went into no node: dropped. */
const RETIRED_PERKS = ['spellcasting', 'quick_study']

/** Perks of version 22 folded into a node of the trees (design §5.9). */
const FOLDED: Record<string, PerkId> = {
  mighty_blow: 'weapon_mastery', sunder: 'weapon_mastery', gain_endurance: 'toughness', gain_perception: 'far_shot',
  eagle_eye: 'deadeye', gain_agility: 'skirmisher', tireless: 'evasion', gain_luck: 'fortune',
  deep_well: 'destruction', arcane_mastery: 'lingering_cold', gain_intelligence: 'lasting_magic',
}

/**
 * A version-22 game's heroes, in every party and the reserves, on the skill
 * trees: retired and unknown perks dropped, folded ones mapped onto their
 * node, every node held at one rank (kept even where its asks would now
 * refuse it) and `spellPicks` gone; `migrateFrom25` then sets the perk
 * points. Mana is clamped to the
 * new maximum once the characters are built (`clampMana`). A saved battle is
 * left as it was, its units fighting on with the stats they began with.
 */
function migrateFrom22(game: Record<string, unknown>): void {
  for (const hero of heroesOf(game)) {
    const { level, perks } = hero
    check(typeof level === 'number' && Number.isInteger(level) && level >= 1)
    check(perks && typeof perks === 'object' && !Array.isArray(perks))
    const nodes: Partial<Record<PerkId, number>> = {}
    for (const [id, ranks] of Object.entries(perks)) {
      check(typeof ranks === 'number')
      if (ranks < 1 || RETIRED_PERKS.includes(id)) continue
      const node = FOLDED[id] ?? id
      if ((PERK_IDS as string[]).includes(node)) nodes[node as PerkId] = 1
    }
    hero.perks = nodes
    delete hero.spellPicks
  }
}

/** Every hero of a game's parties and reserves, checked to be an object. */
function heroesOf(game: Record<string, unknown>): Record<string, unknown>[] {
  check(Array.isArray(game.parties) && Array.isArray(game.reserves))
  const parties = game.parties as Record<string, unknown>[]
  check(parties.every((party) => party && typeof party === 'object' && Array.isArray(party.members)))
  const members = [...parties.flatMap((party) => party.members as unknown[]), ...(game.reserves as unknown[])]
  check(members.every((member) => member && typeof member === 'object'))
  return members as Record<string, unknown>[]
}

/**
 * A game of version 25 or older (22 and 18 after `migrateFrom22`) with perk
 * points: every hero of every party and the reserves keeps every node it
 * holds, with no refund, and has `pointsAt(level)` less what its nodes cost,
 * never below 0, so a hero whose nodes cost more than its level gives has
 * none until its level catches up; `perkPicks` is gone.
 */
function migrateFrom25(game: Record<string, unknown>): void {
  for (const hero of heroesOf(game)) {
    const { level, perks } = hero
    check(typeof level === 'number' && Number.isInteger(level) && level >= 1)
    check(perks && typeof perks === 'object' && !Array.isArray(perks))
    hero.perkPoints = Math.max(0, pointsAt(level) - nodesCost({ perks: perks as Character['perks'] }))
    delete hero.perkPicks
  }
}

/** A migrated character's mana within its maximum under the new rules. */
const clampMana = (character: Character): Character => ({ ...character, mana: Math.min(character.mana, maxMana(character)) })

const isHex = (hex: unknown): boolean =>
  typeof hex === 'object' && hex !== null && typeof (hex as { q: unknown }).q === 'number' && typeof (hex as { r: unknown }).r === 'number'

const isIndex = (n: unknown): boolean => Number.isInteger(n) && (n as number) >= 0

/** Whether `place` is an `ItemPlace` as a day action names one (stale or not is the action's to judge). */
function isPlace(place: unknown): boolean {
  if (typeof place !== 'object' || place === null) return false
  const p = place as Record<string, unknown>
  if (typeof p.party !== 'string' || typeof p.itemId !== 'string') return false
  switch (p.from) {
    case 'baggage':
      return isIndex(p.index)
    case 'backpack':
      return isIndex(p.member) && isIndex(p.index)
    case 'worn':
      return isIndex(p.member) && typeof p.slot === 'string' && Object.hasOwn(EQUIPMENT_SLOT_LABELS, p.slot)
    default:
      return false
  }
}

/** Whether `action` is a `DayAction`: a known kind, with a craft's or an embed's fields. */
function isDayAction(action: unknown): boolean {
  if (typeof action !== 'object' || action === null) return false
  const a = action as Record<string, unknown>
  switch (a.kind) {
    case 'scout':
    case 'wait':
    case 'camp':
    case 'tower':
    case 'outpost':
      return true
    case 'craft':
      return isPlace(a.place) && (MODIFIER_IDS as unknown[]).includes(a.modifier) && (GRADES as unknown[]).includes(a.grade)
    case 'embed':
      return isPlace(a.place) && typeof a.rune === 'string' && isRuneKey(a.rune)
    default:
      return false
  }
}

/** Whether `order` is an `Order`: a known kind, a travel or home order with its destination and the hexes still to walk, a meet order naming one of `partyIds` other than its own party `self`, a day order with its action. */
function isOrder(order: unknown, self: string, partyIds: readonly string[]): boolean {
  if (typeof order !== 'object' || order === null) return false
  const o = order as Record<string, unknown>
  if (!ORDER_KINDS.includes(o.kind as never)) return false
  if (o.kind === 'travel' || o.kind === 'home') return isHex(o.to) && Array.isArray(o.route) && o.route.every(isHex)
  if (o.kind === 'meet') return typeof o.party === 'string' && o.party !== self && partyIds.includes(o.party)
  if (o.kind === 'day') return isDayAction(o.action)
  return true
}

/** Null for anything that is not a save of this version (or version 25, 24 or 23, or version 22 or 18, migrated), or names an item, perk or skill the game does not have. */
export function parseSave(raw: string | null): SaveFile | null {
  if (raw === null) return null
  try {
    // What `serializeSave` wrote has the file's shape but for its items, which are ids until put back below.
    const saved = JSON.parse(raw) as SaveFile & { version: unknown }
    check(saved && typeof saved === 'object' && [SAVE_VERSION, 25, 24, 23, 22, 18].includes(saved.version as number))
    check(typeof saved.savedAt === 'number')
    const { game, battle } = saved
    check(game && typeof game === 'object')
    if (saved.version === 18) {
      migrateFrom18(game as unknown as Record<string, unknown>)
      // The only party a version-18 game has is the one that was fighting.
      if (battle && typeof battle === 'object') (battle as { party?: string }).party = FIRST_PARTY_ID
    }
    const migrated = saved.version === 22 || saved.version === 18
    if (migrated) migrateFrom22(game as unknown as Record<string, unknown>)
    if (saved.version !== SAVE_VERSION) migrateFrom25(game as unknown as Record<string, unknown>)
    const heroOf = (member: Character): Character => (migrated ? clampMana(characterOf(member)) : characterOf(member))
    check(Array.isArray(game.parties) && game.parties.length > 0 && game.parties.length <= MAX_PARTIES)
    check(game.parties.every((party) => party && typeof party.id === 'string' && typeof party.name === 'string'))
    check(new Set(game.parties.map((party) => party.id)).size === game.parties.length)
    check(game.parties.every((party) => Array.isArray(party.members) && party.members.length > 0 && Array.isArray(party.baggage)))
    check(game.parties.every((party) => isOrder(party.order, party.id, game.parties.map((p) => p.id))))
    check(game.parties.every((party) => isHex(party.position) && (party.confronting === null || typeof party.confronting === 'string')))
    check(game.world && typeof game.world === 'object' && Array.isArray(game.world.locations))
    const { world } = game
    check(world.board && Array.isArray(world.blight) && Array.isArray(world.shift) && world.blight.length === world.board.cols * world.board.rows)
    check(Array.isArray(world.seen) && world.seen.length === world.blight.length && Array.isArray(world.sighted))
    check(Array.isArray(world.towers) && typeof world.towersBuilt === 'number')
    check(typeof world.shrine === 'number' && Array.isArray(world.outposts))
    check(typeof world.tradingPost === 'number' && typeof world.workshop === 'number' && typeof world.infirmary === 'number')
    check(Array.isArray(world.held) && Array.isArray(world.threatened) && world.stock && typeof world.stock === 'object')
    check(typeof world.rng === 'number' && typeof world.spawnPressure === 'number' && typeof world.status === 'string')
    check(game.runes && typeof game.runes === 'object' && !Array.isArray(game.runes))
    check(Object.entries(game.runes).every(([key, n]) => isRuneKey(key) && Number.isInteger(n) && (n as number) >= 1))
    check(Array.isArray(game.reserves) && Number.isInteger(world.guildHall) && world.guildHall >= 1 && world.guildHall <= MAX_GUILD_HALL_LEVEL)
    check(game.slot === null || typeof game.slot === 'number')
    const { story } = game
    check(story && typeof story === 'object' && typeof story.tutorial === 'boolean')
    check(Array.isArray(story.played) && story.played.every((id) => CUTSCENE_IDS.includes(id)))
    check(Array.isArray(story.tipsShown) && story.tipsShown.every((id) => typeof id === 'string'))
    check(battle === null || (typeof battle === 'object' && typeof battle.location === 'string'))
    check(battle === null || (typeof battle.party === 'string' && game.parties.some((party) => party.id === battle.party)))
    check(battle === null || (typeof battle.enemyRng === 'number' && Array.isArray(battle.ground)))
    check(battle === null || (battle.engine && Array.isArray(battle.engine.units) && Array.isArray(battle.engine.events)))
    return {
      game: {
        ...game,
        parties: game.parties.map((party): Expedition => ({ ...party, members: party.members.map(heroOf), baggage: itemsOf(party.baggage) })),
        reserves: game.reserves.map(heroOf),
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
  const members = game.parties.flatMap((party) => party.members)
  return {
    names: members.map((member) => member.name),
    level: Math.max(...members.map((member) => member.level)),
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
