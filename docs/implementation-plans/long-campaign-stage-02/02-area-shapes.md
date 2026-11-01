# Step 02: Area shapes

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-02-special-attacks-and-elements.md) (§2 "Shapes", §6 Verification) · [Reference §5.4](../../designs/long-campaign/reference/campaign-to-level-20.md) ("Shapes")

**Difficulty:** moderate. Geometry with worked tests (below); the rest is moving a function and threading one optional field. Sonnet can do it with these worked cases; use the session model if the cone's angles give trouble.

## 1. Objective

Give areas a shape, burst, cone or line, in one place that spells now and abilities later (steps 04 and 05) share:
- `AreaShape` and `areaOf` in `src/grid/hex.ts`;
- `areaTouches` in `src/engine/battleEngine.ts`, which `castTouches` uses for area spells;
- `Spell.shape`, optional, `'burst'` when left out;
- the battle screen drawing a spell's area with `areaOf`.

No existing spell sets a shape, so every battle plays exactly as today: the campaign summary must be identical to step 01's.

## 2. Requirements and context

- **Design requirement S2-R2 (part):** areas in cone, line and burst. This step builds the shapes; recharge is step 04 and area abilities step 05.
- **Design requirement S2-R6 (part):** the screen shows an area's hexes. Today it does for bursts; after this step it does so for any shape, through `areaOf`.
- **Design §6, tests:** "`hex.test.ts`: the cone, line and burst on small boards, for each of the 6 directions."
- **Why `AreaShape` lives in `hex.ts`** (the index's correction 6): the grid layer imports nothing from combat. `src/combat/abilities.ts` (step 04) re-exports it.
- **The guard.** This step changes no battle. `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"` must print a summary identical to step 01's (recorded in the index and in step 01's execution record). Not one RNG draw may be added, dropped or reordered; `legalActions` must list the same actions in the same order.

### Contract C1 (from the index, unchanged)

```ts
// src/grid/hex.ts (new)
export type AreaShape = 'burst' | 'cone' | 'line'
/**
 * The hexes an area of `shape` covers, on the board or off it (callers filter):
 * burst — every hex within `radius` of `aim` (the caller checks `aim` is within `range` of `origin`);
 * line  — `range` hexes from `origin` towards `aim`, the origin excluded;
 * cone  — the hexes 1 to `range` from `origin` whose direction from it is within 30° of the direction to `aim`.
 * Cone and line are [] when `aim` is `origin`.
 */
export function areaOf(shape: AreaShape, origin: Hex, aim: Hex, range: number, radius = 0): Hex[]
```

- **Burst:** exactly today's `areaHexes(aim, radius)` (`battleEngine.ts`), in its order. `areaHexes` moves out of `battleEngine.ts`; its callers (`BattleScene.markCast`, `BattleScene.showCast`) use `areaOf`.
- **Line:** let `n = hexDistance(origin, aim)` and `far = origin + (aim − origin) × ceil(range / n)`; the line is `hexLine(origin, far)` from its second hex, cut to `range` hexes.
- **Cone:** angles are measured in pixel space (`hexToPixel`, any size); a hex is in when the angle between `origin → hex` and `origin → aim` is at most 30° (with a tolerance of 1e-9). Ordered by distance from the origin, then `q`, then `r`. A cone of range 2 aimed at a neighbour is 4 hexes: that neighbour, the hex beyond it, and the two hexes at distance 2 either side of it.

```ts
// src/engine/battleEngine.ts (new)
export interface AreaSpec { shape: AreaShape; range: number; radius?: number }
/** The standing units an area of `area` from `caster` aimed at `at` touches, in roster order: everyone if `hostile`, else the caster's side. */
export function areaTouches<U extends Placed>(units: readonly U[], caster: Placed, area: AreaSpec, at: Hex, hostile: boolean): U[]
```

- `castTouches` (existing, signature unchanged) uses `areaTouches` for an area spell, with `{ shape: spell.shape ?? 'burst', range: spell.range, radius: spell.radius }`.
- `Spell` (existing, `src/combat/spells.ts`) gains `shape?: AreaShape`, read only when `target` is `'area'`; left out means `'burst'`. No existing spell sets it.
- **The legal aims of an area spell:** a burst as today (on the board, within `range`); a cone or line on the board at distance 1 to `range`. A hostile area must touch a standing foe, as today.

## 3. Dependencies and prerequisites

