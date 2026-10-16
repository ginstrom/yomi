import { describe, expect, it } from 'vitest'
import { maxHp, maxMana } from './character.ts'
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
  draftCasts,
  draftCharacter,
  draftPerkRanks,
  draftProblems,
  newDraft,
  perkPicksLeft,
  pruneDraft,
  skillPointsLeft,
  spellPicksLeft,
  tagSkill,
  togglePerk,
  typeInName,
  type CharacterDraft,
} from './creation.ts'
import { knownSpells } from './perks.ts'
import { raiseSkill, skillLevel } from './skills.ts'
import { takePerk } from './progression.ts'
import { IRON_SWORD, OAK_SHIELD, SPARK_WAND, YEW_BOW } from '../inventory/inventory.ts'

/** A whole draft: a soldier with everything placed and nothing left over. */
const soldier = (changes: Partial<CharacterDraft> = {}): CharacterDraft => ({
  name: 'Mira',
  portrait: 'squire',
  attributes: { strength: 9, perception: 3, endurance: 7, intelligence: 3, agility: 6, luck: 4 },
  tagged: 'melee',
  raises: { melee: 10, archery: 0, magic: 0 },
  perks: ['weapon_training', 'toughness', 'heavy_hand'],
  ...changes,
})

describe('the budgets', () => {
  it('are 26 attribute points over six attributes at 1, 10 skill points and 3 picks', () => {
    expect([CREATION_ATTRIBUTE_POINTS, CREATION_SKILL_POINTS, CREATION_PERK_PICKS]).toEqual([26, 10, 3])
    const draft = newDraft()
    expect(Object.values(draft.attributes)).toEqual([1, 1, 1, 1, 1, 1])
    expect([attributePointsLeft(draft), skillPointsLeft(draft), perkPicksLeft(draft)]).toEqual([26, 10, 3])
    expect([attributePointsLeft(soldier()), skillPointsLeft(soldier()), perkPicksLeft(soldier())]).toEqual([0, 0, 0])
  })

  it('makes a new draft that shares nothing with another', () => {
    const draft = newDraft()
    draft.attributes.luck = 9
    draft.perks.push('toughness')
    expect(newDraft()).toMatchObject({ attributes: { luck: 1 }, perks: [], tagged: null, name: '' })
  })
})

describe('draftProblems', () => {
  it('finds none in a whole draft', () => {
    expect(draftProblems(soldier(), ['Aldric'])).toEqual([])
  })

  it('names a point unplaced, and an attribute out of range', () => {
    const short = soldier({ attributes: { ...soldier().attributes, luck: 3 } })
    expect(draftProblems(short, [])).toEqual(['1 attribute point left to place'])
    const zero = soldier({ attributes: { strength: 7, perception: 4, endurance: 7, intelligence: 7, agility: 7, luck: 0 } })
    expect(draftProblems(zero, [])).toContain('Luck must be from 1 to 10')
    const eleven = soldier({ attributes: { strength: 11, perception: 3, endurance: 7, intelligence: 3, agility: 5, luck: 3 } })
    expect(draftProblems(eleven, [])[0]).toBe('Strength must be from 1 to 10')
    const over = soldier({ attributes: { ...soldier().attributes, luck: 5 } })
    expect(draftProblems(over, [])).toEqual(['Too many attribute points placed'])
  })

  it('names a missing tag, and skill points or perks beyond the budget', () => {
    expect(draftProblems(soldier({ tagged: null, perks: [] }), [])).toEqual(['Tag a skill'])
    expect(draftProblems(soldier({ raises: { melee: 10, archery: 1, magic: 0 } }), [])).toEqual(['Too many skill points placed'])
    expect(draftProblems(soldier({ perks: [...soldier().perks, 'dodger'] }), [])).toEqual([
      'Too many perks chosen',
      'Dodger cannot be taken: no pick is left',
    ])
  })

  it('names a perk the draft does not qualify for', () => {
    expect(draftProblems(soldier({ perks: ['deadly_aim'] }), [])).toEqual(['Deadly Aim cannot be taken: it asks Perception 6'])
  })

  it('names an empty name, one too long and one another member has, but not its own', () => {
    expect(draftProblems(soldier({ name: '  ' }), [])).toEqual(['Give the character a name'])
    expect(draftProblems(soldier({ name: 'x'.repeat(MAX_NAME_LENGTH + 1) }), [])).toEqual(['The name is longer than 12 letters'])
    expect(draftProblems(soldier(), ['Aldric', 'Mira'])).toEqual(['Another member is called Mira'])
    // An edited member's own name is not among the others'.
    expect(draftProblems(soldier(), ['Aldric'])).toEqual([])
  })

  it('does not mind skill points and picks left unspent', () => {
    expect(draftProblems(soldier({ raises: { melee: 6, archery: 0, magic: 0 }, perks: ['toughness', 'dodger'] }), [])).toEqual([])
  })

  it('lists them in step order', () => {
    expect(draftProblems(newDraft(), [])).toEqual(['26 attribute points left to place', 'Tag a skill', 'Give the character a name'])
  })
})

