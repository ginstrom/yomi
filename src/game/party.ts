import { WARRIOR_BUILD, createCharacter, deriveCombatStats, maxHp, type Build, type Character } from '../character/character.ts'
import { perkBonus } from '../character/perks.ts'
import { gainXp, type XpGain } from '../character/progression.ts'
import { skillLevel } from '../character/skills.ts'
import { IRON_SWORD, OAK_SHIELD, YEW_BOW } from '../inventory/inventory.ts'
import type { Fighter } from './encounters.ts'

/** The most characters a party can hold. */
export const MAX_PARTY_SIZE = 6

/** The hit points a member who fell in a battle the party won gets back up with. */
export const REVIVED_HP = 1

/** How many percent of First Aid it takes to restore a hit point. */
export const FIRST_AID_PER_HP = 10

/**
 * The heroes a new game starts with. Each is a different build: a soldier, an
 * archer who is also the party's healer, and a quick skirmisher at home with
 * blade or bow.
 */
const STARTING_HEROES: ReadonlyArray<readonly [name: string, build: Build]> = [
  ['Aldric', WARRIOR_BUILD],
  [
    'Brenna',
    {
      portrait: 'ranger',
      attributes: { strength: 4, perception: 7, endurance: 5, intelligence: 7, agility: 7, luck: 5 },
      tagged: ['archery', 'firstAid'],
      mainHand: YEW_BOW,
    },
  ],
  [
    'Corwin',
    {
      portrait: 'rogue',
      attributes: { strength: 6, perception: 5, endurance: 6, intelligence: 5, agility: 8, luck: 5 },
      tagged: ['melee', 'archery'],
      mainHand: IRON_SWORD,
      offHand: OAK_SHIELD,
    },
  ],
]

/**
 * The player's characters, in the order they line up for battle. A battle's
 * unit for the member at index i is `heroId(i)` (encounters.ts).
 */
export type Party = Character[]

/** The three starting heroes, at level 1. */
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

/** The hit points a character's First Aid restores to each of the party it tends: 1 for every `FIRST_AID_PER_HP` percent, and what its perks add. */
export function firstAidHp(healer: Character): number {
  return Math.floor(skillLevel(healer, 'firstAid') / FIRST_AID_PER_HP) + perkBonus(healer, 'firstAid')
}

/** What a victory brought one member. */
export interface MemberReward {
  member: Character
  gain: XpGain
  /** The member fell in the battle and is back on its feet. */
  revived: boolean
  /** Hit points the healer's tending gave back. */
  tended: number
}

/** What a victory brought the party. */
export interface VictoryReward {
  members: MemberReward[]
  /** Who tended the party's wounds; null if no one's needed it. */
  healer: Character | null
}

/**
 * Rewards the party for a won battle worth `xp`. Every member earns all of
 * it, the fallen too, so a hero levels at the pace progression.ts sets
 * however many fight beside it. A member who fell gets back up at
 * `REVIVED_HP`, unless a new level has healed it. Then the best healer among
 * those who kept their feet tends everyone's wounds (`firstAidHp`).
 */
export function rewardVictory(party: Party, xp: number): VictoryReward {
  const standing = party.filter((member) => member.hp > 0)
  const members = party.map((member): MemberReward => {
    const fell = member.hp <= 0
    const gain = gainXp(member, xp)
    if (member.hp <= 0) member.hp = REVIVED_HP
    return { member, gain, revived: fell && gain.levelsGained === 0, tended: 0 }
  })
  const best = standing.reduce<Character | null>((a, b) => (a && firstAidHp(a) >= firstAidHp(b) ? a : b), null)
  if (best) {
    for (const reward of members) {
      const { member } = reward
      reward.tended = Math.min(firstAidHp(best), maxHp(member) - member.hp)
      member.hp += reward.tended
    }
  }
  return { members, healer: best && members.some((reward) => reward.tended > 0) ? best : null }
}

/** The lines the victory screen shows for a reward: the experience, a line for each member it changed, and the healer's work. */
export function describeRewards({ members, healer }: VictoryReward): string[] {
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
  if (healer) lines.push(`${healer.name} tends the party's wounds: up to ${firstAidHp(healer)} HP each`)
  return lines
}
