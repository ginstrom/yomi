import { deriveCombatStats } from '../character/character.ts'
import { draftCharacter, type CharacterDraft } from '../character/creation.ts'
import { autoAdvance, levelUp } from '../character/progression.ts'
import type { CombatantStats } from '../combat/combat.ts'
import type { Tier } from '../inventory/catalog.ts'
import { gradedItem, type Grade } from '../inventory/grades.ts'
import { itemById, type Equipment } from '../inventory/inventory.ts'
import type { BanditKind } from './encounters.ts'

/**
 * Bandits: humanoid foes built by the rules heroes are, so that they scale to
 * any level as a hero does. A bandit is a role's draft made a character,
 * dressed in its role's gear, raised to its level and spent by `autoAdvance`;
 * its stats are what `deriveCombatStats` makes of that. Nothing here is a
 * rule of its own: a hero built the same way fights with the same numbers.
 */

export type BanditRole = 'cutthroat' | 'archer' | 'brute' | 'mage' | 'captain' | 'crossbowman'

/** The role behind each bandit kind. */
export const BANDIT_ROLE: Record<BanditKind, BanditRole> = {
  bandit_cutthroat: 'cutthroat',
  bandit_archer: 'archer',
  bandit_brute: 'brute',
  bandit_mage: 'mage',
  bandit_captain: 'captain',
  bandit_crossbowman: 'crossbowman',
}

/**
 * Each role's draft, a legal creation like the pre-rolls it is modelled on:
 * the captain and brute on Aldric, the archer on Brenna, the mage on Delwyn,
 * the cutthroat a quick blade. Bandits are renamed by their encounter, and
 * their portraits are never shown.
 */
const DRAFTS: Record<BanditRole, CharacterDraft> = {
  cutthroat: {
    name: 'Cutthroat',
    portrait: 'rogue',
    attributes: { strength: 6, perception: 4, endurance: 5, intelligence: 3, agility: 9, luck: 5 },
    tagged: 'melee',
    raises: { melee: 10, archery: 0, magic: 0 },
    perks: ['weapon_training', 'dodger', 'toughness'],
  },
  archer: {
    name: 'Bandit Archer',
    portrait: 'ranger',
    attributes: { strength: 3, perception: 9, endurance: 5, intelligence: 4, agility: 7, luck: 4 },
    tagged: 'archery',
    raises: { melee: 0, archery: 10, magic: 0 },
    perks: ['marksmanship', 'deadly_aim', 'dodger'],
  },
  brute: {
    name: 'Bandit Brute',
    portrait: 'barbarian',
    attributes: { strength: 10, perception: 3, endurance: 8, intelligence: 2, agility: 5, luck: 4 },
    tagged: 'melee',
    raises: { melee: 10, archery: 0, magic: 0 },
    perks: ['weapon_training', 'heavy_hand', 'armor_breaker'],
  },
  mage: {
    name: 'Hedge-Mage',
    portrait: 'wizard',
    attributes: { strength: 3, perception: 4, endurance: 4, intelligence: 9, agility: 6, luck: 6 },
    tagged: 'magic',
    raises: { melee: 0, archery: 0, magic: 10 },
    // Spellcasting's two spell picks buy the last two; autoAdvance adds a heal and Flame Arrow by level 3.
    perks: ['spellcasting', 'arcane_study', 'keen_eye', 'magic_arrow', 'shield'],
  },
  crossbowman: {
    name: 'Bandit Crossbowman',
    portrait: 'ranger',
    attributes: { strength: 3, perception: 9, endurance: 5, intelligence: 4, agility: 7, luck: 4 },
    tagged: 'archery',
    raises: { melee: 0, archery: 10, magic: 0 },
    perks: ['marksmanship', 'deadly_aim', 'dodger'],
  },
  captain: {
    name: 'Bandit Captain',
    portrait: 'knight',
    attributes: { strength: 9, perception: 3, endurance: 7, intelligence: 3, agility: 6, luck: 4 },
    tagged: 'melee',
    raises: { melee: 10, archery: 0, magic: 0 },
    perks: ['weapon_training', 'toughness', 'dodger'],
  },
}

/** A copy of `role`'s draft, for building a hero the same way. */
export function banditDraft(role: BanditRole): CharacterDraft {
  const draft = DRAFTS[role]
  return { ...draft, attributes: { ...draft.attributes }, raises: { ...draft.raises }, perks: [...draft.perks] }
}

/** The ids of one item of a role's gear at each tier, by catalog family: iron or oak and yew at tier 1, steel and ironwood at tier 2. */
type GearIds = readonly [tier1: string, tier2: string]

/** What each role wears and holds; nothing else (no starting breastplate or shield of its own). */
const GEAR: Record<BanditRole, { mainHand: GearIds; offHand?: GearIds; armor?: GearIds }> = {
  cutthroat: { mainHand: ['iron_dagger', 'steel_dagger'] },
  archer: { mainHand: ['yew_bow', 'ironwood_bow'] },
  brute: { mainHand: ['iron_battle_axe', 'steel_battle_axe'], armor: ['iron_breastplate', 'steel_breastplate'] },
  mage: { mainHand: ['spark_wand', 'ironwood_wand'] },
  captain: {
    mainHand: ['iron_sword', 'steel_longsword'],
    offHand: ['oak_shield', 'ironwood_shield'],
    armor: ['iron_breastplate', 'steel_breastplate'],
  },
  crossbowman: { mainHand: ['yew_crossbow', 'ironwood_crossbow'] },
}

/** The tier and grade a bandit's gear is made at. */
export interface BanditGear {
  tier: Tier
  grade: Grade
}

function equipmentFor(role: BanditRole, { tier, grade }: BanditGear): Equipment {
  const { mainHand, offHand, armor } = GEAR[role]
  const made = (ids: GearIds) => gradedItem(itemById(ids[tier - 1])!, grade)
  return {
    mainHand: made(mainHand),
    ...(offHand ? { offHand: made(offHand) } : {}),
    ...(armor ? { armor: made(armor) } : {}),
  }
}

const cache = new Map<string, CombatantStats>()

/** Freezes `value` and everything reachable from it, so a shared block cannot be changed. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const inner of Object.values(value)) deepFreeze(inner)
  }
  return value
}

/**
 * A bandit of `role` at `level` (below 1 counts as 1), its gear at `gear`'s tier and grade.
 * Built in this order, which a hero built to match must follow: the draft
 * made a character (`draftCharacter`), its gear put on in place of the
 * starting kit (before levelling, so that `autoAdvance` raises the skill of
 * the weapon it holds), `levelUp` to `level`, one `autoAdvance`, then
 * `deriveCombatStats`. Cached per (role, level, tier, grade) and deeply frozen:
 * callers spread it and never change it.
 */
export function banditStats(role: BanditRole, level: number, gear: BanditGear): CombatantStats {
  const target = Math.max(1, Math.floor(level))
  const key = `${role}:${target}:${gear.tier}:${gear.grade}`
  const known = cache.get(key)
  if (known) return known
  const bandit = draftCharacter(DRAFTS[role])
  bandit.equipment = equipmentFor(role, gear)
  while (bandit.level < target) levelUp(bandit)
  autoAdvance(bandit)
  const stats = deepFreeze(deriveCombatStats(bandit))
  cache.set(key, stats)
  return stats
}

/** The gear bandits wear at a threat: plain iron and oak below threat 5, Fine steel and ironwood (tier 2, grade 2) from it. */
export function banditGear(threat: number): BanditGear {
  return threat >= 5 ? { tier: 2, grade: 2 } : { tier: 1, grade: 1 }
}
