import type { EquipmentSlot, ItemIcon, ItemStats } from './inventory.ts'

/**
 * The catalog of plain gear (docs/designs/long-campaign/stage-03-gear-families.md):
 * every family, each in a tier of each material of its kind, from which
 * inventory.ts builds the plain items. Plain data and functions only, called
 * by nothing of inventory.ts as it loads, so the two may import each other.
 */

export type MaterialKind = 'metal' | 'wood' | 'hide' | 'cloth'
export type Tier = 1 | 2 | 3 | 4 | 5
/** How a tier and a grade treat an item: by its slot (gearClass). */
export type GearClass = 'weapon' | 'shield' | 'armour' | 'small'

export interface MaterialDef {
  id: string
  name: string
  kind: MaterialKind
  tier: Tier
  /** Points off the strength each of its families asks, never below 0: Mithril 1, Starmetal 2. */
  strengthRelief?: number
  /** Its families' spell-skill penalties are halved toward 0 (Math.trunc): Mithril, Starmetal. */
  casterFriendly?: true
  /** Tiers 3 to 5: the stock material (src/game/territory.ts `Material`) forging and tempering it spends. */
  stock?: string
}

export type FamilyId =
  | 'dagger'
  | 'shortsword'
  | 'rapier'
  | 'longsword'
  | 'mace'
  | 'spear'
  | 'battle_axe'
  | 'war_hammer'
  | 'greatsword'
  | 'halberd'
  | 'bow'
  | 'longbow'
  | 'crossbow'
  | 'wand'
  | 'staff'
  | 'buckler'
  | 'shield'
  | 'tower_shield'
  | 'robe'
  | 'leather'
  | 'breastplate'
  | 'plate'
  | 'cap'
  | 'helm'
  | 'gloves'
  | 'gauntlets'
  | 'boots'
  | 'greaves'

export interface FamilyDef {
  id: FamilyId
  /** In an item's name after the material's: "Longsword" makes "Steel Longsword". */
  name: string
  slot: EquipmentSlot
  kind: MaterialKind
  icon: ItemIcon
  description: string
  /** At tier 1, plain; `strength`, `apPenalty`, `reach` and `rangedPierce` included. */
  stats: ItemStats
  /** Tier 1's id and name where they are not `<material>_<family>` and "<Material> <Name>". */
  tier1?: { id: string; name: string }
}

/**
 * One row a kind and tier; no material id holds an underscore, so a plain id
 * splits at its first (the hide tiers 3 to 5 are `wyvern`, `basilisk` and
 * `drake`, though their stock is `wyvern_hide` and the rest). Tiers 1 and 2
 * first, then tiers 3 to 5 (long-campaign stage 10): metal, wood, hide, and
 * cloth woven from the metal's ore.
 */
export const MATERIALS: readonly MaterialDef[] = [
  { id: 'iron', name: 'Iron', kind: 'metal', tier: 1 },
  { id: 'steel', name: 'Steel', kind: 'metal', tier: 2 },
  { id: 'yew', name: 'Yew', kind: 'wood', tier: 1 },
  { id: 'ironwood', name: 'Ironwood', kind: 'wood', tier: 2 },
  { id: 'leather', name: 'Leather', kind: 'hide', tier: 1 },
  { id: 'wolfhide', name: 'Wolfhide', kind: 'hide', tier: 2 },
  { id: 'linen', name: 'Linen', kind: 'cloth', tier: 1 },
  { id: 'silk', name: 'Silk', kind: 'cloth', tier: 2 },
  { id: 'mithril', name: 'Mithril', kind: 'metal', tier: 3, strengthRelief: 1, casterFriendly: true, stock: 'mithril' },
  { id: 'adamant', name: 'Adamant', kind: 'metal', tier: 4, stock: 'adamant' },
  { id: 'starmetal', name: 'Starmetal', kind: 'metal', tier: 5, strengthRelief: 2, casterFriendly: true, stock: 'starmetal' },
  { id: 'elderwood', name: 'Elderwood', kind: 'wood', tier: 3, stock: 'elderwood' },
  { id: 'wyrmwood', name: 'Wyrmwood', kind: 'wood', tier: 4, stock: 'wyrmwood' },
  { id: 'heartwood', name: 'Heartwood', kind: 'wood', tier: 5, stock: 'heartwood' },
  { id: 'wyvern', name: 'Wyvern-hide', kind: 'hide', tier: 3, stock: 'wyvern_hide' },
  { id: 'basilisk', name: 'Basilisk-scale', kind: 'hide', tier: 4, stock: 'basilisk_scale' },
  { id: 'drake', name: 'Drake-scale', kind: 'hide', tier: 5, stock: 'drake_scale' },
  { id: 'mithrilweave', name: 'Mithrilweave', kind: 'cloth', tier: 3, stock: 'mithril' },
  { id: 'adamantweave', name: 'Adamantweave', kind: 'cloth', tier: 4, stock: 'adamant' },
  { id: 'starweave', name: 'Starweave', kind: 'cloth', tier: 5, stock: 'starmetal' },
]

