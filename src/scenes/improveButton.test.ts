import { describe, expect, it } from 'vitest'
import { newGame } from '../game/gameState.ts'
import { readyMadeParty } from '../game/party.ts'
import { ENCAMPMENT_ID } from '../game/worldMap.ts'
import { improveLabel } from './improveButton.ts'

function at(id: string, level = 0, lodge = 0) {
  const game = newGame(readyMadeParty(), null, 1)
  const { world } = game
  const party = game.parties[0]
  if (!world.held.includes(id)) world.held.push(id)
  party.position = world.locations.find((l) => l.id === id)!.position
  if (level > 0) world.improvements[id] = level as 1 | 2 | 3
  world.lodge = lodge
  return { world, party }
}

describe('improveLabel', () => {
  it('names the next level and its cost, and where the Lodge is too low says so', () => {
    const a = at('iron_vein')
    expect(improveLabel(a.world, a.party)).toBe('Build an Outpost: 15 gold, 10 timber')
    expect(improveLabel(at('iron_vein', 1).world, at('iron_vein', 1).party)).toBe("A Mine needs the Builders' Lodge")
    const works = at('iron_vein', 1, 1)
    expect(improveLabel(works.world, works.party)).toBe('Build a Mine: 30 gold, 15 stone')
    const fort = at('iron_vein', 2, 1)
    expect(improveLabel(fort.world, fort.party)).toBe("A Fort needs the Builders' Lodge at level 2")
    const built = at('iron_vein', 2, 2)
    expect(improveLabel(built.world, built.party)).toBe('Build a Fort: 50 gold, 20 iron, 10 stone')
    const peat = at('peat_bog', 1, 1)
    expect(improveLabel(peat.world, peat.party)).toBe('Build Peat Cuttings: 30 gold, 15 stone')
  })

  it('has a compact form without the cost', () => {
    const works = at('iron_vein', 1, 1)
    expect(improveLabel(works.world, works.party, true)).toBe('Build a Mine')
    const fort = at('iron_vein', 2, 1)
    expect(improveLabel(fort.world, fort.party, true)).toBe('A Fort needs Lodge 2')
  })

  it('shows no button off a held resource, at the encampment, among monsters or at a fort', () => {
    const a = at('iron_vein')
    a.world.held = a.world.held.filter((id) => id !== 'iron_vein')
    expect(improveLabel(a.world, a.party)).toBeNull()
    const home = at(ENCAMPMENT_ID)
    expect(improveLabel(home.world, home.party)).toBeNull()
    const among = at('iron_vein')
    among.party.position = among.world.locations.find((l) => l.kind === 'monsters')!.position
    expect(improveLabel(among.world, among.party)).toBeNull()
    const fort = at('iron_vein', 3, 2)
    expect(improveLabel(fort.world, fort.party)).toBeNull()
  })
})
