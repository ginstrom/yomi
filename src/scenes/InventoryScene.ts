import Phaser from 'phaser'
import { ATTRIBUTES, ATTRIBUTE_IDS } from '../character/attributes.ts'
import {
  deriveCombatStats,
  dropEquipped,
  dropFromBackpack,
  equipFromBackpack,
  isTwoHanded,
  pickUp,
  unequipToBackpack,
  type Character,
} from '../character/character.ts'
import { PERKS, PERK_IDS, describePerkRequirements, perkRanks, qualifiesFor, type PerkId } from '../character/perks.ts'
import { nextPerkLevel, takePerk, xpToNextLevel } from '../character/progression.ts'
import {
  MASTERY_COST,
  MASTERY_LEVEL,
  SKILLS,
  SKILL_IDS,
  TAGGED_SKILL_STEP,
  isTagged,
  raiseSkill,
  skillLevel,
  skillRaiseCost,
  type SkillId,
} from '../character/skills.ts'
import { formatDamage, type CombatantStats } from '../combat/combat.ts'
import { EQUIPMENT_SLOT_LABELS, describeItemStats, type EquipmentSlot, type Item } from '../inventory/inventory.ts'
import type { InventoryProbe } from '../testHook.ts'
import type { Point } from './boardGeometry.ts'
import { ITEM_ICON_KEYS, ITEM_ICON_SCALE } from './itemIcons.ts'
import { soundVolume } from './audioSettings.ts'
import { isSecondaryClick } from './clicks.ts'
import { PartyColumn } from './PartyColumn.ts'
import { PARTY_PANEL_W, portraitKey } from './partyPanel.ts'
import { SlotScroll } from './slotScroll.ts'

type PanelTab = InventoryProbe['tab']
const TABS: ReadonlyArray<readonly [tab: PanelTab, label: string]> = [
  ['character', 'Character'],
  ['skills', 'Skills'],
  ['inventory', 'Inventory'],
]

/** A party member the panel can show, and what it may do with its gear there. */
export interface PanelMember {
  character: Character
  /**
   * What changing gear costs in action points, charged once by the battle when
   * the panel closes however many items were moved; 0 if already paid for.
   * Null or absent makes the member's gear view-only.
   */
  gearApCost?: number | null
  /** The pile on the hex the character stands on, which drops go onto and pick-ups come off. */
  ground?: Item[]
}

interface InventoryData {
  /** The whole party in its order, each with a portrait beside the panel that turns the panel to it. */
  members: PanelMember[]
  /** The member the panel opens on. */
  index?: number
  tab?: PanelTab
  /** Whether skill points and perks can be spent here: on the world map, not in the thick of a battle. */
  canAdvance?: boolean
  /** The scene the panel lies over, resumed when it closes. */
  resume?: 'Battle' | 'World'
}

const PANEL_W = 720
const PANEL_H = 500
const SLOT_SIZE = 46
const DOLL_X = 190
const DOLL_Y = 210
const STATS_X = 440
/** The backpack sits under the paperdoll and the ground under the stats. */
const BACKPACK_COLS = 6
const GROUND_COLS = 5
const GROUND_ROWS = 2
const SLOT_GAP = 8
const SLOT_TITLE_Y = 367
const SLOT_GRID_Y = 404
const SCROLLBAR_W = 8
const TAB_W = 140
const TAB_H = 32
const TAB_SPACING = TAB_W + 12

/** The character tab: attributes beside the portrait, and what they come to beside those. */
const PORTRAIT_X = 110
const PORTRAIT_Y = 216
/** The portrait is shown twice the size it has in the party's column. */
const PORTRAIT_SCALE = 4
const ATTRIBUTES_X = 215
const ATTRIBUTES_W = 250
const ATTRIBUTE_ROW_H = 36
const COMBAT_X = 490
const SHEET_Y = 140

/** The skills tab: skills down the left, each with a button to raise it, and every perk down the right. */
const SKILLS_X = 24
const SKILLS_W = 320
const SKILL_ROW_Y = 104
const SKILL_ROW_H = 52
const RAISE_SIZE = 22
const PERKS_X = 368
const PERKS_W = PANEL_W - PERKS_X - 20
const PERK_ROW_Y = 104
const PERK_ROW_H = 38

const FONT = 'monospace'
const GOLD = '#e8c766'
const DIM = '#8a7a5a'
const TEXT = '#d8c9a3'
const FAINT = '#665a44'

interface TabButton {
  bg: Phaser.GameObjects.Rectangle
  text: Phaser.GameObjects.Text
}