const d = (count: number, sides: number, bonus = 0) => ({ count, sides, bonus })

// Weapons trade damage against action points: with 8 AP a turn, a cost of 4 or
// less buys two attacks from a unit that stands still, and every point above
// that is a hex it cannot also walk. Two attacks a turn are worth more than
// their summed damage suggests, which is why the light weapons and the bow
// roll so low: `npm run simulate -- --player-weapon <id>` compares them. But
// a foe's resistance comes off every hit (`damageThrough`), so armour takes
// the most from those many small hits: the light blades and the bow are the
// weapons for the lightly armoured, and the heavy ones, whose big hits also
// pierce points of resistance (`armorPierce`), the answer to the armoured.
// The heaviest ask strength (`strength`), which a weaker wielder pays for in
// its chance to hit.

export const FAMILIES: readonly FamilyDef[] = [
  { id: 'dagger', name: 'Dagger', slot: 'mainHand', kind: 'metal', icon: 'dagger', description: 'Short, light and quick.', stats: { damage: d(1, 4), attackApCost: 3 } },
  { id: 'shortsword', name: 'Shortsword', slot: 'mainHand', kind: 'metal', icon: 'shortsword', description: 'A handy stabbing blade.', stats: { damage: d(1, 3, 1), attackApCost: 4 } },
  { id: 'rapier', name: 'Rapier', slot: 'mainHand', kind: 'metal', icon: 'rapier', description: 'A thin blade that finds the gaps.', stats: { damage: d(1, 6), attackApCost: 4, critChance: 5 } },
  {
    id: 'longsword',
    name: 'Longsword',
    slot: 'mainHand',
    kind: 'metal',
    icon: 'sword',
    description: 'A well-balanced blade.',
    stats: { damage: d(1, 8, 3), attackApCost: 5, armorPierce: 1 },
    tier1: { id: 'iron_sword', name: 'Iron Longsword' },
  },
  { id: 'mace', name: 'Mace', slot: 'mainHand', kind: 'metal', icon: 'mace', description: 'A flanged head that dents plate.', stats: { damage: d(1, 6, 3), attackApCost: 5, armorPierce: 2, strength: 5 } },
  { id: 'spear', name: 'Spear', slot: 'mainHand', kind: 'metal', icon: 'spear', description: 'Strikes from behind the front rank.', stats: { damage: d(1, 8, 1), attackApCost: 5, attackRange: 2, armorPierce: 1, reach: true } },
  { id: 'battle_axe', name: 'Battle Axe', slot: 'mainHand', kind: 'metal', icon: 'axe', description: 'A heavy head on a long haft.', stats: { damage: d(1, 12, 2), attackApCost: 6, armorPierce: 2, strength: 5 } },
  { id: 'war_hammer', name: 'War Hammer', slot: 'mainHand', kind: 'metal', icon: 'war_hammer', description: 'Slow, but it breaks what it hits.', stats: { damage: d(1, 10, 3), attackApCost: 6, armorPierce: 3, toHit: -5, strength: 6 } },
  { id: 'greatsword', name: 'Greatsword', slot: 'mainHand', kind: 'metal', icon: 'greatsword', description: 'A blade as tall as its wielder.', stats: { damage: d(2, 6, 3), attackApCost: 7, armorPierce: 2, twoHanded: true, strength: 6 } },
  { id: 'halberd', name: 'Halberd', slot: 'mainHand', kind: 'metal', icon: 'halberd', description: 'An axe on a pole, to reach over a shield.', stats: { damage: d(1, 12, 3), attackApCost: 7, attackRange: 2, armorPierce: 2, twoHanded: true, reach: true, strength: 6 } },
  { id: 'bow', name: 'Bow', slot: 'mainHand', kind: 'wood', icon: 'bow', description: 'Strikes from across the field.', stats: { damage: d(1, 6), attackApCost: 4, attackRange: 5, twoHanded: true } },
  { id: 'longbow', name: 'Longbow', slot: 'mainHand', kind: 'wood', icon: 'longbow', description: 'Reaches further, for a strong draw.', stats: { damage: d(1, 8), attackApCost: 5, attackRange: 7, twoHanded: true, strength: 5 } },
  { id: 'crossbow', name: 'Crossbow', slot: 'mainHand', kind: 'wood', icon: 'crossbow', description: 'Slow to load; its bolts punch through armour.', stats: { damage: d(1, 10), attackApCost: 6, attackRange: 5, armorPierce: 2, twoHanded: true, rangedPierce: true } },
  {
    id: 'wand',
    name: 'Wand',
    slot: 'mainHand',
    kind: 'wood',
    icon: 'wand',
    description: 'Spits stinging sparks.',
    stats: { damage: d(1, 6), attackApCost: 5, attackRange: 4, skill: 'magic' },
    tier1: { id: 'spark_wand', name: 'Wand of Sparks' },
  },
  {
    id: 'staff',
    name: 'Staff',
    slot: 'mainHand',
    kind: 'wood',
    icon: 'staff',
    description: "A caster's walking staff, and a club at need.",
    stats: { damage: d(1, 6, 1), attackApCost: 5, twoHanded: true, skill: 'magic', spellSkill: 5, maxMana: 4 },
    tier1: { id: 'ash_staff', name: 'Ash Staff' },
  },
  { id: 'buckler', name: 'Buckler', slot: 'offHand', kind: 'metal', icon: 'buckler', description: 'A small round shield.', stats: { acBonus: 6 } },
  {
    id: 'shield',
    name: 'Shield',
    slot: 'offHand',
    kind: 'wood',
    icon: 'shield',
    description: 'Iron-banded oak shield.',
    stats: { acBonus: 10 },
    tier1: { id: 'oak_shield', name: 'Oak Shield' },
  },
  { id: 'tower_shield', name: 'Tower Shield', slot: 'offHand', kind: 'metal', icon: 'tower_shield', description: 'A wall to hide behind, heavy to carry.', stats: { acBonus: 16, resistance: 1, apPenalty: 1, strength: 6 } },
  { id: 'robe', name: 'Robe', slot: 'armor', kind: 'cloth', icon: 'robe', description: 'Stitched with sigils that steady a spell.', stats: { maxMana: 6, spellSkill: 5 } },
  {
    id: 'leather',
    name: 'Leather',
    slot: 'armor',
    kind: 'hide',
    icon: 'leather',
    description: 'Supple, and light on the move.',
    stats: { acBonus: 12, resistance: 1 },
    tier1: { id: 'leather_armor', name: 'Leather Armor' },
  },
  { id: 'breastplate', name: 'Breastplate', slot: 'armor', kind: 'metal', icon: 'armor', description: 'Sturdy plate armor.', stats: { acBonus: 10, resistance: 2, spellSkill: -5, strength: 3 } },
  { id: 'plate', name: 'Plate', slot: 'armor', kind: 'metal', icon: 'plate', description: 'Head to toe in steel plates.', stats: { acBonus: 6, resistance: 4, apPenalty: 1, spellSkill: -15, strength: 6 } },
  { id: 'cap', name: 'Cap', slot: 'head', kind: 'hide', icon: 'cap', description: 'A padded leather cap.', stats: { acBonus: 3 } },
  { id: 'helm', name: 'Helm', slot: 'head', kind: 'metal', icon: 'helm', description: 'A close helm.', stats: { acBonus: 2, resistance: 1, spellSkill: -5, strength: 4 } },
  { id: 'gloves', name: 'Gloves', slot: 'gloves', kind: 'hide', icon: 'gloves', description: 'A sure grip.', stats: { toHit: 2 } },
  { id: 'gauntlets', name: 'Gauntlets', slot: 'gloves', kind: 'metal', icon: 'gauntlets', description: 'Plated gloves.', stats: { resistance: 1, spellSkill: -5, strength: 4 } },
  { id: 'boots', name: 'Boots', slot: 'boots', kind: 'hide', icon: 'boots', description: 'Sturdy boots for the road.', stats: { acBonus: 3 } },
  { id: 'greaves', name: 'Greaves', slot: 'boots', kind: 'metal', icon: 'greaves', description: 'Plates to guard the shins.', stats: { resistance: 1, strength: 4 } },
]

