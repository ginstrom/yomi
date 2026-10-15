import Phaser from 'phaser'
import { deriveCombatStats, gearChanges, type Character } from '../character/character.ts'
import { sameCombatStats } from '../combat/combat.ts'
import { mulberry32, randomSeed, type SeededRng } from '../combat/rng.ts'
import { SPELLS, STATUSES, type ActiveStatus, type SpellId } from '../combat/spells.ts'
import {
  BattleEngine,
  areaHexes,
  formatEvent,
  listNames,
  type Action,
  type BattleEvent,
  type Phase,
  type UnitId,
  type UnitSnapshot,
} from '../engine/battleEngine.ts'
import { POLICIES, type PolicyName } from '../engine/policies.ts'
import { ENCOUNTERS, heroId, xpReward, type EncounterId, type UnitKind } from '../game/encounters.ts'
import { newGame, takeLoot, type GameState } from '../game/gameState.ts'
import { Ground, pileChanges } from '../game/ground.ts'
import { describeRewards, partyFighters, rewardVictory } from '../game/party.ts'
import type { SavedBattle } from '../game/save.ts'
import { SAVE_FAILED_MESSAGE, SAVE_WARNED_KEY, deleteSlot, saveGame } from '../game/saveSlots.ts'
import { clearLocation, type MonsterLocation } from '../game/worldMap.ts'
import type { Equipment, Item } from '../inventory/inventory.ts'
import {
  HEX_DIRECTIONS,
  HexBoard,
  hexCorners,
  hexDirection,
  hexEquals,
  hexToPixel,
  type BoardSize,
  type Hex,
} from '../grid/hex.ts'
import { buttonProbe, type BattleProbe } from '../testHook.ts'
import { planAttack, type AttackPlan } from './attackPlan.ts'
import { FLOOR_SQUASH_Y, HEX_SIZE, boardHexAt, boardHexCenter, boardPixelSize, curvedArrow } from './boardGeometry.ts'
import { CURSORS } from './cursors.ts'
import { scheduleEvents, type Cue } from './eventSchedule.ts'
import { ScrollingLog } from './scrollingLog.ts'
import { SEED_KEY } from './seed.ts'
import { soundVolume } from './audioSettings.ts'
import { ITEM_ICON_KEYS, ITEM_ICON_SCALE } from './itemIcons.ts'
import { PartyColumn } from './PartyColumn.ts'
import { UnitFigure } from './UnitFigure.ts'
import { gearLayers } from './unitLook.ts'
import { HEADER_BOTTOM, PARTY_PANEL_W, portraitClick } from './partyPanel.ts'
import { eventSounds, type SoundKey } from './sounds.ts'
import { describeStatuses, spellMenuRows, targetingHint } from './spellMenu.ts'

interface BattleData {
  game?: GameState
  /** The id of the monster location on the world map that this battle is fought at. */
  location?: string
  /** A battle read from a save slot, to take up where it stood instead of starting one. */
  saved?: SavedBattle
}

type MoveAction = Extract<Action, { type: 'move' }>
type CastAction = Extract<Action, { type: 'cast' }>

/** What a click on a board hex would do, as shown while the pointer hovers over it. */
type BoardIntent =
  | { kind: 'none' }
  | { kind: 'select'; unit: UnitId }
  | { kind: 'move'; action: MoveAction }
  /** Go for a foe: the plan may move first, and strikes only if `plan.attack`. */
  | { kind: 'attack'; target: UnitId; plan: AttackPlan }
  /** Cast the spell being targeted at the unit or the area's centre clicked. */
  | { kind: 'cast'; action: CastAction }

interface Unit {
  /** The unit's body and shadow, positioned at its feet and depth-sorted with the other units. */
  container: Phaser.GameObjects.Container
  figure: UnitFigure
  /**
   * Name, HP and AP, drawn over every unit in the lower half of the unit's own
   * hex. Plates sit the same way in every hex, so neighbours' plates never collide.
   */
  plate: Phaser.GameObjects.Container
  hpBarBg: Phaser.GameObjects.Rectangle
  hpBarFill: Phaser.GameObjects.Rectangle
  hpText: Phaser.GameObjects.Text
  /** Points the way the unit faces, so the player can see whose side or back is open. */
  facingArrow: Phaser.GameObjects.Graphics
  /** One pip per action point, filled for those left; shown during the unit's side's turn. */
  apPips: Phaser.GameObjects.Graphics
  /** A letter for each status on the unit, in its colour, right of the hit point bar. */
  statusMarks: Phaser.GameObjects.Container
}

/** Flagstone greys from art/palette.toml, so the floor sits with the sprites. */
const FLOOR_COLORS = [0x787062, 0x6b6457, 0x5a544a]
const FLOOR_EDGE = 0x14100c
const MOVE_HIGHLIGHT = 0x1e88e5
const MOVE_OUTLINE = 0x90caf9
const ATTACK_HIGHLIGHT = 0xe53935
const SPELL_HIGHLIGHT = 0x7e57c2
const SPELL_BOLT = 0xb39ddb
/** How long a spell's bolt takes to fly from caster to target. */
const SPELL_FLIGHT_MS = 150
/** How long an area spell's hexes glow as it lands. */
const AREA_FLASH_MS = 300
/** The pause each status's damage at a turn's start is given. */
const TICK_PAUSE_MS = 350
/** What a unit flashes: hurt, healed or helped, or an image struck in its place. */
const HURT_TINT = 0xff8a80
const HELPED_TINT = 0xa5f5a5
const IMAGE_TINT = 0xffffff
/** The spell list's rows, stacked upwards from over the Cast button. */
const SPELL_ROW_W = 240
const SPELL_ROW_H = 26
/** From one button's centre to the next; three fit the least window (MIN_GAME_SIZE in main.ts) beside the party's column. */
const BUTTON_SPACING = 160
const PROVOKE_OUTLINE = 0xffa726
const SELECTED_OUTLINE = 0xffffff
const HOVER_OUTLINE = 0xffffff
const ARROW_COLOR = 0xffffff
const ARROW_EDGE = 0x000000
const AP_PIP_FULL = 0xffee58
const AP_PIP_SPENT = 0x424242
/** Move highlights are fainter where the move leaves too few AP to attack. */
const MOVE_ALPHA_CAN_ATTACK = 0.6
const MOVE_ALPHA_MOVE_ONLY = 0.25
const MOVE_STEP_MS = 140
/** Pause after a free attack lands, before the mover walks on. */
const OPPORTUNITY_PAUSE_MS = 450
/** Pause after a unit walks up to a foe, before it strikes. */
const APPROACH_PAUSE_MS = 120
/** Nameplate rows, in pixels below a unit's feet: name, HP bar, then AP pips or a foe's hit chance. */
const PLATE_NAME_Y = -3
const PLATE_BAR_Y = 11
const PLATE_BAR_W = 52
const PLATE_BAR_H = 10
const PLATE_STATUS_Y = 27
/** How far a nameplate's lowest row reaches below a unit's feet. */
const PLATE_BOTTOM = PLATE_STATUS_Y + 8
/** Clear space either side of the board, and between the board and the log box. */
const BOARD_MARGIN_X = 16
const BOARD_GAP_ABOVE_LOG = 12
const LOG_HISTORY = 50
const LOG_VISIBLE_LINES = 5
const LOG_LINE_H = 20
const LOG_BOX_PADDING = 10
const LOG_BOX_H = LOG_VISIBLE_LINES * LOG_LINE_H + LOG_BOX_PADDING * 2
const LOG_BOX_GAP = 14
/** Width kept clear of wrapped log text for the scrollbar. */
const LOG_SCROLLBAR_SPACE = 16
const ENEMY_POLICY: PolicyName = 'aggressive'
/** The battle fought when the scene is started without a monster location, as in tests. */
const DEFAULT_ENCOUNTER: EncounterId = 'goblin_raid'

/**
 * Every unit sprite is a 32px canvas shown at 3x, so a small creature is drawn small, not scaled
 * down. A kind's sprite is the atlas's of the same name (art/units/<kind>.sprite.toml).
 */
const UNIT_SCALE = 3
const UNIT_HEIGHT = 32 * UNIT_SCALE
/** Units breathe out of step: each starts this much after the one before it. */
const IDLE_STAGGER_MS = 230
/** How far a unit leans into its strike, and how long the lean out and back takes. */
const LUNGE_PX = 10
const LUNGE_MS = 70

