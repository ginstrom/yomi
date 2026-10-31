# Step 03: Hero figures wear their gear

[Index](index.md) · [Design](../../designs/party-list-and-gear-looks.md) §4.2, §5.2 and §7

## Objective

Lay worn armour, head and cloak overlays under and over a hero's bare body, in a fixed order, everywhere a hero's `UnitFigure` is drawn: the inventory doll, battle units and the world-map figure. Each place updates where it already updates for held gear. Add a test that every armour, head and cloak item has an overlay in the atlas.

This covers B-R2 to B-R6 (code), and AC5 to AC7.

## Requirements and context

- **B-R2.** The overlays: the Steel Breastplate (`armor` icon) → `gear_breastplate`; the Sage's Circlet (`circlet`) → `gear_circlet`; the Cloak of Shadows (`cloak`) → `gear_cloak` over the body, and `gear_cloak_back` under it.
- **B-R3.** The layers, bottom first, are: cloak back, body, armour, cloak front, head, main hand, off hand. The order is the same for both facings.
- **B-R4.**
  - An item whose icon has no overlay is worn unseen.
  - There is no per-slot fallback.
  - Neck, ring, glove, belt and boot items are never looked up.
  - A test fails if any `BASE_ITEMS` or `MAGIC_ITEMS` item with slot `armor`, `head` or `cloak` lacks a `WORN_SPRITES` entry, or if a mapped sprite is missing from the atlas.
- **B-R5.** The doll, battle figures and the map figure show the overlays. Each updates when gear changes, at the points where it does for held gear:
  - **Doll:** at once, as the panel redraws after each change;
  - **Battle:** when the character panel closes (`BattleScene.refreshGear`);
  - **Map:** on `RESUME`, after a debug command, and on scene start (`WorldScene.refreshPartyGear`).
- **B-R6.** Swing, tint, alpha, the pulsed outline, facing, breathing and walking work across every layer. Only the weapon swings.
- **B-R7.** Face portraits are unchanged.
- **AC5.** A new ready-made hero wears the Steel Breastplate, so `gear_breastplate` shows on the doll, in battle and on the map. Taking it off in the world-map panel removes it from the doll at once, and from the map figure when the panel closes.
- **AC6.** With cloak, breastplate, circlet, sword and shield, the layers, bottom first, are `gear_cloak_back`, `warrior`, `gear_breastplate`, `gear_cloak`, `gear_circlet`, `gear_sword`, `gear_shield`. A strike still swings the sword about the fist.
- **AC7.** The unit test fails if an armour, head or cloak item lacks an overlay, or if an overlay is missing from the atlas.
- **Q1, answered.** There is no default helm. An empty head slot adds nothing.

## Dependencies and prerequisites

- **Step 02 (required).** The atlas (`public/assets/sprites/atlas.json` and `atlas.anims.json`) has `gear_breastplate`, `gear_circlet`, `gear_cloak` and `gear_cloak_back`, each with `idle_0`, `idle_1`, `<id>/idle` (like `warrior`) and `<id>/walk` (rest). `warrior` is bare and keeps its id, its `grip [25, 19]` and `chest [16, 15]` points, its frames and its animations. Confirm that the atlas has them before starting.
- **Step 01 (done before this one).** `WorldScene.ts`, `testHook.ts` and root CLAUDE.md were edited by step 01: the party list, `WorldProbe.parties`, `selectedParty` and `infoRect`, and `centreOnSelected` in place of `recentre`. Add to them; don't undo them.

**Current code (inspected at `3fe4c11`):**
- **`src/scenes/unitLook.ts`** has:
  - `GEAR_SPRITES` (held items by icon);
  - `SWUNG_GEAR`;
  - `GRIP_POINT`, `CHEST_POINT` and `pointFromAnchor`;
  - `gearLayers(equipment)`, which returns the main hand's sprite and then the off hand's, dropping the off hand beside a `twoHanded` weapon.
- **`src/scenes/UnitFigure.ts`** (a `Phaser.GameObjects.Container`):
  - Fields: `base` (named `kind`) and `gear: Sprite[]`.
  - `setGear(sprites)` destroys the old gear, adds the new sprites on top, copies `flipX` and the base's alpha, and replays `playing`.
  - `layers()` returns `[base, ...gear]`. `play`, `stop`, `faceLeft`, `setFigureAlpha` and `setFigureTint` act on `layers()`.
  - `swing` finds `gear.find(s => SWUNG_GEAR.has(s.name))` and turns it about the base's `grip`.
  - `point()` reads the base frame. `pulseOutline` is a Glow filter on the container.
  - `layer(sprite)` makes a sprite named `sprite` at `idle_0`.
