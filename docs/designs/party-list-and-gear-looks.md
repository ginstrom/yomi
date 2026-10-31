# World-map party list, and hero figures that show worn gear

Feature record: [`docs/features/party-list-and-gear-looks.md`](../features/party-list-and-gear-looks.md). Follows [`ui-feedback-drag-pan-cursor.md`](ui-feedback-drag-pan-cursor.md).

## 1. Purpose and status

Two independent changes, from play feedback:

- **A. The party list.** The world map gets a list of deployed parties down its right side, one entry per party. A click on an entry centres the view on that party, clearing any drag-pan, and makes it the party the left column shows. Today there is one party. The list is built so that the planned company of parties ([stage 05](long-campaign/stage-05-company-of-one.md), [stage 06](long-campaign/stage-06-multiple-parties.md), [reference](long-campaign/reference/multiple-parties.md)) only adds entries.
- **B. Gear looks.** A hero's figure shows what it wears, not only what it holds. The `warrior` body becomes a bare body, and worn armour, head and cloak items get overlays like the hands' gear. This applies wherever a `UnitFigure` is drawn: the inventory doll, battle units and the world-map figure. Face portraits do not change.

The two parts share no code and can be planned and shipped in either order.

**Status: approved by the user 2026-10-31.** Both questions in section 8 were answered with the defaults the design already uses.

User decisions this design follows (feature record, decision log):
- The list is built now for the single party, shaped for stage 06.
- "Portrait changes with gear" means the body figure, with a bare body and armour, head and cloak overlays. Face portraits stay fixed.
- Healing a full-health ally stays allowed, and the story and tutorial placeholders are left as they are. Neither is in this design.

## 2. Requirements and scope

### Part A: the party list

| ID | Requirement |
| --- | --- |
| A-R1 | The world map shows a list of the company's parties in a strip down its right side, between the header and the footer. There is one entry per party, in company order. Today that is one entry. |
| A-R2 | Each entry shows the party's leader's portrait, its member count, a bar for the whole party's hit points, and a marker while the party stands confronting monsters. The selected party's entry has a gold frame. |
| A-R3 | Clicking an entry selects that party and centres the view on it. Any drag-pan is cleared (as **Home** does), even when that party was already selected. |
| A-R4 | The selected party is the one the left column shows and the one **Home** centres on. Changing the selection rebuilds the column for the new party. With one party this never happens, but the code path exists. |
| A-R5 | Hovering an entry shows a short summary of the party in the existing info panel. |
| A-R6 | At the 840×560 minimum, the strip, the hex info panel, the header and the footer buttons do not overlap. The map's view, which takes clicks and is what centring centres in, ends at the strip's left edge. |
| A-R7 | Entries are not clickable while the party walks or while the outcome screen covers the map. |
| A-R8 | Stages 05 and 06 add entries without reshaping the list. The list's data comes from one function, which is the only thing that reads the single party. |

### Part B: gear looks

| ID | Requirement |
| --- | --- |
| B-R1 | The `warrior` body is redrawn bare: bare head with hair, a plain tunic, trousers and boots. Its fist, the `grip` and `chest` points, and the idle and walk frames are kept in the same geometry. |
| B-R2 | Worn items get overlays: the Steel Breastplate (`armor` icon), the Sage's Circlet (`circlet`) and the Cloak of Shadows (`cloak`). The cloak has a back part drawn behind the body and a front part (collar and clasp) drawn over it. |
| B-R3 | Layers are drawn in a fixed order, the same for both facings: cloak back, body, armour, cloak front, head, main hand, off hand. |
| B-R4 | An item with no overlay is worn unseen, as a held item with none is today. A test requires an overlay for every armour, head and cloak item in the catalogue, as one already does for held items. |
| B-R5 | The inventory doll, the battle figures and the world-map figure show the overlays. Each updates when gear changes, at the points where it already updates for held gear. |
| B-R6 | Swing, tint, alpha, the pulsed outline, facing, breathing and walking keep working across every layer. Only the weapon swings. |
| B-R7 | Face portraits are unchanged. |

### Non-goals

- More than one party. Selection logic for several parties, banners, names, orders and the time buttons belong to stages 05 and 06.
- Overlays for neck, ring, glove, belt and boot items. None is visible on a 32px figure, and no glove, belt or boot items exist.
- Looks for bandits and other foes. Their sprites stay fixed.
- A cloak that sways while walking. It holds still through the walk, as held gear does.
- Changing portraits.

### Acceptance criteria

- **AC1 (A-R1, A-R2, A-R6).** At 840×560 the world map shows one entry at the right, inside the window and below the header. The info panel, while shown, sits entirely left of the strip, and the footer buttons are as before.
- **AC2 (A-R3).** After a drag-pan, a click on the entry puts the map origin back where it was before the pan. The party's hex and the turn are unchanged.
- **AC3 (A-R5).** Hovering the entry sets the probe's `info` to the party summary.
- **AC4 (A-R7).** While walking, a click on the entry changes nothing.
- **AC5 (B-R1 to B-R5).** A new ready-made hero, who wears the Steel Breastplate, shows `gear_breastplate` over the body on the doll, in battle and on the map. Taking the breastplate off in the world-map panel removes it from the doll at once, and from the map figure when the panel closes.
- **AC6 (B-R3, B-R6).** With cloak, breastplate, circlet, sword and shield worn, the figure's layers, bottom first, are: `gear_cloak_back`, `warrior`, `gear_breastplate`, `gear_cloak`, `gear_circlet`, `gear_sword`, `gear_shield`. A strike still swings the sword about the fist.
- **AC7 (B-R4).** The unit test fails if an armour, head or cloak item lacks an overlay, or if an overlay is missing from the atlas.

