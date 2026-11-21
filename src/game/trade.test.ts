import { describe, expect, it } from 'vitest'
import { boardIndex } from './blight.ts'
import type { PartyPresence } from './expedition.ts'
import { newGame } from './gameState.ts'
import { readyMadeParty } from './party.ts'
import { LOSS_LEVEL, updateTerritory } from './territory.ts'
import { contactPartner, isContacted, isSilent, partnerById, partnerDay, partners } from './trade.ts'
import { ENCAMPMENT_ID, isNotable, newWorld, passTurn, type WorldState } from './worldMap.ts'

const at = (world: WorldState, id: string): PartyPresence => ({ position: { ...partnerById(world, id)!.position }, levels: [1, 1, 1] })
const setLevel = (world: WorldState, id: string, level: number) => (world.blight[boardIndex(world.board, partnerById(world, id)!.position)] = level)

describe('the trade partners', () => {
  it('are read in locations order, by id', () => {
    const world = newWorld(1)
    expect(partners(world).map((p) => [p.id, p.good])).toEqual([['millbrook', 'timber'], ['saltmere', 'salt']])
    expect(partnerById(world, 'saltmere')?.name).toBe('Saltmere')
    expect(partnerById(world, 'iron_vein')).toBeNull()
    expect(partnerById(world, 'nowhere')).toBeNull()
  })

  it('start uncontacted and, on tainted land, not silent', () => {
    const world = newWorld(1)
    for (const p of partners(world)) {
      expect(isContacted(world, p.id)).toBe(false)
      expect(isSilent(world, p.id)).toBe(false)
    }
  })
})

describe('contact (economy A4)', () => {
  it('comes on the day a party stands on the partner, once', () => {
    const game = newGame(readyMadeParty(), null, 1)
    const { world } = game
    game.parties[0].position = { ...partnerById(world, 'millbrook')!.position }
    const first = passTurn(world, [{ position: game.parties[0].position, levels: [1, 1, 1] }])
    expect(first.filter((e) => e.type === 'partner_contacted')).toEqual([
      { type: 'partner_contacted', partner: 'millbrook', name: 'Millbrook', home: 'Oakvale' },
    ])
    expect(isContacted(world, 'millbrook')).toBe(true)
    const second = passTurn(world, [{ position: game.parties[0].position, levels: [1, 1, 1] }])
    expect(second.some((e) => e.type === 'partner_contacted')).toBe(false)
  })

  it('names the encampment as the player called it', () => {
    const world = newWorld(1, 'Hearthold')
    expect(contactPartner(world, 'saltmere')).toEqual({ type: 'partner_contacted', partner: 'saltmere', name: 'Saltmere', home: 'Hearthold' })
  })

  it('is refused (null) for a location that is no partner, and for a partner contacted already', () => {
    const world = newWorld(1)
    expect(contactPartner(world, ENCAMPMENT_ID)).toBeNull()
    expect(contactPartner(world, 'nowhere')).toBeNull()
    expect(contactPartner(world, 'millbrook')).not.toBeNull()
    expect(contactPartner(world, 'millbrook')).toBeNull()
    expect(world.contacted).toEqual(['millbrook'])
  })

  it('keeps the order contacted', () => {
    const world = newWorld(1)
    contactPartner(world, 'saltmere')
    partnerDay(world, [at(world, 'millbrook')])
    expect(world.contacted).toEqual(['saltmere', 'millbrook'])
  })

  it('comes after the day\'s other territory events, in locations order', () => {
    const world = newWorld(1)
    world.turn = 5
    const events = updateTerritory(world, [at(world, 'saltmere'), at(world, 'millbrook')])
    const contacts = events.filter((e) => e.type === 'partner_contacted')
    expect(contacts.map((e) => e.type === 'partner_contacted' && e.partner)).toEqual(['millbrook', 'saltmere'])
    expect(events.slice(-2)).toEqual(contacts)
  })
})

describe('silence', () => {
  it('falls on a contacted partner at LOSS_LEVEL, holds at 1 and lifts at 0, told each way', () => {
    const world = newWorld(1)
    contactPartner(world, 'millbrook')
    setLevel(world, 'millbrook', LOSS_LEVEL)
    expect(partnerDay(world, [])).toEqual([{ type: 'partner_silent', partner: 'millbrook', name: 'Millbrook' }])
    expect(isSilent(world, 'millbrook')).toBe(true)
    expect(partnerDay(world, [])).toEqual([])
    setLevel(world, 'millbrook', 1)
    expect(partnerDay(world, [])).toEqual([])
    expect(isSilent(world, 'millbrook')).toBe(true)
    setLevel(world, 'millbrook', 0)
    expect(partnerDay(world, [])).toEqual([{ type: 'partner_restored', partner: 'millbrook', name: 'Millbrook' }])
    expect(isSilent(world, 'millbrook')).toBe(false)
  })

  it('is kept, untold, for a partner not contacted', () => {
    const world = newWorld(1)
    setLevel(world, 'saltmere', 3)
    expect(partnerDay(world, [])).toEqual([])
    expect(world.silent).toEqual(['saltmere'])
    setLevel(world, 'saltmere', 0)
    expect(partnerDay(world, [])).toEqual([])
    expect(world.silent).toEqual([])
  })

  it('is told after contact when a partner is contacted on the day it falls silent', () => {
    const world = newWorld(1)
    setLevel(world, 'millbrook', LOSS_LEVEL)
    expect(partnerDay(world, [at(world, 'millbrook')]).map((e) => e.type)).toEqual(['partner_contacted', 'partner_silent'])
  })

  it('stops a journey (notable); contact and waking do not', () => {
    const world = newWorld(1)
    expect(isNotable(world, { type: 'partner_silent', partner: 'millbrook', name: 'Millbrook' }, [])).toBe(true)
    expect(isNotable(world, { type: 'partner_contacted', partner: 'millbrook', name: 'Millbrook', home: 'Oakvale' }, [])).toBe(false)
    expect(isNotable(world, { type: 'partner_restored', partner: 'millbrook', name: 'Millbrook' }, [])).toBe(false)
  })
})
