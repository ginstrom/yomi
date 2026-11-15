import type { Character } from '../character/character.ts'
import { canRaiseAnySkill } from '../character/progression.ts'
import { MAX_SKILL, SKILL_IDS, skillRaiseCost } from '../character/skills.ts'
import { clampLines, wrapLines } from './perkTree.ts'

/**
 * The character panel's Skills tab in plain data: the skill points line over
 * the skills, and where the passives held sit down the right column, so that
 * no description runs into the next heading however many there are.
 */

/** The skill points line: "3 skill points to spend" in the attention colour (the portrait's "+"), while a raise can be made here. */
export function skillPointsLine(character: Character, canAdvance: boolean): { text: string; attention: boolean } {
  const points = character.skillPoints
  if (points > 0 && canAdvance && canRaiseAnySkill(character)) {
    return { text: `${points} ${points === 1 ? 'skill point' : 'skill points'} to spend`, attention: true }
  }
  const capped = points > 0 && SKILL_IDS.every((skill) => skillRaiseCost(character, skill) === null)
  return { text: `Skill points: ${points}${capped ? ` (skills at ${MAX_SKILL}%)` : ''}`, attention: false }
}

/** A passive's name line, and each line of its description under it, in pixels; the gap under a row. */
export const PASSIVE_TITLE_H = 16
export const PASSIVE_LINE_H = 13
export const PASSIVE_GAP = 6
/** A description line's characters: the column's width over the 11px monospace glyph's 6.6 px, less a little for safety. */
export const PASSIVE_LINE_CHARS = 48
/** The "+N more" line's height, under the last row shown. */
const MORE_H = 14

export interface PassiveRow {
  /** The row's top, from the top of the list, and its height, gap excluded. */
  top: number
  height: number
  /** The description, wrapped (or cut) to the lines drawn. */
  lines: string[]
}

/**
 * Where the passives' rows sit in a list `height` pixels tall: each its title
 * and its description wrapped in full while all fit; else each description
 * cut to one line; and if even that is too many, as many rows as fit with a
 * "+N more" line (`more`, at `moreTop`) under them.
 */
export function passiveRows(descriptions: readonly string[], height: number): { rows: PassiveRow[]; more: number; moreTop: number } {
  const stack = (all: string[][], limit: number) => {
    const rows: PassiveRow[] = []
    let top = 0
    for (const lines of all) {
      const rowHeight = PASSIVE_TITLE_H + lines.length * PASSIVE_LINE_H
      if (top + rowHeight > limit) break
      rows.push({ top, height: rowHeight, lines })
      top += rowHeight + PASSIVE_GAP
    }
    return { rows, top }
  }
  const full = stack(descriptions.map((text) => wrapLines(text, PASSIVE_LINE_CHARS)), height)
  if (full.rows.length === descriptions.length) return { rows: full.rows, more: 0, moreTop: full.top }
  const cut = descriptions.map((text) => [clampLines(text, 1, PASSIVE_LINE_CHARS)])
  const all = stack(cut, height)
  if (all.rows.length === descriptions.length) return { rows: all.rows, more: 0, moreTop: all.top }
  const some = stack(cut, height - MORE_H)
  return { rows: some.rows, more: descriptions.length - some.rows.length, moreTop: some.top }
}
