# Step 02: Stage-1 spells and the Warded status

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R6, R8; §4.3 Evoker, Cryomancer, Arcanist, Healer, Paladin, Saint tables; §5.2) · [Feature record](../../features/skill-trees.md)

**Difficulty:** sonnet / opus. Engineer `model: "sonnet"`; leave the reviewer's model unset. The step adds data of an existing shape and one status field; the only judgement is whether moving Web and Curse changed what the simulator plays.

## 1. Objective

`SPELLS` holds the five new spells stage 1 needs (Frostbite, Meteor, Mass Haste, Lay on Hands, Ward), and Web and Curse become heroes' spells as well as the monsters' (same ids, same numbers). A new status, `warded`, adds a ward of 4 against every element through a new `StatusRule.wardAll`. No hero can learn the new spells yet: step 03 adds the nodes that teach them. Every spell needs no engine rule beyond the existing ones and `wardAll`.

## 2. Requirements and context

- **R6:** today's spells are folded into the paths under the same ids; Web and Curse move from the monsters' list (design §4.3, "What happens to today's perks and spells").
- **R8:** new mechanics work in the engine, and battles stay deterministic from their seed.
- **Design §5.2:** `SPELL_IDS` takes `web` and `curse`, which leave `MONSTER_SPELL_IDS` and keep their ids, so stat blocks still name them. `SchoolId` stays for colours; new spells get a school.
- **Design §6, "Monster behaviour":** Web and Curse joining `SPELL_IDS` moves them earlier in `ALL_SPELL_IDS`, so a stat block's `magic.spells` order, and the policy's iteration over it, can change for the spider and goblin casters.

### The spells (design §4.3)

| Id | Name | School | Kind | Numbers |
| --- | --- | --- | --- | --- |
| `frostbite` | Frostbite | offence | hostile, target `foe` | 1d6+1 frost to a foe within 5, with Chilled for 1 turn; 3 mana, 4 AP |
| `meteor` | Meteor | offence | hostile, target `area`, burst | 4d8 fire to everyone within 2 hexes (radius 2) of a point within 6, with Seared for 1 turn; 16 mana, 7 AP |
| `mass_haste` | Mass Haste | support | friendly, target `area`, range 0 | every ally within 2 hexes of the caster (radius 2), itself included, Hasted for 2 turns; 12 mana, 5 AP |
| `lay_on_hands` | Lay on Hands | healing | friendly, target `ally` | heals an ally within 1 (itself included) 2d6+2; 4 mana, 3 AP |
| `ward` | Ward | support | friendly, target `ally` | an ally within 4 is Warded (+4 ward against every element) for 3 turns; 4 mana, 3 AP |
| `web` | Web | offence (as today) | hostile, `area`, burst | as the monsters' today: −4 AP (Webbed) for 2 turns to everyone within 1 hex of a point within 4; 5 mana, 4 AP |
| `curse` | Curse | offence (as today) | hostile, `foe` | as the monsters' today: −15 to hit and −5 AC (Cursed) for 3 turns to a foe within 5; 5 mana, 4 AP |

Meteor's damage has `element: 'fire'`, Frostbite's `'frost'`, as Fireball's and Frost Blast's do. Mass Haste is shaped as Heal All is (range 0, area, radius 2, friendly), laying `hasted` instead of healing. Lay on Hands is shaped as Heal is, at range 1. Web's and Curse's entries do not change at all; only the id lists move.

### Decisions from the index (unchanged)

- **2. The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.

### Contracts (copied unchanged from the index)

**C6. Spells and statuses (step 02; extended by 09, 11, 20)**

```ts
// src/combat/spells.ts
// SPELL_IDS gains (step 02): 'frostbite', 'meteor', 'mass_haste', 'lay_on_hands', 'ward', 'web', 'curse'
//   (web and curse leave MONSTER_SPELL_IDS, same ids and numbers); step 20 adds 'ice_lance', 'glacial_prison',
//   'purify', 'revive', 'renew', 'holy_light'
// STATUS_IDS gains 'warded' (02); 'marked', 'slowed', 'pinned' (09; pinned's rule in 11); 'taunted' (10, its rule in 11);
//   'rooted' (11); 'renewing' (19); 'frozen' (20)
// StatusRule gains wardAll?: number (02); immobile?: true (11); regen?: number (19); hostile?: true,
//   helpless?: true, wakesOnDamage?: true replacing sleep (20)
// ActiveStatus gains source?: UnitId (11)
```