## 3. Current system (inspected)

### World map

Source: [`src/scenes/WorldScene.ts`](../../src/scenes/WorldScene.ts), [`partyPanel.ts`](../../src/scenes/partyPanel.ts), [`PartyColumn.ts`](../../src/scenes/PartyColumn.ts), [`mapScroll.ts`](../../src/scenes/mapScroll.ts).

**Layout** (`layout()`):
- The header bar spans the full width to `HEADER_BOTTOM` (64). It has the turn and hint text at the left and `statusText` right-aligned at `width − 20`, `y` 16.
- The party column is `PARTY_PANEL_W` (80) wide from the header down. It is opaque, and its background is interactive so that clicks between portraits do not reach the map.
- The footer bar spans `PARTY_PANEL_W` to `width`, from `footerTop` = `height − 118` to the bottom. It holds the message line and one centred row of buttons.
  - The widest row is Camp (140), Camp until healed (200), Craft (140) and one 200-wide button, plus three 20px gaps: 740px. At 840 wide there is 760px for it.
  - So the footer cannot lose width.
- The hex info panel (`INFO_W` 280, `INFO_MARGIN` 12, `INFO_PAD` 10) is placed at `width − 12 − 280`, `HEADER_BOTTOM + 12`. It is translucent, over the map, and shows only while a hex is hovered.
- `view` is `{ x: 80, y: 64, width: width − 80, height: footerTop − 64 }`. At 840×560 that is 760×378.

**Following and panning:**
- `applyOrigin()` puts `mapLayer` at `panOrigin` (clamped), or else at `mapOrigin(party figure point, map, view)`.
- `recentre()` (Home) clears `panOrigin` and applies the origin. It returns early while walking, under the outcome shade, during a press, or when not panned.
- Interactive objects under the pointer stop a press on the map. The `pointerdown` handler returns when `over.length > 0`.

**The party** is `GameState.party`, and its hex is `WorldState.party`. A confrontation is `WorldState.confronting` (a location id or null).
- The map figure is one `UnitFigure('warrior', PARTY_SCALE)`, dressed from `party[0]` by `refreshPartyGear()`. That runs on create, on resume from an overlay, and after a debug command.
- `PartyColumn` takes the party in its constructor and builds a fixed tile per member. It has no `destroy`.

`WorldProbe` has `origin`, `view`, `info` and `party` (the portraits), but no figure or list data.

### Hero figures

Source: [`src/scenes/unitLook.ts`](../../src/scenes/unitLook.ts), [`UnitFigure.ts`](../../src/scenes/UnitFigure.ts), [`art/units/warrior.sprite.toml`](../../art/units/warrior.sprite.toml), [`art/gear/`](../../art/gear), [`art/CLAUDE.md`](../../art/CLAUDE.md).

**The body.** `warrior` is the body of every hero. Its `idle_0` has these parts:
- a horned helm (rows 3 to 8; horns at columns 10 to 11 and 19 to 21);
- the face under it (columns 15 to 19, rows 8 to 10) and a beard (`n`);
- pauldrons and steel arms;
- a breastplate over a red tabard (rows 11 to 21);
- steel legs, with the knee at row 24 and boots at rows 29 to 31.

The fist is at rows 18 to 20, columns 22 to 27. The left hand is at row 18, columns 8 to 9. The body names two points: `grip = [25, 19]` and `chest = [16, 15]`.

The body's frames:
- `idle_1` is `move = { rows = [0, 24], by = [0, 1] }`.
- `walk_0`, `walk_1` and `walk_2` replace only rows 23 to 31 (`walk_0`) or 25 to 31 (`walk_1` and `walk_2`).
- The animations are `idle` (600 ms) and `walk` (140 ms; `walk_0`, `walk_1`, `walk_0`, `walk_2`).

**Held gear.** Each held item is a `unit`-canvas sprite in `art/gear/` with `over = "warrior"`.
- Its `idle_1` is `shift = [0, 1]`, `[anim.idle] like = "warrior"` and `[anim.walk] rest = true`.
- `GEAR_SPRITES` maps an `ItemIcon` to a sprite.
- `gearLayers(equipment)` returns the main hand's sprite, then the off hand's, dropping the off hand beside a two-handed weapon.
- `unitLook.test.ts` checks three things: every held item in `WEAPONS`, `MAGIC_ITEMS` and the shield has an entry; every entry is in `atlas.json` with an idle animation; and every `warrior` frame has `grip` and `chest`.

**`UnitFigure`** is a container of `[base, ...gear]`.
- `setGear(sprites)` replaces the gear layers, then copies flip and alpha and restarts the animation so that the layers breathe together.
- `play`, `stop`, `faceLeft`, `setFigureAlpha` and `setFigureTint` act on `layers()` = `[base, ...gear]`.
- `swing` turns the first gear layer named in `SWUNG_GEAR` about the body's `grip` point.
- `pulseOutline` is a Glow filter on the container.

**Callers:**
- `BattleScene.refreshGear` (at the start, and when the character panel closes) calls `figure.setGear(gearLayers(member.equipment))`.
- `InventoryScene.buildPaperdoll` builds a new doll on every redraw, which follows every gear change.
- `WorldScene.refreshPartyGear` dresses the map figure.

**Worn items today** (`src/inventory/inventory.ts`):
- `STEEL_ARMOR` (slot `armor`, icon `armor`). Every created and ready-made hero starts in it (`character.ts`, line 330).
- `SAGE_CIRCLET` (slot `head`, icon `circlet`).
- `SHADOW_CLOAK` (slot `cloak`, icon `cloak`).
- Graded and modified items copy their base item, so they keep its icon.
- No `gloves`, `belt` or `boots` items exist. The amulet and the rings are not visible at this size.

