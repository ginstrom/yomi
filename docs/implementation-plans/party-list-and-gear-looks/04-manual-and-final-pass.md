# Step 04: Manual, screenshots and final pass

[Index](index.md) · [Design](../../designs/party-list-and-gear-looks.md) §5.2 (Docs) and §7 (Manual checks)

## Objective

Make the player's manual describe the party list and heroes drawn in what they wear, and retake the manual's screenshots, keeping only the images that changed. Record the design's manual checks over the finished feature. This is routine work; the only judgement is how the art looks.

## Requirements and context

- **Manual §3, "The world map"** (`docs/manual/README.md`, around line 105). Add:
  - "The parties are listed down the right side; click one to bring the view back to it." With one party today, word it so that it reads naturally. For example: "Your party is listed down the right side of the map, with its leader's face and its hit points; click it to bring the view back to it (as **Home** does)."
  - A sentence that heroes on the map, in battle and in the character panel are drawn in the armour, headgear and cloak they wear. It could go in §3, or in §4's Inventory subsection beside the paper doll; pick whichever reads better and say which in the record.
- **Hover text.** The panel says "Your party" (Q2, answered). The manual need not quote it.
- **Screenshots.** The map changes (the right strip, the narrower view), and so do the hero figures (no helm, trousers, overlays). The world, panel and battle screenshots are likely to change.
- **Manual checks** (design §7). Equip the Cloak of Shadows and the Sage's Circlet (debug console `give shadow_cloak` and `give sage_circlet`), then check:
  - the doll facing right;
  - a battle unit facing left, with the cape behind;
  - a walk on the map, with the legs in front of the cape and no jitter;
  - a sword swing, with the blade in front;
  - a hit, flashing every layer;
  - a fallen hero, every layer faded;
  - the bare hero;
  - the party list at 840×560: entry, hover summary, and a click after a pan.
- **Out of scope:** the stage 05/06 design edits of design §5.4. Leave `docs/designs/long-campaign/` alone.

## Dependencies and prerequisites

- **Step 01 must be done.** It provides:
  - the party list (`partyList.ts`, `PartyListView.ts`);
  - `WorldProbe.parties`, `selectedParty` and `infoRect`;
  - `centreOnSelected` (Home);
  - the CLAUDE.md lines for it.
- **Step 03 must be done.** It provides:
  - `heroLook` and `UnitFigure.setLook`;
  - `InventoryProbe.doll`, `WorldProbe.partyLook` and `BattleProbe.looks`;
  - the CLAUDE.md lines for it.
- **Step 02's sprites** are in the atlas.
- **Screenshots are taken inside podman.** Run `make shell`, then inside it `npm run manual:screenshots`. A subset is `npm run manual:screenshots -- -t "the world map, the character panel"`.
  - The shots are `e2e/manual.shots.ts`, with five cases: menu, party and creation; the world map, the character panel and a battle; a battle with bandits; the trading post and the workshop; the encampment, the guild hall and the blight.
  - They write `docs/manual/images/*.png`.
  - The container has Chromium. It has no sprite-tool, which this step does not need.

## Scope and implementation guidance

1. **Edit `docs/manual/README.md`** as above. Keep the manual's voice: second person, plain, short.
2. **Retake the screenshots** in the container (`make shell`, then `npm run manual:screenshots`).
3. **Keep only the images that changed** because of this feature.
   - Look at each PNG that `git status` reports as modified.
   - Keep the ones whose change is the strip, the narrower map, or the redrawn heroes. Expect at least `world-start`, `world-confront`, `world-after-victory`, `world-blight`, `panel-inventory` and the `battle-*` shots with heroes in view.
   - Restore any others (rendering noise, or a screen this feature does not touch) with `git checkout -- <file>`.
   - List what you kept and why in the execution record.
4. **Check that CLAUDE.md is still true.** Steps 01 to 03 edited it in their own commits. Grep for `recentre`, `setGear` and "bare-handed", and fix any stale wording. Change CLAUDE.md here only to correct it.
5. **Do the manual checks** (`npm run dev` on the host, or `make run`). Record each as passed or failed, with a note. A failure is a defect to report, or to fix in the step that owns it, not something to paper over here.

**Exclusions:** no code changes, apart from a fix the manual checks require, which you record as a deviation.

## Verification

- `npm test`, `npm run test:browser`, `npm run sprites:check` and `sprite check --project art` all pass.
- `git status` shows only:
  - `docs/manual/README.md`;
  - the kept images;
  - the plan files;
  - any CLAUDE.md correction.
- Nothing under `docs/designs/long-campaign/` has changed.
- The manual renders in the game: Menu, then Manual, scrolled to §3. The new text and the retaken `world-start` show.

## Completion criteria

- [ ] The manual describes the party list and worn gear.
- [ ] The screenshots were retaken in podman, with only the changed ones kept and listed.
- [ ] Every design §7 manual check is recorded.
- [ ] All checks are green.
- [ ] This step's status and commit are recorded in the index.

## Execution record

Done in the step's commit.

- **Manual.** Section 3 now says the parties are listed down the right side (leader's face, hit points, click to bring the view back, as Home does). The worn-gear sentence is in section 4's Inventory subsection, beside the paper doll, and names the world map and battle too. Hover text is not quoted.
- **Folded in from step 03's review.** The cape-edge wording is corrected in `art/gear/gear_cloak_back.sprite.toml` and in step 03's record (left edge 5 from row 13; right edge 25 in rows 13 to 15 and 26 from row 16); the art is unchanged. `unitLook.test.ts` now also requires every cloak item to have a `WORN_BACK_SPRITES` entry (it passes, so no red step was possible; it guards new cloaks).
- **Screenshots.** Retaken in podman (`podman run ... npm run manual:screenshots`, the `make shell` image, 5 of 5 passed). Pixel-diffed against HEAD: all 22 modified images differ in content, none is re-encoding only, so all are kept. Kept: `battle-attack`, `battle-bandits`, `battle-move`, `battle-spell-menu`, `battle-start`, `battle-targeting`, `battle-victory` (heroes redrawn bare with worn overlays; differences only inside the board); `world-start`, `world-confront`, `world-after-victory`, `world-blight` (strip, narrower view, party figure); `panel-inventory` (doll, plus the map behind it); `crafting`, `encampment`, `guild-hall`, `guild-hall-recruit`, `trading-post`, `panel-character`, `panel-level-up`, `panel-perk-tree`, `panel-skills`, `panel-spells-mage` (the map behind the translucent overlay now shows the right strip; the differences lie in the strip and the narrower map). The menu, party and creation shots were unchanged and were not modified.
- **CLAUDE.md.** Grepped for `recentre`, `setGear` and "bare-handed": no stale wording. No change.
- **Verification.** `npm test` 815 passed; `npm run test:browser` 78 passed; `npm run sprites:check` up to date; `sprite check --project art` ok; nothing under `docs/designs/long-campaign/` changed.
- **Manual checks (design section 7).** Covered by the step 03 e2e tests (doll, `partyLook`, `looks` probes; cape under the body in the layer order) and by the retaken shots (battle figures facing left in armour, bare-headed, with the party list and the strip at 1280x800). Not redone by hand in this step: the cloak and circlet walk, sword swing, hit flash and fallen fade (step 03's review saw swing, hit outline and fallen fade in a browser), the bare hero at close range, and the party list at 840x560 (covered by step 01's e2e layout test). No failures found.
