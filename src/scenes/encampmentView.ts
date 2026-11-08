import type { FacilityId, FacilityView } from '../game/encampment.ts'
import type { Point } from './boardGeometry.ts'
import { spriteFrame } from './unitLook.ts'

/**
 * Where the encampment screen draws each facility and with which frame: a
 * facility not built yet is an empty plot, and a built one the frame of its
 * level, so the picture grows as the encampment does. A new facility needs a
 * sprite here, `level_1` and up, and a plot.
 */

/** The atlas sprite of each facility, whose frames are named `level_<n>`. */
export const FACILITY_SPRITES: Record<FacilityId, string> = {
  guild_hall: 'camp_guild_hall',
  shrine: 'camp_shrine',
  trading_post: 'camp_trading_post',
  workshop: 'camp_workshop',
  infirmary: 'camp_infirmary',
}

/** Where a facility not yet built is drawn: its plot, staked out. */
export const EMPTY_PLOT = 'camp_plot'

/** The highest level the atlas draws of a facility, where it has fewer frames than levels (the guild hall's 4 and 5 wait for their sprites). */
const DRAWN_LEVELS: Partial<Record<FacilityId, number>> = { guild_hall: 3 }

/** The atlas frame that shows `facility` as it stands. */
export function facilityFrame(facility: Pick<FacilityView, 'id' | 'level'>): string {
  const drawn = Math.min(facility.level, DRAWN_LEVELS[facility.id] ?? facility.level)
  return facility.level > 0 ? spriteFrame(FACILITY_SPRITES[facility.id], `level_${drawn}`) : spriteFrame(EMPTY_PLOT, 'base')
}

/**
 * Where each plot's building stands, its bottom centre, in the screen's
 * frame (720 by 500), in the order `facilities` lists them: two across the
 * front of the clearing, either side of the campfire, then three along the
 * back, the middle one behind the fire, the tents between them.
 */
const PLOTS: readonly Point[] = [
  { x: 230, y: 312 },
  { x: 500, y: 312 },
  { x: 120, y: 236 },
  { x: 610, y: 236 },
  { x: 365, y: 222 },
]

export function plotAt(index: number): Point {
  return PLOTS[index] ?? PLOTS[PLOTS.length - 1]
}

/** The line under a facility's building: its name, and its level or that it is not built. */
export function facilityLabel(facility: Pick<FacilityView, 'name' | 'level' | 'maxLevel'>): string {
  return facility.level > 0 ? `${facility.name} ${facility.level}/${facility.maxLevel}` : `${facility.name}: empty plot`
}
