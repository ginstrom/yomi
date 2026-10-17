import Phaser from 'phaser'
import type { GameState } from '../game/gameState.ts'
import { CUTSCENES, type CutsceneBeat } from '../story/cutscenes.ts'
import { fillText, setTutorial, storyFor, type StoryItem, type StoryMoment } from '../story/story.ts'
import { tutorialTip, type TutorialAnchor } from '../story/tutorial.ts'
import type { ButtonProbe, StoryProbe } from '../testHook.ts'
import type { Point } from './boardGeometry.ts'
import type { Rect } from './mapScroll.ts'
import { addPanelButton } from './panelButton.ts'
import { PartyColumn } from './PartyColumn.ts'
import { PORTRAIT_SCALE, PORTRAIT_SIZE, portraitKey } from './partyPanel.ts'

/** The scenes a story is told over, which it pauses and resumes. */
export type StoryResume = 'World' | 'Battle' | 'Encampment'

interface StoryData {
  game: GameState
  /** What to show, in order: `storyFor`'s choice at a moment. */
  items: StoryItem[]
  resume: StoryResume
  /** Where on screen the scene under the story has the controls a tip may point at. */
  anchors: StoryAnchors
}

/** Where on screen a scene has the controls a tip may point at, those of them it shows. */
export type StoryAnchors = Partial<Record<TutorialAnchor, Point>>

/**
 * Tells the story of a moment over the scene it happens in: asks `storyFor`
 * what shows now and, if anything does, lays the story over the scene and
 * pauses it until the last item is done. Returns whether it did. What
 * `storyFor` marks shown is in the game for the scene's next save.
 */
export function tellStory(scene: Phaser.Scene, game: GameState, moment: StoryMoment, anchors: StoryAnchors = {}): boolean {
  return showStory(scene, game, storyFor(game, moment), anchors)
}

/** Lays these items over the scene, which pauses until they are done; nothing, if there are none. */
export function showStory(scene: Phaser.Scene, game: GameState, items: StoryItem[], anchors: StoryAnchors = {}): boolean {
  if (items.length === 0) return false
  const data: StoryData = { game, items, resume: scene.scene.key as StoryResume, anchors }
  scene.scene.launch('Story', data)
  scene.scene.bringToTop('Story')
  scene.scene.pause()
  return true
}

/** A backdrop's texture key, for `public/assets/cutscenes/<name>.png`. */
const backdropKey = (name: string): string => `cutscene_${name}`

const FONT = 'monospace'
const GOLD = '#e8c766'
const DIM = '#8a7a5a'
const TEXT = '#d8c9a3'
const PANEL_FILL = 0x1b1712
const PANEL_EDGE = 0xc9a227
const ANCHOR_COLOR = 0xe8c766

/** A cutscene's box of words along the bottom of the screen. */
const DIALOGUE_MAX_W = 820
const DIALOGUE_H = 168
const DIALOGUE_MARGIN = 24
const DIALOGUE_PAD = 16
/** A tip's panel, in the middle of the screen. */
const TIP_W = 440
const TIP_PAD = 18
const BUTTON_W = 150
const BUTTON_H = 34

/**
 * The story, an overlay over the scene it is told in (tellStory): each
 * cutscene a beat at a time, as a box of words along the bottom with the
 * speaker's face, over a backdrop or the scene dimmed; each tutorial tip as
 * a panel with a ring around the control it is about. A click, Space or
 * Enter goes on, and Esc skips the rest of a cutscene. A tip can turn the
 * tutorial off, which drops the tips still waiting. When the last item is
 * done the scene under it resumes.
 */
export class StoryScene extends Phaser.Scene {
  private gameState!: GameState
  private items: StoryItem[] = []
  private resumeKey: StoryResume = 'World'
  private anchors: StoryData['anchors'] = {}
  /** Which item is showing, and which of a cutscene's beats. */
  private index = 0
  private beat = 0
  private shade!: Phaser.GameObjects.Rectangle
  private backdrop!: Phaser.GameObjects.Image
  private content!: Phaser.GameObjects.Container
  /** The controls drawn for the item showing, for the probe. */
  private controls: Partial<Record<keyof StoryProbe['buttons'], Rect>> = {}

  constructor() {
    super('Story')
  }

  preload(): void {
    PartyColumn.preload(this)
    const data = this.sys.settings.data as StoryData | undefined
    for (const item of data?.items ?? []) {
      if (item.kind !== 'cutscene') continue
      for (const { backdrop } of CUTSCENES[item.id].beats as CutsceneBeat[]) {
        if (backdrop) this.load.image(backdropKey(backdrop), `assets/cutscenes/${backdrop}.png`)
      }
    }
  }

