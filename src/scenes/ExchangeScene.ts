import Phaser from 'phaser'
import { canAdvance } from '../character/progression.ts'
import type { Character } from '../character/character.ts'
import type { Expedition } from '../game/expedition.ts'
import { partyById, selectedParty, type GameState } from '../game/gameState.ts'
import type { ButtonProbe, ExchangeProbe } from '../testHook.ts'
import { soundVolume } from './audioSettings.ts'
import type { Point } from './boardGeometry.ts'
import { exchangeMove, exchangePartners, heroNote, itemMove, baggageLines, tryExchange, type ExchangePick } from './exchangeView.ts'
import { ITEM_ICON_KEYS, RUNE_ICON_KEYS, SOCKET_PIP_KEYS, iconTint } from './itemIcons.ts'
import type { Rect } from './mapScroll.ts'
import { addPanelButton, fitText } from './panelButton.ts'
import { PartyColumn } from './PartyColumn.ts'
import { BANNER_SPRITES, bannerOf } from './partyList.ts'
import { PORTRAIT_SCALE, PORTRAIT_SIZE, portraitKey } from './partyPanel.ts'
import { createPips } from './socketPips.ts'
import { SPRITE_ATLAS, spriteAnim, spriteFrame } from './unitLook.ts'

interface ExchangeData {
  game: GameState
  /** The id of the party that opened the exchange (the first if left out or unknown). */
  party?: string
  /** The party it trades with; the first other party on the hex if left out. */
  other?: string
}

const FRAME_W = 720
const FRAME_H = 560
const CENTRE_X = FRAME_W / 2
const FONT = 'monospace'
const GOLD = '#e8c766'
const DIM = '#8a7a5a'
const TEXT = '#d8c9a3'
const ROW_HEADER_Y = [70, 200] as const
const ROW_FACE_Y = [118, 248] as const
const FACE_X = 70
const FACE_PITCH = 100
const LIST_HEADER_Y = 340
const LIST_FIRST_Y = 364
const LINE_H = 22
const LINES = 5
const LIST_W = 330
const LIST_X = [20, 370] as const
const PAGE_Y = 478
const MESSAGE_Y = 508
const BUTTON_Y = 538
const HINT = 'Click a hero, then one of the other row to swap, or its heading to move it there. Click an item to pass it across.'

const faceAt = (row: 0 | 1, index: number): Point => ({ x: FACE_X + index * FACE_PITCH, y: ROW_FACE_Y[row] })
const headerAt = (row: 0 | 1): Point => ({ x: CENTRE_X, y: ROW_HEADER_Y[row] })
const lineAt = (row: 0 | 1, line: number): Point => ({ x: LIST_X[row] + LIST_W / 2, y: LIST_FIRST_Y + line * LINE_H })
const pageButton = (row: 0 | 1, next: boolean): Rect => ({ x: LIST_X[row] + LIST_W / 2 + (next ? 46 : -46), y: PAGE_Y, width: 44, height: 24 })

/**
 * Two parties on one hex trading heroes and baggage, over the paused world map
 * (opened from its footer and from the character panel). Two rows of faces,
 * picked and clicked as the guild hall's columns are, and the two baggages as
 * lists, a click on an item passing it to the other party. Every change is
 * `exchange`'s (company.ts), via exchangeView.ts; the scene decides nothing.
 * Closing resumes the map.
 */
export class ExchangeScene extends Phaser.Scene {
  private gameState!: GameState
  private parties!: [Expedition, Expedition]
  private selected: ExchangePick | null = null
  private message = ''
  private pages: [number, number] = [0, 0]
  private bg!: Phaser.GameObjects.Rectangle
  private frame!: Phaser.GameObjects.Container
  private controls: Partial<Record<'close' | 'other', { at: Rect; enabled: boolean }>> = {}
  private pageControls: Array<{ at: Rect; enabled: boolean }> = []

  constructor() {
    super('Exchange')
  }

  preload(): void {
    for (const key of [...Object.values(ITEM_ICON_KEYS), ...Object.values(RUNE_ICON_KEYS), ...Object.values(SOCKET_PIP_KEYS)]) {
      this.load.image(key, `assets/sprites/${key}.png`)
    }
    PartyColumn.preload(this)
  }

