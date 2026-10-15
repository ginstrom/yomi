import Phaser from 'phaser'
import { ATTRIBUTES, ATTRIBUTE_IDS } from '../character/attributes.ts'
import { STARTING_KIT, deriveCombatStats, type Character } from '../character/character.ts'
import {
  CREATION_ATTRIBUTE_POINTS,
  CREATION_PERK_PICKS,
  CREATION_SKILL_POINTS,
  MAX_NAME_LENGTH,
  adjustAttribute,
  adjustSkill,
  attributePointsLeft,
  canAdjustAttribute,
  canAdjustSkill,
  copyDraft,
  draftCasts,
  draftCharacter,
  draftPerkRanks,
  draftProblems,
  newDraft,
  perkPicksLeft,
  skillPointsLeft,
  spellPicksLeft,
  tagSkill,
  togglePerk,
  typeInName,
  type CharacterDraft,
  type DraftChange,
} from '../character/creation.ts'
import type { PerkId } from '../character/perks.ts'
import { PORTRAIT_IDS } from '../character/portraits.ts'
import { SKILLS, SKILL_IDS, TAGGED_SKILL_STEP, TAG_BONUS, skillLevel } from '../character/skills.ts'
import type { ButtonProbe, CreationProbe, CreationStep } from '../testHook.ts'
import type { Point } from './boardGeometry.ts'
import type { Rect } from './mapScroll.ts'
import { addPanelButton, type PanelButtonLook } from './panelButton.ts'
import { PartyColumn } from './PartyColumn.ts'
import { PORTRAIT_SCALE, PORTRAIT_SIZE, portraitKey } from './partyPanel.ts'
import { draftNodeHint, type TreeKind } from './perkTree.ts'
import { SPELLCASTING_SPELL_PICKS } from '../character/progression.ts'
import { PERK_TREE_W, PerkTreeView } from './PerkTreeView.ts'

interface CreationData {
  /** The party being built, which the screen hands back with its character added or changed. */
  drafts: CharacterDraft[]
  /** The place of the member to edit; absent, a new character is created. */
  index?: number
}

const STEPS: ReadonlyArray<readonly [step: CreationStep, label: string]> = [
  ['attributes', 'Attributes'],
  ['skills', 'Skills'],
  ['perks', 'Perks'],
  ['name', 'Name'],
]

/** The panel is the size of the character panel, so it fits the least window (MIN_GAME_SIZE in main.ts). */
const PANEL_W = 720
const PANEL_H = 500
const LEFT = 24
const TAB_W = 130
const TAB_PITCH = 142
const TAB_Y = 24
const HEADING_Y = 50

/** The attributes step: a row for each, with its buttons at the right of the content. */
const ATTRIBUTE_ROW_Y = 96
const ATTRIBUTE_ROW_H = 56
const STEPPER = 26
/** A plus or minus held down repeats as a held key does: after a pause, then quickly. */
const HOLD_REPEAT_DELAY_MS = 400
const HOLD_REPEAT_INTERVAL_MS = 70
const ATTRIBUTE_MINUS_X = 430
const ATTRIBUTE_PLUS_X = 486

/** The skills step. */
const SKILL_ROW_Y = 116
const SKILL_ROW_H = 100
const TAG_X = 322
const SKILL_MINUS_X = 392
const SKILL_PLUS_X = 452
const SKILL_LEVEL_X = PERK_TREE_W

/** The perks step: the tree is drawn for the character panel, which has a row of tabs more above it. */
const TREE_SHIFT_Y = -28
/** The perks step's switch between the perk tree and the spell tree, on its heading line. */
const TREE_SWITCH: Record<TreeKind, Rect> = {
  perks: { x: LEFT + 36, y: HEADING_Y + 8, width: 72, height: 24 },
  spells: { x: LEFT + 116, y: HEADING_Y + 8, width: 72, height: 24 },
}

/** The name step: the faces in two rows, and the name under them. */
const PORTRAIT_COLS = 4
const PORTRAIT_X = 66
const PORTRAIT_Y = 122
const PORTRAIT_PITCH = 84
const NAME_BOX: Rect = { x: LEFT + 140, y: 318, width: 280, height: 36 }

/** What the draft comes to, down the right of every step. */
const SUMMARY_X = PERK_TREE_W + 20
const SUMMARY_W = PANEL_W - SUMMARY_X - 16

