import type { FacilityId, FacilityView } from '../game/encampment.ts'
import type { Expedition } from '../game/expedition.ts'
import type { GameState } from '../game/gameState.ts'
import { homeParties } from '../game/guildHall.ts'
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
  builders_lodge: 'camp_lodge',
}

/** Where a facility not yet built is drawn: its plot, staked out. */
export const EMPTY_PLOT = 'camp_plot'

/** The atlas frame that shows `facility` as it stands. */
export function facilityFrame(facility: Pick<FacilityView, 'id' | 'level'>): string {
  return facility.level > 0 ? spriteFrame(FACILITY_SPRITES[facility.id], `level_${facility.level}`) : spriteFrame(EMPTY_PLOT, 'base')
}

/**
 * Where each plot's building stands, its bottom centre, in the screen's
 * frame (720 by 500), in the order `facilities` lists them: three columns,
 * each with a building across the back and, but for the middle one's, across
 * the front: guild hall and shrine at the front corners, trading post and
 * workshop at the back corners, the infirmary behind the middle and the
 * Builders' Lodge in front of it. The tents and the campfire stand in the gaps
 * between the columns (EncampmentScene). Buildings are drawn at
 * `BUILDING_SCALE`, small enough that no two overlap and every label, a line
 * or two, stays between its neighbours'.
 */
const PLOTS: readonly Point[] = [
  { x: 130, y: 308 },
  { x: 590, y: 308 },
  { x: 130, y: 178 },
  { x: 590, y: 178 },
  { x: 360, y: 178 },
  { x: 360, y: 308 },
]

export function plotAt(index: number): Point {
  return PLOTS[index] ?? PLOTS[PLOTS.length - 1]
}

/** The line under a facility's building: its name, and its level or that it is not built. */
export function facilityLabel(facility: Pick<FacilityView, 'name' | 'level' | 'maxLevel'>): string {
  return facility.level > 0 ? `${facility.name} ${facility.level}/${facility.maxLevel}` : `${facility.name}: empty plot`
}

/** "For: <name>." once more than one party is at home, to say which the encampment acts for; '' otherwise. */
export function actingFor(game: GameState, party: Expedition): string {
  return homeParties(game).length > 1 ? `For: ${party.name}.  ` : ''
}
