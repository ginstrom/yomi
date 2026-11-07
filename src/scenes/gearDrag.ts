import {
  dropEquipped,
  dropFromBackpack,
  equipFromBackpack,
  fitsSlot,
  isTwoHanded,
  pickUp,
  unequipToBackpack,
  type Character,
  type HpRule,
} from '../character/character.ts'
import { EQUIPMENT_SLOT_ORDER, type EquipmentSlot, type Item } from '../inventory/inventory.ts'

/**
 * What the character panel's drag and drop does: where an item is dragged
 * from, where it may be let go, and the change of gear that makes. Each move
 * is one of the changes a click already makes (`character.ts`), but for
 * equipping into the slot dropped on, so a ring may go on either hand.
 */

/** Where a drag starts. A ghosted off hand (a two-handed weapon's) stands for the main hand. */
export type DragSource =
  | { kind: 'equipment'; slot: EquipmentSlot }
  | { kind: 'backpack'; index: number }
  | { kind: 'ground'; index: number }

/** Where a drag ends: an equipment slot, or anywhere on the backpack's or the ground's grid. */
export type DropTarget = { kind: 'equipment'; slot: EquipmentSlot } | { kind: 'backpack' } | { kind: 'ground' }

/** The change of gear a drop makes. */
export type GearMove =
  | { kind: 'equip'; index: number; slot: EquipmentSlot }
  | { kind: 'unequip'; slot: EquipmentSlot }
  | { kind: 'dropBackpack'; index: number }
  | { kind: 'dropEquipped'; slot: EquipmentSlot }
  | { kind: 'pickUp'; index: number }
  | { kind: 'pickUpEquip'; index: number; slot: EquipmentSlot }

/** Every place a drag may end, in the order `validTargets` lists them. */
const ALL_TARGETS: readonly DropTarget[] = [
  ...EQUIPMENT_SLOT_ORDER.map((slot): DropTarget => ({ kind: 'equipment', slot })),
  { kind: 'backpack' },
  { kind: 'ground' },
]

/** The slot a worn item is really in: the main hand for the ghost of a two-handed weapon in the off hand. */
function heldIn(character: Character, slot: EquipmentSlot): EquipmentSlot {
  const { equipment } = character
  return slot === 'offHand' && !equipment.offHand && isTwoHanded(equipment.mainHand) ? 'mainHand' : slot
}

function itemAt(character: Character, ground: Item[], from: DragSource): Item | null {
  if (from.kind === 'equipment') return character.equipment[from.slot] ?? null
  if (from.kind === 'backpack') return character.backpack[from.index] ?? null
  return ground[from.index] ?? null
}

/**
 * The move that dragging the item at `from` onto `to` makes, or null when the
 * drop does nothing: the wrong slot, the place it came from, a slot to slot
 * move, an empty source, or a backpack too full to take the item.
 */
export function planDrag(character: Character, ground: Item[], from: DragSource, to: DropTarget): GearMove | null {
  const source: DragSource = from.kind === 'equipment' ? { kind: 'equipment', slot: heldIn(character, from.slot) } : from
  const item = itemAt(character, ground, source)
  if (!item) return null
  const hasSpace = character.backpack.includes(null)

  switch (source.kind) {
    case 'backpack':
      if (to.kind === 'equipment') return fitsSlot(item, to.slot) ? { kind: 'equip', index: source.index, slot: to.slot } : null
      return to.kind === 'ground' ? { kind: 'dropBackpack', index: source.index } : null
    case 'equipment':
      if (to.kind === 'backpack') return hasSpace ? { kind: 'unequip', slot: source.slot } : null
      return to.kind === 'ground' ? { kind: 'dropEquipped', slot: source.slot } : null
    case 'ground':
      if (!hasSpace) return null
      if (to.kind === 'equipment') {
        return fitsSlot(item, to.slot) ? { kind: 'pickUpEquip', index: source.index, slot: to.slot } : null
      }
      return to.kind === 'backpack' ? { kind: 'pickUp', index: source.index } : null
  }
}

/** Every place the item at `from` may be dropped to some effect: the slots and grids to outline while it is dragged. */
export function validTargets(character: Character, ground: Item[], from: DragSource): DropTarget[] {
  return ALL_TARGETS.filter((to) => planDrag(character, ground, from, to) !== null)
}

/**
 * Makes `move`, returning whether it did; a move that cannot be made changes nothing.
 * Hit points follow a changed maximum by `hpRule` (`clampHp`): 'cap' in battle.
 */
export function applyMove(character: Character, ground: Item[], move: GearMove, hpRule: HpRule = 'share'): boolean {
  switch (move.kind) {
    case 'equip':
      return equipFromBackpack(character, move.index, ground, move.slot, hpRule)
    case 'unequip':
      return unequipToBackpack(character, move.slot, hpRule)
    case 'dropBackpack':
      return dropFromBackpack(character, move.index, ground)
    case 'dropEquipped':
      return dropEquipped(character, move.slot, ground, hpRule)
    case 'pickUp':
      return pickUp(character, ground, move.index)
    case 'pickUpEquip': {
      // Checked first, so that an item that will not go on is not picked up either.
      const item = ground[move.index]
      const space = character.backpack.indexOf(null)
      if (!item || space === -1 || !fitsSlot(item, move.slot)) return false
      pickUp(character, ground, move.index)
      return equipFromBackpack(character, space, ground, move.slot, hpRule)
    }
  }
}
