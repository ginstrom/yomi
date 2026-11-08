import { maxHp, maxMana, type Character } from '../character/character.ts'
import { draftCharacter, type CharacterDraft } from '../character/creation.ts'
import { levelUp } from '../character/progression.ts'
import { atEncampment, canAfford, describeCost, spend } from './buildings.ts'
import { MAX_PARTIES, type Expedition } from './expedition.ts'
import type { GameState } from './gameState.ts'
import { MAX_PARTY_SIZE, PREROLLS, type Preroll } from './party.ts'
import type { Stock } from './territory.ts'
import { encampmentName, type WorldState } from './worldMap.ts'

/**
 * The guild hall at the encampment (docs/designs/guild-hall-and-watchtowers.md
 * §4.1–4.3): the roster of heroes beyond the party, recruiting, swapping, and
 * the hall's level, which sets the party limit, how many parties the company
 * may field and how many heroes it may hold. Used only while the party
 * stands at the encampment. Each action returns why it was refused, or null when done.
 */

/**
 * Each level's party limit (members a party), parties the company may field,
 * company limit (parties' members and reserves together, bounding recruits)
 * and what raising the hall to it costs; level 1 is where a game starts.
 */
export const GUILD_HALL_LEVELS: ReadonlyArray<{ partyLimit: number; parties: number; company: number; cost: Stock }> = [
  { partyLimit: 3, parties: 1, company: 7, cost: {} },
  { partyLimit: 4, parties: 1, company: 8, cost: { gold: 30, iron: 15 } },
  // Gold and iron, as timber and stone are too late to come by (see the watchtower's cost).
  { partyLimit: 5, parties: 1, company: 9, cost: { gold: 60, iron: 30 } },
  // The Barracks: more parties, not bigger ones.
  { partyLimit: 5, parties: 2, company: 14, cost: { gold: 120, iron: 40, stone: 20 } },
  { partyLimit: 5, parties: 3, company: 18, cost: { gold: 200, silver: 30, stone: 20 } },
]
export const MAX_GUILD_HALL_LEVEL = GUILD_HALL_LEVELS.length

/** The most heroes the guild hall keeps besides the party. */
export const MAX_RESERVES = 4
export const RECRUIT_COST: Stock = { gold: 10 }

/** The most members the party may have: the guild hall's level decides, never past `MAX_PARTY_SIZE`. */
export function partyLimit(world: WorldState): number {
  return Math.min(MAX_PARTY_SIZE, GUILD_HALL_LEVELS[world.guildHall - 1].partyLimit)
}

/** How many parties the company may field: the guild hall's level decides, never past `MAX_PARTIES`. */
export function maxParties(world: WorldState): number {
  return Math.min(MAX_PARTIES, GUILD_HALL_LEVELS[world.guildHall - 1].parties)
}

/** The most heroes the company may hold, parties and reserves together. */
export function companyLimit(world: WorldState): number {
  return GUILD_HALL_LEVELS[world.guildHall - 1].company
}

/** Whether the party stands at the encampment, the guild hall open to it. */
export function atGuildHall(world: WorldState, party: Expedition): boolean {
  return atEncampment(world, party)
}

const notHere = (world: WorldState): string => `The guild hall is at ${encampmentName(world)}.`

/** What raising the hall a level costs, or null at the top level. */
export function upgradeCost(world: WorldState): Stock | null {
  return world.guildHall < MAX_GUILD_HALL_LEVEL ? GUILD_HALL_LEVELS[world.guildHall].cost : null
}

export function upgradeGuildHall(game: GameState, party: Expedition): string | null {
  const { world } = game
  if (!atGuildHall(world, party)) return notHere(world)
  const cost = upgradeCost(world)
  if (!cost) return 'The guild hall is as large as it gets.'
  if (!canAfford(world.stock, cost)) return `The next level costs ${describeCost(cost)}, more than the stock holds.`
  spend(world.stock, cost)
  world.guildHall += 1
  return null
}

/** The parties standing at the encampment, in list order. */
export function homeParties(game: GameState): Expedition[] {
  return game.parties.filter((party) => atGuildHall(game.world, party))
}

