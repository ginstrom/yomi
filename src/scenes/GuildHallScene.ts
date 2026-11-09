import Phaser from 'phaser'
import type { Character } from '../character/character.ts'
import { canAdvance } from '../character/progression.ts'
import type { CharacterDraft } from '../character/creation.ts'
import { describeCost } from '../game/buildings.ts'
import type { Expedition } from '../game/expedition.ts'
import { defaultPartyName, disband, formParty, renameParty } from '../game/company.ts'
import type { GameState } from '../game/gameState.ts'
import {
  MAX_RESERVES,
  RECRUIT_COST,
  availablePrerolls,
  company,
  companyLimit,
  homeParty,
  maxParties,
  partyLimit,
  recruit,
  recruitLevel,
  recruitRefusal,
} from '../game/guildHall.ts'
import { hallAct, hallColumns, refOf, typeInRename, type HallColumn, type HallPick, type RenameField } from './hallColumns.ts'
import type { ButtonProbe, GuildHallProbe } from '../testHook.ts'
import { soundVolume } from './audioSettings.ts'
import type { Point } from './boardGeometry.ts'
import type { Rect } from './mapScroll.ts'
import { addPanelButton, fitText } from './panelButton.ts'
import { PartyColumn } from './PartyColumn.ts'
import { PORTRAIT_SCALE, PORTRAIT_SIZE, portraitKey } from './partyPanel.ts'

interface GuildHallData {
  /** The id of the party at the hall; the first if left out or unknown. */
  party?: string
  game: GameState
  /** A hero made in character creation, to recruit, as creation hands back. */
  recruit?: CharacterDraft
}

/** Drawn in a frame of this size, centred over the map and scaled down (never up) to fit the window. */
const FRAME_W = 720
const FRAME_H = 500
const CENTRE_X = FRAME_W / 2
const TITLE_Y = 34
const FACE_PITCH = 112
const PREROLL_Y = 200
const BUTTON_Y = 426
const MESSAGE_Y = 472
const BUTTONS_W = 124
/** The roster's columns: one for each party at home and the reserves' share the frame; a face is this big, in a pitch. */
const COLUMNS_MARGIN = 12
const HEADER_Y = 112
const HEADER_H = 26
const FACE_SIZE = 48
const FACE_SCALE = FACE_SIZE / 32
const FACE_ROW_PITCH = 54
const FIRST_FACE_Y = 160
const MAX_PARTY_NAME = 16
const buttonAt = (index: number, of: number): Rect => ({
  x: CENTRE_X + (index - (of - 1) / 2) * (BUTTONS_W + 16),
  y: BUTTON_Y,
  width: BUTTONS_W,
  height: 38,
})
const faceAt = (index: number, of: number, y: number): Point => ({ x: CENTRE_X + (index - (of - 1) / 2) * FACE_PITCH, y })
const columnWidth = (count: number): number => (FRAME_W - 2 * COLUMNS_MARGIN) / count
const columnLeft = (column: number, count: number): number => COLUMNS_MARGIN + column * columnWidth(count)
/** A column's header, centred on the column. */
const headerAt = (column: number, count: number): Point => ({ x: columnLeft(column, count) + columnWidth(count) / 2, y: HEADER_Y })
/** A roster hero's face: at the left of its column, stacked. */
const rosterFaceAt = (column: number, count: number, index: number): Point => ({ x: columnLeft(column, count) + FACE_SIZE / 2 + 8, y: FIRST_FACE_Y + index * FACE_ROW_PITCH })

/** What the message line says until something is done. */
const HINT = 'Click a hero, then a hero of another column to swap the two, or that column\'s heading to move it there. Pick a hero to Form party, or a party\'s hero to Rename or Disband it.'
const FONT = 'monospace'
const GOLD = '#e8c766'
const DIM = '#8a7a5a'
const TEXT = '#d8c9a3'

/**
 * The guild hall, entered from the encampment (EncampmentScene, which raises
 * the hall's level) over the paused world map: a column for each party at home
 * and one for the reserves, heroes swapped or moved by clicking one and then a
 * hero or the heading of another column, parties formed, renamed and disbanded,
 * and recruiting, from the pre-rolls or through character creation, which
 * comes back here with its draft. Every control calls a function of
 * guildHall.ts or company.ts (`hallColumns.ts` maps clicks to them). Closing it
 * goes back to the encampment.
 */
