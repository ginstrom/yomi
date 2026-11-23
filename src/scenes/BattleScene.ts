import Phaser from 'phaser'
import { deriveCombatStats, gearChanges, type Character } from '../character/character.ts'
import { sameCombatStats, type Element as DamageElement } from '../combat/combat.ts'
import { mulberry32, randomSeed, type SeededRng } from '../combat/rng.ts'
import { ABILITIES } from '../combat/abilities.ts'
import { SPELLS, STATUSES, type ActiveStatus } from '../combat/spells.ts'
import {
  BattleEngine,
  abilityArea,
  formatEvent,
  listNames,
  type Action,
  type BattleEvent,
  type Phase,
  type UnitId,
  type UnitSnapshot,
} from '../engine/battleEngine.ts'
import { AUTO_POLICY, ENEMY_POLICY, autoLastRound, playOut } from '../engine/autoPlay.ts'
import { POLICIES } from '../engine/policies.ts'
import type { Expedition } from '../game/expedition.ts'
import { ENCOUNTERS, heroId, xpReward, type EncounterId, type UnitKind } from '../game/encounters.ts'
import { newGame, selectedParty, takeLoot, type GameState } from '../game/gameState.ts'
import { takeRunes, takeTrophies } from '../game/loot.ts'
import { Ground, pileChanges } from '../game/ground.ts'
import { describeRewards, partyFighters, rewardVictory } from '../game/party.ts'
import { FORECAST_SLICE_MS, Forecaster, battleForecastBase, forecastHint, forecastLabel, workFor, type Forecast } from '../game/forecast.ts'
import type { SavedBattle } from '../game/save.ts'
import { SAVE_FAILED_MESSAGE, SAVE_WARNED_KEY, deleteSlot, saveGame } from '../game/saveSlots.ts'
import { clearLocation, encampmentName, theName, theNameCapital, type MonsterLocation } from '../game/worldMap.ts'
import { wipeParty, type Wipe } from '../game/company.ts'
import type { Equipment, Item } from '../inventory/inventory.ts'
import {
  HEX_DIRECTIONS,
  HexBoard,
  areaOf,
  hexCorners,
  hexDirection,
  hexDistance,
  hexEquals,
  hexToPixel,
  type BoardSize,
  type Hex,
} from '../grid/hex.ts'
import { buttonProbe, type BattleProbe } from '../testHook.ts'
import { noStrikeHint, planAttack, type AttackPlan } from './attackPlan.ts'
import { FLOOR_SQUASH_Y, HEX_SIZE, boardHexAt, boardHexCenter, boardPixelSize, curvedArrow } from './boardGeometry.ts'
import { CURSORS, spellCursor } from './cursors.ts'
import {
  AREA_SWEEP_MS,
  ARROW_SPRITE,
  BURST_ANIM,
  BURST_SPRITE,
  EFFECT_FRAME,
  MISSILE_SPRITES,
  OUTLINE_CRITICAL,
  OUTLINE_HURT,
  OUTLINE_HEALED,
  OUTLINE_IMAGE,
  RELEASE_MS,
  SPELL_LOOKS,
  SWING_IMPACT_MS,
  TIP_POINT,
  abilityLook,
  areaOutline,
  attackLook,
  castOutline,
  flightMs,
  holdMs,
  impactMs,
  MOVE_STEP_MS,
  strikeFlash,
  type SpellLook,
  bonusElement,
  bonusText,
  changesStatusMarks,
  attackerNotes,
  defenderNotes,
  restoreFloats,
  type FloatNote,
} from './battleEffects.ts'
import { DESCRIPTION_INDENT, foeInfoLines } from './foeInfo.ts'
import { scheduleEvents, type Cue } from './eventSchedule.ts'
import { ScrollingLog } from './scrollingLog.ts'
import { SEED_KEY } from './seed.ts'
import { pauseMusic, playCue, playCues as playSoundCues, resumeMusic, startMusic, stopMusic } from './soundPlayer.ts'
import { ITEM_ICON_KEYS, ITEM_ICON_SCALE, RUNE_COLOURS, cssColour, iconTint } from './itemIcons.ts'
import { PartyColumn } from './PartyColumn.ts'
import { UnitFigure } from './UnitFigure.ts'
import { CHEST_POINT, SPRITE_ATLAS, heroLook, pointFromAnchor, spriteAnim, spriteFrame } from './unitLook.ts'
import { trophiesLine } from './forgeView.ts'
import { AUTO_DRAG_ON_LINE, DEFAULT_ENCOUNTER, autoResolvedLine, battleSeed, chooseBattle, foundNames } from './battleSetup.ts'
import { battleCost, costLines } from './battleCost.ts'
import { HEADER_BOTTOM, PARTY_PANEL_W, portraitClick, portraitRect } from './partyPanel.ts'
import { plateNames } from './plateNames.ts'
import { showStory, type StoryAnchors } from './StoryScene.ts'
import { storyFor, type StoryItem } from '../story/story.ts'
import { eventSounds, levelUpDelayMs, type SoundContext } from './sounds.ts'
import { describeStatuses, skillDescription, skillMenuRows, skillName, targetingHint, usesSkill, type Skill, type SkillMenuRow } from './skillMenu.ts'
import type { DebugSource } from './debugCommands.ts'
import { STATUS_MARK_FONT_PX, STATUS_MARK_LIFT, STATUS_MARK_STROKE_PX, statusMarkLayout } from './statusMarks.ts'

interface BattleData {
  game?: GameState
  /** The id of the party that fights; the first if left out or unknown. */
  party?: string
  /** The id of the monster location on the world map that this battle is fought at. */
  location?: string
  /** Without a location only (the debug console's `fight`): the encounter to fight, and the threat to fight it at. */
  encounter?: EncounterId
  threat?: number
  /** A battle read from a save slot, to take up where it stood instead of starting one. */
  saved?: SavedBattle
  /** Auto-resolve the battle from its first moment (the world map's Auto-resolve); a saved battle ignores it. */
  auto?: boolean
}

type MoveAction = Extract<Action, { type: 'move' }>
/** A use of a skill: a cast of a spell or a use of an ability. */
type SkillAction = Extract<Action, { type: 'cast' | 'ability' }>

/** What a click on a board hex would do, as shown while the pointer hovers over it. */
type BoardIntent =
  | { kind: 'none' }
  | { kind: 'select'; unit: UnitId }
  | { kind: 'move'; action: MoveAction }
  /** Go for a foe: the plan may move first, and strikes only if `plan.attack`. */
  | { kind: 'attack'; target: UnitId; plan: AttackPlan }
  /** Use the skill being aimed at the unit or the area's centre clicked. */
  | { kind: 'skill'; action: SkillAction }

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
  /** The letters `statusMarks` shows, in order. */
  marks: string
  /** The hit points the nameplate shows now, which an event's playback moves ahead of the engine's. */
  shownHp: number
}

/** Flagstone greys from art/palette.toml, so the floor sits with the sprites. */
const FLOOR_COLORS = [0x787062, 0x6b6457, 0x5a544a]
const FLOOR_EDGE = 0x14100c
const MOVE_HIGHLIGHT = 0x1e88e5
const MOVE_OUTLINE = 0x90caf9
const ATTACK_HIGHLIGHT = 0xe53935
const SPELL_HIGHLIGHT = 0x7e57c2
/** How long an area spell's hexes glow as it lands. */
const AREA_FLASH_MS = 300
/** A wand's bolt. */
const WAND_BOLT = 0x80deea
/** How high an arrow arcs over each hex it flies, in pixels, up to the most. */
const ARROW_ARC_PER_HEX = 6
const ARROW_ARC_MAX = 30
/** A melee blow's slash across the defender, in its attacker's colour of steel. */
const SLASH_COLOUR = 0xffffff
const SLASH_MS = 160
/** How long an outline rings a unit that a blow or a spell lands on. */
const OUTLINE_MS = 420
/** How far a hit knocks a unit back and a miss has it sway aside, in pixels. */
const KNOCK_PX = 5
const DODGE_PX = 7
/** How high a unit's step lifts it, in pixels. */
const STEP_BOB_PX = 3
/** The pause each status's damage, and each regeneration, at a turn's start is given. */
const TICK_PAUSE_MS = 350
/** What a unit flashes: hurt, healed or helped, or an image struck in its place. */
const HURT_TINT = 0xff8a80
const HELPED_TINT = 0xa5f5a5
/** The floating on-hit text's colour: the element's, else a plain warm one. */
const FLOAT_COLOUR = '#ffd27a'
/** The colours of the floating notes: a restore's hit points green, its mana blue, any other note the warm one. */
const FLOAT_NOTE_COLOURS: Record<FloatNote['kind'], string> = { heal: '#7ee07e', mana: '#6fa8ff', note: FLOAT_COLOUR }
const ELEMENT_FLOAT_COLOURS: Record<DamageElement, string> = {
  fire: cssColour(RUNE_COLOURS.ember),
  frost: cssColour(RUNE_COLOURS.rime),
  lightning: cssColour(RUNE_COLOURS.storm),
  poison: cssColour(RUNE_COLOURS.venom),
  acid: cssColour(RUNE_COLOURS.acid),
  blight: cssColour(RUNE_COLOURS.dawn),
}

const IMAGE_TINT = 0xffffff
/** The Skills list's rows, stacked upwards from over the Skills button: at least this wide, wider for a long label. */
const SKILL_ROW_W = 240
const SKILL_ROW_H = 26
/** The width a character of the list's 13px monospace takes, to fit a row to its label. */
const SKILL_CHAR_W = 8
/** From one button's centre to the next; the row of four fits the least window (MIN_GAME_SIZE in main.ts) beside the party's column. */
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
/** Pause after a free attack lands, before the mover walks on. */
const OPPORTUNITY_PAUSE_MS = 450
/** Pause after a unit walks up to a foe, before it strikes. */
const APPROACH_PAUSE_MS = 120
/** Nameplate rows, in pixels below a unit's feet: name, HP bar, then AP pips or a foe's hit chance. */
const PLATE_NAME_Y = -3
/** Plate text, outlined so that it stays legible over the floor, highlights and other units; and the name's. */
const PLATE_TEXT_STYLE = { fontFamily: 'monospace', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }
const PLATE_NAME_STYLE = { ...PLATE_TEXT_STYLE, fontSize: '12px' }
const PLATE_BAR_Y = 11
const PLATE_BAR_W = 52
const PLATE_BAR_H = 10
const PLATE_STATUS_Y = 27
/** How far a nameplate's lowest row reaches below a unit's feet. */
const PLATE_BOTTOM = PLATE_STATUS_Y + 8
/** Clear space either side of the board, and between the board and the log box. */
const BOARD_MARGIN_X = 16
const BOARD_GAP_ABOVE_LOG = 12
/** How far the board is scaled up to fill a large window. */
const BOARD_MAX_SCALE = 2
const LOG_HISTORY = 50
const LOG_VISIBLE_LINES = 5
const LOG_LINE_H = 20
const LOG_BOX_PADDING = 10
const LOG_BOX_H = LOG_VISIBLE_LINES * LOG_LINE_H + LOG_BOX_PADDING * 2
const LOG_BOX_GAP = 14
/** Width kept clear of wrapped log text for the scrollbar. */
const LOG_SCROLLBAR_SPACE = 16

