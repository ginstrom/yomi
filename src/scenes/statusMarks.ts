/**
 * Where a battle nameplate's status letters sit: a row centred over the
 * unit's name, between its feet and the name, so that it never overlaps the
 * hit-point bar and stays inside the unit's own column, clear of the plates of
 * the units beside it. The letters never shrink below their own size on
 * screen however far the board is scaled down, as the foe panel and the
 * floating words do, and grow with it as it is scaled up, as the plate does.
 */

/** The letters' size on screen at the least, bold and outlined in black. */
export const STATUS_MARK_FONT_PX = 12
export const STATUS_MARK_STROKE_PX = 3
/** From one letter's centre to the next, on screen. */
export const STATUS_MARK_PITCH_PX = 10
/** How far over the name's top the letters' baseline sits, in the board's units. */
export const STATUS_MARK_LIFT = 1

/**
 * The scale that keeps the letters at least their own size on a board drawn
 * at `boardScale` (1 on a board drawn at its own size or larger), and each
 * letter's centre from the row's middle in the board's units, left to right.
 */
export function statusMarkLayout(count: number, boardScale: number): { scale: number; xs: number[] } {
  const scale = boardScale > 0 ? Math.max(1, 1 / boardScale) : 1
  const xs = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * STATUS_MARK_PITCH_PX * scale)
  return { scale, xs }
}
