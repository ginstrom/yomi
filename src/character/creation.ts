import { ATTRIBUTES, ATTRIBUTE_IDS, ATTRIBUTE_POINTS, MAX_ATTRIBUTE, MIN_ATTRIBUTE, type AttributeId, type Attributes } from './attributes.ts'
import { STARTING_KIT, createCharacter, maxHp, maxMana, type Character } from './character.ts'
import { PERKS, isSpellPerk, missingRequirements, type PerkId } from './perks.ts'
import { PORTRAIT_IDS, type PortraitId } from './portraits.ts'
import { SPELLCASTING_SPELL_PICKS, takePerk } from './progression.ts'
import { SKILL_IDS, raiseSkill, type SkillId } from './skills.ts'

/**
 * Character creation: what the player chooses (a `CharacterDraft`) and the
 * level 1 `Character` those choices make. Creation has no rules of its own
 * about what a skill point or a perk does: `draftCharacter` spends them with
 * `raiseSkill` and `takePerk`, as the world map does those of a level, so a
 * created character is a character like any other and stores nothing more.
 */

/** The points to place on attributes that all start at `MIN_ATTRIBUTE`. */
export const CREATION_ATTRIBUTE_POINTS = ATTRIBUTE_POINTS - ATTRIBUTE_IDS.length * MIN_ATTRIBUTE
export const CREATION_SKILL_POINTS = 10
export const CREATION_PERK_PICKS = 3
export const MAX_NAME_LENGTH = 12

/** What the player has chosen so far. Plain data; the scene holds one and replaces it on every change. */
export interface CharacterDraft {
  name: string
  portrait: PortraitId
  attributes: Attributes
  tagged: SkillId | null
  /** Skill points placed in each skill, not percent: a change of tag changes what they are worth. */
  raises: Record<SkillId, number>
  /** Perks chosen, a rank an entry, in the order taken. */
  perks: PerkId[]
}

/** A draft with nothing chosen: every attribute at its lowest, no tag, no name, the first portrait. */
export function newDraft(): CharacterDraft {
  return {
    name: '',
    portrait: PORTRAIT_IDS[0],
    attributes: Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, MIN_ATTRIBUTE])) as Attributes,
    tagged: null,
    raises: Object.fromEntries(SKILL_IDS.map((id) => [id, 0])) as Record<SkillId, number>,
    perks: [],
  }
}

/** A copy that shares nothing with `draft`. */
export function copyDraft(draft: CharacterDraft): CharacterDraft {
  return { ...draft, attributes: { ...draft.attributes }, raises: { ...draft.raises }, perks: [...draft.perks] }
}

export function attributePointsLeft(draft: CharacterDraft): number {
  return ATTRIBUTE_POINTS - ATTRIBUTE_IDS.reduce((sum, id) => sum + draft.attributes[id], 0)
}

export function skillPointsLeft(draft: CharacterDraft): number {
  return CREATION_SKILL_POINTS - SKILL_IDS.reduce((sum, id) => sum + draft.raises[id], 0)
}

/**
 * The perk and spell picks the draft's choices leave, counted as `takePerk`
 * spends them: a spell from a spell pick while there is one, everything else
 * from a perk pick, and Spellcasting bringing its spell picks. A perk pick
 * left below 0 is a perk too many.
 */
function picksLeft(draft: CharacterDraft): { perks: number; spells: number } {
  const left = { perks: CREATION_PERK_PICKS, spells: 0 }
  for (const perk of draft.perks) {
    if (isSpellPerk(perk) && left.spells > 0) left.spells -= 1
    else left.perks -= 1
    if (perk === 'spellcasting') left.spells += SPELLCASTING_SPELL_PICKS
  }
  return left
}

export function perkPicksLeft(draft: CharacterDraft): number {
  return picksLeft(draft).perks
}

/** The spell picks the draft has left: none until it takes Spellcasting. */
export function spellPicksLeft(draft: CharacterDraft): number {
  return picksLeft(draft).spells
}

