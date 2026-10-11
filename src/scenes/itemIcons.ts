import type { ItemIcon } from '../inventory/inventory.ts'

/** The texture key of each item icon; each is loaded from assets/sprites/<key>.png. */
export const ITEM_ICON_KEYS: Record<ItemIcon, string> = {
  sword: 'icon_sword',
  shield: 'icon_shield',
  armor: 'icon_armor',
}

/** How much an icon is enlarged; the `icon` canvas class in art/sprite-tool.toml is drawn for this. */
export const ITEM_ICON_SCALE = 2
