import { describe, expect, it } from 'vitest'
import { offsetToHex } from '../grid/hex.ts'
import { gainXp } from '../character/progression.ts'
import { FIRST_PARTY_ID, FIRST_PARTY_NAME, newExpedition, presenceOf, presences } from './expedition.ts'
import { readyMadeParty } from './party.ts'

describe('an expedition', () => {
  it('starts idle where it is put, facing nothing, with empty baggage', () => {
    const members = readyMadeParty()
    const at = offsetToHex(12, 7)
    expect(newExpedition(members, at)).toEqual({
      id: FIRST_PARTY_ID,
      name: FIRST_PARTY_NAME,
      members,
      baggage: [],
      position: at,
      order: { kind: 'idle' },
      confronting: null,
    })
  })

  it('is seen by the world as where it stands and its members’ levels', () => {
    const members = readyMadeParty()
    gainXp(members[1], 10_000)
    const party = newExpedition(members, offsetToHex(3, 4))
    expect(presenceOf(party)).toEqual({ position: offsetToHex(3, 4), levels: members.map((m) => m.level) })
    expect(presenceOf(party).levels[1]).toBeGreaterThan(1)
  })

  it('gives the company’s presences in list order', () => {
    const a = newExpedition(readyMadeParty(), offsetToHex(1, 1))
    const b = { ...newExpedition(readyMadeParty().slice(0, 1), offsetToHex(20, 5)), id: 'party_2' }
    expect(presences([a, b])).toEqual([presenceOf(a), presenceOf(b)])
    expect(presences([])).toEqual([])
  })
})
