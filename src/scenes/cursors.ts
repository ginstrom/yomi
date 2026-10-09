/** Two crossed swords, hotspot at the crossing; `faded` greys them out for an attack the AP can't cover. */
function swordsCursor(faded: boolean): string {
  const blade = faded ? '#9e9e9e' : '#eceff1'
  const guard = faded ? '#757575' : '#ffca28'
  const grip = faded ? '#616161' : '#8d6e63'
  // Each sword: blade from its tip at a top corner, then the crossguard, then the grip at the far bottom corner.
  const sword = (x1: number, x2: number, guardA: number, guardB: number, grip1: number, grip2: number) =>
    [
      `<line x1='${x1}' y1='3' x2='${x2}' y2='22' stroke='${blade}'/>`,
      `<line x1='${guardA}' y1='18' x2='${guardB}' y2='26' stroke='${guard}'/>`,
      `<line x1='${grip1}' y1='24' x2='${grip2}' y2='29' stroke='${grip}'/>`,
    ].join('')
  const swords = sword(3, 22, 26, 18, 24, 29) + sword(29, 10, 6, 14, 8, 3)
  const outline = swords.replace(/stroke='[^']*'/g, "stroke='#000'")
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' opacity='${faded ? 0.55 : 1}'>` +
    `<g stroke-width='5' stroke-linecap='round'>${outline}</g>` +
    `<g stroke-width='3' stroke-linecap='round'>${swords}</g>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, crosshair`
}

/** CSS cursors for the battle board. */
export const CURSORS = {
  /** Over a hex the selected unit can move to, or anywhere with nothing to do. */
  move: 'default',
  /** Over a unit of the player's that can be selected. */
  select: 'pointer',
  attack: swordsCursor(false),
  attackDisabled: swordsCursor(true),
} as const
