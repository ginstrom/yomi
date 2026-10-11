import type { PortraitId } from '../character/portraits.ts'
import type { Rect } from './mapScroll.ts'

/**
 * The party's column: a portrait for each member down the left of the world
 * map and the battle, and of the character panel lying over either, in the
 * same place on all three so the portraits seem to stay put under the panel.
 */

/** Below the header lines of the world map and the battle, where the column starts. */
export const HEADER_BOTTOM = 64
/** The column's width; the map, the board and the character panel keep to the right of it. */
export const PARTY_PANEL_W = 80
/** How much a portrait is enlarged; the `portrait` canvas class in art/sprite-tool.toml is drawn for this. */
export const PORTRAIT_SCALE = 2
/** A portrait's side on screen, in pixels. */
export const PORTRAIT_SIZE = 64
/** The hit point bar under each portrait. */
export const PORTRAIT_BAR_H = 8
const PORTRAIT_BAR_GAP = 2
const PORTRAIT_MARGIN = 8
/** From one portrait's top to the next: a full party of six fits the least window (MIN_GAME_SIZE in main.ts). */
const PORTRAIT_PITCH = PORTRAIT_SIZE + PORTRAIT_BAR_GAP + PORTRAIT_BAR_H + 6

/** A portrait's texture key; each is loaded from assets/sprites/<key>.png. */
export function portraitKey(id: PortraitId): string {
  return `portrait_${id}`
}

/** Where the `index`th member's portrait is on screen. */
export function portraitRect(index: number): Rect {
  return {
    x: (PARTY_PANEL_W - PORTRAIT_SIZE) / 2,
    y: HEADER_BOTTOM + PORTRAIT_MARGIN + index * PORTRAIT_PITCH,
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
  }
}

/** Where the `index`th member's hit point bar is on screen, under its portrait. */
export function portraitBarRect(index: number): Rect {
  const { x, y, width, height } = portraitRect(index)
  return { x, y: y + height + PORTRAIT_BAR_GAP, width, height: PORTRAIT_BAR_H }
}

/** How low the column reaches for a party of `count`. */
export function partyColumnBottom(count: number): number {
  if (count === 0) return HEADER_BOTTOM
  const bar = portraitBarRect(count - 1)
  return bar.y + bar.height + PORTRAIT_MARGIN
}

/**
 * What a click on the `index`th portrait does where the `active` member is the
 * one marked: the first click on a member makes it the active one, and a click
 * on the active member opens its panel. A member that cannot be made active
 * (in battle, one with nothing left to do) has its panel opened at once.
 */
export function portraitClick(index: number, active: number | null, canActivate = true): 'activate' | 'open' {
  return index !== active && canActivate ? 'activate' : 'open'
}