/** The x of the first column of a grid of slots centred on `centerX`. */
function gridStartX(centerX: number, cols: number): number {
  return centerX - ((cols - 1) * (SLOT_SIZE + SLOT_GAP)) / 2
}

/** Centre of the `index`th slot of a grid whose first column is at `startX`. */
function slotPosition(startX: number, index: number, cols: number): { x: number; y: number } {
  return {
    x: startX + (index % cols) * (SLOT_SIZE + SLOT_GAP),
    y: SLOT_GRID_Y + Math.floor(index / cols) * (SLOT_SIZE + SLOT_GAP),
  }
}

export class InventoryScene extends Phaser.Scene {
  private activeTab: PanelTab = 'inventory'
  private members: PanelMember[] = []
  /** Which of `members` the panel shows; the fields below are that member's. */
  private index = 0
  private column!: PartyColumn
  private character!: Character
  private stats!: CombatantStats
  private gearApCost: number | null = null
  private ground: Item[] = []
  private canAdvance = false
  private resumeKey: NonNullable<InventoryData['resume']> = 'Battle'
  /** Each equipment slot's centre, in the panel's own pixels. */
  private slotCentres = new Map<EquipmentSlot, Point>()
  /** Which rows of the ground pile the grid shows. */
  private groundScroll = new SlotScroll(GROUND_COLS, GROUND_ROWS)
  private dimBg!: Phaser.GameObjects.Rectangle
  private panel!: Phaser.GameObjects.Container
  private characterContent!: Phaser.GameObjects.Container
  private skillsContent!: Phaser.GameObjects.Container
  private inventoryContent!: Phaser.GameObjects.Container
  private tabButtons: Record<PanelTab, TabButton> = {} as Record<PanelTab, TabButton>
  private tooltip!: Phaser.GameObjects.Container
  private tooltipText!: Phaser.GameObjects.Text
  private tooltipBg!: Phaser.GameObjects.Rectangle

  constructor() {
    super('Inventory')
  }

  preload(): void {
    for (const key of Object.values(ITEM_ICON_KEYS)) this.load.image(key, `assets/sprites/${key}.png`)
    PartyColumn.preload(this)
  }

  create(data: InventoryData): void {
    this.members = data.members
    this.canAdvance = data.canAdvance ?? false
    this.resumeKey = data.resume ?? 'Battle'
    this.setMember(data.index ?? 0)
    // Right-clicking an item drops it.
    this.input.mouse?.disableContextMenu()

    this.dimBg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.6).setOrigin(0.5)
    // Over the dimmed scene's own column, which is paused with its scene and takes no clicks.
    this.column = new PartyColumn(
      this,
      this.members.map((member) => member.character),
      (index) => this.switchTo(index),
    )
    this.column.refresh(this.index)
    this.panel = this.add.container(0, 0)

    this.buildFrame()
    this.buildTabs()

    this.characterContent = this.add.container(0, 0)
    this.skillsContent = this.add.container(0, 0)
    this.inventoryContent = this.add.container(0, 0)
    this.panel.add([this.characterContent, this.skillsContent, this.inventoryContent])
    this.buildContent()