export class BattleScene extends Phaser.Scene {
  private gameState!: GameState
  /** The monsters being fought, which a victory clears from the world map. */
  private location: MonsterLocation | null = null
  /** The experience a victory here is worth, until it is won. */
  private xpReward = 0
  /** The party member behind each player unit. */
  private heroes = new Map<UnitId, Character>()
  /** Each member's equipment as the engine's log last had it, to tell the next gear change against. */
  private loggedEquipment = new Map<UnitId, Equipment>()
  /** What lies on the battlefield. The inventory drops onto and picks up from the pile on its unit's hex. */
  private ground = new Ground()
  /**
   * While the character panel is open: each member's unit, the pile under it that the panel
   * works on, and what that held when the panel opened.
   */
  private openPiles: Array<{ unit: UnitId; items: Item[]; before: Item[] }> | null = null
  private engine!: BattleEngine
  /** What the enemy's policy rolls with: seeded, like the engine, so that a save can tell where it stands. */
  private enemyRng: SeededRng = mulberry32(0)
  /** The round whose start was last saved, so that each of the player's turns is saved once. */
  private savedRound: number | null = null
  private board!: HexBoard
  private names!: Record<UnitId, string>
  private logDumped = false
  private music: Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound | null = null
  /** True while the player may act; off during animations and the enemy's turn. */
  private playerControl = false
  /** The player unit that board clicks and the Attack button act for. */
  private selected: UnitId | null = null
  /**
   * What the next board click picks a target for: an attack, after the Attack button was pressed
   * with several foes in reach, or the spell the Cast button chose. Null outside both.
   */
  private targeting: 'attack' | SpellId | null = null
  /** The Cast button's list of the selected unit's spells while it is open, with each row's spell and whether it can be cast. */
  private spellMenu: { container: Phaser.GameObjects.Container; rows: Array<{ spell: SpellId; enabled: boolean; bg: Phaser.GameObjects.Rectangle }> } | null = null
  private units!: Map<UnitId, Unit>

  private floorLayer!: Phaser.GameObjects.Container
  private highlights!: Phaser.GameObjects.Graphics
  /** What a click on the hovered hex would do: a path arrow, an outline, red for an attack. */
  private hoverMarks!: Phaser.GameObjects.Graphics
  /** The board hex under the pointer, or null when it is off the board or over a button or the log. */
  private hovered: Hex | null = null
  /** A marker on each hex with items lying on it; in the floor layer, so units stand over them. */
  private groundMarks!: Phaser.GameObjects.Container
  private unitLayer!: Phaser.GameObjects.Container
  /** Units' nameplates, drawn above every unit so none is hidden behind a sprite. */
  private plateLayer!: Phaser.GameObjects.Container
  /** Hit-chance labels on attackable foes, drawn above the nameplates. */
  private labelLayer!: Phaser.GameObjects.Container
  /** The odds on each unit an area spell would touch, for the hovered centre; above the other labels. */
  private hoverLabels!: Phaser.GameObjects.Container

  /** The party's portraits down the left; the one marked is the member a panel opens for. */
  private column!: PartyColumn
  private roundText!: Phaser.GameObjects.Text
  private hintText!: Phaser.GameObjects.Text
  /** The victory or defeat screen: a shade over the battle, a banner, a line under it and one button. */
  private resultShade!: Phaser.GameObjects.Rectangle
  private bannerText!: Phaser.GameObjects.Text
  private resultText!: Phaser.GameObjects.Text
  private logBoxBg!: Phaser.GameObjects.Rectangle
  private logScrollTrack!: Phaser.GameObjects.Rectangle
  private logScrollThumb!: Phaser.GameObjects.Rectangle
  private logText!: Phaser.GameObjects.Text
  private log!: ScrollingLog

  private attackButton!: Phaser.GameObjects.Container
  /** Shown for a unit with magic; reads its mana, and Cancel while a spell's target is being picked. */
  private castButton!: Phaser.GameObjects.Container
  private endTurnButton!: Phaser.GameObjects.Container
  private menuButton!: Phaser.GameObjects.Container

  constructor() {
    super('Battle')
  }

  preload(): void {
    for (const key of Object.values(ITEM_ICON_KEYS)) this.load.image(key, `assets/sprites/${key}.png`)
    PartyColumn.preload(this)
  }

  create(data: BattleData): void {
    this.gameState = data?.game ?? newGame()
    const party = this.gameState.party
    const at = this.gameState.world.locations.find((l) => l.id === data?.location)
    this.location = at?.kind === 'monsters' ? at : null
    const encounter = ENCOUNTERS[this.location?.encounter ?? DEFAULT_ENCOUNTER]
    const fight = encounter(partyFighters(party), this.location?.threat)
    const { setup, kinds } = fight
    this.xpReward = xpReward(fight)
    this.heroes = new Map(party.map((member, i) => [heroId(i), member]))
    this.loggedEquipment = new Map(party.map((member, i) => [heroId(i), { ...member.equipment }]))
    this.openPiles = null
    this.savedRound = null
    const saved = data?.saved
    if (saved) {
      // The encounter above is built only for its kinds and its worth: the units are the engine's.
      this.engine = BattleEngine.restore(saved.engine)
      this.enemyRng = mulberry32(saved.enemyRng)
      this.ground = Ground.fromPiles(saved.ground)
    } else {
      // Every battle is seeded, by the page's address or at random, so every battle can be saved and replayed.
      const seed = (this.registry.get(SEED_KEY) as number | null | undefined) ?? randomSeed()
      this.engine = new BattleEngine(setup, { seed, meta: { source: 'game', enemyPolicy: ENEMY_POLICY } })
      // A stream of its own, so the enemy's choices do not shift the engine's dice.
      this.enemyRng = mulberry32(seed + 1)
      this.ground = new Ground()
    }
    const board = saved?.engine.board ?? setup.board
    const fielded = this.engine.getState().units
    this.board = new HexBoard(board)
    this.names = Object.fromEntries(fielded.map((u) => [u.id, u.name]))
    // Phaser reuses the scene instance on restart, so field initializers
    // don't run again — reset per-battle state explicitly.
    this.log = new ScrollingLog(LOG_HISTORY, LOG_VISIBLE_LINES)
    this.logDumped = false
    this.playerControl = false
    this.selected = null
    this.targeting = null
    this.spellMenu = null
    this.hovered = null

    this.floorLayer = this.add.container(0, 0)
    this.buildFloor(board)
    this.highlights = this.add.graphics()
    this.floorLayer.add(this.highlights)
    this.hoverMarks = this.add.graphics()
    this.floorLayer.add(this.hoverMarks)
    this.groundMarks = this.add.container(0, 0)
    this.floorLayer.add(this.groundMarks)
    this.unitLayer = this.add.container(0, 0)
    this.plateLayer = this.add.container(0, 0)
    this.units = new Map(fielded.map((u, i) => [u.id, this.createUnit(u.name, kinds[u.id], i * IDLE_STAGGER_MS)]))
    this.refreshGear()
    this.labelLayer = this.add.container(0, 0)
    this.hoverLabels = this.add.container(0, 0)

    this.roundText = this.add
      .text(20, 16, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' })
      .setScrollFactor(0)
    this.hintText = this.add
      .text(20, 44, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#9e9e9e',
      })
      .setScrollFactor(0)

    // Interactive with no handler, so a click on the log never counts as a board click.
    this.logBoxBg = this.add
      .rectangle(0, 0, 10, LOG_BOX_H, 0x0d0d0d, 0.75)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x3a3a3a)
      .setInteractive()

