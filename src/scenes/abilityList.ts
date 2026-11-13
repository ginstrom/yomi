import { deriveCombatStats, type Character } from '../character/character.ts'
import { knownSpells, nodeKind, perkTeaching, type NodeKind } from '../character/perks.ts'
import { SPELLS, spellApCost, type HeroSpellId } from '../combat/spells.ts'

/** One line of the Abilities tab: an active the hero knows. */
export interface AbilityRow {
  /** The spell this row is, for the world map's Cast button. */
  spell: HeroSpellId
  name: string
  /** What kind of node taught it. */
  kind: NodeKind
  /** Action points, with the hero's discounts. */
  ap: number
  /** Mana, or null for an at-will active. */
  mana: number | null
  /** Turns between uses (an ability's), or null for a spell. */
  recharge: number | null
}

/** The actives `character` knows, spells first (abilities join them with stage 2), in the order of `knownSpells`. */
export function abilityRows(character: Character): AbilityRow[] {
  const stats = deriveCombatStats(character)
  return knownSpells(character).map((spell) => {
    const teacher = perkTeaching(spell)
    return {
      spell,
      name: SPELLS[spell].name,
      kind: teacher ? nodeKind(teacher) : 'spell',
      ap: spellApCost(stats, spell),
      mana: SPELLS[spell].manaCost,
      recharge: null,
    }
  })
}
