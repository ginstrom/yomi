import Phaser from 'phaser'
import { ATTRIBUTES, ATTRIBUTE_IDS } from '../character/attributes.ts'
import {
  deriveCombatStats,
  dropEquipped,
  dropFromBackpack,
  equipFromBackpack,
  isTwoHanded,
  manaOf,
  pickUp,
  unequipToBackpack,
  type Character,
} from '../character/character.ts'
import {
  PERKS,
  PERK_IDS,
  attributeLevel,
  attributesOf,
  isSpellPerk,
  knownSpells,
  perkRanks,
  qualifiesFor,
  type PerkId,
} from '../character/perks.ts'
import { hasPickFor, hasSpellcasting, nextPerkLevel, nextSpellLevel, takePerk, xpToNextLevel } from '../character/progression.ts'
import { castOnWorldMap, healsOne, worldHealing, worldSpells } from '../character/worldCasting.ts'
import { SPELLS, type SpellId } from '../combat/spells.ts'
import {
  SKILL_COST_TIERS,
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
import { UnitFigure } from './UnitFigure.ts'
import { gearLayers } from './unitLook.ts'
import { PARTY_PANEL_W, portraitKey } from './partyPanel.ts'
import { nodeHint, perkTitle } from './perkTree.ts'
import { PerkTreeView } from './PerkTreeView.ts'
import { SlotScroll } from './slotScroll.ts'

/** What the panel can show: one of its four tabs, or a tree, the perk tree opened from the Skills tab and the spell tree from the Spells tab. */
type PanelTab = InventoryProbe['tab']
type MainTab = Exclude<PanelTab, 'perkTree' | 'spellTree'>
const TABS: ReadonlyArray<readonly [tab: MainTab, label: string]> = [
  ['character', 'Character'],
  ['skills', 'Skills'],
  ['spells', 'Spells'],
  ['inventory', 'Inventory'],
]
/** The tab each tree is a view of, whose button stays lit for it and which Esc steps back to. */
const TREE_OF: Partial<Record<PanelTab, MainTab>> = { perkTree: 'skills', spellTree: 'spells' }

/** A party member the panel can show, and what it may do with its gear there. */
export interface PanelMember {
  character: Character
  /**
   * What changing gear costs in action points, charged once by the battle when
   * the panel closes however many items were moved; 0 if already paid for.
   * Null or absent makes the member's gear view-only.
   */
  gearApCost?: number | null
  /**
   * The pile that drops go onto and pick-ups come off: in battle the one on the hex the
   * character stands on, on the world map the party's baggage.
   */
  ground?: Item[]
  /** The mana the member has left, in battle; absent on the world map, where the panel shows the most it has. */
  mana?: number
}

interface InventoryData {
  /** The whole party in its order, each with a portrait beside the panel that turns the panel to it. */
  members: PanelMember[]
  /** The member the panel opens on. */
  index?: number
  tab?: PanelTab
  /** What the members' `ground` is called: 'Ground' unless told otherwise. */
  groundTitle?: string
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
/** How much the paperdoll's figure, a 32px unit sprite, is enlarged. */
const DOLL_SCALE = 4
/** The backpack sits under the paperdoll and the ground under the stats. */
const BACKPACK_COLS = 6
const GROUND_COLS = 5
const GROUND_ROWS = 2
const SLOT_GAP = 8
const SLOT_TITLE_Y = 367
const SLOT_GRID_Y = 404
const SCROLLBAR_W = 8
const TAB_W = 118
const TAB_H = 32
const TAB_SPACING = TAB_W + 8
/** The row of tabs sits left of centre, clear of the close hint at the panel's right. */
const TABS_CENTRE_X = PANEL_W / 2 - 36

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

/** The skills tab: skills down the left, each with a button to raise it, and down the right the perks taken and the button to the perk tree. */
const SKILLS_X = 24
const SKILLS_W = 320
const SKILL_ROW_Y = 104
const SKILL_ROW_H = 52
const RAISE_SIZE = 22
const PERKS_X = 368
const PERKS_W = PANEL_W - PERKS_X - 20
const PERK_ROW_Y = 104
const PERK_ROW_H = 38
const TREE_BUTTON = { x: PERKS_X + PERKS_W / 2, y: 462, width: 160, height: 32 }

/** The perk tree's heading and its button back; the tree itself is `PerkTreeView`'s. */
const TREE_X = 20
const BACK_BUTTON = { x: PANEL_W - 20 - 40, y: 75, width: 80, height: 26 }
/** What the strip says with the pointer on no node. */
const TREE_RULE = 'A new character has 3 perks to choose, and one more comes every 3rd level. A line from a perk means it must be taken first.'
const SPELL_TREE_RULE = 'A caster learns a spell with every level. A line from a spell means it must be learned first.'

/** The spells tab: the spells known in two columns, each row with a Cast button on the world map for a heal. */
const SPELLS_X = 24
const SPELL_COLUMN_W = (PANEL_W - 2 * SPELLS_X - 24) / 2
const SPELL_ROW_Y = 108
const SPELL_ROW_H = 36
const SPELL_ROWS = 9
const CAST_BUTTON = { width: 54, height: 22 }
const SPELL_TREE_BUTTON = { x: PANEL_W / 2, y: 470, width: 160, height: 32 }

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
  private groundTitle = 'Ground'
  /** The mana the member has left in battle; null where the most it has is shown instead. */
  private mana: number | null = null
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
  private treeContent!: Phaser.GameObjects.Container
  private spellsContent!: Phaser.GameObjects.Container
  private spellTreeContent!: Phaser.GameObjects.Container
  /** A one-member heal being cast on the world map, waiting for a portrait to be clicked; null otherwise. */
  private worldCast: SpellId | null = null
  private tabButtons: Record<MainTab, TabButton> = {} as Record<MainTab, TabButton>
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
    this.groundTitle = data.groundTitle ?? 'Ground'
    this.resumeKey = data.resume ?? 'Battle'
    this.worldCast = null
    this.setMember(data.index ?? 0)
    // Right-clicking an item drops it.
    this.input.mouse?.disableContextMenu()

    this.dimBg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.6).setOrigin(0.5)
    // Over the dimmed scene's own column, which is paused with its scene and takes no clicks.
    this.column = new PartyColumn(
      this,
      this.members.map((member) => member.character),
      (index) => (this.worldCast ? this.castOn(index) : this.switchTo(index)),
    )
    this.column.refresh(this.index)
    this.panel = this.add.container(0, 0)

    this.buildFrame()
    this.buildTabs()

    this.characterContent = this.add.container(0, 0)
    this.skillsContent = this.add.container(0, 0)
    this.inventoryContent = this.add.container(0, 0)
    this.treeContent = this.add.container(0, 0)
    this.spellsContent = this.add.container(0, 0)
    this.spellTreeContent = this.add.container(0, 0)
    this.panel.add([
      this.characterContent,
      this.skillsContent,
      this.inventoryContent,
      this.treeContent,
      this.spellsContent,
      this.spellTreeContent,
    ])
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
    this.input.keyboard?.on('keydown-B', () => this.onTabKey('spells'))
    this.input.keyboard?.on('keydown-P', () => this.showTab(this.activeTab === 'perkTree' ? 'skills' : 'perkTree'))
    this.input.keyboard?.on('keydown-K', () => this.showTab(this.activeTab === 'spellTree' ? 'spells' : 'spellTree'))
    // Esc backs out of choosing whom to heal; from a tree it steps back to the tab it was opened from; from a tab it closes the panel.
    this.input.keyboard?.on('keydown-ESC', () => {
      const back = TREE_OF[this.activeTab]
      if (this.worldCast) this.setWorldCast(null)
      else if (back) this.showTab(back)
      else this.close()
    })
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
      spellPicks: this.character.spellPicks,
      skills: Object.fromEntries(
        SKILL_IDS.map((id, row) => [
          id,
          { ...onScreen(this.raiseButtonAt(row)), level: skillLevel(this.character, id), canRaise: this.canRaise(id) },
        ]),
      ) as InventoryProbe['skills'],
      attributes: attributesOf(this.character),
      armorClass: this.stats.ac,
      mana: this.shownMana(),
      takenPerks: this.takenPerks().map((id) => ({ perk: id, ranks: perkRanks(this.character, id) })),
      perkTreeButton: onScreen(TREE_BUTTON),
      back: onScreen(BACK_BUTTON),
      perks: PerkTreeView.nodeCentres().map(({ perk, ...at }) => ({
        ...onScreen(at),
        perk,
        ranks: perkRanks(this.character, perk),
        canTake: this.canTake(perk),
      })),
      spellTreeButton: onScreen(SPELL_TREE_BUTTON),
      spellNodes: PerkTreeView.nodeCentres('spells').map(({ perk, ...at }) => ({
        ...onScreen(at),
        perk,
        ranks: perkRanks(this.character, perk),
        canTake: this.canTake(perk),
      })),
      spells: knownSpells(this.character).map((spell, i) => ({
        ...onScreen(this.castButtonAt(i)),
        spell,
        castable: this.canCastHere(spell),
      })),
      worldCast: this.worldCast,
      equipment: Object.fromEntries(
        [...this.slotCentres].map(([slot, at]) => [slot, { ...onScreen(at), item: equipment[slot]?.id ?? null }]),
      ) as InventoryProbe['equipment'],
      backpack: backpack.flatMap((item, i) =>
        item ? [{ ...onScreen(slotPosition(startX, i, BACKPACK_COLS)), item: item.id }] : [],
      ),
      ground: this.ground
        .slice(this.groundScroll.firstIndex, this.groundScroll.firstIndex + GROUND_COLS * GROUND_ROWS)
        .map((item, i) => ({ ...onScreen(slotPosition(this.groundStartX(), i, GROUND_COLS)), item: item.id })),
    }
  }

  /** Turns the panel's fields to the `index`th member; `buildContent` then draws it. */
  private setMember(index: number): void {
    const member = this.members[index]
    this.index = index
    this.character = member.character
    this.gearApCost = member.gearApCost ?? null
    this.ground = member.ground ?? []
    this.mana = member.mana ?? null
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
    this.treeContent.removeAll(true)
    this.spellsContent.removeAll(true)
    this.spellTreeContent.removeAll(true)
    this.buildCharacterTab()
    this.buildSkills()
    this.buildPerks()
    this.buildPerkTree()
    this.buildSpells()
    this.buildSpellTree()
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
      const x = TABS_CENTRE_X + (i - (TABS.length - 1) / 2) * TAB_SPACING
      this.tabButtons[tab] = this.createTabButton(label, x, 26, tab)
    })
  }

  private createTabButton(label: string, x: number, y: number, tab: MainTab): TabButton {
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
    this.treeContent.setVisible(tab === 'perkTree')
    this.spellsContent.setVisible(tab === 'spells')
    this.spellTreeContent.setVisible(tab === 'spellTree')
    if (tab !== 'inventory') this.hideTooltip()
    if (tab !== 'spells' && this.worldCast) this.setWorldCast(null)

    // A tree is a view of its tab, whose button stays lit for it.
    const lit: MainTab = TREE_OF[tab] ?? (tab as MainTab)
    for (const key of Object.keys(this.tabButtons) as MainTab[]) {
      const active = key === lit
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
      // What its perks have added is shown beside the attribute as it stands.
      const value = attributeLevel(this.character, id)
      const raised = value - this.character.attributes[id]
      this.characterContent.add([
        this.add.text(ATTRIBUTES_X, y, name, { fontFamily: FONT, fontSize: '15px', color: TEXT }),
        this.add
          .text(ATTRIBUTES_X + ATTRIBUTES_W, y, raised > 0 ? `${value} (+${raised})` : `${value}`, {
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

  /** Whether a click would take a rank of `perk` now: a spell with a spell pick or a perk pick, anything else with a perk pick. */
  private canTake(perk: PerkId): boolean {
    return this.canAdvance && hasPickFor(this.character, perk) && qualifiesFor(this.character, perk)
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
      `A skill point raises a skill by 1%, or a tagged one by ${TAGGED_SKILL_STEP}%. ${SKILL_COST_TIERS.map(({ level, cost }) => `From ${level}%, a raise costs ${cost} points.`).join(' ')}`,
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

  /** The perks the character has a rank of, in the order of `PERKS`; its spells are the Spells tab's. */
  private takenPerks(): PerkId[] {
    return PERK_IDS.filter((id) => !isSpellPerk(id) && perkRanks(this.character, id) > 0)
  }

  /** Whether the character has a perk to choose and can choose it here. */
  private pickWaits(): boolean {
    return this.canAdvance && this.character.perkPicks > 0
  }

  /** "Choose a perk" when picks wait and can be spent here, "2 to choose" in battle, else when the next comes. */
  private buildPerkStatus(content: Phaser.GameObjects.Container, right: number, y: number): void {
    const { perkPicks } = this.character
    const status = this.pickWaits()
      ? `Choose ${perkPicks === 1 ? 'a perk' : `${perkPicks} perks`}`
      : perkPicks > 0
        ? `${perkPicks} to choose`
        : `Next at level ${nextPerkLevel(this.character)}`
    content.add(
      this.add.text(right, y, status, { fontFamily: FONT, fontSize: '14px', color: perkPicks > 0 ? GOLD : DIM }).setOrigin(1, 0),
    )
  }

  /** A framed button of the panel's own, gold-edged when `marked`. */
  private buildPanelButton(
    content: Phaser.GameObjects.Container,
    { x, y, width, height }: { x: number; y: number; width: number; height: number },
    label: string,
    marked: boolean,
    onClick: () => void,
  ): void {
    const bg = this.add.rectangle(x, y, width, height, 0x1b1712, 0.95).setStrokeStyle(2, marked ? 0xc9a227 : 0x6b5a3a)
    const text = this.add.text(x, y, label, { fontFamily: FONT, fontSize: '14px', color: marked ? GOLD : TEXT }).setOrigin(0.5)
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerover', () => bg.setFillStyle(0x3a2f1c, 0.95))
    bg.on('pointerout', () => bg.setFillStyle(0x1b1712, 0.95))
    bg.on('pointerdown', () => {
      this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
      onClick()
    })
    content.add([bg, text])
  }

  /** The perks the character has taken, and the button to the tree, where one is chosen. */
  private buildPerks(): void {
    this.skillsContent.add(this.heading('Perks', PERKS_X, 66))
    this.buildPerkStatus(this.skillsContent, PERKS_X + PERKS_W, 66)

    const taken = this.takenPerks()
    if (taken.length === 0) {
      this.skillsContent.add(
        this.add.text(PERKS_X, PERK_ROW_Y - 15, 'No perks yet.', { fontFamily: FONT, fontSize: '13px', color: FAINT }),
      )
    }
    taken.forEach((id, row) => {
      const y = PERK_ROW_Y + row * PERK_ROW_H
      this.skillsContent.add([
        this.add.text(PERKS_X, y - 15, perkTitle(this.character, id), { fontFamily: FONT, fontSize: '13px', color: GOLD }),
        this.add.text(PERKS_X, y + 1, PERKS[id].description, {
          fontFamily: FONT,
          fontSize: '11px',
          color: DIM,
          wordWrap: { width: PERKS_W },
        }),
      ])
    })
    this.buildPanelButton(this.skillsContent, TREE_BUTTON, 'Perk Tree', this.pickWaits(), () => this.showTab('perkTree'))
  }

  // ---- build: perk tree -------------------------------------------------

  /** The tree (`PerkTreeView`) under its heading: a click on an open node takes a rank where a pick can be spent. */
  private buildPerkTree(): void {
    this.treeContent.add(this.heading('Perk Tree', TREE_X, 66))
    this.buildPerkStatus(this.treeContent, BACK_BUTTON.x - BACK_BUTTON.width / 2 - 16, 66)
    this.buildPanelButton(this.treeContent, BACK_BUTTON, 'Back', false, () => this.showTab('skills'))
    new PerkTreeView(this, this.treeContent, {
      character: this.character,
      clickable: (perk) => this.canTake(perk),
      onClick: (perk) => this.advance(() => takePerk(this.character, perk)),
      hint: (perk) => nodeHint(this.character, perk, this.canAdvance),
      rule: TREE_RULE,
      stripWidth: PANEL_W - 2 * TREE_X,
    })
  }

  // ---- build: spells tab -------------------------------------------------

  /** Whether the character has a spell to learn and can learn it here. */
  private spellPickWaits(): boolean {
    return this.canAdvance && this.character.spellPicks > 0
  }

  /** "Choose 2 spells" when spell picks wait and can be spent here, "2 to choose" in battle, else when the next comes. */
  private buildSpellStatus(content: Phaser.GameObjects.Container, right: number, y: number): void {
    const { spellPicks } = this.character
    const status = !hasSpellcasting(this.character)
      ? 'Spells come with Spellcasting'
      : this.spellPickWaits()
        ? `Choose ${spellPicks === 1 ? 'a spell' : `${spellPicks} spells`}`
        : spellPicks > 0
          ? `${spellPicks} to choose`
          : `Next spell at level ${nextSpellLevel(this.character)}`
    content.add(
      this.add.text(right, y, status, { fontFamily: FONT, fontSize: '14px', color: spellPicks > 0 ? GOLD : DIM }).setOrigin(1, 0),
    )
  }

  /** The top left of the `index`th spell's row. */
  private spellRowAt(index: number): Point {
    const column = Math.floor(index / SPELL_ROWS)
    return { x: SPELLS_X + column * (SPELL_COLUMN_W + 24), y: SPELL_ROW_Y + (index % SPELL_ROWS) * SPELL_ROW_H }
  }

  /** The centre of the `index`th spell's Cast button. */
  private castButtonAt(index: number): Point {
    const { x, y } = this.spellRowAt(index)
    return { x: x + SPELL_COLUMN_W - CAST_BUTTON.width / 2, y: y + 6 }
  }

  /** Whether a click on `spell`'s Cast button would cast it now: a heal, on the world map, with the mana for it. */
  private canCastHere(spell: SpellId): boolean {
    return this.canAdvance && worldSpells(this.character).some((known) => known.spell === spell && known.affordable)
  }

  /**
   * The spells the character knows, with its mana and the button to the spell
   * tree; on the world map a heal can be cast from here, on one member or the
   * whole party.
   */
  private buildSpells(): void {
    const content = this.spellsContent
    content.add(this.heading('Spells', SPELLS_X, 66))
    this.buildSpellStatus(content, PANEL_W - SPELLS_X, 66)
    const max = this.stats.magic?.maxMana ?? 0
    const mana = max > 0 ? `Mana ${this.shownMana()} / ${max}` : 'No mana: knows no spell'
    content.add(this.add.text(SPELLS_X, 88, mana, { fontFamily: FONT, fontSize: '14px', color: max > 0 ? GOLD : DIM }))

    const known = knownSpells(this.character)
    known.forEach((spell, i) => {
      const { x, y } = this.spellRowAt(i)
      const { name, manaCost, apCost, description } = SPELLS[spell]
      content.add([
        this.add.text(x, y, `${name}  ${manaCost} mana, ${apCost} AP`, { fontFamily: FONT, fontSize: '13px', color: GOLD }),
        this.add.text(x, y + 15, description, {
          fontFamily: FONT,
          fontSize: '10px',
          color: DIM,
          wordWrap: { width: SPELL_COLUMN_W - (this.canAdvance ? CAST_BUTTON.width + 6 : 0) },
        }),
      ])
      if (this.canAdvance && worldSpells(this.character).some((heal) => heal.spell === spell)) this.buildCastButton(spell, i)
    })

    const footer = this.worldCast
      ? `${SPELLS[this.worldCast].name}: choose who (${SPELLS[this.worldCast].manaCost} mana). Esc to go back.`
      : known.length === 0
        ? ''
        : this.canAdvance
          ? `Out of battle a heal restores ${worldSpells(this.character).map(({ spell }) => `${worldHealing(spell)} (${SPELLS[spell].name})`).join(', ') || 'its average'}. Mana comes back only with a battle or a level.`
          : 'Spells are cast in battle with the Cast button (M).'
    content.add(
      this.add
        .text(PANEL_W / 2, 444, footer, { fontFamily: FONT, fontSize: '12px', color: this.worldCast ? GOLD : DIM, align: 'center', wordWrap: { width: PANEL_W - 48 } })
        .setOrigin(0.5),
    )
    this.buildPanelButton(content, SPELL_TREE_BUTTON, 'Spell Tree', this.spellPickWaits(), () => this.showTab('spellTree'))
  }

  /** A heal's Cast button: a heal of one asks whom, a heal of all heals at once. */
  private buildCastButton(spell: SpellId, index: number): void {
    const { x, y } = this.castButtonAt(index)
    const enabled = this.canCastHere(spell)
    const choosing = this.worldCast === spell
    const bg = this.add
      .rectangle(x, y, CAST_BUTTON.width, CAST_BUTTON.height, choosing ? 0x3a2f1c : 0x1b1712, 0.95)
      .setStrokeStyle(2, enabled ? 0xc9a227 : 0x4a3d28)
    const text = this.add
      .text(x, y, choosing ? 'Cancel' : 'Cast', { fontFamily: FONT, fontSize: '12px', color: enabled ? GOLD : FAINT })
      .setOrigin(0.5)
    this.spellsContent.add([bg, text])
    if (!enabled) return
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerdown', () => {
      this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
      if (choosing) this.setWorldCast(null)
      else if (healsOne(spell)) this.setWorldCast(spell)
      else this.heal(spell)
    })
  }

  /** Waits for a portrait to be clicked to cast `spell` on, or stops waiting. */
  private setWorldCast(spell: SpellId | null): void {
    this.worldCast = spell
    // Next tick: the redraw destroys the button whose click handler this runs in.
    this.time.delayedCall(0, () => this.buildContent())
  }

  /** A portrait clicked while a heal waits for its target: heals that member. */
  private castOn(index: number): void {
    const spell = this.worldCast
    this.worldCast = null
    if (spell) this.heal(spell, this.members[index].character)
    else this.time.delayedCall(0, () => this.buildContent())
  }

  /** Casts a heal out of battle, on `target` or on the whole party, and redraws. */
  private heal(spell: SpellId, target?: Character): void {
    const party = this.members.map((member) => member.character)
    if (castOnWorldMap(this.character, spell, party, target)) this.sound.play('sfx_heal', { volume: soundVolume('sfx_heal') })
    this.time.delayedCall(0, () => this.buildContent())
  }

  /** The spell tree (`PerkTreeView`) under its heading: a click on an open node learns it where a pick can be spent. */
  private buildSpellTree(): void {
    this.spellTreeContent.add(this.heading('Spell Tree', TREE_X, 66))
    this.buildSpellStatus(this.spellTreeContent, BACK_BUTTON.x - BACK_BUTTON.width / 2 - 16, 66)
    this.buildPanelButton(this.spellTreeContent, BACK_BUTTON, 'Back', false, () => this.showTab('spells'))
    new PerkTreeView(this, this.spellTreeContent, {
      tree: 'spells',
      character: this.character,
      clickable: (perk) => this.canTake(perk),
      onClick: (perk) => this.advance(() => takePerk(this.character, perk)),
      hint: (perk) => nodeHint(this.character, perk, this.canAdvance),
      rule: SPELL_TREE_RULE,
      stripWidth: PANEL_W - 2 * TREE_X,
    })
  }

  // ---- build: inventory tab -------------------------------------------------

  private buildPaperdoll(): void {
    const dollBoxBg = this.add
      .rectangle(DOLL_X, DOLL_Y, 150, 210, 0x14100c, 0.8)
      .setStrokeStyle(2, 0x4a3d28)
    this.inventoryContent.add(dollBoxBg)

    // The hero as the battlefield shows it, holding what the slots beside it say.
    const doll = new UnitFigure(this, 'warrior', DOLL_SCALE)
      .setGear(gearLayers(this.character.equipment))
      .play('idle')
      .setPosition(DOLL_X, DOLL_Y + 95)
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

    const lines = this.statLines()
    // A caster's mana and a melee weapon's piercing each make a line more, and the last has to end clear of the hint below.
    const statsBody = this.add.text(STATS_X, 130, lines.join('\n'), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#d8c9a3',
      lineSpacing: lines.length > 7 ? 4 : lines.length > 6 ? 8 : 12,
    })

    this.inventoryContent.add([nameText, classText, statsBody])
  }

  private buildGearHint(): void {
    const hint =
      this.gearApCost === null
        ? 'Gear can be changed only on your turn, with an action point to spare.'
        : this.resumeKey === 'World'
          ? 'Click to equip, stow or take; right- or Ctrl+click to put in the baggage.'
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
      ...(this.stats.armorPierce ? [`Pierces:       ${this.stats.armorPierce}% armor`] : []),
      `Action Points: ${this.stats.actionPoints}`,
      ...(this.stats.magic ? [`Mana:          ${this.manaLine()}`] : []),
    ]
  }

  /** The mana to show: what is left in battle, within what the gear now worn allows; else what the character carries. Null without magic. */
  private shownMana(): number | null {
    const { magic } = this.stats
    if (!magic) return null
    return this.mana === null ? manaOf(this.character) : Math.min(this.mana, magic.maxMana)
  }

  /** "15 / 18": what is left of the most there is, in battle or carried on the world map. */
  private manaLine(): string {
    return `${this.shownMana()} / ${this.stats.magic?.maxMana ?? 0}`
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

  /** The x of the ground grid's first column. */
  private groundStartX(): number {
    const gridW = GROUND_COLS * SLOT_SIZE + (GROUND_COLS - 1) * SLOT_GAP
    return gridStartX(STATS_X + gridW / 2, GROUND_COLS)
  }

  /** What lies on the character's hex, or in the party's baggage, oldest first. A pile deeper than the grid scrolls. */
  private buildGround(): void {
    this.groundScroll.setCount(this.ground.length)
    const scrolls = this.groundScroll.maxRow > 0
    const title = scrolls ? `${this.groundTitle} (${this.ground.length})` : this.groundTitle
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
  private onTabKey(tab: MainTab): void {
    if (this.activeTab === tab) this.close()
    else this.showTab(tab)
  }

  /** Closes the panel, telling the scene under it which member it last showed. */
  private close(): void {
    this.scene.stop()
    this.scene.resume(this.resumeKey, { member: this.index })
  }
}
