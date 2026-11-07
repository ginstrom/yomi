import type { Point } from './boardGeometry.ts'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Screen pixels a press may move and still be a click rather than a drag (the world map's pan, the inventory's drag). */
export const DRAG_THRESHOLD_PX = 6

/** True once `now` is more than `threshold` pixels, in a straight line, from `press`. */
export function pressMoved(press: Point, now: Point, threshold: number = DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(now.x - press.x, now.y - press.y) > threshold
}

/**
 * Where on screen to put the top-left corner of a map larger than its view, so
 * that `focus` (a point of the map, in map pixels) sits mid-view. The map's
 * edges stop at the view's: nothing beyond the map is scrolled into sight. A
 * map smaller than the view along an axis is centred along it instead.
 */
export function mapOrigin(focus: Point, map: { width: number; height: number }, view: Rect): Point {
  return clampOrigin({ x: view.x + view.width / 2 - focus.x, y: view.y + view.height / 2 - focus.y }, map, view)
}

/** Where a map dragged from `press` to `now` sits, having been at `originAtPress`: moved with the pointer, as far as its edges allow. */
export function pannedOrigin(originAtPress: Point, press: Point, now: Point, map: { width: number; height: number }, view: Rect): Point {
  return clampOrigin({ x: originAtPress.x + now.x - press.x, y: originAtPress.y + now.y - press.y }, map, view)
}

/**
 * Keeps a map's top-left corner where the map's edges stay at or beyond the
 * view's, or centres the map along an axis where it is smaller than the view.
 */
export function clampOrigin(origin: Point, map: { width: number; height: number }, view: Rect): Point {
  const along = (at: number, mapLength: number, viewStart: number, viewLength: number): number => {
    if (mapLength <= viewLength) return viewStart + (viewLength - mapLength) / 2
    return Math.min(viewStart, Math.max(viewStart + viewLength - mapLength, at))
  }
  // Whole pixels, so the pixel art and the hex edges stay crisp as the map scrolls.
  return {
    x: Math.round(along(origin.x, map.width, view.x, view.width)),
    y: Math.round(along(origin.y, map.height, view.y, view.height)),
  }
}

export function rectContains(rect: Rect, p: Point): boolean {
  return p.x >= rect.x && p.x < rect.x + rect.width && p.y >= rect.y && p.y < rect.y + rect.height
}