    this.logText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#cfd8dc',
      lineSpacing: 4,
    })

    this.logScrollTrack = this.add
      .rectangle(0, 0, 4, 10, 0x2a2a2a)
      .setOrigin(0, 0)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
    this.logScrollThumb = this.add
      .rectangle(0, 0, 4, 10, 0x6b6b6b)
      .setOrigin(0, 0)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })

    this.input.setDraggable(this.logScrollThumb)
    this.logScrollThumb.on('drag', (_pointer: Phaser.Input.Pointer, _dragX: number, dragY: number) =>
      this.onLogThumbDrag(dragY),
    )
    this.logScrollTrack.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onLogTrackClick(pointer))

    this.input.on(
      'wheel',
      (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => this.onLogWheel(pointer, dy),
    )
    // Phaser passes the interactive objects under the pointer. A click on any of them (a button,
    // the log or its scrollbar) is not a board click, even where it lies over the board.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.onBoardClick(pointer)
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) =>
      this.onPointerMove(pointer, over),
    )
    this.input.on(Phaser.Input.Events.GAME_OUT, () => this.setHovered(null))
    // A paused battle (inventory or menu open) mustn't leave its board cursor on the overlay.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => this.setHovered(null))
    // The menu pauses the theme; the options there may have changed its volume.
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.resumeMusic())
    // The character panel tells the member it last showed; the menu tells nothing.
    this.events.on(Phaser.Scenes.Events.RESUME, (_sys: Phaser.Scenes.Systems, data?: { member?: number }) => {
      if (data?.member !== undefined) this.selectHero(data.member)
      this.commitGearChange()
    })

    this.attackButton = this.createButton('Attack', () => this.onAttack())
    this.castButton = this.createButton('Cast', () => this.onCast())
    this.endTurnButton = this.createButton('End Turn', () => this.onEndTurn())
    // Under the result screen, whose shade keeps clicks off the portraits once the battle is over.
    this.column = new PartyColumn(this, party, (index) => this.onPortrait(index))

    // Interactive with no handler, so the finished battle under the result screen takes no clicks.
    this.resultShade = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0, 0).setInteractive()
    this.bannerText = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '48px', color: '#ffee58', fontStyle: 'bold' })
      .setOrigin(0.5)
    this.resultText = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '16px', color: '#cfd8dc', align: 'center', lineSpacing: 6 })
      .setOrigin(0.5, 0)
    this.menuButton = this.createButton('OK', () => this.leaveBattle())
    for (const part of [this.resultShade, this.bannerText, this.resultText, this.menuButton]) part.setVisible(false)

    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
      this.input.setDefaultCursor('default')
      this.stopMusic()
      // Leaving mid-battle (e.g. "New" from the pause menu) still yields a complete log.
      this.engine.abandon()
      this.dumpLog()
    })

    this.input.keyboard?.on('keydown-I', () => this.openPanel('inventory'))
    this.input.keyboard?.on('keydown-C', () => this.openPanel('character'))
    this.input.keyboard?.on('keydown-S', () => this.openPanel('skills'))
    this.input.keyboard?.on('keydown-M', () => {
      if (!this.scene.isPaused() && this.castButton.visible && this.castButton.getData('enabled')) this.onCast()
    })
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.spellMenu) this.closeSpellMenu()
      else if (this.targeting) this.setTargeting(null)
      else this.openMenu()
    })
    // A spell is picked from the open list by its row's number.
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const row = Number(event.key)
      if (this.spellMenu && Number.isInteger(row) && row >= 1) this.pickSpell(row - 1)
    })

    this.music = this.sound.add('music_battle', { loop: true, volume: soundVolume('music_battle') })
    this.music.play()

    if (saved) this.showRestored()
    else this.applyEvents(this.engine.getLog())
    // A side can enter already fallen (e.g. a party carried over at 0 hp).
    this.continueBattle()
  }

  /**
   * Shows a battle taken up from a save as it stands, with nothing played back:
   * the log refilled from the engine's events, the fallen as fallen and the
   * ground's piles marked.
   */
  private showRestored(): void {
    for (const event of this.engine.getLog()) this.log.push(formatEvent(event, this.names))
    this.renderLog()
    for (const { id, hp } of this.engine.getState().units) {
      if (hp <= 0) this.showFallen(id)
    }
    this.refreshGroundMarks()
    this.syncUnitsFromEngine()
  }

  /** Others may stand on a fallen unit's hex, so its plate goes rather than collide with theirs. */
  private showFallen(id: UnitId): void {
    const unit = this.units.get(id)!
    unit.figure.stop().setFigureAlpha(0.4)
    unit.plate.setVisible(false)
  }

  /** What the in-browser tests see of the battle; see testHook.ts. */
  probe(): BattleProbe {
    const enabled = (button: Phaser.GameObjects.Container) => button.getData('enabled') as boolean
    return {
      state: this.engine.getState(),
      log: this.engine.getLog(),
      playerControl: this.playerControl,
      selected: this.selected,
      origin: { x: this.floorLayer.x, y: this.floorLayer.y },
      scale: this.floorLayer.scale,
      buttons: {
        attack: buttonProbe(this.attackButton, enabled(this.attackButton)),
        cast: buttonProbe(this.castButton, enabled(this.castButton)),
        endTurn: buttonProbe(this.endTurnButton, enabled(this.endTurnButton)),
        result: buttonProbe(this.menuButton),
      },
      casting: this.targeting === 'attack' ? null : this.targeting,
      spellMenu:
        this.spellMenu?.rows.map(({ spell, enabled, bg }) => {
          const bounds = bg.getBounds()
          return { spell, enabled, x: bounds.centerX, y: bounds.centerY }
        }) ?? null,
      result: this.resultText.visible ? this.resultText.text.split('\n') : [],
      party: this.column.probe(),
    }
  }

  /**
   * The party member whose panel opens, and whose portrait is marked: the
   * selected unit, or before any is selected the first member standing.
   */
  private panelUnit(): UnitSnapshot | undefined {
    const heroes = this.engine.getState().units.filter((u) => this.heroes.has(u.id))
    return heroes.find((u) => u.id === this.selected) ?? heroes.find((u) => u.hp > 0) ?? heroes[0]
  }

  /** The place in the party of the member `panelUnit` gives. */
  private activeIndex(): number | null {
    const member = this.heroes.get(this.panelUnit()?.id ?? '')
    return member ? this.gameState.party.indexOf(member) : null
  }

  /** Makes the `index`th member's unit the selected one, if it has anything left to do this turn. */
  private selectHero(index: number): boolean {
    const id = heroId(index)
    if (!this.playerControl || !this.actableUnits().includes(id)) return false
    this.selected = id
    this.targeting = null
    this.setPlayerControl(true)
    return true
  }

  /**
   * A click on a portrait selects that member's unit, as a click on the unit
   * does, and a click on the selected member's opens its panel. So does a click
   * on a member that cannot be selected now: one that is spent or has fallen,
   * or any of them while the enemy moves.
   */
  private onPortrait(index: number): void {
    const selectable = this.playerControl && this.actableUnits().includes(heroId(index))
    if (portraitClick(index, this.activeIndex(), selectable) === 'open') this.openPanel('character', index)
    else this.selectHero(index)
  }

  /**
   * Opens the character panel on a party member: the one at `index`, or else
   * the selected unit's. Its portraits turn it to any other member, so every
   * member's gear and ground go with it; gear can be changed there only while
   * the player has control.
   */
  private openPanel(tab: 'inventory' | 'character' | 'skills', index = this.activeIndex()): void {
    if (this.scene.isPaused() || index === null) return
    const units = this.engine.getState().units
    this.openPiles = []
    const members = this.gameState.party.map((character, i) => {
      const unit = units.find((u) => u.id === heroId(i))
      if (!unit) return { character }
      const items = this.ground.pileAt(unit.position)
      this.openPiles!.push({ unit: unit.id, items, before: [...items] })
      const gearApCost = this.playerControl ? this.engine.equipCost(unit.id) : null
      return { character, gearApCost, ground: items, mana: unit.mana }
    })
    this.scene.launch('Inventory', { members, index, tab })
    this.scene.pause()
  }

  /**
   * Tells the engine about gear changed in the character panel, which edits its characters and
   * the ground under them directly. One action covers the whole visit to a member, so each
   * member whose gear changed pays for it once.
   */
  private commitGearChange(): void {
    // The in-battle menu resumes the battle too, with no panel behind it.
    const piles = this.openPiles
    this.openPiles = null
    this.refreshGear()
    if (!piles || !this.playerControl) return
    const units = this.engine.getState().units
    const named = ({ id, name }: Item) => ({ id, name })
    const actions: Action[] = []
    for (const pile of piles) {
      const member = this.heroes.get(pile.unit)!
      const stats = deriveCombatStats(member)
      const unit = units.find((u) => u.id === pile.unit)!
      const { dropped, pickedUp } = pileChanges(pile.before, pile.items)
      if (sameCombatStats(stats, unit) && dropped.length === 0 && pickedUp.length === 0) continue
      const changes = gearChanges(this.loggedEquipment.get(pile.unit)!, member.equipment)
      this.loggedEquipment.set(pile.unit, { ...member.equipment })
      actions.push({
        type: 'equip',
        unit: pile.unit,
        stats,
        changes,
        dropped: dropped.map(named),
        pickedUp: pickedUp.map(named),
      })
    }
    if (actions.length === 0) return
    this.refreshGroundMarks()
    this.setPlayerControl(false)
    const animationMs = this.applyEvents(actions.flatMap((action) => this.engine.step(action)))
    this.time.delayedCall(animationMs, () => this.continueBattle())
  }

  private standing(id: UnitId): boolean {
    return this.engine.getState().units.some((u) => u.id === id && u.hp > 0)
  }

  /** Shows the item last dropped on each hex with a pile; a unit standing there hides it. */
  private refreshGroundMarks(): void {
    this.groundMarks.removeAll(true)
    for (const { hex, items } of this.ground.piles()) {
      const { x, y } = boardHexCenter(hex)
      const top = items[items.length - 1]
      this.groundMarks.add(this.add.image(x, y, ITEM_ICON_KEYS[top.icon]).setScale(ITEM_ICON_SCALE))
    }
  }

  private openMenu(): void {
    if (this.scene.isPaused()) return
    if (this.engine.getState().phase === 'over') {
      // Esc answers the result screen's one button, once it is up.
      if (this.menuButton.visible) this.leaveBattle()
      return
    }
    this.music?.pause()
    this.scene.launch('Menu', { resume: 'Battle' })
    this.scene.bringToTop('Menu')
    this.scene.pause()
  }

  /** Leaves the finished battle: back to the world map after a victory, to the main menu otherwise. */
  private leaveBattle(): void {
    if (this.engine.getState().winner === 'player') this.scene.start('World', { game: this.gameState })
    else this.scene.start('Menu')
  }

  // ---- board geometry ------------------------------------------------------

  /** The board hex under a screen position, or null when off the board. */
  private hexAt(screenX: number, screenY: number): Hex | null {
    const origin = { x: this.floorLayer.x, y: this.floorLayer.y }
    const h = boardHexAt({ x: screenX, y: screenY }, origin, this.floorLayer.scale)
    return this.board.contains(h) ? h : null
  }

  private hexPolygon(h: Hex): Phaser.Math.Vector2[] {
    const c = boardHexCenter(h)
    return hexCorners(HEX_SIZE).map((p) => new Phaser.Math.Vector2(c.x + p.x, c.y + p.y * FLOOR_SQUASH_Y))
  }

  // ---- setup helpers -----------------------------------------------------

  private buildFloor(size: BoardSize): void {
    const floor = this.add.graphics()
    for (const h of new HexBoard(size).hexes) {
      // A three-colouring: no two neighbouring hexes share a shade.
      const shade = (((h.q - h.r) % 3) + 3) % 3
      const polygon = this.hexPolygon(h)
      floor.fillStyle(FLOOR_COLORS[shade], 1)
      floor.fillPoints(polygon, true)
      floor.lineStyle(1, FLOOR_EDGE, 0.6)
      floor.strokePoints(polygon, true)
    }
    this.floorLayer.add(floor)
  }

  /** Shows each hero holding what its character does now. */
  private refreshGear(): void {
    for (const [id, member] of this.heroes) this.units.get(id)?.figure.setGear(gearLayers(member.equipment))
  }

  private createUnit(name: string, kind: UnitKind, idleDelayMs: number): Unit {
    const figure = new UnitFigure(this, kind, UNIT_SCALE).play('idle', idleDelayMs)
    const shadow = this.add.ellipse(0, 0, UNIT_HEIGHT * 0.55, UNIT_HEIGHT * 0.18, 0x000000, 0.35)
    const container = this.add.container(0, 0, [shadow, figure])
    this.unitLayer.add(container)

    // An outline keeps plate text legible over the floor, highlights and other units.
    const outlined = { fontFamily: 'monospace', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }
    const nameText = this.add.text(0, PLATE_NAME_Y, name, { ...outlined, fontSize: '12px' }).setOrigin(0.5, 0)
    const hpBarBg = this.add
      .rectangle(0, PLATE_BAR_Y, PLATE_BAR_W, PLATE_BAR_H, 0x212121)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, 0x000000)
    const hpBarFill = this.add
      .rectangle(-PLATE_BAR_W / 2, PLATE_BAR_Y, PLATE_BAR_W, PLATE_BAR_H, 0x43a047)
      .setOrigin(0, 0)
    const hpText = this.add
      .text(0, PLATE_BAR_Y + PLATE_BAR_H / 2, '', { ...outlined, fontSize: '10px', strokeThickness: 2 })
      .setOrigin(0.5)
    // Drawn pointing east and rotated to the unit's facing.
    const facingArrow = this.add
      .graphics({ x: -PLATE_BAR_W / 2 - 8, y: PLATE_BAR_Y + PLATE_BAR_H / 2 })
      .fillStyle(0xffffff, 1)
      .lineStyle(1.5, 0x000000, 1)
      .fillTriangle(6, 0, -4, -5, -4, 5)
      .strokeTriangle(6, 0, -4, -5, -4, 5)
    const apPips = this.add.graphics()
    const statusMarks = this.add.container(PLATE_BAR_W / 2 + 4, PLATE_BAR_Y + PLATE_BAR_H / 2)
    const plate = this.add.container(0, 0, [nameText, hpBarBg, hpBarFill, hpText, facingArrow, apPips, statusMarks])
    this.plateLayer.add(plate)

    return { container, figure, plate, hpBarBg, hpBarFill, hpText, facingArrow, apPips, statusMarks }
  }

  private createButton(label: string, onClick: () => void): Phaser.GameObjects.Container {
    const width = 140
    const height = 44
    const bg = this.add
      .rectangle(0, 0, width, height, 0x2b6cb0)
      .setStrokeStyle(2, 0x90cdf4)
      .setInteractive({ useHandCursor: true })
    const text = this.add
      .text(0, 0, label, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5)

    // A disabled button keeps its input enabled: Phaser leaves input-disabled objects out of the
    // hit test, which would let a click on a greyed-out button fall through to the board.
    const container = this.add.container(0, 0, [bg, text])
    const isEnabled = (): boolean => container.getData('enabled') as boolean
    bg.on('pointerover', () => {
      if (isEnabled()) bg.setFillStyle(0x3182ce)
    })
    bg.on('pointerout', () => {
      if (isEnabled()) bg.setFillStyle(0x2b6cb0)
    })
    bg.on('pointerdown', () => {
      if (!isEnabled()) return
      this.playSound('sfx_ui_click')
      onClick()
    })

    container.setSize(width, height)
    container.setData('bg', bg)
    container.setData('text', text)
    container.setData('enabled', true)
    return container
  }

  private setButtonLabel(button: Phaser.GameObjects.Container, label: string): void {
    ;(button.getData('text') as Phaser.GameObjects.Text).setText(label)
  }

  private setButtonEnabled(button: Phaser.GameObjects.Container, enabled: boolean): void {
    const bg = button.getData('bg') as Phaser.GameObjects.Rectangle
    const text = button.getData('text') as Phaser.GameObjects.Text
    button.setData('enabled', enabled)
    bg.input!.cursor = enabled ? 'pointer' : false
    bg.setFillStyle(enabled ? 0x2b6cb0 : 0x424242)
    text.setAlpha(enabled ? 1 : 0.5)
  }

  // ---- layout -------------------------------------------------------------

  /**
   * Header at the top, buttons and log box at the bottom, and the board centred
   * in the space between, scaled down (never up) to fit. The game is never
   * smaller than MIN_GAME_SIZE (main.ts), where the board fits at full size and
   * the hint line fits on one line.
   */
  private layout(): void {
    const width = this.scale.width
    const height = this.scale.height

    // The party's column takes the left; the board, the log and the buttons share what is right of it.
    this.column.layout(height)
    const centreX = PARTY_PANEL_W + (width - PARTY_PANEL_W) / 2
    const buttonY = height - 50
    this.attackButton.setPosition(centreX - BUTTON_SPACING, buttonY)
    this.castButton.setPosition(centreX, buttonY)
    this.endTurnButton.setPosition(centreX + BUTTON_SPACING, buttonY)

    this.resultShade.setSize(width, height)
    this.bannerText.setPosition(width / 2, height / 2 - 100)
    // A victory adds the experience won and a line for each member it levelled or stood back up,
    // so the button keeps below however many lines there are.
    this.resultText.setPosition(width / 2, height / 2 - 60)
    this.menuButton.setPosition(width / 2, this.resultText.y + this.resultText.height + 46)

    const buttonTop = buttonY - 22
    const logBoxX = PARTY_PANEL_W + BOARD_MARGIN_X
    const logBoxW = width - logBoxX - BOARD_MARGIN_X
    const logBoxY = buttonTop - LOG_BOX_GAP - LOG_BOX_H

    this.logBoxBg.setPosition(logBoxX, logBoxY)
    this.logBoxBg.setSize(logBoxW, LOG_BOX_H)
    this.logText.setPosition(logBoxX + LOG_BOX_PADDING, logBoxY + LOG_BOX_PADDING)
    // Long lines wrap onto further rows, clear of the scrollbar.
    this.logText.setWordWrapWidth(logBoxW - 2 * LOG_BOX_PADDING - LOG_SCROLLBAR_SPACE)
    this.log.setWrap((line) => this.logText.getWrappedText(line))

    // The board's drawn extent in board-local pixels: sprites stand up out of the
    // top row and nameplates hang below the bottom row.
    const board = boardPixelSize(this.board.size)
    const rowInset = boardHexCenter({ q: 0, r: 0 }).y
    const top = Math.min(0, rowInset - UNIT_HEIGHT)
    const bottom = Math.max(board.height, board.height - rowInset + PLATE_BOTTOM)

    const freeLeft = PARTY_PANEL_W + BOARD_MARGIN_X
    const freeTop = HEADER_BOTTOM
    const freeW = width - PARTY_PANEL_W - 2 * BOARD_MARGIN_X
    const freeH = logBoxY - BOARD_GAP_ABOVE_LOG - freeTop
    const scale = Math.max(0, Math.min(1, freeW / board.width, freeH / (bottom - top)))
    const floorX = freeLeft + (freeW - board.width * scale) / 2
    const floorY = freeTop + (freeH - (bottom - top) * scale) / 2 - top * scale

    for (const layer of [this.floorLayer, this.unitLayer, this.plateLayer, this.labelLayer, this.hoverLabels]) {
      layer.setPosition(floorX, floorY).setScale(scale)
    }
    for (const snapshot of this.engine.getState().units) this.placeUnit(snapshot.id, snapshot.position)

    this.renderLog()
  }

  private placeUnit(id: UnitId, at: Hex): void {
    const { x, y } = boardHexCenter(at)
    const unit = this.units.get(id)!
    unit.container.setPosition(x, y)
    unit.plate.setPosition(x, y)
    this.sortUnits()
  }

  /** Turns the unit's sprite (which can only look left or right) and its facing arrow to a HEX_DIRECTIONS index. */
  private faceUnit(id: UnitId, facing: number): void {
    const unit = this.units.get(id)!
    const { x, y } = hexToPixel(HEX_DIRECTIONS[facing], 1)
    // Sprites are drawn facing right.
    unit.figure.faceLeft(x < 0)
    unit.facingArrow.setRotation(Math.atan2(y * FLOOR_SQUASH_Y, x))
  }

  /** Units lower on screen draw in front. */
  private sortUnits(): void {
    this.unitLayer.sort('y')
  }

  private refreshHpDisplay(unit: Unit, hp: number, maxHp: number): void {
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1)
    // setSize, not a bare width assignment, so the shape's geometry and path follow.
    unit.hpBarFill.setSize(unit.hpBarBg.width * ratio, unit.hpBarBg.height)
    unit.hpBarFill.setFillStyle(ratio > 0.5 ? 0x43a047 : ratio > 0.2 ? 0xfb8c00 : 0xe53935)
    unit.hpText.setText(`${hp} / ${maxHp}`)
  }

  /** A letter for each of the unit's statuses, each in its status's colour. */
  private refreshStatusMarks(unit: Unit, statuses: readonly ActiveStatus[]): void {
    unit.statusMarks.removeAll(true)
    statuses.forEach(({ id }, i) => {
      const { mark, colour } = STATUSES[id]
      const letter = this.add
        .text(i * 9, 0, mark, {
          fontFamily: 'monospace',
          fontSize: '11px',
          fontStyle: 'bold',
          color: `#${colour.toString(16).padStart(6, '0')}`,
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0, 0.5)
      unit.statusMarks.add(letter)
    })
  }

  private refreshApPips(unit: Unit, snapshot: UnitSnapshot, phase: Phase): void {
    const pips = unit.apPips
    pips.clear()
    if (snapshot.side !== phase || snapshot.hp <= 0) return
    const spacing = 7
    for (let i = 0; i < snapshot.actionPoints; i++) {
      const x = (i - (snapshot.actionPoints - 1) / 2) * spacing
      pips.fillStyle(i < snapshot.ap ? AP_PIP_FULL : AP_PIP_SPENT, 1)
      pips.fillCircle(x, PLATE_STATUS_Y, 2.5)
      pips.lineStyle(1, 0x000000, 0.8)
      pips.strokeCircle(x, PLATE_STATUS_Y, 2.5)
    }
  }

  private updateRoundText(): void {
    const state = this.engine.getState()
    if (state.phase === 'over') {
      this.roundText.setText(`Battle over — ${state.round} rounds fought`)
      return
    }
    this.roundText.setText(`Round ${state.round} — ${state.phase === 'player' ? 'your turn' : "enemy's turn"}`)
  }

  /** Player units that still have something to do this turn, in roster order. */
  private actableUnits(): UnitId[] {
    const ids = new Set<UnitId>()
    for (const action of this.engine.legalActions()) if (action.type !== 'end_turn') ids.add(action.unit)
    return [...ids]
  }

  /** Keeps the selection on a unit that can still act, moving it on when the current one is spent. */
  private ensureSelection(): void {
    const actable = this.actableUnits()
    if (this.selected === null || !actable.includes(this.selected)) this.selected = actable[0] ?? null
  }

  /** The selected unit's legal casts, spell by spell in the order it knows them, in roster order of their targets. */
  private selectedCasts(): CastAction[] {
    if (this.selected === null) return []
    return this.engine.legalActions(this.selected).filter((a) => a.type === 'cast')
  }

  /** The selected unit's legal attacks, in roster order of their targets. */
  private selectedAttacks(): Extract<Action, { type: 'attack' }>[] {
    if (this.selected === null) return []
    return this.engine.legalActions(this.selected).filter((a) => a.type === 'attack')
  }

  /**
   * Marks where the selected unit can move (fainter where no AP is left to attack, orange-edged
   * where the move provokes a free attack) and whom it can attack, with the
   * odds of hitting each. While picking a target, only the targets show: for a
   * spell, the foes it can be cast on and the odds of it striking each.
   */
  private refreshHighlights(): void {
    this.highlights.clear()
    this.labelLayer.removeAll(true)
    this.hintText.setVisible(this.playerControl)
    this.refreshHover()
    if (!this.playerControl) return

    const state = this.engine.getState()
    const positionOf = (id: UnitId) => state.units.find((u) => u.id === id)!.position
    const actable = this.actableUnits()
    const self = state.units.find((u) => u.id === this.selected)
    const spell = this.targeting !== null && this.targeting !== 'attack' ? this.targeting : null
    const statuses = self && self.statuses.length > 0 ? `${describeStatuses(self.statuses)}. ` : ''
    this.hintText.setText(
      spell
        ? targetingHint(spell)
        : this.targeting && self
          ? `Choose a foe to attack (${self.attackApCost} AP). Esc or Cancel to go back.`
          : actable.length === 0
            ? 'No action points left. Press End Turn.'
            : `${statuses}Blue: move (fainter leaves too few AP to attack), orange edge provokes a free attack. Click a foe to attack.`,
    )

    for (const id of this.targeting ? [] : actable) {
      if (id === this.selected) continue
      this.highlights.lineStyle(2, 0xffffff, 0.5)
      this.highlights.strokePoints(this.hexPolygon(positionOf(id)), true)
    }
    if (this.selected === null || !self) return

    for (const action of this.engine.legalActions(this.selected)) {
      if (action.type === 'move' && !this.targeting) {
        const preview = this.engine.previewMove(action.unit, action.to)!
        const polygon = this.hexPolygon(action.to)
        const canAttack = preview.apCost + self.attackApCost <= self.ap
        const alpha = canAttack ? MOVE_ALPHA_CAN_ATTACK : MOVE_ALPHA_MOVE_ONLY
        this.highlights.fillStyle(MOVE_HIGHLIGHT, alpha)
        this.highlights.fillPoints(polygon, true)
        if (preview.provokes.length > 0) this.highlights.lineStyle(2, PROVOKE_OUTLINE, 1)
        else this.highlights.lineStyle(1, MOVE_OUTLINE, 0.9)
        this.highlights.strokePoints(polygon, true)
      } else if (action.type === 'attack' && spell === null) {
        const polygon = this.hexPolygon(positionOf(action.target))
        this.highlights.fillStyle(ATTACK_HIGHLIGHT, this.targeting ? 0.7 : 0.5)
        this.highlights.fillPoints(polygon, true)
        if (this.targeting) {
          this.highlights.lineStyle(2, 0xffffff, 0.9)
          this.highlights.strokePoints(polygon, true)
        }
        this.addHitChanceLabel(action.unit, action.target, positionOf(action.target))
      } else if (action.type === 'cast' && action.spell === spell) {
        // A unit to cast on is marked strongly, with the odds of a hostile spell; an area's centres faintly.
        const at = 'at' in action ? action.at : positionOf(action.target)
        const polygon = this.hexPolygon(at)
        this.highlights.fillStyle(SPELL_HIGHLIGHT, 'at' in action ? 0.3 : 0.7)
        this.highlights.fillPoints(polygon, true)
        if ('at' in action) continue
        this.highlights.lineStyle(2, 0xffffff, 0.9)
        this.highlights.strokePoints(polygon, true)
        const chance = this.engine.previewCast(action.unit, action.spell, action.target)?.outcomes[0]?.hitChance
        if (chance !== null && chance !== undefined) this.addChanceLabel(`${Math.round(chance * 100)}%`, at)
      }
    }
    this.highlights.lineStyle(3, SELECTED_OUTLINE, 1)
    this.highlights.strokePoints(this.hexPolygon(positionOf(this.selected)), true)
  }

  // ---- hover --------------------------------------------------------------

  private onPointerMove(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (over.length > 0) {
      // Buttons set their own cursor; leaving one restores this default.
      this.input.manager.defaultCursor = CURSORS.move
      this.hovered = null
      this.hoverMarks.clear()
      return
    }
    this.setHovered(this.hexAt(pointer.x, pointer.y))
  }

  private setHovered(at: Hex | null): void {
    const same = at === null || this.hovered === null ? at === this.hovered : hexEquals(at, this.hovered)
    this.hovered = at
    if (!same) this.refreshHover()
  }

  /** What a click on `at` would do for the selected unit. */
  private boardIntent(at: Hex): BoardIntent {
    if (!this.playerControl || this.selected === null) return { kind: 'none' }
    const state = this.engine.getState()
    const self = state.units.find((u) => u.id === this.selected)!
    const unitAt = state.units.find((u) => u.hp > 0 && hexEquals(u.position, at))
    if (this.targeting !== null && this.targeting !== 'attack') {
      // Only a unit or a centre the spell can be cast at is a target; any other click backs out of casting.
      const spell = this.targeting
      const cast = this.selectedCasts().find(
        (a) => a.spell === spell && ('at' in a ? hexEquals(a.at, at) : unitAt !== undefined && a.target === unitAt.id),
      )
      return cast ? { kind: 'cast', action: cast } : { kind: 'none' }
    }
    if (this.targeting) {
      // Only a foe already in reach is a target; any other click backs out of picking one.
      return unitAt && this.selectedAttacks().some((a) => a.target === unitAt.id)
        ? { kind: 'attack', target: unitAt.id, plan: { move: null, attack: true } }
        : { kind: 'none' }
    }
    if (unitAt && unitAt.side !== self.side) {
      return { kind: 'attack', target: unitAt.id, plan: planAttack(this.engine, self.id, unitAt.id) }
    }
    if (unitAt) {
      return unitAt.id !== self.id && this.actableUnits().includes(unitAt.id)
        ? { kind: 'select', unit: unitAt.id }
        : { kind: 'none' }
    }
    const move = this.engine
      .legalActions(self.id)
      .find((a): a is MoveAction => a.type === 'move' && hexEquals(a.to, at))
    return move ? { kind: 'move', action: move } : { kind: 'none' }
  }

  /**
   * Shows what a click on the hovered hex would do: an arrow to where the
   * selected unit would walk, and red on it and the foe it would go for, with
   * the cursor to match (crossed swords, faded when the AP can't cover a strike).
   */
  private refreshHover(): void {
    this.hoverMarks.clear()
    this.hoverLabels.removeAll(true)
    const intent: BoardIntent = this.hovered ? this.boardIntent(this.hovered) : { kind: 'none' }
    const selectedAt = () => this.engine.getState().units.find((u) => u.id === this.selected)!.position
    switch (intent.kind) {
      case 'none':
        this.input.setDefaultCursor(CURSORS.move)
        break
      case 'select':
        this.input.setDefaultCursor(CURSORS.select)
        break
      case 'move':
        this.input.setDefaultCursor(CURSORS.move)
        this.markDestination(selectedAt(), intent.action.to)
        break
      case 'attack': {
        this.input.setDefaultCursor(intent.plan.attack ? CURSORS.attack : CURSORS.attackDisabled)
        const from = selectedAt()
        const foeAt = this.hovered!
        for (const h of [from, foeAt]) {
          const polygon = this.hexPolygon(h)
          this.hoverMarks.fillStyle(ATTACK_HIGHLIGHT, intent.plan.attack ? 0.55 : 0.3)
          this.hoverMarks.fillPoints(polygon, true)
          this.hoverMarks.lineStyle(3, ATTACK_HIGHLIGHT, intent.plan.attack ? 1 : 0.6)
          this.hoverMarks.strokePoints(polygon, true)
        }
        if (intent.plan.move) this.markDestination(from, intent.plan.move.to)
        break
      }
      case 'cast':
        this.input.setDefaultCursor(CURSORS.attack)
        this.markCast(intent.action, selectedAt())
        break
    }
  }

  /**
   * Outlines the caster and what a cast would be aimed at; for an area, every
   * hex of it, and on each unit it would touch, allies and the caster
   * included, the odds of a hostile spell striking it, so friendly fire is
   * seen before it is paid for.
   */
  private markCast(action: CastAction, from: Hex): void {
    const state = this.engine.getState()
    const aim = 'at' in action ? action.at : state.units.find((u) => u.id === action.target)!.position
    const { radius = 0, hostile, target } = SPELLS[action.spell]
    const hexes = target === 'area' ? areaHexes(aim, radius).filter((h) => this.board.contains(h)) : [aim]
    this.hoverMarks.lineStyle(3, SPELL_HIGHLIGHT, 1)
    for (const h of [from, ...hexes]) this.hoverMarks.strokePoints(this.hexPolygon(h), true)
    if (target !== 'area') return
    this.hoverMarks.fillStyle(SPELL_HIGHLIGHT, 0.35)
    for (const h of hexes) this.hoverMarks.fillPoints(this.hexPolygon(h), true)
    const preview = this.engine.previewCast(action.unit, action.spell, 'at' in action ? action.at : action.target)
    for (const { unit, hitChance } of preview?.outcomes ?? []) {
      const at = state.units.find((u) => u.id === unit)!.position
      this.addChanceLabel(hostile && hitChance !== null ? `${Math.round(hitChance * 100)}%` : '+', at, this.hoverLabels)
    }
  }

  /** Outlines `to` and draws a curved arrow to it from `from`. */
  private markDestination(from: Hex, to: Hex): void {
    const g = this.hoverMarks
    g.lineStyle(3, HOVER_OUTLINE, 1)
    g.strokePoints(this.hexPolygon(to), true)
    const { shaft: points, head } = curvedArrow(boardHexCenter(from), boardHexCenter(to))
    const shaft = points.map((p) => new Phaser.Math.Vector2(p.x, p.y))
    // A dark edge under the arrow keeps it visible over every floor shade and highlight.
    g.lineStyle(7, ARROW_EDGE, 0.6)
    g.strokePoints(shaft, false)
    g.lineStyle(4, ARROW_EDGE, 0.6)
    g.strokeTriangle(head[0].x, head[0].y, head[1].x, head[1].y, head[2].x, head[2].y)
    g.lineStyle(3, ARROW_COLOR, 1)
    g.strokePoints(shaft, false)
    g.fillStyle(ARROW_COLOR, 1)
    g.fillTriangle(head[0].x, head[0].y, head[1].x, head[1].y, head[2].x, head[2].y)
  }

  /** "60%" on a foe's nameplate when the selected unit can attack it, with "+3" for flanking, side and rear bonuses. */
  private addHitChanceLabel(attacker: UnitId, target: UnitId, at: Hex): void {
    const preview = this.engine.previewAttack(attacker, target)
    if (!preview) return
    const percent = Math.round(preview.hitChance * 100)
    const bonus = preview.flankBonus + preview.arcBonus
    this.addChanceLabel(`${percent}%${bonus > 0 ? ` +${bonus}` : ''}`, at)
  }

  /** A label on the nameplate of the unit at `at`, where its AP pips would be. */
  private addChanceLabel(text: string, at: Hex, layer = this.labelLayer): void {
    const { x, y } = boardHexCenter(at)
    const label = this.add
      .text(x, y + PLATE_STATUS_Y, text, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#000000b3',
        padding: { x: 3, y: 0 },
      })
      .setOrigin(0.5)
    layer.add(label)
  }

  // ---- battle log ---------------------------------------------------------

  private pushLog(line: string): void {
    this.log.push(line)
    this.renderLog()
  }

  private renderLog(): void {
    this.logText.setText(this.log.visibleLines().join('\n'))
    this.updateLogScrollbar()
  }

  private onLogWheel(pointer: Phaser.Input.Pointer, deltaY: number): void {
    if (!this.logBoxBg.getBounds().contains(pointer.x, pointer.y)) return
    this.log.scrollBy(deltaY > 0 ? -1 : 1)
    this.renderLog()
  }

  private onLogThumbDrag(dragY: number): void {
    const trackY = this.logScrollTrack.y
    const travel = this.logScrollTrack.height - this.logScrollThumb.height
    if (travel <= 0) return
    const clampedY = Phaser.Math.Clamp(dragY, trackY, trackY + travel)
    this.log.scrollToRatio(1 - (clampedY - trackY) / travel)
    this.renderLog()
  }

  private onLogTrackClick(pointer: Phaser.Input.Pointer): void {
    const direction = pointer.y < this.logScrollThumb.y ? 1 : -1
    this.log.scrollBy(direction * LOG_VISIBLE_LINES)
    this.renderLog()
  }

  private updateLogScrollbar(): void {
    const barW = 8
    const trackX = this.logBoxBg.x + this.logBoxBg.width - barW - 4
    const trackY = this.logBoxBg.y + 4
    const trackH = LOG_BOX_H - 8
    const thumb = this.log.thumb(trackH, 16)

    this.logScrollTrack.setVisible(thumb !== null)
    this.logScrollThumb.setVisible(thumb !== null)
    if (!thumb) return

    this.logScrollTrack.setPosition(trackX, trackY)
    // Rectangle.setSize also resizes a default (non-custom) hit area.
    this.logScrollTrack.setSize(barW, trackH)
    this.logScrollThumb.setPosition(trackX, trackY + thumb.y)
    this.logScrollThumb.setSize(barW, thumb.height)
  }

  // ---- turn logic -----------------------------------------------------

  /**
   * Renders engine events one after another — a move's walk, then any free
   * attack that interrupts it, then the rest of the walk — so log lines, HP
   * bars and hit flashes land when they happen. Returns the total time, in ms.
   */
  private applyEvents(events: readonly BattleEvent[]): number {
    const { beats, totalMs } = scheduleEvents(events, {
      moveStepMs: MOVE_STEP_MS,
      opportunityPauseMs: OPPORTUNITY_PAUSE_MS,
      tickPauseMs: TICK_PAUSE_MS,
    })
    for (const { at, cues } of beats) {
      if (at === 0) this.playCues(cues)
      else this.time.delayedCall(at, () => this.playCues(cues))
    }
    // AP is spent the moment the action is taken; HP follows the animation.
    this.refreshAllApPips()
    if (totalMs === 0) this.syncUnitsFromEngine()
    else this.time.delayedCall(totalMs, () => this.syncUnitsFromEngine())
    return totalMs
  }

  private playCues(cues: readonly Cue[]): void {
    for (const cue of cues) {
      if (cue.kind === 'show') this.showEvent(cue.event)
      else this.faceUnit(cue.unit, cue.facing)
    }
  }

  private showEvent(event: BattleEvent): void {
    this.pushLog(formatEvent(event, this.names))
    // The theme gives way to the victory or defeat sting.
    if (event.type === 'battle_end') this.stopMusic()
    for (const { key, delayMs } of eventSounds(event)) {
      if (delayMs === 0) this.playSound(key)
      else this.time.delayedCall(delayMs, () => this.playSound(key))
    }
    if (event.type === 'move') {
      this.animateMove(event.unit, event.from, event.path)
    }
    if (event.type === 'attack') {
      this.faceUnit(event.attacker, event.attackerFacing)
      this.lunge(event.attacker, event.defender)
      const defender = this.units.get(event.defender)!
      if (event.image) this.flash(defender, IMAGE_TINT)
      else if (event.hit) this.flash(defender, HURT_TINT)
      const maxHp = this.engine.getState().units.find((u) => u.id === event.defender)!.maxHp
      this.refreshHpDisplay(defender, event.defenderHpAfter, maxHp)
    }
    if (event.type === 'cast') this.showCast(event)
    if (event.type === 'status_tick') {
      const unit = this.units.get(event.unit)!
      this.flash(unit, HURT_TINT)
      this.refreshHpDisplay(unit, event.hpAfter, this.engine.getState().units.find((u) => u.id === event.unit)!.maxHp)
    }
    if (event.type === 'cast' || event.type === 'status_end' || event.type === 'status_tick' || event.type === 'unit_down') {
      this.refreshAllStatusMarks()
    }
    if (event.type === 'unit_down') this.showFallen(event.unit)
  }

  /**
   * A cast: the caster turns, a bolt flies to where it was aimed (none for a
   * spell centred on the caster), an area glows, and each unit touched flashes
   * as it fared, its hit points following.
   */
  private showCast(event: Extract<BattleEvent, { type: 'cast' }>): void {
    this.faceUnit(event.caster, event.casterFacing)
    const units = this.engine.getState().units
    const casterAt = units.find((u) => u.id === event.caster)!.position
    const { target, radius = 0, hostile } = SPELLS[event.spell]
    const land = () => {
      if (target === 'area') this.flashArea(areaHexes(event.at, radius).filter((h) => this.board.contains(h)))
      for (const outcome of event.outcomes) {
        const unit = this.units.get(outcome.unit)!
        if (outcome.image) this.flash(unit, IMAGE_TINT)
        else if (!hostile) this.flash(unit, HELPED_TINT)
        else if (outcome.hit) this.flash(unit, HURT_TINT)
        this.refreshHpDisplay(unit, outcome.hpAfter, units.find((u) => u.id === outcome.unit)!.maxHp)
      }
    }
    if (hexEquals(event.at, casterAt)) land()
    else this.flyBolt(event.caster, event.at, land)
  }

  /** Lights an area's hexes for a moment. */
  private flashArea(hexes: readonly Hex[]): void {
    const glow = this.add.graphics()
    glow.fillStyle(SPELL_BOLT, 0.45)
    for (const h of hexes) glow.fillPoints(this.hexPolygon(h), true)
    this.floorLayer.add(glow)
    this.tweens.add({ targets: glow, alpha: 0, duration: AREA_FLASH_MS, onComplete: () => glow.destroy() })
  }

  private refreshAllStatusMarks(): void {
    for (const snapshot of this.engine.getState().units) {
      this.refreshStatusMarks(this.units.get(snapshot.id)!, snapshot.hp > 0 ? snapshot.statuses : [])
    }
  }

  /** Flies a spell's bolt from a unit to a hex, chest high, and calls `onArrive` as it lands. */
  private flyBolt(from: UnitId, to: Hex, onArrive: () => void): void {
    const chest = (id: UnitId) => {
      const { x, y } = this.units.get(id)!.container
      return { x, y: y - UNIT_HEIGHT / 3 }
    }
    const start = chest(from)
    const end = boardHexCenter(to)
    const bolt = this.add.graphics({ x: start.x, y: start.y })
    bolt.fillStyle(SPELL_BOLT, 1).fillCircle(0, 0, 5).lineStyle(2, 0xffffff, 0.9).strokeCircle(0, 0, 5)
    // With the labels: over every unit and nameplate, and scaled and placed as the board is.
    this.labelLayer.add(bolt)
    this.tweens.add({
      targets: bolt,
      x: end.x,
      y: end.y - UNIT_HEIGHT / 3,
      duration: SPELL_FLIGHT_MS,
      onComplete: () => {
        bolt.destroy()
        onArrive()
      },
    })
  }

  /** Leans a unit into its strike and back; its hex, plate and shadow stay where they are. */
  private lunge(id: UnitId, at: UnitId): void {
    const { figure, container } = this.units.get(id)!
    const target = this.units.get(at)!.container
    const reach = new Phaser.Math.Vector2(target.x - container.x, target.y - container.y).setLength(LUNGE_PX)
    this.tweens.add({ targets: figure, x: reach.x, y: reach.y, duration: LUNGE_MS, yoyo: true, ease: 'Quad.easeOut' })
  }

  /** Walks a unit along its path, turning it towards each step as it takes it. */
  private animateMove(id: UnitId, from: Hex, path: readonly Hex[]): void {
    if (path.length === 0) return
    const { container, plate, figure } = this.units.get(id)!
    figure.play('walk')
    this.tweens.chain({
      targets: [container, plate],
      // A unit cut down on its way stays down.
      onComplete: () => this.standing(id) && figure.play('idle'),
      tweens: path.map((h, i) => ({
        ...boardHexCenter(h),
        duration: MOVE_STEP_MS,
        onStart: () => this.faceUnit(id, hexDirection(i === 0 ? from : path[i - 1], h)!),
        onUpdate: () => this.sortUnits(),
      })),
    })
  }

  /** The engine owns HP during battle; write it back to the persistent characters. */
  private syncUnitsFromEngine(): void {
    for (const snapshot of this.engine.getState().units) {
      const member = this.heroes.get(snapshot.id)
      if (member) member.hp = snapshot.hp
      this.faceUnit(snapshot.id, snapshot.facing)
      this.refreshHpDisplay(this.units.get(snapshot.id)!, snapshot.hp, snapshot.maxHp)
    }
    this.refreshAllStatusMarks()
    this.refreshAllApPips()
    this.column.refresh(this.activeIndex())
  }

  private refreshAllApPips(): void {
    const state = this.engine.getState()
    for (const snapshot of state.units) this.refreshApPips(this.units.get(snapshot.id)!, snapshot, state.phase)
  }

  private setPlayerControl(enabled: boolean): void {
    this.closeSpellMenu()
    this.playerControl = enabled
    if (enabled) this.ensureSelection()
    const attacks = enabled ? this.selectedAttacks().length : 0
    const casts = enabled ? this.selectedCasts() : []
    // Picking a target ends when control is lost or the action it was for is no longer legal.
    if (this.targeting === 'attack' ? attacks < 2 : !casts.some((cast) => cast.spell === this.targeting)) {
      this.targeting = null
    }
    const casting = this.targeting !== null && this.targeting !== 'attack'
    this.setButtonEnabled(this.attackButton, attacks > 0)
    this.setButtonLabel(this.attackButton, this.targeting === 'attack' ? 'Cancel' : 'Attack')
    // The Cast button is the selected unit's: it shows the mana it has left, and only for a unit with magic.
    const caster = this.engine.getState().units.find((u) => u.id === this.selected && u.magic)
    this.castButton.setVisible(caster !== undefined && this.engine.getState().phase !== 'over')
    this.setButtonEnabled(this.castButton, casts.length > 0)
    this.setButtonLabel(this.castButton, casting ? 'Cancel' : `Cast (${caster?.mana ?? 0})`)
    this.setButtonEnabled(this.endTurnButton, enabled)
    this.refreshHighlights()
    this.updateRoundText()
    this.column.refresh(this.activeIndex())
  }

  private setTargeting(what: 'attack' | SpellId | null): void {
    this.targeting = what
    this.setPlayerControl(this.playerControl)
  }

  private onBoardClick(pointer: Phaser.Input.Pointer): void {
    if (!this.playerControl) return
    // A click away from the open spell list closes it, and does nothing else.
    if (this.spellMenu) {
      this.closeSpellMenu()
      return
    }
    const clicked = this.hexAt(pointer.x, pointer.y)
    if (!clicked) return
    const intent = this.boardIntent(clicked)
    if (intent.kind === 'select') {
      this.selected = intent.unit
      this.setPlayerControl(true)
    } else if (intent.kind === 'move') {
      this.playerAct(intent.action)
    } else if (intent.kind === 'attack') {
      this.goFor(intent.target, intent.plan)
    } else if (intent.kind === 'cast') {
      this.playerAct(intent.action)
    } else if (this.targeting) {
      this.setTargeting(null)
    }
  }

  /** Carries out a plan for the selected unit to go for a foe: walk up to it, strike it, or both. */
  private goFor(target: UnitId, { move, attack }: AttackPlan): void {
    const unit = this.selected!
    const strike: Action = { type: 'attack', unit, target }
    if (!move) {
      if (attack) this.playerAct(strike)
      return
    }
    if (!attack) {
      this.playerAct(move)
      return
    }
    this.setPlayerControl(false)
    const animationMs = this.applyEvents(this.engine.step(move))
    this.time.delayedCall(animationMs + APPROACH_PAUSE_MS, () => {
      // A free attack on the way may have felled the unit, or ended the battle.
      const stillLegal = this.engine.legalActions(unit).some((a) => a.type === 'attack' && a.target === target)
      if (stillLegal) this.playerAct(strike)
      else this.continueBattle()
    })
  }

  /** Attacks the only foe in reach, or asks which one when there are several; pressed again, cancels. */
  private onAttack(): void {
    if (!this.playerControl) return
    if (this.targeting === 'attack') {
      this.setTargeting(null)
      return
    }
    const attacks = this.selectedAttacks()
    if (attacks.length === 1) this.playerAct(attacks[0])
    else if (attacks.length > 1) this.setTargeting('attack')
  }

  /**
   * Opens the list of the selected unit's spells, from which one is picked to
   * aim; pressed again, or while a spell is being aimed, it cancels. A spell
   * always asks for its target, even with one in reach: mana is too dear to
   * spend on a slip.
   */
  private onCast(): void {
    if (!this.playerControl) return
    if (this.spellMenu) {
      this.closeSpellMenu()
      return
    }
    if (this.targeting !== null && this.targeting !== 'attack') {
      this.setTargeting(null)
      return
    }
    const self = this.engine.getState().units.find((u) => u.id === this.selected)
    if (self) this.openSpellMenu(self)
  }

  /** The spell list over the Cast button: a row a spell, numbered, greyed where it cannot be cast now. */
  private openSpellMenu(self: UnitSnapshot): void {
    if (this.targeting === 'attack') this.setTargeting(null)
    const rows = spellMenuRows(self, this.engine.legalActions(self.id))
    const container = this.add.container(this.castButton.x, this.castButton.y - 22 - 6)
    const menu = { container, rows: [] as Array<{ spell: SpellId; enabled: boolean; bg: Phaser.GameObjects.Rectangle }> }
    rows.forEach(({ spell, label, enabled }, i) => {
      const y = -(rows.length - i - 0.5) * SPELL_ROW_H
      const bg = this.add
        .rectangle(0, y, SPELL_ROW_W, SPELL_ROW_H - 2, enabled ? 0x2b6cb0 : 0x424242)
        .setStrokeStyle(1, 0x90cdf4)
        .setInteractive({ useHandCursor: enabled })
      const text = this.add
        .text(-SPELL_ROW_W / 2 + 8, y, `${i + 1}. ${label}`, { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff' })
        .setOrigin(0, 0.5)
        .setAlpha(enabled ? 1 : 0.5)
      bg.on('pointerover', () => {
        if (enabled) bg.setFillStyle(0x3182ce)
        this.hintText.setText(`${SPELLS[spell].name}: ${SPELLS[spell].description}.`)
      })
      bg.on('pointerout', () => bg.setFillStyle(enabled ? 0x2b6cb0 : 0x424242))
      bg.on('pointerdown', () => this.pickSpell(i))
      container.add([bg, text])
      menu.rows.push({ spell, enabled, bg })
    })
    this.spellMenu = menu
    this.setButtonLabel(this.castButton, 'Cancel')
  }

  private closeSpellMenu(): void {
    if (!this.spellMenu) return
    this.spellMenu.container.destroy()
    this.spellMenu = null
    const caster = this.engine.getState().units.find((u) => u.id === this.selected && u.magic)
    this.setButtonLabel(this.castButton, `Cast (${caster?.mana ?? 0})`)
  }

  /** Picks the `index`th row of the open spell list, if it can be cast, to aim it. */
  private pickSpell(index: number): void {
    const row = this.spellMenu?.rows[index]
    if (!row?.enabled) return
    this.playSound('sfx_ui_click')
    this.closeSpellMenu()
    this.setTargeting(row.spell)
  }

  private onEndTurn(): void {
    if (this.playerControl) this.playerAct({ type: 'end_turn' })
  }

  private playerAct(action: Action): void {
    this.setPlayerControl(false)
    const animationMs = this.applyEvents(this.engine.step(action))
    const pause = action.type === 'attack' || action.type === 'cast' ? 600 : action.type === 'end_turn' ? 300 : 0
    this.time.delayedCall(animationMs + pause, () => this.continueBattle())
  }

  /** Hands control to whoever acts next: the battle's end, an enemy, or a player unit. */
  private continueBattle(): void {
    const { phase, round } = this.engine.getState()
    if (phase === 'over') {
      this.endBattle()
      return
    }
    if (phase === 'enemy') {
      this.runEnemyAction()
      return
    }
    // The player's turn begins: nothing is animating and no unit is half-way through anything.
    if (round !== this.savedRound) {
      this.savedRound = round
      this.save()
    }
    this.setPlayerControl(true)
  }

  /**
   * Writes the game to its slot with the battle as it stands, or, once the
   * battle is won, as the world map will find it. If the browser refuses, play
   * goes on and the log says so, once.
   */
  private save(): void {
    const over = this.engine.getState().phase === 'over'
    // A battle with no monster location behind it is a test's: a load would have nowhere to take it up.
    if (!over && !this.location) return
    const battle: SavedBattle | null = over
      ? null
      : {
          location: this.location!.id,
          engine: this.engine.snapshot(),
          enemyRng: this.enemyRng.state(),
          ground: this.ground.piles(),
        }
    if (saveGame(this.gameState, battle) || this.registry.get(SAVE_WARNED_KEY)) return
    this.registry.set(SAVE_WARNED_KEY, true)
    this.pushLog(SAVE_FAILED_MESSAGE)
  }

  /** Plays one enemy action, then continues; the enemy's turn runs until its policy ends it. */
  private runEnemyAction(): void {
    this.updateRoundText()
    this.time.delayedCall(400, () => {
      const action = POLICIES[ENEMY_POLICY]({
        state: this.engine.getState(),
        legal: this.engine.legalActions(),
        rng: this.enemyRng,
      })
      const animationMs = this.applyEvents(this.engine.step(action))
      this.time.delayedCall(animationMs + 200, () => this.continueBattle())
    })
  }

  private playSound(key: SoundKey): void {
    this.sound.play(key, { volume: soundVolume(key) })
  }

  private resumeMusic(): void {
    if (!this.music) return
    this.music.setVolume(soundVolume('music_battle'))
    if (this.music.isPaused) this.music.resume()
  }

  private stopMusic(): void {
    this.music?.destroy()
    this.music = null
  }

  private flash(unit: Unit, tint: number): void {
    unit.figure.setFigureTint(tint)
    this.time.delayedCall(150, () => unit.figure.setFigureTint(null))
  }

  private endBattle(): void {
    const state = this.engine.getState()
    const playerWon = state.winner === 'player'
    this.setPlayerControl(false)
    this.attackButton.setVisible(false)
    this.castButton.setVisible(false)
    this.endTurnButton.setVisible(false)
    // The win and what it won are the world's from here on, however the scene is left.
    const found = playerWon && this.location ? takeLoot(this.gameState, this.location) : []
    if (playerWon && this.location) clearLocation(this.gameState.world, this.location.id)
    const foes = this.location ? `The ${this.location.name}` : 'Your foes'
    // The reward goes by the hit points the party ended on: who fell, and so who gets back up.
    this.syncUnitsFromEngine()
    // What mana a winner has left is its own, to heal with on the world map; a level or a day of camping fills it.
    if (playerWon) {
      for (const unit of state.units) {
        const member = this.heroes.get(unit.id)
        if (member) member.mana = unit.mana
      }
    }
    const xpLines = playerWon ? describeRewards(rewardVictory(this.gameState.party, this.xpReward)) : []
    this.xpReward = 0
    if (playerWon) {
      // Kept as it happens: a page reloaded on the victory screen opens the world map with the win.
      this.save()
    } else if (this.gameState.slot !== null) {
      // Permadeath: the playthrough is over and its slot is free. Nothing writes it back.
      deleteSlot(this.gameState.slot)
      this.gameState.slot = null
    }
    const lootLines = found.length > 0 ? [`Found: ${listNames(found.map((item) => item.name))}.`] : []
    this.bannerText.setText(playerWon ? 'VICTORY!' : 'DEFEAT')
    this.bannerText.setColor(playerWon ? '#66bb6a' : '#ef5350')
    this.resultText.setText(
      playerWon
        ? [`${foes} are beaten.`, ...xpLines, ...lootLines].join('\n')
        : 'The party has fallen. The journey ends here.',
    )
    this.setButtonLabel(this.menuButton, playerWon ? 'OK' : 'Main Menu')
    this.layout()
    for (const part of [this.resultShade, this.bannerText, this.resultText, this.menuButton]) part.setVisible(true)
    this.updateRoundText()
    // The reward may have raised levels and healed wounds.
    this.column.refresh(this.activeIndex())
    this.dumpLog()
  }

  /** Structured dump for balancing/AI tooling to scrape from devtools; once per battle. */
  private dumpLog(): void {
    if (this.logDumped) return
    this.logDumped = true
    console.info('[battle-log]', JSON.stringify(this.engine.getLog()))
  }
}
