import type { Equipment, ItemIcon } from '../inventory/inventory.ts'

/**
 * How a unit is put together from the sprite atlas (`assets/sprites/atlas.*`,
 * built by sprite-tool and loaded by BootScene): which sprites are laid over
 * its body for what it holds, and what their frames and animations are called.
 */
export const SPRITE_ATLAS = 'atlas'

/** The atlas's name for a sprite's frame, and for one of its animations. */
export function spriteFrame(sprite: string, frame: string): string {
  return `${sprite}/${frame}`
}

export const spriteAnim = spriteFrame

/** The animations a unit's sprites may have; the frame it rests on is the first of `idle`. */
export type UnitAnim = 'idle' | 'walk'
export const UNIT_REST_FRAME = 'idle_0'

/**
 * The sprite laid over a hero's body for an item in a hand, by the item's icon
 * (art/gear/); an item whose icon has none is held unseen.
 */
export const GEAR_SPRITES: Partial<Record<ItemIcon, string>> = {
  sword: 'gear_sword',
  sword_ember: 'gear_sword_ember',
  shortsword: 'gear_shortsword',
  greatsword: 'gear_greatsword',
  dagger: 'gear_dagger',
  axe: 'gear_axe',
  bow: 'gear_bow',
  bow_hawk: 'gear_bow_hawk',
  wand: 'gear_wand',
  wand_storm: 'gear_wand_storm',
  shield: 'gear_shield',
}

/** The sprites to lay over a body for what it holds, in drawing order: the weapon, then the off hand's. */
export function gearLayers(equipment: Equipment): string[] {
  const { mainHand, offHand } = equipment
  // A two-handed weapon leaves no hand for what the off hand's slot may still say.
  const held = [mainHand, mainHand?.stats?.twoHanded ? undefined : offHand]
  return held.flatMap((item) => (item && GEAR_SPRITES[item.icon]) ?? [])
}
