import Phaser from 'phaser'
import type { Character } from '../character/character.ts'
import { canAdvance } from '../character/progression.ts'
import { MAX_BLIGHT, blightAt, blightGrowth, boardHex, boardIndex, type WorldEvent } from '../game/blight.ts'
import { atEncampment, improvementSite, towerSiteRefusal } from '../game/buildings.ts'
import { exchangePartners } from './exchangeView.ts'
import { UNTIL_LIMIT, act, actionBlocked, advance, advanceRefusal, blockingParty, partyNoun, passDay, setOrder, type DayReport } from '../game/company.ts'
import { campUntilHealed, canCamp, describeCamp, partyWounded } from '../game/camp.ts'
import { FIRST_PARTY_ID, presences, type DayAction, type Expedition, type PartyPresence } from '../game/expedition.ts'
import { newGame, selectedParty, type GameState } from '../game/gameState.ts'
import { SAVE_FAILED_MESSAGE, SAVE_WARNED_KEY, deleteSlot, saveGame } from '../game/saveSlots.ts'
import { craftTier } from '../game/crafting.ts'
import { FORECAST_SLICE_MS, Forecaster, forecastHint, forecastLabel, worldForecastStart, workFor, type Forecast } from '../game/forecast.ts'
import { isContacted, isSilent, partners } from '../game/trade.ts'
import { daysToFall, improvementName, siteImprovement } from '../game/territory.ts'
import { UNEXPLORED, knownBlightedShare, visibleHexes } from '../game/vision.ts'
import {
  encampment,
  encampmentName,
  followOrder,
  isNotable,
  locationAt,
  monstersHere,
  routeTo,
  theName,
  midSentence,
  theNameCapital,
  walkTo,
  worldActive,
  type Walked,
  type Lingering,
  type LocationKind,
  type WorldLocation,
  type WorldState,
} from '../game/worldMap.ts'
import { HexBoard, hexCorners, hexEquals, hexNeighbors, type Hex } from '../grid/hex.ts'
import { buttonProbe, type WorldProbe } from '../testHook.ts'
import type { CraftedData } from './CraftingScene.ts'
import { pauseMusic, playCue, playCues, resumeMusic, startMusic, stopMusic } from './soundPlayer.ts'
import { WORLD_SOUND_GAP_MS, buttonCue, reportEvents, worldSounds } from './sounds.ts'
import { WORLD_LAYOUT, boardHexAt, boardHexCenter, boardPixelSize, type Point } from './boardGeometry.ts'
import { CURSORS } from './cursors.ts'
import { clampOrigin, mapOrigin, pannedOrigin, pressMoved, rectContains, type Rect } from './mapScroll.ts'
import { PartyColumn } from './PartyColumn.ts'
import { PartyListView } from './PartyListView.ts'
import { BANNER_SPRITES, PARTY_LIST_W, bannerOf, deployedParties, figureOffsets, meetTarget, openingParty, orderLabel, partyListInfo, standingRoute, travelLabel, type PartyListEntry, type ShownOrder } from './partyList.ts'
import { UnitFigure } from './UnitFigure.ts'
import { heroLook, SPRITE_ATLAS, spriteAnim, spriteFrame } from './unitLook.ts'
import { FRAME_ACTIVE_COLOR, HEADER_BOTTOM, PARTY_PANEL_W, portraitClick, portraitRect } from './partyPanel.ts'
import { ROAD_COLORS, roadSegments, silenceShown, type RoadSegment } from './roadsView.ts'
import { advanceMessage, describeDays, describeOthers, describeStanding, describeWalk, describeWorldEvent, describeWorldEvents, yieldSummary } from './worldEvents.ts'
import { improveLabel } from './improveButton.ts'
import { hexInfo } from './hexInfo.ts'
import { tellStory, type StoryAnchors } from './StoryScene.ts'
import type { StoryMoment } from '../story/story.ts'
import type { DebugSource } from './debugCommands.ts'

/** A party's figure on the map: its first member's body, with its banner, which move as one. */
interface PartyToken {
  body: Phaser.GameObjects.Container
  figure: UnitFigure
  flag: Phaser.GameObjects.Sprite
}

interface WorldData {
  game?: GameState
  /** The id of the party to show selected; the first if left out or unknown. */
  party?: string
}

/** Each kind of location's sprite in the atlas (art/map/), which has an `idle` animation for each. */
const LOCATION_SPRITES: Record<LocationKind, string> = {
  monsters: 'map_monsters',
  encampment: 'map_encampment',
  resource: 'map_resource',
  partner: 'map_partner_village',
}
/** Each trade partner's own sprite; a partner without one uses `LOCATION_SPRITES.partner`. */
const PARTNER_SPRITES: Record<string, string> = { millbrook: 'map_partner_village', saltmere: 'map_partner_port' }
/** A silent partner's sprite and label, greyed. */
const SILENT_TINT = 0x9e9e9e
const SILENT_LABEL = '#9e9e9e'
/** A partner's name colour: a warm trade gold, apart from held green. */
const PARTNER_LABEL = '#ffe082'
/** The road overlay: dash and gap lengths along a segment, line widths, and the dark edge's colour. */
const ROAD_DASH = 9
const ROAD_GAP = 6
const ROAD_WIDTH = 3
const ROAD_EDGE_WIDTH = 6
const ROAD_EDGE = 0x1b1b1b
/** A watchtower's sprite, which is not a location's. */
const TOWER_SPRITE = 'map_watchtower'
/** A fort's palisade, drawn over its resource's icon. */
const FORT_SPRITE = 'map_fort'
/** Map sprites are drawn on a 24px canvas and shown at 2x. */
const LOCATION_SCALE = 2
/** Each party is its first member as the battlefield shows it, gear and all, but smaller, with its banner planted at its side. */
const PARTY_SPRITE = 'warrior'
const PARTY_SCALE = 2
/**
 * The banner, shown at 2x as the map's sprites are, stands behind the figure
 * and this far beside its feet: on its right, or its left for a party spread
 * left of a shared hex's centre, so the party beside it never hides it. The
 * atlas pivots it at its canvas's bottom centre, a little below and beside its
 * pole's foot (column 11, row 20).
 */
const BANNER_X = 18
const BANNER_Y = 6
const BANNER_SCALE = 2
/** The ring under the selected party's feet, in the gold that frames its entry in the list. */
const SELECTED_RING = FRAME_ACTIVE_COLOR
const SELECTED_RING_W = 30
const SELECTED_RING_H = 10
/** Locations stir out of step: each starts this much after the one before it. */
const LOCATION_STAGGER_MS = 310
/** How far below a hex's centre the party's feet stand, and a location's name starts. */
const PARTY_FEET_Y = 20
const LABEL_Y = 14
/** A location's sprite sits a little above centre, leaving room for its name. */
const LOCATION_Y = -6

/** Grassland olives near art/palette.toml's, close enough in shade to read as one field. */
const GRASS_COLORS = [0x556b2b, 0x4d6127, 0x5e7530]
const GRASS_EDGE = 0x14100c
const ROUTE_COLOR = 0xffffff
const ROUTE_EDGE = 0x000000
const MONSTERS_OUTLINE = 0xe53935
/** The standing route: what is left of the selected party's travel order, drawn while no hover route is. */
const ORDER_ROUTE_COLOR = 0xffd54f
const PARTY_OUTLINE = 0xffffff
const WALK_STEP_MS = 140

/** The blight's tint over the grass, by level: a muddy brown, then violets, each darker than the last, so worse land never looks healthier. */
const BLIGHT_TINTS = [0, 0x4a4030, 0x4a2058, 0x2e0f3a]
const BLIGHT_ALPHAS = [0, 0.35, 0.45, 0.6]
/** What grows on corrupted land, one to a hex, shown at its own size so it fits inside. */
const BLIGHT_SPRITE = 'map_blight'
const BLIGHT_SCALE = 1
/** The faint line along the edge of clean land. */
const FRONT_COLOR = 0xe8f5e9
/** The ring inside the party's hex where it stands on blighted land, which it keeps neutral. */
const NEUTRAL_RING = 0x90caf9
/** Fog: land never seen, and the veil over land remembered but out of sight. */
const UNEXPLORED_COLOR = 0x0b0b0e
const FOG_VEIL_ALPHA = 0.45
/** A location out of sight is drawn as remembered, faded. */
const REMEMBERED_ALPHA = 0.5
/** The Source is a monster location drawn darker and larger. */
const SOURCE_TINT = 0x9c4dcc
const SOURCE_SCALE = 3

/** The bars behind the header and the buttons: the map shows through them, dimmed. */
const BAR_COLOR = 0x1d1d1d
const BAR_ALPHA = 0.8
/** The stock panel's font, and the smaller one its three lines take where they would reach the hint. */
const STATUS_FONT = '13px'
const STATUS_FONT_SMALL = '11px'
/** The outcome screen's buttons. */
const BUTTON_W = 140
const BUTTON_H = 44
/** Between two buttons of the outcome screen. */
const BUTTON_GAP = 20
/** A footer button is as wide as its label needs, and no narrower than this, so that the busiest rows fit the least window. */
const MIN_FOOTER_BUTTON_W = 96
/** A footer label's monospace character at 16px, and the room either side of it. */
const LABEL_CHAR_W = 10
const LABEL_PAD = 24
/** Between two buttons of a footer row. */
const FOOTER_GAP = 12
/** The footer's rows are this far apart: the time buttons over the action buttons. */
const ROW_PITCH = BUTTON_H + 8
/** The info panel on the hovered hex or party, at the view's top right, left of the party list. */
const INFO_W = 280
const INFO_PAD = 10
/** The estimate tooltip's width, its text wrapped inside the padding. */
const FORECAST_TIP_W = 400
const INFO_MARGIN = 12

export class WorldScene extends Phaser.Scene {
  private gameState!: GameState
  private board!: HexBoard
  /** True while the party walks; clicks wait for it to arrive. */
  private walking = false
  /** While a walk plays: the order line the walking party shows, the order it walked by, which the game may already have ended. */
  private walkingOrder: ShownOrder | null = null
  /** The standing route as drawn now: empty while a hover route is drawn in its place, or there is none. */
  private drawnStandingRoute: readonly Hex[] = []
  /** The map hex under the pointer, or null when it is off the map or over a button. */
  private hovered: Hex | null = null