- **The three callers** of `setGear(gearLayers(...))`:
  - `BattleScene.refreshGear()` (line 686, over `this.heroes`, a `Map<UnitId, Character>`);
  - `InventoryScene.buildPaperdoll()` (line 919, `new UnitFigure(this, 'warrior', DOLL_SCALE)`);
  - `WorldScene.refreshPartyGear()` (line 563, `party[0]`).
  Each imports `gearLayers` from `./unitLook.ts`.
- **`src/scenes/unitLook.test.ts`** reads `atlas.json` and `atlas.anims.json` with `readFileSync`. It tests `gearLayers`, held-item coverage over `[...WEAPONS, ...MAGIC_ITEMS, OAK_SHIELD]`, `GEAR_SPRITES` in the atlas with idle, and `grip` and `chest` on every warrior frame.
- **Items** (`src/inventory/inventory.ts`):
  - worn: `STEEL_ARMOR` (`armor`/`armor`, in `BASE_ITEMS`), `SAGE_CIRCLET` (`head`/`circlet`) and `SHADOW_CLOAK` (`cloak`/`cloak`), both in `MAGIC_ITEMS`;
  - `AMULET_FOCUS` (`neck`), and `RING_PROTECTION` and `RING_FORTUNE` (`ring1`);
  - graded and modified items (`itemById('steel_armor@2')`) keep their base's icon.
- **Starting gear.** Every hero starts in `STEEL_ARMOR`. The ready-made soldier holds `IRON_SWORD` and `OAK_SHIELD`.
- **Debug console** (dev builds, `~`): `give <item>` puts an item in the baggage (`give shadow_cloak`, `give sage_circlet`). `e2e/debug.test.ts` shows how a test types into it.

## Scope and implementation guidance

**`src/scenes/unitLook.ts`.** Add exactly the index's contract: `WORN_SPRITES`, `WORN_BACK_SPRITES`, `WORN_SLOTS`, `HeroLook` and `heroLook`.
- `heroLook` returns:
  - `under`: the cloak's `WORN_BACK_SPRITES` entry, if any;
  - `over`: the `WORN_SPRITES` entries of the items in `WORN_SLOTS` order (armour, cloak, head), then `gearLayers(equipment)`.
- `gearLayers`, `GEAR_SPRITES` and `SWUNG_GEAR` are unchanged, and `gearLayers` stays exported.
- Update the module's comments: it now covers what a hero wears as well as what it holds.

**`src/scenes/UnitFigure.ts`:**
- `setGear(sprites)` becomes `setLook(look: HeroLook): this`:
  - It destroys the old `under` and `over` layers.
  - It inserts `under` below the base, in order (`addAt(..., index)` from 0).
  - It adds `over` on top, in order.
  - It copies flip and the base's alpha to every new layer, and replays `playing`.
- Fields: `under: Sprite[]` and `over: Sprite[]` (`gear` renamed).
- `layers()` returns `[...under, base, ...over]`.
- `swing` searches `over`.
- Add `lookNames(): string[]`. It returns the names of the container's sprite children, bottom first, read from the container's own display list, so that the probe proves the drawing order. A foe's figure gives `[kind]`.
- Update the class comment.

**Callers:** all three call `setLook(heroLook(equipment))`, and their imports change to match. `WorldScene` keeps reading `party[0]`.

