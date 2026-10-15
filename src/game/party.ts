import { deriveCombatStats, type Character } from '../character/character.ts'
import { draftCharacter, type CharacterDraft } from '../character/creation.ts'
import { gainXp, type XpGain } from '../character/progression.ts'
import type { Fighter } from './encounters.ts'

/** The most characters a party can ever hold: what a party limit can grow to, and what `PARTY_START` has hexes for. */
export const MAX_PARTY_SIZE = 6

/** The party limit a new game starts with; a game stores its own (`GameState.partyLimit`). */
export const STARTING_PARTY_LIMIT = 3

/** The hit points a member who fell in a battle the party won gets back up with. */
export const REVIVED_HP = 1

/**
 * The ready-made party: a soldier, an archer and a mage, each the specialist
 * of one skill. They are drafts, built as a created character is, so each is
 * a legal creation and can be edited on the party screen like one.
 */
export const READY_MADE: readonly CharacterDraft[] = [
  {
    name: 'Aldric',
    portrait: 'knight',
    attributes: { strength: 9, perception: 3, endurance: 7, intelligence: 3, agility: 6, luck: 4 },
    tagged: 'melee',
    raises: { melee: 10, archery: 0, magic: 0 },
    perks: ['weapon_training', 'toughness', 'heavy_hand'],
  },
  {
    name: 'Brenna',
    portrait: 'ranger',
    attributes: { strength: 3, perception: 9, endurance: 5, intelligence: 4, agility: 7, luck: 4 },
    tagged: 'archery',
    raises: { melee: 0, archery: 10, magic: 0 },
    perks: ['marksmanship', 'deadly_aim', 'dodger'],
  },
  {
    name: 'Delwyn',
    portrait: 'wizard',
    attributes: { strength: 3, perception: 4, endurance: 4, intelligence: 9, agility: 6, luck: 6 },
    tagged: 'magic',
    raises: { melee: 0, archery: 0, magic: 10 },
    perks: ['magic_arrow', 'arcane_study', 'keen_eye'],
  },
]

/**
 * The player's characters, in the order they line up for battle. A battle's
 * unit for the member at index i is `heroId(i)` (encounters.ts).
 */
export type Party = Character[]

/** The party a list of drafts makes, in their order. */
export function partyFromDrafts(drafts: readonly CharacterDraft[]): Party {
  return drafts.map(draftCharacter)
}

/** The ready-made three, at level 1. */
export function readyMadeParty(): Party {
  return partyFromDrafts(READY_MADE)
}

/** Adds `character` to the party. Returns false if the party is at `limit`, its game's party limit. */
export function joinParty(party: Party, character: Character, limit: number): boolean {
  if (party.length >= Math.min(limit, MAX_PARTY_SIZE)) return false
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
