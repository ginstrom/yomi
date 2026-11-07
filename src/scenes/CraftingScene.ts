import Phaser from 'phaser'
import { deriveCombatStats } from '../character/character.ts'
import { attributeLevel } from '../character/perks.ts'
import type { WorldEvent } from '../game/blight.ts'
import { describeCost } from '../game/buildings.ts'
import { craft, craftTier, craftables, highestGrade, options, type CraftOption } from '../game/crafting.ts'
import type { GameState } from '../game/gameState.ts'
import { itemAt, placeKey, type ItemPlace } from '../game/itemPlace.ts'
import { gradeNumeral } from '../inventory/grades.ts'
import { EQUIPMENT_SLOT_LABELS, type Item } from '../inventory/inventory.ts'
import { MODIFIERS } from '../inventory/modifiers.ts'
import type { ButtonProbe, CraftingProbe } from '../testHook.ts'
import { soundVolume } from './audioSettings.ts'
import type { Point } from './boardGeometry.ts'
import { TYPICAL_AP, compareLines, fieldCraftSummary } from './gearCompare.ts'
import { ITEM_ICON_KEYS, iconTint } from './itemIcons.ts'
import type { Rect } from './mapScroll.ts'
import { addPanelButton } from './panelButton.ts'

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
const LIST_X = 24
const LIST_W = 380
const LIST_TOP = 100
const ROW_H = 24
const ROWS_PER_PAGE = 12
const PAGE_Y = LIST_TOP + ROWS_PER_PAGE * ROW_H + 18
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

/**
 * Crafting: the workshop's screen, entered from the encampment, and the
 * field's, opened by the world map's Craft button, alike but for what they
 * make (crafting.ts decides, by where the party stands). The party's items
 * that a modifier fits are listed, member by member and then the baggage's;
 * a click on one lists the modifiers and grades on offer here with their
 * costs, a click on one of those shows what it changes, attacks a turn
 * included, and Work it confirms. A field craft passes the day, so the
 * screen closes and the map reports the day as it does after camping.
 */
export class CraftingScene extends Phaser.Scene {
  private gameState!: GameState
  private resumeTo: 'World' | null = null
  private page = 0
  private selected: string | null = null
  private chosen: string | null = null
  private message = ''
  private bg!: Phaser.GameObjects.Rectangle
  private frame!: Phaser.GameObjects.Container
  private controls: Partial<Record<keyof CraftingProbe['buttons'], { at: Rect; enabled: boolean }>> = {}
  private itemAt = new Map<string, Point>()
  private optionAt = new Map<string, { at: Point; enabled: boolean }>()

  constructor() {
    super('Crafting')
  }

  preload(): void {
    for (const key of Object.values(ITEM_ICON_KEYS)) this.load.image(key, `assets/sprites/${key}.png`)
  }

