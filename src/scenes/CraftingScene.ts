import Phaser from 'phaser'
import { deriveCombatStats } from '../character/character.ts'
import { attributeLevel } from '../character/perks.ts'
import type { WorldEvent } from '../game/blight.ts'
import { describeCost } from '../game/buildings.ts'
import { craft, craftTier, craftables, highestGrade, options, type CraftOption } from '../game/crafting.ts'
import { leader, type GameState } from '../game/gameState.ts'
import { itemAt, placeKey, type ItemPlace } from '../game/itemPlace.ts'
import { embed, extract, fuse, socketables } from '../game/runecraft.ts'
import { gradeNumeral } from '../inventory/grades.ts'
import { EQUIPMENT_SLOT_LABELS, type Item } from '../inventory/inventory.ts'
import { MODIFIERS } from '../inventory/modifiers.ts'
import { parseRuneKey, type RuneKey } from '../inventory/runes.ts'
import type { ButtonProbe, CraftingProbe } from '../testHook.ts'
import { soundVolume } from './audioSettings.ts'
import type { Point } from './boardGeometry.ts'
import { TYPICAL_AP, compareLines, fieldCraftSummary } from './gearCompare.ts'
import { ITEM_ICON_KEYS, RUNE_COLOURS, RUNE_ICON_KEYS, SOCKET_PIP_KEYS, cssColour, iconTint } from './itemIcons.ts'
import type { Rect } from './mapScroll.ts'
import { addPanelButton, fitText } from './panelButton.ts'
import {
  actionId,
  actionPreview,
  actionRefusal,
  doneMessage,
  noSocketsHint,
  parseActionId,
  pouchRows,
  runeEffectLines,
  runeSocketLine,
  socketRows,
  type RuneAction,
} from './runecraftView.ts'
import { createPips } from './socketPips.ts'

interface CraftingData {
  game: GameState
  /** 'World' when opened from the world map's footer, which it resumes on closing; else it goes back to the encampment. */
  resume?: 'World'
}

/** What a field craft hands back to the world map as it resumes it: the item made and the day's events, to report. */
export interface CraftedData {
  crafted: { item: string; events: WorldEvent[] }
}

/** Drawn in a frame of this size, centred over the map and scaled down (never up) to fit the window. */
const FRAME_W = 720
const FRAME_H = 500
const CENTRE_X = FRAME_W / 2
const TITLE_Y = 34
const TAB_Y = 102
const LIST_X = 24
const LIST_W = 380
const LIST_TOP = 128
const ROW_H = 24
const ROWS_PER_PAGE = 11
const PAGE_Y = LIST_TOP + ROWS_PER_PAGE * ROW_H + 18
/** The Runes tab's left side: the socketed items over the pouch, each paged. */
const RUNE_ITEM_ROWS = 5
const RUNE_ITEM_PAGE_Y = LIST_TOP + RUNE_ITEM_ROWS * ROW_H + 14
const POUCH_TITLE_Y = RUNE_ITEM_PAGE_Y + 22
const POUCH_TOP = POUCH_TITLE_Y + 12
const POUCH_ROWS = 4
const SOCKET_H = 30
const OPTIONS_X = 420
const OPTIONS_W = FRAME_W - OPTIONS_X - 24
const OPTION_H = 20
const MESSAGE_Y = 440
const BUTTON_Y = 474

const FONT = 'monospace'
const GOLD = '#e8c766'
const DIM = '#8a7a5a'
const TEXT = '#d8c9a3'
const REFUSED = '#ffb74d'

type Tab = 'modify' | 'runes'

/**
 * Crafting: the workshop's screen, entered from the encampment, and the
 * field's, opened by the world map's Craft button, alike but for what they
 * make (crafting.ts decides, by where the party stands). The party's items
 * that a modifier fits are listed, member by member and then the baggage's;
 * a click on one lists the modifiers and grades on offer here with their
 * costs, a click on one of those shows what it changes, attacks a turn
 * included, and Work it confirms. A field craft passes the day, so the
 * screen closes and the map reports the day as it does after camping.
 * The Runes tab lists the items with a socket and the rune pouch: a click on
 * an item shows its sockets, with Extract for each rune; Embed and Fuse are
 * on each rune of the pouch; a click on an action previews it (runecraftView.ts
 * words it, runecraft.ts decides it), and Confirm does it. A field embed
 * passes the day and reports as a field craft does.
 */
