import Phaser from 'phaser'
import { deriveCombatStats } from '../character/character.ts'
import type { GameState } from '../game/gameState.ts'
import { placeKey, type ItemPlace } from '../game/itemPlace.ts'
import type { Material } from '../game/territory.ts'
import { MATERIALS_PER_GOLD, buy, buyPrice, buyRefusal, sell, sellMaterial, sellables, wares } from '../game/tradingPost.ts'
import { FAMILIES, type FamilyId } from '../inventory/catalog.ts'
import type { EquipmentSlot, Item } from '../inventory/inventory.ts'
import type { ButtonProbe, TradingPostProbe } from '../testHook.ts'
import { soundVolume } from './audioSettings.ts'
import type { Point } from './boardGeometry.ts'
import { TYPICAL_AP, statLines, statSummary } from './gearCompare.ts'
import { ITEM_ICON_KEYS, RUNE_ICON_KEYS, SOCKET_PIP_KEYS, iconTint } from './itemIcons.ts'
import type { Rect } from './mapScroll.ts'
import { addPanelButton } from './panelButton.ts'

interface TradingPostData {
  game: GameState
}

type Tab = 'buy' | 'sell'

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
  slot: EquipmentSlot
  family: FamilyId | null
}
const OPENING_FILTER: Filter = { slot: 'mainHand', family: null }

/** A line of the list: an item for sale or to sell, or a material to sell. */
interface Row {
  id: string
  kind: 'item' | 'material'
  label: string
  /** Under the name: the item's stats, and whose it is when selling. */
  detail: string
  /** What it costs, or fetches; a material's is a pair's. */
  price: number
  item?: Item
  place?: ItemPlace
  material?: Material
  amount?: number
  /** The AP of the hero who holds it, which tells its attacks a turn. */
  ap: number
}

/** Drawn in a frame of this size, centred over the map and scaled down (never up) to fit the window. */
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
const MESSAGE_Y = 462
const BUTTON_Y = 495
/** The Buy tab's filter: the slot buttons across the frame, the families of the slot under them, eight to a row. */
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

/**
 * The trading post, entered from the encampment (EncampmentScene) over the
 * paused world map: Buy lists every plain item at the grades the post's
 * level allows, Sell what the party carries and the baggage holds, and the
 * stock's materials. A click on a line shows the item's stats and price, and
 * a button confirms. Every action calls a function of tradingPost.ts.
 * Closing it goes back to the encampment.
 */