/**
 * Every unit sprite is a 32px canvas shown at 2x (before the board's own scale), so a small
 * creature is drawn small, not scaled down, and a figure stands about a hex tall without hiding
 * the hexes behind it. A kind's sprite is the atlas's of the same name (art/units/<kind>.sprite.toml).
 */
const UNIT_SCALE = 2
const UNIT_HEIGHT = 32 * UNIT_SCALE
/** Units breathe out of step: each starts this much after the one before it. */
const IDLE_STAGGER_MS = 230
/** How far a unit leans into its strike, and how long the lean out and back takes. */
const LUNGE_PX = 10
const LUNGE_MS = 70

export class BattleScene extends Phaser.Scene {
  private gameState!: GameState
  /** The party that fights. */
  private expedition!: Expedition
  /** The monsters being fought, which a victory clears from the world map. */
  private location: MonsterLocation | null = null
  /** The encounter fought and the threat it was built at (`Encounter.threat`, within its band). */
  private encounterId: EncounterId = DEFAULT_ENCOUNTER
  private threat = 1
  /** The experience a victory here is worth, until it is won. */
  private xpReward = 0
  /** The party member behind each player unit. */
  private heroes = new Map<UnitId, Character>()
  /** What each unit is, for the sounds it makes. */
  private kinds: Record<UnitId, UnitKind> = {}
  /** When the battle's end was shown, which the level-up sting counts from. */
  private endShownAt: number | null = null
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
  /** The rounds auto-resolve took to end the battle, for the result screen's line; null when it was not auto-resolved to its end. */
  private autoRounds: number | null = null
  /** What a lost battle did to the company (`wipeParty`), once it is lost; null until then, and after a win. */
  private wipe: Wipe | null = null
  private board!: HexBoard
  private names!: Record<UnitId, string>
  private logDumped = false
  /** True while the player may act; off during animations and the enemy's turn. */
  private playerControl = false
  /** The auto-resolve estimate being worked out for the battle as it stands, while the player has control; null otherwise. */
  private forecaster: Forecaster | null = null
  /** The `battleForecastBase` the forecaster (or the finished estimate) is for; null when there is none. */
  private forecastBase: number | null = null
  /** The finished estimate for the battle as it stands, which the Auto button's label shows; null until it is ready. */
  private shownForecast: Forecast | null = null
  /** Whether the pointer is over the Auto button, whose hover shows the estimate in the hint. */
  private autoHovered = false
  /** The player unit that board clicks and the Attack button act for. */
  private selected: UnitId | null = null
  /**
   * What the next board click picks a target for: an attack, after the Attack button was pressed
   * with several foes in reach, or the skill (a spell or an ability) the Skills button chose. Null outside both.
   */
  private targeting: 'attack' | Skill | null = null
  /** The Skills button's list of the selected unit's spells and abilities while it is open, a row each with whether it can be used now. */
  private skillMenu: { container: Phaser.GameObjects.Container; rows: Array<{ row: SkillMenuRow; bg: Phaser.GameObjects.Rectangle }> } | null = null
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
  /** Units' status letters, over every nameplate so that a neighbour's plate never hides them. */
  private markLayer!: Phaser.GameObjects.Container
  /** Hit-chance labels on attackable foes, drawn above the nameplates. */
  private labelLayer!: Phaser.GameObjects.Container
  /** The floating text of on-hit damage, apart from the labels so that redrawing the highlights leaves it be. */
  private floatLayer!: Phaser.GameObjects.Container
  /** The odds on each unit an area spell would touch, for the hovered centre; above the other labels. */
  private hoverLabels!: Phaser.GameObjects.Container
  /** The foe info panel (`foeInfoLines`) beside the hovered foe, and the lines it shows now. */
  private foePanel!: Phaser.GameObjects.Container
  private foeInfo: string[] = []

