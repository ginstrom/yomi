import type { Item, ItemIcon } from '../inventory/inventory.ts'
import { RUNE_IDS, parseRuneKey, socketsOf, type RuneId } from '../inventory/runes.ts'

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

/** The texture key of each rune's icon; each is loaded from assets/sprites/<key>.png. */
export const RUNE_ICON_KEYS: Record<RuneId, string> = Object.fromEntries(
  RUNE_IDS.map((id) => [id, `icon_rune_${id}`]),
) as Record<RuneId, string>

/** The socket pips, drawn small under an item's icon: the filled one is drawn light, to take a rune's colour as a tint. */
export const SOCKET_PIP_KEYS = { empty: 'icon_socket_empty', filled: 'icon_socket_filled' } as const

/** Each rune's colour, for its filled pip's tint and its rows' text: light enough to tint a light pip and read on the panels' dark brown. */
export const RUNE_COLOURS: Record<RuneId, number> = {
  ember: 0xff8a3d,
  rime: 0x8fd4ff,
  storm: 0xffe14d,
  venom: 0x6fdc5a,
  acid: 0xc6e03c,
  stone: 0xb4b4b4,
  wind: 0x9eeedd,
  life: 0xff7a96,
  mind: 0xb68cff,
  dawn: 0xffe9a0,
}

/** An item's pips, socket by socket: the rune's id where one sits, null where empty; empty for an item with no sockets. */
export function socketPips(item: Item): Array<RuneId | null> {
  return Array.from({ length: socketsOf(item) }, (_, i) => {
    const key = item.runes?.[i]
    return key ? (parseRuneKey(key)?.id ?? null) : null
  })
}

/**
 * Where the pips of `count` sockets sit from the icon's centre, at `scale`: in a row centred under
 * the icon, near its bottom edge. A pip's drawing is 6 px wide with 4 of them showing, so a step of
 * 5 leaves 1 px (2 at 2x) between two.
 */
export function pipOffsets(count: number, scale: number): Array<{ x: number; y: number }> {
  const step = 5 * scale
  return Array.from({ length: count }, (_, i) => ({ x: (i - (count - 1) / 2) * step, y: 8.5 * scale }))
}