  create(data: CraftingData): void {
    this.gameState = data.game
    this.resumeTo = data.resume ?? null
    this.page = 0
    this.selected = null
    this.chosen = null
    this.message = ''
    this.bg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0).setInteractive()
    this.frame = this.add.container(0, 0)
    this.render()
    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this))
    this.input.keyboard?.on('keydown-ESC', () => (this.selected ? this.select(null) : this.close()))
  }

  /** What the in-browser tests see of the crafting screen; see testHook.ts. */
  probe(): CraftingProbe {
    const { x, y, scale } = this.frame
    const onScreen = (at: Point) => ({ x: x + at.x * scale, y: y + at.y * scale })
    const control = (key: keyof CraftingProbe['buttons']): ButtonProbe => {
      const shown = this.controls[key]
      return { ...onScreen(shown?.at ?? { x: 0, y: 0 }), visible: !!shown, enabled: !!shown?.enabled }
    }
    const option = this.currentOptions().find((o) => optionKey(o) === this.chosen)
    const item = this.selectedPlace()
    return {
      tier: craftTier(this.gameState.world),
      message: this.message,
      selected: this.selected,
      chosen: this.chosen,
      preview: option && item ? this.preview(item, option) : [],
      items: craftables(this.gameState).map(({ place, item, refusal }) => {
        const at = this.itemAt.get(placeKey(place))
        return { ...onScreen(at ?? { x: 0, y: 0 }), visible: !!at, enabled: !!at && refusal === null, id: placeKey(place), itemId: item.id }
      }),
      options: [...this.optionAt].map(([id, { at, enabled }]) => ({ ...onScreen(at), visible: true, enabled, id })),
      buttons: { work: control('work'), prev: control('prev'), next: control('next'), close: control('close') },
    }
  }

  // ---- what is shown -----------------------------------------------------------

  private selectedPlace(): ItemPlace | null {
    return craftables(this.gameState).find(({ place }) => placeKey(place) === this.selected)?.place ?? null
  }

  private currentOptions(): CraftOption[] {
    const place = this.selectedPlace()
    return place ? options(this.gameState, place) : []
  }

  /** The AP of whoever holds the item at `place`, which tells its attacks a turn. */
  private apAt(place: ItemPlace): number {
    return place.from === 'baggage' ? TYPICAL_AP : deriveCombatStats(this.gameState.party[place.member]).actionPoints
  }

  /** The strength of whoever holds the item at `place`, which tells its shortfall; none for the baggage. */
  private strengthAt(place: ItemPlace): number | undefined {
    return place.from === 'baggage' ? undefined : attributeLevel(this.gameState.party[place.member], 'strength')
  }

  /** What working the item at `place` with `option` changes, and what it costs. */
  private preview(place: ItemPlace, option: CraftOption): string[] {
    const item = itemAt(this.gameState, place)!
    const lines = compareLines(item, option.result, this.apAt(place), this.strengthAt(place))
    const replaces = item.mod ? [`Replaces ${MODIFIERS[item.mod.id].name} (${gradeNumeral(item.mod.grade)}).`] : []
    const time = craftTier(this.gameState.world) === 'field' ? ' and a day' : ''
    return [`Makes the ${option.result.name}.`, ...replaces, ...lines, `Costs ${describeCost(option.cost)}${time}.`]
  }

  /** Where an item lies, in words: "Aldric, Weapon (worn)", "Brenna's pack", "baggage". */
  private whereIs(place: ItemPlace): string {
    if (place.from === 'baggage') return 'baggage'
    const name = this.gameState.party[place.member].name
    return place.from === 'worn' ? `${name}, ${EQUIPMENT_SLOT_LABELS[place.slot].toLowerCase()}` : `${name}'s pack`
  }

  // ---- build -----------------------------------------------------------------

  private render(): void {
    this.frame.removeAll(true)
    this.controls = {}
    this.itemAt = new Map()
    this.optionAt = new Map()
    const { world } = this.gameState
    const tier = craftTier(world)
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
    this.button('close', { x: CENTRE_X, y: BUTTON_Y, width: 160, height: 36 }, 'Close', () => this.close())
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
    this.frame.add([
      icon,
      this.add.text(LIST_X + 26, centre.y, item.name, { fontFamily: FONT, fontSize: '11px', color: refusal ? DIM : marked ? GOLD : TEXT }).setOrigin(0, 0.5),
      this.add
        .text(LIST_X + LIST_W - 6, centre.y, refusal ?? this.whereIs(place), { fontFamily: FONT, fontSize: '10px', color: refusal ? REFUSED : DIM })
        .setOrigin(1, 0.5),
    ])
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
      const label = `${option.modifier.name} ${gradeNumeral(option.grade)}: ${option.modifier.better(option.grade)}, ${option.modifier.worse(option.grade)}`
      this.optionAt.set(key, { at, enabled: true })
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

  private button(key: keyof CraftingProbe['buttons'], at: Rect, label: string, onClick: () => void, enabled = true): void {
    this.controls[key] = { at, enabled }
    // Next tick: the redraw a click leads to destroys the button whose handler this runs in.
    addPanelButton(this, this.frame, at, label, () => this.time.delayedCall(0, onClick), { enabled, fontSize: 13 })
  }

  private layout(): void {
    const { width, height } = this.scale
    this.bg.setSize(width, height)
    const scale = Math.max(0, Math.min(1, (width - 32) / FRAME_W, (height - 32) / FRAME_H))
    this.frame.setScale(scale).setPosition((width - FRAME_W * scale) / 2, (height - FRAME_H * scale) / 2)
  }

  // ---- actions ---------------------------------------------------------------

  private select(key: string | null): void {
    this.selected = key
    this.chosen = null
    this.message = ''
    this.render()
  }

  private choose(key: string): void {
    this.chosen = key
    this.render()
  }

  private turnPage(by: number): void {
    this.page += by
    this.render()
  }

  /** Works the item; in the field the day passes, and the map takes over to report it. */
  private onWork(place: ItemPlace, option: CraftOption): void {
    const field = craftTier(this.gameState.world) === 'field'
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
