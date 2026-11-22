# Step 07: The world map at the new size

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-09-outer-rings.md) (§2 "The world map", §4 What the player sees, §6 Play script) · [Reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.1, §6.3 · [Stages index](../../designs/long-campaign/index.md) ("Sprites", "Docs") · [Plan log](log.md)

**Difficulty:** sonnet / opus. The engineer follows fixed contracts on existing patterns (the blight layer, the partner sprites map, a debug command); set `model: "sonnet"`. **Escalate to opus** (model unset) if the frame-time check of §4.3 fails for a cause that is not plainly the growth sprites or the layer's size. The reviewer (opus) checks that nothing looks different on today's part of the map, that the tiles cover the board without seams or gaps, and that no rule moved.

## 1. Objective

The world map works at 140 × 72:
- the blight layer is drawn as render-texture tiles no larger than 2048 px a side, since one texture the map's size (about 7,800 × 3,500 px) passes what many GPUs allow;
- the fog and the corrupted land's growth sprites stay cheap enough over a board 4.2 times the size, measured after `reveal`;
- the view scrolls and drags to every edge;
- the far partners wear their own sprites (those step 06 delivered);
- debug `spawn` takes any `SPAWN_KINDS` kind and refuses one whose band, or `fromThreat`, does not hold the hex's threat;
- the hover panel, the event lines and `locations` show threats up to 20, and the Routes tab's minimap reads well at the new aspect with five partners.

## 2. Requirements and context

- **Design §2, "The world map at the new size":** camera bounds, and the minimap if any (the Routes tab's, `minimapBoard`). Vision and fog over the larger board.
- **Design §5, Performance:** about 4.2 times the hexes. The domain's cost is step 08's; this step owns the scene's.
- **Design §6, play script** (walked in step 10, which needs this step): `reveal`, then `locations all` to inspect the rings and threats; `goto` a threat-9 Bandit Company; contact Stonehollow and open a route (`facility trading_post 5`); hold the Mithril Lode.
- **Rules are untouched:** scenes decide nothing (`src/scenes/CLAUDE.md`). Helper logic that can be Phaser-free goes in a sibling module with tests.

### Decisions from the index this step applies (unchanged)

8. **Partner sprites are added** *(for the user's eye)*: the design lists no sprites, but stage 8 gave each partner its own, and without new ones a mountain hold, a forest people and a fortified pass would wear Millbrook's village. Step 06 draws three (C6); the orchestrator may drop the step, and the map then falls back to `map_partner_village`. Resource sites share `map_resource` and foes are existing bandit kinds, so no other sprite is needed.
9. **The world map's blight layer is tiled.** The design asks for camera bounds; the map's blight is one render texture the map's size, which at 140 × 72 is about 7,800 × 3,500 px, past the 4,096 px many GPUs allow. Step 07 tiles it (C7) and checks the cost of the fog and growth sprites over the larger board.

### Contract produced (copied unchanged from the index)

**C7. The world map at the new size (step 07)**

```ts
// src/scenes/WorldScene.ts
// PARTNER_SPRITES gains stonehollow: 'map_partner_hold', elder_glade: 'map_partner_glade', emberwatch: 'map_partner_pass'
//   (only for sprites step 06 delivered; without them the fallback stands)
// The blight layer is drawn as render-texture tiles no larger than BLIGHT_TILE_PX (2048) a side, covering the map; nothing else changes in how it looks
// The view scrolls and drags to every edge of the 140 × 72 map (mapScroll.ts)
// src/scenes/debugCommands.ts: `spawn` takes any SPAWN_KINDS encounter (its usage built from SPAWN_KINDS) and refuses one whose band, or fromThreat, does not hold the hex's threat
```

### Contracts consumed (copied unchanged from the index; built by steps 04, 05, 06)

**C4. The board and the rings (step 04)**

```ts
// src/game/worldMap.ts
export const THREAT_RINGS: readonly { upTo: number; threat: number }[] = [
  { upTo: 10, threat: 1 }, { upTo: 21, threat: 2 }, { upTo: 32, threat: 3 }, { upTo: 43, threat: 4 }, { upTo: 54, threat: 5 },
  { upTo: 67, threat: 7 }, { upTo: 80, threat: 9 }, { upTo: 94, threat: 12 }, { upTo: 108, threat: 15 }, { upTo: 122, threat: 18 },
]
export function threatAt(position: Hex): number   // the first ring whose upTo >= the distance from home; beyond the table, the last ring's threat (18)
// THREAT_BAND goes; MAX_THREAT (encounters.ts) goes, its tests using their own bounds.
export const WORLD_SIZE: BoardSize = { cols: 140, rows: 72 }
export const EARLY_SHIFT: Hex = { q: -9, r: 17 }
export function earlyHex(col: number, row: number): Hex   // stage 8's offset (col, row), translated by EARLY_SHIFT (decision 1)
// HOME = earlyHex(9, 19), which is offsetToHex(9, 36); every location of stage 8's map stands at earlyHex(its stage-8 col, row):
//   PARTNERS: millbrook earlyHex(18, 30) = offsetToHex(17, 47); saltmere earlyHex(30, 38) = offsetToHex(29, 55)
export const SOURCE_PLACE: SourcePlace = { position: offsetToHex(131, 36), threat: SOURCE_THREAT }   // 122 hexes from home

// src/game/blight.ts
export const BLIGHT_THREAT_CAP = 5
// monsterStrength(l) = l.source ? SOURCE_STRENGTH : BLIGHT_PER_THREAT * Math.min(l.threat, BLIGHT_THREAT_CAP)
export const SPAWN_DIVISOR = 840          // 200 × (140 × 72) / (60 × 40): the same pressure per hex
export const MAX_MONSTER_LOCATIONS = 60
export const SPAWN_KINDS: ReadonlyArray<{ encounter: EncounterId; name: string; fromThreat?: number }> = [
  { encounter: 'goblin_raid', name: 'Goblin Brood' },
  { encounter: 'kobold_scouts', name: 'Kobold Nest' },
  { encounter: 'bandit_camp', name: 'Bandit Gang' },
  { encounter: 'spider_nest', name: 'Spider Brood', fromThreat: 7 },
  { encounter: 'salamander_pool', name: 'Salamander Spring', fromThreat: 7 },
  { encounter: 'bandit_company', name: 'Bandit Troop', fromThreat: 7 },
  { encounter: 'freebooter_host', name: 'Freebooter Band', fromThreat: 7 },
]
// spawn: a kind is eligible where its band holds threatAt(at) and threat >= (fromThreat ?? 1); order and draws otherwise as today

// src/game/save.ts: SAVE_VERSION = 30, no migration
// scripts/simulate.ts: NEAR_SOURCE.position = earlyHex(58, 19) (offsetToHex(58, 36))
```

**C5. The outer rings' content (step 05)**

```ts
// src/game/territory.ts
export type Material = 'gold' | 'iron' | 'timber' | 'silver' | 'stone' | 'salt' | 'copper' | 'crystal' | 'peat'
  | 'ironwood' | 'mithril' | 'elderwood' | 'adamant' | 'wyrmwood' | 'starmetal' | 'heartwood'
// WORKS_NAMES: mithril, adamant, starmetal 'Mine'; ironwood, elderwood, wyrmwood, heartwood 'Lumber Camp'
// RESOURCE_YIELDS, amount 2 each (id, name, material, ring by threat):
//   ironwood_grove 'Ironwood Grove' ironwood 7 · mithril_lode 'Mithril Lode' mithril 9 · elder_grove 'Elder Grove' elderwood 9
//   adamant_deep 'Adamant Deep' adamant 12 · wyrmwood_thicket 'Wyrmwood Thicket' wyrmwood 15
//   fallen_star 'Fallen Star' starmetal 18 · heartwood 'The Heartwood' heartwood 18

// src/game/worldMap.ts: PARTNERS gains, after saltmere (positions the implementer's, inside the ring):
//   { id: 'stonehollow', name: 'Stonehollow', good: 'mithril' }   ring 7
//   { id: 'elder_glade', name: 'Elder Glade', good: 'elderwood' } ring 12
//   { id: 'emberwatch', name: 'Emberwatch', good: 'adamant' }     ring 15
// Fixed nests, 4 to 6 in each outer ring, by ring: 7 bandit_camp, spider_nest, salamander_pool (each at least once);
//   9 spider_nest, salamander_pool, bandit_company (each at least once); 12 bandit_company; 15 and 18 freebooter_host.
//   Threat by threatAt; ids and names the implementer's; loot from today's unique items.
// newWorld's locations order: the encampment, today's resources, the new resources (ring order), the partners (PARTNERS order),
//   today's nests, the outer nests (ring order), the Source last.
// src/scenes/debugCommands.ts: MATERIALS gains the seven (tsc enforces)
```

**C6. Partner sprites (step 06)**

`map_partner_hold` (Stonehollow, a mountain hold), `map_partner_glade` (Elder Glade, a forest people's glade), `map_partner_pass` (Emberwatch, a fortified pass), each in `art/map/` with the frames and animations `map_partner_village` has, at its size. Step 07 maps them in `PARTNER_SPRITES`.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npm run test:browser` (or `-- -t <name>`) after the scene change; read `e2e/CLAUDE.md` before adding an in-browser test.
- **The refactor guard and the 50-campaign check:** this step changes no rule, so it does not run the 50-campaign check (say so in the record); `npm test` keeps the refactor guard (`scripts/simulate.test.ts`) green with the fixture untouched. A mismatch means a rule moved: find it and undo it.
- **Determinism.** No world or battle RNG draw is added, dropped or reordered. Debug `spawn` draws no RNG (as today). Sound variants and anything visual use no game stream.
- **Content.** `.claude/skills/yomi-add-content/debug-command.md` for the `spawn` change. Sprites are step 06's (`.claude/skills/yomi-sprites/`); this step only maps them. Manual: `.claude/skills/yomi-manual/`.
- **Commits.** One commit for this step once `npm test` and `npm run test:browser` pass, on `long-campaign-stage-09`, without pushing; files staged by path. Message "Stage 9 step 07: the world map at the new size". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines this change makes wrong (`src/scenes/CLAUDE.md` if a contract line does); `docs/reference/scenes.md` for the blight layer's tiles, the growth sprites rule if one is added, and `spawn`'s new kinds; the manual's text for the world map. Screenshots are retaken in step 10.

## 3. Dependencies and prerequisites

- **Step 05** (and through it 04) must be done: the board is 140 × 72, `threatAt` reads the rings, `SPAWN_KINDS` has `fromThreat`, the outer nests, sites and partners exist.
- **Step 06** delivered the sprites it could; map only those. If step 06 was dropped, `PARTNER_SPRITES` is unchanged and the far partners show `map_partner_village` (record that).
- **May run beside steps 08 and 09**: this step touches `src/scenes/`, `src/testHook.ts`, `e2e/`, the manual and `docs/reference/scenes.md`; they touch `scripts/`, `logs/` and the plan. The index's task table is the only shared file (update your row only).

### Existing code (at `08854d3`, before steps 04–06; line numbers approximate)

- `src/scenes/WorldScene.ts`:
  - `LOCATION_SPRITES` (~72) and `PARTNER_SPRITES` (~79: `millbrook`, `saltmere`); the sprite is chosen at ~766.
  - `create` (~330): `mapLayer`, `buildTerrain()`, then `blightMarks` (a Graphics made off the display list), `blightLayer = this.add.renderTexture(0, 0, map.width, map.height)` from `boardPixelSize(this.world.board, WORLD_LAYOUT)` (~334), `blightSprites` (a container), road, hover and party layers.
  - `buildTerrain` (~689): every hex filled and stroked into one Graphics, once.
  - `refreshBlight` (~858): keyed on `seen` and the visible set; redraws every hex into `blightMarks` (unexplored black, the fog veil out of sight, the level's tint, the clean/blight edge lines), creates an animated `map_blight` growth sprite for every corrupted seen hex (faded out of sight), then `blightLayer.clear().draw(g).render()`.
  - `applyOrigin` / panning (~1043–1068) through `mapScroll.ts` (`mapOrigin`, `pannedOrigin`, `clampOrigin`), which clamp to the map's pixel size, so the edges should already follow the board: verify, do not assume.
  - `WORLD_LAYOUT` is `{ hexSize: 32, squashY: 1 }` (`boardGeometry.ts`); a hex is about 55 px wide and 48 px a row.
- `src/scenes/debugCommands.ts`: `spawn` (~399), usage hard-coded `spawn <goblin_raid|kobold_scouts|bandit_camp> <location id | col row>`, looks the kind up in `SPAWN_KINDS`, places it at `threatAt(at)` with no band check; `locations` (~322) lists id, kind, threat and col,row.
- `src/scenes/hexInfo.ts`, `src/scenes/worldEvents.ts` (sighting lines "threat N"), `src/scenes/routesTab.ts` (`minimapBoard`, `minimapPoints`), `src/scenes/TradingPostScene.ts` (the Routes tab, paged since step 03).
- `src/testHook.ts`: `WorldProbe` (`origin`, `view`, `roads`, `partners`, …).

## 4. Scope and guidance

### 4.1 The blight layer in tiles

- Replace the one render texture with a grid of render textures, each at most `BLIGHT_TILE_PX` (2048) px a side (export the constant from the scene or a helper), covering `boardPixelSize`. Put the tile arithmetic (which tiles, their rects, which hexes touch each, with a hex on a seam drawn into every tile it overlaps) in a Phaser-free helper with tests in the `domain` project (for example `blightTiles.ts`; the name is yours).
- Draw each tile from the same marks as today, offset to the tile's origin, so the picture is pixel-for-pixel what one texture would show: no seams, no gaps, edge lines across a seam whole. Redraw only tiles whose hexes changed if that is simple; otherwise redraw all, as today, and say so.
- Keep the layer order (terrain, blight, growth sprites, roads, locations, labels, hover, parties) and the `drawnBlight` key.
- `buildTerrain` draws ~10,000 hexes into one Graphics once; keep it unless the frame check (4.3) blames it, in which case render it into tiles the same way.

### 4.2 Scrolling to every edge

- Check that a drag and the follow-the-party origin reach the far east (column 139), the north (row 0) and the south (row 71) edges, and no further. `clampOrigin` takes the map's size; fix only what the check shows. A Phaser-free test of `mapOrigin`/`clampOrigin` with the new board's pixel size, if none covers a map this wide.

### 4.3 The cost of the fog and the growth sprites

- With `reveal` on a fresh game (the outer rings are largely corrupted from the start, and up to 60 nests), measure in the browser: the time `refreshBlight` takes (for example `performance.now()` around it, logged under a dev-only probe field) and the frame time while scrolling, against today's map size (a stage-8 checkout or the numbers before your change). Record both in the execution record.
- One animated growth sprite per corrupted seen hex may be thousands after `reveal`. If the frame time or the refresh is poor (a judgment: the map should scroll smoothly at 840 × 560 and a large window; a refresh well under a frame's budget is the aim), limit the growth sprites: for example only for hexes in tiles near the view, recreated as the view moves, or a static frame out of sight. The choice is yours; record it and what it bought. Nothing the player knows changes: the tint of a corrupted hex stays.
- If the cost comes from somewhere you cannot name, stop and say so: the step escalates to opus.

### 4.4 Partner sprites

- Add to `PARTNER_SPRITES` each of `stonehollow: 'map_partner_hold'`, `elder_glade: 'map_partner_glade'`, `emberwatch: 'map_partner_pass'` whose frames exist in the atlas (step 06). A missing frame must not be mapped (the in-browser tests fail on a console error).

### 4.5 Debug `spawn` by band

- Build the usage from `SPAWN_KINDS` (`spawn <goblin_raid|…|freebooter_host> <location id | col row>`), and refuse, with the words naming the kind, the hex's threat and the band (and `fromThreat` where it is what refuses), a kind whose band does not hold `threatAt(at)` or whose `fromThreat` is above it. For example: "bandit_company is fought at threats 8 to 13 and spawns from 7; (col,row) is threat 3." (wording yours). Everything else as today: no RNG, no pressure, the hex to blight 3, sighted, `updateSight`.
- `debugCommands.test.ts`: refused at a threat-3 hex, accepted at a threat-9 hex; a home kind still accepted at threat 1; the usage lists every `SPAWN_KINDS` encounter.

### 4.6 Threats to 20, and the minimap

- Check that `hexInfo`, the sighting and spawn lines (`worldEvents.ts`), the confrontation line and `locations all` read correctly for threats 7 to 20 (the Source "threat 20"); fix only wording or width that breaks (`locations all` now lists some 50 or more rows: it must still be readable in the console, which scrolls).
- The Routes tab's minimap (`minimapBoard` keeps the board's aspect, now about 2.2 : 1): with all five partners contacted and a far road selected, the outline, the marks and the road read well in the tab's rect at 840 × 560. If a point is too small to see, raise the marks' size, not the rule. A test of `minimapPoints` for a hex at the far east edge, if none exists.

### 4.7 In-browser tests (`e2e/world.test.ts`, `e2e/debug.test.ts` or as fits; read `e2e/CLAUDE.md`)

- The map scrolls to its far east edge: drag (`game.drag`) until the probe's origin stops moving, and check it equals the clamp for the board's width, and that a hex of column 139 is on screen.
- After the debug `reveal`, the whole map draws with no console error, and the probe reports the blight tiles (for example `blightTiles: { count, size }` added to `WorldProbe` in `src/testHook.ts`); the count is what the helper says for 140 × 72.
- A far partner shows its sprite: `reveal`, then the probe's `partners` entry for `stonehollow` names `map_partner_hold` (if step 06 delivered it; else the fallback).
- `spawn bandit_company <a threat-3 hex>` is refused with the console's error line; `spawn bandit_company <a threat-9 hex>` places it, and the location appears in the probe.
- Today's world tests pass on the shifted map (step 04 shifted their coordinates); fix any this step's change breaks.

### 4.8 Docs

- The manual (`docs/manual/README.md`, `.claude/skills/yomi-manual/`): the world map's size ("the land runs on past the Troll Lairs", the rings out to threat 18 and the Source at 20 where the map section describes them; the far partners on the map) as far as this step's screen shows it; step 10 writes the rules and retakes the screenshots.
- `docs/reference/scenes.md`: the blight layer's tiles (`BLIGHT_TILE_PX`), the growth sprites' rule if you added one, the far partners' sprites, `spawn`'s kinds and refusal, the tile probe field.
- `src/scenes/CLAUDE.md` only if a line becomes wrong (it is under its 8 KB cap; keep it so).

### 4.9 Exclusions

- No rule change (blight, spawns, threats, routes, vision); no domain file edited, unless a scene needs an export that does not change behaviour (say so).
- No sprite drawing (step 06); no screenshots (step 10); no simulator run.

## 5. Verification

- `npm test` passes, the refactor guard included, its fixture untouched; the new helper and debug tests pass.
- `npm run test:browser` passes, with the tests of §4.7.
- The refresh and frame-time figures, before and after, in the execution record and `log.md`.
- `npm run build` passes.
- By eye (a dev server, `?seed=42`, `~` then `reveal`): no seam or gap between blight tiles at any zoom of the window, today's home country looks as before, the far east is reachable by drag.
- The 50-campaign check is not run: no rule changed (state it in the record).

## 6. Completion criteria

- [ ] The blight layer is tiled at no more than 2048 px a side, looking as before; the tile helper is tested.
- [ ] The view scrolls and drags to every edge of 140 × 72.
- [ ] The fog and growth sprites' cost measured after `reveal`, with the choice made (and its effect) recorded.
- [ ] `PARTNER_SPRITES` maps the far partners' sprites step 06 delivered.
- [ ] Debug `spawn` takes every `SPAWN_KINDS` kind and refuses one outside its band or below its `fromThreat`; tested.
- [ ] Threats to 20 read correctly in the hover panel, the event lines and `locations all`; the Routes minimap reads well with five partners.
- [ ] The in-browser tests of §4.7 pass; `npm test` and `npm run build` pass.
- [ ] The manual's world-map text and `docs/reference/scenes.md` current.
- [ ] One commit, "Stage 9 step 07: the world map at the new size", no attribution lines, files staged by path; the index's row 07 updated with status and commit.

## 7. Execution record

### Engineer run (sonnet-tier brief, run beside another step on main)

- **Blight tiles.** `src/scenes/blightTiles.ts` (Phaser-free, tested in `blightTiles.test.ts`): `BLIGHT_TILE_PX = 2048`, `blightTiles(board, layout)` returns 4 × 2 = 8 tiles for 140 × 72, each with `hexes` (every hex whose marks reach it, a seam hex in each tile it overlaps) and `watch` (those plus their neighbours). `WorldScene` draws each tile from only its hexes with `texture.draw(g, -x, -y)`, same marks and order as before. A tile is redrawn only when the levels or visibility of its `watch` hexes changed (an addition beyond the task's "if simple"); the growth sprites are still all rebuilt on a refresh. `drawnBlight` key and layer order kept.
- **Scrolling.** `clampOrigin` already followed the board; verified by a `mapScroll.test.ts` case on the 140 × 72 pixel size and an in-browser drag test (`e2e/world.test.ts`, far east: the origin stops at the clamp, column 139 on screen). No code change.
- **Cost (headless Chromium, software GL, machine under load from another run; 800-ish px canvas, after `reveal`, 240 frames idle).** Old single 7,800 × 3,500 texture at 140 × 72: mean frame 48.1 ms, p95 50.1. Tiled: mean 46 ms, p95 50.1, `refreshMs` 42 ms on the full reveal (all tiles, 1,166 growth sprites). With growth sprites disabled: refresh 36 ms, frames no better (mean 50 to 56 ms): the growth sprites are about 6 ms of the refresh and not the frame cost; the frame time is the software renderer's, equal before and after. So growth sprites were not limited. A step of the party redraws one or two tiles, not eight. No stage-8-size baseline was taken (not cheap to build); the old code at the new size is the baseline.
- **Partners.** `PARTNER_SPRITES` maps stonehollow, elder_glade, emberwatch to `map_partner_hold`, `map_partner_glade`, `map_partner_pass` (all three frames exist in the atlas). Probe: `partners[].sprite`, and `blightTiles { count, size, refreshMs, growths }`.
- **Spawn.** The usage is built from `SPAWN_KINDS`. A hex whose threat is outside the kind's band or below `fromThreat` is refused: "bandit_company is fought at threats 8 to 13 and spawns from 7; 12,36 is threat 3." The test `spawn bandit_camp 4 22` moved to `34 36` (threat 3), as (4, 22) is threat 2, below the bandit camp's band: a deliberate behaviour change of this task.
- **Threats to 20, minimap.** `hexInfo`, `worldEvents` and `locations` print the number, so no width issue; the minimap's aspect is handled by `minimapBoard` and the marks (4 px nests, 3 px partners) are kept; `minimapPoints` gained a far-east test.
- **Docs.** `docs/reference/scenes.md` (tiles, partner sprites, probe fields, spawn), manual's world-map size sentence. `src/scenes/CLAUDE.md` unchanged. No 50-campaign check (no rule changed). No domain file edited.
- **Departures.** Index and `log.md` not edited (brief); the log line is in the engineer's report.