  /** The whole map, most of it off screen; `applyOrigin` scrolls it to keep the party in view, or where a drag left it. */
  private mapLayer!: Phaser.GameObjects.Container
  /** Where a drag has put the map's top-left corner, or null while the view follows the party. */
  private panOrigin: Point | null = null
  /** A press on the map not yet let go: a click to travel until it moves past the threshold, then a pan. */
  private press: (Point & { originAtPress: Point; panning: boolean }) | null = null
  /** The part of the screen between the bars, right of the party's column and left of the party list, where the map is in plain sight and takes clicks. */
  private view: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private headerBar!: Phaser.GameObjects.Rectangle
  private footerBar!: Phaser.GameObjects.Rectangle
  /** The route a click on the hovered hex would walk. */
  private hoverMarks!: Phaser.GameObjects.Graphics
  private partyMark!: Phaser.GameObjects.Graphics
  /** Every party's figure and banner on the map, by party id, in `partyLayer`, the selected one on top. */
  private figures = new Map<string, PartyToken>()
  private partyLayer!: Phaser.GameObjects.Container
  /** A gold ring under the selected party's feet and a pointer over its head, at its figure's offset, so it is told apart on a shared hex; under every figure. */
  private selectedMark!: Phaser.GameObjects.Graphics

  private turnText!: Phaser.GameObjects.Text
  private hintText!: Phaser.GameObjects.Text
  /** The auto-resolve estimate being worked out for the battle Attack would start, and the key of that battle (see refresh). */
  private forecaster: Forecaster | null = null
  private forecastKey: string | null = null
  /** How many estimates this visit to the map has started, for the probe. */
  private forecastRuns = 0
  /** The finished estimate for the battle in hand, else null. */
  private forecastResult: Forecast | null = null
  /** Whether the pointer is over the Auto-resolve button, whose hover puts the estimate in the hint. */
  private autoHovered = false
  /** The party's portraits down the left. */
  private column!: PartyColumn
  /** The party member marked in the column, whose panel C or a click on its portrait opens. */
  private active = 0
  /** The company's parties down the right; a click on one selects it and centres the view on it. */
  private partyList!: PartyListView
  /** The id of the party the column shows and Home centres on. */
  private selectedParty = FIRST_PARTY_ID
  /** The party entry under the pointer, whose summary the info panel shows, or null. */
  private hoveredParty: string | null = null
  /** What last happened, above the buttons. */
  private messageText!: Phaser.GameObjects.Text
  /** The prompt to spend points the message line last showed (`advanceMessage`), so that an overlay closing may bring it up to date. */
  private advancePrompt = ''
  /** Scout, Wait, Attack and Auto-resolve, shown while the party stands among monsters. */
  private buttons: Phaser.GameObjects.Container[] = []
  /** Camp, Camp until healed and Craft, shown wherever else the party stands still, and Build Watchtower where one may stand. */
  private campButtons: Phaser.GameObjects.Container[] = []
  /** Next day and Until something happens, in a row over the others, shown while the game is active and the party is not before monsters. */
  private timeButtons: Phaser.GameObjects.Container[] = []
  /** In the time row: Home, away from the encampment, and Garrison, on a held resource. */
  private homeButton!: Phaser.GameObjects.Container
  private garrisonButton!: Phaser.GameObjects.Container
  /** Also in the time row, while another party stands on the selected party's hex: opens the Exchange overlay. */
  private exchangeButton!: Phaser.GameObjects.Container
  private towerButton!: Phaser.GameObjects.Container
  /** Shown on a held resource below a fort: builds its next level, and names it and its cost (`improveLabel`). */
  private improveButton!: Phaser.GameObjects.Container
  /** The last yield day's summary the scene saw (`yieldSummary`), the stock panel's third line; not saved, so blank after a load. */
  private lastYield: string | null = null
  /** How many forts' palisades the map draws, for the probe. */
  private palisades = 0
  /** Shown at the encampment, beside the camp buttons: goes in, to its facilities. */
  private encampmentButton!: Phaser.GameObjects.Container
  /** What the player knows of the hovered hex (`hexInfo`), hidden while no hex is hovered. */
  private infoBox!: Phaser.GameObjects.Rectangle
  private infoText!: Phaser.GameObjects.Text
  /** The estimate's tooltip above the Auto-resolve button, shown while the button is hovered. */
  private forecastTipBox!: Phaser.GameObjects.Rectangle
  private forecastTipText!: Phaser.GameObjects.Text

  /**
   * The blight's tint and the front line, drawn in
   * `blightMarks` (off the display list) and from there into `blightLayer`
   * once each time the land changes: a Graphics of the whole map would be
   * worked out again every frame.
   */
  private blightMarks!: Phaser.GameObjects.Graphics
  private blightLayer!: Phaser.GameObjects.RenderTexture
  /** The growths on corrupted land as the player knows it, rebuilt with `blightLayer`. */
  private blightSprites!: Phaser.GameObjects.Container
  /** The locations' sprites, under the party, and their names and badges, over it; the sprites are rebuilt when a location comes or goes. */
  private siteSprites!: Phaser.GameObjects.Container
  private siteLabels!: Phaser.GameObjects.Container
  /** The ids of the locations drawn, and the levels of the land, to tell when they must be drawn again. */
  private drawnLocations = ''
  /** The roads layer: dashed segments between hex centres, in `ROAD_COLORS`. */
  private roadMarks!: Phaser.GameObjects.Graphics
  /** The segments as drawn now, and their key. */
  private drawnRoads: RoadSegment[] = []
  private drawnRoadsKey = ''
  /** The partners' sprites and labels as drawn now, for the probe's `grey`. */
  private partnerSprites = new Map<string, Phaser.GameObjects.Sprite>()
  private partnerLabels = new Map<string, Phaser.GameObjects.Text>()
  private drawnBlight = ''
  /** The hexes in sight as of the last refresh, by `boardIndex`. */
  private visible = new Set<number>()
  /** The share of the land blighted, the blight's growth and the stock, at the header's right. */
  private statusText!: Phaser.GameObjects.Text
  /** The screen over the map when the game is won or lost, and its buttons: End and Continue, or Main Menu. */
  private outcomeShade!: Phaser.GameObjects.Rectangle
  private outcomeText!: Phaser.GameObjects.Text
  private endButton!: Phaser.GameObjects.Container
  private endlessButton!: Phaser.GameObjects.Container
  private menuButton!: Phaser.GameObjects.Container

  constructor() {
    super('World')
  }

  private get world(): WorldState {
    return this.gameState.world
  }

  preload(): void {
    PartyColumn.preload(this)
  }

