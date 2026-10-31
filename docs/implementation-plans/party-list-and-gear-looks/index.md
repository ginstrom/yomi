# Implementation plan: world-map party list, and hero figures that show worn gear

Two independent changes from play feedback. **Part A** puts a list of the company's parties down the right side of the world map. A click on an entry selects that party and centres the view on it. Today there is one party. **Part B** draws heroes as a bare body with overlays for the armour, head and cloak items they wear, wherever a `UnitFigure` is drawn. No game rule, save format or event changes, so neither `SAVE_VERSION` nor `LOG_SCHEMA_VERSION` is bumped.

**Source design:** [docs/designs/party-list-and-gear-looks.md](../../designs/party-list-and-gear-looks.md). The user approved it on 2026-10-31 and answered Q1 and Q2 with the defaults: no default helm, and the party is called "Your party". Feature record: [docs/features/party-list-and-gear-looks.md](../../features/party-list-and-gear-looks.md). Planned against commit `3fe4c11`, branch `armor-resistance`.

## Scope and shared constraints

- **In scope:** A-R1 to A-R8, B-R1 to B-R7 and AC1 to AC7 of the design, with the doc updates in its §5.2.
- **Out of scope:** the design's non-goals (more than one party, overlays for the neck, rings, gloves, belt or boots, looks for foes, a swaying cloak, portrait changes), and **the stage 05/06 design edits in design §5.4**. Do not edit `docs/designs/long-campaign/`.
- **Test first.** Rules and helpers get `domain` tests (`src/**/*.test.ts`, run in Node). `src/scenes/*Scene.test.ts` are registration smoke tests only. Behaviour goes in the browser tests in `e2e/` (`npm run test:browser`). `e2e/driver.ts` has `click`, `hover`, `holdDown`, `letGo`, `drag`, `press(key)` and `resize`. Helper modules in `src/scenes/` that a domain test imports must have no runtime Phaser import.
- **Code style.** Imports use explicit `.ts` extensions, `import type` for type-only imports, and no enums or constructor parameter properties. `tsc` is the lint (`noUnusedLocals`, `noUnusedParameters`).
- **Checks.** `npm test` (`tsc && vitest run`) must pass after every step. A step that touches a scene also runs `npm run test:browser`. A step that touches `art/` also runs `sprite check --project art` (it must print `ok`) and `npm run sprites:check`.
- **sprite-tool runs on the host only.** It is not in the podman image. The host has `sprite 0.7.0`; `art/CLAUDE.md` names v0.6.0, and the baseline check passes with 0.7.0.
- **CLAUDE.md** (root, and `art/CLAUDE.md`) is updated in the same commit as the change it describes. Before committing, grep it for every renamed name (`setGear`, `gearLayers`, `recentre`).
- **Commits.** Per CLAUDE.md, make one commit per step on the current branch once `npm test` passes, unless your brief says otherwise. Never push. End commit messages with the attribution line you were given.
- **Case-insensitive file system.** The host is macOS, where `partyList.ts` and `PartyList.ts` are the same file. The Phaser view the design calls `PartyList.ts` is therefore **`PartyListView.ts`** (class `PartyListView`), and the Phaser-free module keeps the design's name, `partyList.ts`. This is a planner decision.

## Shared contracts

These cross step boundaries or are named in more than one task file. Copy them unchanged.

**Step 01 → 04, and the world-map probe that step 03 extends.** In the new `src/scenes/partyList.ts` (Phaser-free; type-only imports of `Character`, `GameState` and `Hex`; `Rect` from `./mapScroll.ts`):

```ts
/** The strip down the world map's right side; the map's view keeps to the left of it. */
export const PARTY_LIST_W = 80
/** The id of the one party today; stage 05's migration names the first expedition the same. */
export const FIRST_PARTY_ID = 'party_1'
/** What the single party is called until stage 06 names parties (design Q2, answered). */
export const SINGLE_PARTY_NAME = 'Your party'

export interface PartyListEntry {
  id: string
  name: string
  members: readonly Character[]   // the leader is members[0]
  position: Hex
  confronting: { id: string; name: string } | null
  hp: number                      // sum of members' hp
  maxHp: number                   // sum of maxHp(member)
}
export function deployedParties(game: GameState): PartyListEntry[]          // [] for an empty party
export function partyEntryRect(index: number, width: number): Rect          // 64×64 tile
export function partyEntryBarRect(index: number, width: number): Rect       // 64×6 bar under it
export function partyListInfo(entry: PartyListEntry): { title: string; lines: string[] }
```

