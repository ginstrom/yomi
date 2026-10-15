import Phaser from 'phaser'
import type { Character } from '../character/character.ts'
import { canAdvance } from '../character/progression.ts'
import type { CharacterDraft } from '../character/creation.ts'
import { canAfford, describeCost, raiseShrine, shrineCost } from '../game/buildings.ts'
import type { GameState } from '../game/gameState.ts'
import {
  MAX_RESERVES,
  RECRUIT_COST,
  availablePrerolls,
  partyLimit,
  recruit,
  recruitLevel,
  recruitRefusal,
  swap,
  toParty,
  toReserves,
  upgradeCost,
  upgradeGuildHall,
} from '../game/guildHall.ts'
import type { ButtonProbe, GuildHallProbe } from '../testHook.ts'
import { soundVolume } from './audioSettings.ts'
import type { Point } from './boardGeometry.ts'
import type { Rect } from './mapScroll.ts'
import { addPanelButton } from './panelButton.ts'
import { PartyColumn } from './PartyColumn.ts'
import { PORTRAIT_SCALE, PORTRAIT_SIZE, portraitKey } from './partyPanel.ts'

interface GuildHallData {
  game: GameState
  /** A hero made in character creation, to recruit, as creation hands back. */
  recruit?: CharacterDraft
}

type Row = 'party' | 'reserves'

/** Drawn in a frame of this size, centred over the map and scaled down (never up) to fit the window. */
const FRAME_W = 720
const FRAME_H = 500
const CENTRE_X = FRAME_W / 2
const TITLE_Y = 40
const FACE_PITCH = 112
const PARTY_Y = 182
const RESERVES_Y = 320
const PREROLL_Y = 200
const ROW_LABEL_DX = -FRAME_W / 2 + 24
const BUTTON_Y = 420
const MESSAGE_Y = 468
/** The hall's upgrade and the shrine's, side by side. */
const UPGRADE_W = 330
const UPGRADE_BUTTON: Rect = { x: CENTRE_X - (UPGRADE_W + 16) / 2, y: 106, width: UPGRADE_W, height: 34 }
const SHRINE_BUTTON: Rect = { x: CENTRE_X + (UPGRADE_W + 16) / 2, y: 106, width: UPGRADE_W, height: 34 }
const BUTTONS_W = 140
const buttonAt = (index: number, of: number): Rect => ({
  x: CENTRE_X + (index - (of - 1) / 2) * (BUTTONS_W + 16),
  y: BUTTON_Y,
  width: BUTTONS_W,
  height: 38,
})
const faceAt = (index: number, of: number, y: number): Point => ({ x: CENTRE_X + (index - (of - 1) / 2) * FACE_PITCH, y })

/** What the message line says until something is done. */
const HINT = 'Click a hero, then one of the other row to swap the two.'
const FONT = 'monospace'
const GOLD = '#e8c766'
const DIM = '#8a7a5a'
const TEXT = '#d8c9a3'

/**
 * The guild hall at Oakvale, an overlay over the paused world map: the party
 * and the reserves, swapped by clicking one and then the other; the hall's
 * upgrade and the shrine's (buildings.ts), Oakvale's other improvement; and recruiting, from the pre-rolls or through character creation,
 * which comes back here with its draft. Every control calls a function of
 * guildHall.ts. Closing it starts the world map again, as the party may have
 * changed under its column.
 */
