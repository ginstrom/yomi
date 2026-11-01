# Step 06: The battle screen

Task: make the battle screen show what steps 02 to 05 added to the engine: a routine played as its strikes, an area ability's hexes and outcomes, and, on hovering a foe, its abilities, their recharge and its wards.

- **Plan:** [index.md](index.md)
- **Source design:** [`docs/designs/long-campaign/stage-02-special-attacks-and-elements.md`](../../designs/long-campaign/stage-02-special-attacks-and-elements.md) (§2 "The scene", §4 "What the player sees", §6 scene tests). Reference: [`reference/campaign-to-level-20.md`](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.4 "The scene", R12, A8.
- **Difficulty:** moderate, pattern-following on the existing spell-effect path (`showCast`, `SPELL_LOOKS`, `impactMs`, `eventSounds`) plus one small new Phaser-free helper. Sonnet can do it; review by the session model.

## 1. Objective

When this step is done:
- each strike of a routine plays as an attack does today: swung, landing, heard, its log line naming the strike's verb;
- an `AbilityEvent` (an area ability) plays through the spell-effect path: the unit turns and gestures, the area's hexes flash, each outcome lands with its outline and hit points, and what follows waits for it;
- `eventSchedule`, `battleEffects` and `sounds` cover the `'ability'` event;
- hovering an enemy unit that has abilities or wards shows a small panel of `foeInfoLines`, and the battle probe reports it as `foeInfo`;
- the scene, domain and browser tests cover all of it.

No rule changes here: the engine, policies and log text (`formatEvent`) are done in steps 03 to 05.

## 2. Requirements and context

- **S2-R6** (campaign R12): the scene shows routines, areas (hexes and outcomes) and abilities in a tooltip.
- **Design §4, what the player sees:**
  - a Salamander spits a cone of fire; the cone's hexes flash, and every unit in it, its own kobolds included, takes fire damage; a miss still burns for half;
  - Giant Spiders web an archer from range, then close and bite twice;
  - hovering a foe lists its abilities, with "ready" or "recharging, 2 rounds", and its wards.
- **Design §6, scene tests:** the AbilityEvent's effect, schedule and sound; log text; tooltip lines.
- **Corrections from the index that apply here:**
  - **4. There is no foe tooltip today.** The battle screen shows only nameplates and hit-chance labels. This step adds a small hover panel for an enemy unit that has abilities or wards, from a Phaser-free helper, `foeInfo.ts`. A foe with neither shows nothing new.
  - **8.** `AbilityEvent` has `distance`, as `CastEvent` has, for the scene's timing. `Ability` and `Strike` have a `verb` for the log line.
  - **10. Recharge.** Using an ability with `recharge` N ≥ 1 sets its counter to N. The counter falls by 1 as the unit's side's turn begins, after status ticks and regeneration, and the ability is usable at 0. Recharge 0 limits nothing but AP. So a counter of 2 reads "recharging, 2 rounds".
- **Contract C8 (this step produces it), unchanged from the index:**

  ```ts
  // src/scenes/foeInfo.ts (new, Phaser-free)
  /** What hovering a foe tells: a line per ability ("Fire Spit: ready", "Web: recharging, 2 rounds"), then its wards ("Wards: fire 99"); [] for a unit with neither. */
  export function foeInfoLines(unit: UnitSnapshot): string[]
  ```

  - `BattleScene` shows those lines in a small panel beside an enemy unit while the pointer is over its hex, and nothing for a unit whose lines are empty. Its probe gains `foeInfo: string[]` (the lines shown, [] when none).
  - A routine plays as successive attacks, each swung and heard as an attack is.
  - An `AbilityEvent` reuses the spell-effect path: its hexes flash, then each outcome lands, timed by `impactMs` and `holdMs`, which cover `'ability'`. `battleEffects.ts` gains a look for each area ability; `sounds.ts` gives `'ability'` the cast's cues.
- **Architecture rule (CLAUDE.md):** `BattleScene` is a view over the engine and must not decide outcomes. Logic that can be Phaser-free goes in a sibling helper with domain tests (`src/scenes/*.ts` other than `*Scene.ts` must have no runtime Phaser import). A control or state a browser test needs goes in the scene's `probe()` and its type in `src/testHook.ts`; game code never reads the probe.

## 3. Dependencies and prerequisites

**Steps 02, 03, 04 and 05 must be done** (05 depends on the others). This step consumes, unchanged:

**From step 02 (C1):**

```ts
// src/grid/hex.ts
export type AreaShape = 'burst' | 'cone' | 'line'
export function areaOf(shape: AreaShape, origin: Hex, aim: Hex, range: number, radius = 0): Hex[]
```

- Burst is exactly the old `areaHexes(aim, radius)`; `areaHexes` is gone from `battleEngine.ts`, and step 02 already moved `BattleScene.markCast` and `BattleScene.showCast` onto `areaOf` (a shaped spell's area from the caster's position). Keep them so.

**From step 03 (C2, C3):**
- `CombatantStats.wards?: Partial<Record<Element, number>>`, `ELEMENTS = ['fire', 'frost', 'lightning', 'acid', 'poison', 'blight']`.
- `CastOutcome.warded: number`, `StatusTickEvent.warded: number`, `CastEvent.drained: number`. The log lines (`formatEvent`) already say `(warded N)` and "and drains N".
- `SPELL_LOOKS` already has entries for the five monster spells; `STATUSES` has Cursed (`K`) and Webbed (`W`), which the nameplate's status marks show through `STATUSES[id].mark` as any status.

**From step 04 (C4):**

```ts
// src/combat/abilities.ts
export interface Strike { name: string; verb: string; damage: DamageRoll; status?: StatusLaid }
export interface AreaAttack { shape: AreaShape; range: number; radius?: number; damage?: DamageRoll; element?: Element; status?: StatusLaid; halfOnMiss: boolean }
export interface Ability { name: string; verb: string; description: string; apCost: number; recharge: number; strikes?: readonly Strike[]; area?: AreaAttack }
export const ABILITY_IDS = ['troll_claws', 'spider_bite', 'spider_web', 'fire_spit'] as const
export type AbilityId = (typeof ABILITY_IDS)[number]
export const ABILITIES: Record<AbilityId, Ability>
// CombatantStats: abilities?: readonly AbilityId[]; abilityDamageBonus?: number
// UnitRecord and UnitSnapshot: recharging: Partial<Record<AbilityId, number>>  (absent = ready)
// AttackEvent, on a routine's strikes only: ability?: AbilityId; strike?: string; status?: ActiveStatus
```

- A routine's strikes are ordinary `AttackEvent`s, one per strike made; a strike not made emits nothing. The first strike's `apCost` is the ability's, the rest 0.

| Id | Name | Verb | AP | Recharge | Content |
| --- | --- | --- | --- | --- | --- |
| `troll_claws` | Claws | claws | 8 | 0 | strikes: Claw, Claw |
| `spider_bite` | Bite | bites | 4 | 1 | strikes: Bite, Venom Bite (lays Poisoned) |
| `spider_web` | Web | spins a web | 4 | 3 | area: burst, range 4, radius 1, no damage, lays Webbed |
| `fire_spit` | Fire Spit | spits fire | 4 | 2 | area: cone, range 2, 3d6 fire, lays Seared, half on a miss |

**From step 05 (C5):**

```ts
export interface AbilityEvent extends EventBase {
  type: 'ability'
  unit: UnitId
  ability: AbilityId
  at: Hex
  shape: AreaShape
  /** Every hex of the area on the board, in areaOf's order. */
  hexes: Hex[]
  /** Hexes between the unit and `at`. */
  distance: number
  apCost: number
  apAfter: number
  facing: number
  skill: number
  outcomes: CastOutcome[]   // CastOutcome gains half: boolean
}
```

- `formatEvent` already renders it ("Salamander spits fire: HITS Aldric for 9 dmg; MISSES Bryn, 4 dmg (half); …").

**Existing code (inspected at `51cecb5`):**
- `src/scenes/BattleScene.ts`: `showEvent` dispatch (`showAttack`, `showCast`, the status marks refresh on `'cast'`), `showCast` / `spellImpact` / `flashArea`, `refreshHover` / `setHovered` / `hoverLabels`, `probe()`.
- `src/scenes/battleEffects.ts`: `SPELL_LOOKS: Record<SpellId, SpellLook>`, `impactMs`, `holdMs`, `castOutline`, `RELEASE_MS`, `flightMs`.
- `src/scenes/eventSchedule.ts`: `scheduleEvents` (holds each event by `timing.holdMs`).
- `src/scenes/sounds.ts`: `eventSounds` (`'cast'`: `sfx_spell_cast`, then the outcome's sound at `impactMs`).
- `src/testHook.ts`: `BattleProbe`.
- `e2e/battle.test.ts`, `e2e/debug.test.ts` (the `fight` command), `e2e/driver.ts`.

**Environment:** no simulator run is needed in this step (the scene changes no outcome). A battle with the new kinds needs step 08; until it lands, tests build their own units with abilities and wards (an engine set up in the test), and the browser test may use `fight troll_lair 4` (the Troll's routine, from step 04).

## 4. Scope and implementation guidance

### 4.1 Routines

- A routine's strikes already arrive as `AttackEvent`s and go through `showAttack`. Check that two or more in one step play one after the other (each held by `holdMs`, as two attacks are) and that a strike's `status` refreshes the status marks: add `'attack'` events carrying `status` to the refresh in `showEvent`, or refresh on every attack, whichever is simpler.
- Nothing else is needed for routines unless the check shows otherwise.

### 4.2 Area abilities (`AbilityEvent`)

- **`battleEffects.ts`:**
  - Add `ABILITY_LOOKS: Partial<Record<AbilityId, SpellLook>>` (or a `Record` over the area abilities), with entries for `spider_web` (pale grey, `missile: 'orb'`, `impact: 'cloud'` or `'ring'`) and `fire_spit` (the `FIRE` look, `impact: 'burst'`), and a fallback for an area ability without one.
  - `impactMs` covers `'ability'`: a burst aimed away from the unit lands as a cast does, `RELEASE_MS + flightMs(event.distance)`; a cone or line, which has no missile, lands after `RELEASE_MS` plus a short sweep of your choosing (a named constant). `holdMs` follows from `impactMs` as it does for every event.
  - An outline helper for an area outcome: a hit hurts (critical yellow), a half-damage miss hurts in the ordinary hurt colour, a miss without damage none, an image white. Add a test for it beside `castOutline`'s.
- **`sounds.ts`:** `eventSounds` gives `'ability'` the cast's cues: `sfx_spell_cast` at 0, then the outcome at `impactMs` (`sfx_hit_impact`, `sfx_crit_impact`, or `sfx_miss` when nothing struck and nothing was dealt half). No new audio files.
- **`eventSchedule.ts`:** nothing new should be needed, as it holds every event by `timing.holdMs`; add a test that an `AbilityEvent` followed by a `unit_down` holds the fall until the ability has landed.
- **`BattleScene`:** a `showAbility(event)` beside `showCast`, sharing its pieces (`flashArea`, `burst`, `cloud`, `react`, `dodge`, `refreshHpDisplay`):
  - turn the unit to `event.facing` and pulse its outline in the look's colour;
  - a burst aimed away from the unit flies the look's missile to `event.at` (as `showCast` does); a cone or line flashes `event.hexes` from the unit outwards (one flash of all hexes is enough);
  - on landing, flash `event.hexes`, show the look's impact, and react each outcome as a hostile cast's is: a hit or a half-damage miss hurts, a miss without damage dodges, an image shows white; refresh hit points from `outcome.hpAfter`;
  - refresh the status marks after an `'ability'` event, as after a `'cast'`.
- Do not draw an area ability's hover preview: no hero has an ability, so the player never aims one.

### 4.3 The foe info panel

- **`src/scenes/foeInfo.ts`** (new, Phaser-free, with `foeInfo.test.ts` in the domain project): `foeInfoLines(unit)` per C8:
  - one line per id in `unit.abilities ?? []`, in order: `${ABILITIES[id].name}: ready` when `unit.recharging[id]` is absent or 0, else `${name}: recharging, ${n} round` / `rounds` (singular for 1);
  - then, if any ward is above 0, one line `Wards: ` with each as `${element} ${points}` in `ELEMENTS` order, joined by `, ` (for example `Wards: fire 99`);
  - `[]` for a unit with neither.
  - Tests: a unit with none; a recharging and a ready ability; one round singular; wards in `ELEMENTS` order; a ward of 0 left out.
- **`BattleScene`:** while the hovered hex holds a standing enemy unit whose `foeInfoLines` are not empty, show them in a small panel beside it (monospace text on a dark translucent background, as `addChanceLabel` draws, in `hoverLabels` or a layer of its own over the nameplates), kept on screen; clear it when the hover leaves, on pause, and after every event played (the counters change as turns begin). It must not hide the hit-chance label or take clicks.
- **Probe:** `BattleProbe` (`src/testHook.ts`) gains `foeInfo: string[]`, the lines the panel shows now, `[]` when none. Update the probe's type and `probe()`.
- Mention the panel and `foeInfo.ts` in CLAUDE.md (the scene-helper list and the `BattleScene` paragraph): CLAUDE.md requires a new helper module to be listed in the same commit.

### 4.4 Tests

- **Domain (`src/scenes/*.test.ts`):** `foeInfo.test.ts`; `battleEffects.test.ts` for `impactMs`/`holdMs` on an `AbilityEvent` (burst at a distance, cone) and the area-outcome outline; `sounds.test.ts` for `'ability'` (a hit, a half-damage miss, a clean miss); `eventSchedule.test.ts` for the hold. Build events by hand, as the existing tests do.
- **Scene smoke test (`BattleScene.test.ts`):** if the file plays events through the scene, add an `AbilityEvent` and a routine's two `AttackEvent`s to make sure nothing throws.
- **Browser (`e2e/`, read `e2e/CLAUDE.md` first):** one test in `battle.test.ts` or `debug.test.ts`: open the debug console, `fight troll_lair 4` (or, once step 08 has landed, `fight salamander_pool 5`), hover the Troll's hex with `game.hover` at `battleHexOnScreen`, and wait on the probe until `foeInfo` equals `['Claws: ready']`; hover an empty hex and wait for `[]`. Wait on probes, never on time. The test fails on any console error, which covers the playback of the enemy's turn (a troll that reaches the party strikes with its routine) if the test ends its turn and waits for the player's next one.
- Run `make test`, then `make test-browser ARGS="-t <your test's name>"` and the existing battle tests (`make test-browser ARGS="-t battle"` or the file's names). If several browser tests time out only when run together under load, run them alone and record it, as stage 1 did.

### 4.5 Out of scope

- Any change to the engine, policies, `formatEvent`, stat blocks or encounters.
- New sprites or effect art (an area reuses the existing effect sprites and drawn shapes).
- An aiming preview for abilities, and the manual and its screenshots (step 09).

## 5. Verification

1. `make test` passes, with the new domain tests among them.
2. The browser test above and the existing battle tests pass under `make test-browser`.
3. Look at it once in the game (`make dev`, or the browser test's run): with the debug console, `fight troll_lair 4` (and `fight salamander_pool 5` / `fight spider_nest 4` if step 08 has landed); hover the Troll and see "Claws: ready"; end the turn and see a standing Troll's "Claws" play as two swings, the log reading "Troll claws …" twice. Record what was seen, or that it was not walked.

## 6. Completion criteria

- [ ] `foeInfo.ts` with `foeInfoLines` exactly as C8, and its tests.
- [ ] `impactMs`, `holdMs`, the area look and outline, and `eventSounds` cover `'ability'`, with tests.
- [ ] `BattleScene` plays an `AbilityEvent` (hexes flashed, outcomes landed, hit points and status marks refreshed) and a routine's strikes in turn.
- [ ] The foe info panel shows while an enemy with abilities or wards is hovered; `BattleProbe.foeInfo` reports it.
- [ ] A browser test of the panel; the battle browser tests pass.
- [ ] CLAUDE.md lists `foeInfo.ts` and the panel.
- [ ] `make test` passes; committed on the current branch, without pushing, the message ending with the repo's `Co-Authored-By` attribution line.
- [ ] The index's step 06 row set to `done` with the commit, and the execution record below filled in.

## Execution record
