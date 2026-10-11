import type { Point } from './boardGeometry.ts'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Where on screen to put the top-left corner of a map larger than its view, so
 * that `focus` (a point of the map, in map pixels) sits mid-view. The map's
 * edges stop at the view's: nothing beyond the map is scrolled into sight. A
 * map smaller than the view along an axis is centred along it instead.
 */
export function mapOrigin(focus: Point, map: { width: number; height: number }, view: Rect): Point {
  const along = (at: number, mapLength: number, viewStart: number, viewLength: number): number => {
    if (mapLength <= viewLength) return viewStart + (viewLength - mapLength) / 2
    const centred = viewStart + viewLength / 2 - at
    return Math.min(viewStart, Math.max(viewStart + viewLength - mapLength, centred))
  }
  // Whole pixels, so the pixel art and the hex edges stay crisp as the map scrolls.
  return {
    x: Math.round(along(focus.x, map.width, view.x, view.width)),
    y: Math.round(along(focus.y, map.height, view.y, view.height)),
  }
}

export function rectContains(rect: Rect, p: Point): boolean {
  return p.x >= rect.x && p.x < rect.x + rect.width && p.y >= rect.y && p.y < rect.y + rect.height
}