| Status | Mark | Rule | Step |
| --- | --- | --- | --- |
| warded | G | wardAll 4 | 02 |
| marked | Y | armour class −10 | 09 |
| slowed | L | action points −3 | 09 |
| taunted | T | −`TAUNT_PENALTY` (25) to hit at any unit but its `source` | 10 (the id, no effect), 11 (the rule) |
| pinned | N | immobile | 09 (the id, no effect), 11 (the rule) |
| rooted | R | armour class +10, resistance +2 | 11 |
| frozen | I | helpless, does not wake on damage | 20 |
| renewing | U | regen 3 | 19 |

This step does only the step-02 parts of C6: the seven `SPELL_IDS` additions, `warded`, and `StatusRule.wardAll`.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **Commands:**
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run build` at each stage's end.
- **The simulator.** A 500-campaign run takes about five minutes and writes some 70 MB. **Run one at a time, never two at once**, each with its own `--out` under `logs/` (gitignored). Measurement and tuning belong to steps 01, 08, 16, 23, 24 and 25 only.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, `--parties 1`, each `CampaignRecord` and a SHA-256 of every event). Decision 2 says which steps keep it green and which re-record it.
- **Determinism.** A battle replays from its seed. New rolls draw from the RNG in the order design §5.4 fixes; a passive that rolls nothing draws nothing. A unit whose stats carry none of the new fields behaves exactly as today.
- **Domain first.** Every rule lives in the Phaser-free modules (`src/character/`, `src/combat/`, `src/engine/`, `src/game/`) with tests; scenes decide nothing; Phaser-free helpers in `src/scenes/` stay free of runtime Phaser imports.
- **A node is data.** A new node of an existing shape is one entry in `PERKS`, plus one in `SPELLS` or `ABILITIES` if it teaches something; the tree view places it with no new code.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` (no enums, namespaces or parameter properties), `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit per step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 02: stage-1 spells and the Warded status". No attribution lines.
- **Docs.** `CLAUDE.md` stays current in every step: fix the lines the change makes wrong and search it for every name renamed or removed.

## 3. Dependencies and prerequisites

- **Step 01 (done first)** re-measured the baseline and captured `src/game/fixtures/save-v22.json`. Nothing of it is consumed here; do not touch the fixture.
- **Existing code at `50fb4cf`, for reference:**
  - `src/combat/spells.ts`: `SPELL_IDS` (17 hero spells, `magic_arrow` … `bane`), `HeroSpellId`, `MONSTER_SPELL_IDS = ['lightning_bolt', 'drain_life', 'curse', 'web', 'dark_shield']`, `ALL_SPELL_IDS = [...SPELL_IDS, ...MONSTER_SPELL_IDS]` ("the order a stat block's `magic.spells` keeps"), `SpellTarget`, `STATUS_IDS`, `StatusRule` (armorClass, resistance, stopsRegeneration, toHit, actionPoints, tick, tickName, element, sleep, images), `STATUSES` (13 statuses; `webbed` mark W, `cursed` mark K), `SPELLS` (`curse` and `web` entries as in the table above).
  - `src/engine/battleEngine.ts`: `effectiveStats(unit)` adds each status's armour class, resistance and to-hit to the stats every roll reads; `warded(rolled, element, stats)` reads `stats.wards`.
  - `src/character/perks.ts`: today builds a spell perk per hero spell (`spellPerk`, `SPELL_PERK_IDS`, `spellPerkOf`). Step 03 replaces all of it. If a test or a type here insists that every `HeroSpellId` has a perk (for example `spellPerkOf` over `SPELL_IDS`, or `Record<HeroSpellId, …>` tables in `worldCasting.ts`, `perkTree.ts` or the scenes), keep it compiling and passing with the smallest change (restrict it to the spells that have a perk, or give the new spells no entry where the type allows it). Do not add perks for the new spells: that is step 03's.
  - Monster stat blocks name `web` (Giant Spider, Brood Spider via abilities or `magic`) and `curse` (goblin and source casters) in their `magic.spells`; grep `'web'` and `'curse'` under `src/combat/` and `src/game/` to find them.

## 4. Scope and implementation guidance

### 4.1 `src/combat/spells.ts`

- `SPELL_IDS`: append `'frostbite', 'meteor', 'mass_haste', 'lay_on_hands', 'ward', 'web', 'curse'` after `'bane'`, in that order. `MONSTER_SPELL_IDS` becomes `['lightning_bolt', 'drain_life', 'dark_shield']`. Update the doc comments (`HeroSpellId` is no longer "only these" for the spell tree; `MONSTER_SPELL_IDS` "no perk teaches them" stays true for the three left).
- `SPELLS`: add the five entries with the numbers and schools of §2's table, descriptions in the existing style ("1d6+1 frost to a foe within 5 hexes, chilled for 1 turn"). Move the `curse` and `web` entries, unchanged, among the hero spells if the file groups them.
- `STATUS_IDS` gains `'warded'`; `STATUSES.warded = { name: 'Warded', adjective: 'warded', mark: 'G', colour: <a pale blue-violet distinct from the others>, wardAll: 4 }`.
- `StatusRule` gains `/** Added to its ward against every element. */ wardAll?: number`.

### 4.2 `src/engine/battleEngine.ts`

- `effectiveStats` adds each status's `wardAll` to `wards[e]` for every element of `ELEMENTS`, leaving `wards` absent (or as it was) when no status has `wardAll`, so a unit with none of the new fields keeps exactly today's stats object shape. `warded` then cuts spell, tick and on-hit damage as it does for a monster's ward.
- Nothing else in the engine changes: Frostbite, Meteor, Mass Haste, Lay on Hands and Ward are cast through the existing hostile, area and friendly paths.

### 4.3 Monsters and the guard

- Moving Web and Curse reorders `ALL_SPELL_IDS`, so a stat block whose `magic.spells` is sorted into `ALL_SPELL_IDS` order may list them in a new order. Check every stat block naming `web` or `curse`, and state in the execution record whether its order changed.
- Run the refactor guard. If it is green, record "guard identical". If it moved, confirm the move comes from that reorder alone (for example by checking the event diff of the first differing battle: the policy iterating a caster's spells in a new order), then re-record the fixture (`GUARD_RECORDS` and `GUARD_EVENTS_SHA256`) and say why in the commit message, per decision 2. If anything else moved, find and fix it.

### 4.4 Docs

- `CLAUDE.md`: the `spells.ts` line says `SPELL_IDS` are the heroes' spells and `MONSTER_SPELL_IDS` "the spells only a stat block's `magic` can name (Lightning Bolt, Drain Life, Curse, Web, Dark Shield)"; fix it (Curse and Web are heroes' spells now; the monsters' three), list `warded` among the `STATUSES` in the rules of casting, and add `wardAll`'s effect where `effectiveStats` is described.

### 4.5 Exclusions

- No perk, plan, tree or creation change (step 03). No `spellApCost`, `spellRange` or spell modifiers (step 04). No policy change: Frostbite and Meteor will be cast by the existing hostile logic, Lay on Hands by `healCast`, once heroes know them; nothing casts Ward or Mass Haste until step 21.
- No scene change. `foeInfo.ts`, `spellMenu.ts` and the battle effects read spells from their data; if a scene helper keeps a table keyed by every `SpellId` (for example `SPELL_LOOKS` in `battleEffects.ts`), give the five new spells entries that reuse existing looks (Frostbite as Frost Blast's bolt, Meteor as Fireball's, Mass Haste as Haste's, Lay on Hands as Heal's, Ward as Protect's) so the type holds.

## 5. Verification

### Tests (in `npm test`)

- `src/combat/spells.test.ts`:
  - `SPELL_IDS` holds the 24 heroes' spells, Web and Curse among them, and `MONSTER_SPELL_IDS` the three left; `ALL_SPELL_IDS` holds each spell once.
  - Each new spell's numbers match §2's table (cost, AP, range, target, radius, damage, element, heal, status and turns, school).
  - `web` and `curse` are unchanged (snapshot the two entries against today's values).
  - `STATUSES.warded` has mark G and `wardAll` 4.
- `src/engine/battleEngine.test.ts` (scripted RNG):
  - A unit Warded takes 4 less from a fire spell's hit, from a poison tick and from an elemental on-hit entry; a unit with a fire ward of 99 Warded keeps 103 (wards add).
  - A hero casting Lay on Hands on an adjacent ally heals 2d6+2 up to the maximum; at range 2 the cast is not legal.
  - Mass Haste lays Hasted on every ally within 2 of the caster, the caster included, and on no foe.
  - Meteor touches both sides within radius 2 of its centre and lays Seared on a hit.
  - Frostbite deals 1d6+1 frost and lays Chilled on a hit.
  - Ward lays Warded for 3 turns on an ally within 4.
- Any existing test that enumerates spell ids (`spells.test.ts`, `perks.test.ts`, `worldCasting.test.ts`, `foeInfo.test.ts`, `spellMenu.test.ts`, `battleEffects` tests) is updated to the new lists, keeping its intent.
- The refactor guard: green, or re-recorded per §4.3 with the reason.

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run src/combat/spells.test.ts src/engine/battleEngine.test.ts
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run scripts/simulate.test.ts -t "refactor guard"
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test
```

