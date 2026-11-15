import { describe, expect, it } from 'vitest'
import { createWarrior } from '../character/character.ts'
import { SKILL_IDS, skillLevel } from '../character/skills.ts'
import { PASSIVE_LINE_CHARS, passiveRows, skillPointsLine } from './skillsTab.ts'

describe('skillPointsLine', () => {
  it('asks for attention while skill points can be spent here', () => {
    const hero = createWarrior()
    hero.skillPoints = 3
    expect(skillPointsLine(hero, true)).toEqual({ text: '3 skill points to spend', attention: true })
    hero.skillPoints = 1
    expect(skillPointsLine(hero, true)).toEqual({ text: '1 skill point to spend', attention: true })
  })

  it('is quiet with none, in battle, or with every skill at 100%', () => {
    const hero = createWarrior()
    expect(skillPointsLine(hero, true)).toEqual({ text: 'Skill points: 0', attention: false })
    hero.skillPoints = 2
    expect(skillPointsLine(hero, false)).toEqual({ text: 'Skill points: 2', attention: false })
    for (const skill of SKILL_IDS) hero.trained[skill] = 100 - skillLevel(hero, skill)
    expect(skillPointsLine(hero, true)).toEqual({ text: 'Skill points: 2 (skills at 100%)', attention: false })
  })
})

describe('passiveRows', () => {
  const long = 'Each turn it does not move, it stands Rooted for 2 turns: armour class +10 and resistance +2 until it steps.'
  const short = 'Hit points +2 a level.'

  it('stacks rows by the lines each description wraps to, none over the next', () => {
    const { rows, more } = passiveRows([long, short, long, long, short, long], 340)
    expect(more).toBe(0)
    for (const [i, row] of rows.entries()) {
      for (const line of row.lines) expect(line.length).toBeLessThanOrEqual(PASSIVE_LINE_CHARS)
      const next = rows[i + 1]
      if (next) expect(row.top + row.height).toBeLessThanOrEqual(next.top)
      else expect(row.top + row.height).toBeLessThanOrEqual(340)
    }
    expect(rows[0].lines.length).toBeGreaterThan(1)
  })

  it('cuts descriptions to a line when the rows would not fit, and says how many more there are past that', () => {
    const many = Array.from({ length: 9 }, () => long)
    const cut = passiveRows(many, 340)
    expect(cut.more).toBe(0)
    expect(cut.rows.every((row) => row.lines.length === 1 && row.lines[0].endsWith('…'))).toBe(true)
    expect(cut.rows.at(-1)!.top + cut.rows.at(-1)!.height).toBeLessThanOrEqual(340)

    const lots = passiveRows(Array.from({ length: 20 }, () => long), 340)
    expect(lots.more).toBe(20 - lots.rows.length)
    expect(lots.more).toBeGreaterThan(0)
    expect(lots.moreTop + 14).toBeLessThanOrEqual(340)
    expect(lots.rows.at(-1)!.top + lots.rows.at(-1)!.height).toBeLessThanOrEqual(lots.moreTop)
  })

  it('keeps the "+N more" line inside the list at any height, the gap under the last row counted', () => {
    for (let height = 280; height <= 360; height++) {
      const { more, moreTop } = passiveRows(Array.from({ length: 20 }, () => long), height)
      expect(more).toBeGreaterThan(0)
      expect(moreTop + 14).toBeLessThanOrEqual(height)
    }
  })
})