const BUTTON_Y = 478
const CANCEL_BUTTON: Rect = { x: LEFT + 40, y: BUTTON_Y, width: 80, height: 28 }
const BACK_BUTTON: Rect = { x: 474, y: BUTTON_Y, width: 70, height: 28 }
const NEXT_BUTTON: Rect = { x: 552, y: BUTTON_Y, width: 70, height: 28 }
const CREATE_BUTTON: Rect = { x: 648, y: BUTTON_Y, width: 104, height: 28 }

const FONT = 'monospace'
const GOLD = '#e8c766'
const DIM = '#8a7a5a'
const TEXT = '#d8c9a3'
const WARN = '#e0a070'

const attributeRowY = (row: number): number => ATTRIBUTE_ROW_Y + row * ATTRIBUTE_ROW_H
const skillRowY = (row: number): number => SKILL_ROW_Y + row * SKILL_ROW_H
const stepper = (x: number, y: number): Rect => ({ x, y, width: STEPPER, height: STEPPER })
const tabAt = (index: number): Rect => ({
  x: PANEL_W / 2 + (index - (STEPS.length - 1) / 2) * TAB_PITCH,
  y: TAB_Y,
  width: TAB_W,
  height: 28,
})
const portraitAt = (index: number): Point => ({
  x: PORTRAIT_X + (index % PORTRAIT_COLS) * PORTRAIT_PITCH,
  y: PORTRAIT_Y + Math.floor(index / PORTRAIT_COLS) * PORTRAIT_PITCH,
})

/**
 * Character creation, opened from the party screen for a new character or for
 * one being edited: attributes, skills, perks, then a name and a face. It
 * holds a draft and the step shown; every control calls a function of
 * creation.ts and the screen is redrawn from the character the draft makes,
 * so it decides nothing and cannot disagree with the game.
 */
export class CreationScene extends Phaser.Scene {
  private drafts: CharacterDraft[] = []
  /** The place being edited, or null for a new character. */
  private index: number | null = null
  private draft: CharacterDraft = newDraft()
  private step: CreationStep = 'attributes'
  /** Which tree the perks step shows. */
  private tree: TreeKind = 'perks'
  /** What the last change dropped or refused. */
  private notes: string[] = []
  /** The plus or minus being held down, and the timer of its next repeat. */
  private held: { at: Rect; enabled: () => boolean; change: () => DraftChange; timer: Phaser.Time.TimerEvent } | null = null
  private bg!: Phaser.GameObjects.Rectangle
  private panel!: Phaser.GameObjects.Container
  private content!: Phaser.GameObjects.Container

  constructor() {
    super('Creation')
  }

  preload(): void {
    PartyColumn.preload(this)
  }

