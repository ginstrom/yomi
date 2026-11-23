import Phaser from 'phaser'
import { deriveCombatStats } from '../character/character.ts'
import type { Expedition } from '../game/expedition.ts'
import { selectedParty, type GameState } from '../game/gameState.ts'
import { homeParty } from '../game/guildHall.ts'
import { actingFor } from './encampmentView.ts'
import { placeKey, type ItemPlace } from '../game/itemPlace.ts'
import { materialName, type Material } from '../game/territory.ts'
import {
  GOODS_LEVEL,
  GOOD_PRICE,
  MATERIALS_PER_GOLD,
  RUNE_RANK_LEVELS,
  buy,
  buyGood,
  buyGoodRefusal,
  buyPrice,
  buyRefusal,
  buyRune,
  buyRuneRefusal,
  runePrice,
  runeSalePrice,
  runeWares,
  sell,
  sellMaterial,
  sellRune,
  sellables,
  tradingPostName,
  wares,
} from '../game/tradingPost.ts'
import { FAMILIES, type FamilyId } from '../inventory/catalog.ts'
import type { EquipmentSlot, Item } from '../inventory/inventory.ts'
import { parseRuneKey, pouchCount, pouchKeys, runeName, type RuneKey } from '../inventory/runes.ts'
import type { ButtonProbe, TradingPostProbe } from '../testHook.ts'
import { playCue } from './soundPlayer.ts'
import { buttonCue, refusalCue, type CueId } from './sounds.ts'
import type { Point } from './boardGeometry.ts'
import { TYPICAL_AP, statLines, statSummary } from './gearCompare.ts'
import { ITEM_ICON_KEYS, RUNE_ICON_KEYS, SOCKET_PIP_KEYS, iconTint } from './itemIcons.ts'
import type { Rect } from './mapScroll.ts'
import { addPanelButton, fitText } from './panelButton.ts'
import { runeEffectLines, runeSocketLine } from './runecraftView.ts'
import { GOOD_AMOUNTS, NO_GOODS, buyLabel, goodRows } from './goodsView.ts'
import { createPips } from './socketPips.ts'
import { overlayScale } from './overlayScale.ts'
import { ROUTE_ROWS, minimapBoard, minimapPoints, routeNotes, routeOffer, routeRows, routeState, type RouteRow } from './routesTab.ts'
import { describeWorldEvent } from './worldEvents.ts'
import { ROAD_COLORS } from './roadsView.ts'
import { encampment, encampmentName } from '../game/worldMap.ts'
import { openRoute, openRouteRefusal, routeLimit } from '../game/trade.ts'
import { notifyStock } from './stockNotice.ts'

interface TradingPostData {
  game: GameState
  /** The id of the party at the post; the first if left out or unknown. */
  party?: string
}

type Tab = 'buy' | 'sell' | 'routes'

/** The slots the post sells for, with the short word on their buttons. */
const SLOT_BUTTONS: ReadonlyArray<readonly [EquipmentSlot, string]> = [
  ['mainHand', 'Weapons'],
  ['offHand', 'Shields'],
  ['armor', 'Armor'],
  ['head', 'Head'],
  ['gloves', 'Hands'],
  ['boots', 'Feet'],
]

interface Filter {
  /** A slot's gear, 'runes', the runes the post sells, or 'goods', the partners' goods of the Market Hall. */
  slot: EquipmentSlot | 'runes' | 'goods'
  family: FamilyId | null
}
const OPENING_FILTER: Filter = { slot: 'mainHand', family: null }

/** A line of the list: an item or a rune for sale or to sell, or a material to sell. */
interface Row {
  id: string
  kind: 'item' | 'material' | 'rune' | 'good'
  label: string
  /** Under the name: the item's stats, and whose it is when selling. */
  detail: string
  /** What it costs, or fetches; a material's is a pair's. */
  price: number
  item?: Item
  place?: ItemPlace
  material?: Material
  amount?: number
  rune?: RuneKey
  /** The AP of the hero who holds it, which tells its attacks a turn. */
  ap: number
}

/** Drawn in a frame of this size, centred over the map and fitted to the window: scaled down to fit, up in whole steps from 2x (`overlayScale`). */
const FRAME_W = 720
const FRAME_H = 520
const CENTRE_X = FRAME_W / 2
const TITLE_Y = 34
const TAB_Y = 96
const LIST_X = 24
const LIST_W = 420
/** The Sell tab's list starts under the tabs; the Buy tab's under its filter, and so holds fewer lines. */
const SELL_LIST_TOP = 122
const BUY_LIST_TOP = 194
const SELL_ROWS_PER_PAGE = 11
const BUY_ROWS_PER_PAGE = 8
const ROW_H = 24
const DETAILS_X = 466
const DETAILS_W = FRAME_W - DETAILS_X - 24
/** The details' confirming buttons, whatever the tab, and the refusal above them. */
const CONFIRM_Y = 432
const CONFIRM_ALL_Y = CONFIRM_Y - 40
const REFUSAL_Y = 380
/** The Goods filter's two buttons are stacked; its refusal sits above both, its bottom edge here. */
const GOODS_REFUSAL_BOTTOM = CONFIRM_ALL_Y - 20
const MESSAGE_Y = 462
/** The minimap stack's lowest point: above a message line of up to two lines centred on `MESSAGE_Y`. */
const STACK_BOTTOM = MESSAGE_Y - 20
const STACK_GAP = 6
const BUTTON_Y = 495
/** The Buy tab's filter: the slot buttons (and Runes) across the frame, the families of the slot under them, eight to a row. */
const SLOT_Y = 130
const FAMILY_Y = 156
const FAMILY_ROW_H = 22
const FAMILIES_PER_ROW = 8
const FILTER_W = FRAME_W - 2 * LIST_X

