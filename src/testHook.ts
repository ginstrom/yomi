import type Phaser from 'phaser'
import type { AttributeId } from './character/attributes.ts'
import type { CharacterDraft } from './character/creation.ts'
import type { PortraitId } from './character/portraits.ts'
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
  /** Whether the save slots are shown, which the Load button does. */
  showingLoad: boolean
  /** `continue` is enabled over a paused game, or when a slot can be loaded. */
  buttons: { new: ButtonProbe; continue: ButtonProbe; load: ButtonProbe; options: ButtonProbe; back: ButtonProbe }
  /** The three save slots' rows, each with the line it reads; enabled when it holds a game that can be loaded. */
  slots: Array<ButtonProbe & { line: string }>
}

export interface PartyProbe {
  /** The choice between the two ways to start, the roster, the prerolls to fill a place with, or the prompt for a slot to overwrite. */
  view: 'choice' | 'roster' | 'prerolls' | 'overwrite'
  /** A row for each place up to the party limit: a member with Edit and Remove, or an empty place with Create and Preroll. */
  rows: Array<{ name: string | null; edit: ButtonProbe; remove: ButtonProbe; create: ButtonProbe; preroll: ButtonProbe }>
  /** `readyMade` and `createOwn` are the choice's; `begin` is the roster's, enabled with a member or more. */
  buttons: { readyMade: ButtonProbe; createOwn: ButtonProbe; begin: ButtonProbe; back: ButtonProbe }
  /** The ready-made party's portraits under its button, on the choice: nothing to click, but a hover tells of the member. */
  readyMade: Array<ButtonProbe & { name: string; role: string }>
  /** The prerolls' portraits, on their view: a click adds one to the party; one already in it is disabled. */
  prerolls: Array<ButtonProbe & { name: string; role: string }>
  /** The lines the hover shows of the ready-made member or preroll under the pointer, its name first; empty with none. */
  info: string[]
  /** The overwrite prompt's rows, one for each save slot, each with the line it reads. */
  slots: Array<ButtonProbe & { line: string }>
}

/** The steps of character creation, in the order Next walks them. */
export type CreationStep = 'attributes' | 'skills' | 'perks' | 'name'

export interface CreationProbe {
  step: CreationStep
  /** Whether a member of the party is being edited, not a new one created. */
  editing: boolean
  /** What has been chosen so far. */
  draft: CharacterDraft
  /** What is left to place of each kind. */
  attributePoints: number
  skillPoints: number
  perkPicks: number
  spellPicks: number
  /** Which tree the perks step shows, and the switch between the two. */
  tree: 'perks' | 'spells'
  treeSwitch: { perks: ButtonProbe; spells: ButtonProbe }
  /** The tabs that open each step directly. */
  steps: Record<CreationStep, ButtonProbe>
  /** Each attribute's value and its two buttons; on screen on the attributes step. */
  attributes: Record<AttributeId, { value: number; minus: ButtonProbe; plus: ButtonProbe }>
  /** Each skill's level as the draft's character has it, its points placed and its buttons; on screen on the skills step. */
  skills: Record<SkillId, { level: number; placed: number; tagged: boolean; tag: ButtonProbe; minus: ButtonProbe; plus: ButtonProbe }>
  /** Every node of the tree shown, by its centre on screen, with the ranks chosen and whether a click would take or give back one; on screen on the perks step. */
  perks: Array<Point & { perk: string; ranks: number; canClick: boolean }>
  /** The preset faces, by their centres on screen; on screen on the name step. */
  portraits: Array<Point & { portrait: PortraitId; picked: boolean }>
  /** `create` reads Save when editing; it is on the name step, enabled when the draft has no problems. */
  buttons: { next: ButtonProbe; back: ButtonProbe; create: ButtonProbe; cancel: ButtonProbe }
  /** The problem shown beside Create: the first the draft has, or nothing. */
  problem: string
  /** What the last change dropped or refused, as the screen says it. */
  notes: string[]
}