- **Step 01** must be done: its recorded campaign summary is what this step's run is compared with. No code from it is used.
- **Existing code this step changes** (inspected at `51cecb5`):
  - `src/grid/hex.ts`: `HEX_DIRECTIONS`, `hexDistance`, `hexLine` (with its 1e-6 nudge), `hexToPixel`. `areaOf` builds on these.
  - `src/engine/battleEngine.ts`: `export function areaHexes(center, radius)` (the burst), `aimHex`, `castTouches(units, caster, spell, aim)`, the private `canCast` (area legality: on the board and `hexDistance(aim.at, actor.position) <= range`, a hostile area touching a foe) and `legalActions` (an area spell's centres: the caster's own hex for range 0, else every board hex in board order, each kept if `canCast`).
  - `src/engine/policies.ts` calls `castTouches`; it needs no change.
  - `src/scenes/BattleScene.ts` imports `areaHexes` (line 8) and uses it in `markCast` (about line 1114) and `showCast` (about line 1342).
  - `src/engine/policies.test.ts` imports `castTouches`; keep it exported.
- **Consumed later:** step 03 gives Lightning Bolt `shape: 'line'`; step 05 resolves area abilities over `areaOf` and `areaTouches`; step 06 draws an ability's hexes. They rely on C1 exactly as written.

## 4. Scope and implementation guidance

### 4.1 `src/grid/hex.ts`

- Add `AreaShape` and `areaOf` per C1. Move the burst's loop from `battleEngine.ts` `areaHexes` unchanged, so its order is today's (`q` outer from `-radius`, `r` inner).
- **Line:** compute `far` with the integer multiple `ceil(range / n)` so that `hexLine` gets an end at least `range` away along the same direction, then take hexes 1 to `range`. Use the existing `hexLine`, nudge included; do not write a second line routine.
- **Cone:** for each hex within `range` of `origin` (distance ≥ 1), compare the angle of `hexToPixel(h) − hexToPixel(origin)` with that of `hexToPixel(aim) − hexToPixel(origin)`; keep it when the angle between them is ≤ 30° + 1e-9 (for example via the dot product and `Math.acos`, clamped to [−1, 1]). Sort by distance, then `q`, then `r`.
- Pure functions; no board knowledge.

### 4.2 `src/engine/battleEngine.ts`

- Delete `areaHexes` (its body now lives in `areaOf`). Search the repo for every `areaHexes` and replace it.
- Add `AreaSpec` and `areaTouches` per C1: the standing units (`hp > 0`) whose position is in `areaOf(area.shape, caster.position, at, area.range, area.radius ?? 0)`, filtered to the caster's side when not `hostile`, in roster order.
- `castTouches` for an area spell: `aimHex` as today, then `areaTouches(units, caster, { shape: spell.shape ?? 'burst', range, radius }, center, hostile)`. For a burst this must return exactly today's units in today's order.
- `canCast` for an area spell: a burst keeps today's test; a cone or line needs the aim on the board and `1 <= hexDistance(aim.at, actor.position) <= range`. Keep "a hostile area must touch a standing foe". `legalActions` needs no change of form: it already tries every board hex for an area of range > 0.
- Update the class doc's or `castTouches`' comment where it says "within its radius of the centre".

### 4.3 `src/combat/spells.ts`

- `Spell` gains `shape?: AreaShape` (import the type from `../grid/hex.ts`), documented as read only for `target: 'area'`, `'burst'` when left out. No spell in `SPELLS` sets it in this step.

### 4.4 `src/scenes/BattleScene.ts`

- `markCast` and `showCast` compute an area spell's hexes with `areaOf(SPELLS[spell].shape ?? 'burst', casterPosition, aim, range, radius)`, filtered to `this.board.contains`. `showCast` finds the caster's position from the engine's state (the event names `caster`; for a line or cone the caster has not moved since). Nothing visible changes for today's spells.

### 4.5 Docs

- CLAUDE.md, domain layer: the `hex.ts` bullet gains `areaOf` (burst, cone, line); the engine's bullet or the rules of casting say an area spell's shape (`Spell.shape`, burst by default) and that `areaTouches` is what the engine, the policies and the scene share. Remove any mention of `areaHexes`.

### Out of scope

- Abilities, recharge, elements, monster spells (steps 03 to 05). Setting `shape` on any spell. Any change to the policies.

## 5. Verification