export class GuildHallScene extends Phaser.Scene {
  private gameState!: GameState
  private view: 'roster' | 'recruit' = 'roster'
  private selected: { row: Row; index: number } | null = null
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
    this.view = 'roster'
    this.selected = null
    this.message = ''
    if (data.recruit) {
      const refusal = recruit(this.gameState, data.recruit)
      this.message = refusal ?? `${data.recruit.name} joins the reserves at level ${this.gameState.reserves.at(-1)!.level}.`
    }
    this.bg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0).setInteractive()
    this.frame = this.add.container(0, 0)
    this.render()
    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this))
    this.input.keyboard?.on('keydown-ESC', () => (this.view === 'recruit' ? this.show('roster') : this.close()))
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
    const faces = (heroes: Character[], y: number) =>
      heroes.map((hero, index) => ({
        ...onScreen(faceAt(index, heroes.length, y)),
        visible: roster,
        enabled: roster,
        name: hero.name,
        level: hero.level,
      }))
    const prerolls = availablePrerolls(this.gameState)
    return {
      view: this.view,
      level: this.gameState.world.guildHall,
      partyLimit: partyLimit(this.gameState.world),
      shrine: this.gameState.world.shrine,
      message: this.message,
      selected: this.selected,
      party: faces(this.gameState.party, PARTY_Y),
      reserves: faces(this.gameState.reserves, RESERVES_Y),
      prerolls: prerolls.map(({ draft }, index) => ({
        ...onScreen(faceAt(index, prerolls.length, PREROLL_Y)),
        visible: !roster,
        enabled: !roster,
        name: draft.name,
      })),
      buttons: {
        upgrade: control('upgrade'),
        shrine: control('shrine'),
        toReserves: control('toReserves'),
        toParty: control('toParty'),
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
        .text(CENTRE_X, TITLE_Y + 28, `Level ${world.guildHall}: a party of up to ${partyLimit(world)}. Shrine ${world.shrine}.  Stock: ${stock || 'nothing'}`, {
          fontFamily: FONT,
          fontSize: '13px',
          color: DIM,
        })
        .setOrigin(0.5),
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

  private label(y: number, words: string): void {
    this.frame.add(this.add.text(CENTRE_X + ROW_LABEL_DX, y - PORTRAIT_SIZE / 2 - 22, words, { fontFamily: FONT, fontSize: '13px', color: GOLD }))
  }

  private buildRoster(): void {
    const { world } = this.gameState
    const cost = upgradeCost(world)
    this.button(
      'upgrade',
      UPGRADE_BUTTON,
      cost ? `Upgrade to level ${world.guildHall + 1}: ${describeCost(cost)}` : 'The hall is fully built',
      () => {
        const next = world.guildHall + 1
        this.act(upgradeGuildHall(this.gameState), `The guild hall is raised to level ${next}.`)
      },
      !!cost && canAfford(world.stock, cost),
    )
    const shrine = shrineCost(world)
    this.button(
      'shrine',
      SHRINE_BUTTON,
      shrine ? `Shrine to level ${world.shrine + 1}: ${describeCost(shrine)}` : 'The shrine is fully built',
      () => {
        const next = world.shrine + 1
        this.act(raiseShrine(world), `The shrine is raised to level ${next}: Oakvale holds its land the harder.`)
      },
      !!shrine && canAfford(world.stock, shrine),
    )
    this.label(PARTY_Y, `Party (${this.gameState.party.length} of ${partyLimit(world)})`)
    this.gameState.party.forEach((hero, index) => this.addFace(hero, faceAt(index, this.gameState.party.length, PARTY_Y), 'party', index))
    this.label(RESERVES_Y, `Reserves (${this.gameState.reserves.length} of ${MAX_RESERVES})`)
    this.gameState.reserves.forEach((hero, index) => this.addFace(hero, faceAt(index, this.gameState.reserves.length, RESERVES_Y), 'reserves', index))
    if (this.gameState.reserves.length === 0) {
      this.frame.add(this.add.text(CENTRE_X, RESERVES_Y, 'No one waits at the hall. Recruit someone.', { fontFamily: FONT, fontSize: '13px', color: DIM }).setOrigin(0.5))
    }
    const picked = this.selected
    this.button('toReserves', buttonAt(0, 4), 'To reserves', () => picked && this.act(toReserves(this.gameState, picked.index), ''), picked?.row === 'party')
    this.button('toParty', buttonAt(1, 4), 'To party', () => picked && this.act(toParty(this.gameState, picked.index), ''), picked?.row === 'reserves')
    this.button('recruit', buttonAt(2, 4), 'Recruit', () => this.show('recruit'))
    this.button('close', buttonAt(3, 4), 'Close', () => this.close())
  }

  private buildRecruit(): void {
    const refusal = recruitRefusal(this.gameState)
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
        this.act(recruit(this.gameState, draft), `${draft.name} joins the reserves at level ${this.gameState.reserves.at(-1)?.level}.`)
        this.show('roster')
      })
    })
    if (prerolls.length === 0) {
      this.frame.add(this.add.text(CENTRE_X, PREROLL_Y, 'Every pre-rolled hero is in the company.', { fontFamily: FONT, fontSize: '13px', color: DIM }).setOrigin(0.5))
    }
    this.button('create', buttonAt(0, 2), 'Create new', () => this.openCreation(), refusal === null)
    this.button('back', buttonAt(1, 2), 'Back', () => this.show('roster'))
  }

  /** A hero of the roster: a click selects it, and a click on one of the other row with one selected swaps the two. */
  private addFace(hero: Character, at: Point, row: Row, index: number): void {
    const selected = this.selected?.row === row && this.selected.index === index
    const notes = [`Level ${hero.level}`, canAdvance(hero) ? '+ to spend' : ''].filter(Boolean).join('  ')
    this.addPortrait(hero.portrait, hero.name, notes, at, true, () => this.onFace(row, index), selected)
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

  private show(view: 'roster' | 'recruit'): void {
    this.view = view
    this.selected = null
    this.render()
  }

  /** Says why an action was refused, or `done`, and draws the hall as it now stands. */
  private act(refusal: string | null, done: string): void {
    this.message = refusal ?? done
    this.selected = null
    this.render()
  }

  private onFace(row: Row, index: number): void {
    const picked = this.selected
    if (picked && picked.row !== row) {
      const [member, reserve] = row === 'reserves' ? [picked.index, index] : [index, picked.index]
      const [leaving, joining] = [this.gameState.party[member].name, this.gameState.reserves[reserve].name]
      this.act(swap(this.gameState, member, reserve), `${joining} takes ${leaving}'s place in the party.`)
      return
    }
    this.selected = picked?.row === row && picked.index === index ? null : { row, index }
    this.render()
  }

  /** Creation over the hall, which hands its draft back here to recruit; the names of the whole company are taken. */
  private openCreation(): void {
    this.scene.start('Creation', { returnTo: 'GuildHall', game: this.gameState })
    this.scene.bringToTop('Creation')
  }

  /** Back to the map, started again: the party under its column may have changed. */
  private close(): void {
    this.scene.start('World', { game: this.gameState })
  }
}
