import Phaser from 'phaser'
import { maxHp } from '../character/character.ts'
import { copyDraft, draftCharacter, typeInName, type CharacterDraft } from '../character/creation.ts'
import { newGame } from '../game/gameState.ts'
import { PREROLLS, READY_MADE, STARTING_PARTY_LIMIT, partyFromDrafts } from '../game/party.ts'
import { SLOT_IDS, describeSlot, firstEmptySlot, type SlotId } from '../game/saveSlots.ts'
import { DEFAULT_ENCAMPMENT_NAME, MAX_ENCAMPMENT_NAME_LENGTH } from '../game/worldMap.ts'
import type { ButtonProbe, PartyProbe } from '../testHook.ts'
import { soundVolume } from './audioSettings.ts'
import type { Point } from './boardGeometry.ts'
import { draftInfo, draftSkills } from './draftInfo.ts'
import type { Rect } from './mapScroll.ts'
import { addPanelButton, type PanelButtonLook } from './panelButton.ts'
import { PartyColumn } from './PartyColumn.ts'
import { PORTRAIT_SCALE, PORTRAIT_SIZE, portraitKey } from './partyPanel.ts'

interface PartyData {
  /** The party being built, when coming back from character creation; absent, the screen opens on its choice. */
  drafts?: CharacterDraft[]
  /** The encampment's name as typed so far, when coming back from character creation. */
  encampmentName?: string
  /** Whether the tutorial box is ticked, when coming back from character creation. */
  tutorial?: boolean
}

type PartyView = PartyProbe['view']

/** The screen is drawn in a frame of this size, centred and scaled down (never up) to fit the window. */
const FRAME_W = 720
const FRAME_H = 500
const CENTRE_X = FRAME_W / 2
const TITLE_Y = 44

const CHOICE_W = 280
const CHOICE_H = 48
const READY_MADE_BUTTON: Rect = { x: CENTRE_X, y: 140, width: CHOICE_W, height: CHOICE_H }
const CREATE_OWN_BUTTON: Rect = { x: CENTRE_X, y: 330, width: CHOICE_W, height: CHOICE_H }
const CHOICE_BACK_BUTTON: Rect = { x: CENTRE_X, y: 404, width: 160, height: 40 }

/** The ready-made party under its button: a face, a name and a role for each, and what a hover tells of one. */
const PREVIEW_Y = 206
const PREVIEW_PITCH = 120
/** Under a face, how far down its name and its role are, and the box a hover shows. */
const NAME_DY = PORTRAIT_SIZE / 2 + 6
const ROLE_DY = NAME_DY + 18
const INFO_DY = ROLE_DY + 22
const INFO_W = 336
const INFO_PAD = 10

/** The prerolls to fill a place with: a face, a name and a role for each, in a row. */
const PREROLL_Y = 170
const PREROLL_PITCH = Math.min(140, (FRAME_W - 60) / PREROLLS.length)
const PREROLL_BACK_BUTTON: Rect = { x: CENTRE_X, y: 440, width: 160, height: 40 }

/** The roster: a row for each place in the party. */
const ROW_W = 600
const ROW_H = 76
const ROW_Y = 128
const ROW_PITCH = 88
const ROW_LEFT = CENTRE_X - ROW_W / 2
const ROW_BUTTON_W = 84
const ROW_BUTTON_H = 30

/** The overwrite prompt: a row for each save slot. */
const SLOT_W = 640
const SLOT_H = 44
const SLOT_Y = 170
const SLOT_PITCH = 58

/** The roster's box for the encampment's name, under the rows. */
const CAMP_NAME_Y = 384
const CAMP_NAME_BOX: Rect = { x: CENTRE_X + 60, y: CAMP_NAME_Y, width: 300, height: 32 }

const BEGIN_BUTTON: Rect = { x: CENTRE_X + 90, y: 440, width: 150, height: 40 }
/** The roster's tick box for the tutorial, left of Back. */
const TUTORIAL_BOX: Rect = { x: ROW_LEFT + 60, y: 440, width: 120, height: 40 }
const FONT = 'monospace'
const GOLD = '#e8c766'
const DIM = '#8a7a5a'
const TEXT = '#d8c9a3'