**Probes** (`src/testHook.ts` and the scenes' `probe()`):
- `InventoryProbe.doll: string[]`: the open member's doll. Keep a reference to the doll `buildPaperdoll` makes; use `[]` while the inventory tab is not built.
- `WorldProbe.partyLook: string[]`;
- `BattleProbe.looks: Record<UnitId, string[]>`: heroes only.

Each is `lookNames()`, with a doc comment.

**CLAUDE.md (same commit):**
- **Assets paragraph.** Replace "Every hero is the `warrior` body, bare-handed, with a sprite laid over it for what is in each hand (`GEAR_SPRITES` …)" with: every hero is the `warrior` body, bare, with sprites laid under and over it for what it wears (`WORN_SPRITES`, `WORN_BACK_SPRITES`) and holds (`GEAR_SPRITES`), drawn in `heroLook`'s order. A new weapon or shield icon, and now a new armour, head or cloak icon, needs an entry and a sprite, or `unitLook.test.ts` fails. Keep the sentence on `BattleScene` re-dressing heroes when the panel closes.
- **Helper list.** `unitLook.ts`: "…and which sprites are laid under and over a hero's body for what it wears and holds". `UnitFigure.ts`: "a unit's body with what it wears and holds drawn under and over it, animated as one".
- **World-map assets sentence.** "shows the party as its first member's battle figure, gear included" still holds; check the wording.
- **Grep** for `setGear` and for `gearLayers` mentions that now mean `heroLook`, and fix them.

**Art touch-ups.** If the in-game look shows a misfit (tunic showing through the plate, the cape unreadable at map scale), fix the source in `art/gear/` and run `npm run sprites` on the host (sprite-tool is not in podman). Commit the build output too, and note it in the execution record.

**Exclusions:**
- No foe looks, no neck, ring, glove, belt or boot overlays, and no default helm.
- No portrait changes.
- No manual text (step 04).

## Verification

- **Domain, `src/scenes/unitLook.test.ts`** (write first and see it fail):
  - `heroLook({})` is `{ under: [], over: [] }`.
  - `heroLook({ armor: STEEL_ARMOR })` has `over: ['gear_breastplate']`.
  - The full kit (`SHADOW_CLOAK`, `STEEL_ARMOR`, `SAGE_CIRCLET`, `IRON_SWORD`, `OAK_SHIELD`) gives `under: ['gear_cloak_back']` and `over: ['gear_breastplate', 'gear_cloak', 'gear_circlet', 'gear_sword', 'gear_shield']`.
  - `AMULET_FOCUS` and both rings add nothing.
  - `STEEL_GREATSWORD` with `OAK_SHIELD` still drops the shield.
  - `itemById('steel_armor@2')` gets `gear_breastplate`.
  - **Coverage (AC7).** Every item in `BASE_ITEMS` and `MAGIC_ITEMS` with slot `armor`, `head` or `cloak` has a `WORN_SPRITES` entry. Assert that the filtered list is non-empty and holds all three slots.
  - **Atlas.** Every sprite in `WORN_SPRITES` and `WORN_BACK_SPRITES` has `<sprite>/idle_0` in `atlas.json`, and `<sprite>/idle` and `<sprite>/walk` in `atlas.anims.json`.
  - The existing `grip` and `chest` tests still pass.
- `npx vitest run --project scenes`: the smoke tests pass.
- **Browser:**
  - **`e2e/character.test.ts`, doll (AC5).** On the world map, open the first member's panel and go to the Inventory tab.
    - `doll` contains `gear_breastplate`.
    - Click the armour slot to stow it; `doll` no longer contains it.
    - Close the panel; `World.partyLook` no longer contains it.
    - Re-open the panel, equip the breastplate from the backpack, and close; it is back in both.
  - **`e2e/character.test.ts`, order (AC6).** Through the debug console, `give shadow_cloak` and `give sage_circlet`. Take each from the baggage and equip it. `doll` then equals `['gear_cloak_back', 'warrior', 'gear_breastplate', 'gear_cloak', 'gear_circlet', 'gear_sword', 'gear_shield']`, given the soldier's sword and shield. If equipping magic items through the panel proves awkward in the test, record the deviation; the order is also held by the unit test.
  - **`e2e/battle.test.ts`.** In a battle, `looks[heroId(0)]` contains `gear_breastplate` and the hero's weapon sprite, and a foe has no entry.
- `npm test` and `npm run test:browser` pass.
- **First manual pass** (`npm run dev`; record what you saw). Equip the cloak and the circlet via `~` then `give`, and look at:
  - the doll facing right;
  - a battle hero facing left (the cape stays behind);
  - a walk on the map (the legs pass in front of the cape, and nothing jitters);
  - a sword swing (the blade stays in front);
  - a hit (every layer flashes);
  - a fallen hero (every layer fades);
  - the bare hero with nothing worn.

## Completion criteria

- [x] The contracts exist exactly as in the index.
- [x] The domain tests were seen failing first.
- [x] AC5 to AC7 are covered by the tests above.
- [x] No `setGear` is left in `src/` or CLAUDE.md, and CLAUDE.md is updated in the same commit.
- [x] The first manual pass is recorded, and any art touch-ups are rebuilt and included.
- [x] This step's status and commit are recorded in the index.

## Execution record

**Commits.** `103885e` (code, probes, tests, CLAUDE.md; step 02's hash filled in the index), then the art touch-up and this record in the step's final commit.

**What was built.** `unitLook.ts` gained the index's contract exactly (`WORN_SPRITES`, `WORN_BACK_SPRITES`, `WORN_SLOTS`, `HeroLook`, `heroLook`); `gearLayers`, `GEAR_SPRITES` and `SWUNG_GEAR` are unchanged. `UnitFigure.setGear` is now `setLook(look)`, with `under` inserted below the body by `addAt` and `over` added on top, and `lookNames()` reads the container's own display list. The three callers call `setLook(heroLook(...))`. Probes: `InventoryProbe.doll` (kept as `InventoryScene.doll`, reset on each `create`), `WorldProbe.partyLook`, `BattleProbe.looks` (heroes only). Root CLAUDE.md: the assets paragraph, the `unitLook.ts` and `UnitFigure.ts` helper lines and the world-map sentence. No `setGear` remains in `src/`, `e2e/` or CLAUDE.md.

**Test-first.** The eight new `heroLook` cases in `src/scenes/unitLook.test.ts` were run before `heroLook` existed and failed (8 failed, 11 passed: `heroLook`/`WORN_*` not exported); green after. Browser tests added: `e2e/character.test.ts` "dresses the doll and the map's figure… (AC5)" and "lays a cloak, a breastplate, a circlet, a sword and a shield in their order (AC6)" (equipping the magic items through the panel worked, so no deviation: `give`, a click on the baggage item, a click on the backpack item; the test also checks `World.partyLook` equals the doll after the panel closes); `e2e/battle.test.ts` "draws each hero in what it wears and holds, and a foe as its body alone" (`looks.hero_1` is `['warrior', 'gear_breastplate', 'gear_sword', 'gear_shield']`, no foe entries), and the existing gear-change test now checks the battle figure loses its weapon and keeps the breastplate when the panel closes.

**Art touch-ups (passed on from step 02's review).**
- `gear_cloak_back`: the cape now stands a column clear of the body's outline down the arms (edges at columns 5 and 26 from row 13; a `k` shoulder shelf at row 12, columns 6 to 9 and 22 to 25), so a strip of blue shows beside both arms instead of a doubled outline. The hem is straight at columns 5 to 26 (was 4 to 27 with a flare). It is not narrowed to the design's ~6 to 24: a one-pixel blue strip beside the arms needs the edge at 5 and 26 (the body's outline is at 7 and 24), and a hem narrower than the shoulders read wrong. With a sword and shield the strips are mostly covered by the blade and the shield; on a hero with the cloak alone or a bow they read clearly.
- `warrior`: the hair is now mostly dark brown `N` (one `n` highlight on the crown), darker than the beard, within the same pixels. Optional; it separates the hair from the face and tunic a little, though the head still reads a little hood-like.
- `sprite check --project art`: ok (72 sprites, 160 frames). `npm run sprites` rebuilt; `npm run sprites:check` up to date.

**First manual pass** (screenshots of the running game, by a scratch Playwright script driving the dev server the browser tests start; before = step 02's art with this step's code, after = the touched-up art):
- Doll facing right, full kit: layers in order, cape behind, sword in front. Seen.
- Battle hero facing left (walked a hex west): the cape stays behind, flipped with the body. Seen.
- Walk on the map (slowed to half speed): the legs part in front of the cape, which holds still; no overlay jitters. Seen.
- Bare hero (armour and weapon off): body alone. Seen.
- Map figure at 2x: the cape reads beside the shield and below the fist.
- Sword swing, hit flash and fallen fade: not seen on screen. By the code, `swing` searches `over` (the sword is there, the cape is not), and `setFigureTint`, `setFigureAlpha`, `faceLeft`, `play` and `stop` act on `layers()`, which is `[...under, base, ...over]`; `pulseOutline` is on the container. Step 04 records the manual checks.

**Verification.** `npm test`: 68 files, 815 tests passed. `npm run sprites:check`: up to date. `sprite check --project art`: ok. `npm run test:browser`: 9 files, 78 tests passed (run after the art change).

**For step 04.** The probes `doll`, `partyLook` and `looks` are there for the manual's screenshots and checks. No contract changed.