    this.showTab(data?.tab ?? 'inventory')

    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    // Phaser doesn't call a shutdown() method on scenes; it only emits SHUTDOWN.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
    })

    this.input.keyboard?.on('keydown-I', () => this.onTabKey('inventory'))
    this.input.keyboard?.on('keydown-C', () => this.onTabKey('character'))
    this.input.keyboard?.on('keydown-S', () => this.onTabKey('skills'))
    this.input.keyboard?.on('keydown-ESC', () => this.close())
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) =>
      this.onWheel(dy),
    )
  }

  /** What the in-browser tests see of the panel; see testHook.ts. */
  probe(): InventoryProbe {
    const onScreen = ({ x, y }: Point): Point => ({
      x: this.panel.x + x * this.panel.scale,
      y: this.panel.y + y * this.panel.scale,
    })
    const { equipment, backpack } = this.character
    const startX = gridStartX(DOLL_X, BACKPACK_COLS)
    return {
      tab: this.activeTab,
      party: this.column.probe(),
      skillPoints: this.character.skillPoints,
      perkPicks: this.character.perkPicks,
      skills: Object.fromEntries(
        SKILL_IDS.map((id, row) => [
          id,
          { ...onScreen(this.raiseButtonAt(row)), level: skillLevel(this.character, id), canRaise: this.canRaise(id) },
        ]),
      ) as InventoryProbe['skills'],
      perks: PERK_IDS.map((id, row) => ({
        ...onScreen({ x: PERKS_X + PERKS_W / 2, y: PERK_ROW_Y + row * PERK_ROW_H }),
        perk: id,
        ranks: perkRanks(this.character, id),
        canTake: this.canTake(id),
      })),
      equipment: Object.fromEntries(
        [...this.slotCentres].map(([slot, at]) => [slot, { ...onScreen(at), item: equipment[slot]?.id ?? null }]),
      ) as InventoryProbe['equipment'],
      backpack: backpack.flatMap((item, i) =>
        item ? [{ ...onScreen(slotPosition(startX, i, BACKPACK_COLS)), item: item.id }] : [],
      ),
    }
  }

  /** Turns the panel's fields to the `index`th member; `buildContent` then draws it. */
  private setMember(index: number): void {
    const member = this.members[index]
    this.index = index
    this.character = member.character
    this.gearApCost = member.gearApCost ?? null
    this.ground = member.ground ?? []
    this.groundScroll = new SlotScroll(GROUND_COLS, GROUND_ROWS)
  }

  /** A click on a portrait turns the panel to that member, on the tab it is showing. */
  private switchTo(index: number): void {
    if (index === this.index) return
    this.setMember(index)
    this.buildContent()
  }

  /** Draws every tab from the character as it now stands; rerun after each change to it. */
  private buildContent(): void {
    this.stats = deriveCombatStats(this.character)
    this.column.refresh(this.index)
    this.characterContent.removeAll(true)
    this.skillsContent.removeAll(true)
    this.inventoryContent.removeAll(true)
    this.buildCharacterTab()
    this.buildSkills()
    this.buildPerks()
    this.buildPaperdoll()
    this.buildStats()
    this.buildGearHint()
    this.buildBackpack()
    this.buildGround()
    this.buildTooltip()
  }

  // ---- build: frame & tabs -------------------------------------------------

  private buildFrame(): void {
    const panelBg = this.add
      .rectangle(PANEL_W / 2, PANEL_H / 2, PANEL_W, PANEL_H, 0x241d15, 0.98)
      .setStrokeStyle(3, 0xc9a227)
    const hint = this.add
      .text(PANEL_W - 16, 26, '[ESC] Close', { fontFamily: 'monospace', fontSize: '12px', color: '#8a7a5a' })
      .setOrigin(1, 0.5)
    this.panel.add([panelBg, hint])
  }

  private buildTabs(): void {
    TABS.forEach(([tab, label], i) => {
      const x = PANEL_W / 2 + (i - (TABS.length - 1) / 2) * TAB_SPACING
      this.tabButtons[tab] = this.createTabButton(label, x, 26, tab)
    })
  }

  private createTabButton(label: string, x: number, y: number, tab: PanelTab): TabButton {
    const bg = this.add.rectangle(x, y, TAB_W, TAB_H, 0x1b1712, 0.95).setStrokeStyle(2, 0x6b5a3a)
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerdown', () => {
      this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
      this.showTab(tab)
    })
    const text = this.add
      .text(x, y, label, { fontFamily: 'monospace', fontSize: '15px', color: '#8a7a5a' })
      .setOrigin(0.5)
    this.panel.add([bg, text])
    return { bg, text }
  }

  private showTab(tab: PanelTab): void {
    this.activeTab = tab
    this.characterContent.setVisible(tab === 'character')
    this.skillsContent.setVisible(tab === 'skills')
    this.inventoryContent.setVisible(tab === 'inventory')
    if (tab !== 'inventory') this.hideTooltip()

    for (const key of Object.keys(this.tabButtons) as PanelTab[]) {
      const active = key === tab
      const button = this.tabButtons[key]
      button.bg.setStrokeStyle(2, active ? 0xc9a227 : 0x6b5a3a)
      button.text.setColor(active ? '#e8c766' : '#8a7a5a')
    }
  }

  // ---- build: character tab -------------------------------------------------

  private buildCharacterTab(): void {
    const title = this.add
      .text(PANEL_W / 2, 70, this.character.name, { fontFamily: FONT, fontSize: '26px', color: GOLD })
      .setOrigin(0.5)
    const subtitle = this.add
      .text(PANEL_W / 2, 98, this.classLine(), { fontFamily: FONT, fontSize: '14px', color: DIM })
      .setOrigin(0.5)
    this.characterContent.add([title, subtitle])

    const portrait = this.add
      .image(PORTRAIT_X, PORTRAIT_Y, portraitKey(this.character.portrait))
      .setScale(PORTRAIT_SCALE)
    const portraitFrame = this.add
      .rectangle(PORTRAIT_X, PORTRAIT_Y, portrait.displayWidth, portrait.displayHeight)
      .setStrokeStyle(2, 0x6b5a3a)
    this.characterContent.add([portrait, portraitFrame])

    this.characterContent.add(this.heading('Attributes', ATTRIBUTES_X, SHEET_Y))
    ATTRIBUTE_IDS.forEach((id, row) => {
      const y = SHEET_Y + 26 + row * ATTRIBUTE_ROW_H
      const { name, description } = ATTRIBUTES[id]
      this.characterContent.add([
        this.add.text(ATTRIBUTES_X, y, name, { fontFamily: FONT, fontSize: '15px', color: TEXT }),
        this.add
          .text(ATTRIBUTES_X + ATTRIBUTES_W, y, `${this.character.attributes[id]}`, {
            fontFamily: FONT,
            fontSize: '15px',
            color: GOLD,
          })
          .setOrigin(1, 0),
        this.add.text(ATTRIBUTES_X, y + 18, description, { fontFamily: FONT, fontSize: '11px', color: DIM }),
      ])
    })

    // Top-aligned with the attributes, so the block ends clear of the badges below.
    const lines = [...this.statLines(), `Critical:      ${this.stats.critChance}%`]
    this.characterContent.add([
      this.heading('In battle', COMBAT_X, SHEET_Y),
      this.add.text(COMBAT_X, SHEET_Y + 26, lines.join('\n'), {
        fontFamily: FONT,
        fontSize: '14px',
        color: TEXT,
        lineSpacing: 12,
      }),
    ])

    this.buildCharacterBadges(440)
  }

  private heading(label: string, x: number, y: number): Phaser.GameObjects.Text {
    return this.add.text(x, y, label, { fontFamily: FONT, fontSize: '14px', color: DIM })
  }

  private buildCharacterBadges(y: number): void {
    const badges: Array<{ label: string; value: string }> = [
      { label: 'AC', value: `${this.stats.ac}` },
      { label: 'HP', value: `${this.character.hp}/${this.stats.maxHp}` },
      { label: 'HIT', value: `${this.stats.toHit}%` },
    ]
    const badgeW = 90
    const badgeH = 56
    const gap = 14
    const centerX = PANEL_W / 2
    const totalW = badges.length * badgeW + (badges.length - 1) * gap
    const startX = centerX - totalW / 2 + badgeW / 2

    badges.forEach((badge, i) => {
      const x = startX + i * (badgeW + gap)
      const bg = this.add.rectangle(x, y, badgeW, badgeH, 0x1b1712, 0.9).setStrokeStyle(2, 0x6b5a3a)
      const label = this.add
        .text(x, y - 14, badge.label, { fontFamily: 'monospace', fontSize: '11px', color: '#8a7a5a' })
        .setOrigin(0.5)
      const value = this.add
        .text(x, y + 10, badge.value, { fontFamily: 'monospace', fontSize: '16px', color: '#e8c766' })
        .setOrigin(0.5)
      this.characterContent.add([bg, label, value])
    })
  }

  // ---- build: skills tab -------------------------------------------------

  /** Whether a click would raise `skill` now. */
  private canRaise(skill: SkillId): boolean {
    const cost = skillRaiseCost(this.character, skill)
    return this.canAdvance && cost !== null && cost <= this.character.skillPoints
  }

  /** Whether a click would take a rank of `perk` now. */
  private canTake(perk: PerkId): boolean {
    return this.canAdvance && this.character.perkPicks > 0 && qualifiesFor(this.character, perk)
  }

  /** The centre of the button that raises the skill in the `row`th row. */
  private raiseButtonAt(row: number): Point {
    return { x: SKILLS_X + SKILLS_W - RAISE_SIZE / 2, y: SKILL_ROW_Y + row * SKILL_ROW_H }
  }

  private buildSkills(): void {
    const { skillPoints } = this.character
    const points = this.add
      .text(SKILLS_X + SKILLS_W, 66, `Skill points: ${skillPoints}`, {
        fontFamily: FONT,
        fontSize: '14px',
        color: skillPoints > 0 ? GOLD : DIM,
      })
      .setOrigin(1, 0)
    this.skillsContent.add([this.heading('Skills', SKILLS_X, 66), points])

    SKILL_IDS.forEach((id, row) => {
      const button = this.raiseButtonAt(row)
      const tagged = isTagged(this.character, id)
      const { name, description } = SKILLS[id]
      this.skillsContent.add([
        this.add
          .text(SKILLS_X, button.y, tagged ? `${name} (tagged)` : name, {
            fontFamily: FONT,
            fontSize: '14px',
            color: tagged ? GOLD : TEXT,
          })
          .setOrigin(0, 0.5),
        this.add
          .text(button.x - RAISE_SIZE, button.y, `${skillLevel(this.character, id)}%`, {
            fontFamily: FONT,
            fontSize: '14px',
            color: GOLD,
          })
          .setOrigin(1, 0.5),
        this.add.text(SKILLS_X, button.y + 10, description, {
          fontFamily: FONT,
          fontSize: '11px',
          color: DIM,
          wordWrap: { width: SKILLS_W - RAISE_SIZE - 6 },
        }),
      ])
      if (this.canAdvance && skillPoints > 0) this.buildRaiseButton(id, button)
    })

    const rules = [
      `A skill point raises a skill by 1%, or a tagged one by ${TAGGED_SKILL_STEP}%. From ${MASTERY_LEVEL}% on, a raise costs ${MASTERY_COST} points.`,
      this.canAdvance
        ? 'Every level brings skill points.'
        : 'Skill points and perks are spent on the world map, in this panel.',
    ]
    this.skillsContent.add(
      this.add.text(SKILLS_X, SKILL_ROW_Y + SKILL_IDS.length * SKILL_ROW_H, rules.join('\n\n'), {
        fontFamily: FONT,
        fontSize: '12px',
        color: DIM,
        wordWrap: { width: SKILLS_W },
      }),
    )
  }

  /** The "+" beside a skill, dimmed when the points left do not cover the raise. */
  private buildRaiseButton(skill: SkillId, { x, y }: Point): void {
    const enabled = this.canRaise(skill)
    const bg = this.add
      .rectangle(x, y, RAISE_SIZE, RAISE_SIZE, 0x1b1712, 0.95)
      .setStrokeStyle(2, enabled ? 0xc9a227 : 0x4a3d28)
    const plus = this.add
      .text(x, y, '+', { fontFamily: FONT, fontSize: '16px', color: enabled ? GOLD : FAINT })
      .setOrigin(0.5)
    this.skillsContent.add([bg, plus])
    if (!enabled) return
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerdown', () => this.advance(() => raiseSkill(this.character, skill)))
  }

  /** Every perk there is: the ranks taken, what each asks, and a click to take one when a pick is waiting. */
  private buildPerks(): void {
    const { perkPicks } = this.character
    const status =
      perkPicks > 0 && this.canAdvance
        ? `Choose ${perkPicks === 1 ? 'a perk' : `${perkPicks} perks`}`
        : perkPicks > 0
          ? `${perkPicks} to choose`
          : `Next at level ${nextPerkLevel(this.character)}`
    this.skillsContent.add([
      this.heading('Perks', PERKS_X, 66),
      this.add
        .text(PERKS_X + PERKS_W, 66, status, { fontFamily: FONT, fontSize: '14px', color: perkPicks > 0 ? GOLD : DIM })
        .setOrigin(1, 0),
    ])

    PERK_IDS.forEach((id, row) => {
      const y = PERK_ROW_Y + row * PERK_ROW_H
      const { name, description, ranks } = PERKS[id]
      const taken = perkRanks(this.character, id)
      const open = this.canTake(id)
      const within = taken < ranks && qualifiesFor(this.character, id)
      const bg = this.add
        .rectangle(PERKS_X + PERKS_W / 2, y, PERKS_W, PERK_ROW_H - 4, 0x1b1712, open ? 0.95 : 0.5)
        .setStrokeStyle(open ? 2 : 1, open ? 0xc9a227 : 0x4a3d28)
      const rank = ranks > 1 || taken > 0 ? ` ${taken}/${ranks}` : ''
      // What it asks is shown until the character meets it; a perk in hand shows its ranks alone.
      const note = taken >= ranks ? 'taken' : within ? '' : describePerkRequirements(id)
      this.skillsContent.add([
        bg,
        this.add.text(PERKS_X + 8, y - 15, `${name}${rank}`, {
          fontFamily: FONT,
          fontSize: '13px',
          color: taken > 0 ? GOLD : within ? TEXT : DIM,
        }),
        this.add
          .text(PERKS_X + PERKS_W - 8, y - 14, note, { fontFamily: FONT, fontSize: '11px', color: FAINT })
          .setOrigin(1, 0),
        this.add.text(PERKS_X + 8, y + 1, description, {
          fontFamily: FONT,
          fontSize: '11px',
          color: within || taken > 0 ? DIM : FAINT,
        }),
      ])
      if (!open) return
      bg.setInteractive({ useHandCursor: true })
      bg.on('pointerover', () => bg.setFillStyle(0x3a2f1c, 0.95))
      bg.on('pointerout', () => bg.setFillStyle(0x1b1712, 0.95))
      bg.on('pointerdown', () => this.advance(() => takePerk(this.character, id)))
    })
  }

  // ---- build: inventory tab -------------------------------------------------

  private buildPaperdoll(): void {
    const dollBoxBg = this.add
      .rectangle(DOLL_X, DOLL_Y, 150, 210, 0x14100c, 0.8)
      .setStrokeStyle(2, 0x4a3d28)
    this.inventoryContent.add(dollBoxBg)

    const doll = this.add.image(DOLL_X, DOLL_Y + 95, 'warrior').setOrigin(0.5, 1)
    const dollScale = Math.floor(Math.min(140 / doll.width, 180 / doll.height))
    doll.setScale(dollScale)
    this.inventoryContent.add(doll)

    const leftX = DOLL_X - 115
    const rightX = DOLL_X + 115
    const rowYs = [90, 150, 210, 270]

    this.createSlot(leftX, rowYs[0], 'head')
    this.createSlot(leftX, rowYs[1], 'armor')
    this.createSlot(leftX, rowYs[2], 'mainHand')
    this.createSlot(leftX, rowYs[3], 'gloves')

    this.createSlot(rightX, rowYs[0], 'neck')
    this.createSlot(rightX, rowYs[1], 'cloak')
    this.createSlot(rightX, rowYs[2], 'offHand')
    this.createSlot(rightX, rowYs[3], 'belt')

    this.createSlot(DOLL_X - 60, 330, 'boots')
    this.createSlot(DOLL_X, 330, 'ring1')
    this.createSlot(DOLL_X + 60, 330, 'ring2')
  }

  private createSlot(x: number, y: number, slot: EquipmentSlot): void {
    const { equipment } = this.character
    // A two-handed weapon fills the off hand too, shown there as a ghost of the weapon.
    const ghost = slot === 'offHand' && !equipment.offHand && isTwoHanded(equipment.mainHand)
    const heldIn: EquipmentSlot = ghost ? 'mainHand' : slot
    this.slotCentres.set(slot, { x, y })
    const item = equipment[heldIn]
    const bg = this.add.rectangle(x, y, SLOT_SIZE, SLOT_SIZE, 0x1b1712, 0.9).setStrokeStyle(2, 0x6b5a3a)
    this.inventoryContent.add(bg)

    if (item) {
      const icon = this.add.image(x, y, ITEM_ICON_KEYS[item.icon]).setScale(ITEM_ICON_SCALE)
      if (ghost) icon.setAlpha(0.35)
      this.inventoryContent.add(icon)

      bg.setInteractive({ useHandCursor: true })
      bg.on('pointerover', () => {
        bg.setStrokeStyle(2, 0xc9a227)
        this.showTooltip(item, x, y - SLOT_SIZE / 2 - 10)
      })
      bg.on('pointerout', () => {
        bg.setStrokeStyle(2, 0x6b5a3a)
        this.hideTooltip()
      })
      bg.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
        this.changeGear(() =>
          isSecondaryClick(pointer)
            ? dropEquipped(this.character, heldIn, this.ground)
            : unequipToBackpack(this.character, heldIn),
        ),
      )
    } else {
      const label = this.add
        .text(x, y, EQUIPMENT_SLOT_LABELS[slot], {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#665a44',
        })
        .setOrigin(0.5)
      this.inventoryContent.add(label)
    }
  }

  private buildStats(): void {
    const nameText = this.add
      .text(STATS_X, 70, this.character.name, { fontFamily: 'monospace', fontSize: '20px', color: '#e8c766' })
      .setOrigin(0, 0.5)
    const classText = this.add
      .text(STATS_X, 94, this.classLine(), { fontFamily: 'monospace', fontSize: '13px', color: '#8a7a5a' })
      .setOrigin(0, 0.5)

    const statsBody = this.add.text(STATS_X, 130, this.statLines().join('\n'), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#d8c9a3',
      lineSpacing: 12,
    })

    this.inventoryContent.add([nameText, classText, statsBody])
  }

  private buildGearHint(): void {
    const hint =
      this.gearApCost === null
        ? this.resumeKey === 'World'
          ? 'Gear is changed in battle, on your turn.'
          : 'Gear can be changed only on your turn, with an action point to spare.'
        : this.gearApCost === 0
          ? 'Click to equip, stow or pick up; right- or Ctrl+click to drop. Free until you next move or attack.'
          : `Click to equip, stow or pick up; right- or Ctrl+click to drop. Costs ${this.gearApCost} AP on closing, however many changes.`
    this.inventoryContent.add(
      this.add.text(STATS_X, 300, hint, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#8a7a5a',
        wordWrap: { width: PANEL_W - STATS_X - 20 },
      }),
    )
  }

  /** "Level 2 - 30 / 200 XP", under the character's name. */
  private classLine(): string {
    const { level, xp } = this.character
    return `Level ${level} - ${xp} / ${xpToNextLevel(level)} XP`
  }

  private statLines(): string[] {
    return [
      `Hit Points:    ${this.character.hp} / ${this.stats.maxHp}`,
      `Armor Class:   ${this.stats.ac}`,
      `To Hit:        ${this.stats.toHit}%`,
      `Damage:        ${formatDamage(this.stats.damage)}`,
      `Attack Cost:   ${this.stats.attackApCost} AP`,
      `Action Points: ${this.stats.actionPoints}`,
    ]
  }

  private buildBackpack(): void {
    const startX = this.buildSlotGrid('Backpack', DOLL_X, BACKPACK_COLS)
    this.character.backpack.forEach((item, i) => {
      const { x, y } = slotPosition(startX, i, BACKPACK_COLS)
      this.createItemSlot(x, y, item, (pointer) =>
        isSecondaryClick(pointer)
          ? dropFromBackpack(this.character, i, this.ground)
          : equipFromBackpack(this.character, i, this.ground),
      )
    })
  }

  /** What lies on the character's hex, oldest first. A pile deeper than the grid scrolls. */
  private buildGround(): void {
    this.groundScroll.setCount(this.ground.length)
    const scrolls = this.groundScroll.maxRow > 0
    const title = scrolls ? `Ground (${this.ground.length})` : 'Ground'
    const gridW = GROUND_COLS * SLOT_SIZE + (GROUND_COLS - 1) * SLOT_GAP
    const startX = this.buildSlotGrid(title, STATS_X + gridW / 2, GROUND_COLS)
    const first = this.groundScroll.firstIndex
    for (let i = 0; i < GROUND_COLS * GROUND_ROWS; i++) {
      const { x, y } = slotPosition(startX, i, GROUND_COLS)
      const index = first + i
      this.createItemSlot(x, y, this.ground[index] ?? null, () => pickUp(this.character, this.ground, index))
    }
    this.buildGroundScrollbar(STATS_X + gridW + 4)
  }

  /** The bar beside the ground grid, drawn only when the pile is deeper than the grid. */
  private buildGroundScrollbar(x: number): void {
    const trackY = SLOT_GRID_Y - SLOT_SIZE / 2
    const trackH = GROUND_ROWS * SLOT_SIZE + (GROUND_ROWS - 1) * SLOT_GAP
    const thumb = this.groundScroll.thumb(trackH, 16)
    if (!thumb) return

    const track = this.add.rectangle(x, trackY, SCROLLBAR_W, trackH, 0x14100c, 0.9).setOrigin(0)
    const bar = this.add.rectangle(x, trackY + thumb.y, SCROLLBAR_W, thumb.height, 0x6b5a3a).setOrigin(0)
    track.setInteractive({ useHandCursor: true })
    // A click on the track above or below the thumb scrolls that way.
    track.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, localY: number) =>
      this.scrollGround(localY < thumb.y ? -1 : 1),
    )
    this.inventoryContent.add([track, bar])
  }

  /** Titles a grid of slots centred on `centerX`; returns the x of its first column. */
  private buildSlotGrid(title: string, centerX: number, cols: number): number {
    this.inventoryContent.add(
      this.add
        .text(centerX, SLOT_TITLE_Y, title, { fontFamily: 'monospace', fontSize: '14px', color: '#8a7a5a' })
        .setOrigin(0.5),
    )
    return gridStartX(centerX, cols)
  }

  /** A backpack or ground space; clicking the item in it makes the change `onClick` returns the success of. */
  private createItemSlot(
    x: number,
    y: number,
    item: Item | null,
    onClick: (pointer: Phaser.Input.Pointer) => boolean,
  ): void {
    const bg = this.add.rectangle(x, y, SLOT_SIZE, SLOT_SIZE, 0x1b1712, 0.9).setStrokeStyle(2, 0x4a3d28)
    this.inventoryContent.add(bg)

    if (item) {
      this.inventoryContent.add(this.add.image(x, y, ITEM_ICON_KEYS[item.icon]).setScale(ITEM_ICON_SCALE))

      bg.setInteractive({ useHandCursor: true })
      bg.on('pointerover', () => {
        bg.setStrokeStyle(2, 0xc9a227)
        this.showTooltip(item, x, y - SLOT_SIZE / 2 - 10)
      })
      bg.on('pointerout', () => {
        bg.setStrokeStyle(2, 0x4a3d28)
        this.hideTooltip()
      })
      bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.changeGear(() => onClick(pointer)))
    }
  }

  private buildTooltip(): void {
    this.tooltipText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
    })
    this.tooltipBg = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.85).setStrokeStyle(1, 0xc9a227)
    this.tooltip = this.add.container(0, 0, [this.tooltipBg, this.tooltipText]).setVisible(false)
    this.inventoryContent.add(this.tooltip)
  }

  private showTooltip(item: Item, x: number, y: number): void {
    this.tooltipText.setText([item.name, item.description, ...describeItemStats(item.stats)].join('\n'))
    this.tooltipText.setPosition(-this.tooltipText.width / 2, -this.tooltipText.height - 6)
    this.tooltipBg.setSize(this.tooltipText.width + 16, this.tooltipText.height + 12)
    this.tooltipBg.setPosition(0, -this.tooltipText.height / 2 - 6)
    // Kept inside the panel: the slots at its edges are narrower than their tooltips.
    const reach = this.tooltipBg.width / 2 + 4
    this.tooltip.setPosition(Phaser.Math.Clamp(x, reach, PANEL_W - reach), y)
    this.tooltip.setVisible(true)
  }

  private hideTooltip(): void {
    this.tooltip.setVisible(false)
  }

  // ---- layout -------------------------------------------------------------

  private layout(): void {
    const { width, height } = this.scale
    this.dimBg.setSize(width, height)
    this.dimBg.setPosition(width / 2, height / 2)
    this.column.layout(height)
    // Right of the party's column, and scaled down (never up) to fit there, keeping 16 px clear
    // on each side; slot hit areas and tooltips scale with the panel. At MIN_GAME_SIZE (main.ts)
    // it fits unscaled.
    const free = width - PARTY_PANEL_W
    const scale = Math.max(0, Math.min(1, (free - 32) / PANEL_W, (height - 32) / PANEL_H))
    this.panel.setScale(scale)
    this.panel.setPosition(PARTY_PANEL_W + (free - PANEL_W * scale) / 2, (height - PANEL_H * scale) / 2)
  }

  // ---- actions -------------------------------------------------------------

  /** Applies a change of gear, if the battle allows one now, and redraws the panel to match. */
  private changeGear(change: () => boolean): void {
    const onGround = this.ground.length
    if (this.gearApCost === null || !change()) return
    // A dropped item lands at the end of the pile: bring it into view.
    if (this.ground.length > onGround) {
      this.groundScroll.setCount(this.ground.length)
      this.groundScroll.scrollToEnd()
    }
    this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
    // Next tick: the redraw destroys the slot whose click handler this runs in.
    this.time.delayedCall(0, () => this.buildContent())
  }

  /** Spends a skill point or a perk pick, as `spend` does and reports, and redraws the panel to match. */
  private advance(spend: () => boolean): void {
    if (!this.canAdvance || !spend()) return
    this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
    // Next tick: the redraw destroys the button whose click handler this runs in.
    this.time.delayedCall(0, () => this.buildContent())
  }

  private onWheel(deltaY: number): void {
    if (this.activeTab === 'inventory' && this.groundScroll.wheel(deltaY)) this.buildContent()
  }

  private scrollGround(rows: number): void {
    if (!this.groundScroll.scrollBy(rows)) return
    // Next tick: the redraw destroys the track whose click handler this runs in.
    this.time.delayedCall(0, () => this.buildContent())
  }

  /** A tab's key shows the tab, or closes the panel when it is the one showing. */
  private onTabKey(tab: PanelTab): void {
    if (this.activeTab === tab) this.close()
    else this.showTab(tab)
  }

  /** Closes the panel, telling the scene under it which member it last showed. */
  private close(): void {
    this.scene.stop()
    this.scene.resume(this.resumeKey, { member: this.index })
  }
}