/**
 * What a tier adds over tier 1, by gear class (gear-and-runes §4.2). A number
 * adds to its field (a missing field counting 0), and a damage roll's `bonus`
 * to the damage bonus. A tier never changes attack AP, range, two-handedness
 * or a penalty; it touches piercing only as a weapon's tiers 4 and 5 add
 * `armorPierce` 1, and strength and spell skill only through its material's
 * relief (`tierStats`).
 */
export const TIER_BONUS: Record<GearClass, Record<Tier, ItemStats>> = {
  weapon: {
    1: {},
    2: { damage: d(0, 0, 2) },
    3: { damage: d(0, 0, 4), toHit: 5 },
    4: { damage: d(0, 0, 6), toHit: 5, armorPierce: 1 },
    5: { damage: d(0, 0, 8), toHit: 10, armorPierce: 1 },
  },
  shield: { 1: {}, 2: { acBonus: 2 }, 3: { acBonus: 4 }, 4: { acBonus: 6, resistance: 1 }, 5: { acBonus: 8, resistance: 1 } },
  armour: {
    1: {},
    2: { acBonus: 2, resistance: 1 },
    3: { acBonus: 4, resistance: 1 },
    4: { acBonus: 6, resistance: 2 },
    5: { acBonus: 8, resistance: 3 },
  },
  small: { 1: {}, 2: { acBonus: 1 }, 3: { acBonus: 1 }, 4: { acBonus: 2 }, 5: { acBonus: 3 } },
}

