import { maxHp, maxMana, type Character } from '../character/character.ts'
import { draftCharacter, type CharacterDraft } from '../character/creation.ts'
import { levelUp } from '../character/progression.ts'
import { hexEquals } from '../grid/hex.ts'
import { canAfford, describeCost, spend } from './buildings.ts'
import type { GameState } from './gameState.ts'
import { MAX_PARTY_SIZE, PREROLLS, type Preroll } from './party.ts'
import type { Stock } from './territory.ts'
import { ENCAMPMENT_ID, worldActive, type WorldState } from './worldMap.ts'

/**
 * The guild hall at the encampment (docs/designs/guild-hall-and-watchtowers.md
 * §4.1–4.3): the roster of heroes beyond the party, recruiting, swapping, and
 * the hall's level, which sets the party limit. Used only while the party
 * stands at Oakvale. Each action returns why it was refused, or null when done.
 */

/** Each level's party limit and what raising the hall to it costs; level 1 is where a game starts. */
export const GUILD_HALL_LEVELS: ReadonlyArray<{ partyLimit: number; cost: Stock }> = [
  { partyLimit: 3, cost: {} },
  { partyLimit: 4, cost: { gold: 30, iron: 15 } },
  // Gold and iron, as timber and stone are too late to come by (see the watchtower's cost).
  { partyLimit: 5, cost: { gold: 60, iron: 30 } },
]
export const MAX_GUILD_HALL_LEVEL = GUILD_HALL_LEVELS.length

/** The most heroes the guild hall keeps besides the party. */
export const MAX_RESERVES = 4
export const RECRUIT_COST: Stock = { gold: 10 }

/** The most members the party may have: the guild hall's level decides, never past `MAX_PARTY_SIZE`. */
export function partyLimit(world: WorldState): number {
  return Math.min(MAX_PARTY_SIZE, GUILD_HALL_LEVELS[world.guildHall - 1].partyLimit)
}

/** Whether the party stands at the encampment, the guild hall open to it. */
export function atGuildHall(world: WorldState): boolean {
  const camp = world.locations.find((l) => l.id === ENCAMPMENT_ID)
  return worldActive(world) && camp !== undefined && hexEquals(camp.position, world.party) && world.confronting === null
}

const NOT_HERE = 'The guild hall is at Oakvale.'

/** What raising the hall a level costs, or null at the top level. */
export function upgradeCost(world: WorldState): Stock | null {
  return world.guildHall < MAX_GUILD_HALL_LEVEL ? GUILD_HALL_LEVELS[world.guildHall].cost : null
}

export function upgradeGuildHall(game: GameState): string | null {
  const { world } = game
  if (!atGuildHall(world)) return NOT_HERE
  const cost = upgradeCost(world)
  if (!cost) return 'The guild hall is as large as it gets.'
  if (!canAfford(world.stock, cost)) return `The next level costs ${describeCost(cost)}, more than the stock holds.`
  spend(world.stock, cost)
  world.guildHall += 1
  return null
}

/** Every hero of the company, party and reserves, whose names are each their own. */
export function company(game: GameState): Character[] {
  return [...game.party, ...game.reserves]
}

/** The pre-rolled characters not yet in the company, whom the hall can recruit. */
export function availablePrerolls(game: GameState): Preroll[] {
  const names = company(game).map((member) => member.name)
  return PREROLLS.filter((preroll) => !names.includes(preroll.draft.name))
}

/** The level a recruit joins at: the guild hall's level, but never above the party's least experienced member. */
export function recruitLevel(game: GameState): number {
  return Math.max(1, Math.min(game.world.guildHall, ...game.party.map((member) => member.level)))
}

/** Why a recruit named `name` cannot join now, or null when one can. */
export function recruitRefusal(game: GameState, name?: string): string | null {
  if (!atGuildHall(game.world)) return NOT_HERE
  if (game.reserves.length >= MAX_RESERVES) return `The guild hall keeps no more than ${MAX_RESERVES} heroes in reserve.`
  if (!canAfford(game.world.stock, RECRUIT_COST)) return `A recruit costs ${describeCost(RECRUIT_COST)}, more than the stock holds.`
  if (name !== undefined && company(game).some((member) => member.name === name.trim())) return `${name} is already in the company.`
  return null
}

/**
 * Hires the hero `draft` makes into the reserves, for `RECRUIT_COST`, at
 * `recruitLevel`: levelled up as experience would, with the skill points,
 * perks and spell picks of those levels left for the player to spend.
 */
export function recruit(game: GameState, draft: CharacterDraft): string | null {
  const refusal = recruitRefusal(game, draft.name)
  if (refusal) return refusal
  const hero = draftCharacter(draft)
  const level = recruitLevel(game)
  while (hero.level < level) levelUp(hero)
  spend(game.world.stock, RECRUIT_COST)
  game.reserves.push(hero)
  return null
}

/** A hero comes out of the reserves rested: waiting at home is resting. */
function rested(hero: Character): Character {
  hero.hp = maxHp(hero)
  hero.mana = maxMana(hero)
  return hero
}

/** Sends party member `index` to the reserves. The party is never left empty. */
export function toReserves(game: GameState, index: number): string | null {
  if (!atGuildHall(game.world)) return NOT_HERE
  if (!game.party[index]) return 'There is no such member.'
  if (game.party.length <= 1) return 'The party cannot be left empty.'
  if (game.reserves.length >= MAX_RESERVES) return `The guild hall keeps no more than ${MAX_RESERVES} heroes in reserve.`
  game.reserves.push(...game.party.splice(index, 1))
  return null
}

/** Brings reserve `index` into the party, at its end, while the party is under its limit. */
export function toParty(game: GameState, index: number): string | null {
  if (!atGuildHall(game.world)) return NOT_HERE
  if (!game.reserves[index]) return 'There is no such reserve.'
  if (game.party.length >= partyLimit(game.world)) return `The party is full: the guild hall's level ${game.world.guildHall} allows ${partyLimit(game.world)}.`
  game.party.push(rested(game.reserves.splice(index, 1)[0]))
  return null
}

/** Exchanges party member `member` for reserve `reserve`, who takes its place in the battle order. */
export function swap(game: GameState, member: number, reserve: number): string | null {
  if (!atGuildHall(game.world)) return NOT_HERE
  if (!game.party[member] || !game.reserves[reserve]) return 'There is no such hero.'
  const leaving = game.party[member]
  game.party[member] = rested(game.reserves[reserve])
  game.reserves[reserve] = leaving
  return null
}