### The `sword_ember`, `bow_hawk` and `wand_storm` question: not a gap

These three are `[variants]` tables in the base sprites' sources, not separate files:
- `art/gear/gear_sword.sprite.toml` has `[variants.ember]`, which builds `gear_sword_ember`.
- `art/gear/gear_bow.sprite.toml` has `[variants.hawk]`.
- `art/gear/gear_wand.sprite.toml` has `[variants.storm]`.

sprite-tool builds a variant as `<id>_<name>`, the convention [`art/CLAUDE.md`](../../art/CLAUDE.md) describes for enchanted items. All three are in `public/assets/sprites/atlas.json` (`gear_sword_ember/idle_0` and so on), with `idle` and `walk` animations in `atlas.anims.json`. The existing atlas test in `unitLook.test.ts` already proves it. Nothing needs doing.

## 4. Proposed behaviour

### 4.1 Part A: the party list

**Layout.** A strip `PARTY_LIST_W` = 80 wide runs down the right edge from `HEADER_BOTTOM` to `footerTop`. Its width mirrors the left column. It is opaque, in the column's colours (`COLUMN_COLOR` with the edge line on its left side), and its background is interactive with no handler, as the column's is, so a click between entries is no map click.

The strip stops at the footer: the footer bar and its centred button rows keep the full width they have today, which the 740px camp row needs at 840. The header is unchanged, and `statusText` stays in the header's top right, above the strip.

What else moves:
- **The view** becomes `{ x: 80, y: 64, width: width − 160, height: footerTop − 64 }`. Centring therefore centres between the two strips. At 840×560 the view is 680×378. Clicks, hover and the pan all keep to it, because they already read `view`.
- **The info panel** moves left of the strip, to `x = width − PARTY_LIST_W − INFO_MARGIN − INFO_W`. At 840 that is 468 to 748, inside the view. Its `y` and size are unchanged.
- **The footer** does not change.

```
 0 ┌──────────────────────── header (full width) ───────────────────────┐
64 ├──────┬─────────────────────────────────────────┬──────┬────────────┤
   │party │                       ┌── info 280 ──┐  │ list │            │
   │column│        map view       │ (on hover)   │  │ ┌──┐ │  ← entry   │
   │ 80   │      (680 at 840)     └──────────────┘  │ │64│ │    64×64   │
   │      │                                         │ └──┘ │    + bar   │
   │      │                                         │  80  │            │
442├      ├──────────────── footer: message + buttons (full width) ──────┤
560└──────┴─────────────────────────────────────────────────────────────┘
```

**An entry** (pure geometry in `partyList.ts`, section 5.1) is a 64×64 tile centred in the strip, the first at `HEADER_BOTTOM + 8`. The pitch is 64 + 2 + 6 + 8 = 80, so three entries reach 64 + 8 + 240 = 312, well inside the 442 the minimum window gives. The tile shows:

- **The leader's portrait** at scale 2 (the portrait texture `PartyColumn` already loads), framed as a column tile. The leader is the first member, the one the map figure is dressed from.
- **The member count**, at the top left in the column's outlined 11px text, as `4` with a small person glyph. It is shown even for one party, because stage 06 parties of 2 to 5 differ.
- **A party hit point bar**, 64×6 under the tile: the sum of members' `hp` over the sum of `maxHp`, in the column's green, orange and red thresholds. The thresholds are pulled out of `PartyColumn.refresh` into one shared `hpBarColor(ratio)` in `partyPanel.ts`, so the two cannot drift apart. This bar is the "wounded" marker; there is no separate one.
- **A confronting marker**: a red `!` (`#e53935`, 15px, outlined) at the tile's top right, while `world.confronting` is set for the party. It is the one state that blocks time in stage 06. A party merely near monsters is not marked, because the map shows that.
- **The frame**: gold, 3px (`FRAME_ACTIVE_COLOR`), for the selected party; otherwise the column's frame colour, lightened on hover.

No name is drawn on the tile today, because the party has none. Stage 06 adds names, and those go in the hover summary (below), not on the 64px tile.

