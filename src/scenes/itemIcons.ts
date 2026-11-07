import type { Item, ItemIcon } from '../inventory/inventory.ts'

/** The texture key of each item icon; each is loaded from assets/sprites/<key>.png. */
export const ITEM_ICON_KEYS: Record<ItemIcon, string> = {
  sword: 'icon_sword',
  shortsword: 'icon_shortsword',
  greatsword: 'icon_greatsword',
  dagger: 'icon_dagger',
  axe: 'icon_axe',
  bow: 'icon_bow',
  shield: 'icon_shield',
  armor: 'icon_armor',
  wand: 'icon_wand',
  ring: 'icon_ring',
  amulet: 'icon_amulet',
  circlet: 'icon_circlet',
  cloak: 'icon_cloak',
  wand_storm: 'icon_wand_storm',
  sword_ember: 'icon_sword_ember',
  bow_hawk: 'icon_bow_hawk',
  ring_fortune: 'icon_ring_fortune',
  rapier: 'icon_rapier',
  mace: 'icon_mace',
  spear: 'icon_spear',
  war_hammer: 'icon_war_hammer',
  halberd: 'icon_halberd',
  longbow: 'icon_longbow',
  crossbow: 'icon_crossbow',
  staff: 'icon_staff',
  buckler: 'icon_buckler',
  tower_shield: 'icon_tower_shield',
  robe: 'icon_robe',
  leather: 'icon_leather',
  plate: 'icon_plate',
  cap: 'icon_cap',
  helm: 'icon_helm',
  gloves: 'icon_gloves',
  gauntlets: 'icon_gauntlets',
  boots: 'icon_boots',
  greaves: 'icon_greaves',
}

/** How much an icon is enlarged; the `icon` canvas class in art/sprite-tool.toml is drawn for this. */
export const ITEM_ICON_SCALE = 2

/**
 * A tier-2 material's tint over its family's icon, by material id; tier 1 is
 * drawn untinted. Kept pale, as a tint multiplies the icon's colours and a
 * dark one muddies the metal.
 */
export const MATERIAL_TINTS: Readonly<Record<string, number>> = {
  steel: 0xc8d8f0,
  ironwood: 0xd8c8b8,
  wolfhide: 0xd0d0d0,
  silk: 0xe8d8f8,
}

/** The tint to draw `item`'s icon with: its material's at tier 2, else none. */
export function iconTint(item: Item): number | undefined {
  return item.tier === 2 && item.material !== undefined ? MATERIAL_TINTS[item.material] : undefined
}