**Scene change:** none. `npm run test:browser` need not run unless a scene helper's table had to change (§4.5); if one did, run it.

### Acceptance checks

- The five spells and the moved two exist with design §4.3's numbers; no hero can learn them yet.
- A Warded unit's every elemental damage is cut by 4.
- Monster stat blocks still name `web` and `curse` and cast them as before; the execution record says whether their spell order changed.
- The guard is identical, or re-recorded with the reason in the commit message.

## 6. Completion criteria

- [ ] `SPELL_IDS`, `MONSTER_SPELL_IDS`, `SPELLS`, `STATUS_IDS`, `STATUSES` and `StatusRule.wardAll` as C6 (step-02 part) says.
- [ ] `effectiveStats` reads `wardAll`; engine tests for each new spell and for Warded.
- [ ] Guard green, or re-recorded with the reason; the execution record says which.
- [ ] `npm test` passes; `CLAUDE.md` updated.
- [ ] One commit, "Skill trees step 02: stage-1 spells and the Warded status".
- [ ] Index: step 02's status set to `done (<commit>)`.

## 7. Execution record

**Engineer: step 02 (2026-11-13).**

- Added `frostbite`, `meteor`, `mass_haste`, `lay_on_hands`, `ward` to `SPELLS`; `SPELL_IDS` now has 24 spells ending `..., 'ward', 'web', 'curse'`; `MONSTER_SPELL_IDS` is `lightning_bolt, drain_life, dark_shield`. `web` and `curse` entries unchanged (a test pins them). `STATUS_IDS`/`STATUSES` gain `warded` (mark G, `wardAll: 4`); `StatusRule.wardAll` added. `effectiveStats` adds `wardAll` to every element's ward and leaves `wards` untouched when no status has it.
- `SPELL_LOOKS` (`src/scenes/battleEffects.ts`) got entries for the five new spells (reusing existing looks) so the `Record<SpellId, ...>` type holds.
- Existing tests that insisted every `HeroSpellId` has a perk (`perks.test.ts`, `perkTree.test.ts`) now compare against `SPELL_IDS` less the seven untaught spells (a local `TAUGHT_SPELLS`); step 03 rewrites them. `spells.test.ts` lists updated. No production perk code changed.
- Stat-block order: no stat block names `web` or `curse` in `magic.spells` (the Giant Spider uses the `spider_web` ability; the shaman and Source casters list other spells), so no order changed. The policy's `web`/`curse` branches (`policies.ts`) are unaffected.
- Refactor guard: green, identical, no re-record (a hero cannot learn any new spell, and no monster block lists the moved ids).
- Verification: `npm test` 84 files, 1522 tests pass (tsc clean); `npx vitest run scripts/simulate.test.ts -t "refactor guard"` passes. New tests: spells table (24/3/27 ids, five numbers, Web/Curse pinned, Warded), engine tests (Ward, wards add, poison tick, on-hit entry, Lay on Hands range, Mass Haste, Meteor, Frostbite). `npm run test:browser`: 10 files, 115 tests pass.