describe('draftCharacter', () => {
  it('makes a level 1 character at full hit points with the weapon of its tagged skill', () => {
    const character = draftCharacter(soldier())
    expect(character).toMatchObject({ name: 'Mira', portrait: 'squire', level: 1, xp: 0, tagged: ['melee'] })
    expect(character.hp).toBe(maxHp(character))
    // 10 + strength 9 + endurance 7, and Toughness.
    expect(maxHp(character)).toBe(32)
    expect([character.equipment.mainHand, character.equipment.offHand]).toEqual([IRON_SWORD, OAK_SHIELD])
    expect(draftCharacter(soldier({ tagged: 'archery', perks: [] })).equipment).toMatchObject({ mainHand: YEW_BOW })
    expect(draftCharacter(soldier({ tagged: 'archery', perks: [] })).equipment.offHand).toBeUndefined()
    expect(draftCharacter(soldier({ tagged: 'magic', perks: [] })).equipment.mainHand).toBe(SPARK_WAND)
  })

  it('spends its points as the world map would: 2% a point in the tagged skill, 1% in another', () => {
    const character = draftCharacter(soldier({ raises: { melee: 6, archery: 4, magic: 0 } }))
    expect(character.trained).toEqual({ melee: 12, archery: 4, magic: 0 })
    // strength 9 + agility 6, the tag, twelve trained and a rank of Weapon Training.
    expect(skillLevel(character, 'melee')).toBe(15 + 20 + 12 + 5)
    expect(character.perks).toEqual({ weapon_training: 1, toughness: 1, heavy_hand: 1 })
  })

  it('re-prices the points placed when the tag changes', () => {
    const raises = { melee: 5, archery: 5, magic: 0 }
    expect(draftCharacter(soldier({ raises, perks: [] })).trained).toEqual({ melee: 10, archery: 5, magic: 0 })
    expect(draftCharacter(soldier({ raises, perks: [], tagged: 'archery' })).trained).toEqual({ melee: 5, archery: 10, magic: 0 })
  })

  it('leaves unspent skill points and picks on the character, to spend like those of a level', () => {
    const character = draftCharacter(soldier({ raises: { melee: 6, archery: 0, magic: 0 }, perks: ['toughness', 'dodger'] }))
    expect([character.skillPoints, character.perkPicks]).toEqual([4, 1])
    expect(raiseSkill(character, 'melee')).toBe(true)
    expect(takePerk(character, 'heavy_hand')).toBe(true)
    expect([character.skillPoints, character.perkPicks]).toEqual([3, 0])
  })

  it('is total: an unfinished draft makes an unfinished character', () => {
    const character = draftCharacter(newDraft())
    expect(character).toMatchObject({ name: '', tagged: [], skillPoints: 10, perkPicks: 3, perks: {} })
    expect(character.hp).toBe(12)
    expect(skillLevel(character, 'magic')).toBe(2)
  })

  it('makes a specialist of about 60%, and a mage with a spell and mana', () => {
    const mage = draftCharacter(
      soldier({
        attributes: { strength: 3, perception: 4, endurance: 4, intelligence: 9, agility: 6, luck: 6 },
        tagged: 'magic',
        raises: { melee: 0, archery: 0, magic: 10 },
        perks: ['spellcasting', 'arcane_study', 'keen_eye', 'magic_arrow', 'heal'],
      }),
    )
    expect([skillLevel(mage, 'magic'), knownSpells(mage), maxMana(mage)]).toEqual([63, ['magic_arrow', 'heal'], 18])
    expect([mage.mana, mage.perkPicks, mage.spellPicks]).toEqual([18, 0, 0])
    // Without the tag the same character is at 18 + 10 + 5.
    const untagged = draftCharacter(soldier({ ...soldier(), attributes: mage.attributes, tagged: 'melee', raises: { melee: 0, archery: 0, magic: 10 }, perks: ['arcane_study'] }))
    expect(skillLevel(untagged, 'magic')).toBe(33)
  })
})