const rowY = (index: number): number => ROW_Y + index * ROW_PITCH
const editButton = (index: number): Rect => ({ x: ROW_LEFT + ROW_W - 150, y: rowY(index), width: ROW_BUTTON_W, height: ROW_BUTTON_H })
const removeButton = (index: number): Rect => ({ x: ROW_LEFT + ROW_W - 56, y: rowY(index), width: ROW_BUTTON_W, height: ROW_BUTTON_H })
const createButton = (index: number): Rect => ({ x: CENTRE_X - 110, y: rowY(index), width: 200, height: 40 })
const prerollButton = (index: number): Rect => ({ x: CENTRE_X + 110, y: rowY(index), width: 200, height: 40 })
const previewAt = (index: number): Point => ({
  x: CENTRE_X + (index - (READY_MADE.length - 1) / 2) * PREVIEW_PITCH,
  y: PREVIEW_Y,
})
const prerollAt = (index: number): Point => ({
  x: CENTRE_X + (index - (PREROLLS.length - 1) / 2) * PREROLL_PITCH,
  y: PREROLL_Y,
})
const faceRect = ({ x, y }: Point): Rect => ({ x, y, width: PORTRAIT_SIZE, height: PORTRAIT_SIZE })
const slotButton = (index: number): Rect => ({ x: CENTRE_X, y: SLOT_Y + index * SLOT_PITCH, width: SLOT_W, height: SLOT_H })

/**
 * The party screen, which New leads to: the choice between the ready-made
 * party and one's own, the roster where characters are created, picked from
 * the prerolls, edited and removed until the game begins, and the prompt for
 * a slot to overwrite when all three are full. It holds the party as drafts (creation.ts) and nothing
 * else; Begin makes the characters and the game of them.
 */
export class PartyScene extends Phaser.Scene {
  private view: PartyView = 'choice'
  private drafts: CharacterDraft[] = []
  /** What the player calls the encampment, typed on the roster. */
  private encampmentName = DEFAULT_ENCAMPMENT_NAME
  /** Whether the new game shows the tutorial's tips; ticked unless the player unticks it. */
  private tutorial = true
  private readonly limit = STARTING_PARTY_LIMIT
  /** The draft whose portrait the pointer is over: a ready-made member on the choice, or a preroll. */
  private hovered: CharacterDraft | null = null
  private info!: Phaser.GameObjects.Container
  private bg!: Phaser.GameObjects.Rectangle
  private frame!: Phaser.GameObjects.Container

  constructor() {
    super('Party')
  }

  preload(): void {
    PartyColumn.preload(this)
  }

