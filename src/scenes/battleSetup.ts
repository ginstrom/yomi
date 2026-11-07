import type { EncounterId } from '../game/encounters.ts'
import type { MonsterLocation, WorldState } from '../game/worldMap.ts'

/** The battle fought when the scene is started with neither a monster location nor an encounter, as in tests. */
export const DEFAULT_ENCOUNTER: EncounterId = 'goblin_raid'

/** What `Battle` is asked to fight: a monster location's id, or else an encounter and threat (the debug console's `fight`). */
export interface BattleRequest {
  location?: string
  encounter?: EncounterId
  threat?: number
}

/** What the battle is: the monster location behind it, if any, and the encounter and threat to build it at. */
export interface BattleChoice {
  location: MonsterLocation | null
  encounter: EncounterId
  /** Undefined builds the encounter at its own default threat. */
  threat: number | undefined
}

/**
 * The battle a scene start asks for. A monster location decides it and the request's
 * encounter and threat are ignored; without one they are used, so a battle can be fought
 * with no location behind it, which clears none, takes no loot and is never saved mid-battle.
 */
export function chooseBattle(world: WorldState, request: BattleRequest | undefined): BattleChoice {
  const at = world.locations.find((l) => l.id === request?.location)
  const location = at?.kind === 'monsters' ? at : null
  return {
    location,
    encounter: location?.encounter ?? request?.encounter ?? DEFAULT_ENCOUNTER,
    threat: location?.threat ?? request?.threat,
  }
}