export interface WorldProbe {
  world: WorldState
  walking: boolean
  /** Where the map's top-left corner is on screen; with WORLD_LAYOUT, that places every hex. */
  origin: Point
  /** The part of the screen where the map takes clicks. */
  view: Rect
  message: string
  /** The words of the victory or defeat screen over the map, or '' while the game goes on. The blight, held sites and status are in `world`. */
  outcome: string
  /** The hexes in sight, by `boardIndex`, in order; what the player remembers of the rest is `world.seen`. */
  visible: number[]
  /**
   * Scout, Wait and Attack show among monsters, the camp buttons elsewhere; `campUntilHealed` is enabled while someone is wounded.
   * `end` and `endless` show on the victory screen, `menu` on the defeat screen.
   */
  buttons: {
    scout: ButtonProbe
    wait: ButtonProbe
    attack: ButtonProbe
    camp: ButtonProbe
    campUntilHealed: ButtonProbe
    /** Shows where the party may camp on land a watchtower could stand on; a click without the stock says why in the message. */
    buildTower: ButtonProbe
    /** Shows while the party stands at Oakvale. */
    guildHall: ButtonProbe
    end: ButtonProbe
    endless: ButtonProbe
    menu: ButtonProbe
  }
  party: PortraitProbe[]
}

/** A hero's face in the guild hall, by its centre on screen. */
export interface HallFaceProbe extends ButtonProbe {
  name: string
}

export interface GuildHallProbe {
  /** The party and reserves, or the recruits on offer. */
  view: 'roster' | 'recruit'
  level: number
  partyLimit: number
  /** What the last action did, or why it was refused. */
  message: string
  /** The hero clicked, whom a click on the other row swaps with. */
  selected: { row: 'party' | 'reserves'; index: number } | null
  party: Array<HallFaceProbe & { level: number }>
  reserves: Array<HallFaceProbe & { level: number }>
  /** The pre-rolls not in the company, on the recruit view: a click hires one. */
  prerolls: HallFaceProbe[]
  /** `upgrade`, `toReserves`, `toParty`, `recruit` and `close` are the roster's; `create` and `back` the recruit view's. */
  buttons: {
    upgrade: ButtonProbe
    toReserves: ButtonProbe
    toParty: ButtonProbe
    recruit: ButtonProbe
    create: ButtonProbe
    back: ButtonProbe
    close: ButtonProbe
  }
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
  /** The Cast button's spell list, a row a spell with its centre, while it is open; null when shut. Each unit's statuses are in `state`. */
  spellMenu: Array<Point & { spell: SpellId; enabled: boolean }> | null
  /** The lines of the victory or defeat screen; empty until the battle is over. */
  result: string[]
  party: PortraitProbe[]
}

export interface InventoryProbe {
  /** `perkTree` and `spellTree` are the views the Skills and Spells tabs' tree buttons open; they have no tab buttons of their own. */
  tab: 'character' | 'skills' | 'spells' | 'inventory' | 'perkTree' | 'spellTree'
  /** The portraits beside the panel: a click on one turns the panel to that member, who is then the active one. */
  party: PortraitProbe[]
  /** What the character has waiting to spend. */
  skillPoints: number
  perkPicks: number
  spellPicks: number
  /** Each skill's level, with the centre on screen of the button that raises it and whether a click there would. */
  skills: Record<SkillId, Point & { level: number; canRaise: boolean }>
  /** The character's attributes as the Character tab shows them: what it was born with and what its perks add. */
  attributes: Record<AttributeId, number>
  /** The armour class its gear and perks now give it. */
  armorClass: number
  /** The mana shown: what is left in battle, what the character carries on the world map; null for a character without magic. */
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
  /** The Spells tab's button that opens the spell tree, and the spell tree's nodes as `perks` gives the perk tree's, on screen while `tab` is `spellTree`. */
  spellTreeButton: Point
  spellNodes: Array<Point & { perk: string; ranks: number; canTake: boolean }>
  /** The spells the Spells tab lists, each with the centre of its row's Cast button and whether a click there would cast it here. */
  spells: Array<Point & { spell: SpellId; castable: boolean }>
  /** A heal of one member waiting for a portrait to be clicked, on the world map. */
  worldCast: SpellId | null
  /** Every equipment slot's centre on screen, with the id of the item in it. */
  equipment: Record<EquipmentSlot, Point & { item: string | null }>
  /** The backpack's items, each with its slot's centre on screen. */
  backpack: Array<Point & { item: string }>
  /** The items the ground grid shows now (on the world map, the baggage), each with its slot's centre on screen. */
  ground: Array<Point & { item: string }>
}

export interface Probes {
  Menu: MenuProbe
  Party: PartyProbe
  Creation: CreationProbe
  World: WorldProbe
  Battle: BattleProbe
  Inventory: InventoryProbe
  GuildHall: GuildHallProbe
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