export class GuildHallScene extends Phaser.Scene {
  private gameState!: GameState
  private expedition!: Expedition
  private view: 'roster' | 'recruit' = 'roster'
  private selected: HallPick | null = null
  /** The party being renamed and the name typed so far (its old name until the first key): every key goes to it. */
  private renaming: ({ party: string } & RenameField) | null = null
  private message = ''
  private bg!: Phaser.GameObjects.Rectangle
  private frame!: Phaser.GameObjects.Container
  private controls: Partial<Record<keyof GuildHallProbe['buttons'], { at: Rect; enabled: boolean }>> = {}

  constructor() {
    super('GuildHall')
  }

  preload(): void {
    PartyColumn.preload(this)
  }

  create(data: GuildHallData): void {
    this.gameState = data.game
    this.expedition = homeParty(data.game, data.party) ?? data.game.parties[0]
    this.view = 'roster'
    this.renaming = null
    this.selected = null
    this.message = ''
    if (data.recruit) {
      const refusal = recruit(this.gameState, this.expedition, data.recruit)
      this.message = refusal ?? `${data.recruit.name} joins the reserves at level ${this.gameState.reserves.at(-1)!.level}.`
    }
    this.bg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0).setInteractive()
    this.frame = this.add.container(0, 0)
    this.render()
    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this))
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.renaming) {
        this.renaming = null
        this.message = ''
        this.render()
      } else if (this.view === 'recruit') this.show('roster')
      else this.close()
    })
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event))
  }

  /** What the in-browser tests see of the guild hall; see testHook.ts. */
  probe(): GuildHallProbe {
    const { x, y, scale } = this.frame
    const onScreen = (at: Point) => ({ x: x + at.x * scale, y: y + at.y * scale })
    const control = (key: keyof GuildHallProbe['buttons']): ButtonProbe => {
      const shown = this.controls[key]
      return { ...onScreen(shown?.at ?? { x: 0, y: 0 }), visible: !!shown, enabled: !!shown?.enabled }
    }
    const roster = this.view === 'roster'
    const columns = hallColumns(this.gameState)
    const faces = (heroes: Character[], at: (index: number) => Point) =>
      heroes.map((hero, index) => ({ ...onScreen(at(index)), visible: roster, enabled: roster, name: hero.name, level: hero.level }))
    const columnFaces = (column: HallColumn, c: number) => faces(column.heroes, (index) => rosterFaceAt(c, columns.length, index))
    const prerolls = availablePrerolls(this.gameState)
    const acting = columns.findIndex((column) => column.party === this.expedition.id)
    const reserves = columns.length - 1
    return {
      view: this.view,
      level: this.gameState.world.guildHall,
      partyLimit: partyLimit(this.gameState.world),
      maxParties: maxParties(this.gameState.world),
      message: this.message,
      selected: this.selected,
      renaming: this.renaming?.text ?? null,
      columns: columns.map((column, c) => ({
        party: column.party,
        name: column.name,
        header: { ...onScreen(headerAt(c, columns.length)), visible: roster, enabled: roster && this.selected !== null && this.selected.party !== column.party },
        faces: columnFaces(column, c),
      })),
      party: columnFaces(columns[acting], acting),
      reserves: columnFaces(columns[reserves], reserves),
      prerolls: prerolls.map(({ draft }, index) => ({
        ...onScreen(faceAt(index, prerolls.length, PREROLL_Y)),
        visible: !roster,
        enabled: !roster,
        name: draft.name,
      })),
      buttons: {
        form: control('form'),
        rename: control('rename'),
        disband: control('disband'),
        recruit: control('recruit'),
        create: control('create'),
        back: control('back'),
        close: control('close'),
      },
    }
  }

  // ---- build -----------------------------------------------------------------

  private render(): void {
    this.frame.removeAll(true)
    this.controls = {}
    const { world } = this.gameState
    const stock = Object.entries(world.stock)
      .filter(([, amount]) => amount)
      .map(([material, amount]) => `${amount} ${material}`)
      .join(', ')
    this.frame.add([
      this.add.rectangle(CENTRE_X, FRAME_H / 2, FRAME_W, FRAME_H, 0x241d15, 0.98).setStrokeStyle(3, 0xc9a227),
      this.add.text(CENTRE_X, TITLE_Y, 'Guild Hall', { fontFamily: FONT, fontSize: '28px', color: GOLD, fontStyle: 'bold' }).setOrigin(0.5),
      this.add
        .text(CENTRE_X, TITLE_Y + 26, `Level ${world.guildHall}: ${maxParties(world)} ${maxParties(world) === 1 ? 'party' : 'parties'} of up to ${partyLimit(world)}, ${company(this.gameState).length} of ${companyLimit(world)} heroes.`, {
          fontFamily: FONT,
          fontSize: '13px',
          color: DIM,
        })
        .setOrigin(0.5),
      // Every material held may not fit one line: it wraps onto a second, above the columns' headings.
      this.add
        .text(CENTRE_X, TITLE_Y + 35, `Stock: ${stock || 'nothing'}`, { fontFamily: FONT, fontSize: '12px', color: DIM, align: 'center', wordWrap: { width: FRAME_W - 40 } })
        .setOrigin(0.5, 0),
      this.add.text(CENTRE_X, MESSAGE_Y, this.message || (this.view === 'roster' ? HINT : ''), { fontFamily: FONT, fontSize: '13px', color: TEXT, align: 'center', wordWrap: { width: FRAME_W - 40 } }).setOrigin(0.5),
    ])
    if (this.view === 'roster') this.buildRoster()
    else this.buildRecruit()
  }

  private button(key: keyof GuildHallProbe['buttons'], at: Rect, label: string, onClick: () => void, enabled = true): void {
    this.controls[key] = { at, enabled }
    // Next tick: the redraw a click leads to destroys the button whose handler this runs in.
    addPanelButton(this, this.frame, at, label, () => this.time.delayedCall(0, onClick), { enabled })
  }

  private buildRoster(): void {
    const columns = hallColumns(this.gameState)
    const { world } = this.gameState
    columns.forEach((column, c) => {
      const head = headerAt(c, columns.length)
      const width = columnWidth(columns.length) - 8
      const renaming = this.renaming?.party === column.party && column.party !== null
      const limit = column.party === null ? MAX_RESERVES : partyLimit(world)
      const label = renaming ? `${this.renaming!.text}_` : `${column.name} (${column.heroes.length}/${limit})`
      const picked = this.selected
      const box = this.add
        .rectangle(head.x, head.y, width, HEADER_H, 0x1b1712, 0.95)
        .setStrokeStyle(2, renaming ? 0xe8c766 : column.party === this.expedition.id ? 0xc9a227 : 0x6b5a3a)
      const text = this.add.text(head.x, head.y, label, { fontFamily: FONT, fontSize: '13px', color: renaming ? GOLD : TEXT }).setOrigin(0.5)
      fitText(text, width - 8)
      // A header takes the picked hero in from another column.
      if (picked && picked.party !== column.party) {
        box.setInteractive({ useHandCursor: true })
        box.on('pointerdown', () => {
          this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
          this.time.delayedCall(0, () => this.onHeader(column.party))
        })
      }
      this.frame.add([box, text])
      column.heroes.forEach((hero, index) => this.addFace(hero, rosterFaceAt(c, columns.length, index), column.party, index, width))
    })
    if (this.gameState.reserves.length === 0) {
      const at = rosterFaceAt(columns.length - 1, columns.length, 0)
      this.frame.add(this.add.text(at.x - FACE_SIZE / 2, at.y - 10, 'No one waits.\nRecruit someone.', { fontFamily: FONT, fontSize: '11px', color: DIM }))
    }
    const picked = this.selected
    const inParty = picked !== null && picked.party !== null
    this.button('form', buttonAt(0, 5), 'Form party', () => picked && this.formFrom(picked), picked !== null)
    this.button('rename', buttonAt(1, 5), 'Rename', () => picked?.party && this.startRename(picked.party), inParty)
    this.button('disband', buttonAt(2, 5), 'Disband', () => picked?.party && this.disbandParty(picked.party), inParty)
    this.button('recruit', buttonAt(3, 5), 'Recruit', () => this.show('recruit'))
    this.button('close', buttonAt(4, 5), 'Close', () => this.close())
  }

  private buildRecruit(): void {
    const refusal = recruitRefusal(this.gameState, this.expedition)
    this.frame.add(
      this.add
        .text(CENTRE_X, 110, `A recruit costs ${describeCost(RECRUIT_COST)} and joins the reserves at level ${recruitLevel(this.gameState)}.\n${refusal ?? 'Choose a pre-rolled hero, or create one.'}`, {
          fontFamily: FONT,
          fontSize: '13px',
          color: refusal ? '#ffb74d' : TEXT,
          align: 'center',
        })
        .setOrigin(0.5),
    )
    const prerolls = availablePrerolls(this.gameState)
    prerolls.forEach(({ draft, role }, index) => {
      const at = faceAt(index, prerolls.length, PREROLL_Y)
      this.addPortrait(draft.portrait, draft.name, role, at, refusal === null, () => {
        // Back to the roster, where the message tells how the recruiting went.
        this.view = 'roster'
        this.act(recruit(this.gameState, this.expedition, draft), `${draft.name} joins the reserves at level ${this.gameState.reserves.at(-1)?.level}.`)
      })
    })
    if (prerolls.length === 0) {
      this.frame.add(this.add.text(CENTRE_X, PREROLL_Y, 'Every pre-rolled hero is in the company.', { fontFamily: FONT, fontSize: '13px', color: DIM }).setOrigin(0.5))
    }
    this.button('create', buttonAt(0, 2), 'Create new', () => this.openCreation(), refusal === null)
    this.button('back', buttonAt(1, 2), 'Back', () => this.show('roster'))
  }

  /** A hero of a column: a click picks it, and a click on a hero of another column with one picked swaps the two. */
  private addFace(hero: Character, at: Point, party: string | null, index: number, width: number): void {
    const selected = this.selected?.party === party && this.selected.index === index
    const notes = [`Level ${hero.level}`, canAdvance(hero) ? '+ to spend' : ''].filter(Boolean).join('  ')
    const rest = selected ? 0xe8c766 : 0x6b5a3a
    const edge = this.add
      .rectangle(at.x, at.y, FACE_SIZE, FACE_SIZE)
      .setStrokeStyle(selected ? 3 : 2, rest)
      .setInteractive({ useHandCursor: true })
    edge.on('pointerover', () => edge.setStrokeStyle(selected ? 3 : 2, 0xe8c766))
    edge.on('pointerout', () => edge.setStrokeStyle(selected ? 3 : 2, rest))
    edge.on('pointerdown', () => {
      this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
      this.time.delayedCall(0, () => this.onFace(party, index))
    })
    const name = this.add.text(at.x + FACE_SIZE / 2 + 8, at.y - 14, hero.name, { fontFamily: FONT, fontSize: '13px', color: selected ? GOLD : TEXT })
    fitText(name, width - FACE_SIZE - 20)
    this.frame.add([
      this.add.image(at.x, at.y, portraitKey(hero.portrait)).setScale(FACE_SCALE),
      edge,
      name,
      this.add.text(at.x + FACE_SIZE / 2 + 8, at.y + 4, notes, { fontFamily: FONT, fontSize: '11px', color: DIM }),
    ])
  }

  private addPortrait(
    portrait: Character['portrait'],
    name: string,
    under: string,
    at: Point,
    enabled: boolean,
    onClick: () => void,
    marked = false,
  ): void {
    const rest = marked ? 0xe8c766 : enabled ? 0x6b5a3a : 0x3a3024
    const edge = this.add
      .rectangle(at.x, at.y, PORTRAIT_SIZE, PORTRAIT_SIZE)
      .setStrokeStyle(marked ? 3 : 2, rest)
      .setInteractive({ useHandCursor: enabled })
    if (enabled) {
      edge.on('pointerover', () => edge.setStrokeStyle(marked ? 3 : 2, 0xe8c766))
      edge.on('pointerout', () => edge.setStrokeStyle(marked ? 3 : 2, rest))
      edge.on('pointerdown', () => {
        this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
        this.time.delayedCall(0, onClick)
      })
    }
    this.frame.add([
      this.add.image(at.x, at.y, portraitKey(portrait)).setScale(PORTRAIT_SCALE).setAlpha(enabled ? 1 : 0.4),
      edge,
      this.add.text(at.x, at.y + PORTRAIT_SIZE / 2 + 6, name, { fontFamily: FONT, fontSize: '13px', color: marked ? GOLD : TEXT }).setOrigin(0.5, 0),
      this.add.text(at.x, at.y + PORTRAIT_SIZE / 2 + 22, under, { fontFamily: FONT, fontSize: '11px', color: DIM }).setOrigin(0.5, 0),
    ])
  }

  private layout(): void {
    const { width, height } = this.scale
    this.bg.setSize(width, height)
    const scale = Math.max(0, Math.min(1, (width - 32) / FRAME_W, (height - 32) / FRAME_H))
    this.frame.setScale(scale).setPosition((width - FRAME_W * scale) / 2, (height - FRAME_H * scale) / 2)
  }

  // ---- actions ---------------------------------------------------------------

  /** Shows `view`, the last action's message gone with the view it was given in. */
  private show(view: 'roster' | 'recruit'): void {
    this.view = view
    this.message = ''
    this.renaming = null
    this.selected = null
    this.render()
  }

  /** Says why an action was refused, or `done`, and draws the hall as it now stands. */
  private act(refusal: string | null, done: string): void {
    this.message = refusal ?? done
    this.selected = null
    this.renaming = null
    this.render()
  }

  private onFace(party: string | null, index: number): void {
    const picked = this.selected
    this.renaming = null
    if (picked && picked.party !== party) {
      const [leaving, joining] = [this.heroAt(picked), this.heroAt({ party, index })]
      this.act(hallAct(this.gameState, picked, { party, index }), `${leaving} and ${joining} change places.`)
      return
    }
    this.selected = picked?.party === party && picked.index === index ? null : { party, index }
    this.render()
  }

  private heroAt(at: HallPick): string {
    const column = hallColumns(this.gameState).find((c) => c.party === at.party)
    return column?.heroes[at.index]?.name ?? 'The hero'
  }

  private onHeader(party: string | null): void {
    const picked = this.selected
    if (!picked) return
    const who = this.heroAt(picked)
    const where = hallColumns(this.gameState).find((c) => c.party === party)?.name ?? 'the reserves'
    this.act(hallAct(this.gameState, picked, { party }), `${who} joins ${where}.`)
  }

  private formFrom(picked: HallPick): void {
    const formed = formParty(this.gameState, defaultPartyName(this.gameState), refOf(picked))
    if (typeof formed === 'string') return this.act(formed, '')
    this.act(null, `${formed.name} is formed. Pick one of its heroes and press Rename to name it.`)
  }

  private startRename(party: string): void {
    const current = this.gameState.parties.find((p) => p.id === party)
    if (!current) return
    this.renaming = { party, text: current.name, fresh: true }
    this.message = 'Type the new name (the first key replaces the old), Enter to keep it, Esc to cancel.'
    this.render()
  }

  private disbandParty(party: string): void {
    const name = this.gameState.parties.find((p) => p.id === party)?.name ?? 'The party'
    const refusal = disband(this.gameState, party)
    if (refusal === null && party === this.expedition.id) this.expedition = homeParty(this.gameState)!
    this.act(refusal, `${name} is disbanded; its heroes wait in the reserves.`)
  }

  /** While renaming, every key goes to the name. */
  private onKey(event: KeyboardEvent): void {
    const renaming = this.renaming
    if (!renaming || this.view !== 'roster') return
    if (event.key === 'Enter') {
      event.preventDefault()
      const refusal = renameParty(this.gameState, renaming.party, renaming.text)
      if (refusal) {
        this.message = refusal
      } else {
        this.message = `Renamed to ${renaming.text.trim()}.`
        this.renaming = null
        this.selected = null
      }
      this.render()
      return
    }
    const typed = typeInRename(renaming, { key: event.key, chord: event.ctrlKey || event.metaKey || event.altKey }, MAX_PARTY_NAME)
    if (typed === renaming) return
    event.preventDefault()
    this.renaming = { ...renaming, ...typed }
    this.render()
  }

  /** Creation over the hall, which hands its draft back here to recruit; the names of the whole company are taken. */
  private openCreation(): void {
    this.scene.start('Creation', { returnTo: 'GuildHall', game: this.gameState, party: this.expedition.id })
    this.scene.bringToTop('Creation')
  }

  /** Back to the encampment, the guild hall's details showing. */
  private close(): void {
    this.scene.start('Encampment', { game: this.gameState, party: this.expedition.id, select: 'guild_hall' })
    this.scene.bringToTop('Encampment')
  }
}