describe('perks at creation', () => {
  const hardy = soldier({ attributes: { strength: 7, perception: 4, endurance: 5, intelligence: 4, agility: 6, luck: 6 }, perks: [] })

  it('lets a character with Endurance 5 take Toughness, and none take Gain Strength', () => {
    expect(togglePerk(hardy, 'toughness').draft.perks).toEqual(['toughness'])
    expect(togglePerk(hardy, 'gain_strength').draft.perks).toEqual([])
    expect(togglePerk(hardy, 'tireless').draft.perks).toEqual([])
  })

  it('lets Spellcasting be taken once Magic is 40% and not before', () => {
    // Intelligence 9: 18, and the tag 20.
    const mage = soldier({
      attributes: { strength: 3, perception: 4, endurance: 4, intelligence: 9, agility: 6, luck: 6 },
      tagged: 'magic',
      raises: { melee: 10, archery: 0, magic: 0 },
      perks: [],
    })
    expect(skillLevel(draftCharacter(mage), 'magic')).toBe(38)
    expect(togglePerk(mage, 'spellcasting').draft.perks).toEqual([])
    // Arcane Study counts towards it.
    const studied = togglePerk(mage, 'arcane_study').draft
    expect(togglePerk(studied, 'spellcasting').draft.perks).toEqual(['arcane_study', 'spellcasting'])
  })

  it('gives Spellcasting two spell picks, spent before a perk pick on a spell (A13)', () => {
    const mage = soldier({
      attributes: { strength: 3, perception: 4, endurance: 4, intelligence: 9, agility: 6, luck: 6 },
      tagged: 'magic',
      raises: { melee: 0, archery: 0, magic: 10 },
      perks: [],
    })
    expect(draftCasts(mage)).toBe(false)
    expect(togglePerk(mage, 'heal').draft.perks).toEqual([])
    let draft = togglePerk(mage, 'spellcasting').draft
    expect([draftCasts(draft), perkPicksLeft(draft), spellPicksLeft(draft)]).toEqual([true, 2, 2])
    for (const spell of ['heal', 'magic_arrow', 'shield'] as const) draft = togglePerk(draft, spell).draft
    expect([perkPicksLeft(draft), spellPicksLeft(draft)]).toEqual([1, 0])
    expect(draftProblems(draft, [])).toEqual([])
    const removed = togglePerk(draft, 'spellcasting')
    expect(removed.draft).toBe(draft)
    expect(removed.notes).toEqual(['Heal asks for Spellcasting'])
    // Lowering Magic under 40% drops Spellcasting and every spell with it.
    const lowered = adjustSkill(draft, 'magic', -1)
    expect(skillLevel(draftCharacter(mage), 'magic')).toBe(58)
    expect(lowered.draft.perks).toEqual(draft.perks)
    const untagged = tagSkill(draft, 'archery')
    expect(untagged.draft.perks).toEqual([])
    expect(untagged.notes[0]).toBe('Spellcasting dropped: it asks Magic 40%')
  })

  it('takes a second rank, stops at three picks, and gives the last rank back on a click', () => {
    let draft = togglePerk(togglePerk(hardy, 'toughness').draft, 'toughness').draft
    expect(draftPerkRanks(draft, 'toughness')).toBe(2)
    // Every rank is taken: a click gives one back.
    draft = togglePerk(draft, 'toughness').draft
    expect(draft.perks).toEqual(['toughness'])
    draft = togglePerk(togglePerk(draft, 'dodger').draft, 'heavy_hand').draft
    expect(perkPicksLeft(draft)).toBe(0)
    expect(togglePerk(draft, 'keen_eye').draft).toBe(draft)
    expect(togglePerk(draft, 'dodger').draft.perks).toEqual(['toughness', 'heavy_hand'])
  })

  it('refuses to give back a perk another chosen perk asks for', () => {
    const archer = soldier({
      attributes: { strength: 4, perception: 7, endurance: 5, intelligence: 4, agility: 7, luck: 5 },
      tagged: 'archery',
      raises: { melee: 0, archery: 10, magic: 0 },
      perks: ['deadly_aim', 'far_shot', 'dodger'],
    })
    expect(draftProblems(archer, [])).toEqual([])
    expect(togglePerk(archer, 'deadly_aim')).toEqual({ draft: archer, notes: ['Far Shot asks for Deadly Aim'] })
    expect(togglePerk(archer, 'far_shot').draft.perks).toEqual(['deadly_aim', 'dodger'])
  })
})

