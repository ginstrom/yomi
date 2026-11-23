/** A unit's nameplate as it would stand: its name and its hex's centre in board pixels. */
export interface Plate {
  id: string
  name: string
  x: number
  y: number
}

/** The least room between two names side by side, in board pixels. */
export const PLATE_NAME_GAP = 6

/**
 * The name each plate shows: its unit's name, unless that would run into the
 * name of a unit beside it on the same row, where a name of more than one word
 * drops its first ("Freebooter Crossbowman" shows "Crossbowman"), as often as
 * it must and has words to spare. The log and the foe panel keep the full name.
 * `widthOf` measures a name as the plate draws it.
 */
export function plateNames(plates: readonly Plate[], widthOf: (name: string) => number): Map<string, string> {
  const shown = new Map(plates.map((p) => [p.id, p.name]))
  const shorten = (id: string) => {
    const words = shown.get(id)!.split(' ')
    if (words.length < 2) return false
    shown.set(id, words.slice(1).join(' '))
    return true
  }
  for (let changed = true; changed; ) {
    changed = false
    for (const [i, a] of plates.entries()) {
      for (const b of plates.slice(i + 1)) {
        if (Math.abs(a.y - b.y) >= 1) continue
        const room = Math.abs(a.x - b.x) - (widthOf(shown.get(a.id)!) + widthOf(shown.get(b.id)!)) / 2
        if (room >= PLATE_NAME_GAP) continue
        // Both shorten, so neither name alone reads as the band's.
        const one = shorten(a.id)
        const other = shorten(b.id)
        changed ||= one || other
      }
    }
  }
  return shown
}