/** Whether the draft has taken Spellcasting, and so has a spell tree to choose from. */
export function draftCasts(draft: CharacterDraft): boolean {
  return draft.perks.includes('spellcasting')
}

/** The draft's character before its perks, and with its perk picks to spend. */
function unperked(draft: CharacterDraft): Character {
  const character = createCharacter(draft.name.trim(), {
    portrait: draft.portrait,
    attributes: draft.attributes,
    tagged: draft.tagged ? [draft.tagged] : [],
    ...STARTING_KIT[draft.tagged ?? 'melee'],
  })
  character.skillPoints = CREATION_SKILL_POINTS
  for (const skill of SKILL_IDS) {
    for (let point = 0; point < draft.raises[skill]; point++) raiseSkill(character, skill)
  }
  character.perkPicks = CREATION_PERK_PICKS
  return character
}

/**
 * Takes the draft's perks in order, as far as each is allowed. Returns the
 * ones refused, each with the reason the screen gives.
 */
function takePerks(character: Character, perks: readonly PerkId[]): Array<{ perk: PerkId; note: string }> {
  const refused: Array<{ perk: PerkId; note: string }> = []
  for (const perk of perks) {
    const missing = missingRequirements(character, perk)
    if (takePerk(character, perk)) continue
    const why = missing.length > 0 ? `it asks ${missing.join(', ')}` : character.perkPicks < 1 ? 'no pick is left' : 'it cannot be taken'
    refused.push({ perk, note: `${PERKS[perk].name} dropped: ${why}` })
  }
  return refused
}

/**
 * The character the draft makes. Total: an unfinished draft makes an
 * unfinished character, for the summary. Skill points and perk picks the
 * draft has not spent stay on the character, to spend on the world map.
 */
export function draftCharacter(draft: CharacterDraft): Character {
  const character = unperked(draft)
  takePerks(character, draft.perks)
  character.hp = maxHp(character)
  character.mana = maxMana(character)
  return character
}

/**
 * The draft without the perks that no longer qualify, the ids dropped, and a
 * line for each saying why. The scene calls it after every change.
 */
export function pruneDraft(draft: CharacterDraft): { draft: CharacterDraft; dropped: PerkId[]; notes: string[] } {
  const refused = takePerks(unperked(draft), draft.perks)
  if (refused.length === 0) return { draft, dropped: [], notes: [] }
  // By place and not by id: a perk may be chosen twice and only its second rank refused.
  const kept: PerkId[] = []
  const left = refused.map(({ perk }) => perk)
  const character = unperked(draft)
  for (const perk of draft.perks) {
    if (takePerk(character, perk)) kept.push(perk)
  }
  return { draft: { ...draft, perks: kept }, dropped: left, notes: refused.map(({ note }) => note) }
}

/** Every reason the draft cannot become a character, in step order; empty when it can. */
export function draftProblems(draft: CharacterDraft, takenNames: readonly string[]): string[] {
  const problems: string[] = []
  const left = attributePointsLeft(draft)
  if (left > 0) problems.push(`${left} attribute ${left === 1 ? 'point' : 'points'} left to place`)
  if (left < 0) problems.push('Too many attribute points placed')
  for (const id of ATTRIBUTE_IDS) {
    const value = draft.attributes[id]
    if (!Number.isInteger(value) || value < MIN_ATTRIBUTE || value > MAX_ATTRIBUTE) {
      problems.push(`${ATTRIBUTES[id].name} must be from ${MIN_ATTRIBUTE} to ${MAX_ATTRIBUTE}`)
    }
  }
  if (!draft.tagged) problems.push('Tag a skill')
  if (skillPointsLeft(draft) < 0 || SKILL_IDS.some((id) => draft.raises[id] < 0)) problems.push('Too many skill points placed')
  if (perkPicksLeft(draft) < 0) problems.push('Too many perks chosen')
  problems.push(...pruneDraft(draft).notes.map((note) => note.replace(' dropped: ', ' cannot be taken: ')))
  const name = draft.name.trim()
  if (name === '') problems.push('Give the character a name')
  else if (name.length > MAX_NAME_LENGTH) problems.push(`The name is longer than ${MAX_NAME_LENGTH} letters`)
  else if (takenNames.includes(name)) problems.push(`Another member is called ${name}`)
  return problems
}

