import { WARRIOR_BUILD, createCharacter, deriveCombatStats, type Build, type Character } from '../character/character.ts'
import { gainXp, type XpGain } from '../character/progression.ts'
import { IRON_SWORD, OAK_SHIELD, SPARK_WAND, YEW_BOW } from '../inventory/inventory.ts'
import type { Fighter } from './encounters.ts'

/** The most characters a party can hold. */
export const MAX_PARTY_SIZE = 6

/** The hit points a member who fell in a battle the party won gets back up with. */
export const REVIVED_HP = 1

/**
 * The heroes a new game starts with. Each is a different build: a soldier, an
 * archer, a quick skirmisher, and a mage who starts with the Magic Arrow perk,
 * as a pick does not otherwise come before level 3.
 */
const STARTING_HEROES: ReadonlyArray<readonly [name: string, build: Build]> = [
  ['Aldric', WARRIOR_BUILD],
  [
    'Brenna',
    {
      portrait: 'ranger',
      attributes: { strength: 4, perception: 7, endurance: 5, intelligence: 7, agility: 7, luck: 5 },
      tagged: ['archery'],
      mainHand: YEW_BOW,
    },
  ],
  [
    'Corwin',
    {
      portrait: 'rogue',
      attributes: { strength: 6, perception: 5, endurance: 6, intelligence: 5, agility: 8, luck: 5 },
      tagged: ['melee'],
      mainHand: IRON_SWORD,
      offHand: OAK_SHIELD,
    },
  ],
  [
    'Delwyn',
    {
      portrait: 'wizard',
      attributes: { strength: 3, perception: 5, endurance: 4, intelligence: 9, agility: 6, luck: 8 },
      tagged: ['magic'],
      mainHand: SPARK_WAND,
      perks: ['magic_arrow'],
    },
  ],
]

/**
 * The player's characters, in the order they line up for battle. A battle's
 * unit for the member at index i is `heroId(i)` (encounters.ts).
 */
export type Party = Character[]

/** The four starting heroes, at level 1. */
export function newParty(): Party {
  return STARTING_HEROES.map(([name, build]) => createCharacter(name, build))
}

/** Adds `character` to the party. Returns false if the party is full. */
export function joinParty(party: Party, character: Character): boolean {
  if (party.length >= MAX_PARTY_SIZE) return false
  party.push(character)
  return true
}

/** The party as it enters a battle: each member's stats from its gear, at the hit points it has left. */
export function partyFighters(party: Party): Fighter[] {
  return party.map((member) => ({ stats: deriveCombatStats(member), hp: member.hp }))
}

/** What a victory brought one member. */
export interface MemberReward {
  member: Character
  gain: XpGain
  /** The member fell in the battle and is back on its feet. */
  revived: boolean
}

/** What a victory brought the party. */
export interface VictoryReward {
  members: MemberReward[]
}

/**
 * Rewards the party for a won battle worth `xp`. Every member earns all of
 * it, the fallen too, so a hero levels at the pace progression.ts sets
 * however many fight beside it. A member who fell gets back up at
 * `REVIVED_HP`, unless a new level has healed it. Nothing else restores hit
 * points: wounds last until a level heals them.
 */
export function rewardVictory(party: Party, xp: number): VictoryReward {
  const members = party.map((member): MemberReward => {
    const fell = member.hp <= 0
    const gain = gainXp(member, xp)
    if (member.hp <= 0) member.hp = REVIVED_HP
    return { member, gain, revived: fell && gain.levelsGained === 0 }
  })
  return { members }
}

/** The lines the victory screen shows for a reward: the experience, and a line for each member it changed. */
export function describeRewards({ members }: VictoryReward): string[] {
  if (members.length === 0) return []
  // A perk can add to one member's share; the first line gives what the battle was worth to most.
  const lines = [`+${Math.min(...members.map(({ gain }) => gain.xp))} XP${members.length > 1 ? ' each' : ''}`]
  for (const { member, gain, revived } of members) {
    if (gain.levelsGained > 0) {
      const points = `, ${gain.skillPointsGained} skill points`
      const perk = gain.perksGained > 0 ? ', a perk' : ''
      lines.push(`${member.name} reaches level ${member.level}: +${gain.maxHpGained} max HP${points}${perk}, wounds healed`)
    } else if (revived) {
      lines.push(`${member.name} gets back up, badly hurt`)
    }
  }
  return lines
}