const FONT = 'monospace'
const GOLD = '#e8c766'
const DIM = '#8a7a5a'
const TEXT = '#d8c9a3'
const REFUSED = '#ffb74d'
const RAIDED = '#ef5350'

/** The Routes tab: a line to each partner, an Open button at its right, and the selected road on a minimap. */
const ROUTE_TOP = 150
const ROUTE_ROW_H = 72
/** A route row's height once the tab pages, leaving room for the pager under four rows. */
const ROUTE_PAGED_ROW_H = 69
/** Where paged rows start: a few px above `ROUTE_TOP`, under the one-line heading, so a four-line offer fits its row. */
const ROUTE_PAGED_TOP = 142
const ROUTE_TEXT_W = LIST_W - 112
const OPEN_W = 88
const MINIMAP = { x: DETAILS_X, y: ROUTE_TOP, width: DETAILS_W, height: 150 }

/**
 * The trading post, entered from the encampment (EncampmentScene) over the
 * paused world map: Buy lists every plain item at the grades the post's
 * level allows, and under its Runes filter the runes it sells; Sell what the
 * party carries and the baggage holds, the stock's materials and the rune pouch. A click on a line shows the item's stats and price, and
 * a button confirms. Every action calls a function of tradingPost.ts.
 * Closing it goes back to the encampment.
 */
export class TradingPostScene extends Phaser.Scene {
  private gameState!: GameState
  private expedition!: Expedition
  private tab: Tab = 'buy'
  private page = 0
  private filter: Filter = { ...OPENING_FILTER }
  private selected: string | null = null
  private message = ''
  private bg!: Phaser.GameObjects.Rectangle
  private frame!: Phaser.GameObjects.Container
  private controls: Partial<Record<keyof TradingPostProbe['buttons'], { at: Rect; enabled: boolean }>> = {}
  private rowAt = new Map<string, Point>()
  private slotAt = new Map<EquipmentSlot, Point>()
  private runesAt: Point | null = null
  private goodsAt: Point | null = null
  private familyAt = new Map<FamilyId | null, Point>()
  /** The Routes tab's chosen partner; the first row when none is (or it is gone). */
  private routeChosen: string | null = null
  /** The Routes tab's rows, asked once a render. */
  private routeAll: RouteRow[] = []
  private routeLines: Array<{ row: RouteRow; line: string; open: Point | null; openEnabled: boolean; selected: boolean }> = []
  /** The refusal drawn under the minimap, or null. */
  private routeRefusal: string | null = null
  /** The notes drawn under the minimap (`routeNotes`). */
  private routeNotes: string[] = []
  private messageHeight = 0
  /** The inline refusal's top and bottom in the frame, for the probe; null with none drawn. */
  private refusalBox: { top: number; bottom: number } | null = null
  /** The bottom of the stack under the minimap, in the frame's units, or null with none drawn. */
  private routeStackBottom: number | null = null

  constructor() {
    super('TradingPost')
  }

  preload(): void {
    for (const key of [...Object.values(ITEM_ICON_KEYS), ...Object.values(RUNE_ICON_KEYS), ...Object.values(SOCKET_PIP_KEYS)]) {
      this.load.image(key, `assets/sprites/${key}.png`)
    }
  }