**Click** (`pointerdown` on the tile, with the column's click sound). This is ignored while walking or under the outcome shade (A-R7). Otherwise it calls `selectParty(id)`:
1. If `id` is not the selected party, set the selection, rebuild the left column for that party's members (`PartyColumn.destroy()`, then a new `PartyColumn`), and set the active member to that party's first member with something to spend, else 0. This is the rule `create()` uses.
2. In all cases, clear `panOrigin` and apply the origin, centring on the selected party's figure. Then re-read the hover under the pointer, as `recentre()` does.

`recentre()` (Home) becomes the second half of this, `centreOnSelected()`. It keeps its guards, but the "not panned" early return goes, because centring an unpanned view changes nothing. Both Home and an entry click go through it.

**Hover.** While the pointer is over an entry, the hex hover is cleared and the info panel shows `partyListInfo(entry)`:
- title: the party's name (today "Your party");
- `N members`;
- `Hit points: X / Y`;
- `Before the <location name>` while confronting;
- `Click to centre the view on it.`

`pointerout` returns the panel to hex hover. The panel already sizes to its text.

**Keyboard.** No new key; Home now centres on the selected party. **Tutorial.** No new anchor.

**Edge cases:**
- An empty party never reaches the map, because a defeat ends the game. `deployedParties` would return no entry, and the strip would be drawn empty.
- On a window resize, the strip and entries are re-laid in `layout()` from `width`, `height` and `footerTop`.
- When the selected party walks, the view follows it as today. The list does not change during a walk. Hit points and confrontation are refreshed in `refresh()`, the same place the column is.
- Overlays (Inventory, Menu, Story) pause the scene, so the list takes no clicks under them.

### 4.2 Part B: gear looks

**What the player sees.** Heroes are drawn bareheaded, in a tunic, trousers and boots, with whatever they wear on top:
- The Steel Breastplate: steel pauldrons, steel arms down to the wrist, the plate and the red tabard. This is today's look from the neck to the hips.
- The Sage's Circlet: a silver band across the forehead with a blue stone.
- The Cloak of Shadows: a dark blue cape hanging behind the hero to the knees, and a blue collar with a gold clasp at the throat.

Because every hero starts in the breastplate, a new party looks as today except:
- the horned helm is gone (no helm item exists; see Q1);
- the legs are trousers and boots, not steel.

**When it updates.** The figure updates at the points where held gear already does:
- **Doll:** at once, as the panel redraws after every change, a drag included.
- **Battle:** when the character panel closes (`BattleScene.refreshGear`).
- **World map:** when any overlay resumes the map (`RESUME`, after the panel, crafting and so on), after a debug command, and on scene start (after battle, encampment and so on).

**Layer order** (bottom first), fixed for both facings:

| # | Layer | Source | Why here |
| --- | --- | --- | --- |
| 1 | cloak back | `cloak` slot, `WORN_BACK_SPRITES` | Behind everything: the cape hangs behind the body. |
| 2 | body | `warrior` | |
| 3 | armour | `armor` slot | On the torso. |
| 4 | cloak front | `cloak` slot, `WORN_SPRITES` | The collar and clasp lie over the armour's neck. |
| 5 | head | `head` slot | A helm or circlet over the cloak's collar. |
| 6 | main hand | `mainHand`, `GEAR_SPRITES` (as today) | Held things are in front of what is worn, so a swung blade passes in front of the body. |
| 7 | off hand | `offHand`, `GEAR_SPRITES` (as today) | The shield is outermost, as today. |

**Facing.** Sprites are drawn facing right and the figure is flipped as a whole (`faceLeft` sets `flipX` on every layer). The back layer flips with the rest, so the cape stays behind the body. The order is the same both ways, which a single drawing direction allows.

**An item with no overlay** adds nothing and is worn unseen. This is the rule `GEAR_SPRITES` has for held items. There is no per-slot fallback (for example, any armour drawn as the breastplate): a fallback would show the wrong armour, and the coverage test (B-R4, section 7) makes a missing overlay fail `npm test` instead. Neck, ring, glove, belt and boot slots are never looked up.

**Effects:**
- **Swing:** `swing` still finds the weapon among the over-layers by `SWUNG_GEAR` and turns it about the body's `grip`. The bare body keeps the fist and `grip` exactly where they are, and worn overlays never draw in the fist box (section 4.3), so the swing is unchanged. Worn layers do not move in a swing.
- **Tint, alpha and fading of a fallen hero:** `setFigureTint` and `setFigureAlpha` go over all layers, under-layers included, because `layers()` returns `[...under, base, ...over]`. `setLook` copies the current alpha and flip to new layers, as `setGear` does.
- **Lunge, bob, knock and dodge:** these tween the unit's container, so every layer moves as one.
- **`pulseOutline`:** the Glow filter is on the figure container, so it rings the whole silhouette, the cape included.
- **`point()`, `chest` and `standingHeight`:** these read the base and are unchanged. The `chest` point is not moved by armour.
- **Breathing:** every overlay has `idle_1` = `idle_0` shifted down a pixel and `[anim.idle] like = "warrior"`. `setLook` restarts the playing animation on every layer, so they breathe together.
- **Walking:** every overlay has `[anim.walk] rest = true` and holds `idle_0`. The body's walk changes only rows 23 to 31, so overlays above row 23 stay aligned. The cloak's back part reaches lower, but it is behind the legs, so the moving legs pass in front of it.

### 4.3 The art (sprite-tool, following [`art/CLAUDE.md`](../../art/CLAUDE.md))

Run `sprite guide --project art` first. All sprites are on the `unit` canvas (32×32, anchor `[16, 32]` at the feet, shown at 3x in battle). Each overlay is an `art/gear/*.sprite.toml` with `canvas = "unit"` and `over = "warrior"`. The outline rule is then checked against the body, edges are outlined in `k` by hand, and the overlay's `idle_0` lines up with the body's `idle_0` pixel for pixel. Use runs, since these sprites are mostly empty.

**Pixel regions** on the body's `idle_0`. These are rows and columns, from 0 at the top left, as `sprite show warrior` numbers them. The regions are what keeps the layers composable:

| Region | Rows | Columns | Owned by |
| --- | --- | --- | --- |
| Head | 3–10 | 11–21 | Body: hair and face. Head overlays draw here only. |
| Face | 7–10 | 15–20 | Body. The face stays where it is today (eye at row 8, column 17; nose at row 9, column 19), so head overlays sit right. Head overlays leave rows 7 to 10 at columns 15 to 20 open, except a helm's cheek guard at column 15. |
| Neck and shoulders | 10–12 | 9–23 | Armour's pauldrons and the cloak front's collar. |
| Torso | 11–21 | 9–21 | Body (tunic); armour covers it. |
| Arms | 12–19 | 7–10 (shield arm), 19–24 (weapon arm) | Body (sleeves); armour may cover them down to the wrist. |
| **Fist box** | 17–21 | 20–27 | **Body only.** No worn overlay draws here. The weapon is gripped at `[25, 19]`. |
| **Off hand** | 17–19 | 7–10 | **Body only**, the hand under the shield. |
| Legs | 20–31 | 8–23 (walk frames spread to columns 8 to 23) | Body only. Only the cloak back, behind the body, reaches below row 21. |

**Sprites to make:**

1. **`units/warrior` (redrawn, same id).** The id stays `warrior`: it is the `UnitKind` heroes are built as (`encounters.ts`), the atlas name, and what every test and caller names.
   - Header comment: "A hero's body, bare: hair, tunic, trousers, boots, empty hands. What it wears and holds is drawn over it, from art/gear/."
   - `idle_0`, drawn as a full grid like today's:
     - **Head:** short hair (`N`/`n`) over the crown and the back of the head (columns 12 to 16, rows 4 to 8), with the face in skin (`s`/`h`/`S`) in today's place. Keep today's brown beard (`n`) at rows 10 to 11, columns 15 to 17, so a hero reads the same with or without a helm.
     - **Torso:** an arming tunic in `t`/`T` with `n` shading, belted in `N` at row 17 (where today's `Nnnyynn` belt row is).
     - **Arms:** tunic sleeves to the wrists, skin hands. The fist is the same outline and position as today's (rows 18 to 20, columns 20 to 27), in skin.
     - **Legs:** trousers in `n`/`N` and boots in `N`/`k` at rows 29 to 31. The leg silhouette is column for column today's, so the derived walk frames keep their geometry.
   - `[points]`: `grip = [25, 19]` and `chest = [16, 15]`, unchanged.
   - `idle_1`: `from = "idle_0"`, `move = { rows = [0, 24], by = [0, 1] }`, unchanged.
   - `walk_0`, `walk_1` and `walk_2`: the same rows replaced as today (23 to 31; 25 to 31), with the same leg shapes in trouser and boot colours instead of steel.
   - Animations: `[anim.idle]` (600 ms) and `[anim.walk]` (140 ms, `walk_0`, `walk_1`, `walk_0`, `walk_2`), unchanged.

2. **`gear/gear_breastplate`** (Steel Breastplate, icon `armor`). This is today's body from row 11 to row 21: pauldrons, steel upper and lower arms, plate (`D`/`d`/`l`/`w`) and the red tabard (`R`/`r`/`y`) with its belt.
   - It excludes the fist box, the off hand, and everything above row 10 or below row 21.
   - It must cover the body's tunic wherever the plate is meant to show, with no tunic pixel showing through a gap.
   - `idle_1`: `from = "idle_0"`, `shift = [0, 1]`.
   - Animations: `[anim.idle] like = "warrior"`, `[anim.walk] rest = true`.
   - Taking it straight from the current `warrior.sprite.toml` keeps today's look exactly.

3. **`gear/gear_circlet`** (Sage's Circlet, icon `circlet`). A one-pixel band across the forehead, at row 6 or 7 from the back of the head to the brow (columns 12 to 18), in `w`/`l` with a `k` outline above and below where it meets transparency. A blue stone (`c`, with `b`) sits at the brow, column 17 or 18.
   - Frames and animations as item 2.

4. **`gear/gear_cloak`** (Cloak of Shadows, icon `cloak`; the front part). A collar of `B`/`b` across the shoulders at rows 10 to 12, columns 11 to 21, with a gold clasp (`y`/`Y`) at the throat, column 18 or 19, row 11.
   - It must not cover the face (rows 7 to 10, columns 15 to 20), apart from the collar's top edge at row 10 if it reads better.
   - Frames and animations as item 2.

5. **`gear/gear_cloak_back`** (Cloak of Shadows; the back part, drawn under the body). A cape in `B`/`b` with `c` folds, matching the cloak icon's colours, hanging from the shoulders (row 11) to row 26. It is about columns 6 to 24 wide, flaring a little toward the hem, outlined in `k`.
   - It is drawn whole: the body hides what is behind it. What shows is the cape beside the shield arm (columns 5 to 7), beside and below the weapon arm (columns 21 to 25, around the fist box), and between and around the legs at rows 21 to 26.
   - `over = "warrior"` is still set, which lets the outline check count the body's pixels. Note that `sprite preview gear_cloak_back --on warrior` draws it over the body, not under. To judge it, preview it alone (`sprite preview gear_cloak_back --grid`) and then on the inventory doll in the running game.
   - Frames and animations as item 2. Its `shift = [0, 1]` moves the hem with the breath, while the legs below row 24 stay still. That is cloth moving and is intended.

No `[variants]` are needed: each worn item is unique today. Stage 03's material tiers can use `[variants]` on these files, as the enchanted weapons do.

**Loop**, per [`art/CLAUDE.md`](../../art/CLAUDE.md):
1. Run `sprite check --project art` until it prints `ok`. It warns of W009 if an overlay neither plays nor rests through the body's walk.
2. Run `sprite show <id> --project art`.
3. Run `sprite preview gear_<x> --on warrior --project art` for the over-layers.
4. Run `sprite preview warrior --anim walk --project art` to see the legs.
5. Run `npm run sprites`, then commit everything it writes, the manifest included.
6. Add the four new sprites to `public/assets/sprites/README.md`.

## 5. Technical design

### 5.1 Part A

**New `src/scenes/partyList.ts`** (Phaser-free, so its test runs in the `domain` project):

```ts
/** The strip down the world map's right side; the map's view keeps to the left of it. */
export const PARTY_LIST_W = 80
/** The id of the one party today; stage 05's migration names the first expedition the same. */
export const FIRST_PARTY_ID = 'party_1'

/** What the list shows of one party. */
export interface PartyListEntry {
  id: string
  /** Shown in the hover summary; "Your party" until parties have names (stage 06). */
  name: string
  members: readonly Character[]   // the leader is members[0]
  position: Hex
  /** The monster location it stands before unanswered, or null. */
  confronting: { id: string; name: string } | null
  hp: number
  maxHp: number
}

/** Every party on the map, in company order. The only reader of the single party. */
export function deployedParties(game: GameState): PartyListEntry[]

/** The `index`th entry's tile (64×64) and hit point bar, in a window `width` wide. */
export function partyEntryRect(index: number, width: number): Rect
export function partyEntryBarRect(index: number, width: number): Rect

/** The info panel's words for an entry. */
export function partyListInfo(entry: PartyListEntry): { title: string; lines: string[] }
```

- Today `deployedParties` returns a list of one: `{ id: FIRST_PARTY_ID, name: 'Your party', members: game.party, position: game.world.party, confronting: …from world.confronting and its location's name… }`, with `hp` and `maxHp` summed over the members (using `maxHp` from `character.ts`). It returns `[]` for an empty party.
- `partyPanel.ts` gains `hpBarColor(ratio: number): number`, using today's thresholds (above 0.5 green `0x43a047`, above 0.2 orange `0xfb8c00`, else red `0xe53935`). `PartyColumn.refresh` uses it.

**New `src/scenes/PartyList.ts`** (Phaser game objects, no logic; the counterpart of `PartyColumn`):
- `constructor(scene, onClick: (id) => void, onHover: (id | null) => void)`.
- `layout(width, top, bottom)`.
- `refresh(entries: PartyListEntry[], selected: string)`. This rebuilds tiles when the ids change, and otherwise updates them.
- `probe(): PartyListProbe[]`.

**`PartyColumn`** gains `destroy()`, which destroys every object it created. This is needed only for a change of selection.

**`WorldScene` changes:**
- New field `selectedParty: string`, set in `create()` to `deployedParties(game)[0].id`. Stage 05 reads it from scene data (see 5.3).
- Build the `PartyList` after the column and before `outcomeShade`, so the shade covers it.
- In `layout()`:
  - `view.width = max(0, width − PARTY_PANEL_W − PARTY_LIST_W)`;
  - the info box at `width − PARTY_LIST_W − INFO_MARGIN − INFO_W`;
  - `partyList.layout(width, HEADER_BOTTOM, footerTop)`.
- In `refresh()`: `partyList.refresh(deployedParties(game), selectedParty)`.
- Add `selectParty(id)` and `centreOnSelected()`, as in 4.1. Home calls `centreOnSelected()`.
- Add `hoveredParty: string | null`. `refreshInfo()` shows `partyListInfo` while it is set, and otherwise behaves as today.
- Today `applyOrigin` focuses on `this.party` (the one figure). It stays that way. Stage 06, with a figure per party, focuses on the selected party's figure.

**`WorldProbe`** gains:

```ts
/** The party list down the right, an entry a party, by its centre on screen. */
parties: Array<Point & { id: string; members: number; selected: boolean; confronting: boolean }>
selectedParty: string
```

### 5.2 Part B

**`src/scenes/unitLook.ts`:**

```ts
/** The sprites laid over a hero's body for what it wears, by the item's icon (art/gear/); one with none is worn unseen. */
export const WORN_SPRITES: Partial<Record<ItemIcon, string>> = {
  armor: 'gear_breastplate',
  circlet: 'gear_circlet',
  cloak: 'gear_cloak',
}
/** The sprites drawn behind the body for what it wears: the cloak's cape. */
export const WORN_BACK_SPRITES: Partial<Record<ItemIcon, string>> = { cloak: 'gear_cloak_back' }
/** The slots whose items are seen, in drawing order over the body. */
export const WORN_SLOTS = ['armor', 'cloak', 'head'] as const

/** What a hero's figure is drawn from besides its body: layers under it and over it, each lowest first. */
export interface HeroLook {
  under: string[]
  over: string[]
}

/** Worn layers (WORN_SLOTS order), then the held ones (as gearLayers did). */
export function heroLook(equipment: Equipment): HeroLook
```

- `heroLook` returns:
  - `under`: the cloak's back sprite, if any;
  - `over`: the armour's, the cloak's and the head's worn sprites, in that order, then the main hand's and the off hand's `GEAR_SPRITES` entries, with today's two-handed rule.
- `gearLayers` stays as the held part, and `heroLook` uses it. It is still exported, because the existing tests name it.
- `GEAR_SPRITES` and `SWUNG_GEAR` are unchanged.

**`src/scenes/UnitFigure.ts`:**
- `setGear(sprites)` becomes `setLook(look: HeroLook)`.
  - It destroys the old under and over layers.
  - It inserts `under` at index 0 of the container, below the base, in order, and adds `over` on top.
  - It copies flip and alpha, and restarts `playing`, as now.
- Fields: `under: Sprite[]` and `over: Sprite[]` (today's `gear` renamed).
- `layers()` returns `[...under, base, ...over]`.
- `swing` searches `over` (SWUNG_GEAR names are only ever there).
- Add `lookNames(): string[]`, the layer names bottom first (for probes).

**Callers:** `BattleScene.refreshGear`, `InventoryScene.buildPaperdoll` and `WorldScene.refreshPartyGear` call `setLook(heroLook(equipment))`. The world one keeps reading `party[0]`, and in stage 05 the selected expedition's first member.

**Probes** (`src/testHook.ts`):
- `InventoryProbe.doll: string[]`;
- `WorldProbe.partyLook: string[]`;
- `BattleProbe.looks: Record<UnitId, string[]>` (heroes only; foes' figures are their body alone).

Each is `lookNames()`.

**Docs:**
- Root `CLAUDE.md`:
  - Assets paragraph: "Every hero is the `warrior` body, bare, with sprites laid under and over it for what it wears (`WORN_SPRITES`, `WORN_BACK_SPRITES`) and holds (`GEAR_SPRITES`), drawn in `heroLook`'s order".
  - The `unitLook.ts` and `UnitFigure.ts` mentions.
  - The world-map paragraph: the party list, `partyList.ts` and `PartyList.ts` in the helper list.
- `art/CLAUDE.md`, the hero-layers bullet:
  - worn overlays, and the region rules of 4.3 (fist box and off hand body-only);
  - a back layer is drawn under the body though it says `over = "warrior"`, and `--on` previews it on top.
- `docs/manual/README.md`, §3:
  - "The parties are listed down the right side; click one to bring the view back to it."
  - A sentence that heroes on the map, in battle and in the character panel are drawn in the armour, headgear and cloak they wear.
- Retake the manual screenshots, since the map and the figures change visibly (`npm run manual:screenshots`).

No save, log or rules change: no `SAVE_VERSION` or `LOG_SCHEMA_VERSION` bump.

### 5.3 What stages 05 and 06 will need to change (Part A)

The designs are not edited here. These are the changes those stages will make in this code:

- **Stage 05 (company of one):**
  - `deployedParties` maps `game.parties` (each `Expedition`'s `id`, `name`, `members`, `position` and `confronting`) instead of the single party. Its id `party_1` matches the migration's.
  - `selectedParty` travels in the World scene data and through the overlays' resume data, as stage 05 says ("Scenes get the selected expedition from scene data").
  - The party's order line goes in the left column, as stage 05 says, not on the list tile.
  - **Next day** and **Until something happens** cannot join the footer's camp row at 840 wide, which is already 740 of 760. The recommended place is a short stack at the bottom of the right strip, with the strip's entries above. This design leaves room for that, because three entries end at y 312.
- **Stage 06 (multiple parties):**
  - More entries; their order is company order.
  - A banner colour per party, shown as a stripe or corner on the tile, so that the list and the map's banner markers match.
  - The name stays in the hover summary.
  - The interrupt focus calls `selectParty(id)`.
  - A figure per party on the map. `applyOrigin` focuses on the selected party's figure.
  - Meet orders are given by clicking a banner on the map, not the list.
  - `selectParty` already rebuilds the column.

### 5.4 Edits the long-campaign designs should get (not made here)

1. [`reference/multiple-parties.md`](long-campaign/reference/multiple-parties.md):
   - **§4.2:** "The world map gains a **party bar**: one entry per party, with its banner, name, members' portraits and hit points, and its order." becomes: "The world map has a **party list** down its right side ([party-list-and-gear-looks.md](../../party-list-and-gear-looks.md)), one entry per party, with its leader's portrait, banner colour, member count and hit points. The left column shows the selected party's members and order. Clicking an entry selects that party and centres the map on it."
   - **R13:** "A party bar selects a party" becomes "The party list selects a party".
   - **"Two buttons sit beside the bar":** point at the right strip's foot.
2. [`reference/multiple-parties.md`](long-campaign/reference/multiple-parties.md) §5.4: "The party column becomes the party bar" becomes "The party list (already built) gains an entry per party; the party column shows the selected party".
3. [`stage-06-multiple-parties.md`](long-campaign/stage-06-multiple-parties.md):
   - §1 "The world map gets a party bar" and §2 "The party bar, banners on the map, and order buttons": name the existing list and the banner colour on its entries.
   - §6 play script step 2: "select each party from the list".
4. [`stage-05-company-of-one.md`](long-campaign/stage-05-company-of-one.md):
   - §2, "The world map": `deployedParties` moves onto `game.parties`, and the selected party is carried in scene data.
   - Place the two time buttons at the foot of the right strip.
5. [`reference/gear-and-runes.md`](long-campaign/reference/gear-and-runes.md):
   - Non-goal "Changing hero sprites for gear. … Unit sprites stay as they are." becomes: "Hero figures show worn armour, head and cloak items (party-list-and-gear-looks.md). Each new armour or head family (robe, leather, plate, cap, helm) needs a worn overlay, or `unitLook.test.ts` fails. Gloves and boots stay unseen."
   - The same note in [`stage-03-gear-families.md`](long-campaign/stage-03-gear-families.md) §2 "Icons".

## 6. Consequences

- **Look change.** Every hero loses the horned helm and the steel legs until helm and greave items exist (Q1). The doll, battle units and the map figure all change, as do the manual's screenshots.
- **Map width.** The view is 80px narrower. At 840 wide it is 680 instead of 760, about 10% less map. The footer and header are unchanged.
- **Performance.** At most four more sprites a figure (cape, cloak front, circlet, armour), all from the one atlas, with negligible cost. The list is one tile a party.
- **Compatibility.**
  - No save or rule change.
  - `setGear` is renamed to `setLook`, and its three callers move with it.
  - The atlas grows by four sprites. `npm run sprites:check` must pass in CI, so the exported files must be committed with the sources.
- **Rollback.** Each part reverts on its own.

## 7. Verification

The repo splits tests this way: rules and helpers in `domain`, `*Scene.test.ts` as smoke tests, and what only the running game shows in `e2e/`.

**Domain (`npm test`):**
- `partyList.test.ts` (new):
  - `deployedParties` gives one entry for a game, with id `party_1`, the party's members and position, summed `hp` and `maxHp`, and `confronting` null on open land and set, with the location name, after `travel` into a monster location;
  - `[]` for an empty party;
  - `partyEntryRect` places entry 0 inside the strip (`x ≥ width − PARTY_LIST_W`, right edge ≤ `width`), and three entries fit above `footerTop` at 840×560 (bottom ≤ 442);
  - `partyListInfo` lines for a confronting and a wounded party.
- `partyPanel.test.ts`: `hpBarColor` at 0.6, 0.5, 0.3, 0.2 and 0.
- `unitLook.test.ts`:
  - `heroLook({})` is `{ under: [], over: [] }`;
  - `heroLook({ armor: STEEL_ARMOR })` has `over: ['gear_breastplate']`;
  - the full kit gives AC6's order exactly;
  - an amulet and rings add nothing;
  - the two-handed rule still holds (`STEEL_GREATSWORD` with `OAK_SHIELD`);
  - a graded breastplate (`itemById('steel_armor@2')`) gets `gear_breastplate`;
  - **Coverage (B-R4):** every item in `BASE_ITEMS` and `MAGIC_ITEMS` with slot `armor`, `head` or `cloak` has a `WORN_SPRITES` entry;
  - **Atlas:** every sprite in `WORN_SPRITES` and `WORN_BACK_SPRITES` is in `atlas.json` with `idle_0`, and has `idle` and `walk` animations;
  - the existing `grip` and `chest` on every `warrior` frame test still passes against the redrawn body.
- `WorldScene.test.ts`, `BattleScene.test.ts` and `InventoryScene.test.ts` smoke tests pass.
- `npm run sprites:check` passes, and `sprite check --project art` prints `ok`.

**Browser (`npm run test:browser`):**
- `world.test.ts`:
  - **List and layout (A-R1, A-R6):** at the default size and after resizing to 840×560, `parties` has one entry, `selected: true`, centred inside `[width − 80, width]`, with `y > 64`. `view.x + view.width ≤ width − 80`. Hovering a hex shows `info`. (The info box's position is not in the probe. Add `infoRect` only if a layout test needs it.)
  - **Centring (A-R3, AC2):** pan by dragging 40px, then click the entry. `origin` equals its value before the pan, and `world.party` and `world.turn` are unchanged. Clicking the entry with no pan changes nothing.
  - **Hover (A-R5):** hovering the entry makes `info` start with "Your party".
  - **While walking (A-R7):** start a journey and click the entry; `origin` still follows the walk and nothing breaks. This is an assertion on no console error and arrival as usual.
  - **Confronting (A-R2):** after `travelTo` monsters, the entry's `confronting` is true.
- `character.test.ts`:
  - **Doll (AC5):** on the world map, open the panel. `doll` contains `gear_breastplate`. Unequip the armour (click the slot); `doll` no longer contains it. Close the panel; `partyLook` (if the member is the first) no longer contains it. Equip it again; it is back.
- `battle.test.ts`: in a battle, `looks[hero]` contains `gear_breastplate` and the weapon's sprite.

**Manual checks** (by running the game; the canvas cannot be compared in tests):
- Equip the Cloak of Shadows and the Sage's Circlet (debug console `give`, or loot), and look at:
  - the doll facing right;
  - a battle unit facing left (the cape stays behind);
  - a walk on the map (the legs pass in front of the cape, and the overlays do not jitter);
  - a sword swing (the blade stays in front);
  - a hit (the flash tints every layer);
  - a fallen hero (every layer fades).
- Check the bare hero, too.

## 8. Open questions and assumptions

**Questions only the user can answer** (neither blocks; the design uses the default):
- **Q1. The horned helm.** No helm item exists until stage 03, so every hero goes bareheaded. Should heroes keep a default look until helms exist?
  - **Default: no.** The figure shows exactly what is worn. Stage 03's Helm family gets the horned helm's pixels as its overlay.
  - The alternative is a hidden default overlay for an empty head slot. It is cheap, but it would lie about gear.
  - **Resolved 2026-10-31: no default helm; heroes show only worn gear.**
- **Q2. A name for the single party.** The hover summary calls it "Your party" until stage 06 adds names. Should it be "First Company" now, matching stage 05's migration?
  - **Default: "Your party".**
  - **Resolved 2026-10-31: 'Your party'.**

**Assumptions:**
- **AS1.** The list sits in an opaque strip that ends at the footer, and the view narrows by its width, so that "centre" means the middle of the visible map. The alternative was a translucent strip over the map, but then centring would be visibly off-centre.
- **AS2.** An entry is the leader's portrait (not the map figure), the member count, a party hit point bar, and a confronting marker.
  - There is no separate wounded marker; the bar is it.
  - There is no "+" for unspent points; the left column shows that for the selected party, and stage 06 may add it.
- **AS3.** "Deployed" means every party in the company, those at the encampment included, because every party stands on the map.
- **AS4.** The world-map figure stays dressed from the first member.
- **AS5.** The cloak is two sprites: a cape under the body and a collar over it. One over-layer could have painted the cape only outside the body's silhouette, but armour that widens the silhouette would then sit behind the cape, and the cape could not reach behind the legs.
- **AS6.** No fallback overlay for an item without one. It is unseen, and the coverage test keeps that from shipping.
- **AS7.** The cloak holds still through the walk (`rest = true`). A swaying cape is a later nicety.
- **AS8.** The body keeps the id `warrior`.

**Risks:**
- **Art fit.** The breastplate overlay must hide the tunic completely where it is meant to, and the cape must read at 1x on the map (`PARTY_SCALE`). The manual checks in section 7 cover this. If the cape is unreadable on the map, it can be cut back without code changes.
- **`sprite preview --on` draws the back layer on top.** The implementer must judge the cape in the game, not from that preview (section 4.3).
