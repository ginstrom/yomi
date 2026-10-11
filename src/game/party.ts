import { createWarrior, deriveCombatStats, type Character } from '../character/character.ts'
import { gainXp, type XpGain } from '../character/progression.ts'
import type { Fighter } from './encounters.ts'

/** The most characters a party can hold. */
export const MAX_PARTY_SIZE = 6

/** The hit points a member who fell in a battle the party won gets back up with. */
export const REVIVED_HP = 1

/** The fighters a new game starts with. */
const STARTING_NAMES = ['Aldric', 'Brenna', 'Corwin']

/**
 * The player's characters, in the order they line up for battle. A battle's
 * unit for the member at index i is `heroId(i)` (encounters.ts).
 */
export type Party = Character[]

/** Three level 1 fighters. */
export function newParty(): Party {
  return STARTING_NAMES.map((name) => createWarrior(name))
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

/**
 * Rewards the party for a won battle worth `xp`. Every member earns all of
 * it, the fallen too, so a hero levels at the pace progression.ts sets
 * however many fight beside it. A member who fell gets back up at
 * `REVIVED_HP`, unless a new level has healed it.
 */
export function rewardVictory(party: Party, xp: number): MemberReward[] {
  return party.map((member) => {
    const fell = member.hp <= 0
    const gain = gainXp(member, xp)
    if (member.hp <= 0) member.hp = REVIVED_HP
    return { member, gain, revived: fell && gain.levelsGained === 0 }
  })
}

/** The lines the victory screen shows for a reward: the experience, then a line for each member it changed. */
export function describeRewards(rewards: readonly MemberReward[]): string[] {
  if (rewards.length === 0) return []
  const lines = [`+${rewards[0].gain.xp} XP${rewards.length > 1 ? ' each' : ''}`]
  for (const { member, gain, revived } of rewards) {
    if (gain.levelsGained > 0) {
      const attack = gain.attackBonusGained > 0 ? `, +${gain.attackBonusGained} attack` : ''
      lines.push(`${member.name} reaches level ${member.level}: +${gain.maxHpGained} max HP${attack}, wounds healed`)
    } else if (revived) {
      lines.push(`${member.name} gets back up, badly hurt`)
    }
  }
  return lines
}
