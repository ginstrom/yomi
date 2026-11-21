import { hexEquals, type Hex } from '../grid/hex.ts'
import { blightAt, type WorldEvent } from './blight.ts'
import type { PartyPresence } from './expedition.ts'
import { LOSS_LEVEL } from './territory.ts'
import { encampmentName, type PartnerLocation, type WorldState } from './worldMap.ts'

/**
 * Trade (docs/designs/long-campaign/stage-08-trade-routes.md): the trade
 * partners, neutral settlements on the map (`PartnerLocation`), and from
 * stage 8's step 02 the routes the trading post opens to them. A partner is
 * contacted by a party standing on its hex at the end of a day, for good; it
 * falls silent while its land is at `LOSS_LEVEL` or worse and wakes when the
 * land is clean. Every partner is a clean source of `PARTNER_STRENGTH`
 * (blight.ts), silent or not, and is never held, never yields and is never
 * lost. Phaser-free; `updateTerritory` calls `partnerDay` once a world turn.
 *
 * This module imports blight.ts, territory.ts and worldMap.ts, and
 * territory.ts imports it back: safe while nothing calls across as the
 * modules load.
 */

/** An open trade route (stage 8 step 02): a fixed road from the encampment to a contacted partner. */
export interface TradeRoute {
  /** `route_<partner id>`. */
  id: string
  partner: string
  /** The road's hexes, the encampment's excluded and the partner's included; fixed when the route opened. */
  road: Hex[]
  /** The world turn it opened. */
  opened: number
  /** Raided yield days in a row. */
  raidedDays: number
}

/** The trade partners on the map, in locations order. */
export function partners(world: WorldState): PartnerLocation[] {
  return world.locations.filter((l): l is PartnerLocation => l.kind === 'partner')
}

export function partnerById(world: WorldState, id: string): PartnerLocation | null {
  return partners(world).find((p) => p.id === id) ?? null
}

export function isContacted(world: WorldState, id: string): boolean {
  return world.contacted.includes(id)
}

export function isSilent(world: WorldState, id: string): boolean {
  return world.silent.includes(id)
}

/** Contacts the partner: `partner_contacted`, or null when `id` is no partner or is contacted already. */
export function contactPartner(world: WorldState, id: string): WorldEvent | null {
  const partner = partnerById(world, id)
  if (!partner || isContacted(world, id)) return null
  world.contacted.push(id)
  return { type: 'partner_contacted', partner: id, name: partner.name, home: encampmentName(world) }
}

/**
 * The partners' day, after the territory's yields: first every partner with a
 * presence on its hex is contacted (in locations order), then each partner
 * whose hex has reached `LOSS_LEVEL` falls silent and each silent one whose
 * hex is clean wakes. Silence is kept for every partner, and told
 * (`partner_silent`, `partner_restored`) only for contacted ones.
 */
export function partnerDay(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[] {
  const events: WorldEvent[] = []
  const all = partners(world)
  for (const partner of all) {
    if (!presences.some((p) => hexEquals(p.position, partner.position))) continue
    const contact = contactPartner(world, partner.id)
    if (contact) events.push(contact)
  }
  for (const partner of all) {
    const level = blightAt(world, partner.position)
    const told = isContacted(world, partner.id)
    if (!isSilent(world, partner.id) && level >= LOSS_LEVEL) {
      world.silent.push(partner.id)
      if (told) events.push({ type: 'partner_silent', partner: partner.id, name: partner.name })
    } else if (isSilent(world, partner.id) && level === 0) {
      world.silent = world.silent.filter((id) => id !== partner.id)
      if (told) events.push({ type: 'partner_restored', partner: partner.id, name: partner.name })
    }
  }
  return events
}
