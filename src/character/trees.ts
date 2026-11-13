import type { Character } from './character.ts'
import { PERKS, PERK_IDS, perkRanks, type Perk, type PerkId } from './perks.ts'

/**
 * The skill trees: four trees (Warrior, Scout, Mage, Cleric) of three paths
 * each, every node a perk of one rank (perks.ts) that names its path and its
 * tier. A tier asks a level and a depth, the nodes already held in the node's
 * own path. The hero's calling is its deepest path, derived and never stored;
 * a capstone is open only in the calling, and a hero holds one capstone at
 * most. Every path is open to every hero, and paths mix freely.
 *
 * This module and perks.ts import each other, which is safe while neither
 * calls the other as its module loads.
 */

export const TREE_IDS = ['warrior', 'scout', 'mage', 'cleric'] as const

export type TreeId = (typeof TREE_IDS)[number]

export const PATH_IDS = [
  'swordmaster',
  'heavy_knight',
  'spellsword',
  'ranger',
  'rogue',
  'assassin',
  'evoker',
  'cryomancer',
  'arcanist',
  'healer',
  'paladin',
  'saint',
] as const

export type PathId = (typeof PATH_IDS)[number]

export interface PathInfo {
  name: string
  tree: TreeId
  /** Its heading's colour in the tree view, readable on the panel's dark ground. */
  colour: number
}

/** Three paths a tree, in `PATH_IDS` order. */
export const PATHS: Record<PathId, PathInfo> = {
  swordmaster: { name: 'Swordmaster', tree: 'warrior', colour: 0xd8644a },
  heavy_knight: { name: 'Heavy Knight', tree: 'warrior', colour: 0xa8b4c4 },
  spellsword: { name: 'Spellsword', tree: 'warrior', colour: 0xb07ae0 },
  ranger: { name: 'Ranger', tree: 'scout', colour: 0x78b85a },
  rogue: { name: 'Rogue', tree: 'scout', colour: 0xd8b04a },
  assassin: { name: 'Assassin', tree: 'scout', colour: 0xc8506e },
  evoker: { name: 'Evoker', tree: 'mage', colour: 0xe8843c },
  cryomancer: { name: 'Cryomancer', tree: 'mage', colour: 0x70c8ec },
  arcanist: { name: 'Arcanist', tree: 'mage', colour: 0xa88cf0 },
  healer: { name: 'Healer', tree: 'cleric', colour: 0x64c464 },
  paladin: { name: 'Paladin', tree: 'cleric', colour: 0xf0d070 },
  saint: { name: 'Saint', tree: 'cleric', colour: 0xece4c8 },
}

export const TREES: Record<TreeId, { name: string }> = {
  warrior: { name: 'Warrior' },
  scout: { name: 'Scout' },
  mage: { name: 'Mage' },
  cleric: { name: 'Cleric' },
}

export type Tier = 1 | 2 | 3 | 'capstone'

/** What each tier asks: the level, and the nodes already held in the node's own path. */
export const TIERS: Record<Tier, { level: number; depth: number }> = {
  1: { level: 1, depth: 0 },
  2: { level: 2, depth: 1 },
  3: { level: 6, depth: 3 },
  capstone: { level: 12, depth: 5 },
}

/** Mana a node of the Mage or Cleric tree adds (step 04 derives it). */
export const MANA_PER_TREE_NODE = 2

/** The tree's three paths, in `PATH_IDS` order. */
export function pathsOf(tree: TreeId): PathId[] {
  return PATH_IDS.filter((path) => PATHS[path].tree === tree)
}

/** The nodes of `path` the character holds. */
export function pathDepth(character: Pick<Character, 'perks'>, path: PathId): number {
  return PERK_IDS.filter((id) => (PERKS[id] as Perk).path === path && held(character, id)).length
}

/** The deepest path or paths, every one tied at the most nodes, in `PATH_IDS` order; none for a hero with no node. */
export function calling(character: Pick<Character, 'perks'>): PathId[] {
  const depths = PATH_IDS.map((path) => [path, pathDepth(character, path)] as const)
  const deepest = Math.max(...depths.map(([, depth]) => depth))
  return deepest === 0 ? [] : depths.filter(([, depth]) => depth === deepest).map(([path]) => path)
}

/** The capstone the character holds, if any: a hero holds one at most. */
export function capstoneOf(character: Pick<Character, 'perks'>): PerkId | null {
  return PERK_IDS.find((id) => (PERKS[id] as Perk).tier === 'capstone' && held(character, id)) ?? null
}

/** The nodes of `tree`'s paths the character holds. */
export function treeNodes(character: Pick<Character, 'perks'>, tree: TreeId): number {
  return pathsOf(tree).reduce((sum, path) => sum + pathDepth(character, path), 0)
}

function held(character: Pick<Character, 'perks'>, perk: PerkId): boolean {
  return perkRanks(character, perk) > 0
}

/** "Level 9 \u00b7 Heavy Knight", or "... / Paladin" when the second-deepest path holds 3 nodes or more; "Level 1" with no node. */
export function heroTitle(character: Character): string {
  const ranked = PATH_IDS.map((path) => [path, pathDepth(character, path)] as const)
    .filter(([, depth]) => depth > 0)
    .sort((a, b) => b[1] - a[1])
  const [first, second] = ranked
  const names = [first, second && second[1] >= 3 ? second : undefined].flatMap((entry) => (entry ? [PATHS[entry[0]].name] : []))
  return [`Level ${character.level}`, ...(names.length > 0 ? [names.join(' / ')] : [])].join(' \u00b7 ')
}