/** Resistance a small-slot item adds at each tier, only in a family whose tier-1 stats have resistance (helm, gauntlets, greaves). */
export const SMALL_RESISTANCE: Record<Tier, number> = { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 }

/** Weapon in the main hand, shield in the off hand, armour on the body, and the small slots (head, gloves, boots). */
export function gearClass(slot: EquipmentSlot): GearClass {
  if (slot === 'mainHand') return 'weapon'
  if (slot === 'offHand') return 'shield'
  if (slot === 'armor') return 'armour'
  return 'small'
}

/** Old ids that resolve to a canonical one. */
export const LEGACY_ALIASES: Readonly<Record<string, string>> = { steel_armor: 'iron_breastplate' }

const FAMILY_BY_ID = new Map(FAMILIES.map((f) => [f.id, f]))

export function familyById(id: FamilyId): FamilyDef {
  return FAMILY_BY_ID.get(id)!
}

/**
 * `stats` in `material`: its tier's bonus for `cls` added (and, for a small-slot
 * family with resistance, `SMALL_RESISTANCE`), then the material's strength
 * relief taken off a strength asked (never below 0), and for a caster-friendly
 * material a spell-skill penalty halved toward 0. Tiers 1 and 2 carry neither
 * relief, so they give the tier bonus alone.
 */
export function tierStats(stats: ItemStats, cls: GearClass, material: MaterialDef): ItemStats {
  const out: ItemStats = { ...stats }
  const bonus: ItemStats = { ...TIER_BONUS[cls][material.tier] }
  if (cls === 'small' && stats.resistance && SMALL_RESISTANCE[material.tier]) bonus.resistance = SMALL_RESISTANCE[material.tier]
  for (const [key, value] of Object.entries(bonus) as [keyof ItemStats, unknown][]) {
    if (key === 'damage') {
      if (out.damage) out.damage = { ...out.damage, bonus: out.damage.bonus + (value as { bonus: number }).bonus }
    } else {
      ;(out as Record<string, unknown>)[key] = ((stats[key] as number | undefined) ?? 0) + (value as number)
    }
  }
  if (material.strengthRelief && out.strength) out.strength = Math.max(0, out.strength - material.strengthRelief)
  if (material.casterFriendly && out.spellSkill !== undefined && out.spellSkill < 0) out.spellSkill = Math.trunc(out.spellSkill / 2)
  return out
}