export class TradingPostScene extends Phaser.Scene {
  private gameState!: GameState
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
  private familyAt = new Map<FamilyId | null, Point>()

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
    this.tab = 'buy'
    this.page = 0
    this.filter = { ...OPENING_FILTER }
    this.selected = null
    this.message = ''
    this.bg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0).setInteractive()
    this.frame = this.add.container(0, 0)
    this.render()
    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this))
    this.input.keyboard?.on('keydown-ESC', () => (this.selected ? this.select(null) : this.close()))
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
      tab: this.tab,
      gold: this.gameState.world.stock.gold ?? 0,
      message: this.message,
      selected: this.selected,
      details: row ? this.details(row) : [],
      filter: { ...this.filter },
      slotButtons: SLOT_BUTTONS.filter(([slot]) => this.slotAt.has(slot)).map(([slot]) => ({ ...onScreen(this.slotAt.get(slot)!), visible: true, enabled: true, slot })),
      familyButtons: [...this.familyAt].map(([family, at]) => ({ ...onScreen(at), visible: true, enabled: true, family })),
      rows: this.rows().map((r) => {
        const at = this.rowAt.get(r.id)
        return { ...onScreen(at ?? { x: 0, y: 0 }), visible: !!at, enabled: !!at, id: r.id, kind: r.kind, price: r.price }
      }),
      buttons: {
        buyTab: control('buyTab'),
        sellTab: control('sellTab'),
        confirm: control('confirm'),
        confirmAll: control('confirmAll'),
        prev: control('prev'),
        next: control('next'),
        close: control('close'),
      },
    }
  }

  private get listTop(): number {
    return this.tab === 'buy' ? BUY_LIST_TOP : SELL_LIST_TOP
  }

  private get rowsPerPage(): number {
    return this.tab === 'buy' ? BUY_ROWS_PER_PAGE : SELL_ROWS_PER_PAGE
  }

  private get pageY(): number {
    return this.listTop + this.rowsPerPage * ROW_H + 18
  }

  // ---- what is shown -----------------------------------------------------------

  /** The lines of the tab showing, every page's. */
  private rows(): Row[] {
    const game = this.gameState
    const apOf = (member: number) => deriveCombatStats(game.party[member]).actionPoints
    if (this.tab === 'buy') {
      return wares(game.world, { slot: this.filter.slot, family: this.filter.family ?? undefined }).map((item) => ({ id: item.id, kind: 'item', label: item.name, detail: statSummary(item), price: buyPrice(item)!, item, ap: TYPICAL_AP }))
    }
    const items: Row[] = sellables(game).map(({ place, item, price }) => {
      const whose = place.from === 'baggage' ? 'baggage' : `${game.party[place.member].name}'s pack`
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
        label: `${amount} ${material}`,
        detail: `${MATERIALS_PER_GOLD} for 1 gold`,
        price: 1,
        material: material as Material,
        amount: amount!,
        ap: TYPICAL_AP,
      }))
    // The baggage first: loot, and the gear of the fallen, is what is sold most.
    const baggage = items.filter((row) => row.place!.from === 'baggage')
    return [...baggage, ...items.filter((row) => row.place!.from !== 'baggage'), ...materials]
  }

  /** The details of the line clicked: the item's stats and what it costs or fetches. */
  private details(row: Row): string[] {
    if (row.kind === 'material') {
      const lots = Math.floor(row.amount! / MATERIALS_PER_GOLD)
      return [`The stock holds ${row.label}.`, `The post pays 1 gold for every ${MATERIALS_PER_GOLD}: ${lots} gold for all of it.`]
    }
    const price = this.tab === 'buy' ? `Costs ${row.price} gold.` : `Fetches ${row.price} gold.`
    return [...statLines(row.item!, row.ap), price]
  }

  // ---- build -----------------------------------------------------------------

  private render(): void {
    this.frame.removeAll(true)
    this.controls = {}
    this.rowAt = new Map()
    this.slotAt = new Map()
    this.familyAt = new Map()
    const { world } = this.gameState
    const rows = this.rows()
    const pages = Math.max(1, Math.ceil(rows.length / this.rowsPerPage))
    this.page = Math.min(this.page, pages - 1)
    this.frame.add([
      this.add.rectangle(CENTRE_X, FRAME_H / 2, FRAME_W, FRAME_H, 0x241d15, 0.98).setStrokeStyle(3, 0xc9a227),
      this.add.text(CENTRE_X, TITLE_Y, 'Trading Post', { fontFamily: FONT, fontSize: '28px', color: GOLD, fontStyle: 'bold' }).setOrigin(0.5),
      this.add
        .text(CENTRE_X, TITLE_Y + 28, `Level ${world.tradingPost}.  Gold in the stock: ${world.stock.gold ?? 0}`, { fontFamily: FONT, fontSize: '13px', color: DIM })
        .setOrigin(0.5),
      this.add
        .text(CENTRE_X, MESSAGE_Y, this.message, { fontFamily: FONT, fontSize: '13px', color: TEXT, align: 'center', wordWrap: { width: FRAME_W - 40 } })
        .setOrigin(0.5),
    ])
    this.button('buyTab', { x: 140, y: TAB_Y, width: 120, height: 30 }, 'Buy', () => this.show('buy'), true, this.tab === 'buy')
    this.button('sellTab', { x: 280, y: TAB_Y, width: 120, height: 30 }, 'Sell', () => this.show('sell'), true, this.tab === 'sell')
    if (this.tab === 'buy') this.drawFilter()
    rows.slice(this.page * this.rowsPerPage, (this.page + 1) * this.rowsPerPage).forEach((row, i) => this.drawRow(row, this.listTop + i * ROW_H))
    if (rows.length === 0) {
      const none = this.tab === 'buy' ? 'The post sells nothing of this kind yet.' : 'Nothing to sell: worn gear must be taken off first.'
      this.frame.add(this.add.text(LIST_X + 8, this.listTop, none, { fontFamily: FONT, fontSize: '13px', color: DIM }))
    }
    if (pages > 1) {
      const pageY = this.pageY
      this.button('prev', { x: LIST_X + 60, y: pageY, width: 100, height: 26 }, 'Prev', () => this.turnPage(-1), this.page > 0)
      this.frame.add(this.add.text(LIST_X + LIST_W / 2, pageY, `Page ${this.page + 1} of ${pages}`, { fontFamily: FONT, fontSize: '12px', color: DIM }).setOrigin(0.5))
      this.button('next', { x: LIST_X + LIST_W - 60, y: pageY, width: 100, height: 26 }, 'Next', () => this.turnPage(1), this.page < pages - 1)
    }
    this.drawDetails(rows.find((row) => row.id === this.selected) ?? null)
    this.button('close', { x: CENTRE_X, y: BUTTON_Y, width: 160, height: 36 }, 'Close', () => this.close())
  }

  /** The Buy tab's filter: a button for each slot, and under them "All" and the slot's families. */
  private drawFilter(): void {
    const slotW = FILTER_W / SLOT_BUTTONS.length
    SLOT_BUTTONS.forEach(([slot, label], i) => {
      const at = { x: LIST_X + slotW * (i + 0.5), y: SLOT_Y, width: slotW - 6, height: 24 }
      this.slotAt.set(slot, at)
      this.filterButton(at, label, () => this.setFilter({ slot, family: null }), this.filter.slot === slot)
    })
    const familyW = FILTER_W / FAMILIES_PER_ROW
    const families: Array<[FamilyId | null, string]> = [[null, 'All'], ...FAMILIES.filter((f) => f.slot === this.filter.slot).map((f): [FamilyId, string] => [f.id, f.name])]
    families.forEach(([family, label], i) => {
      const at = { x: LIST_X + familyW * ((i % FAMILIES_PER_ROW) + 0.5), y: FAMILY_Y + Math.floor(i / FAMILIES_PER_ROW) * FAMILY_ROW_H, width: familyW - 4, height: 20 }
      this.familyAt.set(family, at)
      this.filterButton(at, label, () => this.setFilter({ slot: this.filter.slot, family }), this.filter.family === family)
    })
  }

  private filterButton(at: Rect, label: string, onClick: () => void, marked: boolean): void {
    // Next tick, as every button here: the redraw destroys the button whose handler this runs in.
    addPanelButton(this, this.frame, at, label, () => this.time.delayedCall(0, onClick), { enabled: true, marked, fontSize: 10 })
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
      this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
      this.time.delayedCall(0, () => this.select(row.id))
    })
    this.frame.add(back)
    if (row.item) {
      const icon = this.add.image(LIST_X + 12, centre.y, ITEM_ICON_KEYS[row.item.icon])
      const tint = iconTint(row.item)
      if (tint !== undefined) icon.setTint(tint)
      this.frame.add(icon)
    }
    const price = this.tab === 'buy' ? `${row.price}g` : row.kind === 'material' ? `${row.price}g/${MATERIALS_PER_GOLD}` : `+${row.price}g`
    this.frame.add([
      this.add.text(LIST_X + 26, centre.y, row.label, { fontFamily: FONT, fontSize: '12px', color: marked ? GOLD : TEXT }).setOrigin(0, 0.5),
      this.add.text(LIST_X + LIST_W - 8, centre.y, price, { fontFamily: FONT, fontSize: '12px', color: GOLD }).setOrigin(1, 0.5),
    ])
  }

  /** The line clicked: what it is, its stats, its price and the button that confirms; a hint while none is. */
  private drawDetails(row: Row | null): void {
    const style = { fontFamily: FONT, fontSize: '12px', color: TEXT, wordWrap: { width: DETAILS_W } }
    if (!row) {
      const hint = this.tab === 'buy' ? 'Click an item to see its stats and price.' : 'Click an item or a material to see what it fetches.'
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
    if (this.tab === 'buy') {
      const refusal = buyRefusal(this.gameState, row.id)
      if (refusal) this.frame.add(this.add.text(DETAILS_X, REFUSAL_Y, refusal, { ...style, color: REFUSED }))
      this.button('confirm', at(CONFIRM_Y), `Buy for ${row.price} gold`, () => this.onBuy(row), refusal === null)
    } else if (row.kind === 'item') {
      this.button('confirm', at(CONFIRM_Y), `Sell for ${row.price} gold`, () => this.onSell(row))
    } else {
      const all = row.amount! - (row.amount! % MATERIALS_PER_GOLD)
      this.button('confirm', at(CONFIRM_ALL_Y), `Sell ${MATERIALS_PER_GOLD} for 1 gold`, () => this.onSellMaterial(row, MATERIALS_PER_GOLD))
      this.button('confirmAll', at(CONFIRM_Y), `Sell ${all} for ${all / MATERIALS_PER_GOLD} gold`, () => this.onSellMaterial(row, all))
    }
  }

  private button(key: keyof TradingPostProbe['buttons'], at: Rect, label: string, onClick: () => void, enabled = true, marked = false): void {
    this.controls[key] = { at, enabled }
    // Next tick: the redraw a click leads to destroys the button whose handler this runs in.
    addPanelButton(this, this.frame, at, label, () => this.time.delayedCall(0, onClick), { enabled, marked, fontSize: 13 })
  }

  private layout(): void {
    const { width, height } = this.scale
    this.bg.setSize(width, height)
    const scale = Math.max(0, Math.min(1, (width - 32) / FRAME_W, (height - 32) / FRAME_H))
    this.frame.setScale(scale).setPosition((width - FRAME_W * scale) / 2, (height - FRAME_H * scale) / 2)
  }

  // ---- actions ---------------------------------------------------------------

  private show(tab: Tab): void {
    this.tab = tab
    this.page = 0
    this.filter = { ...OPENING_FILTER }
    this.selected = null
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
    this.render()
  }

  /** Says why an action was refused, or `done`, and draws the post as it now stands. */
  private act(refusal: string | null, done: string, keepSelection = false): void {
    this.message = refusal ?? done
    if (!refusal && !keepSelection) this.selected = null
    this.render()
  }

  private onBuy(row: Row): void {
    this.act(buy(this.gameState, row.id), `Bought the ${row.label} for ${row.price} gold. It is in the baggage.`, true)
  }

  private onSell(row: Row): void {
    this.act(sell(this.gameState, row.place!), `Sold the ${row.label} for ${row.price} gold.`)
  }

  private onSellMaterial(row: Row, amount: number): void {
    const left = row.amount! - amount
    this.act(sellMaterial(this.gameState, row.material!, amount), `Sold ${amount} ${row.material} for ${amount / MATERIALS_PER_GOLD} gold.`, left >= MATERIALS_PER_GOLD)
  }

  /** Back to the encampment, the trading post's details showing. */
  private close(): void {
    this.scene.start('Encampment', { game: this.gameState, select: 'trading_post' })
    this.scene.bringToTop('Encampment')
  }
}