describe('pruneDraft', () => {
  it('leaves a draft whose perks all qualify as it is', () => {
    const draft = soldier()
    expect(pruneDraft(draft)).toEqual({ draft, dropped: [], notes: [] })
  })

  it('drops a perk an attribute no longer carries, returns its pick and says which', () => {
    const draft = soldier({ attributes: { ...soldier().attributes, endurance: 5, luck: 6 } })
    const lowered = adjustAttribute(draft, 'endurance', -1)
    expect(lowered.draft.perks).toEqual(['weapon_training', 'heavy_hand'])
    expect(lowered.notes).toEqual(['Toughness dropped: it asks Endurance 5'])
    expect(perkPicksLeft(lowered.draft)).toBe(1)
    expect(pruneDraft({ ...draft, attributes: lowered.draft.attributes }).dropped).toEqual(['toughness'])
  })

  it('drops a spell when the skill under it is lowered or the tag moves', () => {
    const mage = soldier({
      attributes: { strength: 3, perception: 4, endurance: 4, intelligence: 9, agility: 6, luck: 6 },
      tagged: 'magic',
      raises: { melee: 0, archery: 0, magic: 1 },
      perks: ['spellcasting', 'magic_arrow'],
    })
    expect(adjustSkill(mage, 'magic', -1)).toMatchObject({
      draft: { perks: [] },
      notes: ['Spellcasting dropped: it asks Magic 40%', 'Magic Arrow dropped: it asks Magic 40%, Spellcasting'],
    })
    expect(tagSkill(mage, 'melee')).toMatchObject({ draft: { tagged: 'melee', perks: [] } })
    expect(tagSkill(mage, 'magic')).toEqual({ draft: mage, notes: [] })
  })

  it('drops with a perk the one that grew from it', () => {
    const archer = soldier({
      attributes: { strength: 4, perception: 7, endurance: 5, intelligence: 4, agility: 7, luck: 5 },
      perks: ['deadly_aim', 'far_shot'],
    })
    const { draft, notes } = adjustAttribute(adjustAttribute(archer, 'perception', -1).draft, 'perception', -1)
    expect(draft.perks).toEqual([])
    expect(notes).toEqual(['Deadly Aim dropped: it asks Perception 6'])
  })
})

describe('placing points', () => {
  it('keeps an attribute from 1 to 10 and within the points there are', () => {
    const draft = newDraft()
    expect(canAdjustAttribute(draft, 'strength', -1)).toBe(false)
    expect(adjustAttribute(draft, 'strength', -1).draft).toBe(draft)
    let raised = draft
    for (let i = 0; i < 12; i++) raised = adjustAttribute(raised, 'strength', 1).draft
    expect(raised.attributes.strength).toBe(10)
    expect(attributePointsLeft(raised)).toBe(17)
    expect(canAdjustAttribute(soldier(), 'luck', 1)).toBe(false)
    expect(canAdjustAttribute(soldier(), 'luck', -1)).toBe(true)
    expect(draft.attributes.strength).toBe(1)
  })

  it('keeps skill points within the ten, and takes back only what was placed', () => {
    expect(canAdjustSkill(soldier(), 'archery', 1)).toBe(false)
    expect(canAdjustSkill(soldier(), 'archery', -1)).toBe(false)
    const moved = adjustSkill(adjustSkill(soldier(), 'melee', -1).draft, 'archery', 1).draft
    expect(moved.raises).toEqual({ melee: 9, archery: 1, magic: 0 })
  })

  it('tags one skill at a time', () => {
    expect(tagSkill(tagSkill(newDraft(), 'melee').draft, 'magic').draft.tagged).toBe('magic')
  })
})

describe('typeInName', () => {
  it('adds letters, spaces, hyphens and apostrophes, and nothing else', () => {
    const type = (keys: string[]) => keys.reduce((name, key) => typeInName(name, key), '')
    expect(type([...'Ann-Li O\'Dé'])).toBe("Ann-Li O'Dé")
    expect(type(['A', '1', 'Enter', 'Shift', '!', 'b'])).toBe('Ab')
    expect(typeInName('', ' ')).toBe('')
  })

  it('removes with Backspace and stops at the longest a name gets', () => {
    expect(typeInName('Mira', 'Backspace')).toBe('Mir')
    expect(typeInName('', 'Backspace')).toBe('')
    expect(typeInName('x'.repeat(MAX_NAME_LENGTH), 'y')).toHaveLength(MAX_NAME_LENGTH)
    // Another longest, as the encampment's name has.
    expect(typeInName('x'.repeat(MAX_NAME_LENGTH), 'y', MAX_NAME_LENGTH + 4)).toHaveLength(MAX_NAME_LENGTH + 1)
  })
})