  create(data: WorldData): void {
    const previous = this.gameState
    this.gameState = data?.game ?? newGame()
    // The last yield is the scene's, not saved: kept over a battle of the same game, blank for another or a loaded one.
    if (this.gameState !== previous) this.lastYield = null
    this.board = new HexBoard(this.world.board)
    // Phaser reuses the scene instance on restart, so field initializers don't run again.
    this.walking = false
    this.forecaster = null
    this.forecastKey = null
    this.forecastRuns = 0
    this.forecastResult = null
    this.autoHovered = false
    this.hovered = null
    this.panOrigin = null
    this.press = null
    this.selectedParty = openingParty(this.gameState, data?.party).id
    this.hoveredParty = null
    // The first member with something to spend, so one click on its portrait opens its panel.
    this.active = Math.max(0, this.selectedMembers().findIndex(canAdvance))

    this.mapLayer = this.add.container(0, 0)
    this.buildTerrain()
    this.blightMarks = this.make.graphics({}, false)
    const map = boardPixelSize(this.world.board, WORLD_LAYOUT)
    this.blightLayer = this.add.renderTexture(0, 0, Math.ceil(map.width), Math.ceil(map.height)).setOrigin(0)
    this.blightSprites = this.add.container(0, 0)
    this.roadMarks = this.add.graphics()
    this.drawnRoads = []
    this.drawnRoadsKey = ''
    this.hoverMarks = this.add.graphics()
    this.partyMark = this.add.graphics()
    this.siteSprites = this.add.container(0, 0)
    this.siteLabels = this.add.container(0, 0)
    this.drawnLocations = ''
    this.drawnBlight = ''
    this.visible = new Set()
    this.selectedMark = this.add.graphics()
    this.partyLayer = this.add.container(0, 0, [this.selectedMark])
    this.figures = new Map()
    this.mapLayer.add([this.blightLayer, this.blightSprites, this.roadMarks, this.hoverMarks, this.partyMark, this.siteSprites, this.partyLayer, this.siteLabels])
    this.syncFigures()

    this.headerBar = this.add.rectangle(0, 0, 0, 0, BAR_COLOR, BAR_ALPHA).setOrigin(0)
    this.footerBar = this.add.rectangle(0, 0, 0, 0, BAR_COLOR, BAR_ALPHA).setOrigin(0)
    this.turnText = this.add.text(20, 16, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' })
    this.statusText = this.add
      // Outlined in the bar's colour: a map label dimmed under the header can show through behind its three lines.
      .text(0, 16, '', { fontFamily: 'monospace', fontSize: STATUS_FONT, color: '#ce93d8', align: 'right', stroke: '#1d1d1d', strokeThickness: 4 })
      .setOrigin(1, 0)
    this.hintText = this.add.text(20, 44, '', { fontFamily: 'monospace', fontSize: '13px', color: '#9e9e9e' })
    this.messageText = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '15px', color: '#cfd8dc' })
      .setOrigin(0.5)
    this.infoBox = this.add.rectangle(0, 0, INFO_W, 0, BAR_COLOR, BAR_ALPHA).setOrigin(0).setStrokeStyle(1, 0x616161)
    this.infoText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#e0e0e0',
      lineSpacing: 3,
      wordWrap: { width: INFO_W - 2 * INFO_PAD },
    })
    this.forecastTipBox = this.add.rectangle(0, 0, FORECAST_TIP_W, 0, BAR_COLOR, BAR_ALPHA).setOrigin(0).setStrokeStyle(1, 0x616161).setVisible(false)
    this.forecastTipText = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '12px', color: '#e0e0e0', lineSpacing: 3, wordWrap: { width: FORECAST_TIP_W - 2 * INFO_PAD } })
      .setVisible(false)

    this.buttons = [
      this.createButton('Scout', () => this.onLinger('scout')),
      this.createButton('Wait', () => this.onLinger('wait')),
      this.createButton('Attack', () => this.onAttack()),
      this.createButton(forecastLabel(null, false), () => this.onAutoResolve()),
    ]
    const autoBg = this.buttons[3].getData('bg') as Phaser.GameObjects.Rectangle
    autoBg.on('pointerover', () => {
      this.autoHovered = true
      this.refreshHint()
    })
    autoBg.on('pointerout', () => {
      this.autoHovered = false
      this.refreshHint()
    })
    this.timeButtons = [
      this.createButton('Next day', () => this.onNextDay()),
      this.createButton('Until something happens', () => this.onUntilSomething()),
    ]
    // Not "Home", which is the key that centres the view.
    this.homeButton = this.createButton('Return home', () => this.onHome())
    this.garrisonButton = this.createButton('Garrison', () => this.onGarrison())
    this.exchangeButton = this.createButton('Exchange', () => this.openExchange())
    this.campButtons = [
      this.createButton('Camp', () => this.onCamp()),
      this.createButton('Camp until healed', () => this.onCampUntilHealed()),
      this.createButton('Craft', () => this.openCrafting()),
    ]
    this.towerButton = this.createButton('Build Watchtower', () => this.onBuildTower())
    this.improveButton = this.createButton('Build an Outpost', () => this.onImprove())
    this.encampmentButton = this.createButton(`Enter ${encampmentName(this.world)}`, () => this.openEncampment())
    this.column = new PartyColumn(this, this.selectedMembers(), (index) => this.onPortrait(index))
    // Before the outcome screen, which covers it.
    this.partyList = new PartyListView(
      this,
      (id) => this.onPartyEntry(id),
      (id) => this.onPartyHover(id),
    )

    // Made 1×1, not 0×0: Phaser gives a shape of no size no hit area, and layout's setSize grows only one it has.
    this.outcomeShade = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.75).setOrigin(0).setInteractive()
    this.outcomeText = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', align: 'center', lineSpacing: 8 })
      .setOrigin(0.5)
    this.endButton = this.createButton('End', () => this.onEnd(), BUTTON_W)
    this.endlessButton = this.createButton('Continue', () => this.onEndless(), BUTTON_W)
    this.menuButton = this.createButton('Main Menu', () => this.scene.start('Menu'), BUTTON_W)

    // Phaser passes the interactive objects under the pointer; a press on a button is not a press on the map.
    // A press travels when let go, unless it moved far enough to be a drag, which pans the map instead.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || !rectContains(this.view, pointer) || this.walking || this.outcomeShade.visible) return
      const originAtPress = { x: this.mapLayer.x, y: this.mapLayer.y }
      this.press = { x: pointer.x, y: pointer.y, originAtPress, panning: false }
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // A move with no button held: the release went unreported (let go off the window), so the press is over.
      if (this.press && pointer.noButtonDown()) this.endPress()
      if (this.press && pointer.isDown && this.onDrag(pointer)) return
      this.setHovered(over.length > 0 ? null : this.hexAt(pointer.x, pointer.y))
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const press = this.endPress()
      // A release may carry the pointer past the threshold with no move reported before it: a drag all the same.
      if (press && !press.panning && !pressMoved(press, pointer)) this.onMapClick(press)
      this.setHovered(over.length > 0 ? null : this.hexAt(pointer.x, pointer.y))
    })
    // Let go off the game, or left with the button down: a pan stays where it got to, and a press is no click.
    this.input.on('pointerupoutside', () => this.endPress())
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.endPress()
      this.clearPartyHover()
      this.setHovered(null)
    })
    // A paused map (menu open) mustn't leave its cursor on the overlay.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => {
      this.endPress()
      this.clearPartyHover()
      this.setHovered(null)
    })
    this.input.keyboard?.on('keydown-ESC', () => this.openMenu())
    this.input.keyboard?.on('keydown-C', () => this.openPanel(this.active))
    this.input.keyboard?.on('keydown-HOME', () => this.centreOnSelected())
    // Kept from the browser, which would otherwise scroll a page held below the game's minimum size.
    this.input.keyboard?.addCapture('HOME')
    // Back from a member's panel, where skill points and perks may have been spent, and
    // which tells the member it last showed. The menu resumes the map too, and tells nothing.
    // Back from field crafting, which hands back what it made and the day that passed (`CraftedData`).
    this.events.on(Phaser.Scenes.Events.RESUME, (_sys: Phaser.Scenes.Systems, data?: { member?: number; exchanged?: boolean } & Partial<CraftedData>) => {
      // The menu pauses the theme; the options there may have changed its volume.
      resumeMusic()
      this.active = data?.member ?? this.active
      // An exchange changed who is in the parties: the column is built again for the selected party's members.
      if (data?.exchanged) this.rebuildColumn()
      if (data?.crafted) this.crafted(data.crafted)
      this.promptAdvance()
      this.refresh()
      this.save()
    })

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
      this.input.setDefaultCursor('default')
      this.input.keyboard?.removeCapture('HOME')
      stopMusic('music_world_map')
    })

    startMusic(this, 'music_world_map')

    const here = monstersHere(this.world, this.expedition())
    // Only the prompt to spend points is the advance prompt; a threat line is kept as it is when an overlay closes.
    this.advancePrompt = this.world.status === 'won' || here ? '' : advanceMessage(this.expedition().members)
    this.messageText.setText(this.world.status !== 'won' && here ? describeStanding(this.gameState, this.expedition(), here) : this.advancePrompt)
    this.refresh()
    // After the first refresh: the view centres on where the party stands.
    this.layout()
    // However the map was come to (a new game, a battle won, a load), the slot now holds it.
    this.save()
    this.checkOutcome()
    this.tell({ kind: 'world_opened' })
  }

  /**
   * While walking, follows the walk; otherwise works the auto-resolve estimate
   * in a slice of at most FORECAST_SLICE_MS a frame. Phaser calls no update on
   * a paused scene, so nothing is worked under an overlay.
   */
  update(): void {
    if (this.walking) {
      this.applyOrigin()
      return
    }
    if (!this.forecaster || !this.buttons[3].visible || this.outcomeShade.visible) return
    const done = workFor(this.forecaster, FORECAST_SLICE_MS)
    if (!done) return
    this.forecastResult = done
    this.forecaster = null
    this.setAutoLabel()
    this.refreshHint()
  }

  /**
   * Starts an estimate for the battle Attack would start, unless the one in
   * hand is for it already (the same location, party, day and fighters), and
   * drops it when no Auto-resolve button shows. Never while walking.
   */
  private refreshForecast(): void {
    const start = this.buttons[3].visible && !this.walking && this.world.status !== 'lost' && this.world.status !== 'won' ? worldForecastStart(this.gameState, this.expedition()) : null
    if (!start) {
      this.dropForecast()
      return
    }
    const key = `${start.base}:${JSON.stringify(start.start)}`
    if (key !== this.forecastKey) {
      this.forecaster = new Forecaster(start.start, start.base)
      this.forecastKey = key
      this.forecastRuns++
      this.forecastResult = null
    }
    this.setAutoLabel()
  }

  /** Throws the estimate away: the battle it was for no longer stands, or the map is left. */
  private dropForecast(): void {
    this.forecaster = null
    this.forecastKey = null
    this.forecastResult = null
    this.autoHovered = false
    this.setAutoLabel()
  }

  /**
   * The Improve button's text: the whole label where the camp row, with it,
   * fits the window beside the party's column, else the compact one (no
   * cost; the hex info tells it). Chosen by `layout`, so a resize and every
   * refresh (after the other buttons' visibility is set) get it right.
   */
  private setImproveLabel(): void {
    if (!this.improveButton.visible) return
    const world = this.world
    const expedition = this.expedition()
    const full = improveLabel(world, expedition)
    if (full === null) return
    const others = [...this.campButtons, this.towerButton, this.encampmentButton].filter((button) => button.visible)
    const used = others.reduce((sum, button) => sum + button.width + FOOTER_GAP, 0)
    const room = this.scale.width - PARTY_PANEL_W - 2 * FOOTER_GAP - used
    const label = WorldScene.footerWidth(full) <= room ? full : improveLabel(world, expedition, true)!
    const text = this.improveButton.getData('text') as Phaser.GameObjects.Text
    if (text.text === label) return
    text.setText(label)
    const width = WorldScene.footerWidth(label)
    ;(this.improveButton.getData('bg') as Phaser.GameObjects.Rectangle).setSize(width, BUTTON_H)
    this.improveButton.setSize(width, BUTTON_H)
  }

  /** Keeps the last yield day among `events` for the stock panel; days without one leave the line as it was. */
  private noteYield(events: readonly WorldEvent[]): void {
    this.lastYield = yieldSummary(events) ?? this.lastYield
  }

  /** The Auto-resolve button reads the estimate; the row is laid out again when its width changes. */
  private setAutoLabel(): void {
    const button = this.buttons[3]
    const label = forecastLabel(this.forecastResult, false)
    const text = button.getData('text') as Phaser.GameObjects.Text
    if (text.text === label) return
    text.setText(label)
    const width = WorldScene.footerWidth(label)
    ;(button.getData('bg') as Phaser.GameObjects.Rectangle).setSize(width, BUTTON_H)
    button.setSize(width, BUTTON_H)
    this.layout()
  }

  /** What the in-browser tests see of the world map; see testHook.ts. */
  /** What the debug console (debugConsole.ts) works on: the game, redrawn and saved after a command changes it. */
  debugSource(): DebugSource {
    return {
      game: this.gameState,
      party: this.selectedParty,
      changed: () => {
        this.promptAdvance()
        this.refresh()
        this.save()
        this.checkOutcome()
      },
      // As an attack on a location would, but with none behind it: it clears none and takes no loot.
      fight: (encounter, threat, party) => this.scene.start('Battle', { game: this.gameState, encounter, threat, party }),
    }
  }

  probe(): WorldProbe {
    const game = this.gameState
    const [scout, wait, attack, autoResolve] = this.buttons.map((button) => buttonProbe(button))
    const [nextDay, untilSomething] = this.timeButtons.map((button) => buttonProbe(button))
    const camp = buttonProbe(this.campButtons[0])
    const campUntilHealed = buttonProbe(this.campButtons[1], partyWounded(this.expedition().members))
    return {
      world: this.world,
      partyAt: this.expedition().position,
      confronting: this.expedition().confronting,
      standingRoute: [...this.drawnStandingRoute],
      walking: this.walking,
      origin: { x: this.mapLayer.x, y: this.mapLayer.y },
      view: this.view,
      message: this.messageText.text,
      hint: this.hintText.text,
      forecastTip: this.forecastTipBox.visible ? this.rectOf(this.forecastTipBox) : null,
      forecastTipText: this.forecastTipBox.visible ? this.forecastTipText.text : '',
      statusRect: this.statusText.getBounds(),
      hintRect: this.hintText.getBounds(),
      forecast: this.forecastResult,
      forecastRuns: this.forecastRuns,
      autoLabel: (this.buttons[3].getData('text') as Phaser.GameObjects.Text).text,
      outcome: this.outcomeText.visible ? this.outcomeText.text : '',
      visible: [...this.visible].sort((a, b) => a - b),
      info: this.infoText.visible ? this.infoText.text : '',
      improveLabel: this.improveButton.visible ? (this.improveButton.getData('text') as Phaser.GameObjects.Text).text : null,
      status: this.statusText.text,
      palisades: this.palisades,
      roads: this.world.routes.map((route) => ({
        route: route.id,
        shades: this.drawnRoads.filter((s) => s.route === route.id).map((s) => s.shade),
      })),
      partners: partners(this.world).map((p) => ({
        id: p.id,
        contacted: isContacted(this.world, p.id),
        silent: isSilent(this.world, p.id),
        grey: this.partnerGrey(p.id),
        drawn: this.knowledgeOf(p) !== 'hidden',
      })),
      buttons: {
        scout,
        wait,
        attack,
        autoResolve,
        nextDay,
        untilSomething,
        home: buttonProbe(this.homeButton),
        garrison: buttonProbe(this.garrisonButton),
        exchange: buttonProbe(this.exchangeButton),
        camp,
        campUntilHealed,
        buildTower: buttonProbe(this.towerButton),
        improve: buttonProbe(this.improveButton),
        enterEncampment: buttonProbe(this.encampmentButton),
        craft: buttonProbe(this.campButtons[2]),
        end: buttonProbe(this.endButton),
        endless: buttonProbe(this.endlessButton),
        menu: buttonProbe(this.menuButton),
      },
      party: this.column.probe(),
      parties: this.partyList.probe(),
      selectedParty: this.selectedParty,
      infoRect: this.infoBox.visible
        ? { x: this.infoBox.x, y: this.infoBox.y, width: this.infoBox.width, height: this.infoBox.height }
        : null,
      partyLook: this.selectedToken()?.figure.lookNames() ?? [],
      figures: game.parties.flatMap((party) => {
        const token = this.figures.get(party.id)
        if (!token) return []
        return [{ id: party.id, at: party.position, screen: { x: this.mapLayer.x + token.body.x, y: this.mapLayer.y + token.body.y } }]
      }),
    }
  }

  // ---- build ---------------------------------------------------------------

  private hexPolygon(h: Hex): Phaser.Math.Vector2[] {
    const c = boardHexCenter(h, WORLD_LAYOUT)
    return hexCorners(WORLD_LAYOUT.hexSize).map((p) => new Phaser.Math.Vector2(c.x + p.x, c.y + p.y))
  }

  private buildTerrain(): void {
    const terrain = this.add.graphics()
    for (const h of this.board.hexes) {
      // A three-colouring: no two neighbouring hexes share a shade.
      const shade = (((h.q - h.r) % 3) + 3) % 3
      const polygon = this.hexPolygon(h)
      terrain.fillStyle(GRASS_COLORS[shade], 1)
      terrain.fillPoints(polygon, true)
      terrain.lineStyle(1, GRASS_EDGE, 0.5)
      terrain.strokePoints(polygon, true)
    }
    this.mapLayer.add(terrain)
  }

  /**
   * How the player knows a location: 'hidden' (monsters not sighted, or a
   * town or resource on land never explored), 'remembered' (known but out of
   * sight) or 'seen'.
   */
  private knowledgeOf(location: WorldLocation): 'hidden' | 'remembered' | 'seen' {
    const i = boardIndex(this.world.board, location.position)
    const known = location.kind === 'monsters' ? this.world.sighted.includes(location.id) : this.world.seen[i] !== UNEXPLORED
    if (!known) return 'hidden'
    return this.visible.has(i) ? 'seen' : 'remembered'
  }

  /** The open roads, dashed between hex centres in their security's colour; redrawn only when a shade changes. Drawn through the fog: the roads are the company's own. */
  private refreshRoads(): void {
    const segments = roadSegments(this.world, this.presences())
    const key = segments.map((s) => `${s.route}:${s.from.q},${s.from.r}:${s.shade}`).join()
    if (key === this.drawnRoadsKey) return
    this.drawnRoadsKey = key
    this.drawnRoads = segments
    const g = this.roadMarks.clear()
    for (const edge of [true, false]) {
      for (const seg of segments) {
        const a = boardHexCenter(seg.from, WORLD_LAYOUT)
        const b = boardHexCenter(seg.to, WORLD_LAYOUT)
        const length = Math.hypot(b.x - a.x, b.y - a.y)
        g.lineStyle(edge ? ROAD_EDGE_WIDTH : ROAD_WIDTH, edge ? ROAD_EDGE : ROAD_COLORS[seg.shade], edge ? 0.7 : 1)
        for (let d = 0; d < length; d += ROAD_DASH + ROAD_GAP) {
          const from = d / length
          const to = Math.min(length, d + ROAD_DASH) / length
          g.lineBetween(a.x + (b.x - a.x) * from, a.y + (b.y - a.y) * from, a.x + (b.x - a.x) * to, a.y + (b.y - a.y) * to)
        }
      }
    }
  }

  /** Whether a partner is drawn grey: silent, and the player may know it (contacted, or in sight now). */
  private greyed(id: string): boolean {
    return silenceShown(this.world, id, this.visible.has(boardIndex(this.world.board, partners(this.world).find((p) => p.id === id)!.position)))
  }

  /** Whether a partner's drawn sprite is tinted grey and its drawn label is grey, for the probe. */
  private partnerGrey(id: string): boolean {
    const sprite = this.partnerSprites.get(id)
    const label = this.partnerLabels.get(id)
    return !!sprite && !!label && sprite.isTinted && sprite.tintTopLeft === SILENT_TINT && label.style.color === SILENT_LABEL
  }

  /** Every known location's sprite, under the party, faded where out of sight; drawn again only when that changes. */
  private refreshLocations(): void {
    const key = [
      ...this.world.locations.map((l) => `${l.id}:${this.knowledgeOf(l)}${l.kind === 'partner' && this.greyed(l.id) ? ':silent' : ''}`),
      ...this.world.towers.map((t) => t.id),
      ...this.world.locations.filter((l) => siteImprovement(this.world, l.id) === 3).map((l) => `fort:${l.id}`),
    ].join()
    if (key === this.drawnLocations) return
    this.drawnLocations = key
    this.partnerSprites.clear()
    this.siteSprites.removeAll(true)
    this.palisades = 0
    for (const [i, location] of this.world.locations.entries()) {
      const knowledge = this.knowledgeOf(location)
      if (knowledge === 'hidden') continue
      const { x, y } = boardHexCenter(location.position, WORLD_LAYOUT)
      const sprite = location.kind === 'partner' ? (PARTNER_SPRITES[location.id] ?? LOCATION_SPRITES.partner) : LOCATION_SPRITES[location.kind]
      const source = location.kind === 'monsters' && location.source
      const figure = this.add
        .sprite(x, y + LOCATION_Y, SPRITE_ATLAS, spriteFrame(sprite, 'base'))
        .setScale(source ? SOURCE_SCALE : LOCATION_SCALE)
        .play({ key: spriteAnim(sprite, 'idle'), delay: (i * LOCATION_STAGGER_MS) % 1000 })
      if (source) figure.setTint(SOURCE_TINT)
      if (location.kind === 'partner') {
        this.partnerSprites.set(location.id, figure)
        if (this.greyed(location.id)) figure.setTint(SILENT_TINT)
      }
      if (knowledge === 'remembered') figure.setAlpha(REMEMBERED_ALPHA)
      this.siteSprites.add(figure)
      // A fort's palisade rings its resource's icon.
      if (siteImprovement(this.world, location.id) === 3) {
        const palisade = this.add
          .sprite(x, y + LOCATION_Y, SPRITE_ATLAS, spriteFrame(FORT_SPRITE, 'base'))
          .setScale(LOCATION_SCALE)
          .play({ key: spriteAnim(FORT_SPRITE, 'idle'), delay: (i * LOCATION_STAGGER_MS) % 1000 })
        if (knowledge === 'remembered') palisade.setAlpha(REMEMBERED_ALPHA)
        this.siteSprites.add(palisade)
        this.palisades++
      }
    }
    for (const [i, tower] of this.world.towers.entries()) {
      const { x, y } = boardHexCenter(tower.position, WORLD_LAYOUT)
      this.siteSprites.add(
        this.add
          .sprite(x, y + LOCATION_Y, SPRITE_ATLAS, spriteFrame(TOWER_SPRITE, 'base'))
          .setScale(LOCATION_SCALE)
          .play({ key: spriteAnim(TOWER_SPRITE, 'idle'), delay: (i * LOCATION_STAGGER_MS) % 1000 }),
      )
    }
  }

  /** Every known location's name over the party, so none is hidden: a held site's starred, and a threatened one's with the days until it falls. */
  private refreshLabels(): void {
    this.siteLabels.removeAll(true)
    this.partnerLabels.clear()
    for (const location of this.world.locations) {
      const knowledge = this.knowledgeOf(location)
      if (knowledge === 'hidden') continue
      const { x, y } = boardHexCenter(location.position, WORLD_LAYOUT)
      const held = this.world.held.includes(location.id)
      const days =
        location.kind !== 'monsters' && this.world.threatened.includes(location.id)
          ? daysToFall(this.world, this.presences(), location)
          : null
      const lines = [held ? `${location.name} *` : location.name]
      const built = siteImprovement(this.world, location.id)
      if (built !== 0 && location.kind === 'resource') lines.push(improvementName(location, built))
      if (days !== null) lines.push(`falls in ${days}d`)
      const label = this.add
          .text(x, y + LABEL_Y, lines.join('\n'), {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: labelColor(location, held, days !== null, location.kind === 'partner' && this.greyed(location.id)),
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
          })
          .setOrigin(0.5, 0)
          .setAlpha(knowledge === 'remembered' ? REMEMBERED_ALPHA + 0.25 : 1)
      this.siteLabels.add(label)
      if (location.kind === 'partner') this.partnerLabels.set(location.id, label)
    }
    // A tower goes unnamed until the blight gains on it.
    for (const tower of this.world.towers) {
      const days = this.world.threatened.includes(tower.id) ? daysToFall(this.world, this.presences(), tower) : null
      if (days === null) continue
      const { x, y } = boardHexCenter(tower.position, WORLD_LAYOUT)
      this.siteLabels.add(
        this.add
          .text(x, y + LABEL_Y, `Watchtower\nfalls in ${days}d`, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#ffb74d',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
          })
          .setOrigin(0.5, 0),
      )
    }
  }

  /**
   * The land as the player knows it (`seen`): black where never explored;
   * elsewhere each hex's tint for its level as last seen, a growth on corrupted
   * land (faded out of sight) and a faint line along every edge between clean land and blighted,
   * under a veil where out of sight.
   */
  private refreshBlight(): void {
    const { board, seen } = this.world
    const drawn = `${seen.join('')}|${[...this.visible].join()}`
    if (drawn === this.drawnBlight) return
    this.drawnBlight = drawn
    const g = this.blightMarks.clear()
    this.blightSprites.removeAll(true)
    const size = WORLD_LAYOUT.hexSize
    for (let i = 0; i < seen.length; i++) {
      const level = seen[i]
      const h = boardHex(board, i)
      const c = boardHexCenter(h, WORLD_LAYOUT)
      if (level === UNEXPLORED) {
        g.fillStyle(UNEXPLORED_COLOR, 1).fillPoints(this.hexPolygon(h), true)
        continue
      }
      if (!this.visible.has(i)) g.fillStyle(0x000000, FOG_VEIL_ALPHA).fillPoints(this.hexPolygon(h), true)
      if (level > 0) {
        g.fillStyle(BLIGHT_TINTS[level], BLIGHT_ALPHAS[level]).fillPoints(this.hexPolygon(h), true)
        if (level === MAX_BLIGHT) {
          const growth = this.add
            .sprite(c.x, c.y, SPRITE_ATLAS, spriteFrame(BLIGHT_SPRITE, 'base'))
            .setScale(BLIGHT_SCALE)
            .play({ key: spriteAnim(BLIGHT_SPRITE, 'idle'), delay: (i * LOCATION_STAGGER_MS) % 1400 })
          if (!this.visible.has(i)) growth.setAlpha(REMEMBERED_ALPHA)
          this.blightSprites.add(growth)
        }
        continue
      }
      // The edge two hexes share is a side's length, square across the line between their centres.
      g.lineStyle(2, FRONT_COLOR, 0.35)
      for (const n of hexNeighbors(h)) {
        if (!this.board.contains(n) || seen[boardIndex(board, n)] <= 0) continue
        const d = boardHexCenter(n, WORLD_LAYOUT)
        const mx = (c.x + d.x) / 2
        const my = (c.y + d.y) / 2
        const length = Math.hypot(d.x - c.x, d.y - c.y)
        const px = (-(d.y - c.y) / length) * (size / 2)
        const py = ((d.x - c.x) / length) * (size / 2)
        g.lineBetween(mx - px, my - py, mx + px, my + py)
      }
    }
    this.blightLayer.clear().draw(g).render()
    g.clear()
  }

  /**
   * Draws a figure for every party of the company (none for an empty one),
   * dressed as its first member is now and with its banner, making and
   * dropping figures as parties come and go; each stands on its hex, spread
   * across where parties share one, and the selected party's is drawn on top.
   * While a walk plays nothing moves here: the walking party's figure is the
   * walk's, and the others jump to their hexes once it ends.
   */
  private syncFigures(): void {
    const parties = this.gameState.parties.filter((party) => party.members.length > 0)
    for (const [id, token] of this.figures) {
      if (parties.some((party) => party.id === id)) continue
      token.body.destroy()
      this.figures.delete(id)
    }
    const offsets = figureOffsets(parties)
    for (const party of parties) {
      let token = this.figures.get(party.id)
      if (!token) {
        const figure = new UnitFigure(this, PARTY_SPRITE, PARTY_SCALE).play('idle')
        const banner = BANNER_SPRITES[bannerOf(party.id)]
        const flag = this.add
          .sprite(BANNER_X, BANNER_Y, SPRITE_ATLAS, spriteFrame(banner, 'base'))
          .setScale(BANNER_SCALE)
          .play(spriteAnim(banner, 'idle'))
        // The banner behind the figure, so it never hides the hero's face.
        const body = this.add.container(0, 0, [flag, figure])
        token = { body, figure, flag }
        this.figures.set(party.id, token)
        this.partyLayer.add(body)
      }
      token.figure.setLook(heroLook(party.members[0].equipment))
      if (this.walking) continue
      const offset = offsets.get(party.id) ?? 0
      token.flag.setX(offset < 0 ? -BANNER_X : BANNER_X).setFlipX(offset < 0)
      const { x, y } = boardHexCenter(party.position, WORLD_LAYOUT)
      token.body.setPosition(x + offset, y + PARTY_FEET_Y)
    }
    const selected = this.selectedToken()
    this.selectedMark.clear()
    if (!selected) return
    this.partyLayer.bringToTop(selected.body)
    if (!this.walking) {
      const { x, y } = selected.body
      this.selectedMark.lineStyle(3, SELECTED_RING, 1).strokeEllipse(x, y - 1, SELECTED_RING_W, SELECTED_RING_H)
      // And a gold pointer over its head, which a location's name under its feet cannot hide.
      const top = y - selected.figure.standingHeight - 4
      this.selectedMark
        .fillStyle(0x000000, 1)
        .fillTriangle(x - 7, top - 9, x + 7, top - 9, x, top + 1)
        .fillStyle(SELECTED_RING, 1)
        .fillTriangle(x - 5, top - 8, x + 5, top - 8, x, top - 1)
    }
  }

  /** The selected party's figure, if it has one. */
  private selectedToken(): PartyToken | undefined {
    return this.figures.get(this.selectedParty)
  }

  /** A footer button's width: its label's, and no narrower than the least. */
  private static footerWidth(label: string): number {
    return Math.max(MIN_FOOTER_BUTTON_W, label.length * LABEL_CHAR_W + LABEL_PAD)
  }

  private createButton(label: string, onClick: () => void, width = WorldScene.footerWidth(label)): Phaser.GameObjects.Container {
    const bg = this.add
      .rectangle(0, 0, width, BUTTON_H, 0x2b6cb0)
      .setStrokeStyle(2, 0x90cdf4)
      .setInteractive({ useHandCursor: true })
    const text = this.add
      .text(0, 0, label, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5)
    bg.on('pointerover', () => bg.setFillStyle(0x3182ce))
    bg.on('pointerout', () => bg.setFillStyle(0x2b6cb0))
    bg.on('pointerdown', () => {
      playCue(this, buttonCue(label))
      onClick()
    })
    return this.add.container(0, 0, [bg, text]).setSize(width, BUTTON_H).setData('bg', bg).setData('text', text)
  }

  // ---- layout ---------------------------------------------------------------

  /**
   * Header bar at the top, the party's column down the left, the party list
   * down the right, message and buttons in a bar at the bottom, and the map
   * filling the window behind them.
   */
  private layout(): void {
    const { width, height } = this.scale
    const centreX = PARTY_PANEL_W + (width - PARTY_PANEL_W) / 2
    const buttonY = height - 50
    this.setImproveLabel()
    // Only the buttons shown take room: the camp row has one of the tower's, the improvement's and the encampment's at most.
    const timeY = buttonY - ROW_PITCH
    const rows: [Phaser.GameObjects.Container[], number][] = [
      [[...this.timeButtons, this.homeButton, this.garrisonButton, this.exchangeButton], timeY],
      [this.buttons, buttonY],
      [[...this.campButtons, this.towerButton, this.improveButton, this.encampmentButton], buttonY],
    ]
    for (const [all, y] of rows) {
      const row = all.filter((button) => button.visible)
      // A row centred under the map, its buttons FOOTER_GAP apart.
      let x = centreX - (row.reduce((sum, button) => sum + button.width, 0) + (row.length - 1) * FOOTER_GAP) / 2
      for (const button of row) {
        button.setPosition(x + button.width / 2, y)
        x += button.width + FOOTER_GAP
      }
    }
    const messageY = timeY - BUTTON_H / 2 - 26
    this.messageText.setPosition(centreX, messageY)
    this.fitStatus()
    this.layoutForecastTip()
    this.infoBox.setPosition(width - PARTY_LIST_W - INFO_MARGIN - INFO_W, HEADER_BOTTOM + INFO_MARGIN)
    this.infoText.setPosition(this.infoBox.x + INFO_PAD, this.infoBox.y + INFO_PAD)
    this.outcomeShade.setSize(width, height)
    const middleY = height / 2
    this.outcomeText.setPosition(centreX, middleY - 40)
    this.endButton.setPosition(centreX - (BUTTON_W + BUTTON_GAP) / 2, middleY + 50)
    this.endlessButton.setPosition(centreX + (BUTTON_W + BUTTON_GAP) / 2, middleY + 50)
    this.menuButton.setPosition(centreX, middleY + 50)

    const footerTop = messageY - 20
    this.headerBar.setSize(width, HEADER_BOTTOM)
    this.footerBar.setPosition(PARTY_PANEL_W, footerTop).setSize(width - PARTY_PANEL_W, height - footerTop)
    this.column.layout(height)
    this.partyList.layout(width, HEADER_BOTTOM, footerTop)
    this.view = {
      x: PARTY_PANEL_W,
      y: HEADER_BOTTOM,
      width: Math.max(0, width - PARTY_PANEL_W - PARTY_LIST_W),
      height: Math.max(0, footerTop - HEADER_BOTTOM),
    }
    // A resize keeps a pan, pulled back within the map's edges.
    this.applyOrigin()
  }

  /**
   * Scrolls the map to keep the party mid-view, as far as the map's edges
   * allow, or to where a drag panned it. The edges stop at the view's, not the
   * window's, so the party is never left standing under a bar.
   */
  private applyOrigin(): void {
    const map = boardPixelSize(this.world.board, WORLD_LAYOUT)
    if (this.panOrigin) this.panOrigin = clampOrigin(this.panOrigin, map, this.view)
    // The selected party's figure, which a walk moves; its hex, for a party with no one to draw.
    const token = this.selectedToken()?.body
    const followed = token ? { x: token.x, y: token.y - PARTY_FEET_Y } : boardHexCenter(this.expedition().position, WORLD_LAYOUT)
    const { x, y } = this.panOrigin ?? mapOrigin(followed, map, this.view)
    this.mapLayer.setPosition(x, y)
  }

  /** The pointer moved with the button down on the map: pans once the press is a drag. True while it pans. */
  private onDrag(pointer: Phaser.Input.Pointer): boolean {
    const press = this.press!
    if (!press.panning) {
      if (!pressMoved(press, pointer)) return false
      press.panning = true
      // A drag walks nowhere: no route, nothing told of a hex.
      this.setHovered(null)
      this.input.setDefaultCursor('grabbing')
    }
    const map = boardPixelSize(this.world.board, WORLD_LAYOUT)
    this.panOrigin = pannedOrigin(press.originAtPress, press, pointer, map, this.view)
    this.applyOrigin()
    return true
  }

  /** Ends a press, handing it back; a pan's grabbing cursor goes, to be set again by the next hover. */
  private endPress(): WorldScene['press'] {
    const press = this.press
    this.press = null
    if (press?.panning) this.refreshHover()
    return press
  }

  /** A click on a party's entry: selects it and centres the view on it, but not while walking or under the outcome screen. */
  private onPartyEntry(id: string): void {
    if (this.walking || this.outcomeShade.visible) return
    this.selectParty(id)
  }

  /**
   * Makes `id` the selected party, whose members the column shows, and
   * centres the view on it, even when it was selected already. With one party
   * the column is never rebuilt, but a change of party rebuilds it.
   */
  selectParty(id: string): void {
    if (id !== this.selectedParty) {
      const entry = this.listedParties().find((party) => party.id === id)
      if (!entry) return
      this.selectedParty = id
      this.rebuildColumn()
      this.refresh()
    }
    this.centreOnSelected()
  }

  /** Builds the column again for the selected party's members, with the first able to advance active. */
  private rebuildColumn(): void {
    const members = this.selectedMembers()
    this.column.destroy()
    this.column = new PartyColumn(this, members, (index) => this.onPortrait(index))
    this.active = Math.max(0, members.findIndex(canAdvance))
    this.column.layout(this.scale.height)
    // The new column's objects are the newest; the outcome screen stays over them.
    for (const cover of [this.outcomeShade, this.outcomeText, this.endButton, this.endlessButton, this.menuButton]) {
      this.children.bringToTop(cover)
    }
  }

  /**
   * Home, and a click on the selected party's entry: back to following the
   * selected party, clearing any pan (not while the button is still down on
   * one). Moves no one and passes no time; an unpanned view does not move.
   */
  centreOnSelected(): void {
    if (this.walking || this.outcomeShade.visible || this.press) return
    this.panOrigin = null
    this.applyOrigin()
    // The map has scrolled under the pointer, which is over another hex now.
    const pointer = this.input.activePointer
    this.setHovered(this.hexAt(pointer.x, pointer.y))
  }

  /** The map hex under a screen position, or null when off the map or under a bar. */
  private hexAt(screenX: number, screenY: number): Hex | null {
    const screen = { x: screenX, y: screenY }
    if (!rectContains(this.view, screen)) return null
    const h = boardHexAt(screen, { x: this.mapLayer.x, y: this.mapLayer.y }, 1, WORLD_LAYOUT)
    return this.board.contains(h) ? h : null
  }

  // ---- display ---------------------------------------------------------------

  /** The company's parties as the world's rules see them. */
  private presences(): PartyPresence[] {
    return presences(this.gameState.parties)
  }

  /** The company's parties as the list shows them, a walking party by the order it walks by. */
  private listedParties(): PartyListEntry[] {
    return deployedParties(this.gameState, this.walkingOrder)
  }

  /** The party the map acts for: the selected one. */
  private expedition(): Expedition {
    return selectedParty(this.gameState, this.selectedParty)
  }

  /** Redraws everything that follows the world's state: the party, the header and which buttons show. */
  private refresh(): void {
    const world = this.world
    const expedition = this.expedition()
    const here = monstersHere(world, expedition)
    this.syncFigures()
    this.partyMark.clear().lineStyle(3, PARTY_OUTLINE, 1).strokePoints(this.hexPolygon(expedition.position), true)
    this.visible = visibleHexes(world, this.presences())
    // Blighted land the party stands on is neutral while it stays.
    if (blightAt(world, expedition.position) > 0) {
      const c = boardHexCenter(expedition.position, WORLD_LAYOUT)
      this.partyMark.lineStyle(2, NEUTRAL_RING, 0.9).strokeCircle(c.x, c.y, WORLD_LAYOUT.hexSize * 0.6)
    }
    this.refreshBlight()
    this.refreshRoads()
    this.refreshLocations()
    this.refreshLabels()

    this.turnText.setText(`Turn ${world.turn}`)
    const growth = Math.round((blightGrowth(world.turn) - 1) * 100)
    const stock = Object.entries(world.stock)
      .map(([material, amount]) => `${material} ${amount}`)
      .join(', ')
    this.statusText.setText(
      [
        `Blighted ${Math.round(knownBlightedShare(world) * 100)}% of the land known${growth > 0 ? `, blight +${growth}%` : ''}${world.status === 'endless' ? ' (endless)' : ''}`,
        `Stock: ${stock || 'nothing yet'}`,
        ...(this.lastYield ? [this.lastYield] : []),
      ].join('\n'),
    )
    this.fitStatus()
    this.column.refresh(this.active)
    this.partyList.refresh(this.listedParties(), this.selectedParty)
    for (const button of this.buttons) button.setVisible(here !== null && !this.walking && world.status !== 'lost')
    // Among monsters, confronting them or not, the footer offers only Scout, Wait, Attack and Auto-resolve.
    const ordering = worldActive(world) && here === null && !this.walking
    for (const button of this.timeButtons) button.setVisible(ordering)
    this.homeButton.setVisible(ordering && !hexEquals(expedition.position, encampment(world).position))
    this.garrisonButton.setVisible(ordering && improvementSite(world, expedition) !== null && expedition.order.kind !== 'garrison')
    this.exchangeButton.setVisible(ordering && exchangePartners(this.gameState, expedition).length > 0)
    const campable = canCamp(world, expedition)
    for (const button of this.campButtons) button.setVisible(campable && !this.walking)
    this.towerButton.setVisible(campable && !this.walking && towerSiteRefusal(world, expedition) === null)
    const improving = improveLabel(world, expedition)
    this.improveButton.setVisible(campable && !this.walking && improving !== null)
    this.encampmentButton.setVisible(atEncampment(world, expedition) && !this.walking)
    this.layout()
    this.refreshForecast()
    const over = world.status === 'won' || world.status === 'lost'
    this.outcomeShade.setVisible(over)
    this.outcomeText.setVisible(over).setText(
      world.status === 'won'
        ? 'VICTORY!\n\nThe Source is destroyed, and the blight has lost its heart.\nEnd the game here, or go on against what is left of it.'
        : `DEFEAT\n\nThe blight has taken ${encampmentName(world)}. The journey ends here.`,
    )
    this.endButton.setVisible(world.status === 'won')
    this.endlessButton.setVisible(world.status === 'won')
    this.menuButton.setVisible(world.status === 'lost')
    this.refreshHover()
  }

  private setHovered(at: Hex | null): void {
    const same = at === null || this.hovered === null ? at === this.hovered : hexEquals(at, this.hovered)
    this.hovered = at
    if (!same) this.refreshHover()
  }

  /**
   * Draws the route a click on the hovered hex would walk, red-ringed where it
   * ends among monsters, and tells of the hex; with no hover route, draws the
   * standing route instead, what is left of the selected party's travel order
   * (none while a walk plays).
   */
  private refreshHover(): void {
    this.refreshInfo()
    this.refreshHint()
    this.hoverMarks.clear()
    this.drawnStandingRoute = []
    const route = this.hovered && !this.walking ? routeTo(this.world, this.expedition(), this.hovered) : null
    if (!route) {
      this.input.setDefaultCursor(CURSORS.move)
      const standing = this.walking ? [] : standingRoute(this.expedition())
      if (standing.length > 0) {
        this.drawRoute(standing, ORDER_ROUTE_COLOR)
        this.drawnStandingRoute = standing
      }
      return
    }
    const toMonsters = this.drawRoute(route, ROUTE_COLOR)
    this.input.setDefaultCursor(toMonsters ? CURSORS.attack : CURSORS.select)
  }

  private rectOf(box: Phaser.GameObjects.Rectangle): { x: number; y: number; width: number; height: number } {
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  }

  /** The estimate's tooltip: just above the Auto-resolve button while it is hovered, flush right of the window when it would overflow. */
  private layoutForecastTip(): void {
    const shown = this.autoHovered && this.buttons[3].visible
    this.forecastTipBox.setVisible(shown)
    this.forecastTipText.setVisible(shown)
    if (!shown) return
    const { width } = this.scale
    const button = this.buttons[3]
    this.forecastTipText.setText(forecastHint(this.forecastResult))
    const height = this.forecastTipText.height + 2 * INFO_PAD
    this.forecastTipBox.setSize(FORECAST_TIP_W, height)
    const x = Math.max(PARTY_PANEL_W + 8, Math.min(button.x - FORECAST_TIP_W / 2, width - 20 - FORECAST_TIP_W))
    const y = button.y - BUTTON_H / 2 - 8 - height
    this.forecastTipBox.setPosition(x, y)
    this.forecastTipText.setPosition(x + INFO_PAD, y + INFO_PAD)
  }

  /**
   * Places the stock panel at the header's right. Three lines (with the last yield) start higher, to clear the hint under the
   * turn's number, and are set smaller when they would still reach it (a narrow window, a long hint).
   */
  private fitStatus(): void {
    this.statusText.setFontSize(STATUS_FONT).setLineSpacing(0).setPosition(this.scale.width - 20, this.lastYield ? 3 : 16)
    if (!this.lastYield) return
    const [a, b] = [this.statusText.getBounds(), this.hintText.getBounds()]
    // Set small and close, from the header's top edge, the three lines end above the hint's row.
    if (a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom) this.statusText.setFontSize(STATUS_FONT_SMALL).setLineSpacing(-2).setY(1)
  }

  /** The header's hint: what the selected party may do where it stands, or whom a click on the hovered hex sends it to meet. */
  private refreshHint(): void {
    this.layoutForecastTip()
    const expedition = this.expedition()
    const meeting = this.hovered && !this.walking ? meetTarget(this.gameState, expedition, this.hovered) : null
    this.hintText.setText(
      meeting && expedition.confronting === null
        ? `Meet ${meeting.name}: click to send the party to it.`
        : expedition.confronting !== null
          ? 'Monsters! Scout them, wait, attack or auto-resolve.'
          : monstersHere(this.world, expedition)
            ? 'Scout, wait, attack or auto-resolve, or click a hex to move away.'
            : 'Click a hex to travel there, or camp or pass days below. Each day takes a turn.',
    )
    this.fitStatus()
  }

  /** Draws `route` from the selected party's hex in `color`, its end ringed, red where it ends among sighted monsters; returns whether it does. */
  private drawRoute(route: readonly Hex[], color: number): boolean {
    const g = this.hoverMarks
    const to = route[route.length - 1]
    const there = locationAt(this.world, to)
    const toMonsters = there?.kind === 'monsters' && this.world.sighted.includes(there.id)
    const points = [this.expedition().position, ...route].map((h) => {
      const c = boardHexCenter(h, WORLD_LAYOUT)
      return new Phaser.Math.Vector2(c.x, c.y)
    })
    // A dark edge under the line keeps it visible over every shade of grass.
    g.lineStyle(7, ROUTE_EDGE, 0.5).strokePoints(points, false)
    g.lineStyle(3, color, 1).strokePoints(points, false)
    g.lineStyle(3, toMonsters ? MONSTERS_OUTLINE : color, 1).strokePoints(this.hexPolygon(to), true)
    return toMonsters
  }

  /** The members of the selected party, whom the column shows. */
  private selectedMembers(): readonly Character[] {
    return this.expedition().members
  }

  /** The pointer is gone (off the game, or the map paused under an overlay): no entry is hovered, and the panel forgets it. */
  private clearPartyHover(): void {
    this.partyList.clearHover()
    this.hoveredParty = null
    this.refreshInfo()
  }

  /** The pointer came onto a party's entry (`id`) or left it (null): the info panel tells of the party. */
  private onPartyHover(id: string | null): void {
    this.hoveredParty = id
    this.refreshInfo()
  }

  /** The info panel: the hovered party's summary, else what the player knows of the hovered hex. */
  private refreshInfo(): void {
    const entry =
      this.hoveredParty === null ? undefined : this.listedParties().find((party) => party.id === this.hoveredParty)
    const shown = (entry !== undefined || this.hovered !== null) && !this.outcomeShade.visible
    this.infoBox.setVisible(shown)
    this.infoText.setVisible(shown)
    if (!shown) return
    const { title, lines } = entry
      ? partyListInfo(entry)
      : hexInfo(this.gameState, this.expedition(), this.visible, this.hovered!)
    this.infoText.setText([title, '', ...lines].join('\n'))
    this.infoBox.setSize(INFO_W, this.infoText.height + 2 * INFO_PAD)
  }

  // ---- actions ---------------------------------------------------------------

  /**
   * A press let go where it was made: on a hex where another party stands,
   * the selected party goes to meet it (the first there in list order); on
   * any other, it travels there. While any party faces monsters it has not
   * answered, no order is given: the refusal is Next day's (`refused`).
   */
  private onMapClick(at: Point): void {
    if (this.walking || this.outcomeShade.visible) return
    const clicked = this.hexAt(at.x, at.y)
    if (!clicked) return
    // No day can pass while a party faces monsters: no order is given, and that party is selected, as Next day does.
    if (this.refused()) return
    const expedition = this.expedition()
    const other = meetTarget(this.gameState, expedition, clicked)
    if (other) {
      this.follow(followOrder(this.gameState, expedition, { kind: 'meet', party: other.id }, UNTIL_LIMIT), `Meeting ${other.name}`)
      return
    }
    const order = travelLabel(this.world, clicked)
    const walk = walkTo(this.gameState, expedition, clicked)
    // Refused, nothing changed; blocked at its first hex, the party now stands before what is there.
    if (walk.reports.length === 0 && expedition.confronting === null) {
      playCue(this, 'ui.error')
      return
    }
    this.follow(walk, order)
  }

  /** Home: the selected party walks back to the encampment, as a click there would send it but by its own order. */
  private onHome(): void {
    if (this.scene.isPaused() || this.walking || this.outcomeShade.visible) return
    if (this.refused()) return
    this.follow(followOrder(this.gameState, this.expedition(), { kind: 'home' }), 'Returning home')
  }

  /** Garrison: the selected party holds the resource it stands on until given another order; no day passes. */
  private onGarrison(): void {
    if (this.scene.isPaused() || this.walking || this.outcomeShade.visible) return
    const expedition = this.expedition()
    const refusal = setOrder(this.gameState, expedition.id, { kind: 'garrison' })
    const site = locationAt(this.world, expedition.position)
    this.messageText.setText(
      refusal ?? `${partyNoun(this.gameState, expedition)} garrisons ${midSentence(site?.name ?? 'the site')} until given another order.`,
    )
    if (refusal !== null) {
      playCue(this, 'ui.error')
      return
    }
    this.refresh()
    this.save()
  }

  /** A walking order's outcome: its refusal in the message, or its walk, saved and then played. */
  private follow(walk: string | Walked, order: string): void {
    if (typeof walk === 'string') {
      playCue(this, 'ui.error')
      this.messageText.setText(walk)
      return
    }
    // The journey is made as far as the world goes; the walk only shows it.
    this.save()
    if (walk.journey.walked.length === 0) {
      this.walked(walk)
      return
    }
    this.playWalk(walk.journey.walked, order, () => {
      this.endWalk()
      this.walked(walk)
    })
  }

  /** The walk has been shown (or there was none): tells how it went and focuses the party an interrupt concerns. */
  private walked({ journey, reports }: Walked): void {
    const told = describeWalk(this.gameState, this.expedition(), reports)
    // A walk blocked at its first hex has no day to report, but the party now stands before what blocked it.
    const events = reportEvents(reports)
    this.noteYield(reports.flatMap((report) => report.events))
    const here = monstersHere(this.world, this.expedition())
    if (here && !events.some((event) => event.type === 'confronting')) events.push({ type: 'confronting', party: this.selectedParty, location: here.id })
    playCues(this, worldSounds(events))
    this.focusInterrupt(reports)
    this.messageText.setText(told)
    this.refresh()
    this.checkOutcome()
    this.tell({ kind: 'world_turn', events: journey.events })
  }

  /** Selects and centres the party the days' interrupt concerns, if it concerns one. */
  private focusInterrupt(reports: readonly DayReport[]): void {
    const party = reports.at(-1)?.interrupt?.party ?? null
    if (party !== null) this.selectParty(party)
  }

  /**
   * Shows the selected party walking `route` (already made in the game, and
   * saved), its order line saying `order` until the walk ends, then calls `done`.
   */
  private playWalk(route: Hex[], order: string, done: () => void): void {
    this.walking = true
    this.walkingOrder = { party: this.selectedParty, order }
    // A journey brings the view back to the party.
    this.panOrigin = null
    this.messageText.setText('')
    this.refreshWalking()
    const token = this.selectedToken()
    if (!token) {
      done()
      return
    }
    token.figure.play('walk')
    this.tweens.chain({
      targets: token.body,
      tweens: route.map((h) => {
        const { x, y } = boardHexCenter(h, WORLD_LAYOUT)
        // The party sprite is drawn facing right.
        return { x, y: y + PARTY_FEET_Y, duration: WALK_STEP_MS, onStart: () => token.figure.faceLeft(x < token.body.x) }
      }),
      onComplete: () => {
        token.figure.play('idle')
        done()
      },
    })
  }

  /** While the party walks, nothing else can be done and its hex is not yet where it stands. */
  private refreshWalking(): void {
    this.partyMark.clear()
    this.selectedMark.clear()
    for (const button of [...this.buttons, ...this.timeButtons, this.homeButton, this.garrisonButton, this.exchangeButton, ...this.campButtons, this.towerButton, this.improveButton, this.encampmentButton]) button.setVisible(false)
    this.partyList.refresh(this.listedParties(), this.selectedParty)
    this.refreshHover()
  }

  /** The walk has been shown: the party stands where the game has it. */
  private endWalk(): void {
    this.walking = false
    this.walkingOrder = null
    this.panOrigin = null
    this.applyOrigin()
    // The map has scrolled under the pointer, which is over another hex now.
    const pointer = this.input.activePointer
    this.hovered = this.hexAt(pointer.x, pointer.y)
  }

  /** One day passes, every party carrying on its order. */
  private onNextDay(): void {
    if (this.scene.isPaused() || this.walking || this.outcomeShade.visible) return
    if (this.refused()) return
    const order = orderLabel(this.world, this.expedition(), this.gameState.parties)
    this.daysPassed([passDay(this.gameState)!], 1, order)
  }

  /** Days pass until something happens, or until `UNTIL_LIMIT` of them have passed quietly. */
  private onUntilSomething(): void {
    if (this.scene.isPaused() || this.walking || this.outcomeShade.visible) return
    if (this.refused()) return
    const order = orderLabel(this.world, this.expedition(), this.gameState.parties)
    this.daysPassed(advance(this.gameState), UNTIL_LIMIT, order)
  }

  /**
   * Whether no day can pass now (`advanceRefusal`): if so, the message says
   * why, and the party whose monsters block the days is selected and centred,
   * its footer offering Scout, Wait, Attack and Auto-resolve.
   */
  private refused(refusal = advanceRefusal(this.gameState), blocking = blockingParty(this.gameState)): boolean {
    if (refusal === null) return false
    playCue(this, 'ui.error')
    if (blocking) this.selectParty(blocking.id)
    this.messageText.setText(refusal)
    return true
  }

  /**
   * After the days in `reports` have passed in the game: saves them, as a
   * journey is saved as it begins, shows the selected party's steps, its line
   * saying `order` (its order before the days) while they play, then tells
   * what happened and selects and centres the party an interrupt concerns.
   */
  private daysPassed(reports: DayReport[], limit: number, order: string): void {
    this.save()
    const steps = reports.flatMap((report) => report.parties.flatMap((day) => (day.party === this.selectedParty && day.walked ? [day.walked] : [])))
    const events = reports.flatMap((report) => report.events)
    const told = describeDays(reports, this.gameState, limit)
    const finish = () => {
      this.noteYield(events)
      playCues(this, worldSounds(reportEvents(reports)))
      this.focusInterrupt(reports)
      this.messageText.setText(told)
      this.refresh()
      this.checkOutcome()
      this.tell({ kind: 'world_turn', events })
    }
    if (steps.length === 0) {
      finish()
      return
    }
    this.playWalk(steps, order, () => {
      this.endWalk()
      finish()
    })
  }

  /**
   * The selected party's one-day action, run at once (`act`), or null when it
   * is refused: if another party's monsters stop the day, the message says so
   * and that party is selected and centred, as Next day does; else the
   * message gives the action's own refusal.
   */
  private actDay(action: DayAction): DayReport | null {
    const expedition = this.expedition()
    const blocked = actionBlocked(this.gameState, expedition.id, action)
    if (blocked) {
      this.refused(blocked.refusal, blocked.party)
      return null
    }
    const report = act(this.gameState, expedition.id, action)
    if (typeof report !== 'string') return report
    playCue(this, 'ui.error')
    this.messageText.setText(report)
    return null
  }

  /**
   * After the selected party's own days (a one-day action, or camping until
   * healed): the message gives `own`, then what else the days brought, the
   * other parties' events included (`describeOthers`), and the party that
   * concerns, if any, is selected and centred as for an interrupt; then saves.
   */
  private ownDays(own: string, reports: readonly DayReport[], others = describeOthers(this.gameState, this.expedition(), reports)): void {
    this.noteYield(reports.flatMap((report) => report.events))
    playCues(this, worldSounds(reportEvents(reports, this.selectedParty)))
    if (others.party !== null) this.selectParty(others.party)
    this.messageText.setText(others.text ? `${own} ${others.text}` : own)
    this.refresh()
    this.save()
    this.checkOutcome()
    this.tell({ kind: 'world_turn', events: reports.flatMap((report) => report.events) })
  }

  /** Scouting and waiting each pass a turn among the monsters; nothing comes of either yet. */
  private onLinger(how: Lingering): void {
    if (this.scene.isPaused() || this.walking || this.outcomeShade.visible) return
    const here = monstersHere(this.world, this.expedition())
    if (!here) return
    const report = this.actDay({ kind: how })
    if (!report) return
    this.ownDays(
      how === 'scout' ? `You scout ${theName(here.name)}, but learn nothing new.` : `You wait a turn. ${theNameCapital(here.name)} do not stir.`,
      [report],
    )
  }

  /** A day's rest where the party stands: a hit point each, and every caster's mana back. */
  private onCamp(): void {
    if (this.scene.isPaused() || this.walking || this.outcomeShade.visible) return
    const expedition = this.expedition()
    const report = this.actDay({ kind: 'camp' })
    if (!report) return
    const healed = report.parties.find((day) => day.party === expedition.id)?.rested ?? 0
    this.ownDays(`You camp a day. Mana is restored${healed > 0 ? ` and rest heals ${healed} hp` : ''}.`, [report])
  }

  /** Days of rest, with the casters healing what they can each day, until no one is wounded. */
  private onCampUntilHealed(): void {
    if (this.scene.isPaused() || this.walking || this.outcomeShade.visible) return
    // The camp order is no day action, but no day passes for it while another party faces monsters either.
    if (this.refused()) return
    const expedition = this.expedition()
    const result = campUntilHealed(this.gameState, expedition)
    if (result === null) return
    const others = describeOthers(this.gameState, expedition, result.reports)
    const days = `${result.days} ${result.days === 1 ? 'day' : 'days'}`
    // Cut short by a notable event or another party's: the camp order stands.
    const broken = result.interruptedBy !== null || others.party !== null
    this.ownDays(broken ? `Camp is broken after ${days}.` : describeCamp(result), result.reports, others)
  }

  /** Builds a watchtower where the party stands, a day's work, or says why it cannot (the stock, most often). */
  private onBuildTower(): void {
    this.built({ kind: 'tower' })
  }

  /** Builds the next improvement at the held site the party stands on, a day's work, or says why it cannot (the Lodge, the stock). */
  private onImprove(): void {
    this.built({ kind: 'improve' })
  }

  /** A building's day: what it built and what else the day brought, or why it was refused. */
  private built(action: DayAction): void {
    if (this.scene.isPaused() || this.walking || this.outcomeShade.visible) return
    const report = this.actDay(action)
    if (!report) return
    // The first event is the building's own; the rest are the day's.
    const [built, ...day] = report.events
    this.ownDays(describeWorldEvent(built), [report], describeOthers(this.gameState, this.expedition(), [{ ...report, events: day }]))
  }

  /**
   * Tells the story of a moment on the map (StoryScene), which pauses the map
   * while it is told; the map saves what was shown as it resumes.
   */
  private tell(moment: StoryMoment): void {
    tellStory(this, this.gameState, moment, this.anchors(), this.selectedParty)
  }

  /** Where the controls a tutorial tip may point at are on screen, those that show. */
  private anchors(): StoryAnchors {
    const centre = (button: Phaser.GameObjects.Container) => (button.visible ? { x: button.x, y: button.y } : undefined)
    const portrait = portraitRect(0)
    return {
      'world.party': { x: portrait.x + portrait.width / 2, y: portrait.y + portrait.height / 2 },
      'world.camp': centre(this.campButtons[0]),
      'world.attack': centre(this.buttons[2]),
      'world.enterEncampment': centre(this.encampmentButton),
    }
  }

  /**
   * After anything that passes time: a lost encampment ends the playthrough,
   * as a party's fall in battle does (permadeath), and frees its slot. The
   * screen over the map says so (`refresh`), as it asks what next after a victory.
   */
  private checkOutcome(): void {
    if (this.world.status !== 'lost' || this.gameState.slot === null) return
    deleteSlot(this.gameState.slot)
    this.gameState.slot = null
  }

  /** The game is won and the player stops here: the save is kept, a finished game, and the menu shown. */
  private onEnd(): void {
    this.save()
    this.scene.start('Menu')
  }

  /** The game is won and the player goes on: the nests left keep pushing and spawning. */
  private onEndless(): void {
    this.world.status = 'endless'
    this.messageText.setText('The Source is gone, but the blight lingers. The hunt goes on.')
    this.refresh()
    this.save()
  }

  /**
   * Writes the game to its slot, as the map does after everything that changes
   * it. If the browser refuses, play goes on and the message line says so, once.
   */
  private save(): void {
    if (saveGame(this.gameState) || this.registry.get(SAVE_WARNED_KEY)) return
    this.registry.set(SAVE_WARNED_KEY, true)
    this.messageText.setText(SAVE_FAILED_MESSAGE)
  }

  private onAttack(): void {
    const here = monstersHere(this.world, this.expedition())
    if (!here) return
    this.dropForecast()
    this.scene.start('Battle', { game: this.gameState, location: here.id, party: this.selectedParty })
  }

  /** Fights the battle at once: the battle scene plays it out and opens on its result. */
  private onAutoResolve(): void {
    const here = monstersHere(this.world, this.expedition())
    if (!here) return
    this.dropForecast()
    this.scene.start('Battle', { game: this.gameState, location: here.id, party: this.selectedParty, auto: true })
  }

  /** A click on a portrait marks that member, and a click on the one marked opens its panel. */
  private onPortrait(index: number): void {
    if (portraitClick(index, this.active) === 'open') {
      this.openPanel(index)
      return
    }
    this.active = index
    this.refresh()
  }

  /**
   * Brings the prompt to spend points up to date as an overlay closes (the
   * character panel, the debug console), while the message line shows that
   * prompt or nothing, never over another message.
   */
  private promptAdvance(): void {
    const shown = this.messageText.text
    if (shown !== '' && shown !== this.advancePrompt) return
    this.advancePrompt = this.world.status === 'won' ? '' : advanceMessage(this.expedition().members)
    this.messageText.setText(this.advancePrompt)
  }

  /**
   * Opens a party member's panel over the map, where its skill points and
   * perks are spent, on the skills if it has any to spend. Not while the
   * party walks.
   */
  private openPanel(index: number): void {
    if (this.scene.isPaused() || this.walking) return
    const expedition = this.expedition()
    const party = expedition.members
    const character = party[index]
    if (!character) return
    const tab = canAdvance(character) ? 'skills' : 'character'
    // Gear is changed freely here, and the ground is the party's baggage, through which items
    // pass between members. The panel edits the characters and the baggage in place.
    const members = party.map((member) => ({ character: member, gearApCost: 0, ground: expedition.baggage }))
    const exchange = exchangePartners(this.gameState, expedition).length > 0 ? { game: this.gameState, party: expedition.id } : undefined
    this.scene.launch('Inventory', { members, index, tab, canAdvance: true, resume: 'World', groundTitle: 'Baggage', exchange })
    this.scene.bringToTop('Inventory')
    this.scene.pause()
  }

  /** The Exchange overlay over the map, while another party stands on the selected party's hex; it resumes the map when it closes. */
  private openExchange(): void {
    const expedition = this.expedition()
    if (this.scene.isPaused() || this.walking || exchangePartners(this.gameState, expedition).length === 0) return
    this.scene.launch('Exchange', { game: this.gameState, party: expedition.id })
    this.scene.bringToTop('Exchange')
    this.scene.pause()
  }

  /** Field crafting over the map (CraftingScene), wherever the party may camp; it resumes the map with what it made. */
  private openCrafting(): void {
    if (this.scene.isPaused() || this.walking || !canCamp(this.world, this.expedition())) return
    // Work in the field takes a day, which cannot pass while another party faces monsters.
    if (craftTier(this.world, this.expedition()) === 'field' && this.refused()) return
    this.scene.launch('Crafting', { game: this.gameState, resume: 'World', party: this.selectedParty })
    this.scene.bringToTop('Crafting')
    this.scene.pause()
  }

  /** Tells what a field craft made and what its day brought, as after camping. */
  private crafted({ item, events, kind }: CraftedData['crafted']): void {
    // The craft or the rune set in, then what its day brought.
    playCue(this, kind === 'embed' ? 'world.rune.embed' : 'world.craft')
    playCues(this, worldSounds(events).map((sound) => ({ ...sound, delayMs: sound.delayMs + WORLD_SOUND_GAP_MS })))
    this.noteYield(events)
    const told = describeWorldEvents(events, events.find((event) => isNotable(this.world, event, this.presences())) ?? null)
    this.messageText.setText(`A day's work makes the ${item}.${told ? ` ${told}` : ''}`)
    this.checkOutcome()
    // After the redraw and save the resume does.
    this.time.delayedCall(0, () => this.tell({ kind: 'world_turn', events }))
  }

  /** The encampment over the map, while the party stands there; it starts the map again when it closes. */
  private openEncampment(): void {
    if (this.scene.isPaused() || this.walking || !atEncampment(this.world, this.expedition())) return
    this.scene.launch('Encampment', { game: this.gameState, party: this.selectedParty })
    this.scene.bringToTop('Encampment')
    this.scene.pause()
  }

  private openMenu(): void {
    if (this.scene.isPaused()) return
    pauseMusic()
    this.scene.launch('Menu', { resume: 'World', game: this.gameState })
    this.scene.bringToTop('Menu')
    this.scene.pause()
  }
}

/** A location's name colour: monsters reddish, the Source violet, held sites green, threatened ones orange. */
function labelColor(location: WorldLocation, held: boolean, threatened: boolean, silent = false): string {
  if (location.kind === 'monsters') return location.source ? '#ce93d8' : '#ffab91'
  // A trade partner is never held or threatened: trade gold, grey while silent.
  if (location.kind === 'partner') return silent ? SILENT_LABEL : PARTNER_LABEL
  if (threatened) return '#ffb74d'
  return held ? '#a5d6a7' : '#ffffff'
}
