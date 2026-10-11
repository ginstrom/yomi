/**
 * The preset faces a character can wear, in the order a chooser would offer
 * them. A portrait is only looks: nothing a character does depends on it. The
 * scenes load each from assets/sprites/portrait_<id>.png (see
 * src/scenes/partyPanel.ts), drawn in art/portraits/.
 */
export const PORTRAIT_IDS = [
  'knight',
  'ranger',
  'rogue',
  'wizard',
  'dwarf',
  'priestess',
  'barbarian',
  'squire',
] as const

export type PortraitId = (typeof PORTRAIT_IDS)[number]