  create(data: CreationData): void {
    this.drafts = (data?.drafts ?? []).map(copyDraft)
    this.index = data?.index ?? null
    this.draft = this.index === null ? newDraft() : copyDraft(this.drafts[this.index])
    this.step = 'attributes'
    this.tree = 'perks'
    this.notes = []
    this.held = null

    this.bg = this.add.rectangle(0, 0, 1, 1, 0x14100c, 1).setOrigin(0)
    this.panel = this.add.container(0, 0)
    this.panel.add(this.add.rectangle(PANEL_W / 2, PANEL_H / 2, PANEL_W, PANEL_H, 0x241d15, 0.98).setStrokeStyle(3, 0xc9a227))
    this.content = this.add.container(0, 0)
    this.panel.add(this.content)
    this.render()

    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
    })
    this.input.keyboard?.on('keydown-ESC', () => this.finish(this.drafts))
    for (const released of ['pointerup', 'pointerupoutside', 'gameout']) this.input.on(released, () => this.release())
    // The name is typed, while its step shows.
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event))
  }

  /** What the in-browser tests see of character creation; see testHook.ts. */
  probe(): CreationProbe {
    const { x, y, scale } = this.panel
    const onScreen = (at: Point): Point => ({ x: x + at.x * scale, y: y + at.y * scale })
    const button = (at: Rect, visible: boolean, enabled = true): ButtonProbe => ({
      ...onScreen(at),
      visible,
      enabled: visible && enabled,
    })
    const character = this.character()
    const shows = (step: CreationStep) => this.step === step
    return {
      step: this.step,
      editing: this.index !== null,
      draft: this.draft,
      attributePoints: attributePointsLeft(this.draft),
      skillPoints: skillPointsLeft(this.draft),
      perkPicks: perkPicksLeft(this.draft),
      spellPicks: spellPicksLeft(this.draft),
      tree: this.tree,
      treeSwitch: {
        perks: button(TREE_SWITCH.perks, shows('perks')),
        spells: button(TREE_SWITCH.spells, shows('perks')),
      },
      steps: Object.fromEntries(STEPS.map(([step], i) => [step, button(tabAt(i), true)])) as CreationProbe['steps'],
      attributes: Object.fromEntries(
        ATTRIBUTE_IDS.map((id, row) => [
          id,
          {
            value: this.draft.attributes[id],
            minus: button(stepper(ATTRIBUTE_MINUS_X, attributeRowY(row)), shows('attributes'), canAdjustAttribute(this.draft, id, -1)),
            plus: button(stepper(ATTRIBUTE_PLUS_X, attributeRowY(row)), shows('attributes'), canAdjustAttribute(this.draft, id, 1)),
          },
        ]),
      ) as CreationProbe['attributes'],
      skills: Object.fromEntries(
        SKILL_IDS.map((id, row) => [
          id,
          {
            level: skillLevel(character, id),
            placed: this.draft.raises[id],
            tagged: this.draft.tagged === id,
            tag: button(this.tagButton(row), shows('skills')),
            minus: button(stepper(SKILL_MINUS_X, skillRowY(row)), shows('skills'), canAdjustSkill(this.draft, id, -1)),
            plus: button(stepper(SKILL_PLUS_X, skillRowY(row)), shows('skills'), canAdjustSkill(this.draft, id, 1)),
          },
        ]),
      ) as CreationProbe['skills'],
      perks: PerkTreeView.nodeCentres(this.tree).map(({ perk, ...at }) => ({
        ...onScreen({ x: at.x, y: at.y + TREE_SHIFT_Y }),
        perk,
        ranks: draftPerkRanks(this.draft, perk),
        canClick: shows('perks') && this.perkClickable(perk),
      })),
      portraits: PORTRAIT_IDS.map((portrait, i) => ({
        ...onScreen(portraitAt(i)),
        portrait,
        picked: this.draft.portrait === portrait,
      })),
      buttons: {
        next: button(NEXT_BUTTON, true, this.stepIndex() < STEPS.length - 1),
        back: button(BACK_BUTTON, true, this.stepIndex() > 0),
        create: button(CREATE_BUTTON, shows('name'), this.problems().length === 0),
        cancel: button(CANCEL_BUTTON, true),
      },
      problem: shows('name') ? (this.problems()[0] ?? '') : '',
      notes: this.notes,
    }
  }

  // ---- what the draft comes to -------------------------------------------------

  private character(): Character {
    return draftCharacter(this.draft)
  }

  /** The other members' names, which this one may not take; its own, when it is edited, is no clash. */
  private takenNames(): string[] {
    return this.drafts.filter((_, i) => i !== this.index).map((draft) => draft.name.trim())
  }

  private problems(): string[] {
    return draftProblems(this.draft, this.takenNames())
  }

  private stepIndex(): number {
    return STEPS.findIndex(([step]) => step === this.step)
  }

  private perkClickable(perk: PerkId): boolean {
    return togglePerk(this.draft, perk).draft !== this.draft
  }

  private tagButton(row: number): Rect {
    return { x: TAG_X, y: skillRowY(row), width: 76, height: STEPPER }
  }

  // ---- build -----------------------------------------------------------------

  /** Draws the step shown from the draft as it now stands; rerun after each change. */
  private render(): void {
    this.content.removeAll(true)
    const character = this.character()
    STEPS.forEach(([step, label], i) =>
      this.button(tabAt(i), label, () => this.showStep(step), { marked: step === this.step }),
    )
    if (this.step === 'attributes') this.buildAttributes()
    else if (this.step === 'skills') this.buildSkills(character)
    else if (this.step === 'perks') this.buildPerks(character)
    else this.buildName()
    this.buildSummary(character)
    this.buildButtons()
  }

  private text(x: number, y: number, words: string, color = TEXT, fontSize = 14): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, words, { fontFamily: FONT, fontSize: `${fontSize}px`, color })
    this.content.add(text)
    return text
  }

  private button(at: Rect, label: string, onClick: () => void, look?: PanelButtonLook): void {
    // Next tick: the redraw a click leads to destroys the button whose handler this runs in.
    addPanelButton(this, this.content, at, label, () => this.time.delayedCall(0, onClick), look)
  }

  private heading(words: string, left: number, of: number, what: string): void {
    this.text(LEFT, HEADING_Y, words, DIM)
    this.text(PERK_TREE_W, HEADING_Y, `${what}: ${left} of ${of}`, left > 0 ? GOLD : DIM).setOrigin(1, 0)
  }

  private buildAttributes(): void {
    this.heading('All start at 1. Place every point.', attributePointsLeft(this.draft), CREATION_ATTRIBUTE_POINTS, 'Points left')
    ATTRIBUTE_IDS.forEach((id, row) => {
      const y = attributeRowY(row)
      this.text(LEFT, y - 16, ATTRIBUTES[id].name, TEXT, 15)
      this.text(LEFT, y + 4, ATTRIBUTES[id].description, DIM, 11)
      this.text((ATTRIBUTE_MINUS_X + ATTRIBUTE_PLUS_X) / 2, y, `${this.draft.attributes[id]}`, GOLD, 16).setOrigin(0.5)
      this.stepperButton(stepper(ATTRIBUTE_MINUS_X, y), '-', () => canAdjustAttribute(this.draft, id, -1), () => adjustAttribute(this.draft, id, -1))
      this.stepperButton(stepper(ATTRIBUTE_PLUS_X, y), '+', () => canAdjustAttribute(this.draft, id, 1), () => adjustAttribute(this.draft, id, 1))
    })
  }

  /** A plus or minus: `change` is asked anew at each press and repeat, and `enabled` whether there is another to make. */
  private stepperButton(at: Rect, label: string, enabled: () => boolean, change: () => DraftChange): void {
    const onPress = () => {
      this.hold(at, enabled, change)
      this.time.delayedCall(0, () => this.apply(change()))
    }
    addPanelButton(this, this.content, at, label, onPress, { enabled: enabled(), fontSize: 16 })
  }

  /**
   * Begins the repeats of a button just pressed. The hold is the scene's and
   * not the button's, which each change redraws; it ends when the pointer is
   * let go or leaves the button's place, or the button has nothing left to do.
   */
  private hold(at: Rect, enabled: () => boolean, change: () => DraftChange): void {
    this.release()
    const timer = this.time.delayedCall(HOLD_REPEAT_DELAY_MS, () => {
      if (!this.held) return
      this.held.timer = this.time.addEvent({ delay: HOLD_REPEAT_INTERVAL_MS, loop: true, callback: () => this.repeat() })
      this.repeat()
    })
    this.held = { at, enabled, change, timer }
  }

  private repeat(): void {
    if (!this.held) return
    const { at, enabled, change } = this.held
    const pointer = this.input.activePointer
    const { x, y, scale } = this.panel
    const over =
      Math.abs((pointer.x - x) / scale - at.x) <= at.width / 2 && Math.abs((pointer.y - y) / scale - at.y) <= at.height / 2
    if (!pointer.isDown || !over || !enabled()) {
      this.release()
      return
    }
    this.apply(change())
  }

  private release(): void {
    this.held?.timer.remove()
    this.held = null
  }

  private buildSkills(character: Character): void {
    this.heading(
      `Tag one skill: +${TAG_BONUS}%, and ${TAGGED_SKILL_STEP}% a point.`,
      skillPointsLeft(this.draft),
      CREATION_SKILL_POINTS,
      'Points left',
    )
    SKILL_IDS.forEach((id, row) => {
      const y = skillRowY(row)
      const tagged = this.draft.tagged === id
      this.text(LEFT, y - 20, SKILLS[id].name, tagged ? GOLD : TEXT, 15)
      this.text(LEFT, y + 2, SKILLS[id].description, DIM, 11).setWordWrapWidth(TAG_X - LEFT - 50)
      this.button(this.tagButton(row), tagged ? 'Tagged' : 'Tag', () => this.apply(tagSkill(this.draft, id)), { marked: tagged })
      this.stepperButton(stepper(SKILL_MINUS_X, y), '-', () => canAdjustSkill(this.draft, id, -1), () => adjustSkill(this.draft, id, -1))
      this.text((SKILL_MINUS_X + SKILL_PLUS_X) / 2, y, `${this.draft.raises[id]}`, TEXT, 15).setOrigin(0.5)
      this.stepperButton(stepper(SKILL_PLUS_X, y), '+', () => canAdjustSkill(this.draft, id, 1), () => adjustSkill(this.draft, id, 1))
      this.text(SKILL_LEVEL_X, y, `${skillLevel(character, id)}%`, GOLD, 16).setOrigin(1, 0.5)
    })
    this.text(LEFT, skillRowY(SKILL_IDS.length) - 30, 'Points left unplaced stay with the character, to spend on the world map.', DIM, 11)
  }

  /**
   * The perk tree or, by the switch over it, the spell tree; a click takes a
   * rank or gives the last back. Spells are bought with the picks
   * Spellcasting brings, then with perk picks.
   */
  private buildPerks(character: Character): void {
    for (const tree of ['perks', 'spells'] as const) {
      this.button(TREE_SWITCH[tree], tree === 'perks' ? 'Perks' : 'Spells', () => this.showTree(tree), { marked: this.tree === tree })
    }
    const perks = perkPicksLeft(this.draft)
    const counters = [`Perks: ${perks} of ${CREATION_PERK_PICKS}`]
    if (draftCasts(this.draft)) counters.push(`Spells: ${spellPicksLeft(this.draft)} of ${SPELLCASTING_SPELL_PICKS}`)
    const anyLeft = perks > 0 || spellPicksLeft(this.draft) > 0
    this.text(PERK_TREE_W, HEADING_Y, counters.join('   '), anyLeft ? GOLD : DIM).setOrigin(1, 0)
    const tree = this.add.container(0, TREE_SHIFT_Y)
    this.content.add(tree)
    new PerkTreeView(this, tree, {
      tree: this.tree,
      character,
      clickable: (perk) => this.perkClickable(perk),
      marked: (perk) => togglePerk(this.draft, perk).draft.perks.length > this.draft.perks.length,
      onClick: (perk) => this.time.delayedCall(0, () => this.apply(togglePerk(this.draft, perk))),
      hint: (perk) => draftNodeHint(this.draft, perk),
      rule:
        this.tree === 'perks'
          ? 'Three perks to begin with; click to take, again to give back. A line means the one before must be taken first.'
          : 'Spellcasting, a perk of Intelligence, brings 2 spells to choose and 1 every level. A line means the spell before must be learned first.',
    })
  }

  private showTree(tree: TreeKind): void {
    this.tree = tree
    this.render()
  }

  private buildName(): void {
    this.text(LEFT, HEADING_Y, 'Pick a face and type a name.', DIM)
    PORTRAIT_IDS.forEach((id, i) => {
      const { x, y } = portraitAt(i)
      const picked = this.draft.portrait === id
      const frame = this.add
        .rectangle(x, y, PORTRAIT_SIZE, PORTRAIT_SIZE)
        .setStrokeStyle(picked ? 3 : 2, picked ? 0xe8c766 : 0x6b5a3a)
        .setInteractive({ useHandCursor: true })
      frame.on('pointerdown', () => this.time.delayedCall(0, () => this.apply({ draft: { ...this.draft, portrait: id }, notes: [] })))
      this.content.add([this.add.image(x, y, portraitKey(id)).setScale(PORTRAIT_SCALE), frame])
    })

    this.text(LEFT, NAME_BOX.y - 44, 'Name', DIM)
    this.content.add(
      this.add.rectangle(NAME_BOX.x, NAME_BOX.y, NAME_BOX.width, NAME_BOX.height, 0x14100c, 0.9).setStrokeStyle(2, 0xc9a227),
    )
    this.text(NAME_BOX.x - NAME_BOX.width / 2 + 10, NAME_BOX.y, `${this.draft.name}_`, GOLD, 18).setOrigin(0, 0.5)
    this.text(LEFT, NAME_BOX.y + 26, `Letters, spaces, - and ', up to ${MAX_NAME_LENGTH}. Backspace removes.`, DIM, 11)

    const kit = STARTING_KIT[this.draft.tagged ?? 'melee']
    const held = [kit.mainHand.name, ...(kit.offHand ? [kit.offHand.name] : [])].join(' and ')
    this.text(
      LEFT,
      NAME_BOX.y + 56,
      `Starts with the weapon of its tagged skill (${held}), a steel breastplate, and the other plain weapons in its backpack.`,
      DIM,
      11,
    ).setWordWrapWidth(PERK_TREE_W - LEFT)
  }

  /** What the draft comes to: its character's numbers, which are the game's own. */
  private buildSummary(character: Character): void {
    const stats = deriveCombatStats(character)
    const left = [attributePointsLeft(this.draft), skillPointsLeft(this.draft), perkPicksLeft(this.draft), spellPicksLeft(this.draft)]
    this.text(SUMMARY_X, HEADING_Y, character.name || (this.index === null ? 'New character' : 'Unnamed'), GOLD, 15)
    const lines = [
      `Hit Points    ${stats.maxHp}`,
      `Action Points ${stats.actionPoints}`,
      `Armor Class   ${stats.ac}`,
      `Critical      ${stats.critChance}%`,
      `Mana          ${stats.magic ? stats.magic.maxMana : '-'}`,
      '',
      ...SKILL_IDS.map((id) => `${SKILLS[id].name.padEnd(13)} ${skillLevel(character, id)}%`),
      '',
      `Left to place:`,
      `  attributes  ${left[0]}`,
      `  skills      ${left[1]}`,
      `  perks       ${left[2]}`,
      ...(draftCasts(this.draft) ? [`  spells      ${left[3]}`] : []),
    ]
    const body = this.text(SUMMARY_X, HEADING_Y + 28, lines.join('\n'), TEXT, 12).setLineSpacing(5)
    this.text(SUMMARY_X, body.y + body.height + 14, this.notes.join('\n'), WARN, 11).setWordWrapWidth(SUMMARY_W)
  }

  private buildButtons(): void {
    const last = this.stepIndex() === STEPS.length - 1
    this.button(CANCEL_BUTTON, 'Cancel', () => this.finish(this.drafts))
    this.button(BACK_BUTTON, 'Back', () => this.showStep(STEPS[this.stepIndex() - 1][0]), { enabled: this.stepIndex() > 0 })
    this.button(NEXT_BUTTON, 'Next', () => this.showStep(STEPS[this.stepIndex() + 1][0]), { enabled: !last })
    if (!last) return
    const problems = this.problems()
    this.button(CREATE_BUTTON, this.index === null ? 'Create' : 'Save', () => this.onCreate(), {
      enabled: problems.length === 0,
      marked: true,
    })
    this.text(CANCEL_BUTTON.x + CANCEL_BUTTON.width / 2 + 14, BUTTON_Y, problems[0] ?? '', WARN, 12)
      .setOrigin(0, 0.5)
      .setWordWrapWidth(BACK_BUTTON.x - BACK_BUTTON.width / 2 - CANCEL_BUTTON.x - CANCEL_BUTTON.width / 2 - 28)
  }

  // ---- layout ----------------------------------------------------------------

  private layout(): void {
    const { width, height } = this.scale
    this.bg.setSize(width, height)
    const scale = Math.max(0, Math.min(1, (width - 32) / PANEL_W, (height - 32) / PANEL_H))
    this.panel.setScale(scale).setPosition((width - PANEL_W * scale) / 2, (height - PANEL_H * scale) / 2)
  }

  // ---- actions ---------------------------------------------------------------

  /** Takes a change to the draft, with what it dropped or refused, and redraws. */
  private apply({ draft, notes }: DraftChange): void {
    this.draft = draft
    this.notes = notes
    this.render()
  }

  private showStep(step: CreationStep): void {
    this.release()
    this.step = step
    this.render()
  }

  private onKey(event: KeyboardEvent): void {
    if (this.step !== 'name') return
    const name = typeInName(this.draft.name, event.key)
    if (name === this.draft.name) return
    // Space would scroll a page that scrolls, and Backspace go back in some browsers.
    event.preventDefault()
    this.draft = { ...this.draft, name }
    this.render()
  }

  /** Create adds the character at the end of the party; Save puts the edited one back in its place. */
  private onCreate(): void {
    if (this.problems().length > 0) return
    const made = { ...this.draft, name: this.draft.name.trim() }
    this.finish(this.index === null ? [...this.drafts, made] : this.drafts.map((draft, i) => (i === this.index ? made : draft)))
  }

  /** Back to the party screen's roster with the party as it now is. */
  private finish(drafts: CharacterDraft[]): void {
    this.scene.start('Party', { drafts })
  }
}