- **Geometry.** The tile is at `x = width − PARTY_LIST_W + (PARTY_LIST_W − 64) / 2`, `y = HEADER_BOTTOM + 8 + index × 80`, 64×64. The bar is at the same `x`, `y = tile.y + 64 + 2`, 64×6.
- **`partyListInfo`.** The title is `entry.name`. The lines are, in order:
  - `N members` (`1 member` for one);
  - `Hit points: X / Y`;
  - `Before the <confronting.name>` (only while confronting);
  - `Click to centre the view on it.`

**Also from step 01:**
- In `src/scenes/partyPanel.ts`: `export function hpBarColor(ratio: number): number`. It returns `0x43a047` above 0.5, `0xfb8c00` above 0.2, and `0xe53935` otherwise.
- In `src/scenes/PartyColumn.ts`: `destroy(): void`.
- In `src/scenes/PartyListView.ts`, a Phaser view with no logic: `class PartyListView` with
  - `constructor(scene, onClick: (id: string) => void, onHover: (id: string | null) => void)`;
  - `layout(width: number, top: number, bottom: number): void`;
  - `refresh(entries: PartyListEntry[], selected: string): void`;
  - `probe(): PartyListProbe[]`.
- In `src/testHook.ts`:
  - `export interface PartyListProbe extends Point { id: string; members: number; selected: boolean; confronting: boolean }`;
  - `WorldProbe` gains `parties: PartyListProbe[]`, `selectedParty: string` and `infoRect: Rect | null`. `infoRect` is the info panel's bounds while it shows; it is a planner addition for AC1, which the design allowed.
- In `WorldScene`: `selectParty(id: string)` and `centreOnSelected()`. Home calls `centreOnSelected()`, which replaces `recentre()`.

**Step 02 → 03 (atlas content).** The atlas gains these sprites on the `unit` canvas, each with `over = "warrior"`, `idle_0`, `idle_1` (`idle_0` shifted `[0, 1]`), `[anim.idle] like = "warrior"` and `[anim.walk] rest = true`:
- `gear_breastplate`
- `gear_circlet`
- `gear_cloak` (the collar and clasp)
- `gear_cloak_back` (the cape, drawn under the body)

`warrior` keeps its id, `[points] grip = [25, 19]` and `chest = [16, 15]`, its frames (`idle_0`, `idle_1`, `walk_0`, `walk_1`, `walk_2`) and its animations (`idle` 600 ms, `walk` 140 ms).

**Step 03 → 04.** In `src/scenes/unitLook.ts`:

```ts
export const WORN_SPRITES: Partial<Record<ItemIcon, string>> = { armor: 'gear_breastplate', circlet: 'gear_circlet', cloak: 'gear_cloak' }
export const WORN_BACK_SPRITES: Partial<Record<ItemIcon, string>> = { cloak: 'gear_cloak_back' }
export const WORN_SLOTS = ['armor', 'cloak', 'head'] as const
export interface HeroLook { under: string[]; over: string[] }
export function heroLook(equipment: Equipment): HeroLook   // over = worn (WORN_SLOTS order), then gearLayers(equipment)
```

In `UnitFigure`, `setGear(sprites)` becomes `setLook(look: HeroLook): this`, and it gains `lookNames(): string[]`: the layer names, bottom first, in the container's display order. The probes gain:
- `InventoryProbe.doll: string[]`;
- `WorldProbe.partyLook: string[]`;
- `BattleProbe.looks: Record<UnitId, string[]>` (heroes only).

## Tasks

| Step | Task | Outcome | Depends on | Status |
| --- | --- | --- | --- | --- |
| 01 | [Design approval and the party list](01-party-list.md) | Design marked approved. The world map has the right-hand party list: select, centre, hover summary, layout at 840×560 | none | done (`c90b008`; review round 1 in the next commit) |
| 02 | [Bare hero body and worn-gear sprites](02-gear-sprites.md) | `warrior` redrawn bare; `gear_breastplate`, `gear_circlet`, `gear_cloak` and `gear_cloak_back` in the atlas | none | done (`3a6c5a4`) |
| 03 | [Hero figures wear their gear](03-hero-look.md) | `heroLook` and `UnitFigure.setLook` draw worn overlays on the doll, in battle and on the map; coverage test | 02 | done (`103885e`; art touch-up and record in the next commit) |
| 04 | [Manual, screenshots and final pass](04-manual-and-final-pass.md) | Manual §3 and §4 describe both parts; screenshots retaken in podman; manual checks recorded | 01, 03 | pending |

