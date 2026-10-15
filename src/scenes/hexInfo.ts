import { maxHp, type Character } from '../character/character.ts'
import { BLIGHT_NAMES, boardIndex, netInfluence } from '../game/blight.ts'
import { MAX_SHRINE_LEVEL } from '../game/buildings.ts'
import { MAX_GUILD_HALL_LEVEL } from '../game/guildHall.ts'
import { daysToFall, siteYield } from '../game/territory.ts'
import { UNEXPLORED } from '../game/vision.ts'
import { ENCAMPMENT_ID, locationAt, routeTo, type WorldState } from '../game/worldMap.ts'
import { hexEquals, type Hex } from '../grid/hex.ts'

/** What the world map's info panel says of a hex: a title and the lines under it. */
export interface HexInfo {
  title: string
  lines: string[]
}

/**
 * What the player knows of the hex under the pointer, for the world map's
 * info panel: what stands there, its blight as last seen (and, in sight,
 * whether the blight is gaining on it), the party if it is there, and how
 * many days' walk it is. Tells nothing the fog hides: a monster location only
 * once sighted, a town or resource only once its land is explored.
 */
export function hexInfo(world: WorldState, party: readonly Character[], visible: ReadonlySet<number>, at: Hex): HexInfo {
  const i = boardIndex(world.board, at)
  const seen = world.seen[i]
  const inSight = visible.has(i)
  const lines: string[] = []
  let title = seen === UNEXPLORED ? 'Unexplored' : 'Open land'

  const location = locationAt(world, at)
  const known = location && (location.kind === 'monsters' ? world.sighted.includes(location.id) : seen !== UNEXPLORED)
  const tower = world.towers.find((t) => hexEquals(t.position, at))
  if (location && known) {
    title = location.name
    if (location.kind === 'monsters') {
      if (location.source) lines.push('The Source of the blight: beat it to win.')
      lines.push(`Monsters, threat ${location.threat}: foes of level ${location.threat}.`)
    } else {
      const held = world.held.includes(location.id)
      lines.push(`${location.id === ENCAMPMENT_ID ? 'Your encampment' : location.kind === 'town' ? 'Town' : 'Resource'}, ${held ? 'held' : 'not held'}.`)
      if (location.id === ENCAMPMENT_ID) {
        lines.push(`Guild hall level ${world.guildHall}/${MAX_GUILD_HALL_LEVEL}, shrine ${world.shrine}/${MAX_SHRINE_LEVEL}.`)
      } else {
        const { material, amount } = siteYield(world, location)
        lines.push(`Yields ${amount} ${material}${held ? '' : ' once held'}${world.outposts.includes(location.id) ? ', with an outpost' : ''}.`)
      }
      if (held && world.threatened.includes(location.id)) lines.push(fallsIn(world, party, location.position))
    }
  } else if (tower) {
    title = 'Watchtower'
    if (world.threatened.includes(tower.id)) lines.push(fallsIn(world, party, tower.position))
  }

  if (seen !== UNEXPLORED) {
    lines.push(`Blight: ${BLIGHT_NAMES[seen]}${inSight ? '' : ' (as last seen)'}.`)
    if (inSight) {
      const net = netInfluence(world, party, at)
      if (net > 0) lines.push('The blight is gaining here.')
      else if (net < 0 && seen > 0) lines.push('The blight is receding here.')
    } else {
      lines.push('Out of sight.')
    }
  }

  if (hexEquals(at, world.party)) {
    lines.push('Your party:')
    for (const member of party) lines.push(`  ${member.name}, level ${member.level}, ${member.hp}/${maxHp(member)} hp`)
  } else {
    const route = routeTo(world, at)
    if (route) lines.push(`${route.length} ${route.length === 1 ? 'day' : 'days'} away.`)
  }
  return { title, lines }
}

function fallsIn(world: WorldState, party: readonly Character[], at: Hex): string {
  const days = daysToFall(world, party, { position: at })
  return days === null ? 'Under threat.' : `Under threat: falls in ${days} ${days === 1 ? 'day' : 'days'}.`
}