  create(data: StoryData): void {
    this.gameState = data.game
    this.items = [...data.items]
    this.resumeKey = data.resume
    this.anchors = data.anchors ?? {}
    this.index = 0
    this.beat = 0
    // Interactive, so nothing under the story takes a click; in a cutscene a click anywhere goes on.
    this.shade = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0).setInteractive()
    this.shade.on('pointerdown', () => {
      if (this.current()?.kind === 'cutscene') this.time.delayedCall(0, () => this.next())
    })
    this.backdrop = this.add.image(0, 0, '__DEFAULT').setVisible(false)
    this.content = this.add.container(0, 0)
    this.render()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.render, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.render, this))
    this.input.keyboard?.on('keydown-SPACE', () => this.next())
    this.input.keyboard?.on('keydown-ENTER', () => this.next())
    this.input.keyboard?.on('keydown-ESC', () => this.skip())
  }

  /** What the in-browser tests see of the story; see testHook.ts. */
  probe(): StoryProbe {
    const item = this.current()
    const control = (key: keyof StoryProbe['buttons']): ButtonProbe => {
      const at = this.controls[key]
      return { x: at?.x ?? 0, y: at?.y ?? 0, visible: !!at, enabled: !!at }
    }
    const beats = item?.kind === 'cutscene' ? (CUTSCENES[item.id].beats as CutsceneBeat[]) : []
    const tip = item?.kind === 'tip' ? tutorialTip(item.id) : undefined
    return {
      kind: item?.kind ?? null,
      id: item?.id ?? null,
      beat: this.beat,
      beats: beats.length,
      speaker: beats[this.beat]?.speaker ? fillText(beats[this.beat].speaker!, this.gameState) : null,
      text: item?.kind === 'cutscene' ? fillText(beats[this.beat]?.text ?? '', this.gameState) : tip ? fillText(tip.text, this.gameState) : '',
      anchor: (tip?.anchor && this.anchors[tip.anchor]) || null,
      tutorial: this.gameState.story.tutorial,
      buttons: { next: control('next'), skip: control('skip'), tutorialOff: control('tutorialOff') },
    }
  }

  private current(): StoryItem | undefined {
    return this.items[this.index]
  }

  // ---- drawing ---------------------------------------------------------------

  /** Draws the item showing, laid out for the window as it is; again on every resize. */
  private render(): void {
    const { width, height } = this.scale
    this.shade.setSize(width, height)
    this.tweens.killAll()
    this.content.removeAll(true)
    this.controls = {}
    const item = this.current()
    if (item?.kind === 'cutscene') this.drawBeat(CUTSCENES[item.id].beats as CutsceneBeat[])
    else if (item?.kind === 'tip') this.drawTip(item.id)
  }

  /** The backdrop named last up to this beat, cover-scaled; none dims the scene under it. */
  private drawBackdrop(beats: CutsceneBeat[]): void {
    const { width, height } = this.scale
    const name = beats
      .slice(0, this.beat + 1)
      .map((b) => b.backdrop)
      .filter((b) => b !== undefined)
      .pop()
    const key = name && backdropKey(name)
    if (!key || !this.textures.exists(key)) {
      this.backdrop.setVisible(false)
      this.shade.setFillStyle(0x000000, 0.7)
      return
    }
    this.shade.setFillStyle(0x000000, 1)
    this.backdrop.setTexture(key).setVisible(true).setPosition(width / 2, height / 2)
    this.backdrop.setScale(Math.max(width / this.backdrop.width, height / this.backdrop.height))
  }

  private drawBeat(beats: CutsceneBeat[]): void {
    this.drawBackdrop(beats)
    const beat = beats[this.beat]
    const { width, height } = this.scale
    const boxW = Math.min(DIALOGUE_MAX_W, width - 2 * DIALOGUE_MARGIN)
    const left = (width - boxW) / 2
    const top = height - DIALOGUE_MARGIN - DIALOGUE_H
    this.content.add(this.add.rectangle(left, top, boxW, DIALOGUE_H, PANEL_FILL, 0.95).setOrigin(0).setStrokeStyle(2, PANEL_EDGE))
    let textX = left + DIALOGUE_PAD
    const portrait = beat.portrait === 'leader' ? this.gameState.party[0]?.portrait : beat.portrait
    if (portrait) {
      const at = { x: textX + PORTRAIT_SIZE / 2, y: top + DIALOGUE_PAD + PORTRAIT_SIZE / 2 }
      this.content.add([
        this.add.image(at.x, at.y, portraitKey(portrait)).setScale(PORTRAIT_SCALE),
        this.add.rectangle(at.x, at.y, PORTRAIT_SIZE, PORTRAIT_SIZE).setStrokeStyle(2, 0x6b5a3a),
      ])
      textX += PORTRAIT_SIZE + DIALOGUE_PAD
    }
    let textY = top + DIALOGUE_PAD
    if (beat.speaker) {
      this.content.add(this.add.text(textX, textY, fillText(beat.speaker, this.gameState), { fontFamily: FONT, fontSize: '16px', color: GOLD }))
      textY += 26
    }
    this.content.add(
      this.add.text(textX, textY, fillText(beat.text, this.gameState), {
        fontFamily: FONT,
        fontSize: '15px',
        color: TEXT,
        lineSpacing: 4,
        wordWrap: { width: left + boxW - DIALOGUE_PAD - textX },
      }),
    )
    const buttonY = top + DIALOGUE_H - DIALOGUE_PAD - BUTTON_H / 2
    const right = left + boxW - DIALOGUE_PAD - BUTTON_W / 2
    const last = this.beat === beats.length - 1
    this.button('next', { x: right, y: buttonY, width: BUTTON_W, height: BUTTON_H }, last ? 'Continue' : 'Next', () => this.next(), true)
    if (!last) this.button('skip', { x: right - BUTTON_W - 12, y: buttonY, width: BUTTON_W, height: BUTTON_H }, 'Skip', () => this.skip())
    this.content.add(
      this.add.text(left + DIALOGUE_PAD, buttonY, `${this.beat + 1} / ${beats.length}`, { fontFamily: FONT, fontSize: '12px', color: DIM }).setOrigin(0, 0.5),
    )
  }

  private drawTip(id: string): void {
    this.backdrop.setVisible(false)
    this.shade.setFillStyle(0x000000, 0.35)
    const tip = tutorialTip(id)
    if (!tip) return
    const { width, height } = this.scale
    const anchor = tip.anchor && this.anchors[tip.anchor]
    const title = this.add.text(0, 0, fillText(tip.title, this.gameState), { fontFamily: FONT, fontSize: '18px', color: GOLD })
    const body = this.add.text(0, 0, fillText(tip.text, this.gameState), {
      fontFamily: FONT,
      fontSize: '14px',
      color: TEXT,
      lineSpacing: 4,
      wordWrap: { width: TIP_W - 2 * TIP_PAD },
    })
    const panelH = TIP_PAD + 18 + 28 + body.height + 20 + BUTTON_H + TIP_PAD
    const left = (width - TIP_W) / 2
    const top = (height - panelH) / 2
    if (anchor) {
      // A line from the panel's nearest edge to a ring round the control.
      const g = this.add.graphics()
      const from = { x: Phaser.Math.Clamp(anchor.x, left, left + TIP_W), y: Phaser.Math.Clamp(anchor.y, top, top + panelH) }
      g.lineStyle(3, ANCHOR_COLOR, 0.9).lineBetween(from.x, from.y, anchor.x, anchor.y)
      g.lineStyle(4, ANCHOR_COLOR, 1).strokeCircle(anchor.x, anchor.y, 40)
      this.content.add(g)
      this.tweens.add({ targets: g, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 })
    }
    this.content.add(this.add.rectangle(left, top, TIP_W, panelH, PANEL_FILL, 0.97).setOrigin(0).setStrokeStyle(2, PANEL_EDGE))
    this.content.add([
      this.add.text(left + TIP_PAD, top + TIP_PAD, 'TUTORIAL', { fontFamily: FONT, fontSize: '11px', color: DIM }),
      title.setPosition(left + TIP_PAD, top + TIP_PAD + 16),
      body.setPosition(left + TIP_PAD, top + TIP_PAD + 46),
    ])
    const buttonY = top + panelH - TIP_PAD - BUTTON_H / 2
    this.button('next', { x: left + TIP_W - TIP_PAD - BUTTON_W / 2, y: buttonY, width: BUTTON_W, height: BUTTON_H }, 'Got it', () => this.next(), true)
    this.button('tutorialOff', { x: left + TIP_PAD + 90, y: buttonY, width: 180, height: BUTTON_H }, 'Turn tutorial off', () => this.turnTutorialOff())
  }

  private button(key: keyof StoryProbe['buttons'], at: Rect, label: string, onClick: () => void, marked = false): void {
    this.controls[key] = at
    // Next tick: the redraw a click leads to destroys the button whose handler this runs in.
    addPanelButton(this, this.content, at, label, () => this.time.delayedCall(0, onClick), { marked })
  }

  // ---- going on ----------------------------------------------------------------

  /** The next beat, or the next item, or back to the scene under the story. */
  private next(): void {
    const item = this.current()
    if (item?.kind === 'cutscene' && this.beat < CUTSCENES[item.id].beats.length - 1) {
      this.beat++
      this.render()
      return
    }
    this.advance()
  }

  /** Esc: the rest of a cutscene, or a tip, as if read. */
  private skip(): void {
    this.advance()
  }

  private advance(): void {
    this.index++
    this.beat = 0
    if (this.index < this.items.length) {
      this.render()
      return
    }
    this.scene.stop()
    this.scene.resume(this.resumeKey)
  }

  /** Turns the tutorial off for this game, and drops the tips still waiting; the menu's options turn it back on. */
  private turnTutorialOff(): void {
    setTutorial(this.gameState, false)
    this.items = this.items.filter((item, i) => i < this.index || item.kind !== 'tip')
    // The tip showing is dropped too, so the item after it is now at `index`.
    this.index--
    this.advance()
  }
}