  create(data: ExchangeData): void {
    this.gameState = data.game
    const first = selectedParty(data.game, data.party)
    const partners = exchangePartners(data.game, first)
    const second = (data.other ? partyById(data.game, data.other) : undefined) ?? partners[0]
    // Opened with no one to trade with (it should not be): the party is its own partner, and every move refuses.
    this.parties = [first, second ?? first]
    this.selected = null
    this.message = ''
    this.pages = [0, 0]
    this.bg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0).setInteractive()
    this.frame = this.add.container(0, 0)
    this.render()
    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this))
    this.input.keyboard?.on('keydown-ESC', () => this.close())
  }

  /** What the in-browser tests see of the exchange; see testHook.ts. */
  probe(): ExchangeProbe {
    const { x, y, scale } = this.frame
    const onScreen = (at: Point) => ({ x: x + at.x * scale, y: y + at.y * scale })
    const control = (key: 'close' | 'other'): ButtonProbe => {
      const shown = this.controls[key]
      return { ...onScreen(shown?.at ?? { x: 0, y: 0 }), visible: !!shown, enabled: !!shown?.enabled }
    }
    const pageProbe = (i: number): ButtonProbe => {
      const shown = this.pageControls[i]
      return { ...onScreen(shown?.at ?? { x: 0, y: 0 }), visible: !!shown, enabled: !!shown?.enabled }
    }
    return {
      parties: [this.parties[0].id, this.parties[1].id],
      headers: [onScreen(headerAt(0)), onScreen(headerAt(1))],
      rows: this.parties.map((party, row) =>
        party.members.map((hero, index) => ({ ...onScreen(faceAt(row as 0 | 1, index)), visible: true, enabled: true, name: hero.name, level: hero.level })),
      ),
      baggage: this.parties.map((_, row) =>
        this.visibleLines(row as 0 | 1).map(({ id }, line) => ({ id, ...onScreen(lineAt(row as 0 | 1, line)) })),
      ),
      baggageCounts: [this.parties[0].baggage.length, this.parties[1].baggage.length],
      selected: this.selected,
      message: this.message,
      buttons: { close: control('close'), other: control('other'), prev: [pageProbe(0), pageProbe(2)], next: [pageProbe(1), pageProbe(3)] },
    }
  }

  // ---- build -----------------------------------------------------------------

  private render(): void {
    this.frame.removeAll(true)
    this.controls = {}
    this.pageControls = []
    this.frame.add([
      this.add.rectangle(CENTRE_X, FRAME_H / 2, FRAME_W, FRAME_H, 0x241d15, 0.98).setStrokeStyle(3, 0xc9a227),
      this.add.text(CENTRE_X, 32, 'Exchange', { fontFamily: FONT, fontSize: '28px', color: GOLD, fontStyle: 'bold' }).setOrigin(0.5),
      this.add.text(CENTRE_X, MESSAGE_Y, this.message || HINT, { fontFamily: FONT, fontSize: '12px', color: TEXT, align: 'center', wordWrap: { width: FRAME_W - 40 } }).setOrigin(0.5),
    ])
    for (const row of [0, 1] as const) {
      this.buildRow(row)
      this.buildList(row)
    }
    const others = exchangePartners(this.gameState, this.parties[0]).length
    this.button('other', { x: CENTRE_X - 100, y: BUTTON_Y, width: 170, height: 32 }, 'Other party', () => this.cycleOther(), others > 1)
    this.button('close', { x: CENTRE_X + 100, y: BUTTON_Y, width: 170, height: 32 }, 'Close', () => this.close())
  }

  private button(key: 'close' | 'other', at: Rect, label: string, onClick: () => void, enabled = true): void {
    this.controls[key] = { at, enabled }
    // Next tick: the redraw a click leads to destroys the button whose handler this runs in.
    addPanelButton(this, this.frame, at, label, () => this.time.delayedCall(0, onClick), { enabled })
  }

  private buildRow(row: 0 | 1): void {
    const party = this.parties[row]
    const head = headerAt(row)
    const picked = this.selected
    const box = this.add
      .rectangle(head.x, head.y, FRAME_W - 40, 26, 0x1b1712, 0.95)
      .setStrokeStyle(2, picked && picked.row !== row ? 0xc9a227 : 0x6b5a3a)
    if (picked && picked.row !== row) {
      box.setInteractive({ useHandCursor: true })
      box.on('pointerdown', () => {
        this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
        this.time.delayedCall(0, () => this.onHeader(row))
      })
    }
    const banner = BANNER_SPRITES[bannerOf(party.id)]
    const flag = this.add.sprite(46, head.y + 4, SPRITE_ATLAS, spriteFrame(banner, 'base')).setScale(1.2).play(spriteAnim(banner, 'idle'))
    this.frame.add([box, flag, this.add.text(head.x, head.y, `${party.name} (${party.members.length})`, { fontFamily: FONT, fontSize: '14px', color: TEXT }).setOrigin(0.5)])
    party.members.forEach((hero, index) => this.addFace(hero, faceAt(row, index), row, index))
  }

  private addFace(hero: Character, at: Point, row: 0 | 1, index: number): void {
    const selected = this.selected?.row === row && this.selected.index === index
    const rest = selected ? 0xe8c766 : 0x6b5a3a
    const edge = this.add.rectangle(at.x, at.y, PORTRAIT_SIZE, PORTRAIT_SIZE).setStrokeStyle(selected ? 3 : 2, rest).setInteractive({ useHandCursor: true })
    edge.on('pointerover', () => edge.setStrokeStyle(selected ? 3 : 2, 0xe8c766))
    edge.on('pointerout', () => edge.setStrokeStyle(selected ? 3 : 2, rest))
    edge.on('pointerdown', () => {
      this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
      this.time.delayedCall(0, () => this.onFace(row, index))
    })
    const name = this.add.text(at.x, at.y + PORTRAIT_SIZE / 2 + 4, hero.name, { fontFamily: FONT, fontSize: '13px', color: selected ? GOLD : TEXT }).setOrigin(0.5, 0)
    fitText(name, FACE_PITCH - 8)
    const note = [heroNote(hero), canAdvance(hero) ? '+' : ''].join(' ').trim()
    this.frame.add([
      this.add.image(at.x, at.y, portraitKey(hero.portrait)).setScale(PORTRAIT_SCALE),
      edge,
      name,
      this.add.text(at.x, at.y + PORTRAIT_SIZE / 2 + 20, note, { fontFamily: FONT, fontSize: '11px', color: DIM }).setOrigin(0.5, 0),
    ])
  }

  private visibleLines(row: 0 | 1): Array<{ id: string; name: string; index: number }> {
    return baggageLines(this.parties[row])
      .map((line, index) => ({ ...line, index }))
      .slice(this.pages[row] * LINES, (this.pages[row] + 1) * LINES)
  }

  private pageCount(row: 0 | 1): number {
    return Math.max(1, Math.ceil(this.parties[row].baggage.length / LINES))
  }

  private buildList(row: 0 | 1): void {
    const party = this.parties[row]
    const left = LIST_X[row]
    this.frame.add(this.add.text(left, LIST_HEADER_Y - 4, `Baggage of ${party.name} (${party.baggage.length})`, { fontFamily: FONT, fontSize: '13px', color: GOLD }).setOrigin(0, 1))
    const lines = this.visibleLines(row)
    if (lines.length === 0) this.frame.add(this.add.text(left, LIST_FIRST_Y, 'Nothing is carried.', { fontFamily: FONT, fontSize: '12px', color: DIM }).setOrigin(0, 0.5))
    lines.forEach((line, i) => {
      const at = lineAt(row, i)
      const item = party.baggage[line.index]
      const back = this.add.rectangle(at.x, at.y, LIST_W, LINE_H - 2, 0x1b1712, 0.95).setStrokeStyle(1, 0x3a3024).setInteractive({ useHandCursor: true })
      back.on('pointerover', () => back.setFillStyle(0x2c2418, 0.95))
      back.on('pointerout', () => back.setFillStyle(0x1b1712, 0.95))
      back.on('pointerdown', () => {
        this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
        this.time.delayedCall(0, () => this.onItem(row, line.index, line.name))
      })
      const icon = this.add.image(left + 14, at.y, ITEM_ICON_KEYS[item.icon]).setDisplaySize(18, 18)
      const tint = iconTint(item)
      if (tint !== undefined) icon.setTint(tint)
      const label = this.add.text(left + 30, at.y, line.name, { fontFamily: FONT, fontSize: '12px', color: TEXT }).setOrigin(0, 0.5)
      fitText(label, LIST_W - 40)
      this.frame.add([back, icon, ...createPips(this, item, left + 14, at.y, 0.5), label])
    })
    const pages = this.pageCount(row)
    if (pages > 1) {
      this.frame.add(this.add.text(LIST_X[row] + LIST_W / 2, PAGE_Y, `${this.pages[row] + 1}/${pages}`, { fontFamily: FONT, fontSize: '12px', color: DIM }).setOrigin(0.5))
      this.pageButton(row, false, this.pages[row] > 0)
      this.pageButton(row, true, this.pages[row] < pages - 1)
    }
  }

  private pageButton(row: 0 | 1, next: boolean, enabled: boolean): void {
    const at = pageButton(row, next)
    this.pageControls[row * 2 + (next ? 1 : 0)] = { at, enabled }
    addPanelButton(this, this.frame, at, next ? '>' : '<', () => this.time.delayedCall(0, () => this.turnPage(row, next ? 1 : -1)), { enabled })
  }

  private layout(): void {
    const { width, height } = this.scale
    this.bg.setSize(width, height)
    const scale = Math.max(0, Math.min(1, (width - 32) / FRAME_W, (height - 32) / FRAME_H))
    this.frame.setScale(scale).setPosition((width - FRAME_W * scale) / 2, (height - FRAME_H * scale) / 2)
  }

  // ---- actions ---------------------------------------------------------------

  private turnPage(row: 0 | 1, by: number): void {
    this.pages[row] = Math.max(0, Math.min(this.pageCount(row) - 1, this.pages[row] + by))
    this.render()
  }

  /** Says why an exchange was refused, or `done`, and draws the rows as they now stand. */
  private act(refusal: string | null, done: string): void {
    this.message = refusal ?? done
    this.selected = null
    for (const row of [0, 1] as const) this.pages[row] = Math.min(this.pages[row], this.pageCount(row) - 1)
    this.render()
  }

  private ids(): [string, string] {
    return [this.parties[0].id, this.parties[1].id]
  }

  private onFace(row: 0 | 1, index: number): void {
    const picked = this.selected
    if (picked && picked.row !== row) {
      const move = exchangeMove(picked, { row, index }, this.ids())!
      const [a, b] = [this.parties[picked.row].members[picked.index].name, this.parties[row].members[index].name]
      this.act(tryExchange(this.gameState, this.parties[0].id, this.parties[1].id, move), `${a} and ${b} change places.`)
      return
    }
    this.selected = picked?.row === row && picked.index === index ? null : { row, index }
    this.render()
  }

  private onHeader(row: 0 | 1): void {
    const picked = this.selected
    if (!picked) return
    const move = exchangeMove(picked, { row }, this.ids())
    if (!move) return
    const who = this.parties[picked.row].members[picked.index].name
    this.act(tryExchange(this.gameState, this.parties[0].id, this.parties[1].id, move), `${who} joins ${this.parties[row].name}.`)
  }

  private onItem(row: 0 | 1, index: number, name: string): void {
    this.act(tryExchange(this.gameState, this.parties[0].id, this.parties[1].id, itemMove(row, index, this.ids())), `${name} goes to ${this.parties[1 - row].name}.`)
  }

  /** With a third party on the hex, the second row turns to the next of them. */
  private cycleOther(): void {
    const partners = exchangePartners(this.gameState, this.parties[0])
    if (partners.length < 2) return
    const next = partners[(partners.indexOf(this.parties[1]) + 1) % partners.length]
    this.parties = [this.parties[0], next]
    this.selected = null
    this.pages[1] = 0
    this.message = ''
    this.render()
  }

  /** Back to the map, which redraws the party bar and column and saves. */
  private close(): void {
    this.scene.stop()
    this.scene.resume('World', { exchanged: true })
  }
}