/** The party the encampment acts for: `preferred` if it is at home, else the first party at home, else none. */
export function homeParty(game: GameState, preferred?: string): Expedition | null {
  const home = homeParties(game)
  return home.find((party) => party.id === preferred) ?? home[0] ?? null
}

/** Every hero of the company, every party's and the reserves, whose names are each their own. */
export function company(game: GameState): Character[] {
  return [...game.parties.flatMap((p) => p.members), ...game.reserves]
}

/** The pre-rolled characters not yet in the company, whom the hall can recruit. */
export function availablePrerolls(game: GameState): Preroll[] {
  const names = company(game).map((member) => member.name)
  return PREROLLS.filter((preroll) => !names.includes(preroll.draft.name))
}

/** The level a recruit joins at: the guild hall's level. */
export function recruitLevel(game: GameState): number {
  return Math.max(1, game.world.guildHall)
}

/** Why a recruit named `name` cannot join now, or null when one can. */
export function recruitRefusal(game: GameState, party: Expedition, name?: string): string | null {
  if (!atGuildHall(game.world, party)) return notHere(game.world)
  if (game.reserves.length >= MAX_RESERVES) return `The guild hall keeps no more than ${MAX_RESERVES} heroes in reserve.`
  if (company(game).length >= companyLimit(game.world)) return `The guild hall's level ${game.world.guildHall} keeps no more than ${companyLimit(game.world)} heroes.`
  if (!canAfford(game.world.stock, RECRUIT_COST)) return `A recruit costs ${describeCost(RECRUIT_COST)}, more than the stock holds.`
  if (name !== undefined && company(game).some((member) => member.name === name.trim())) return `${name} is already in the company.`
  return null
}

/**
 * Hires the hero `draft` makes into the reserves, for `RECRUIT_COST`, at
 * `recruitLevel`: levelled up as experience would, with the skill points,
 * perks and spell picks of those levels left for the player to spend.
 */
export function recruit(game: GameState, party: Expedition, draft: CharacterDraft): string | null {
  const refusal = recruitRefusal(game, party, draft.name)
  if (refusal) return refusal
  const hero = draftCharacter(draft)
  const level = recruitLevel(game)
  while (hero.level < level) levelUp(hero)
  spend(game.world.stock, RECRUIT_COST)
  game.reserves.push(hero)
  return null
}

/** A hero comes out of the reserves rested: waiting at home is resting. */
export function rested(hero: Character): Character {
  hero.hp = maxHp(hero)
  hero.mana = maxMana(hero)
  return hero
}

/** Sends party member `index` to the reserves. The party is never left empty. */
export function toReserves(game: GameState, party: Expedition, index: number): string | null {
  if (!atGuildHall(game.world, party)) return notHere(game.world)
  if (!party.members[index]) return 'There is no such member.'
  if (party.members.length <= 1) return 'The party cannot be left empty.'
  if (game.reserves.length >= MAX_RESERVES) return `The guild hall keeps no more than ${MAX_RESERVES} heroes in reserve.`
  game.reserves.push(...party.members.splice(index, 1))
  return null
}

/** Brings reserve `index` into the party, at its end, while the party is under its limit. */
export function toParty(game: GameState, party: Expedition, index: number): string | null {
  if (!atGuildHall(game.world, party)) return notHere(game.world)
  if (!game.reserves[index]) return 'There is no such reserve.'
  if (party.members.length >= partyLimit(game.world)) return `The party is full: the guild hall's level ${game.world.guildHall} allows ${partyLimit(game.world)}.`
  party.members.push(rested(game.reserves.splice(index, 1)[0]))
  return null
}

/** Exchanges party member `member` for reserve `reserve`, who takes its place in the battle order. */
export function swap(game: GameState, party: Expedition, member: number, reserve: number): string | null {
  if (!atGuildHall(game.world, party)) return notHere(game.world)
  if (!party.members[member] || !game.reserves[reserve]) return 'There is no such hero.'
  const leaving = party.members[member]
  party.members[member] = rested(game.reserves[reserve])
  game.reserves[reserve] = leaving
  return null
}