## Execution order

Run the steps in the order 01, 02, 03, 04.
- **01 and 02** touch disjoint files (01: `WorldScene.ts`, `partyPanel.ts`, `PartyColumn.ts`, `testHook.ts`, root CLAUDE.md, `e2e/world.test.ts`; 02: `art/`, `public/assets/sprites/`, `art/CLAUDE.md`). They may run in parallel only in separate worktrees.
- **03** needs 02's atlas. It also edits `WorldScene.ts`, `testHook.ts` and root CLAUDE.md after 01, so it runs after both.
- **Between 02 and 03** heroes are drawn bare (no breastplate) because nothing lays the overlays yet. Keep the two steps' commits together on the branch and do not ship 02 alone.
- **Checkpoint:** `npm test` passes after every step, and `npm run test:browser` after 01, 03 and 04.

## Requirement map

| Req | Requirement | Task |
| --- | --- | --- |
| A-R1 | Strip down the right side, one entry a party in company order | 01 |
| A-R2 | Entry: leader's portrait, member count, party HP bar, confronting marker, gold frame when selected | 01 |
| A-R3 | Click selects and centres, clearing any pan, even when already selected | 01 |
| A-R4 | Selected party drives the left column and Home; a change of selection rebuilds the column | 01 |
| A-R5 | Hover shows the party summary in the info panel | 01 |
| A-R6 | No overlap at 840×560; the view ends at the strip | 01 |
| A-R7 | Entries ignore clicks while walking or under the outcome screen | 01 |
| A-R8 | One function (`deployedParties`) is the only reader of the single party | 01 |
| B-R1 | `warrior` redrawn bare, same fist, points and frame geometry | 02 |
| B-R2 | Overlays for breastplate, circlet and cloak (back and front) | 02 (art), 03 (maps) |
| B-R3 | Fixed layer order for both facings | 03 (code), 02 (pixel regions) |
| B-R4 | No overlay means unseen; coverage test for armour, head and cloak items | 03 |
| B-R5 | Doll, battle and map show the overlays, updating where held gear does | 03 |
| B-R6 | Swing, tint, alpha, outline, facing, breath and walk across all layers | 03 (code), 02 (frames and animations) |
| B-R7 | Face portraits unchanged | 02, 03 (nothing touches `art/portraits/`) |
| AC1 to AC4 | Party list acceptance | 01 (browser), 04 (screenshot) |
| AC5 to AC7 | Gear looks acceptance | 03 |
| Q1, Q2 | Answered with defaults; design marked approved | 01 (first task) |
| Docs §5.2 | Root CLAUDE.md (world map, helper list) | 01 |
| Docs §5.2 | `art/CLAUDE.md` hero layers; sprites README | 02 |
| Docs §5.2 | Root CLAUDE.md (assets paragraph, `unitLook.ts`, `UnitFigure.ts`) | 03 |
| Docs §5.2 | Manual §3 and screenshots | 04 |
| Manual checks §7 | Cloak, circlet, facing, walk, swing, hit, fallen, bare hero | 03 (first pass), 04 (recorded) |

## Overall completion criteria

- Steps 01 to 04 are done, and `npm test`, `npm run test:browser`, `npm run sprites:check` and `sprite check --project art` pass on the last.
- The design's §7 manual checks are recorded in step 04.
- No file under `docs/designs/long-campaign/` is changed.

## Open questions and notes

No blocking questions. Planner decisions (routine):
1. `PartyListView.ts` in place of the design's `PartyList.ts`, because of the case-insensitive file system (above).
2. `WorldProbe.infoRect` is added so that AC1 ("the info panel sits entirely left of the strip") is tested, not only inspected.
3. `SINGLE_PARTY_NAME` is a named constant, so that stage 06 can find the one place a name is made up.
4. The column's colours (`COLUMN_COLOR`, `COLUMN_EDGE` and the three frame colours) move from `PartyColumn.ts` into `partyPanel.ts` as exports, so that `PartyListView` uses the same colours.
5. Part B's art comes before its code, because the code's atlas and coverage tests need the sprites. The cape is judged on the doll in step 03, once the wiring exists. Step 03 may adjust the art and rebuild.

## For implementers

When you start a step, set its status here to `in progress`. When you finish, set it to `done` and add the commit hash once the orchestrator commits. Record evidence, deviations and blockers in your task file's execution record.
