# Step 01: Partners, contact and silence

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-08-trade-routes.md) (§2 Partners; §5 technical notes, versions) · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.3 (trade partners), §5.1 (state), §5.2 (modules) · [Stages index](../../designs/long-campaign/index.md) (the early-game guard, versions)

**Difficulty:** opus / opus. The engineer should be opus (model unset): the step adds a location kind that many switches on `kind` must handle, adds saved state (with no migration, decision 15), and must leave the refactor guard and the 50-campaign check identical. The reviewer should be opus, to check the save's strict check, every `kind` switch, and that no simulated campaign moves.

## 1. Objective

Measure the stage's baseline, then give the domain its trade partners:
- a new location kind, `PartnerLocation` (`kind: 'partner'`, with a `good`), and two partners on today's map, **Millbrook** (timber) and **Saltmere** (salt), placed by `newWorld`;
- `WorldState.contacted`, `silent`, `routes` (empty until step 02) and `routesOpened`;
- `src/game/trade.ts` (new) with `TradeRoute`, the partner readers, `contactPartner` and the daily `partnerDay` (contact by a presence on the partner's hex; silence at `LOSS_LEVEL`, waking at 0);
- partners as clean sources of `PARTNER_STRENGTH` (3) in the blight;
- the events `partner_contacted`, `partner_silent`, `partner_restored`; `partner_silent` is notable;
- `SAVE_VERSION` 28, with no migration: older saves read as unreadable (decision 15).

Play in the simulator does not change: every simulated world is built without partners (`SIM_PARTNERS = []`, temporary), so the refactor guard and the 50-campaign check stay identical. In the game itself, partners appear on the world map (drawn with the resource sprite until step 05) and can be contacted. Routes are step 02's; the world map's partner icons, lines and hex info are step 05's.

## 2. Requirements and context

- **S8-R1** (economy R5, A4): partners, contact and silence. "A partner is contacted by stepping on it, falls silent at `LOSS_LEVEL` and wakes at 0." Partners are clean sources of strength 3. A partner is never held, yields nothing directly and is never lost.
- **Design §2:** Millbrook (timber) at (18, 30), in the threat 2 ring; Saltmere (salt) at (30, 38), on the south edge in the threat 3 ring (the stage wins over the reference's ring 5). Stage 9 moves them.
- **Design §5:** `SAVE_VERSION` is bumped (routes, contacts and partners). `LOG_SCHEMA_VERSION` is unchanged: world events are not in the battle log.
- Inspected on today's map (seed 1): neither hex is occupied; both start at blight 1 (tainted, so not silent); Millbrook is 14 hexes from home, Saltmere 30.

### Decisions from the index this step implements (unchanged)

2. **Contact and silence are daily, in a new `partnerDay`.** The design names `contactPartner` "called from the travel step"; the plan instead contacts in the world's day (`updateTerritory` calls `partnerDay`), for every presence standing on an uncontacted partner's hex. Each walked hex ends a day with the party on it, so this is the same for walking and covers garrisons and debug moves too. `contactPartner(world, id)` stays exported for `partnerDay` and the debug console. Contact is not notable (the design's `isNotable` list leaves it out); its line shows in the day's events like a capture.
3. **Silence is tracked for every partner, told only for contacted ones.** `WorldState.silent` holds the partners silent now (entered at `LOSS_LEVEL`, left at 0). `partner_silent` and `partner_restored` are emitted only for contacted partners. A partner is a clean source of `PARTNER_STRENGTH` (3) whether silent or not: it is never lost, and its strength never changes, so the fields memo is untouched by silence.
14. **Determinism through step 06.** Steps 01–06 must not move the refactor guard or the 50-campaign check. The simulator builds its worlds without partners (`SIM_PARTNERS`, temporary, step 01) and keeps the Lodge at 2 (`SIM_LODGE_CAP`, temporary, step 03), so no simulated campaign has a partner, route or road until step 07, which removes both holds and re-records the fixture once.
15. **No save migration** (the user's decision, 2026-11-21). `SAVE_VERSION` 27 → 28 in step 01, one bump for the stage (contacts, silence, routes and the partner locations together), and no `migrateFrom27`: a save of any earlier version reads as unreadable, the project's default. With nothing to take them to 28, the older migrations (`migrateFrom18` to `migrateFrom26`) go too; the captured fixtures stay, as tests that each older version is refused.

### Contract (copied unchanged from the index)

**C1. Partners, contact and silence (step 01)**

```ts
// src/game/worldMap.ts
export interface PartnerLocation extends LocationBase { kind: 'partner'; good: Material }   // a neutral settlement: never held, never lost
export type WorldLocation = MonsterLocation | QuietLocation | PartnerLocation                // LocationKind gains 'partner'
export const PARTNERS: readonly PartnerLocation[] = [
  { id: 'millbrook', kind: 'partner', name: 'Millbrook', position: offsetToHex(18, 30), good: 'timber' },   // threat 2 ring
  { id: 'saltmere', kind: 'partner', name: 'Saltmere', position: offsetToHex(30, 38), good: 'salt' },       // threat 3 ring, south edge
]
export function newWorld(seed?: number, encampmentName?: string, partners: readonly PartnerLocation[] = PARTNERS): WorldState
//   copies of `partners` placed in `locations` after the resources, before the monsters, before the blight is seeded
// WorldState gains (newWorld: [], [], [], 0):
contacted: string[]        // partner ids contacted, in the order contacted; permanent
silent: string[]           // partner ids silent now: entered when the hex reaches LOSS_LEVEL, left when it is 0
routes: TradeRoute[]       // open routes, in the order opened (filled from step 02)
routesOpened: number       // routes ever opened

// src/game/trade.ts (new)
export interface TradeRoute {
  id: string               // 'route_<partner id>'
  partner: string
  road: Hex[]              // the encampment's hex excluded, the partner's included; fixed when opened
  opened: number           // the world turn it opened
  raidedDays: number       // raided yield days in a row
}
export function partners(world: WorldState): PartnerLocation[]                 // in locations order
export function partnerById(world: WorldState, id: string): PartnerLocation | null
export function isContacted(world: WorldState, id: string): boolean
export function isSilent(world: WorldState, id: string): boolean
export function contactPartner(world: WorldState, id: string): WorldEvent | null   // partner_contacted, or null (not a partner, or contacted already)
export function partnerDay(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
//   every day, called by updateTerritory after the yields: first contact (partners in locations order, each with a presence on its hex),
//   then silence (a partner not silent whose hex is >= LOSS_LEVEL joins `silent`; a silent one whose hex is 0 leaves it);
//   partner_silent / partner_restored only for contacted partners

// src/game/blight.ts
export const PARTNER_STRENGTH = 3   // sources(): every partner location a clean source of this, silent or not
// WorldEvent gains:
//   | { type: 'partner_contacted'; partner: string; name: string; home: string }   // home: the encampment's name
//   | { type: 'partner_silent'; partner: string; name: string }
//   | { type: 'partner_restored'; partner: string; name: string }

// src/game/territory.ts: sites(world) returns only 'encampment' and 'resource' locations (partners excluded)
// src/game/worldMap.ts: isNotable(partner_silent) is true
// src/game/save.ts: SAVE_VERSION = 28, no migration (decision 15: older saves unreadable); the strict check covers partners (kind, a Material good),
//   contacted and silent (ids of partner locations), routes (TradeRoute's shape, partner a location id) and routesOpened
// src/scenes/WorldScene.ts: LOCATION_SPRITES.partner = 'map_resource' (temporary, for tsc; step 05 draws the partner sprites)
// scripts/simulate.ts (temporary, removed in step 07):
export const SIM_PARTNERS: readonly PartnerLocation[] = []   // every simulated world (campaigns and the waiting twin) is newWorld(seed, undefined, SIM_PARTNERS)
```

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). **Never run two campaign simulations at once.** A 500-campaign run takes about five minutes alone.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1 with `--parties 1`, each `CampaignRecord` and a SHA-256 of every battle event, against `GUARD_RECORDS`. Shape and rules: `.claude/skills/yomi-balance/guards.md`. **Steps 01–06 must not edit the fixture** and must keep it green. A mismatch means the step changed play: find the cause and fix it. Steps 01–03 also run the **50-campaign check** before committing, against step 01's baseline, and record "identical" or the diff:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  It must be identical (decision 14).
- **The early-game figure.** Stage 7 ended at 239 of 500 with `--parties 1` (`--ready-level` 7, seed 1) and 239 with the default company. **Step 01 re-measures both on the branch before any change**, and the company at `--ready-level 10`; that is the stage's baseline. Step 08 measures again. The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. New territory events come after the day's existing ones (partners after the market's yield, routes after the partners), so a day's existing events keep their order.
- **Import cycles.** `trade.ts` imports `blight.ts`, `territory.ts`, `worldMap.ts` and `buildings.ts`; `territory.ts` and `blight.ts` import it back. Safe only while nothing calls across at module load; add `trade` to the cycle lists in the root and `src/game/` CLAUDE.md files.
- **Versions.** `SAVE_VERSION` 28 in step 01 (decision 15). `LOG_SCHEMA_VERSION` is unchanged: world events are not in the battle log.
- **Content.** New content follows `.claude/skills/yomi-add-content/`: `location-kind.md` (partners, steps 01 and 05). Balance: `.claude/skills/yomi-balance/`.
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on `long-campaign-stage-08`, without pushing; files staged by path. Messages "Stage 8 step NN: <title>". No attribution lines.
- **Docs.** CLAUDE.md files stay current: each step fixes the lines its change makes wrong and searches them, `.claude/` and `docs/reference/` for every name it renames or removes. Step 08 updates `docs/reference/` fully and retakes screenshots.

## 3. Dependencies and prerequisites

- **None.** This is the first step. It runs on the stage branch, not in a worktree.
- **Existing (at `42cde46`):**
  - `src/game/worldMap.ts`: `LocationBase`, `MonsterLocation`, `QuietLocation` (`kind: 'encampment' | 'resource'`), `WorldLocation`, `LocationKind`, `WorldState`, `newWorld(seed, encampmentName)` (locations list, then `seedBlight`, `initialHeld`, `seedBlight` again, `seedSight`), `isNotable`, `locationAt`, `monstersHere`, `routeTo`, `encampmentName`.
  - `src/game/blight.ts`: `sources(world)` (monsters as blight sources; held quiet locations as clean sources by `siteStrength`; towers), the `fields` memo keyed by `JSON.stringify` of the source lists, `WorldEvent`, `spawn` (its `keepClear` and `occupied` lists).
  - `src/game/territory.ts`: `sites(world)` (today: every location not `'monsters'`), `initialHeld`, `updateTerritory` (captures and losses, threats, then on yield days the sites' yields and the market's), `LOSS_LEVEL` (2), `Material`.
  - `src/game/buildings.ts`: `improvementSite` (refuses `kind === 'monsters'`, the encampment and unheld), `towerSiteRefusal` ("A watchtower cannot stand on the encampment or a resource." for any `locationAt`).
  - `src/game/save.ts`: `SAVE_VERSION = 27`, the chain `migrateFrom18` → `migrateFrom22` → `migrateFrom25` → `migrateFrom26`, `locationOf` (monsters' loot as items), the strict check in `parseSave` (accepted versions `[SAVE_VERSION, 26, 25, 24, 23, 22, 18]`); fixtures `src/game/fixtures/save-v18.json`, `save-v22.json`, `save-v25.json`, `save-v26.json`.
  - `src/scenes/WorldScene.ts`: `LOCATION_SPRITES: Record<LocationKind, string>`, `knowledgeOf` (non-monsters known by `seen`), `refreshLocations`, `refreshLabels`, `labelColor`; `src/scenes/hexInfo.ts` (treats every non-monster as encampment or resource).
  - `scripts/simulate.ts`: `startCampaign(…, game = newGame(startingParty(args), null, seed))`, `waitingIncome` (builds its own game), `improveErrand`, `nextTarget`, `guardChoice` (filters on `kind === 'monsters'` and `sites`).
  - `src/game/gameState.ts`: `newGame(party, slot, seed, encampmentName, tutorial)` calls `newWorld(seed, encampmentName)`.
- **Produced for later steps:** everything in C1. Step 02 fills `routes` and uses `TradeRoute`, `partnerById`, `isContacted`, `isSilent`; step 05 replaces `LOCATION_SPRITES.partner`; step 06's `contact` debug command calls `contactPartner`; step 07 removes `SIM_PARTNERS`.

## 4. Scope and guidance

### 4.1 The baseline (before any code change)

On a clean checkout of the branch at `42cde46`, one run at a time (never two at once), each with its own `--out`:

```sh
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
shasum -a 256 logs/guard-50.jsonl
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- --campaign --battles 500 --seed 1 --parties 1 --out logs/base-p1.jsonl > logs/base-p1.txt
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- --campaign --battles 500 --seed 1 --out logs/base-company.jsonl > logs/base-company.txt
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- --campaign --battles 500 --seed 1 --ready-level 10 --out logs/base-company-rl10.jsonl > logs/base-company-rl10.txt
```

The `yomi-measure` agent may run them (one at a time). Record in `log.md` (and summarise in the execution record): the 50-campaign SHA-256 and Source wins; for each 500 run the Source wins of 500, mean days, deaths, and the gold-by-source and income lines. Keep the 50-campaign files' hash to compare after the change.

### 4.2 Partners in the world (`src/game/worldMap.ts`)

- Add `PartnerLocation`, widen `WorldLocation`, export `PARTNERS` (C1). `Material` comes from `territory.ts` (`import type`).
- `newWorld` takes `partners = PARTNERS` and places copies (`{ ...p, position: { ...p.position } }` or equivalent; never share the constant's objects with a world) after the resources and before the monsters, before the first `seedBlight`. Add `contacted: []`, `silent: []`, `routes: []`, `routesOpened: 0`.
- `isNotable`: `partner_silent` returns true; `partner_contacted` and `partner_restored` stay false (default).
- Doc comments: the file's location kinds (a partner is neutral, never held or lost).

### 4.3 `src/game/trade.ts` (new)

- The module's header comment: what partners and (from step 02) routes are, the cycle note (imports `blight.ts`, `territory.ts`, `worldMap.ts`; `territory.ts` imports it back; nothing called at load).
- `TradeRoute`, `partners`, `partnerById`, `isContacted`, `isSilent`, `contactPartner`, `partnerDay` exactly as C1.
- `contactPartner` pushes the id to `world.contacted` and returns `{ type: 'partner_contacted', partner, name, home: encampmentName(world) }`.
- `partnerDay`: contact first (every partner in locations order with any presence on its hex), then silence for every partner (`blightAt(world, position) >= LOSS_LEVEL` joins `silent`; a silent one at 0 leaves it), with `partner_silent` / `partner_restored` only when contacted. A partner newly contacted on the day it goes silent gets both events, contact first.

### 4.4 The blight (`src/game/blight.ts`)

- `PARTNER_STRENGTH = 3`; `sources()` pushes every `kind === 'partner'` location as a clean source, silent or not. Check that the existing branch (`else if (world.held.includes(location.id))`) still never treats a partner as a site.
- `WorldEvent` gains the three partner events (C1).
- `spawn`: leave `keepClear` and `occupied` as they are (a partner's hex is occupied, as every location's is; partners are not in `keepClear`: a nest near a partner is a raid the player must answer). Changing them would move play.

### 4.5 Territory (`src/game/territory.ts`)

- `sites(world)` returns only `'encampment'` and `'resource'` (a type guard to `QuietLocation`). `initialHeld`, captures, losses, threats and yields then never touch a partner.
- `updateTerritory` calls `partnerDay(world, presences)` at its end, after the market's yield, and appends its events (decision 2; the order rule in the shared constraints).

### 4.6 Every switch on a location's kind

Search `src/`, `scripts/` and `e2e/` for `kind === 'monsters'`, `kind !== 'monsters'`, `kind === 'resource'`, `kind === 'encampment'`, `'encampment' | 'resource'`, `QuietLocation` and `LocationKind`, and make each right for a partner. Known places:
- `territory.ts` `sites()` (above).
- `buildings.ts` `improvementSite`: a partner is never held, so it already returns null; make the check explicit (`here.kind !== 'resource'`) if that reads clearer. `towerSiteRefusal`'s words: "A watchtower cannot stand on the encampment or a resource." becomes "A watchtower cannot stand on a location." (or names the partner); update its test.
- `src/scenes/hexInfo.ts`: a partner must not be described as "Resource, not held" or get a yield or "Next:" line. This step only keeps it truthful: title the partner's name with one line "Trade partner: <good>." (step 05 replaces it with `partnerInfoLines`). A partner's hex is known as a resource's is, by `seen`.
- `src/scenes/WorldScene.ts`: `LOCATION_SPRITES.partner = 'map_resource'` (temporary); `knowledgeOf` already treats non-monsters by `seen` (correct for partners); `labelColor` must not colour a partner as a held site (a neutral colour; step 05 sets the final one); `refreshLabels` must not star a partner or ask `daysToFall` for it (it is never held or threatened, so check only).
- `src/scenes/partyList.ts` `knownLocationAt`, `src/scenes/worldEvents.ts`, `sounds.ts`: check only. `describeWorldEvent` is an exhaustive switch over `WorldEvent['type']`: add the three partner types so `tsc` passes, with the C5 lines if convenient ("Millbrook will trade with Oakvale.", "Millbrook has fallen silent under the blight.", "Millbrook is trading again."), else `''` for step 05 to fill; say which in the record.
- `src/scenes/debugCommands.ts` `locations`, `goto`: check a partner lists and is reachable.
- `src/game/save.ts` `locationOf`: partners pass through as they are (no items).
- `scripts/simulate.ts`: `improveErrand`, `nextTarget`, `guardChoice` use `sites()` and `kind === 'monsters'` filters, which exclude partners; check, and note in the record (moot while `SIM_PARTNERS` is empty).
- `.claude/skills/yomi-add-content/location-kind.md` checklist: `LOCATION_SPRITES` entry (tsc enforces it; temporary `'map_resource'` here, the real sprites in step 05). Add a line to that checklist for what you found the skill missing (for example "`sites()` and the other `kind` switches in `territory.ts`, `buildings.ts`, `hexInfo.ts`, `WorldScene.labelColor`, `save.ts`'s strict check").

### 4.7 Saves (`src/game/save.ts`)

- `SAVE_VERSION = 28` and only it accepted (decision 15: no migration). The old migrations (`migrateFrom18`, `migrateFrom22`, `migrateFrom25`, `migrateFrom26`, `clampMana`) have nothing to take a save to 28 and go, with their tests; every older fixture (18, 22, 25, 26, and a captured `save-v27.json`) is tested to read as unreadable.
- The strict check (C1): every `kind === 'partner'` location has a `good` that is a `Material`; `contacted` and `silent` are arrays of ids of partner locations (no duplicates); `routes` is an array of `TradeRoute` (string `id` and `partner`, `partner` the id of a partner location, `road` an array of hexes, integer `opened` and `raidedDays` ≥ 0); `routesOpened` an integer ≥ 0. Keep the improvements check's `kind === 'resource'`.
- Capture a version-27 fixture **before** bumping: `src/game/fixtures/save-v27.json`, a real `serializeSave` output of a game with an outpost or works and some turns passed (follow how `save-v26.json` was captured; see its test). Test that it loads as 28 with both partners, empty contacts and routes, and that it round-trips.
- Doc comment above `SAVE_VERSION`: what 28 adds.

### 4.8 The simulator hold (`scripts/simulate.ts`)

- Export `SIM_PARTNERS: readonly PartnerLocation[] = []` with a comment "temporary: removed in step 07 (stage 8 plan, decision 14)".
- Every simulated world is built with it: `startCampaign`'s default `game` and `waitingIncome`'s game. For example `const game = newGame(...); game.world = newWorld(seed, undefined, SIM_PARTNERS)` (`newGame` draws nothing else from the seed, and the expedition stands on the encampment's hex, which is the same), or a small `simGame(args, seed)` helper used by both. Do not add a parameter to `newGame` for it.
- With no partners, `partnerDay` returns nothing and `sources()` adds nothing, so play is identical. Prove it (§5).

### 4.9 Docs in this step

- `src/game/CLAUDE.md`: the module list gains `trade.ts` ("trade partners, contact and silence; routes from step 02"); the import-cycle line gains `trade.ts`. Root `CLAUDE.md`: the import-cycle contract's list (`blight`/`territory`/`worldMap`) gains `trade`. Keep both within their size caps (`scripts/claudeMd.test.ts`).
- `docs/reference/game.md`: a short "Trade partners" paragraph under the world map or territory section (the two partners, contact, silence, strength 3), and "Versions and migrations" gains 28. Step 08 completes the reference.
- No manual change yet (the map shows partners with the resource icon until step 05; step 05 writes the manual's text for them).

### 4.10 Exclusions

- No routes, raids, guards, road sources or `tradeDay` (steps 02, 03). No partner sprites, hex-info lines beyond the one above, overlay or sounds (step 05). No debug `contact` command (step 06). No change to the simulator's policy beyond `SIM_PARTNERS`. Do not edit the guard fixture.

## 5. Verification

- **Tests to write** (domain project unless noted):
  - `src/game/trade.test.ts` (new), economy A4: a party presence stepping on Millbrook contacts it on that day's `partnerDay` (via `passTurn` or `updateTerritory`), once (a second day emits nothing); `contactPartner` returns null for a non-partner and for a contacted one; contact order kept in `contacted`; a partner's hex pushed to `LOSS_LEVEL` makes it silent with `partner_silent` (contacted) and silently for an uncontacted one; at 1 it stays silent; at 0 `partner_restored` and it leaves `silent`; `isNotable(partner_silent)` true, `partner_contacted` false.
  - `src/game/blight.test.ts`: a partner is a clean source of `PARTNER_STRENGTH` (`netInfluence` at and beside its hex differs from a world without it by the expected pushes); its strength is the same when silent; the fields memo key does not change when a partner goes silent.
  - `src/game/territory.test.ts`: `sites()` excludes partners; `initialHeld` never holds a partner; no yield, capture or `site_lost` for a partner whatever its blight.
  - `src/game/worldMap.test.ts`: `newWorld()` places Millbrook at `offsetToHex(18, 30)` (good timber, `threatAt` 2) and Saltmere at `offsetToHex(30, 38)` (good salt, `threatAt` 3), after the resources and before the monsters, as copies (mutating one world's partner leaves `PARTNERS` and other worlds alone); `newWorld(seed, name, [])` has no partner and the same blight as before this step for that seed (compare with a stored count or hash taken from the old code, or with a world built by filtering partners out before seeding).
  - `src/game/save.test.ts`: every older fixture (18 to 27) reads as unreadable; a version-28 game with contacts, silence and a hand-made route round-trips; the strict check refuses a bad `good`, a `contacted` id that is not a partner, and a malformed route.
  - `src/game/buildings.test.ts`: the tower refusal's new words.
  - `src/scenes/hexInfo.test.ts`: a partner's hex reads its name and "Trade partner: timber.", no resource lines.
- **Gates:**
  - `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes, including `scripts/simulate.test.ts`'s refactor guard **unchanged**.
  - The 50-campaign check (command in §2's shared constraints) after the change has the **same SHA-256** as the baseline in §4.1; record both.
  - `npm run test:browser -- -t <world>` (the world map's in-browser tests) still pass, as this step touches `WorldScene.ts` and `hexInfo.ts`; record the count. A dev build shows Millbrook and Saltmere with the resource icon once explored (look, or say why not).
  - `scripts/claudeMd.test.ts` passes (size caps).

## 6. Completion criteria

- [ ] Baseline recorded in `log.md`: the 50-campaign hash, and Source wins (and days, deaths, income lines) of the 500-campaign `--parties 1`, default company, and default company `--ready-level 10` runs, seed 1, run one at a time.
- [ ] C1 implemented exactly: `PartnerLocation`, `PARTNERS`, `newWorld`'s `partners` parameter, the four `WorldState` fields, `trade.ts` with `TradeRoute`, the readers, `contactPartner`, `partnerDay`; `PARTNER_STRENGTH` sources; the three events; `sites()` without partners; `isNotable(partner_silent)`.
- [ ] Every `kind` switch checked (§4.6), with the record listing each place and what changed.
- [ ] `SAVE_VERSION` 28 with no migration (older fixtures refused), the strict check, and its tests.
- [ ] `SIM_PARTNERS = []` used for every simulated world; the refactor guard green and untouched; the 50-campaign hash identical to the baseline.
- [ ] The tests of §5 written and passing; `npm test` and the world map's in-browser tests pass.
- [ ] CLAUDE.md (root and `src/game/`), `docs/reference/game.md` and `.claude/skills/yomi-add-content/location-kind.md` updated as §4.6 and §4.9 say.
- [ ] One commit, "Stage 8 step 01: partners, contact and silence", files staged by path, no attribution lines, not pushed; the index's row 01 updated with status and commit.
- [ ] The execution record says whether `describeWorldEvent` got the partner lines here or `''` for step 05.

## 7. Execution record

**Engineer (opus), 2026-11-21.**

Baseline (§4.1): run by the `yomi-measure` agent in a clean worktree at `b28bba1`, one run at a time, before any code change; figures in [`log.md`](log.md). 50-campaign SHA-256 `1ceefe63…74400d1` (23 of 50); `one` 239 of 500, 286 days, 1.1 dead; `company` 239, 286 days, 1.1 dead; `rl10` 434, 509 days, 1.0 dead. Gold by source: sites 228 / 227 / 406, market 0 / 0 / 3, sales 42 / 42 / 144. No income line (that needs `--waiting`).

What was built: C1 as written, except the save (below). `PartnerLocation`, `PARTNERS` and `newWorld`'s `partners` parameter (copies, after the resources, before the monsters); `contacted`, `silent`, `routes`, `routesOpened`; `trade.ts` with `TradeRoute`, `partners`, `partnerById`, `isContacted`, `isSilent`, `contactPartner`, `partnerDay` (called last in `updateTerritory`); `PARTNER_STRENGTH` 3 in `sources()`; the three events; `isNotable(partner_silent)`; `sites()` only the encampment and resources; `SIM_PARTNERS = []` through a `simGame` helper used by `startCampaign` and `waitingIncome`. `describeWorldEvent` got the C5 lines for the three partner events (not `''`), with a test.

**Deviation: no save migration** (the user's decision, relayed by the orchestrator mid-step; decision 15 revised in the index and this file). I first built `migrateFrom27` and its tests, then removed it. `SAVE_VERSION` is 28 and only 28 is read. With no migration to 28, the older chain (`migrateFrom18`, `migrateFrom22`, `migrateFrom25`, `migrateFrom26`, `clampMana`, and the `FOLDED`/`RETIRED_PERKS` tables) could never produce a readable save and `tsc`'s `noUnusedLocals` refused it, so it went with its tests (the version-18, 22, 25, 26 describes, the version-23 and 24 battle-default tests, the version-18 battle test). The fixtures stay, with `save-v27.json` captured before the bump (a real `serializeSave` of `newGame(_, 1, 1)` after 12 turns, works on Iron Vein, the Lodge at 2, a day order `improve`): one test reads each of 18, 22, 25, 26, 27 as unreadable. The strict check covers partners' `good` (a key of `WORKS_NAMES`, the full record of materials), `contacted` and `silent` (distinct partner ids), `routes` (`TradeRoute`'s shape to a partner) and `routesOpened`.

The other decision the orchestrator relayed (the road keeps out of `RAID_RADIUS` where it can) is step 02's: decision 6, the open question, C2's `roadTo` comment, and steps 02, 06 and 07's text were updated; nothing was implemented here.

Every `kind` switch (§4.6):
- `territory.ts` `sites()`: now `encampment` or `resource` (a type guard to `QuietLocation`).
- `buildings.ts` `improvementSite`: `here.kind !== 'resource'` (was `=== 'monsters'`); `towerSiteRefusal`: "A watchtower cannot stand on a location." (`company.test.ts` and `buildings.test.ts` updated; the manual does not quote it).
- `blight.ts` `sources()`: the partner branch before the held-site branch; `spawn`'s `keepClear` and `occupied` unchanged.
- `hexInfo.ts`: a partner branch, "Trade partner: <good>."; known by `seen`.
- `WorldScene.ts`: `LOCATION_SPRITES.partner = 'map_resource'` (temporary); `refreshLabels` names an improvement only for a resource (tsc caught it); `labelColor` white for a partner; `knowledgeOf` unchanged (by `seen`).
- Checked, unchanged: `vision.ts` (held sites only), `partyList.ts` `knownLocationAt`, `debugCommands.ts` `locations` (lists "partner") and `goto` (any location id), `company.ts` (monsters only), `save.ts` `locationOf` (partners pass through), `scripts/simulate.ts` `improveErrand`, `nextTarget`, `guardChoice` (on `sites()` or monster filters, so partners excluded; moot while `SIM_PARTNERS` is empty), `sounds.ts` (no partner sounds until step 05).

Tests: `trade.test.ts` (new, 11), partner tests in `blight.test.ts`, `territory.test.ts`, `worldMap.test.ts`, `hexInfo.test.ts`, `worldEvents.test.ts`, `save.test.ts`. Five existing tests pinned numbers from before the partners (`blight.test.ts` "the numbers of one party, pinned" ×2 and "spawns at threats 1 and 2 as before bandits", `worldMap.test.ts`'s walks-and-camps characterization, and its "no settlement but the encampment"); the first four now build their world with `newWorld(seed, undefined, [])` and still match their stored hashes, which shows the rest of the rules unchanged; the last now expects the `partner` kind. A new test checks `newWorld(1, undefined, [])` against a hash taken from the code at `b28bba1`. Mutation checks: dropping the `partnerDay` call, the partner source, or the `sites()` filter each fails a new test.

Verification:
- `npm test`: 2416 passed, 1 failed: `scripts/records.test.ts` "keeps each new plan index under 32000 bytes" (this plan's `index.md` is about 38.7 KB). It failed the same at `b28bba1`, before any change of mine; the plan's own size, not this step. Committed regardless; the orchestrator should trim the index (or decide otherwise).
- Refactor guard: green, fixture untouched.
- 50-campaign check after the change: SHA-256 identical to the baseline.
- `npm run test:browser -- e2e/world.test.ts`: 62 passed (run before the save change, which touches no scene).
- `scripts/claudeMd.test.ts`: passes.
- A dev build was not looked at by eye; the world map's in-browser tests load the map with partners on it, and `hexInfo`'s test covers their line.

Docs: root `CLAUDE.md` (cycle list), `src/game/CLAUDE.md` (cycle, `trade.ts`), `docs/reference/game.md` (partners, strength, notable, versions rewritten for 28 with no migration), `.claude/skills/yomi-add-content/location-kind.md` (the `kind` switches, and what tsc catches).

For later steps: `trade.ts` does not import `buildings.ts` yet (step 02 adds it). `simGame` in `scripts/simulate.ts` is where step 07 drops `SIM_PARTNERS`. Tests that build `newGame(…, 1)` in `scripts/simulate.test.ts` now have partners on their world; none moved.
