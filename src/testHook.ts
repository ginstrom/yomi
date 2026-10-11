import type Phaser from 'phaser'
import type { AttributeId } from './character/attributes.ts'
import type { SkillId } from './character/skills.ts'
import type { SpellId } from './combat/spells.ts'
import type { BattleEvent, BattleState, UnitId } from './engine/battleEngine.ts'
import type { WorldState } from './game/worldMap.ts'
import type { EquipmentSlot } from './inventory/inventory.ts'
import type { Point } from './scenes/boardGeometry.ts'
import type { Rect } from './scenes/mapScroll.ts'

/**
 * What the in-browser tests (e2e/) see of the running game. The page is one
 * canvas, with nothing in it for a test to select, so each scene has a
 * `probe()` that tells where its controls are on screen and what state it
 * shows, and `installTestHook` puts those within a test's reach as
 * `window.__yomi`, in dev builds only. Probes must be plain data: they are
 * sent to the test as JSON.
 */

/** A button: its centre on screen, whether it is shown and whether a click on it does anything. */
export interface ButtonProbe extends Point {
  visible: boolean
  enabled: boolean
}

/** A party member's portrait in the column at the left, by its centre on screen; see partyPanel.ts for what a click does. */
export interface PortraitProbe extends Point {
  name: string
  level: number
  /** Whether the member has skill points or a perk to spend, which its portrait marks. */
  canAdvance: boolean
  /** Whether it is the member marked: the one a panel opens for, and in battle the unit selected. */
  active: boolean
}

export interface MenuProbe {
  showingOptions: boolean
  buttons: { new: ButtonProbe; continue: ButtonProbe; options: ButtonProbe; back: ButtonProbe }
}

export interface WorldProbe {
  world: WorldState
  walking: boolean
  /** Where the map's top-left corner is on screen; with WORLD_LAYOUT, that places every hex. */
  origin: Point
  /** The part of the screen where the map takes clicks. */
  view: Rect
  message: string
  buttons: { scout: ButtonProbe; wait: ButtonProbe; attack: ButtonProbe }
  party: PortraitProbe[]
}

export interface BattleProbe {
  state: BattleState
  log: readonly BattleEvent[]
  playerControl: boolean
  selected: UnitId | null
  /** Where the board's top-left corner is on screen and how far it is scaled; with BATTLE_LAYOUT, that places every hex. */
  origin: Point
  scale: number
  /** `cast` is shown only for a unit with magic; `result` is the one button of the victory or defeat screen. */
  buttons: { attack: ButtonProbe; cast: ButtonProbe; endTurn: ButtonProbe; result: ButtonProbe }
  /** The spell the next board click picks a target for, after the Cast button. */
  casting: SpellId | null
  /** The lines of the victory or defeat screen; empty until the battle is over. */
  result: string[]
  party: PortraitProbe[]
}

export interface InventoryProbe {
  /** `perkTree` is the view the Skills tab's Perk Tree button opens; it has no tab button of its own. */
  tab: 'character' | 'skills' | 'inventory' | 'perkTree'
  /** The portraits beside the panel: a click on one turns the panel to that member, who is then the active one. */
  party: PortraitProbe[]
  /** What the character has waiting to spend. */
  skillPoints: number
  perkPicks: number
  /** Each skill's level, with the centre on screen of the button that raises it and whether a click there would. */
  skills: Record<SkillId, Point & { level: number; canRaise: boolean }>
  /** The character's attributes as the Character tab shows them: what it was born with and what its perks add. */
  attributes: Record<AttributeId, number>
  /** The armour class its gear and perks now give it. */
  armorClass: number
  /** The mana shown: what is left in battle, the most there is on the world map; null for a character without magic. */
  mana: number | null
  /** The perks the Skills tab lists: those the character has a rank of. */
  takenPerks: Array<{ perk: string; ranks: number }>
  /** The Skills tab's button that opens the perk tree, and the tree's button back, by their centres on screen. */
  perkTreeButton: Point
  back: Point
  /**
   * Every perk's node in the tree, by its centre on screen, with the ranks taken and whether a
   * click would take one. The nodes are on screen only while `tab` is `perkTree`.
   */
  perks: Array<Point & { perk: string; ranks: number; canTake: boolean }>
  /** Every equipment slot's centre on screen, with the id of the item in it. */
  equipment: Record<EquipmentSlot, Point & { item: string | null }>
  /** The backpack's items, each with its slot's centre on screen. */
  backpack: Array<Point & { item: string }>
  /** The items the ground grid shows now (on the world map, the baggage), each with its slot's centre on screen. */
  ground: Array<Point & { item: string }>
}

export interface Probes {
  Menu: MenuProbe
  World: WorldProbe
  Battle: BattleProbe
  Inventory: InventoryProbe
}

export interface TestHook {
  /** The scenes now running, by key, bottom first. A paused scene is not running. */
  running(): string[]
  /** The scenes paused under an overlay. */
  paused(): string[]
  /** A running or paused scene's probe, or null while the scene is neither. */
  probe<K extends keyof Probes>(key: K): Probes[K] | null
  /** Frames stepped so far. A click takes effect on the frame after it. */
  frame(): number
  /** How many times faster than life every scene's timers and tweens run. */
  speed: number
}

declare global {
  interface Window {
    __yomi?: TestHook
  }
}

/** A button built as a container centred on its place on screen. */
export function buttonProbe(button: Phaser.GameObjects.Container, enabled = true): ButtonProbe {
  return { x: button.x, y: button.y, visible: button.visible, enabled }
}

export function installTestHook(game: Phaser.Game): void {
  const hook: TestHook = {
    running: () => game.scene.getScenes(true).map((scene) => scene.sys.settings.key),
    paused: () =>
      game.scene
        .getScenes(false)
        .filter((scene) => scene.sys.isPaused())
        .map((scene) => scene.sys.settings.key),
    probe: <K extends keyof Probes>(key: K) => {
      const scene = game.scene.getScene(key) as (Phaser.Scene & { probe(): Probes[K] }) | null
      return scene && (scene.sys.isActive() || scene.sys.isPaused()) ? scene.probe() : null
    },
    frame: () => game.loop.frame,
    speed: 1,
  }
  // Every frame, as a scene's clock and tweens start over when the scene does.
  game.events.on('prestep', () => {
    for (const scene of game.scene.getScenes(false)) {
      scene.time.timeScale = hook.speed
      scene.tweens.timeScale = hook.speed
    }
  })
  window.__yomi = hook
}