  /** The party's portraits down the left; the one marked is the member a panel opens for. */
  private column!: PartyColumn
  private roundText!: Phaser.GameObjects.Text
  private hintText!: Phaser.GameObjects.Text
  /** The header hint for what the unit is doing, and the warning shown instead while the pointer is over a foe no click can strike. */
  private baseHint = ''
  private hoverHint: string | null = null
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
  /** Resolves the rest of the battle at once with the AI playing the heroes; enabled with End Turn, no key. */
  private autoButton!: Phaser.GameObjects.Container
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
    this.expedition = selectedParty(this.gameState, data?.party)
    const party = this.expedition.members
    const chosen = chooseBattle(this.gameState.world, data)
    this.location = chosen.location
    this.encounterId = chosen.encounter
    const fight = ENCOUNTERS[chosen.encounter](partyFighters(party), chosen.threat)
    this.threat = fight.threat
    const { setup, kinds } = fight
    this.xpReward = xpReward(fight)
    this.heroes = new Map(party.map((member, i) => [heroId(i), member]))
    this.kinds = kinds
    this.endShownAt = null
    this.loggedEquipment = new Map(party.map((member, i) => [heroId(i), { ...member.equipment }]))
    this.openPiles = null
    this.savedRound = null
    this.autoRounds = null
    const saved = data?.saved
    const auto = !saved && data?.auto === true
    if (saved) {
      // The encounter above is built only for its kinds and its worth: the units are the engine's.
      this.engine = BattleEngine.restore(saved.engine)
      this.enemyRng = mulberry32(saved.enemyRng)
      this.ground = Ground.fromPiles(saved.ground)
    } else {
      // Every battle is seeded, by the page's address or at random, so every battle can be saved and replayed.
      const seed = (this.registry.get(SEED_KEY) as number | null | undefined) ?? randomSeed()
      this.engine = new BattleEngine(setup, { seed, meta: {
          source: 'game',
          enemyPolicy: ENEMY_POLICY,
          party: this.expedition.id,
          ...(auto ? { playerPolicy: AUTO_POLICY } : {}),
        },
      })
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
    this.dropForecast()
    this.autoHovered = false
    this.selected = null
    this.targeting = null
    this.skillMenu = null
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
    this.markLayer = this.add.container(0, 0)
    const shown = this.plateNames(fielded)
    this.units = new Map(fielded.map((u, i) => [u.id, this.createUnit(shown.get(u.id)!, kinds[u.id], i * IDLE_STAGGER_MS)]))
    this.refreshGear()
    this.labelLayer = this.add.container(0, 0)
    this.hoverLabels = this.add.container(0, 0)
    this.floatLayer = this.add.container(0, 0)
    this.foePanel = this.add.container(0, 0)
    this.foeInfo = []

    this.roundText = this.add
      .text(20, 16, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' })
      .setScrollFactor(0)
    this.hintText = this.add
      .text(20, 38, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#9e9e9e',
        lineSpacing: -2,
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
    this.events.on(Phaser.Scenes.Events.RESUME, () => resumeMusic())
    // The character panel tells the member it last showed; the menu tells nothing.
    this.events.on(Phaser.Scenes.Events.RESUME, (_sys: Phaser.Scenes.Systems, data?: { member?: number }) => {
      if (data?.member !== undefined) this.selectHero(data.member)
      this.commitGearChange()
    })

    this.attackButton = this.createButton('Attack', () => this.onAttack())
    this.castButton = this.createButton('Skills', () => this.onSkills())
    this.endTurnButton = this.createButton('End Turn', () => this.onEndTurn())
    this.autoButton = this.createButton(forecastLabel(null, true), () => this.onAutoResolve())
    const autoBg = this.autoButton.getData('bg') as Phaser.GameObjects.Rectangle
    autoBg.on('pointerover', () => {
      this.autoHovered = true
      this.showForecastHint()
    })
    autoBg.on('pointerout', () => {
      this.autoHovered = false
      this.showHint()
    })
    // Under the result screen, whose shade keeps clicks off the portraits once the battle is over.
    // A copy: the dead leave the party as the battle ends, and stay in the column, faded, under the result screen.
    this.column = new PartyColumn(this, [...party], (index) => this.onPortrait(index))

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
      stopMusic('music_battle')
      // Leaving mid-battle (e.g. "New" from the pause menu) still yields a complete log.
      this.engine.abandon()
      this.dumpLog()
      this.dropForecast()
    })

    this.input.keyboard?.on('keydown-I', () => this.openPanel('inventory'))
    this.input.keyboard?.on('keydown-C', () => this.openPanel('character'))
    this.input.keyboard?.on('keydown-S', () => this.openPanel('skills'))
    this.input.keyboard?.on('keydown-M', () => {
      if (!this.scene.isPaused() && this.castButton.visible && this.castButton.getData('enabled')) this.onSkills()
    })
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.skillMenu) this.closeSkillMenu()
      else if (this.targeting) this.setTargeting(null)
      else this.openMenu()
    })
    // A skill is picked from the open list by its row's number.
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const row = Number(event.key)
      if (this.skillMenu && Number.isInteger(row) && row >= 1) this.pickSkill(row - 1)
    })

    startMusic(this, 'music_battle')

    if (saved) this.showRestored()
    else if (auto) {
      // Resolved from its first moment: the opening goes into the log with nothing played back.
      this.autoResolve(this.engine.getLog())
      return
    } else this.applyEvents(this.engine.getLog())
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
    this.showBoardAsItStands()
  }

  /**
   * Brings the board to the engine's state with nothing played back: every unit
   * where it stands, the fallen faded and those standing again stood up, the
   * ground's piles marked, and hit points, facing and statuses as they are.
   */
  private showBoardAsItStands(): void {
    for (const { id, hp, position } of this.engine.getState().units) {
      this.placeUnit(id, position)
      if (hp <= 0) this.showFallen(id)
      else if (!this.units.get(id)!.plate.visible) this.standUp(id)
    }
    this.refreshGroundMarks()
    this.syncUnitsFromEngine()
  }

  private onAutoResolve(): void {
    if (this.playerControl) this.autoResolve()
  }

  /**
   * Plays the rest of the battle at once, the heroes by AUTO_POLICY and the foes
   * by ENEMY_POLICY on the battle's own enemy stream: every event's line goes
   * into the log (`lead` first, events not yet logged, as a fresh battle's
   * opening), the board jumps to the end, and the end is shown and settled as
   * a played battle's. A battle still going AUTO_ROUND_LIMIT rounds on is
   * handed back to the player. Nothing is saved in between: the turn's save
   * and the end's bracket the run.
   */
  private autoResolve(lead: readonly BattleEvent[] = []): void {
    this.targeting = null
    this.setHovered(null)
    this.setPlayerControl(false)
    // A stream of its own beside the enemy's, made afresh on each press and never saved.
    const playerRng = mulberry32((battleSeed(this.engine.getLog()) ?? 0) + 2)
    const startRound = this.engine.getState().round
    const { events, over } = playOut(this.engine, {
      policies: { player: AUTO_POLICY, enemy: ENEMY_POLICY },
      rngs: { player: playerRng, enemy: this.enemyRng },
      lastRound: autoLastRound(startRound),
    })
    const all = [...lead, ...events]
    const end = all.at(-1)?.type === 'battle_end' ? all.pop()! : null
    for (const event of all) this.log.push(formatEvent(event, this.names))
    this.renderLog()
    this.showBoardAsItStands()
    if (over) {
      // Its line, the sting and the theme's stop, as in a played battle; the level-up sting times itself from it.
      if (end) this.showEvent(end)
      this.autoRounds = this.engine.getState().round - startRound + 1
      this.endBattle()
      return
    }
    this.pushLog(AUTO_DRAG_ON_LINE)
    this.continueBattle()
  }

  /** Others may stand on a fallen unit's hex, so its plate goes rather than collide with theirs. */
  private showFallen(id: UnitId): void {
    const unit = this.units.get(id)!
    unit.figure.stop().clearOutline().setFigureAlpha(0.4)
    unit.plate.setVisible(false)
    unit.statusMarks.setVisible(false)
  }

  /** What the in-browser tests see of the battle; see testHook.ts. */
  /** What the debug console (debugConsole.ts) reads: the game and the battle, which it does not change. */
  debugSource(): DebugSource {
    return { game: this.gameState, party: this.expedition.id, battle: { state: this.engine.getState(), names: this.names } }
  }

  probe(): BattleProbe {
    const enabled = (button: Phaser.GameObjects.Container) => button.getData('enabled') as boolean
    return {
      state: this.engine.getState(),
      log: this.engine.getLog(),
      playerControl: this.playerControl,
      hint: this.hintText.text,
      hintBounds: this.hintText.getBounds(),
      logText: this.logText.text,
      selected: this.selected,
      origin: { x: this.floorLayer.x, y: this.floorLayer.y },
      scale: this.floorLayer.scale,
      buttons: {
        attack: buttonProbe(this.attackButton, enabled(this.attackButton)),
        cast: buttonProbe(this.castButton, enabled(this.castButton)),
        endTurn: buttonProbe(this.endTurnButton, enabled(this.endTurnButton)),
        auto: buttonProbe(this.autoButton, enabled(this.autoButton)),
        result: buttonProbe(this.menuButton),
      },
      forecast: this.shownForecast,
      autoLabel: (this.autoButton.getData('text') as Phaser.GameObjects.Text).text,
      aiming: this.targeting === 'attack' ? null : this.targeting,
      skillMenu:
        this.skillMenu?.rows.map(({ row, bg }) => {
          const bounds = bg.getBounds()
          return { ...row, x: bounds.centerX, y: bounds.centerY }
        }) ?? null,
      marks: Object.fromEntries([...this.units].map(([id, unit]) => [id, unit.marks])),
      figureAlpha: Object.fromEntries([...this.units].map(([id, unit]) => [id, unit.figure.figureAlpha()])),
      result: this.resultText.visible ? this.resultText.text.split('\n') : [],
      foeInfo: this.foeInfo,
      party: this.column.probe(),
      looks: Object.fromEntries(
        [...this.heroes.keys()].flatMap((id) => {
          const figure = this.units.get(id)?.figure
          return figure ? [[id, figure.lookNames()]] : []
        }),
      ),
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
    return member ? this.expedition.members.indexOf(member) : null
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
    // Once the battle is over the panel has nothing to change, and after a wipe no member to show.
    if (this.scene.isPaused() || index === null || index < 0 || this.engine.getState().phase === 'over') return
    const units = this.engine.getState().units
    this.openPiles = []
    const members = this.expedition.members.map((character, i) => {
      const unit = units.find((u) => u.id === heroId(i))
      if (!unit) return { character }
      const items = this.ground.pileAt(unit.position)
      this.openPiles!.push({ unit: unit.id, items, before: [...items] })
      const gearApCost = this.playerControl ? this.engine.equipCost(unit.id) : null
      return { character, gearApCost, ground: items, mana: unit.mana, hpRule: 'cap' as const }
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
      const mark = this.add.image(x, y, ITEM_ICON_KEYS[top.icon]).setScale(ITEM_ICON_SCALE)
      // A second-tier item's icon is tinted here as in the inventory, so steel does not look like iron.
      const tint = iconTint(top)
      if (tint !== undefined) mark.setTint(tint)
      this.groundMarks.add(mark)
    }
  }

  private openMenu(): void {
    if (this.scene.isPaused()) return
    if (this.engine.getState().phase === 'over') {
      // Esc answers the result screen's one button, once it is up.
      if (this.menuButton.visible) this.leaveBattle()
      return
    }
    pauseMusic()
    this.scene.launch('Menu', { resume: 'Battle', game: this.gameState })
    this.scene.bringToTop('Menu')
    this.scene.pause()
  }

  /** Leaves the finished battle: back to the world map after a victory, or after a defeat that left heroes elsewhere (the first party selected); to the main menu when the game is lost. */
  private leaveBattle(): void {
    if (this.engine.getState().winner === 'player') this.scene.start('World', { game: this.gameState, party: this.expedition.id })
    else if (this.wipe && !this.wipe.lost) this.scene.start('World', { game: this.gameState, party: this.gameState.parties[0].id })
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

  /** Shows each hero wearing and holding what its character does now. */
  private refreshGear(): void {
    for (const [id, member] of this.heroes) this.units.get(id)?.figure.setLook(heroLook(member.equipment))
  }

  /** The names the plates show where the battle starts: shortened where two side by side would run together (`plateNames.ts`). */
  private plateNames(fielded: readonly { id: string; name: string; position: Hex }[]): Map<string, string> {
    const measure = this.add.text(0, 0, '', { ...PLATE_NAME_STYLE })
    const widthOf = (name: string) => measure.setText(name).width
    const shown = plateNames(fielded.map((u) => ({ id: u.id, name: u.name, ...boardHexCenter(u.position) })), widthOf)
    measure.destroy()
    return shown
  }

  private createUnit(name: string, kind: UnitKind, idleDelayMs: number): Unit {
    const figure = new UnitFigure(this, kind, UNIT_SCALE).play('idle', idleDelayMs)
    const shadow = this.add.ellipse(0, 0, UNIT_HEIGHT * 0.55, UNIT_HEIGHT * 0.18, 0x000000, 0.35)
    const container = this.add.container(0, 0, [shadow, figure])
    this.unitLayer.add(container)

    const nameText = this.add.text(0, PLATE_NAME_Y, name, { ...PLATE_NAME_STYLE }).setOrigin(0.5, 0)
    const hpBarBg = this.add
      .rectangle(0, PLATE_BAR_Y, PLATE_BAR_W, PLATE_BAR_H, 0x212121)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, 0x000000)
    const hpBarFill = this.add
      .rectangle(-PLATE_BAR_W / 2, PLATE_BAR_Y, PLATE_BAR_W, PLATE_BAR_H, 0x43a047)
      .setOrigin(0, 0)
    const hpText = this.add
      .text(0, PLATE_BAR_Y + PLATE_BAR_H / 2, '', { ...PLATE_TEXT_STYLE, fontSize: '10px', strokeThickness: 2 })
      .setOrigin(0.5)
    // Drawn pointing east and rotated to the unit's facing.
    const facingArrow = this.add
      .graphics({ x: -PLATE_BAR_W / 2 - 8, y: PLATE_BAR_Y + PLATE_BAR_H / 2 })
      .fillStyle(0xffffff, 1)
      .lineStyle(1.5, 0x000000, 1)
      .fillTriangle(6, 0, -4, -5, -4, 5)
      .strokeTriangle(6, 0, -4, -5, -4, 5)
    const apPips = this.add.graphics()
    const plate = this.add.container(0, 0, [nameText, hpBarBg, hpBarFill, hpText, facingArrow, apPips])
    this.plateLayer.add(plate)
    // The status letters, over the name (statusMarks.ts), in a layer of their own over every plate; placed and moved with the plate.
    const statusMarks = this.add.container(0, 0)
    this.markLayer.add(statusMarks)

    return { container, figure, plate, hpBarBg, hpBarFill, hpText, facingArrow, apPips, statusMarks, marks: '', shownHp: 0 }
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
      playCue(this, 'ui.click')
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
   * in the space between, scaled to fill it, up to BOARD_MAX_SCALE. The game is
   * never smaller than MIN_GAME_SIZE (main.ts), where the board fits at full size
   * and the hint line fits on one line.
   */
  private layout(): void {
    const width = this.scale.width
    const height = this.scale.height

    // The party's column takes the left; the board, the log and the buttons share what is right of it.
    this.column.layout(height)
    const centreX = PARTY_PANEL_W + (width - PARTY_PANEL_W) / 2
    const buttonY = height - 50
    // Attack, Skills, End Turn and Auto, in a row centred where the board is.
    const row = [this.attackButton, this.castButton, this.endTurnButton, this.autoButton]
    row.forEach((button, i) => button.setPosition(centreX + (i - 1.5) * BUTTON_SPACING, buttonY))

    this.hintText.setWordWrapWidth(width - 40)
    this.resultShade.setSize(width, height)
    this.bannerText.setPosition(width / 2, height / 2 - 100)
    // A victory adds the experience won and a line for each member it levelled or stood back up,
    // so the button keeps below however many lines there are.
    this.resultText.setPosition(width / 2, height / 2 - 60)
    this.menuButton.setPosition(width / 2, this.resultText.y + this.resultText.height + 46)
    // A long result lifts the whole block together, as far as the banner may go, to keep the button on screen.
    const overflow = this.menuButton.y + 30 - (height - 16)
    if (overflow > 0) {
      const lift = Math.min(overflow, Math.max(0, this.bannerText.y - 40))
      this.bannerText.y -= lift
      this.resultText.y -= lift
      this.menuButton.y -= lift
    }

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
    const scale = Math.max(0, Math.min(BOARD_MAX_SCALE, freeW / board.width, freeH / (bottom - top)))
    const floorX = freeLeft + (freeW - board.width * scale) / 2
    const floorY = freeTop + (freeH - (bottom - top) * scale) / 2 - top * scale

    for (const layer of [this.floorLayer, this.unitLayer, this.plateLayer, this.markLayer, this.labelLayer, this.hoverLabels, this.floatLayer, this.foePanel]) {
      layer.setPosition(floorX, floorY).setScale(scale)
    }
    for (const snapshot of this.engine.getState().units) this.placeUnit(snapshot.id, snapshot.position)
    this.rescaleStatusMarks()

    this.renderLog()
  }

  private placeUnit(id: UnitId, at: Hex): void {
    const { x, y } = boardHexCenter(at)
    const unit = this.units.get(id)!
    unit.container.setPosition(x, y)
    unit.plate.setPosition(x, y)
    unit.statusMarks.setPosition(x, y)
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
    unit.shownHp = hp
  }

  /** A letter for each of the unit's statuses, each in its status's colour, centred over its name at their own size on screen. */
  private refreshStatusMarks(unit: Unit, statuses: readonly ActiveStatus[]): void {
    unit.statusMarks.removeAll(true)
    unit.marks = statuses.map(({ id }) => STATUSES[id].mark).join('')
    const { scale, xs } = statusMarkLayout(statuses.length, this.plateLayer.scaleX)
    statuses.forEach(({ id }, i) => {
      const { mark, colour } = STATUSES[id]
      const letter = this.add
        .text(xs[i], PLATE_NAME_Y - STATUS_MARK_LIFT, mark, {
          fontFamily: 'monospace',
          fontSize: `${STATUS_MARK_FONT_PX}px`,
          fontStyle: 'bold',
          color: cssColour(colour),
          stroke: '#000000',
          strokeThickness: STATUS_MARK_STROKE_PX,
        })
        .setOrigin(0.5, 1)
        .setScale(scale)
      unit.statusMarks.add(letter)
    })
  }

  /** Keeps every unit's status letters at their own size after the board is scaled anew. */
  private rescaleStatusMarks(): void {
    for (const unit of this.units.values()) {
      const { scale, xs } = statusMarkLayout(unit.statusMarks.length, this.plateLayer.scaleX)
      unit.statusMarks.each((letter: Phaser.GameObjects.Text) => {
        letter.setScale(scale).setX(xs[unit.statusMarks.getIndex(letter)])
      })
    }
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

  /** The selected unit's legal casts and uses of abilities, as the engine lists them. */
  private selectedSkillUses(): SkillAction[] {
    if (this.selected === null) return []
    return this.engine.legalActions(this.selected).filter((a): a is SkillAction => a.type === 'cast' || a.type === 'ability')
  }

  /** The odds a use of a skill gives on each unit it would touch (null where nothing is rolled), as the engine previews it. */
  private skillOdds(action: SkillAction): { unit: UnitId; hitChance: number | null }[] {
    const aim = 'at' in action ? action.at : action.target
    const preview =
      action.type === 'cast' ? this.engine.previewCast(action.unit, action.spell, aim) : this.engine.previewAbility(action.unit, action.ability, aim)
    return preview?.outcomes ?? []
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
    const skill = this.targeting !== null && this.targeting !== 'attack' ? this.targeting : null
    const statuses = self && self.statuses.length > 0 ? `${describeStatuses(self.statuses)}. ` : ''
    this.baseHint = (
      skill && self
        ? targetingHint(skill, self)
        : this.targeting && self
          ? `Choose a foe to attack (${self.attackApCost} AP). Esc or Cancel to go back.`
          : actable.length === 0
            ? 'No action points left. Press End Turn.'
            : `${statuses}Blue: move (faint: too few AP to attack), orange edge: free attack. Click a foe to attack.`
    )
    this.showHint()

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
      } else if (action.type === 'attack' && skill === null) {
        const polygon = this.hexPolygon(positionOf(action.target))
        this.highlights.fillStyle(ATTACK_HIGHLIGHT, this.targeting ? 0.7 : 0.5)
        this.highlights.fillPoints(polygon, true)
        if (this.targeting) {
          this.highlights.lineStyle(2, 0xffffff, 0.9)
          this.highlights.strokePoints(polygon, true)
        }
        this.addHitChanceLabel(action.unit, action.target, positionOf(action.target))
      } else if ((action.type === 'cast' || action.type === 'ability') && skill && usesSkill(action, self.id, skill)) {
        // A unit to aim at is marked strongly, with the odds of what rolls; an area's centres faintly.
        const at = 'at' in action ? action.at : positionOf(action.target)
        const polygon = this.hexPolygon(at)
        this.highlights.fillStyle(SPELL_HIGHLIGHT, 'at' in action ? 0.3 : 0.7)
        this.highlights.fillPoints(polygon, true)
        if ('at' in action) continue
        this.highlights.lineStyle(2, 0xffffff, 0.9)
        this.highlights.strokePoints(polygon, true)
        const chance = this.skillOdds(action)[0]?.hitChance
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
      this.refreshFoeInfo()
      // The warning for a foe belongs to the foe: leaving it for a button or portrait takes it away.
      if (this.hoverHint !== null) {
        this.hoverHint = null
        this.showHint()
      }
      return
    }
    this.setHovered(this.hexAt(pointer.x, pointer.y))
  }

  private setHovered(at: Hex | null): void {
    const same = at === null || this.hovered === null ? at === this.hovered : hexEquals(at, this.hovered)
    this.hovered = at
    if (!same) this.refreshHover()
  }

  /**
   * Whether a skill aimed at `target` is aimed at the hex `at`: its standing unit, or for Revive the fallen
   * ally lying there (which is offered only where the engine lists the cast, so never under a standing unit).
   */
  private aimedAt(target: UnitId, at: Hex, standing: { id: UnitId } | undefined): boolean {
    if (standing) return standing.id === target
    const fallen = this.engine.getState().units.find((u) => u.id === target)
    return fallen !== undefined && fallen.hp <= 0 && hexEquals(fallen.position, at)
  }

  /** What a click on `at` would do for the selected unit. */
  private boardIntent(at: Hex): BoardIntent {
    if (!this.playerControl || this.selected === null) return { kind: 'none' }
    const state = this.engine.getState()
    const self = state.units.find((u) => u.id === this.selected)!
    const unitAt = state.units.find((u) => u.hp > 0 && hexEquals(u.position, at))
    if (this.targeting !== null && this.targeting !== 'attack') {
      // Only a unit or a centre the skill can be aimed at is a target; any other click backs out of aiming.
      const skill = this.targeting
      const use = this.selectedSkillUses().find(
        (a) => usesSkill(a, self.id, skill) && ('at' in a ? hexEquals(a.at, at) : this.aimedAt(a.target, at, unitAt)),
      )
      return use ? { kind: 'skill', action: use } : { kind: 'none' }
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
   * the cursor to match (crossed swords, faded when the AP can't cover a
   * strike; a green cross for a friendly spell).
   */
  private refreshHover(): void {
    this.hoverHint = null
    this.hoverMarks.clear()
    this.hoverLabels.removeAll(true)
    this.refreshFoeInfo()
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
        if (!intent.plan.attack) {
          const self = this.engine.getState().units.find((u) => u.id === this.selected)!
          this.hoverHint = noStrikeHint(hexDistance(self.position, foeAt), self.attackRange)
        }
        break
      }
      case 'skill': {
        const { action } = intent
        // A spell's cursor is its own; an ability is hostile but for a status the user lays on itself.
        const cursor = action.type === 'cast' ? spellCursor(action.spell) : ABILITIES[action.ability].selfStatus ? 'heal' : 'attack'
        this.input.setDefaultCursor(CURSORS[cursor])
        this.markSkill(action, selectedAt())
        break
      }
    }
    this.showHint()
  }

  /**
   * Works the auto-resolve estimate in a slice of at most FORECAST_SLICE_MS a
   * frame while the player has control. Phaser calls no update on a paused
   * scene, so nothing is worked under an overlay.
   */
  update(): void {
    if (!this.playerControl || !this.forecaster || this.shownForecast) return
    const done = workFor(this.forecaster, FORECAST_SLICE_MS)
    if (!done) return
    this.shownForecast = done
    this.forecaster = null
    this.setButtonLabel(this.autoButton, forecastLabel(done, true))
    if (this.autoHovered) this.showForecastHint()
  }

  /**
   * Starts an estimate for the battle as it stands, unless the one in hand is
   * already for it: control is also given back on selecting a hero or aiming,
   * which move nothing, and the log grows with every action. The estimate is
   * played from a snapshot of the engine on its own seeds, never the engine itself.
   */
  private startForecast(): void {
    const base = battleForecastBase(this.engine.getLog())
    if (base === this.forecastBase) return
    this.forecaster = new Forecaster({ snapshot: this.engine.snapshot() }, base)
    this.forecastBase = base
    this.shownForecast = null
    this.setButtonLabel(this.autoButton, forecastLabel(null, true))
  }

  /** Throws the estimate away: the battle it was for no longer stands, or control has gone. */
  private dropForecast(): void {
    this.forecaster = null
    this.forecastBase = null
    this.shownForecast = null
  }

  /** The whole estimate in the hint, in its normal colour, while the pointer is over Auto. */
  private showForecastHint(): void {
    this.hintText.setText(forecastHint(this.shownForecast)).setColor('#9e9e9e')
  }

  /** Shows the hint of the unit's turn, or the warning for the foe under the pointer. */
  private showHint(): void {
    if (this.autoHovered && this.playerControl) {
      this.showForecastHint()
      return
    }
    this.hintText.setText(this.hoverHint ?? this.baseHint).setColor(this.hoverHint ? '#ffb74d' : '#9e9e9e')
  }

  /** The panel of a hovered standing foe's abilities and wards, beside its hex; nothing for a foe with neither. */
  private refreshFoeInfo(): void {
    this.foePanel.removeAll(true)
    this.foeInfo = []
    // Not while events play: the engine's state is ahead of them. Control returning redraws it.
    if (!this.hovered || this.scene.isPaused() || !this.playerControl) return
    const at = this.hovered
    const foe = this.engine.getState().units.find((u) => u.hp > 0 && u.side === 'enemy' && hexEquals(u.position, at))
    const lines = foe ? foeInfoLines(foe) : []
    if (lines.length === 0) return
    this.foeInfo = lines
    const { x, y } = boardHexCenter(at)
    // A line apiece, stacked: the foe's name as the title, each ability's name and readiness, and, dimmer
    // and indented, what the ability does.
    const style = { fontFamily: 'monospace', fontSize: '11px', backgroundColor: '#000000cc', padding: { x: 4, y: 1 } }
    const texts = lines.map((line, i) =>
      this.add.text(0, 0, line, {
        ...style,
        color: i === 0 ? '#ffd166' : line.startsWith(DESCRIPTION_INDENT) ? '#b8c0c8' : '#ffffff',
        fontStyle: i === 0 ? 'bold' : 'normal',
      }),
    )
    // The panel lies in the board's layer, which is scaled to fit the screen; its text is scaled back, so that it
    // reads at its own size however small the board is drawn. Widths and heights below are in the board's units.
    const unscale = 1 / (this.foePanel.scaleX || 1)
    const screenWidth = Math.max(...texts.map((t) => t.width))
    const width = screenWidth * unscale
    const height = texts.reduce((sum, t) => sum + t.height, 0) * unscale
    // Beside the foe, kept on the board: to its left when its right would overrun it.
    const board = boardPixelSize(this.board.size)
    const left = Phaser.Math.Clamp(x + HEX_SIZE + width > board.width ? x - HEX_SIZE - width : x + HEX_SIZE, 0, Math.max(0, board.width - width))
    let top = Phaser.Math.Clamp(y - height / 2, 0, Math.max(0, board.height - height))
    for (const text of texts) {
      text.setFixedSize(screenWidth, 0).setScale(unscale).setPosition(left, top)
      top += text.height * unscale
    }
    this.foePanel.add(texts)
  }

  /**
   * Outlines the user and what a use of a skill would be aimed at; for an
   * area, every hex of it, and on each unit it would touch, allies and the
   * user included, the odds of it striking, so friendly fire is seen before
   * it is paid for: a status laid with no roll shows its letter, a friendly
   * spell a "+".
   */
  private markSkill(action: SkillAction, from: Hex): void {
    const state = this.engine.getState()
    const user = state.units.find((u) => u.id === action.unit)!
    const aim = 'at' in action ? action.at : state.units.find((u) => u.id === action.target)!.position
    let hexes: Hex[] = [aim]
    let noRoll = '+'
    if (action.type === 'cast') {
      const { radius = 0, target, shape = 'burst', range } = SPELLS[action.spell]
      if (target === 'area') hexes = areaOf(shape, user.position, aim, range, radius)
    } else {
      const area = abilityArea(action.ability, user.attackRange)
      if (area) hexes = areaOf(area.shape, user.position, aim, area.range, area.radius ?? 0)
      const laid = ABILITIES[action.ability].area?.status
      if (laid) noRoll = STATUSES[laid.id].mark
    }
    hexes = hexes.filter((h) => this.board.contains(h))
    this.hoverMarks.lineStyle(3, SPELL_HIGHLIGHT, 1)
    for (const h of [from, ...hexes]) this.hoverMarks.strokePoints(this.hexPolygon(h), true)
    if (!('at' in action)) return
    this.hoverMarks.fillStyle(SPELL_HIGHLIGHT, 0.35)
    for (const h of hexes) this.hoverMarks.fillPoints(this.hexPolygon(h), true)
    for (const { unit, hitChance } of this.skillOdds(action)) {
      const at = state.units.find((u) => u.id === unit)!.position
      this.addChanceLabel(hitChance !== null ? `${Math.round(hitChance * 100)}%` : noRoll, at, this.hoverLabels)
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

  /**
   * "60%" on a foe's nameplate when the selected unit can attack it, with "+3"
   * for flanking, side and rear bonuses, and "−2 dmg" for what its armour
   * takes off each hit after piercing.
   */
  private addHitChanceLabel(attacker: UnitId, target: UnitId, at: Hex): void {
    const preview = this.engine.previewAttack(attacker, target)
    if (!preview) return
    const percent = Math.round(preview.hitChance * 100)
    const bonus = preview.flankBonus + preview.arcBonus
    const armour = preview.resistance > 0 ? ` −${preview.resistance} dmg` : ''
    this.addChanceLabel(`${percent}%${bonus > 0 ? ` +${bonus}` : ''}${armour}`, at)
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
      holdMs,
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

  /** What the sounds need of a unit, read live so that gear changed mid-battle is heard. */
  private readonly soundContext: SoundContext = {
    kind: (id) => this.kinds[id] ?? null,
    held: (id) => this.heroes.get(id)?.equipment.mainHand?.icon ?? null,
    body: (id) => this.heroes.get(id)?.equipment.armor?.icon ?? null,
  }

  private showEvent(event: BattleEvent): void {
    this.pushLog(formatEvent(event, this.names))
    // The theme gives way to the victory or defeat sting.
    if (event.type === 'battle_end') stopMusic('music_battle')
    if (event.type === 'battle_end') this.endShownAt = this.time.now
    playSoundCues(this, eventSounds(event, this.soundContext))
    if (event.type === 'move') {
      this.animateMove(event.unit, event.from, event.path)
    }
    if (event.type === 'attack') this.showAttack(event)
    if (event.type === 'cast') this.showCast(event)
    if (event.type === 'ability') this.showAbility(event)
    // What a foe's counters read changes as events play; the panel returns when playback ends.
    this.foePanel.removeAll(true)
    this.foeInfo = []
    if (event.type === 'status_tick') {
      const unit = this.units.get(event.unit)!
      this.flash(unit, HURT_TINT)
      unit.figure.pulseOutline(OUTLINE_HURT, OUTLINE_MS)
      this.refreshHpDisplay(unit, event.hpAfter, this.engine.getState().units.find((u) => u.id === event.unit)!.maxHp)
    }
    if (event.type === 'regenerate') {
      const unit = this.units.get(event.unit)!
      this.flash(unit, HELPED_TINT)
      this.refreshHpDisplay(unit, event.hpAfter, this.engine.getState().units.find((u) => u.id === event.unit)!.maxHp)
    }
    if (event.type === 'restore') this.showRestore(event)
    if (event.type === 'status_tick' && event.endured) this.floatText(event.unit, 'Endures', FLOAT_COLOUR, 1)
    if (changesStatusMarks(event)) this.refreshAllStatusMarks()
    if (event.type === 'unit_down') this.showFallen(event.unit)
  }

  /**
   * An attack: the attacker turns and strikes, a blade swung and leaned into
   * or a shot loosed, the defender turning to meet it if it did, and when it
   * lands (`impactMs`) the defender shows how it fared, its hit points following.
   */
  private showAttack(event: Extract<BattleEvent, { type: 'attack' }>): void {
    this.faceUnit(event.attacker, event.attackerFacing)
    if (event.defenderTurned) this.faceUnit(event.defender, event.defenderFacing)
    const attacker = this.units.get(event.attacker)!
    const defender = this.units.get(event.defender)!
    const look = attackLook(event, this.heroes.get(event.attacker)?.equipment.mainHand?.icon)
    const land = () => {
      if (look === 'swing') this.slash(event.attacker, event.defender, event.critical)
      if (event.image) this.react(event.defender, event.attacker, OUTLINE_IMAGE, IMAGE_TINT)
      else if (event.hit) this.react(event.defender, event.attacker, event.critical ? OUTLINE_CRITICAL : OUTLINE_HURT, HURT_TINT, event.critical)
      else this.dodge(event.defender, event.attacker)
      const maxHp = this.engine.getState().units.find((u) => u.id === event.defender)!.maxHp
      this.refreshHpDisplay(defender, event.defenderHpAfter, maxHp)
      // A technique's elemental or holy strike flashes where it lands.
      const flash = strikeFlash(event)
      if (flash) this.burst(this.chest(event.defender), flash.colour, flash.glow, 1.2)
      this.floatBonus(event)
      this.floatNotes(event.defender, [...defenderNotes(event), ...(event.endured ? [{ text: 'Endures', kind: 'note' as const }] : [])], bonusText(event) ? 1 : 0)
      this.floatNotes(event.attacker, attackerNotes(event))
      // A Life rune heals the attacker as it strikes.
      if ((event.healed ?? 0) > 0) {
        const attackerMax = this.engine.getState().units.find((u) => u.id === event.attacker)!.maxHp
        this.refreshHpDisplay(attacker, Math.min(attackerMax, attacker.shownHp + event.healed!), attackerMax)
        this.flash(attacker, HELPED_TINT)
      }
    }
    if (look === 'swing') {
      const raiseMs = SWING_IMPACT_MS - LUNGE_MS
      attacker.figure.swing(raiseMs, LUNGE_MS)
      this.time.delayedCall(raiseMs, () => this.lunge(event.attacker, event.defender))
      this.time.delayedCall(impactMs(event), land)
      return
    }
    // A shot: a short draw back, then the missile flies, past the defender's shoulder on a miss.
    this.recoil(event.attacker, event.defender)
    this.time.delayedCall(RELEASE_MS, () => {
      const from = this.chest(event.attacker)
      const to = this.chest(event.defender)
      const ms = flightMs(event.distance)
      const end = event.hit ? to : this.pastShoulder(from, to)
      if (look === 'arrow') this.flyArrow(from, end, event.distance, ms, land)
      else this.flyMissile(from, end, ms, { colour: WAND_BOLT, glow: 0xffffff, missile: 'dart', impact: 'burst' }, () => {
        if (event.hit) this.burst(to, WAND_BOLT, 0xffffff, 1)
        land()
      })
    })
  }

  /** A hit's on-hit damage ("+3 fire") rising from the defender, at its own size however far the board is scaled down. */
  private floatBonus(event: Extract<BattleEvent, { type: 'attack' }>): void {
    const message = bonusText(event)
    if (message === null) return
    const element = bonusElement(event)
    this.floatText(event.defender, message, element ? ELEMENT_FLOAT_COLOURS[element] : FLOAT_COLOUR, 0)
  }

  /** Words rising from a unit's chest, `row` rows above the first: an on-hit's damage, a restore's "+3", "Deathblow". */
  private floatText(unit: UnitId, message: string, colour: string, row: number): void {
    const at = this.chest(unit)
    const unscale = 1 / (this.floatLayer.scaleX || 1)
    const text = this.add
      .text(at.x, at.y - (20 + 14 * row) * unscale, message, { fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: colour, stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setScale(unscale)
    this.floatLayer.add(text)
    this.tweens.add({
      targets: text,
      y: text.y - 26 * unscale,
      alpha: 0,
      delay: 250,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    })
  }

  /** Floats a list of notes over `unit`, one row each. */
  private floatNotes(unit: UnitId, notes: readonly FloatNote[], firstRow = 0): void {
    notes.forEach((note, i) => this.floatText(unit, note.text, FLOAT_NOTE_COLOURS[note.kind], firstRow + i))
  }

  /** A turn-start restore: "+3" in green over the unit, its hit points refilling, and "+2 mana" in blue. */
  private showRestore(event: Extract<BattleEvent, { type: 'restore' }>): void {
    const unit = this.units.get(event.unit)!
    const snapshot = this.engine.getState().units.find((u) => u.id === event.unit)!
    this.flash(unit, HELPED_TINT)
    unit.figure.pulseOutline(OUTLINE_HEALED, OUTLINE_MS)
    this.floatNotes(event.unit, restoreFloats(event))
    if ((event.hp ?? 0) > 0) this.refreshHpDisplay(unit, Math.min(snapshot.maxHp, unit.shownHp + event.hp!), snapshot.maxHp)
  }

  /** A fallen unit brought back: its figure stands up again, bright and idling, and its plate returns. */
  private standUp(id: UnitId): void {
    const unit = this.units.get(id)!
    unit.figure.setFigureAlpha(1).play('idle')
    unit.plate.setVisible(true)
    unit.statusMarks.setVisible(true)
  }

  /**
   * A cast: the caster turns and gestures, its spell's missile flies to where
   * it was aimed (none for a spell centred on the caster), and where it lands
   * the spell shows itself (`SPELL_LOOKS`) and each unit touched is outlined as
   * it fared, its hit points following.
   */
  private showCast(event: Extract<BattleEvent, { type: 'cast' }>): void {
    this.faceUnit(event.caster, event.casterFacing)
    const units = this.engine.getState().units
    const { target, radius = 0, shape = 'burst', range } = SPELLS[event.spell]
    const look = SPELL_LOOKS[event.spell]
    const caster = this.units.get(event.caster)!
    caster.figure.pulseOutline(look.colour, RELEASE_MS + 200)
    const land = () => {
      const origin = units.find((u) => u.id === event.caster)!.position
      const area =
        target === 'area' ? areaOf(shape, origin, event.at, range, radius).filter((h) => this.board.contains(h)) : []
      if (target === 'area') this.flashArea(area, look.colour)
      this.spellImpact(event, look, area)
      for (const outcome of event.outcomes) {
        const unit = this.units.get(outcome.unit)!
        const outline = castOutline(event.spell, outcome)
        if (outcome.image) this.react(outcome.unit, event.caster, OUTLINE_IMAGE, IMAGE_TINT)
        else if (!SPELLS[event.spell].hostile) {
          this.flash(unit, HELPED_TINT)
          unit.figure.pulseOutline(outline!, OUTLINE_MS)
        } else if (outcome.hit) this.react(outcome.unit, event.caster, outline!, HURT_TINT, outcome.critical)
        else if (outcome.unit !== event.caster) this.dodge(outcome.unit, event.caster)
        this.refreshHpDisplay(unit, outcome.hpAfter, units.find((u) => u.id === outcome.unit)!.maxHp)
        if (outcome.revived) this.standUp(outcome.unit)
        if (outcome.endured) this.floatText(outcome.unit, 'Endures', FLOAT_COLOUR, 0)
      }
      if (event.drained > 0) {
        const drinker = this.units.get(event.caster)!
        this.refreshHpDisplay(drinker, drinker.shownHp + event.drained, units.find((u) => u.id === event.caster)!.maxHp)
        this.flash(drinker, HELPED_TINT)
      }
    }
    this.time.delayedCall(RELEASE_MS, () => {
      if (event.distance === 0) land()
      else this.flyMissile(this.chest(event.caster), this.hexChest(event.at, event.outcomes), flightMs(event.distance), look, land)
    })
  }

  /**
   * An area ability: the unit turns and gestures; a burst aimed away flies its
   * missile to where it was aimed, a cone or line flashes out from the unit.
   * Where it lands every hex lights and each unit touched shows how it fared:
   * a hit or half damage hurts, a clean miss dodges, an image shows white.
   */
  private showAbility(event: Extract<BattleEvent, { type: 'ability' }>): void {
    this.faceUnit(event.unit, event.facing)
    const units = this.engine.getState().units
    const look = abilityLook(event.ability)
    this.units.get(event.unit)!.figure.pulseOutline(look.colour, RELEASE_MS + 200)
    const area = event.hexes.filter((h) => this.board.contains(h))
    const land = () => {
      this.flashArea(area, look.colour)
      this.abilityImpact(event, look, area)
      for (const outcome of event.outcomes) {
        const outline = areaOutline(outcome)
        if (outcome.image) this.react(outcome.unit, event.unit, OUTLINE_IMAGE, IMAGE_TINT)
        else if (outline !== null) this.react(outcome.unit, event.unit, outline, HURT_TINT, outcome.critical)
        else if (outcome.unit !== event.unit) this.dodge(outcome.unit, event.unit)
        this.refreshHpDisplay(this.units.get(outcome.unit)!, outcome.hpAfter, units.find((u) => u.id === outcome.unit)!.maxHp)
        if (outcome.endured) this.floatText(outcome.unit, 'Endures', FLOAT_COLOUR, 0)
      }
    }
    this.time.delayedCall(RELEASE_MS, () => {
      // A volley looses an arrow at each hex, landing with them.
      if (look.arrows && event.distance > 0) {
        const from = this.chest(event.unit)
        area.forEach((h, i) => {
          const centre = boardHexCenter(h)
          const to = { x: centre.x, y: centre.y - UNIT_HEIGHT / 3 }
          this.flyArrow(from, to, event.distance, flightMs(event.distance), i === 0 ? land : () => {})
        })
        return
      }
      // A cone or line has no missile: it sweeps out from the unit, then lands.
      if (event.shape !== 'burst') this.time.delayedCall(AREA_SWEEP_MS, land)
      else if (event.distance === 0) land()
      else this.flyMissile(this.chest(event.unit), this.hexChest(event.at, event.outcomes), flightMs(event.distance), look, land)
    })
  }

  /** What an area ability shows where it lands, as `spellImpact` does for a spell. */
  private abilityImpact(event: Extract<BattleEvent, { type: 'ability' }>, look: SpellLook, area: readonly Hex[]): void {
    const touched = event.outcomes.filter((o) => !o.image).map((o) => o.unit)
    switch (look.impact) {
      case 'burst':
        if (event.shape === 'burst') this.burst(this.hexChest(event.at, event.outcomes), look.colour, look.glow, 2.5)
        else for (const h of area) this.burst(boardHexCenter(h), look.colour, look.glow, 1.2)
        break
      case 'cloud':
        for (const h of area) this.cloud(boardHexCenter(h), look.colour, look.glow)
        break
      case 'sparkle':
        for (const id of touched) this.sparkle(id, look.colour, look.glow)
        break
      case 'ring':
        for (const id of look.onUser ? [event.unit] : touched) this.ring(id, look.colour)
        break
    }
  }

  /** What a spell shows where it lands: a burst at its aim, a cloud over its hexes, or sparkles or a ring on each unit it touched. */
  private spellImpact(event: Extract<BattleEvent, { type: 'cast' }>, look: SpellLook, area: readonly Hex[]): void {
    const touched = event.outcomes.filter((o) => !o.image).map((o) => o.unit)
    switch (look.impact) {
      case 'burst':
        this.burst(this.hexChest(event.at, event.outcomes), look.colour, look.glow, 1.5 + (SPELLS[event.spell].radius ?? 0))
        break
      case 'cloud':
        for (const h of area.length > 0 ? area : [event.at]) this.cloud(boardHexCenter(h), look.colour, look.glow)
        break
      case 'sparkle':
        for (const id of touched) this.sparkle(id, look.colour, look.glow)
        break
      case 'ring':
        for (const id of touched) this.ring(id, look.colour)
        break
    }
  }

  /** Lights an area's hexes for a moment. */
  private flashArea(hexes: readonly Hex[], colour: number): void {
    const glow = this.add.graphics()
    glow.fillStyle(colour, 0.4)
    for (const h of hexes) glow.fillPoints(this.hexPolygon(h), true)
    this.floorLayer.add(glow)
    this.tweens.add({ targets: glow, alpha: 0, duration: AREA_FLASH_MS, onComplete: () => glow.destroy() })
  }

  private refreshAllStatusMarks(): void {
    for (const snapshot of this.engine.getState().units) {
      this.refreshStatusMarks(this.units.get(snapshot.id)!, snapshot.hp > 0 ? snapshot.statuses : [])
    }
  }

  // ---- effects --------------------------------------------------------
  // Drawn in the label layer, over every unit and nameplate, and scaled and placed as the board is.

  /** Where a unit's chest is, its sprite's `chest` point (a third of the way up one without), wherever its figure leans. */
  private chest(id: UnitId): { x: number; y: number } {
    const { container, figure } = this.units.get(id)!
    const at = figure.point(CHEST_POINT) ?? { x: 0, y: -UNIT_HEIGHT / 3 }
    return { x: container.x + figure.x + at.x, y: container.y + figure.y + at.y }
  }

  /** What a spell aimed at a hex flies to: the chest of the unit of `touched` standing there, or where one would have it. */
  private hexChest(h: Hex, touched: readonly { unit: UnitId }[]): { x: number; y: number } {
    const { x, y } = boardHexCenter(h)
    const standing = touched.find(({ unit }) => {
      const { container } = this.units.get(unit)!
      return Math.abs(container.x - x) < 1 && Math.abs(container.y - y) < 1
    })
    return standing ? this.chest(standing.unit) : { x, y: y - UNIT_HEIGHT / 3 }
  }

  /**
   * An effect sprite (art/effects/) shown as the units are, in a container
   * whose origin is the sprite's `tip` (its centre if it has none): placed at
   * where it strikes and turned along its flight.
   */
  private effect(sprite: string): Phaser.GameObjects.Container {
    const image = this.add.sprite(0, 0, SPRITE_ATLAS, spriteFrame(sprite, EFFECT_FRAME)).setScale(UNIT_SCALE)
    const tip = pointFromAnchor(image.frame.customData, TIP_POINT)
    if (tip) image.setPosition(-tip.x * UNIT_SCALE, -tip.y * UNIT_SCALE)
    const effect = this.add.container(0, 0, [image])
    this.labelLayer.add(effect)
    return effect
  }

  /** A point past a target's shoulder, where a shot that misses goes. */
  private pastShoulder(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
    const along = new Phaser.Math.Vector2(to.x - from.x, to.y - from.y).normalize()
    return { x: to.x + along.x * 30 - along.y * 14, y: to.y + along.y * 30 + along.x * 14 - 10 }
  }

  /** Flies an arrow in an arc, turned along its flight, and calls `onArrive` as it lands. */
  private flyArrow(from: { x: number; y: number }, to: { x: number; y: number }, hexes: number, ms: number, onArrive: () => void): void {
    const arrow = this.effect(ARROW_SPRITE)
    const height = Math.min(ARROW_ARC_MAX, ARROW_ARC_PER_HEX * hexes)
    const at = (t: number) => ({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t - 4 * height * t * (1 - t),
    })
    const flight = { t: 0 }
    const place = () => {
      const now = at(flight.t)
      const ahead = at(Math.min(1, flight.t + 0.02))
      const behind = at(Math.max(0, flight.t - 0.02))
      arrow.setPosition(now.x, now.y).setRotation(Math.atan2(ahead.y - behind.y, ahead.x - behind.x))
    }
    place()
    this.tweens.add({
      targets: flight,
      t: 1,
      duration: ms,
      onUpdate: place,
      onComplete: () => {
        this.tweens.add({ targets: arrow, alpha: 0, duration: 120, onComplete: () => arrow.destroy() })
        onArrive()
      },
    })
  }

  /** Flies a spell's missile, an orb or a dart trailing sparks of its glow, and calls `onArrive` as it lands. */
  private flyMissile(from: { x: number; y: number }, to: { x: number; y: number }, ms: number, look: SpellLook, onArrive: () => void): void {
    const missile = this.effect(MISSILE_SPRITES[look.missile])
    const image = missile.first as Phaser.GameObjects.Sprite
    // A dart's origin is its tip: it starts a length ahead, so that it leaves from the chest rather than trailing back across it.
    const along = new Phaser.Math.Vector2(to.x - from.x, to.y - from.y).setLength(Math.hypot(image.x, image.y))
    missile.setPosition(from.x + along.x, from.y + along.y)
    image.setTint(look.colour)
    // A soft glow about the missile, behind it.
    const halo = look.missile === 'orb' ? this.add.circle(0, 0, 11, look.glow, 0.35) : this.add.ellipse(image.x, 0, 24, 10, look.glow, 0.35)
    missile.addAt(halo, 0)
    if (look.missile === 'dart') missile.setRotation(Math.atan2(to.y - from.y, to.x - from.x))
    let lastSpark = 0
    this.tweens.add({
      targets: missile,
      x: to.x,
      y: to.y,
      duration: ms,
      onUpdate: () => {
        if (this.time.now - lastSpark < 20) return
        lastSpark = this.time.now
        const spark = this.add.circle(missile.x + Phaser.Math.Between(-2, 2), missile.y + Phaser.Math.Between(-2, 2), Phaser.Math.Between(2, 4), look.glow, 0.8)
        this.labelLayer.addAt(spark, this.labelLayer.getIndex(missile))
        this.tweens.add({ targets: spark, alpha: 0, scale: 0.2, y: spark.y - 4, duration: 220, onComplete: () => spark.destroy() })
      },
      onComplete: () => {
        missile.destroy()
        onArrive()
      },
    })
  }

  /**
   * A flash and a burst of sparks (`fx_burst`, in `colour`) from a point;
   * `size` 1 for a shot, more for a spell and its area's radius. The sprite is
   * shown at a whole multiple of its pixels, so its edges stay sharp.
   */
  private burst(at: { x: number; y: number }, colour: number, glow: number, size: number): void {
    const flare = this.add.circle(at.x, at.y, 8 * size, glow, 0.8)
    this.labelLayer.add(flare)
    this.tweens.add({ targets: flare, scale: 2, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => flare.destroy() })
    const sparks = this.add
      .sprite(at.x, at.y, SPRITE_ATLAS, spriteFrame(BURST_SPRITE, 'burst_0'))
      .setScale(Math.round(UNIT_SCALE * size))
      .setTint(colour)
    this.labelLayer.add(sparks)
    sparks.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sparks.destroy())
    sparks.play(spriteAnim(BURST_SPRITE, BURST_ANIM))
  }

  /** Puffs of a foul cloud, rising and spreading from a hex's floor. */
  private cloud(at: { x: number; y: number }, colour: number, glow: number): void {
    for (let i = 0; i < 4; i++) {
      const puff = this.add.circle(at.x + Phaser.Math.Between(-14, 14), at.y - Phaser.Math.Between(4, 20), Phaser.Math.Between(6, 10), i % 2 ? colour : glow, 0.55)
      this.labelLayer.add(puff)
      this.tweens.add({ targets: puff, scale: 1.8, alpha: 0, y: puff.y - 14, delay: i * 50, duration: 520, onComplete: () => puff.destroy() })
    }
  }

  /** Motes rising round a unit, as healing or a charm settles on it. */
  private sparkle(id: UnitId, colour: number, glow: number): void {
    const { container } = this.units.get(id)!
    for (let i = 0; i < 9; i++) {
      const mote = this.add.circle(container.x + Phaser.Math.Between(-16, 16), container.y - Phaser.Math.Between(0, 16), Phaser.Math.Between(2, 3), i % 3 ? colour : glow, 1)
      this.labelLayer.add(mote)
      this.tweens.add({ targets: mote, y: mote.y - Phaser.Math.Between(28, 46), alpha: 0, delay: i * 30, duration: 520, ease: 'Sine.easeOut', onComplete: () => mote.destroy() })
    }
  }

  /** A ring spreading out over the floor round a unit's feet, as a ward is laid on it. */
  private ring(id: UnitId, colour: number): void {
    const { container } = this.units.get(id)!
    const ring = this.add.ellipse(container.x, container.y, 30, 30 * FLOOR_SQUASH_Y).setStrokeStyle(3, colour, 1)
    this.floorLayer.add(ring)
    this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => ring.destroy() })
  }

  /** A blade's cut across the defender: a pale crescent that sweeps and fades, wider for a critical. */
  private slash(attacker: UnitId, defender: UnitId, critical: boolean): void {
    const at = this.chest(defender)
    const from = this.chest(attacker)
    const side = from.x <= at.x ? 1 : -1
    const radius = critical ? 22 : 16
    const arc = this.add.graphics({ x: at.x - side * 4, y: at.y })
    arc.lineStyle(critical ? 4 : 3, SLASH_COLOUR, 0.95)
    arc.beginPath()
    arc.arc(0, 0, radius, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(50))
    arc.strokePath()
    arc.setScale(side, 1).setRotation(side * -0.3)
    this.labelLayer.add(arc)
    this.tweens.add({ targets: arc, rotation: side * 0.4, alpha: 0, duration: SLASH_MS, ease: 'Quad.easeOut', onComplete: () => arc.destroy() })
  }

  /** A unit struck: it flashes, is outlined and is knocked back a little from whoever struck it. */
  private react(id: UnitId, from: UnitId, outline: number, tint: number, critical = false): void {
    const unit = this.units.get(id)!
    this.flash(unit, tint)
    unit.figure.pulseOutline(outline, critical ? OUTLINE_MS * 1.5 : OUTLINE_MS)
    if (id === from) return
    const away = Math.sign(unit.container.x - this.units.get(from)!.container.x) || 1
    const px = (critical ? 2 : 1) * KNOCK_PX * away
    this.tweens.add({ targets: unit.figure, x: px, duration: 60, yoyo: true, ease: 'Quad.easeOut', onComplete: () => unit.figure.setX(0) })
  }

  /** A unit missed sways aside and back. */
  private dodge(id: UnitId, from: UnitId): void {
    const unit = this.units.get(id)!
    const away = Math.sign(unit.container.x - this.units.get(from)!.container.x) || 1
    this.tweens.add({ targets: unit.figure, x: DODGE_PX * away, duration: 90, yoyo: true, ease: 'Sine.easeOut', onComplete: () => unit.figure.setX(0) })
  }

  /** Leans a unit into its strike and back; its hex, plate and shadow stay where they are. */
  private lunge(id: UnitId, at: UnitId): void {
    const { figure, container } = this.units.get(id)!
    const target = this.units.get(at)!.container
    const reach = new Phaser.Math.Vector2(target.x - container.x, target.y - container.y).setLength(LUNGE_PX)
    this.tweens.add({ targets: figure, x: reach.x, y: reach.y, duration: LUNGE_MS, yoyo: true, ease: 'Quad.easeOut' })
  }

  /** A shooter draws back a little from its target as it looses. */
  private recoil(id: UnitId, at: UnitId): void {
    const { figure, container } = this.units.get(id)!
    const target = this.units.get(at)!.container
    const back = new Phaser.Math.Vector2(container.x - target.x, container.y - target.y).setLength(LUNGE_PX / 2)
    this.tweens.add({ targets: figure, x: back.x, y: back.y, duration: RELEASE_MS, yoyo: true, ease: 'Quad.easeOut' })
  }

  /** Walks a unit along its path, turning it towards each step as it takes it. */
  private animateMove(id: UnitId, from: Hex, path: readonly Hex[]): void {
    if (path.length === 0) return
    const { container, plate, statusMarks, figure } = this.units.get(id)!
    figure.play('walk')
    // Each step lifts the unit a little and sets it down.
    this.tweens.add({
      targets: figure,
      y: -STEP_BOB_PX,
      duration: MOVE_STEP_MS / 2,
      yoyo: true,
      repeat: path.length - 1,
      ease: 'Sine.easeOut',
      onComplete: () => figure.setY(0),
    })
    this.tweens.chain({
      targets: [container, plate, statusMarks],
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
    this.refreshFoeInfo()
    this.column.refresh(this.activeIndex())
  }

  private refreshAllApPips(): void {
    const state = this.engine.getState()
    for (const snapshot of state.units) this.refreshApPips(this.units.get(snapshot.id)!, snapshot, state.phase)
  }

  private setPlayerControl(enabled: boolean): void {
    this.closeSkillMenu()
    this.playerControl = enabled
    if (enabled) this.ensureSelection()
    const attacks = enabled ? this.selectedAttacks().length : 0
    const uses = enabled ? this.selectedSkillUses() : []
    // Picking a target ends when control is lost or the action it was for is no longer legal.
    const aimed = this.targeting
    if (aimed === 'attack' ? attacks < 2 : aimed !== null && !uses.some((use) => usesSkill(use, this.selected!, aimed))) {
      this.targeting = null
    }
    const aiming = this.targeting !== null && this.targeting !== 'attack'
    this.setButtonEnabled(this.attackButton, attacks > 0)
    this.setButtonLabel(this.attackButton, this.targeting === 'attack' ? 'Cancel' : 'Attack')
    // The Skills button is the selected unit's, for one with a spell or an ability: it opens the list, greyed rows
    // and all, whenever the player has control, and shows the mana a unit with magic has left.
    const user = this.skillUser()
    this.castButton.setVisible(user !== undefined && this.engine.getState().phase !== 'over')
    this.setButtonEnabled(this.castButton, enabled && user !== undefined)
    this.setButtonLabel(this.castButton, aiming ? 'Cancel' : this.skillsLabel())
    this.setButtonEnabled(this.endTurnButton, enabled)
    this.setButtonEnabled(this.autoButton, enabled)
    if (enabled) this.startForecast()
    else {
      this.dropForecast()
      this.setButtonLabel(this.autoButton, forecastLabel(null, true))
    }
    this.refreshHighlights()
    this.updateRoundText()
    this.column.refresh(this.activeIndex())
  }

  /** The selected unit, if it has a spell or an ability to list. */
  private skillUser(): UnitSnapshot | undefined {
    return this.engine.getState().units.find((u) => u.id === this.selected && (u.magic || (u.abilities?.length ?? 0) > 0))
  }

  /** "Skills (21)" for a unit with magic, the mana it has left; "Skills" for one without. */
  private skillsLabel(): string {
    const user = this.skillUser()
    return user?.magic ? `Skills (${user.mana})` : 'Skills'
  }

  private setTargeting(what: 'attack' | Skill | null): void {
    this.targeting = what
    this.setPlayerControl(this.playerControl)
  }

  private onBoardClick(pointer: Phaser.Input.Pointer): void {
    if (!this.playerControl) return
    // A click away from the open Skills list closes it, and does nothing else.
    if (this.skillMenu) {
      this.closeSkillMenu()
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
    } else if (intent.kind === 'skill') {
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
      // A click on a foe that does nothing (`noStrikeHint` says why) is refused.
      if (attack) this.playerAct(strike)
      else playCue(this, 'ui.error')
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
   * Opens the list of the selected unit's spells and abilities, from which one
   * is picked to aim; pressed again, or while a skill is being aimed, it
   * cancels. A skill always asks for its target, even with one in reach: mana
   * and recharges are too dear to spend on a slip.
   */
  private onSkills(): void {
    if (!this.playerControl) return
    if (this.skillMenu) {
      this.closeSkillMenu()
      return
    }
    if (this.targeting !== null && this.targeting !== 'attack') {
      this.setTargeting(null)
      return
    }
    const self = this.engine.getState().units.find((u) => u.id === this.selected)
    if (self) this.openSkillMenu(self)
  }

  /**
   * The Skills list over the Skills button: a row a spell, then a row an
   * ability, numbered, each with its cost and any recharge, greyed where the
   * engine lists no use of it now. Hovering a row says what it does, and for
   * a greyed one why it cannot be used.
   */
  private openSkillMenu(self: UnitSnapshot): void {
    if (this.targeting === 'attack') this.setTargeting(null)
    const rows = skillMenuRows(self, this.engine.legalActions(self.id), this.engine.getState().units)
    const texts = rows.map(({ label, readyIn }, i) => `${i + 1}. ${label}${readyIn ? `  (ready in ${readyIn})` : ''}`)
    const width = Math.max(SKILL_ROW_W, ...texts.map((t) => t.length * SKILL_CHAR_W + 16))
    // Over the button, kept on screen and clear of the party's column.
    const x = Phaser.Math.Clamp(this.castButton.x, PARTY_PANEL_W + width / 2 + 4, Math.max(PARTY_PANEL_W + width / 2 + 4, this.scale.width - width / 2 - 4))
    const container = this.add.container(x, this.castButton.y - 22 - 6)
    const menu = { container, rows: [] as Array<{ row: SkillMenuRow; bg: Phaser.GameObjects.Rectangle }> }
    rows.forEach((row, i) => {
      const { enabled } = row
      const y = -(rows.length - i - 0.5) * SKILL_ROW_H
      const bg = this.add
        .rectangle(0, y, width, SKILL_ROW_H - 2, enabled ? 0x2b6cb0 : 0x424242)
        .setStrokeStyle(1, 0x90cdf4)
        .setInteractive({ useHandCursor: enabled })
      const text = this.add
        .text(-width / 2 + 8, y, texts[i], { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff' })
        .setOrigin(0, 0.5)
        .setAlpha(enabled ? 1 : 0.5)
      bg.on('pointerover', () => {
        if (enabled) bg.setFillStyle(0x3182ce)
        this.hintText.setText(this.skillRowHint(row)).setColor(enabled ? '#9e9e9e' : '#ffb74d')
      })
      bg.on('pointerout', () => {
        bg.setFillStyle(enabled ? 0x2b6cb0 : 0x424242)
        // The row's hint gives way to the one the turn had.
        this.showHint()
      })
      bg.on('pointerdown', () => this.pickSkill(i))
      container.add([bg, text])
      menu.rows.push({ row, bg })
    })
    this.skillMenu = menu
    this.setButtonLabel(this.castButton, 'Cancel')
  }

  /** "Pin: A weapon blow; …", and before it for a greyed row why it cannot be used now. */
  private skillRowHint(row: SkillMenuRow): string {
    const what = `${skillName(row)}: ${skillDescription(row)}`
    if (row.enabled) return what
    const why = row.why ?? 'Not now'
    return `${skillName(row)}: ${why}. ${skillDescription(row)}`
  }

  private closeSkillMenu(): void {
    if (!this.skillMenu) return
    this.skillMenu.container.destroy()
    this.skillMenu = null
    this.setButtonLabel(this.castButton, this.skillsLabel())
    this.showHint()
  }

  /** Picks the `index`th row of the open Skills list, if it can be used, to aim it; a greyed row says why not. */
  private pickSkill(index: number): void {
    const entry = this.skillMenu?.rows[index]
    if (!entry) return
    if (!entry.row.enabled) {
      playCue(this, 'ui.error')
      this.hintText.setText(this.skillRowHint(entry.row)).setColor('#ffb74d')
      return
    }
    playCue(this, 'ui.click')
    this.closeSkillMenu()
    const { row } = entry
    this.setTargeting(row.kind === 'spell' ? { kind: 'spell', id: row.id } : { kind: 'ability', id: row.id })
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
    let story: StoryItem[] = []
    if (round !== this.savedRound) {
      this.savedRound = round
      // Chosen before the save, so that what the story shows is saved as shown.
      story = storyFor(this.gameState, {
        kind: 'battle_turn',
        round,
        encounter: this.encounterId,
        threat: this.threat,
      })
      this.save()
    }
    this.setPlayerControl(true)
    showStory(this, this.gameState, story, this.anchors(), this.expedition.id)
  }

  /** Where the controls a tutorial tip may point at are on screen, those that show. */
  private anchors(): StoryAnchors {
    const centre = (button: Phaser.GameObjects.Container) => (button.visible ? { x: button.x, y: button.y } : undefined)
    const portrait = portraitRect(0)
    return {
      'battle.party': { x: portrait.x + portrait.width / 2, y: portrait.y + portrait.height / 2 },
      'battle.endTurn': centre(this.endTurnButton),
      'battle.cast': centre(this.castButton),
    }
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
          party: this.expedition.id,
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
    this.autoButton.setVisible(false)
    // The win and what it won are the world's from here on, however the scene is left.
    const found = playerWon && this.location ? takeLoot(this.expedition, this.location) : []
    // Runes roll from the battle's own seed, so a reloaded battle finds the same; a debug fight has no location and none.
    const seed = battleSeed(this.engine.getLog())
    const foundRunes = playerWon && this.location && seed !== null ? takeRunes(this.gameState, this.location.threat, this.location.encounter, seed) : []
    // Trophies are the foes' kinds', granted with no draw, after the runes.
    const trophies = playerWon && this.location ? takeTrophies(this.gameState, this.kinds) : {}
    if (playerWon && this.location) clearLocation(this.gameState, this.location.id)
    const foes = this.location ? theNameCapital(this.location.name) : 'Your foes'
    // The reward goes by the hit points the party ended on: who fell, and so who is dead.
    this.syncUnitsFromEngine()
    // What mana a winner has left is its own, to heal with on the world map; a level or a day of camping fills it.
    if (playerWon) {
      for (const unit of state.units) {
        const member = this.heroes.get(unit.id)
        if (member) member.mana = unit.mana
      }
    }
    // What the battle cost is read before the reward heals anyone: the hit points lost between the start and the end.
    const cost = playerWon ? costLines(battleCost(this.engine.getLog(), state.units, this.names)) : []
    // The fallen are dead: out of the party, their gear in the baggage.
    const reward = playerWon ? rewardVictory(this.expedition.members, this.xpReward, this.expedition.baggage) : null
    // The cost follows the first line, the experience won.
    const xpLines = reward ? describeRewards(reward) : []
    xpLines.splice(1, 0, ...cost)
    // A level gained is heard after the victory sting has played out.
    if (reward?.members.some(({ gain }) => gain.levelsGained > 0)) {
      const elapsed = this.endShownAt === null ? 0 : this.time.now - this.endShownAt
      playCue(this, 'stings.level_up', Math.max(0, levelUpDelayMs() - elapsed))
    }
    this.xpReward = 0
    // A lost battle wipes the party out: its heroes dead, what they had left lying here.
    const wipe = playerWon ? null : wipeParty(this.gameState, this.expedition.id, this.location)
    this.wipe = wipe
    if (!wipe?.lost) {
      // Kept as it happens: a page reloaded on the result screen opens the world map with the win, or without the fallen party.
      this.save()
    } else if (this.gameState.slot !== null) {
      // Permadeath: no hero is left, the playthrough is over and its slot is free. Nothing writes it back.
      deleteSlot(this.gameState.slot)
      this.gameState.slot = null
    }
    const foundAll = foundNames(found, foundRunes)
    const trophyLine = trophiesLine(trophies)
    const lootLines = [...(foundAll.length > 0 ? [`Found: ${listNames(foundAll)}.`] : []), ...(trophyLine ? [trophyLine] : [])]
    this.bannerText.setText(playerWon ? 'VICTORY!' : 'DEFEAT')
    this.bannerText.setColor(playerWon ? '#66bb6a' : '#ef5350')
    const [first, ...rest] = playerWon ? [`${foes} are beaten.`, ...xpLines, ...lootLines] : this.defeatLines(wipe!)
    const autoLines = this.autoRounds === null ? [] : [autoResolvedLine(this.autoRounds)]
    this.resultText.setText([first, ...autoLines, ...rest].join('\n'))
    this.setButtonLabel(this.menuButton, wipe?.lost ? 'Main Menu' : 'OK')
    this.layout()
    for (const part of [this.resultShade, this.bannerText, this.resultText, this.menuButton]) part.setVisible(true)
    this.updateRoundText()
    // The reward may have raised levels and healed wounds.
    this.column.refresh(this.activeIndex())
    this.dumpLog()
  }

  /** The defeat screen's lines: the game's end, or the fallen party, where its baggage lies, and the party the reserves formed. */
  private defeatLines(wipe: Wipe): string[] {
    if (wipe.lost) return ['The party has fallen. The journey ends here.']
    const fallen = `The ${this.expedition.name} has fallen.`
    const lines = [this.location ? `${fallen} Its baggage lies at ${theName(this.location.name)}.` : fallen]
    if (wipe.reformed) lines.push(`The reserves form the ${wipe.reformed.name} at ${encampmentName(this.gameState.world)}.`)
    return lines
  }

  /** Structured dump for balancing/AI tooling to scrape from devtools; once per battle. */
  private dumpLog(): void {
    if (this.logDumped) return
    this.logDumped = true
    console.info('[battle-log]', JSON.stringify(this.engine.getLog()))
  }
}
