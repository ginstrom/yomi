import type Phaser from 'phaser'
import type { SkillId } from './character/skills.ts'
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
  /** Each party member's line, by its centre on screen: a click opens the member's panel. */
  party: Array<Point & { name: string; level: number; canAdvance: boolean }>
}

export interface BattleProbe {
  state: BattleState
  log: readonly BattleEvent[]
  playerControl: boolean
  selected: UnitId | null
  /** Where the board's top-left corner is on screen and how far it is scaled; with BATTLE_LAYOUT, that places every hex. */
  origin: Point
  scale: number
  /** `result` is the one button of the victory or defeat screen. */
  buttons: { attack: ButtonProbe; endTurn: ButtonProbe; result: ButtonProbe }
}

export interface InventoryProbe {
  tab: 'character' | 'skills' | 'inventory'
  /** What the character has waiting to spend. */
  skillPoints: number
  perkPicks: number
  /** Each skill's level, with the centre on screen of the button that raises it and whether a click there would. */
  skills: Record<SkillId, Point & { level: number; canRaise: boolean }>
  /** Every perk's row, by its centre on screen, with the ranks taken and whether a click would take one. */
  perks: Array<Point & { perk: string; ranks: number; canTake: boolean }>
  /** Every equipment slot's centre on screen, with the id of the item in it. */
  equipment: Record<EquipmentSlot, Point & { item: string | null }>
  /** The backpack's items, each with its slot's centre on screen. */
  backpack: Array<Point & { item: string }>
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
