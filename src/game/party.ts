import { deriveCombatStats, maxHp, type Character } from '../character/character.ts'
import { draftCharacter, type CharacterDraft } from '../character/creation.ts'
import { gainXp, type XpGain } from '../character/progression.ts'
import { castOnWorldMap, healsOne, worldHealing, worldSpells } from '../character/worldCasting.ts'
import type { SpellId } from '../combat/spells.ts'
import { listNames } from '../engine/battleEngine.ts'
import type { Item } from '../inventory/inventory.ts'
import type { Fighter } from './encounters.ts'

/** The most characters a party can ever hold: what a party limit can grow to, and what `PARTY_START` has hexes for. */
export const MAX_PARTY_SIZE = 6

/** The party limit a new game starts with, the party screen's; in a game the guild hall's level sets it (`partyLimit` in guildHall.ts). */
export const STARTING_PARTY_LIMIT = 3

/** A pre-rolled character: a draft ready to fill a place in the party, and the few words the party screen says of it. */
export interface Preroll {
  draft: CharacterDraft
  /** What it is good at, as "Melee fighter", shown under its portrait. */
  role: string
}

/**
 * The pre-rolled characters a place in the party can be filled with, instead
 * of creating one. They are drafts, built as a created character is, so each
 * is a legal creation and can be edited on the party screen like one. The
 * first three are the ready-made party (`READY_MADE`).
 */
export const PREROLLS: readonly Preroll[] = [
  {
    role: 'Melee fighter',
    draft: {
      name: 'Aldric',
      portrait: 'knight',
      attributes: { strength: 9, perception: 3, endurance: 7, intelligence: 3, agility: 6, luck: 4 },
      tagged: 'melee',
      raises: { melee: 10, archery: 0, magic: 0 },
      perks: ['weapon_training', 'toughness', 'heavy_hand'],
    },
  },
  {
    role: 'Archer',
    draft: {
      name: 'Brenna',
      portrait: 'ranger',
      attributes: { strength: 3, perception: 9, endurance: 5, intelligence: 4, agility: 7, luck: 4 },
      tagged: 'archery',
      raises: { melee: 0, archery: 10, magic: 0 },
      perks: ['marksmanship', 'deadly_aim', 'dodger'],
    },
  },
  {
    role: 'Mage',
    draft: {
      name: 'Delwyn',
      portrait: 'wizard',
      attributes: { strength: 3, perception: 4, endurance: 4, intelligence: 9, agility: 6, luck: 6 },
      tagged: 'magic',
      raises: { melee: 0, archery: 0, magic: 10 },
      // Spellcasting's two spell picks buy the last two.
      perks: ['spellcasting', 'arcane_study', 'keen_eye', 'magic_arrow', 'heal'],
    },
  },
  {
    // Tagged in Melee Weapons and trained in Archery, so the two end up close.
    role: 'Balanced warrior',
    draft: {
      name: 'Garrick',
      portrait: 'squire',
      attributes: { strength: 6, perception: 6, endurance: 5, intelligence: 3, agility: 8, luck: 4 },
      tagged: 'melee',
      raises: { melee: 0, archery: 10, magic: 0 },
      perks: ['weapon_training', 'marksmanship', 'marksmanship'],
    },
  },
]

/** The ready-made party: a soldier, an archer and a mage, each the specialist of one skill. */
export const READY_MADE: readonly CharacterDraft[] = PREROLLS.slice(0, 3).map((preroll) => preroll.draft)

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
}

/** What a victory brought the party, and whom it cost. */
export interface VictoryReward {
  members: MemberReward[]
  /** Those who fell in the battle, gone for good. */
  dead: Character[]
}

/**
 * Takes the members who fell in battle (no hit points left) out of the party
 * for good, and puts everything they wore and carried into `baggage`, so no
 * gear is lost with them. Returns the dead, in party order.
 */
export function buryFallen(party: Party, baggage: Item[]): Character[] {
  const dead = party.filter((member) => member.hp <= 0)
  for (const member of dead) {
    baggage.push(...Object.values(member.equipment), ...member.backpack.filter((item): item is Item => item !== null))
    member.equipment = {}
    member.backpack = member.backpack.map(() => null)
    party.splice(party.indexOf(member), 1)
  }
  return dead
}

/**
 * Rewards the party for a won battle worth `xp`. A member who fell is dead
 * (`buryFallen`, their gear into `baggage`) and earns nothing; every other
 * member earns all of it, so a hero levels at the pace progression.ts sets
 * however many fight beside it. Wounds last until a level or a healing spell
 * heals them.
 */
export function rewardVictory(party: Party, xp: number, baggage: Item[]): VictoryReward {
  const dead = buryFallen(party, baggage)
  return { members: party.map((member) => ({ member, gain: gainXp(member, xp) })), dead }
}

/** The lines the victory screen shows for a reward: the experience, and a line for each member it changed. */
export function describeRewards({ members, dead }: VictoryReward): string[] {
  const mourned = dead.length > 0 ? [`${listNames(dead.map((member) => member.name))} fell and will not rise again. What they carried is in the baggage.`] : []
  if (members.length === 0) return mourned
  // A perk can add to one member's share; the first line gives what the battle was worth to most.
  const lines = [`+${Math.min(...members.map(({ gain }) => gain.xp))} XP${members.length > 1 ? ' each' : ''}`, ...mourned]
  for (const { member, gain } of members) {
    if (gain.levelsGained > 0) {
      const points = `, ${gain.skillPointsGained} skill points`
      const perk = gain.perksGained > 0 ? ', a perk' : ''
      const spell = gain.spellsGained > 0 ? `, ${gain.spellsGained === 1 ? 'a spell' : `${gain.spellsGained} spells`}` : ''
      lines.push(`${member.name} reaches level ${member.level}: +${gain.maxHpGained} max HP${points}${perk}${spell}, wounds healed`)
    }
  }
  return lines
}

/** Hit points `member` has lost. */
const lost = (member: Character) => maxHp(member) - member.hp

/**
 * Spends the party's mana on its wounds after a won battle, as a careful
 * player would: each member that knows a healing spell, in party order,
 * casts while it has the mana and some member has lost at least what its
 * cheapest heal restores; a heal of the whole party when two members or more
 * have lost what that restores, else its strongest heal of one it can afford,
 * on the member who has lost most. Returns the hit points restored, for the
 * simulator. It is the simulator's; the player heals from the Spells tab.
 */
export function autoHeal(party: Party): number {
  const before = party.reduce((sum, member) => sum + member.hp, 0)
  for (const caster of party) {
    for (;;) {
      const known = worldSpells(caster)
      if (known.length === 0) break
      const cheapest = Math.min(...known.map(({ spell }) => worldHealing(spell)))
      if (!party.some((member) => lost(member) >= cheapest)) break
      const affordable = known.filter((k) => k.affordable).map((k) => k.spell)
      const strongest = (spells: SpellId[]) =>
        spells.reduce<SpellId | null>((a, b) => (a === null || worldHealing(b) > worldHealing(a) ? b : a), null)
      const group = strongest(affordable.filter((spell) => !healsOne(spell)))
      const one = strongest(affordable.filter(healsOne))
      const target = party.reduce((a, b) => (lost(b) > lost(a) ? b : a))
      const cast =
        group !== null && party.filter((member) => lost(member) >= worldHealing(group)).length >= 2
          ? castOnWorldMap(caster, group, party)
          : one !== null && castOnWorldMap(caster, one, party, target)
      if (!cast) break
    }
  }
  return party.reduce((sum, member) => sum + member.hp, 0) - before
}