1. **`src/grid/hex.test.ts`: worked cases,** with origin `hex(0, 0)` (off-board is fine, `areaOf` knows no board). These were computed from C1's definition; if the implementation disagrees, re-check it against C1 before changing a case. Compare as sets for burst membership if convenient, but pin the cone's and line's order as written (C1's order).

   - **Cone, range 2, aimed at each neighbour** (`HEX_DIRECTIONS[i]`), in C1's order:

     | Direction | Aim | Cone (range 2) |
     | --- | --- | --- |
     | 0 east | (1, 0) | (1, 0) (1, 1) (2, −1) (2, 0) |
     | 1 north-east | (1, −1) | (1, −1) (1, −2) (2, −2) (2, −1) |
     | 2 north-west | (0, −1) | (0, −1) (−1, −1) (0, −2) (1, −2) |
     | 3 west | (−1, 0) | (−1, 0) (−2, 0) (−2, 1) (−1, −1) |
     | 4 south-west | (−1, 1) | (−1, 1) (−2, 1) (−2, 2) (−1, 2) |
     | 5 south-east | (0, 1) | (0, 1) (−1, 2) (0, 2) (1, 1) |

     Ordering note: within a distance, by `q` then `r`; e.g. direction 3's distance-2 hexes are (−2, 0), (−2, 1), (−1, −1).
   - **Line, range 3, aimed at each neighbour:** (1,0) (2,0) (3,0); (1,−1) (2,−2) (3,−3); (0,−1) (0,−2) (0,−3); (−1,0) (−2,0) (−3,0); (−1,1) (−2,2) (−3,3); (0,1) (0,2) (0,3).
   - **Line, range 3, aimed beyond its range** at (5, 0): (1,0) (2,0) (3,0).
   - **Line, range 6, aimed off-axis** at (2, −1): (1,0) (2,−1) (3,−1) (4,−2) (5,−2) (6,−3) (this depends on `hexLine`'s nudge; pin it).
   - **Cone, range 2, aimed between two directions** at (2, −1) (30° from both east and north-east): (1,−1) (1,0) (2,−2) (2,−1) (2,0), five hexes.
   - **Cone, range 3, aimed east:** (1,0) (1,1) (2,−1) (2,0) (2,1) (3,−1) (3,0).
   - **Cone and line aimed at the origin:** `[]`.
   - **Burst:** `areaOf('burst', origin, aim, r, radius)` equals the old `areaHexes(aim, radius)` for radius 0, 1 and 2 at a few aims (1, 7 and 19 hexes), whatever `origin` is; and for each of the 6 directions, a burst of radius 1 aimed at the hex two steps out holds that hex and its 6 neighbours.
   - **On a small board:** with `new HexBoard({ cols: 5, rows: 5 })` and the origin in a corner, a cone or line filtered by `board.contains` drops the off-board hexes and keeps the rest in order.
2. **`src/engine/battleEngine.test.ts`:** `areaTouches` returns standing units on a cone's and a line's hexes in roster order, both sides when hostile and the caster's side only when not, fallen units excluded; `castTouches` for Fireball and Bane gives the same units as before (the existing tests stay green unchanged).
3. **`make test` passes** (podman, Node 26). Locally, `npx vitest run src/grid/hex.test.ts` and `npm run -s typecheck` for quick checks.
4. **The guard is unchanged:** `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"` prints a summary identical to step 01's, line for line (the log path aside). If it is not identical, this step changed a battle: find why before committing.
5. **Scene:** `make test-browser ARGS="-t casts"` (the Cast-button test) passes, since `markCast` and `showCast` changed.

## 6. Completion criteria

- [ ] `AreaShape` and `areaOf` in `hex.ts`, with the worked cases above in `hex.test.ts`, all six directions for cone and line.
- [ ] `areaHexes` gone from `battleEngine.ts`; `AreaSpec` and `areaTouches` exported; `castTouches` built on them; area-spell legality per C1.
- [ ] `Spell.shape` optional, set by no spell.
- [ ] `BattleScene` draws area spells through `areaOf`.
- [ ] CLAUDE.md's lines updated; no mention of `areaHexes` left.
- [ ] `make test` passes; the browser cast test passes; the campaign summary identical to step 01's (recorded below).
- [ ] Committed on the current branch, without pushing; the message ends with the repo's `Co-Authored-By` attribution line.
- [ ] The index's step 02 row set to `done` with the commit, and the record below filled in.

## Execution record