  create(data: TradingPostData): void {
    this.gameState = data.game
    this.expedition = homeParty(data.game, data.party) ?? selectedParty(data.game, data.party)
    this.tab = 'buy'
    this.page = 0
    this.filter = { ...OPENING_FILTER }
    this.selected = null
    this.routeChosen = null
    this.message = ''
    this.bg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0).setInteractive()
    this.frame = this.add.container(0, 0)
    this.render()
    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this))
    this.input.keyboard?.on('keydown-ESC', () => {
      playCue(this, 'ui.back')
      if (this.selected) this.select(null)
      else this.close()
    })
  }

  /** What the in-browser tests see of the trading post; see testHook.ts. */
  probe(): TradingPostProbe {
    const { x, y, scale } = this.frame
    const onScreen = (at: Point) => ({ x: x + at.x * scale, y: y + at.y * scale })
    const control = (key: keyof TradingPostProbe['buttons']): ButtonProbe => {
      const shown = this.controls[key]
      return { ...onScreen(shown?.at ?? { x: 0, y: 0 }), visible: !!shown, enabled: !!shown?.enabled }
    }
    const row = this.rows().find((r) => r.id === this.selected)
    return {
      actingFor: this.expedition.id,
      tab: this.tab,
      gold: this.gameState.world.stock.gold ?? 0,
      message: this.message,
      selected: this.selected,
      details: row ? this.details(row) : [],
      filter: { ...this.filter },
      slotButtons: SLOT_BUTTONS.filter(([slot]) => this.slotAt.has(slot)).map(([slot]) => ({ ...onScreen(this.slotAt.get(slot)!), visible: true, enabled: true, slot })),
      goodsButton: this.goodsAt ? { ...onScreen(this.goodsAt), visible: true, enabled: true } : { x: 0, y: 0, visible: false, enabled: false },
      runesButton: this.runesAt ? { ...onScreen(this.runesAt), visible: true, enabled: true } : { x: 0, y: 0, visible: false, enabled: false },
      familyButtons: [...this.familyAt].map(([family, at]) => ({ ...onScreen(at), visible: true, enabled: true, family })),
      rows: this.rows().map((r) => {
        const at = this.rowAt.get(r.id)
        return { ...onScreen(at ?? { x: 0, y: 0 }), visible: !!at, enabled: !!at, id: r.id, kind: r.kind, price: r.price, label: r.label }
      }),
      buttons: {
        buyTab: control('buyTab'),
        sellTab: control('sellTab'),
        routesTab: control('routesTab'),
        confirm: control('confirm'),
        confirmAll: control('confirmAll'),
        prev: control('prev'),
        next: control('next'),
        close: control('close'),
      },
      routes: this.routeLines.map(({ row, line, open, openEnabled, selected }) => ({
        partner: row.partner,
        status: row.status,
        line,
        open: open ? { ...onScreen(open), visible: true, enabled: openEnabled, width: OPEN_W * this.frame.scale } : null,
        selected,
      })),
      refusalBox: this.refusalBox ? { top: y + this.refusalBox.top * scale, bottom: y + this.refusalBox.bottom * scale } : null,
      routeRefusal: this.routeRefusal,
      routeNotes: [...this.routeNotes],
      routeStack:
        this.routeStackBottom === null
          ? null
          : { bottom: y + this.routeStackBottom * scale, messageTop: y + (MESSAGE_Y - Math.max(this.messageHeight, 16) / 2) * scale },
    }
  }

  private get listTop(): number {
    return this.tab === 'buy' ? BUY_LIST_TOP : SELL_LIST_TOP
  }

  private get rowsPerPage(): number {
    if (this.tab === 'routes') return ROUTE_ROWS
    return this.tab === 'buy' ? BUY_ROWS_PER_PAGE : SELL_ROWS_PER_PAGE
  }

  private get pageY(): number {
    if (this.tab === 'routes') return ROUTE_PAGED_TOP + ROUTE_ROWS * ROUTE_PAGED_ROW_H + 13
    return this.listTop + this.rowsPerPage * ROW_H + 18
  }

  // ---- what is shown -----------------------------------------------------------

  /** The lines of the tab showing, every page's. */
  private rows(): Row[] {
    const game = this.gameState
    const apOf = (member: number) => deriveCombatStats(this.expedition.members[member]).actionPoints
    const { slot, family } = this.filter
    if (this.tab === 'routes') return []
    if (this.tab === 'buy') {
      if (slot === 'goods') {
        return goodRows(game.world).map((good) => ({ id: good.id, kind: 'good', label: good.label, detail: '', price: GOOD_PRICE, material: good.material, ap: TYPICAL_AP }))
      }
      if (slot === 'runes') {
        return runeWares(game.world).map((key) => ({ id: `rune:${key}`, kind: 'rune', label: runeName(key), detail: '', price: runePrice(key), rune: key, ap: TYPICAL_AP }))
      }
      return wares(game.world, { slot, family: family ?? undefined }).map((item) => ({ id: item.id, kind: 'item', label: item.name, detail: statSummary(item), price: buyPrice(item)!, item, ap: TYPICAL_AP }))
    }
    const items: Row[] = sellables(game, this.expedition).map(({ place, item, price }) => {
      const whose = place.from === 'baggage' ? 'baggage' : `${this.expedition.members[place.member].name}'s pack`
      return {
        id: placeKey(place),
        kind: 'item',
        label: item.name,
        detail: `${whose}; ${statSummary(item)}`,
        price,
        item,
        place,
        ap: place.from === 'baggage' ? TYPICAL_AP : apOf(place.member),
      }
    })
    const materials: Row[] = Object.entries(game.world.stock)
      .filter(([material, amount]) => material !== 'gold' && (amount ?? 0) >= MATERIALS_PER_GOLD)
      .map(([material, amount]) => ({
        id: `material:${material}`,
        kind: 'material',
        label: `${amount} ${materialName(material as Material)}`,
        detail: `${MATERIALS_PER_GOLD} for 1 gold`,
        price: 1,
        material: material as Material,
        amount: amount!,
        ap: TYPICAL_AP,
      }))
    const runes: Row[] = pouchKeys(game.runes).map((key) => ({
      id: `rune:${key}`,
      kind: 'rune',
      label: `${pouchCount(game.runes, key)} × ${runeName(key)}`,
      detail: 'the pouch',
      price: runeSalePrice(key),
      rune: key,
      ap: TYPICAL_AP,
    }))
    // The baggage first: loot, and the gear of the fallen, is what is sold most.
    const baggage = items.filter((row) => row.place!.from === 'baggage')
    return [...baggage, ...items.filter((row) => row.place!.from !== 'baggage'), ...materials, ...runes]
  }

  /** The details of the line clicked: the item's stats and what it costs or fetches. */
  private details(row: Row): string[] {
    if (row.kind === 'good') return [`The stock holds ${this.gameState.world.stock[row.material!] ?? 0} ${materialName(row.material!)}.`, 'Bought into the stock, to forge with.']
    if (row.kind === 'material') {
      const lots = Math.floor(row.amount! / MATERIALS_PER_GOLD)
      return [`The stock holds ${row.label}.`, `The post pays 1 gold for every ${MATERIALS_PER_GOLD}: ${lots} gold for all of it.`]
    }
    const price = this.tab === 'buy' ? `Costs ${row.price} gold.` : `Fetches ${row.price} gold${row.kind === 'rune' ? ' each' : ''}.`
    if (row.kind === 'rune') return [...runeEffectLines(row.rune!), runeSocketLine(), price]
    return [...statLines(row.item!, row.ap), price]
  }

  // ---- build -----------------------------------------------------------------

  private render(): void {
    this.frame.removeAll(true)
    notifyStock(this)
    this.controls = {}
    this.routeLines = []
    this.routeRefusal = null
    this.routeNotes = []
    this.refusalBox = null
    this.routeStackBottom = null
    this.rowAt = new Map()
    this.slotAt = new Map()
    this.runesAt = null
    this.goodsAt = null
    this.familyAt = new Map()
    const { world } = this.gameState
    const rows = this.rows()
    this.routeAll = this.tab === 'routes' ? routeRows(this.gameState, this.expedition) : []
    const count = this.tab === 'routes' ? this.routeAll.length : rows.length
    const pages = Math.max(1, Math.ceil(count / this.rowsPerPage))
    this.page = Math.min(this.page, pages - 1)
    this.frame.add([
      this.add.rectangle(CENTRE_X, FRAME_H / 2, FRAME_W, FRAME_H, 0x241d15, 0.98).setStrokeStyle(3, 0xc9a227),
      this.add.text(CENTRE_X, TITLE_Y, tradingPostName(world.tradingPost), { fontFamily: FONT, fontSize: '28px', color: GOLD, fontStyle: 'bold' }).setOrigin(0.5),
      this.add
        .text(CENTRE_X, TITLE_Y + 28, `${actingFor(this.gameState, this.expedition)}${tradingPostName(world.tradingPost)}, level ${world.tradingPost}.  Gold in the stock: ${world.stock.gold ?? 0}`, { fontFamily: FONT, fontSize: '13px', color: DIM })
        .setOrigin(0.5),
      this.messageLine(),
    ])
    this.button('buyTab', { x: 140, y: TAB_Y, width: 120, height: 30 }, 'Buy', () => this.show('buy'), true, this.tab === 'buy')
    this.button('sellTab', { x: 280, y: TAB_Y, width: 120, height: 30 }, 'Sell', () => this.show('sell'), true, this.tab === 'sell')
    this.button('routesTab', { x: 420, y: TAB_Y, width: 120, height: 30 }, 'Routes', () => this.show('routes'), true, this.tab === 'routes')
    if (this.tab === 'buy') this.drawFilter()
    rows.slice(this.page * this.rowsPerPage, (this.page + 1) * this.rowsPerPage).forEach((row, i) => this.drawRow(row, this.listTop + i * ROW_H))
    if (rows.length === 0 && this.tab !== 'routes') {
      const none =
        this.tab === 'sell'
          ? 'Nothing to sell: worn gear must be taken off first.'
          : this.filter.slot === 'runes'
            ? `A level ${RUNE_RANK_LEVELS[1]} trading post sells runes.`
            : this.filter.slot === 'goods'
              ? NO_GOODS
              : 'The post sells nothing of this kind yet.'
      this.frame.add(this.add.text(LIST_X + 8, this.listTop, none, { fontFamily: FONT, fontSize: '13px', color: DIM }))
    }
    if (pages > 1) {
      const pageY = this.pageY
      this.button('prev', { x: LIST_X + 60, y: pageY, width: 100, height: 26 }, 'Prev', () => this.turnPage(-1), this.page > 0)
      this.frame.add(this.add.text(LIST_X + LIST_W / 2, pageY, `Page ${this.page + 1} of ${pages}`, { fontFamily: FONT, fontSize: '12px', color: DIM }).setOrigin(0.5))
      this.button('next', { x: LIST_X + LIST_W - 60, y: pageY, width: 100, height: 26 }, 'Next', () => this.turnPage(1), this.page < pages - 1)
    }
    if (this.tab === 'routes') this.drawRoutes()
    else this.drawDetails(rows.find((row) => row.id === this.selected) ?? null)
    this.button('close', { x: CENTRE_X, y: BUTTON_Y, width: 160, height: 36 }, 'Close', () => this.close())
  }

  /** The Buy tab's filter: a button for each slot, and under them "All" and the slot's families. */
  private drawFilter(): void {
    const goods = this.gameState.world.tradingPost >= GOODS_LEVEL
    const slotW = FILTER_W / (SLOT_BUTTONS.length + (goods ? 2 : 1))
    SLOT_BUTTONS.forEach(([slot, label], i) => {
      const at = { x: LIST_X + slotW * (i + 0.5), y: SLOT_Y, width: slotW - 6, height: 24 }
      this.slotAt.set(slot, at)
      this.filterButton(at, label, () => this.setFilter({ slot, family: null }), this.filter.slot === slot)
    })
    const runesAt = { x: LIST_X + slotW * (SLOT_BUTTONS.length + 0.5), y: SLOT_Y, width: slotW - 6, height: 24 }
    this.runesAt = runesAt
    this.filterButton(runesAt, 'Runes', () => this.setFilter({ slot: 'runes', family: null }), this.filter.slot === 'runes', 'ui.tab')
    if (goods) {
      const goodsAt = { x: LIST_X + slotW * (SLOT_BUTTONS.length + 1.5), y: SLOT_Y, width: slotW - 6, height: 24 }
      this.goodsAt = goodsAt
      this.filterButton(goodsAt, 'Goods', () => this.setFilter({ slot: 'goods', family: null }), this.filter.slot === 'goods', 'ui.tab')
    }
    if (this.filter.slot === 'runes' || this.filter.slot === 'goods') return
    const familyW = FILTER_W / FAMILIES_PER_ROW
    const families: Array<[FamilyId | null, string]> = [[null, 'All'], ...FAMILIES.filter((f) => f.slot === this.filter.slot).map((f): [FamilyId, string] => [f.id, f.name])]
    families.forEach(([family, label], i) => {
      const at = { x: LIST_X + familyW * ((i % FAMILIES_PER_ROW) + 0.5), y: FAMILY_Y + Math.floor(i / FAMILIES_PER_ROW) * FAMILY_ROW_H, width: familyW - 4, height: 20 }
      this.familyAt.set(family, at)
      this.filterButton(at, label, () => this.setFilter({ slot: this.filter.slot, family }), this.filter.family === family)
    })
  }

  private filterButton(at: Rect, label: string, onClick: () => void, marked: boolean, cue: CueId = 'ui.click'): void {
    // Next tick, as every button here: the redraw destroys the button whose handler this runs in.
    addPanelButton(this, this.frame, at, label, () => this.time.delayedCall(0, onClick), { enabled: true, marked, fontSize: 10, cue })
  }

  /** A line of the list: the item's icon, name and stats, and its price; a click shows its details. */
  private drawRow(row: Row, y: number): void {
    const marked = row.id === this.selected
    const centre = { x: LIST_X + LIST_W / 2, y: y + ROW_H / 2 }
    this.rowAt.set(row.id, centre)
    const back = this.add
      .rectangle(centre.x, centre.y, LIST_W, ROW_H - 2, marked ? 0x3a2f1c : 0x1b1712, 0.95)
      .setStrokeStyle(1, marked ? 0xc9a227 : 0x3a3024)
      .setInteractive({ useHandCursor: true })
    back.on('pointerover', () => !marked && back.setFillStyle(0x2c2418, 0.95))
    back.on('pointerout', () => !marked && back.setFillStyle(0x1b1712, 0.95))
    back.on('pointerdown', () => {
      playCue(this, 'ui.click')
      this.time.delayedCall(0, () => this.select(row.id))
    })
    this.frame.add(back)
    if (row.item) {
      const icon = this.add.image(LIST_X + 12, centre.y, ITEM_ICON_KEYS[row.item.icon])
      const tint = iconTint(row.item)
      if (tint !== undefined) icon.setTint(tint)
      this.frame.add([icon, ...createPips(this, row.item, LIST_X + 12, centre.y, 1)])
    }
    if (row.rune) this.frame.add(this.add.image(LIST_X + 12, centre.y, RUNE_ICON_KEYS[parseRuneKey(row.rune)!.id]))
    // A good's label already says its price.
    const price = row.kind === 'good' ? '' : this.tab === 'buy' ? `${row.price}g` : row.kind === 'material' ? `${row.price}g/${MATERIALS_PER_GOLD}` : row.kind === 'rune' ? `+${row.price}g each` : `+${row.price}g`
    const priceText = this.add.text(LIST_X + LIST_W - 8, centre.y, price, { fontFamily: FONT, fontSize: '12px', color: GOLD }).setOrigin(1, 0.5)
    const label = this.add.text(LIST_X + 26, centre.y, row.label, { fontFamily: FONT, fontSize: '12px', color: marked ? GOLD : TEXT }).setOrigin(0, 0.5)
    fitText(label, LIST_W - 26 - priceText.width - 16)
    this.frame.add([label, priceText])
  }

  /** The line clicked: what it is, its stats, its price and the button that confirms; a hint while none is. */
  private drawDetails(row: Row | null): void {
    const style = { fontFamily: FONT, fontSize: '12px', color: TEXT, wordWrap: { width: DETAILS_W } }
    if (!row) {
      const hint =
        this.tab === 'buy' ? (this.filter.slot === 'goods' ? 'Click a good to see who sells it and its price.' : 'Click an item to see its stats and price.') : 'Click an item or a material to see what it fetches.'
      this.frame.add(this.add.text(DETAILS_X, this.listTop, hint, { ...style, color: DIM }))
      return
    }
    // The summary may wrap to two lines, and the stats go under whatever height it has.
    const summary = this.add.text(DETAILS_X, this.listTop + 24, row.kind === 'item' ? row.detail.split(';')[0] : '', { ...style, color: DIM })
    this.frame.add([
      this.add.text(DETAILS_X, this.listTop, row.label, { ...style, fontSize: '14px', color: GOLD }),
      summary,
      this.add.text(DETAILS_X, summary.y + Math.max(summary.height, 14) + 8, this.details(row).join('\n'), { ...style, lineSpacing: 4 }),
    ])
    const at = (y: number): Rect => ({ x: DETAILS_X + DETAILS_W / 2, y, width: DETAILS_W, height: 32 })
    if (row.kind === 'good') {
      const [one, many] = GOOD_AMOUNTS
      const refusals = GOOD_AMOUNTS.map((amount) => buyGoodRefusal(this.gameState, this.expedition, row.material!, amount))
      const shown = refusals.find((r) => r !== null)
      // The message line says it too after a refused click: one copy.
      if (shown && !refusals.includes(this.message)) {
        const text = this.add.text(DETAILS_X, GOODS_REFUSAL_BOTTOM, shown, { ...style, color: REFUSED }).setOrigin(0, 1)
        this.frame.add(text)
        this.refusalBox = { top: text.y - text.height, bottom: text.y }
      }
      // Deliberately the reverse of the names' order: Buy 1 (`confirm`) sits on the upper row, at CONFIRM_ALL_Y, and Buy 5 (`confirmAll`) below it, at CONFIRM_Y.
      this.button('confirmAll', at(CONFIRM_Y), buyLabel(many), () => this.onBuyGood(row, many), refusals[1] === null)
      this.button('confirm', at(CONFIRM_ALL_Y), buyLabel(one), () => this.onBuyGood(row, one), refusals[0] === null)
    } else if (this.tab === 'buy') {
      const refusal = row.rune ? buyRuneRefusal(this.gameState, this.expedition, row.rune) : buyRefusal(this.gameState, this.expedition, row.id)
      if (refusal && refusal !== this.message) {
        const text = this.add.text(DETAILS_X, REFUSAL_Y, refusal, { ...style, color: REFUSED })
        this.frame.add(text)
        this.refusalBox = { top: text.y, bottom: text.y + text.height }
      }
      this.button('confirm', at(CONFIRM_Y), `Buy for ${row.price} gold`, () => (row.rune ? this.onBuyRune(row) : this.onBuy(row)), refusal === null)
    } else if (row.kind === 'rune') {
      this.button('confirm', at(CONFIRM_Y), `Sell one for ${row.price} gold`, () => this.onSellRune(row))
    } else if (row.kind === 'item') {
      this.button('confirm', at(CONFIRM_Y), `Sell for ${row.price} gold`, () => this.onSell(row))
    } else {
      const all = row.amount! - (row.amount! % MATERIALS_PER_GOLD)
      this.button('confirm', at(CONFIRM_ALL_Y), `Sell ${MATERIALS_PER_GOLD} for 1 gold`, () => this.onSellMaterial(row, MATERIALS_PER_GOLD))
      this.button('confirmAll', at(CONFIRM_Y), `Sell ${all} for ${all / MATERIALS_PER_GOLD} gold`, () => this.onSellMaterial(row, all))
    }
  }

  // ---- the Routes tab ----------------------------------------------------------

  private drawRoutes(): void {
    const { world } = this.gameState
    const all = this.routeAll
    const paged = all.length > ROUTE_ROWS
    const rowH = paged ? ROUTE_PAGED_ROW_H : ROUTE_ROW_H
    const rows = all.slice(this.page * ROUTE_ROWS, (this.page + 1) * ROUTE_ROWS)
    // The row clicked, else the page's first.
    const chosen = rows.find((r) => r.partner === this.routeChosen) ?? rows[0] ?? null
    const limit = routeLimit(world)
    const heading =
      limit === 0
        ? `Routes need the ${tradingPostName(4)} (trading post level 4).`
        : rows.length === 0
          ? `No partner trades with ${encampmentName(world)} yet: walk to one on the map.`
          : `Routes: ${world.routes.length} of ${limit} open.`
    this.frame.add(this.add.text(LIST_X + 4, 126, heading, { fontFamily: FONT, fontSize: '13px', color: limit === 0 ? REFUSED : GOLD, wordWrap: { width: LIST_W } }))
    rows.forEach((row, i) => this.drawRouteRow(row, (paged ? ROUTE_PAGED_TOP : ROUTE_TOP) + i * rowH, rowH, row === chosen))
    this.drawMinimap(chosen)
  }

  private drawRouteRow(row: RouteRow, y: number, height: number, marked: boolean): void {
    const centre = { x: LIST_X + LIST_W / 2, y: y + height / 2 }
    const line = row.status === 'closed' ? routeOffer(row) : routeState(row)
    const back = this.add
      .rectangle(centre.x, centre.y, LIST_W, height - 4, marked ? 0x3a2f1c : 0x1b1712, 0.95)
      .setStrokeStyle(1, marked ? 0xc9a227 : 0x3a3024)
      .setInteractive({ useHandCursor: true })
    back.on('pointerdown', () => {
      playCue(this, 'ui.click')
      this.time.delayedCall(0, () => this.chooseRoute(row.partner))
    })
    const color = row.status === 'raided' ? RAIDED : row.silent ? DIM : marked ? GOLD : TEXT
    const text = this.add.text(LIST_X + 8, centre.y, line, { fontFamily: FONT, fontSize: '12px', color, wordWrap: { width: ROUTE_TEXT_W }, lineSpacing: 2 }).setOrigin(0, 0.5)
    this.frame.add([back, text])
    let open: Point | null = null
    if (row.status === 'closed') {
      open = { x: LIST_X + LIST_W - OPEN_W / 2 - 8, y: centre.y }
      // A refused Open is faint but clickable: its click tells the refusal.
      addPanelButton(this, this.frame, { ...open, width: OPEN_W, height: 28 }, 'Open', () => this.time.delayedCall(0, () => this.onOpenRoute(row)), {
        enabled: true,
        dimmed: row.refusal !== null,
        fontSize: 13,
        cue: null,
      })
    }
    this.routeLines.push({ row, line, open, openEnabled: row.status === 'closed' && row.refusal === null, selected: marked })
  }

  /** The board's outline, the known nests and partners, the home, and the chosen row's road. */
  private drawMinimap(row: RouteRow | null): void {
    const { world } = this.gameState
    const board = minimapBoard(world.board, MINIMAP)
    const home = encampment(world).position
    const g = this.add.graphics()
    g.fillStyle(0x1b1712, 1).fillRect(board.x, board.y, board.width, board.height)
    g.lineStyle(1, 0x6b5a3a, 1).strokeRect(board.x, board.y, board.width, board.height)
    const at = (hex: typeof home): Point => minimapPoints(world.board, [], hex, MINIMAP)[0]
    for (const nest of world.locations.filter((l) => l.kind === 'monsters' && world.sighted.includes(l.id))) {
      const p = at(nest.position)
      g.fillStyle(0xb23a3a, 1).fillRect(p.x - 2, p.y - 2, 4, 4)
    }
    for (const partner of world.contacted.map((id) => world.locations.find((l) => l.id === id)).filter((l) => l !== undefined)) {
      const p = at(partner.position)
      g.fillStyle(0xe8c766, 1).fillCircle(p.x, p.y, 3)
    }
    if (row?.road) {
      const points = minimapPoints(world.board, row.road, home, MINIMAP)
      g.lineStyle(2, row.status === 'raided' || row.raid ? ROAD_COLORS.raided : ROAD_COLORS.secure, 1).beginPath().moveTo(points[0].x, points[0].y)
      for (const p of points.slice(1)) g.lineTo(p.x, p.y)
      g.strokePath()
    }
    const h = at(home)
    g.fillStyle(0xffffff, 1).fillCircle(h.x, h.y, 4)
    this.frame.add(g)
    // The road's length is in its row; a caption only when there is no road to draw.
    const caption = row ? (row.road ? null : `No road to ${row.name}`) : 'Nothing to show yet.'
    // Under the minimap, stacked: the caption, the notes (the raid, why security is short, the good's condition), the refusal.
    // Told once: once Open was clicked, the message line says the refusal.
    const refusal = row?.status === 'closed' && row.refusal && row.refusal !== this.message ? row.refusal : null
    // With a refusal to tell, the good's condition gives way to it.
    const notes = row ? routeNotes(row, { good: refusal === null }) : []
    const items: { text: string; color: string; kind: 'caption' | 'note' | 'refusal' }[] = [
      ...(caption ? [{ text: caption, color: DIM, kind: 'caption' as const }] : []),
      ...notes.map((text) => ({ text, color: TEXT, kind: 'note' as const })),
      ...(refusal ? [{ text: refusal, color: REFUSED, kind: 'refusal' as const }] : []),
    ]
    const top = MINIMAP.y + MINIMAP.height + 8
    const texts = items.map((item) => this.add.text(DETAILS_X, 0, item.text, { fontFamily: FONT, fontSize: '12px', color: item.color, wordWrap: { width: DETAILS_W }, lineSpacing: 2 }))
    const height = () => texts.reduce((sum, t) => sum + (t.active ? t.height + STACK_GAP : 0), 0)
    // Kept above the message line: the notes give way from the last (the good's, then security's), never the refusal.
    for (let i = items.length - 1; i >= 0 && top + height() > STACK_BOTTOM; i--) {
      if (items[i].kind === 'note') texts[i].destroy()
    }
    let y = top
    this.routeNotes = []
    items.forEach((item, i) => {
      if (!texts[i].active) return
      texts[i].setY(y)
      this.frame.add(texts[i])
      y += texts[i].height + STACK_GAP
      if (item.kind === 'note') this.routeNotes.push(item.text)
      if (item.kind === 'refusal') this.routeRefusal = item.text
    })
    this.routeStackBottom = y - STACK_GAP
  }

  /** The message line, centred on `MESSAGE_Y`; its height is kept for the probe. */
  private messageLine(): Phaser.GameObjects.Text {
    const text = this.add
      .text(CENTRE_X, MESSAGE_Y, this.message, { fontFamily: FONT, fontSize: '13px', color: TEXT, align: 'center', wordWrap: { width: FRAME_W - 40 } })
      .setOrigin(0.5)
    this.messageHeight = this.message ? text.height : 0
    return text
  }

  private chooseRoute(partner: string): void {
    this.routeChosen = partner
    this.render()
  }

  /** Opens the route, or says why not; the road is drawn on the minimap after. */
  private onOpenRoute(row: RouteRow): void {
    const refusal = openRouteRefusal(this.gameState, this.expedition, row.partner)
    playCue(this, refusalCue(refusal, 'world.build'))
    this.message = refusal ?? describeWorldEvent(openRoute(this.gameState, this.expedition, row.partner))
    this.routeChosen = row.partner
    this.render()
  }

  private button(key: keyof TradingPostProbe['buttons'], at: Rect, label: string, onClick: () => void, enabled = true, marked = false): void {
    this.controls[key] = { at, enabled }
    // The tabs sound a tab; a confirm sounds its own outcome (a refused one is faint but still clickable, and sounds the refusal); the rest a click or a back.
    const confirms = key === 'confirm' || key === 'confirmAll'
    const cue = confirms ? null : key === 'buyTab' || key === 'sellTab' || key === 'routesTab' ? 'ui.tab' : buttonCue(label)
    // Next tick: the redraw a click leads to destroys the button whose handler this runs in.
    addPanelButton(this, this.frame, at, label, () => this.time.delayedCall(0, onClick), { enabled: enabled || confirms, dimmed: confirms && !enabled, marked, fontSize: 13, cue })
  }

  private layout(): void {
    const { width, height } = this.scale
    this.bg.setSize(width, height)
    const scale = overlayScale(width, height, FRAME_W, FRAME_H)
    this.frame.setScale(scale).setPosition((width - FRAME_W * scale) / 2, (height - FRAME_H * scale) / 2)
  }

  // ---- actions ---------------------------------------------------------------

  private show(tab: Tab): void {
    this.tab = tab
    this.page = 0
    this.filter = { ...OPENING_FILTER }
    this.selected = null
    this.routeChosen = null
    this.message = ''
    this.render()
  }

  /** A new filter: back to the first page, nothing selected. */
  private setFilter(filter: Filter): void {
    this.filter = filter
    this.page = 0
    this.selected = null
    this.render()
  }

  private select(id: string | null): void {
    this.selected = id
    this.render()
  }

  private turnPage(by: number): void {
    this.page += by
    // A turned Routes page selects its first row.
    if (this.tab === 'routes') this.routeChosen = this.routeAll[this.page * ROUTE_ROWS]?.partner ?? null
    this.render()
  }

  /** Says why an action was refused, or `done`, and draws the post as it now stands. */
  private act(refusal: string | null, done: string, keepSelection = false): void {
    playCue(this, refusalCue(refusal, 'world.coins'))
    this.message = refusal ?? done
    if (!refusal && !keepSelection) this.selected = null
    this.render()
  }

  private onBuy(row: Row): void {
    this.act(buy(this.gameState, this.expedition, row.id), `Bought the ${row.label} for ${row.price} gold. It is in the baggage.`, true)
  }

  /** Buys `amount` of the good into the stock; the line stays selected. */
  private onBuyGood(row: Row, amount: number): void {
    this.act(buyGood(this.gameState, this.expedition, row.material!, amount), `Bought ${amount} ${materialName(row.material!)} for ${amount * GOOD_PRICE} gold.`, true)
  }

  private onBuyRune(row: Row): void {
    this.act(buyRune(this.gameState, this.expedition, row.rune!), `Bought the ${row.label} for ${row.price} gold. It is in the rune pouch.`, true)
  }

  /** Sells one rune of the line; the line stays selected while the pouch holds more of it. */
  private onSellRune(row: Row): void {
    const left = pouchCount(this.gameState.runes, row.rune!) - 1
    this.act(sellRune(this.gameState, this.expedition, row.rune!), `Sold the ${runeName(row.rune!)} for ${row.price} gold.`, left > 0)
  }

  private onSell(row: Row): void {
    this.act(sell(this.gameState, row.place!), `Sold the ${row.label} for ${row.price} gold.`)
  }

  private onSellMaterial(row: Row, amount: number): void {
    const left = row.amount! - amount
    this.act(sellMaterial(this.gameState, this.expedition, row.material!, amount), `Sold ${amount} ${materialName(row.material!)} for ${amount / MATERIALS_PER_GOLD} gold.`, left >= MATERIALS_PER_GOLD)
  }

  /** Back to the encampment, the trading post's details showing. */
  private close(): void {
    this.scene.start('Encampment', { game: this.gameState, party: this.expedition.id, select: 'trading_post' })
    this.scene.bringToTop('Encampment')
  }
}
