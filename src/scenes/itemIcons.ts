import type { ItemIcon } from '../inventory/inventory.ts'

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
}

/** How much an icon is enlarged; the `icon` canvas class in art/sprite-tool.toml is drawn for this. */
export const ITEM_ICON_SCALE = 2