  create(data: PartyData): void {
    this.drafts = (data?.drafts ?? []).map(copyDraft)
    this.view = data?.drafts ? 'roster' : 'choice'
    this.encampmentName = data?.encampmentName ?? DEFAULT_ENCAMPMENT_NAME
    this.tutorial = data?.tutorial ?? true
    this.bg = this.add.rectangle(0, 0, 1, 1, 0x14100c, 1).setOrigin(0)
    this.frame = this.add.container(0, 0)
    this.render()

    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
    })
    this.input.keyboard?.on('keydown-ESC', () => this.onBack())
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event))
  }

  /** What the in-browser tests see of the party screen; see testHook.ts. */
  probe(): PartyProbe {
    const { x, y, scale } = this.frame
    const button = (at: Rect, visible: boolean, enabled = true): ButtonProbe => ({
      x: x + at.x * scale,
      y: y + at.y * scale,
      visible,
      enabled: visible && enabled,
    })
    const roster = this.view === 'roster'
    return {
      view: this.view,
      encampmentName: this.encampmentName,
      tutorial: this.tutorial,
      rows: Array.from({ length: this.limit }, (_, index) => {
        const filled = roster && index < this.drafts.length
        return {
          name: this.drafts[index]?.name ?? null,
          edit: button(editButton(index), filled),
          remove: button(removeButton(index), filled),
          create: button(createButton(index), roster && !filled),
          preroll: button(prerollButton(index), roster && !filled),
        }
      }),
      buttons: {
        readyMade: button(READY_MADE_BUTTON, this.view === 'choice'),
        createOwn: button(CREATE_OWN_BUTTON, this.view === 'choice'),
        begin: button(BEGIN_BUTTON, roster, this.drafts.length > 0),
        tutorial: button(TUTORIAL_BOX, roster),
        back: button(this.backButton(), true),
      },
      readyMade: PREROLLS.slice(0, READY_MADE.length).map(({ draft, role }, index) => ({
        ...button(faceRect(previewAt(index)), this.view === 'choice'),
        name: draft.name,
        role,
      })),
      prerolls: PREROLLS.map(({ draft, role }, index) => ({
        ...button(faceRect(prerollAt(index)), this.view === 'prerolls', !this.inParty(draft)),
        name: draft.name,
        role,
      })),
      info: this.hovered === null ? [] : [this.hovered.name, ...draftInfo(this.hovered)],
      slots: SLOT_IDS.map((slot, index) => ({
        ...button(slotButton(index), this.view === 'overwrite'),
        line: describeSlot(slot).line,
      })),
    }
  }

  /** Back sits under whatever the view shows, and beside Begin on the roster. */
  private backButton(): Rect {
    if (this.view === 'choice') return CHOICE_BACK_BUTTON
    if (this.view === 'prerolls') return PREROLL_BACK_BUTTON
    if (this.view === 'roster') return { ...BEGIN_BUTTON, x: CENTRE_X - 90 }
    return { x: CENTRE_X, y: SLOT_Y + SLOT_IDS.length * SLOT_PITCH + 10, width: 160, height: 40 }
  }

  // ---- build -----------------------------------------------------------------

  /** Draws the view from the drafts as they now stand; rerun after each change. */
  private render(): void {
    this.frame.removeAll(true)
    this.hovered = null
    this.info = this.add.container(0, 0).setVisible(false)
    const titles: Record<PartyView, [title: string, under: string]> = {
      choice: ['New game', 'Take the ready-made party, or create your own.'],
      roster: ['Your party', `Up to ${this.limit} members. Fill an empty place, or edit or remove a character.`],
      prerolls: ['Pre-rolled characters', 'Choose one to join the party. You can edit it afterwards.'],
      overwrite: ['All three slots are full', 'Which game should the new one overwrite?'],
    }
    const [title, under] = titles[this.view]
    this.frame.add([
      this.add.text(CENTRE_X, TITLE_Y, title, { fontFamily: FONT, fontSize: '30px', color: GOLD, fontStyle: 'bold' }).setOrigin(0.5),
      this.add.text(CENTRE_X, TITLE_Y + 34, under, { fontFamily: FONT, fontSize: '13px', color: DIM }).setOrigin(0.5),
    ])
    if (this.view === 'choice') this.buildChoice()
    else if (this.view === 'roster') this.buildRoster()
    else if (this.view === 'prerolls') this.buildPrerolls()
    else this.buildOverwrite()
    this.button(this.backButton(), 'Back', () => this.onBack())
    // Last, so that it lies over the buttons.
    this.frame.add(this.info)
  }

  private button(at: Rect, label: string, onClick: () => void, look?: PanelButtonLook): void {
    // Next tick: the redraw a click leads to destroys the button whose handler this runs in.
    addPanelButton(this, this.frame, at, label, () => this.time.delayedCall(0, onClick), look)
  }

  private buildChoice(): void {
    this.button(READY_MADE_BUTTON, 'Ready-made party', () => this.showRoster(READY_MADE.map(copyDraft)), { fontSize: 16 })
    this.button(CREATE_OWN_BUTTON, 'Create your own', () => this.showRoster([]), { fontSize: 16 })
    PREROLLS.slice(0, READY_MADE.length).forEach(({ draft, role }, index) => this.addFace(draft, role, previewAt(index)))
  }

  /**
   * A draft's portrait with its name and role under it; a hover tells what it
   * comes to. With `onClick` the face is a button, and `enabled` false draws
   * it faint and takes no clicks.
   */
  private addFace(draft: CharacterDraft, role: string, at: Point, onClick?: () => void, enabled = true): void {
    const { x, y } = at
    const rest = enabled ? 0x6b5a3a : 0x3a3024
    const edge = this.add.rectangle(x, y, PORTRAIT_SIZE, PORTRAIT_SIZE).setStrokeStyle(2, rest).setInteractive({ useHandCursor: !!onClick && enabled })
    edge.on('pointerover', () => {
      edge.setStrokeStyle(2, 0xe8c766)
      this.showInfo(draft, at)
    })
    edge.on('pointerout', () => {
      edge.setStrokeStyle(2, rest)
      if (this.hovered === draft) this.showInfo(null)
    })
    if (onClick && enabled) {
      edge.on('pointerdown', () => {
        this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
        // Next tick: the redraw a click leads to destroys the face whose handler this runs in.
        this.time.delayedCall(0, onClick)
      })
    }
    this.frame.add([
      this.add.image(x, y, portraitKey(draft.portrait)).setScale(PORTRAIT_SCALE).setAlpha(enabled ? 1 : 0.4),
      edge,
      this.add.text(x, y + NAME_DY, draft.name, { fontFamily: FONT, fontSize: '13px', color: enabled ? TEXT : DIM }).setOrigin(0.5, 0),
      this.add
        .text(x, y + ROLE_DY, enabled ? role : 'In the party', { fontFamily: FONT, fontSize: '12px', color: enabled ? GOLD : DIM })
        .setOrigin(0.5, 0),
    ])
  }

  /** Shows what `draft` comes to, in a box under its portrait at `at`; null takes the box away. */
  private showInfo(draft: CharacterDraft | null, at?: Point): void {
    this.hovered = draft
    this.info.removeAll(true)
    this.info.setVisible(draft !== null)
    if (draft === null || !at) return
    const name = this.add.text(INFO_PAD, INFO_PAD, draft.name, { fontFamily: FONT, fontSize: '15px', color: GOLD })
    const body = this.add
      .text(INFO_PAD, INFO_PAD + 24, draftInfo(draft).join('\n'), {
        fontFamily: FONT,
        fontSize: '12px',
        color: TEXT,
        wordWrap: { width: INFO_W - 2 * INFO_PAD },
      })
      .setLineSpacing(4)
    const height = body.y + body.height + INFO_PAD
    this.info.add([this.add.rectangle(0, 0, INFO_W, height, 0x14100c, 1).setOrigin(0).setStrokeStyle(2, 0xc9a227), name, body])
    // Under its portrait, and within the frame.
    const x = Math.max(8, Math.min(FRAME_W - INFO_W - 8, at.x - INFO_W / 2))
    this.info.setPosition(x, at.y + INFO_DY)
  }

  private buildRoster(): void {
    for (let index = 0; index < this.limit; index++) {
      const y = rowY(index)
      const draft = this.drafts[index]
      this.frame.add(this.add.rectangle(CENTRE_X, y, ROW_W, ROW_H, 0x1b1712, draft ? 0.9 : 0.4).setStrokeStyle(1, 0x4a3d28))
      if (!draft) {
        this.button(createButton(index), 'Create character', () => this.openCreation())
        this.button(prerollButton(index), 'Choose pre-rolled', () => this.showPrerolls())
        continue
      }
      // Shown as the character the draft makes, so the roster cannot disagree with the game.
      const character = draftCharacter(draft)
      const portraitX = ROW_LEFT + 8 + PORTRAIT_SIZE / 2
      const textX = portraitX + PORTRAIT_SIZE / 2 + 14
      this.frame.add([
        this.add.image(portraitX, y, portraitKey(character.portrait)).setScale(PORTRAIT_SCALE),
        this.add.rectangle(portraitX, y, PORTRAIT_SIZE, PORTRAIT_SIZE).setStrokeStyle(2, 0x6b5a3a),
        this.add.text(textX, y - 24, character.name, { fontFamily: FONT, fontSize: '18px', color: GOLD }),
        this.add.text(textX, y + 4, `${draftSkills(draft)}    HP ${maxHp(character)}`, { fontFamily: FONT, fontSize: '13px', color: TEXT }),
      ])
      this.button(editButton(index), 'Edit', () => this.openCreation(index))
      this.button(removeButton(index), 'Remove', () => this.onRemove(index))
    }
    this.buildEncampmentName()
    this.button(TUTORIAL_BOX, `[${this.tutorial ? 'x' : ' '}] Tutorial`, () => this.toggleTutorial(), { marked: this.tutorial })
    this.button(BEGIN_BUTTON, 'Begin', () => this.onBegin(), { enabled: this.drafts.length > 0, marked: true, fontSize: 16 })
  }

  /** The box the encampment's name is typed into: every key on the roster goes to it. */
  private buildEncampmentName(): void {
    const box = CAMP_NAME_BOX
    this.frame.add([
      this.add.text(ROW_LEFT, CAMP_NAME_Y, 'Your encampment', { fontFamily: FONT, fontSize: '14px', color: GOLD }).setOrigin(0, 0.5),
      this.add.rectangle(box.x, box.y, box.width, box.height, 0x14100c, 0.9).setStrokeStyle(2, 0xc9a227),
      this.add.text(box.x - box.width / 2 + 10, box.y, `${this.encampmentName}_`, { fontFamily: FONT, fontSize: '16px', color: GOLD }).setOrigin(0, 0.5),
      this.add
        .text(box.x + box.width / 2 + 8, box.y, 'type to\nrename', { fontFamily: FONT, fontSize: '10px', color: DIM })
        .setOrigin(0, 0.5),
    ])
  }

  /** A preroll already in the party (by name, which members may not share) is shown but cannot be chosen again. */
  private buildPrerolls(): void {
    PREROLLS.forEach(({ draft, role }, index) =>
      this.addFace(draft, role, prerollAt(index), () => this.addPreroll(draft), !this.inParty(draft)),
    )
  }

  private inParty(draft: CharacterDraft): boolean {
    return this.drafts.some((member) => member.name === draft.name)
  }

  private buildOverwrite(): void {
    SLOT_IDS.forEach((slot, index) => this.button(slotButton(index), describeSlot(slot).line, () => this.begin(slot)))
  }

  // ---- layout ----------------------------------------------------------------

  private layout(): void {
    const { width, height } = this.scale
    this.bg.setSize(width, height)
    const scale = Math.max(0, Math.min(1, (width - 32) / FRAME_W, (height - 32) / FRAME_H))
    this.frame.setScale(scale).setPosition((width - FRAME_W * scale) / 2, (height - FRAME_H * scale) / 2)
  }

  // ---- actions ---------------------------------------------------------------

  private showRoster(drafts: CharacterDraft[]): void {
    this.drafts = drafts
    this.view = 'roster'
    this.render()
  }

  private showPrerolls(): void {
    this.view = 'prerolls'
    this.render()
  }

  /** A preroll joins at the end, as a created character does, as a copy the roster may edit. */
  private addPreroll(draft: CharacterDraft): void {
    if (this.drafts.length >= this.limit || this.inParty(draft)) return
    this.showRoster([...this.drafts, copyDraft(draft)])
  }

  /** Removing closes the gap: the party stays in battle order, and a new character joins at the end. */
  private onRemove(index: number): void {
    this.drafts.splice(index, 1)
    this.render()
  }

  /** Creation for a new character, or for the one at `index` as it was chosen. */
  private openCreation(index?: number): void {
    this.scene.start('Creation', { drafts: this.drafts, index, encampmentName: this.encampmentName, tutorial: this.tutorial })
  }

  /** Ticks or unticks the tutorial; the menu's options change it once the game has begun. */
  private toggleTutorial(): void {
    this.tutorial = !this.tutorial
    this.render()
  }

  /** On the roster, typing names the encampment. */
  private onKey(event: KeyboardEvent): void {
    if (this.view !== 'roster') return
    const name = typeInName(this.encampmentName, event.key, MAX_ENCAMPMENT_NAME_LENGTH)
    if (name === this.encampmentName) return
    // Space would scroll a page that scrolls, and Backspace go back in some browsers.
    event.preventDefault()
    this.encampmentName = name
    this.render()
  }

  /** The game takes the first empty slot; with none empty, the player says which to overwrite. */
  private onBegin(): void {
    if (this.drafts.length === 0) return
    const slot = firstEmptySlot()
    if (slot !== null) {
      this.begin(slot)
      return
    }
    this.view = 'overwrite'
    this.render()
  }

  /** Makes the characters and the game of them. The drafts end here, and with them editing; the world map saves the game as it opens. */
  private begin(slot: SlotId): void {
    this.scene.start('World', { game: newGame(partyFromDrafts(this.drafts), slot, undefined, this.encampmentName, this.tutorial) })
  }

  /** From the overwrite prompt or the prerolls back to the roster, from the roster to the choice (the party made so far is dropped), from the choice to the menu. */
  private onBack(): void {
    if (this.view === 'choice') {
      this.scene.start('Menu')
      return
    }
    if (this.view === 'roster') this.drafts = []
    this.view = this.view === 'roster' ? 'choice' : 'roster'
    this.render()
  }
}
