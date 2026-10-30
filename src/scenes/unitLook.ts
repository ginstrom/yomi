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

/** The gear sprites a strike swings: blades and axes, not a bow, a wand or a shield. */
export const SWUNG_GEAR: ReadonlySet<string> = new Set([
  'gear_sword',
  'gear_sword_ember',
  'gear_shortsword',
  'gear_greatsword',
  'gear_dagger',
  'gear_axe',
])

/** The point a held weapon is gripped at, and turns about when it swings: the warrior's fist. */
export const GRIP_POINT = 'grip'

/** The point a shot or a spell is aimed at and flies from: the middle of a unit's body. */
export const CHEST_POINT = 'chest'

/** What sprite-tool writes on each frame of the atlas, which Phaser keeps as the frame's `customData`. */
interface AtlasFrameData {
  pivot?: { x: number; y: number }
  sourceSize?: { w: number; h: number }
  /** The sprite's named points (`[points]` in its source), each the centre of a pixel, from the canvas's top left. */
  points?: Record<string, [number, number]>
}

/**
 * Where a frame's named point is, from its anchor (a unit's feet), in canvas
 * pixels; null when the frame has no such point. `frameData` is an atlas
 * frame's `customData`.
 */
export function pointFromAnchor(frameData: unknown, name: string): { x: number; y: number } | null {
  const { pivot, sourceSize, points } = (frameData ?? {}) as AtlasFrameData
  const point = points?.[name]
  if (!point || !pivot || !sourceSize) return null
  return { x: point[0] - pivot.x * sourceSize.w, y: point[1] - pivot.y * sourceSize.h }
}

/** The sprites to lay over a body for what it holds, in drawing order: the weapon, then the off hand's. */
export function gearLayers(equipment: Equipment): string[] {
  const { mainHand, offHand } = equipment
  // A two-handed weapon leaves no hand for what the off hand's slot may still say.
  const held = [mainHand, mainHand?.stats?.twoHanded ? undefined : offHand]
  return held.flatMap((item) => (item && GEAR_SPRITES[item.icon]) ?? [])
}