/** What a change to a draft came to: the draft as it now stands, and what the screen should say of it. */
export interface DraftChange {
  draft: CharacterDraft
  /** Perks dropped because they no longer qualify, or why the change was refused. */
  notes: string[]
}

const unchanged = (draft: CharacterDraft, ...notes: string[]): DraftChange => ({ draft, notes })
const pruned = (draft: CharacterDraft): DraftChange => {
  const { draft: kept, notes } = pruneDraft(draft)
  return { draft: kept, notes }
}

/** Whether a point can be put on, or taken from, an attribute. */
export function canAdjustAttribute(draft: CharacterDraft, id: AttributeId, by: 1 | -1): boolean {
  const value = draft.attributes[id] + by
  return value >= MIN_ATTRIBUTE && value <= MAX_ATTRIBUTE && (by < 0 || attributePointsLeft(draft) > 0)
}

/** Puts a point on an attribute or takes one off, dropping the perks that no longer qualify. */
export function adjustAttribute(draft: CharacterDraft, id: AttributeId, by: 1 | -1): DraftChange {
  if (!canAdjustAttribute(draft, id, by)) return unchanged(draft)
  return pruned({ ...draft, attributes: { ...draft.attributes, [id]: draft.attributes[id] + by } })
}

/** Whether a skill point can be put in, or taken from, a skill. */
export function canAdjustSkill(draft: CharacterDraft, skill: SkillId, by: 1 | -1): boolean {
  return by > 0 ? skillPointsLeft(draft) > 0 : draft.raises[skill] > 0
}

/** Puts a skill point in a skill or takes one out, dropping the perks that no longer qualify. */
export function adjustSkill(draft: CharacterDraft, skill: SkillId, by: 1 | -1): DraftChange {
  if (!canAdjustSkill(draft, skill, by)) return unchanged(draft)
  return pruned({ ...draft, raises: { ...draft.raises, [skill]: draft.raises[skill] + by } })
}

/** Tags `skill`, which untags the one tagged before, dropping the perks that no longer qualify. */
export function tagSkill(draft: CharacterDraft, skill: SkillId): DraftChange {
  return pruned({ ...draft, tagged: skill })
}

/** How many ranks of `perk` the draft has chosen. */
export function draftPerkRanks(draft: CharacterDraft, perk: PerkId): number {
  return draft.perks.filter((id) => id === perk).length
}

/**
 * A click on a perk's node: takes a rank if the draft's character may, else
 * gives back the last rank taken of it, unless another chosen perk then no
 * longer qualifies, which the note says.
 */
export function togglePerk(draft: CharacterDraft, perk: PerkId): DraftChange {
  const taken = { ...draft, perks: [...draft.perks, perk] }
  if (perkPicksLeft(taken) >= 0 && pruneDraft(taken).dropped.length === 0) return unchanged(taken)
  const last = draft.perks.lastIndexOf(perk)
  if (last === -1) return unchanged(draft)
  const without = { ...draft, perks: draft.perks.filter((_, index) => index !== last) }
  const { dropped } = pruneDraft(without)
  if (dropped.length > 0) return unchanged(draft, `${PERKS[dropped[0]].name} asks for ${PERKS[perk].name}`)
  return unchanged(without)
}

/** The characters allowed in a name besides letters. */
const NAME_PUNCTUATION = " -'"

/**
 * The name with `key` typed at its end: a letter, a space, a hyphen or an
 * apostrophe is added, Backspace removes; never past `maxLength`, a
 * character's by default.
 */
export function typeInName(name: string, key: string, maxLength: number = MAX_NAME_LENGTH): string {
  if (key === 'Backspace') return name.slice(0, -1)
  const typable = key.length === 1 && (/\p{L}/u.test(key) || NAME_PUNCTUATION.includes(key))
  if (!typable || name.length >= maxLength) return name
  // A name does not begin with a space.
  return key === ' ' && name === '' ? name : name + key
}