export class CraftingScene extends Phaser.Scene {
  private gameState!: GameState
  private resumeTo: 'World' | null = null
  private tab: Tab = 'modify'
  private page = 0
  private pouchPage = 0
  private selected: string | null = null
  private chosen: string | null = null
  private message = ''
  private bg!: Phaser.GameObjects.Rectangle
  private frame!: Phaser.GameObjects.Container
  private controls: Partial<Record<keyof CraftingProbe['buttons'], { at: Rect; enabled: boolean }>> = {}
  private itemAt = new Map<string, Point>()
  private optionAt = new Map<string, { at: Point; enabled: boolean; label: string }>()
  private socketAt = new Map<number, { at: Point; enabled: boolean }>()
  private pouchAt = new Map<RuneKey, { row: Point; embed: { at: Point; enabled: boolean }; fuse: { at: Point; enabled: boolean } }>()
  /** The hover panel over a pouch row: what the rune does where it may sit. */
  private tip: Phaser.GameObjects.Container | null = null
  private tipLines: string[] = []
  /** What the Runes tab's item list says when it lists nothing. */
  private itemsHint = ''

  constructor() {
    super('Crafting')
  }

  preload(): void {
    for (const key of [...Object.values(ITEM_ICON_KEYS), ...Object.values(RUNE_ICON_KEYS), ...Object.values(SOCKET_PIP_KEYS)]) {
      this.load.image(key, `assets/sprites/${key}.png`)
    }
  }

  create(data: CraftingData): void {
    this.gameState = data.game
    this.resumeTo = data.resume ?? null
    this.tab = 'modify'
    this.page = 0
    this.pouchPage = 0
    this.selected = null
    this.chosen = null
    this.message = ''
    this.bg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0).setInteractive()
    this.frame = this.add.container(0, 0)
    this.render()
    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this))
    this.input.keyboard?.on('keydown-ESC', () => (this.selected || this.chosen ? this.select(null) : this.close()))
  }

  /** What the in-browser tests see of the crafting screen; see testHook.ts. */
  probe(): CraftingProbe {
    const { x, y, scale } = this.frame
    const onScreen = (at: Point) => ({ x: x + at.x * scale, y: y + at.y * scale })
    const control = (key: keyof CraftingProbe['buttons']): ButtonProbe => {
      const shown = this.controls[key]
      return { ...onScreen(shown?.at ?? { x: 0, y: 0 }), visible: !!shown, enabled: !!shown?.enabled }
    }
    const shown = (at: { at: Point; enabled: boolean } | undefined): ButtonProbe => ({ ...onScreen(at?.at ?? { x: 0, y: 0 }), visible: !!at, enabled: !!at?.enabled })
    const runes = this.tab === 'runes'
    const option = this.currentOptions().find((o) => optionKey(o) === this.chosen)
    const item = this.selectedPlace()
    const action = runes && this.chosen ? parseActionId(this.chosen) : null
    const listed = runes
      ? socketables(this.gameState).map(({ place, item }) => ({ place, item, refusal: null }))
      : craftables(this.gameState)
    const runeItem = runes && item ? itemAt(this.gameState, item) : null
    return {
      tier: craftTier(this.gameState.world, leader(this.gameState)),
      tab: this.tab,
      message: this.message,
      itemsHint: this.itemsHint,
      tooltip: this.tipLines,
      selected: this.selected,
      chosen: this.chosen,
      preview: action ? this.runePreview(action) : option && item ? this.preview(item, option) : [],
      items: listed.map(({ place, item, refusal }) => {
        const at = this.itemAt.get(placeKey(place))
        return { ...onScreen(at ?? { x: 0, y: 0 }), visible: !!at, enabled: !!at && refusal === null, id: placeKey(place), itemId: item.id }
      }),
      options: [...this.optionAt].map(([id, { at, enabled, label }]) => ({ ...onScreen(at), visible: true, enabled, id, label })),
      sockets: runeItem ? socketRows(runeItem).map(({ index, rune }) => ({ ...shown(this.socketAt.get(index)), index, rune })) : [],
      pouch: runes
        ? pouchRows(this.gameState).map(({ key, count }) => {
            const at = this.pouchAt.get(key)
            const row = at ? { ...onScreen(at.row), visible: true, enabled: true } : { x: 0, y: 0, visible: false, enabled: false }
            return { key, count, row, embed: shown(at?.embed), fuse: shown(at?.fuse) }
          })
        : [],
      buttons: {
        work: control('work'),
        confirm: control('confirm'),
        modifyTab: control('modifyTab'),
        runesTab: control('runesTab'),
        prev: control('prev'),
        next: control('next'),
        pouchPrev: control('pouchPrev'),
        pouchNext: control('pouchNext'),
        close: control('close'),
      },
    }
  }

  // ---- what is shown -----------------------------------------------------------

  /** The item clicked, among the tab's list: what can be worked, or what has a socket. */
  private selectedPlace(): ItemPlace | null {
    const listed = this.tab === 'runes' ? socketables(this.gameState) : craftables(this.gameState)
    return listed.find(({ place }) => placeKey(place) === this.selected)?.place ?? null
  }

  /** The preview of a rune action, its refusal last. */
  private runePreview(action: RuneAction): string[] {
    const place = this.selectedPlace()
    const refusal = actionRefusal(this.gameState, place, action)
    return [...actionPreview(this.gameState, place, action), ...(refusal ? [refusal] : [])]
  }

  private currentOptions(): CraftOption[] {
    const place = this.tab === 'modify' ? this.selectedPlace() : null
    return place ? options(this.gameState, place) : []
  }

  /** The AP of whoever holds the item at `place`, which tells its attacks a turn. */
  private apAt(place: ItemPlace): number {
    return place.from === 'baggage' ? TYPICAL_AP : deriveCombatStats(leader(this.gameState).members[place.member]).actionPoints
  }

  /** The strength of whoever holds the item at `place`, which tells its shortfall; none for the baggage. */
  private strengthAt(place: ItemPlace): number | undefined {
    return place.from === 'baggage' ? undefined : attributeLevel(leader(this.gameState).members[place.member], 'strength')
  }

  /** What working the item at `place` with `option` changes, and what it costs. */
  private preview(place: ItemPlace, option: CraftOption): string[] {
    const item = itemAt(this.gameState, place)!
    const lines = compareLines(item, option.result, this.apAt(place), this.strengthAt(place))
    const replaces = item.mod ? [`Replaces ${MODIFIERS[item.mod.id].name} (${gradeNumeral(item.mod.grade)}).`] : []
    const time = craftTier(this.gameState.world, leader(this.gameState)) === 'field' ? ' and a day' : ''
    const does = `${option.modifier.name} ${gradeNumeral(option.grade)}: ${option.modifier.better(option.grade)}, ${option.modifier.worse(option.grade)}.`
    return [does, `Makes the ${option.result.name}.`, ...replaces, ...lines, `Costs ${describeCost(option.cost)}${time}.`]
  }

  /** Where an item lies, in words: "Aldric, Weapon (worn)", "Brenna's pack", "baggage". */
  private whereIs(place: ItemPlace): string {
    if (place.from === 'baggage') return 'baggage'
    const name = leader(this.gameState).members[place.member].name
    return place.from === 'worn' ? `${name}, ${EQUIPMENT_SLOT_LABELS[place.slot].toLowerCase()}` : `${name}'s pack`
  }

  // ---- build -----------------------------------------------------------------

  private render(): void {
    this.frame.removeAll(true)
    this.controls = {}
    this.itemAt = new Map()
    this.optionAt = new Map()
    this.socketAt = new Map()
    this.pouchAt = new Map()
    this.tip = null
    this.tipLines = []
    this.itemsHint = ''
    const { world } = this.gameState
    const tier = craftTier(world, leader(this.gameState))
    const title = tier === 'field' ? 'Field Crafting' : 'Workshop'
    const about =
      tier === 'field'
        ? fieldCraftSummary()
        : `Level ${tier}: modifiers up to grade ${gradeNumeral(highestGrade(tier))}, at once.`
    const stock = (['gold', 'iron', 'timber', 'copper', 'crystal'] as const).map((m) => `${world.stock[m] ?? 0} ${m}`).join(', ')
    this.frame.add([
      this.add.rectangle(CENTRE_X, FRAME_H / 2, FRAME_W, FRAME_H, 0x241d15, 0.98).setStrokeStyle(3, 0xc9a227),
      this.add.text(CENTRE_X, TITLE_Y, title, { fontFamily: FONT, fontSize: '28px', color: GOLD, fontStyle: 'bold' }).setOrigin(0.5),
      this.add.text(CENTRE_X, TITLE_Y + 26, about, { fontFamily: FONT, fontSize: '12px', color: DIM }).setOrigin(0.5),
      this.add.text(CENTRE_X, TITLE_Y + 42, `Stock: ${stock}`, { fontFamily: FONT, fontSize: '12px', color: DIM }).setOrigin(0.5),
      this.add
        .text(CENTRE_X, MESSAGE_Y, this.message, { fontFamily: FONT, fontSize: '13px', color: TEXT, align: 'center', wordWrap: { width: FRAME_W - 40 } })
        .setOrigin(0.5),
    ])
    this.button('modifyTab', { x: 140, y: TAB_Y, width: 120, height: 28 }, 'Modify', () => this.show('modify'), true, this.tab === 'modify')
    this.button('runesTab', { x: 280, y: TAB_Y, width: 120, height: 28 }, 'Runes', () => this.show('runes'), true, this.tab === 'runes')
    if (this.tab === 'runes') this.renderRunes()
    else this.renderModify()
    this.button('close', { x: CENTRE_X, y: BUTTON_Y, width: 160, height: 36 }, 'Close', () => this.close())
  }

  /** The Modify tab: the items a modifier fits, and the modifiers on offer for the one clicked. */
  private renderModify(): void {
    const items = craftables(this.gameState)
    const pages = Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE))
    this.page = Math.min(this.page, pages - 1)
    items.slice(this.page * ROWS_PER_PAGE, (this.page + 1) * ROWS_PER_PAGE).forEach(({ place, item, refusal }, i) =>
      this.drawItem(place, item, refusal, LIST_TOP + i * ROW_H),
    )
    if (items.length === 0) {
      this.frame.add(this.add.text(LIST_X + 8, LIST_TOP, 'The party carries nothing that can be worked.', { fontFamily: FONT, fontSize: '13px', color: DIM }))
    }
    if (pages > 1) {
      this.button('prev', { x: LIST_X + 60, y: PAGE_Y, width: 100, height: 26 }, 'Prev', () => this.turnPage(-1), this.page > 0)
      this.frame.add(this.add.text(LIST_X + LIST_W / 2, PAGE_Y, `Page ${this.page + 1} of ${pages}`, { fontFamily: FONT, fontSize: '12px', color: DIM }).setOrigin(0.5))
      this.button('next', { x: LIST_X + LIST_W - 60, y: PAGE_Y, width: 100, height: 26 }, 'Next', () => this.turnPage(1), this.page < pages - 1)
    }
    this.drawOptions()
  }

  /** The Runes tab: the items with a socket over the pouch, on the left; the sockets of the one clicked and the action's preview, on the right. */
  private renderRunes(): void {
    const items = socketables(this.gameState)
    const pages = Math.max(1, Math.ceil(items.length / RUNE_ITEM_ROWS))
    this.page = Math.min(this.page, pages - 1)
    items.slice(this.page * RUNE_ITEM_ROWS, (this.page + 1) * RUNE_ITEM_ROWS).forEach(({ place, item }, i) => this.drawItem(place, item, null, LIST_TOP + i * ROW_H))
    if (items.length === 0) {
      // Not a dead end: which gear has sockets, as socketsOf decides.
      this.itemsHint = noSocketsHint()
      this.frame.add(this.add.text(LIST_X + 8, LIST_TOP, this.itemsHint, { fontFamily: FONT, fontSize: '12px', color: DIM, wordWrap: { width: LIST_W - 16 }, lineSpacing: 3 }))
    }
    if (pages > 1) this.pager('prev', 'next', RUNE_ITEM_PAGE_Y, this.page, pages, (by) => this.turnPage(by))
    this.drawPouch()
    this.drawSockets()
  }

  /** Prev, "Page n of m" and Next under a list. */
  private pager(prev: 'prev' | 'pouchPrev', next: 'next' | 'pouchNext', y: number, page: number, pages: number, turn: (by: number) => void): void {
    this.button(prev, { x: LIST_X + 60, y, width: 100, height: 22 }, 'Prev', () => turn(-1), page > 0)
    this.frame.add(this.add.text(LIST_X + LIST_W / 2, y, `Page ${page + 1} of ${pages}`, { fontFamily: FONT, fontSize: '12px', color: DIM }).setOrigin(0.5))
    this.button(next, { x: LIST_X + LIST_W - 60, y, width: 100, height: 22 }, 'Next', () => turn(1), page < pages - 1)
  }

  /** The pouch: a line a rune held, its count, and Embed (into the item clicked) and Fuse, each greyed when refused. */
  private drawPouch(): void {
    const rows = pouchRows(this.gameState)
    const pages = Math.max(1, Math.ceil(rows.length / POUCH_ROWS))
    this.pouchPage = Math.min(this.pouchPage, pages - 1)
    this.frame.add(this.add.text(LIST_X, POUCH_TITLE_Y, 'Rune pouch', { fontFamily: FONT, fontSize: '12px', color: GOLD }).setOrigin(0, 0.5))
    if (rows.length === 0) {
      this.frame.add(this.add.text(LIST_X + 8, POUCH_TOP + 4, 'The pouch is empty: runes are found after battles and sold at the trading post.', { fontFamily: FONT, fontSize: '11px', color: DIM, wordWrap: { width: LIST_W - 16 } }))
      return
    }
    const place = this.selectedPlace()
    rows.slice(this.pouchPage * POUCH_ROWS, (this.pouchPage + 1) * POUCH_ROWS).forEach(({ key, count, name }, i) => {
      const y = POUCH_TOP + i * ROW_H + ROW_H / 2
      const { id } = parseRuneKey(key)!
      const back = this.add.rectangle(LIST_X + LIST_W / 2, y, LIST_W, ROW_H - 2, 0x1b1712, 0.95).setStrokeStyle(1, 0x3a3024)
      // Hovering the row tells what the rune does in a weapon, armour and a shield, and where it goes.
      back.setInteractive()
      back.on('pointerover', () => this.showTip([name, ...runeEffectLines(key), runeSocketLine()], y))
      back.on('pointerout', () => this.hideTip())
      this.frame.add([
        back,
        this.add.image(LIST_X + 12, y, RUNE_ICON_KEYS[id]),
        this.add.text(LIST_X + 26, y, `${count} × ${name}`, { fontFamily: FONT, fontSize: '11px', color: TEXT }).setOrigin(0, 0.5),
      ])
      const embedAction: RuneAction = { kind: 'embed', key }
      const fuseAction: RuneAction = { kind: 'fuse', key }
      const embedAt = { x: LIST_X + LIST_W - 100, y, width: 64, height: ROW_H - 6 }
      const fuseAt = { x: LIST_X + LIST_W - 34, y, width: 60, height: ROW_H - 6 }
      const embedOk = actionRefusal(this.gameState, place, embedAction) === null
      const fuseOk = actionRefusal(this.gameState, place, fuseAction) === null
      this.pouchAt.set(key, { row: { x: LIST_X + 120, y }, embed: { at: embedAt, enabled: embedOk }, fuse: { at: fuseAt, enabled: fuseOk } })
      this.actionButton(embedAt, 'Embed', embedAction, embedOk)
      this.actionButton(fuseAt, 'Fuse', fuseAction, fuseOk)
    })
    if (pages > 1) this.pager('pouchPrev', 'pouchNext', PAGE_Y, this.pouchPage, pages, (by) => this.turnPouchPage(by))
  }

  /** The item clicked: its sockets, each filled one with what its rune does and Extract; then the preview of the action chosen, and Confirm. */
  private drawSockets(): void {
    const style = { fontFamily: FONT, fontSize: '12px', color: TEXT, wordWrap: { width: OPTIONS_W } }
    const place = this.selectedPlace()
    const item = place && itemAt(this.gameState, place)
    let y = LIST_TOP
    if (!place || !item) {
      const hint = this.add.text(OPTIONS_X, y, 'Click an item to see its sockets. Fusing runes needs no item.', { ...style, color: DIM })
      this.frame.add(hint)
      y += hint.height + 10
    } else {
      const name = this.add.text(OPTIONS_X, y, item.name, { ...style, color: GOLD })
      this.frame.add(name)
      y += name.height + 6
      for (const socket of socketRows(item)) {
        const centre = y + 9
        if (socket.rune) {
          const { id } = parseRuneKey(socket.rune)!
          const action: RuneAction = { kind: 'extract', index: socket.index }
          const ok = actionRefusal(this.gameState, place, action) === null
          const at = { x: OPTIONS_X + OPTIONS_W - 36, y: centre, width: 72, height: 20 }
          this.socketAt.set(socket.index, { at, enabled: ok })
          const effect = this.add.text(OPTIONS_X + 22, centre + 10, socket.effect!, { fontFamily: FONT, fontSize: '10px', color: DIM, wordWrap: { width: OPTIONS_W - 104 } })
          this.frame.add([
            this.add.image(OPTIONS_X + 8, centre, RUNE_ICON_KEYS[id]),
            this.add.text(OPTIONS_X + 22, centre, socket.label, { fontFamily: FONT, fontSize: '12px', color: cssColour(RUNE_COLOURS[id]) }).setOrigin(0, 0.5),
            effect,
          ])
          this.actionButton(at, 'Extract', action, ok)
          // A long effect wraps, and the next socket goes under it.
          y = Math.max(y + SOCKET_H, effect.y + effect.height + 6)
          continue
        } else {
          this.frame.add([
            this.add.image(OPTIONS_X + 8, centre, SOCKET_PIP_KEYS.empty).setScale(2),
            this.add.text(OPTIONS_X + 22, centre, socket.label, { fontFamily: FONT, fontSize: '12px', color: DIM }).setOrigin(0, 0.5),
          ])
        }
        y += SOCKET_H
      }
    }
    const action = this.chosen ? parseActionId(this.chosen) : null
    if (!action) {
      this.frame.add(this.add.text(OPTIONS_X, y, 'Click Embed, Extract or Fuse to see what it does and costs.', { ...style, fontSize: '11px', color: DIM }))
      return
    }
    const refusal = actionRefusal(this.gameState, place, action)
    this.frame.add(this.add.text(OPTIONS_X, y, actionPreview(this.gameState, place, action).join('\n'), { ...style, fontSize: '11px', lineSpacing: 3 }))
    if (refusal) this.frame.add(this.add.text(OPTIONS_X, PAGE_Y - 18, refusal, { ...style, fontSize: '11px', color: REFUSED }).setOrigin(0, 1))
    const label = { embed: 'Embed', extract: 'Extract', fuse: 'Fuse' }[action.kind]
    this.button('confirm', { x: OPTIONS_X + OPTIONS_W / 2, y: PAGE_Y, width: OPTIONS_W, height: 26 }, `${label}: confirm`, () => this.onRune(action), refusal === null)
  }

  /** The hover panel beside a pouch row at `y`, over the right side: the rune's name, then what it does. */
  private showTip(lines: string[], y: number): void {
    this.hideTip()
    const pad = 8
    const text = this.add.text(OPTIONS_X + pad, y, lines.join('\n'), {
      fontFamily: FONT,
      fontSize: '11px',
      color: TEXT,
      lineSpacing: 3,
      wordWrap: { width: OPTIONS_W - 2 * pad },
    })
    // Kept within the frame: a low row's panel opens upward.
    const top = Math.min(y - 10, FRAME_H - text.height - 2 * pad - 8)
    text.setY(top + pad)
    const back = this.add.rectangle(OPTIONS_X, top, OPTIONS_W, text.height + 2 * pad, 0x14110d, 0.98).setOrigin(0).setStrokeStyle(1, 0xc9a227)
    this.tip = this.add.container(0, 0, [back, text])
    this.frame.add(this.tip)
    this.tipLines = lines
  }

  private hideTip(): void {
    this.tip?.destroy()
    this.tip = null
    this.tipLines = []
  }

  /** A rune action's button: a click shows its preview; one refused now is greyed, but still shows why. */
  private actionButton(at: Rect, label: string, action: RuneAction, ok: boolean): void {
    const id = actionId(action)
    addPanelButton(this, this.frame, at, label, () => this.time.delayedCall(0, () => this.choose(id)), { marked: id === this.chosen, dimmed: !ok, fontSize: 11 })
  }

  /** A line of the item list: its icon, name and where it lies; one nothing here fits is greyed, saying why. */
  private drawItem(place: ItemPlace, item: Item, refusal: string | null, y: number): void {
    const key = placeKey(place)
    const marked = key === this.selected
    const centre = { x: LIST_X + LIST_W / 2, y: y + ROW_H / 2 }
    this.itemAt.set(key, centre)
    const back = this.add.rectangle(centre.x, centre.y, LIST_W, ROW_H - 2, marked ? 0x3a2f1c : 0x1b1712, 0.95).setStrokeStyle(1, marked ? 0xc9a227 : 0x3a3024)
    this.frame.add(back)
    if (refusal === null) {
      back.setInteractive({ useHandCursor: true })
      back.on('pointerover', () => !marked && back.setFillStyle(0x2c2418, 0.95))
      back.on('pointerout', () => !marked && back.setFillStyle(0x1b1712, 0.95))
      back.on('pointerdown', () => {
        this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
        this.time.delayedCall(0, () => this.select(key))
      })
    }
    const icon = this.add.image(LIST_X + 12, centre.y, ITEM_ICON_KEYS[item.icon]).setAlpha(refusal ? 0.4 : 1)
    const tint = iconTint(item)
    if (tint !== undefined) icon.setTint(tint)
    const where = this.add
      .text(LIST_X + LIST_W - 6, centre.y, refusal ?? this.whereIs(place), { fontFamily: FONT, fontSize: '10px', color: refusal ? REFUSED : DIM })
      .setOrigin(1, 0.5)
    const name = this.add.text(LIST_X + 26, centre.y, item.name, { fontFamily: FONT, fontSize: '11px', color: refusal ? DIM : marked ? GOLD : TEXT }).setOrigin(0, 0.5)
    // A long name (a runed item's) is cut short of where the item lies, rather than run over it.
    fitText(name, LIST_W - 26 - where.width - 16)
    this.frame.add([icon, ...createPips(this, item, LIST_X + 12, centre.y, 1), name, where])
  }

  /** The modifiers on offer for the item clicked, each a button; the preview of the one chosen; Work it. */
  private drawOptions(): void {
    const style = { fontFamily: FONT, fontSize: '12px', color: TEXT, wordWrap: { width: OPTIONS_W } }
    const place = this.selectedPlace()
    if (!place) {
      this.frame.add(this.add.text(OPTIONS_X, LIST_TOP, 'Click an item to see what can be made of it here.', { ...style, color: DIM }))
      return
    }
    const all = this.currentOptions()
    all.forEach((option, i) => {
      const key = optionKey(option)
      const at: Rect = { x: OPTIONS_X + OPTIONS_W / 2, y: LIST_TOP + i * OPTION_H + OPTION_H / 2, width: OPTIONS_W, height: OPTION_H - 2 }
      // The name alone, which fits its button however long the modifier's words; the preview says what it does.
      const label = `${option.modifier.name} ${gradeNumeral(option.grade)}`
      this.optionAt.set(key, { at, enabled: true, label })
      addPanelButton(this, this.frame, at, label, () => this.time.delayedCall(0, () => this.choose(key)), { marked: key === this.chosen, fontSize: 11 })
    })
    const option = all.find((o) => optionKey(o) === this.chosen)
    const previewY = LIST_TOP + all.length * OPTION_H + 10
    if (!option) {
      this.frame.add(this.add.text(OPTIONS_X, previewY, 'Click a modifier to see what it changes.', { ...style, color: DIM }))
      return
    }
    this.frame.add(this.add.text(OPTIONS_X, previewY, this.preview(place, option).join('\n'), { ...style, fontSize: '11px', lineSpacing: 3 }))
    if (option.refusal) this.frame.add(this.add.text(OPTIONS_X, PAGE_Y - 22, option.refusal, { ...style, fontSize: '11px', color: REFUSED }).setOrigin(0, 1))
    this.button('work', { x: OPTIONS_X + OPTIONS_W / 2, y: PAGE_Y, width: OPTIONS_W, height: 30 }, 'Work it', () => this.onWork(place, option), option.refusal === null)
  }

  private button(key: keyof CraftingProbe['buttons'], at: Rect, label: string, onClick: () => void, enabled = true, marked = false): void {
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

  /** Another tab: nothing selected, no message, the first pages. */
  private show(tab: Tab): void {
    this.tab = tab
    this.page = 0
    this.pouchPage = 0
    this.select(null)
  }

  private select(key: string | null): void {
    this.selected = key
    this.chosen = null
    this.message = ''
    this.render()
  }

  /** Another action or modifier previewed: the message of the last one done is cleared, as it no longer speaks to what is shown. */
  private choose(key: string): void {
    this.chosen = key
    this.message = ''
    this.render()
  }

  private turnPage(by: number): void {
    this.page += by
    this.render()
  }

  private turnPouchPage(by: number): void {
    this.pouchPage += by
    this.render()
  }

  /** Does the rune action chosen; a field embed passes the day, and the map takes over to report it, as a field craft does. */
  private onRune(action: RuneAction): void {
    const game = this.gameState
    const place = this.selectedPlace()
    const field = craftTier(game.world, leader(game)) === 'field'
    if (action.kind === 'fuse') {
      const refusal = fuse(game, action.key)
      this.message = refusal ?? doneMessage(action)
      if (!refusal) this.chosen = null
      this.render()
      return
    }
    if (!place) return
    const rune = action.kind === 'extract' ? itemAt(game, place)?.runes?.[action.index] : action.key
    const result = action.kind === 'embed' ? embed(game, place, action.key) : extract(game, place, action.index)
    if (result.refusal !== null) {
      this.message = result.refusal
      this.render()
      return
    }
    if (field && action.kind === 'embed' && this.resumeTo) {
      this.close({ crafted: { item: result.item.name, events: result.events } })
      return
    }
    this.message = doneMessage(action, result.item, rune)
    // The item is where the old one was, under a new id: keep it selected.
    this.selected = placeKey({ ...place, itemId: result.item.id })
    this.chosen = null
    this.render()
  }

  /** Works the item; in the field the day passes, and the map takes over to report it. */
  private onWork(place: ItemPlace, option: CraftOption): void {
    const field = craftTier(this.gameState.world, leader(this.gameState)) === 'field'
    const result = craft(this.gameState, place, option.modifier.id, option.grade)
    if (result.refusal !== null) {
      this.message = result.refusal
      this.render()
      return
    }
    if (field && this.resumeTo) {
      this.close({ crafted: { item: result.item.name, events: result.events } })
      return
    }
    this.message = `Made the ${result.item.name}.`
    // The item is where the old one was, under a new id: keep it selected.
    this.selected = placeKey({ ...place, itemId: result.item.id })
    this.chosen = null
    this.render()
  }

  /** Back to the world map it was opened from, or to the encampment, the workshop's details showing. */
  private close(crafted?: CraftedData): void {
    if (this.resumeTo) {
      this.scene.stop()
      this.scene.resume(this.resumeTo, crafted)
      return
    }
    this.scene.start('Encampment', { game: this.gameState, select: 'workshop' })
    this.scene.bringToTop('Encampment')
  }
}

const optionKey = (option: CraftOption): string => `${option.modifier.id}${option.grade}`

