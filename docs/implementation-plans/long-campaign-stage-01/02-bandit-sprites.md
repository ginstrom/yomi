# Step 02: Bandit sprites

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-01-foe-foundations-and-bandits.md) (§2, "Sprites")

## Objective

Five bandit unit sprites go into the atlas, one per `BanditKind`, each with `idle` and `walk` animations. When step 03 adds the bandit kinds to `UnitKind` and `FOE_XP`, the battle screen can then draw them and `unitLook.test.ts` passes.

## Requirements and context

- **The sprite names must be exactly the `BanditKind` values of contract C1**, because a unit is drawn as the atlas sprite named for its `UnitKind` (CLAUDE.md, "Assets and docs"):

  ```ts
  export type BanditKind = 'bandit_cutthroat' | 'bandit_archer' | 'bandit_brute' | 'bandit_mage' | 'bandit_captain'
  ```

- **Each sprite needs** an `idle` and a `walk` animation and a rest frame `idle_0`, in the same form as the existing unit sources in `art/units/*.sprite.toml` (for example `goblin.sprite.toml` and `hobgoblin.sprite.toml`). `unitLook.test.ts` checks that every key of `FOE_XP` has the atlas frame `<kind>/idle_0` and the animations `<kind>/idle` and `<kind>/walk`.
- **What the design asks:** each sprite is a human silhouette in a ragged palette distinct from the heroes, so a bandit is never mistaken for a party member. The heroes are the `warrior` body with gear laid over it.
- **The gear is drawn into each sprite.** Bandits are units of their own kind, not the `warrior` body with `GEAR_SPRITES` layers. Each role's gear must read at battle scale:

  | Sprite | Role | Must read as |
  | --- | --- | --- |
  | `bandit_cutthroat` | Cutthroat | light, hooded, a dagger |
  | `bandit_archer` | Archer | a bow, a quiver, light clothing |
  | `bandit_brute` | Brute | big frame, a battle axe, a breastplate |
  | `bandit_mage` | Hedge-Mage | robe or hood, a wand |
  | `bandit_captain` | Captain | a longsword, a shield, a breastplate, a mark of rank (a sash, plume or cloak) |

- **Where the sprites come from:** generated from text sources with sprite-tool. Never edit an exported PNG by hand: change the source and run `npm run sprites`.

## Dependencies and prerequisites

- **No step dependency.** This step may run in parallel with steps 01 and 06.
- **Existing tools and references:**
  - the `sprite` CLI (sprite-tool v0.7.0);
  - `npm run sprites`, which exports PNGs, the atlas (`atlas.png`, `atlas.json`, `atlas.anims.json`) and the manifest into `public/assets/sprites/`;
  - `art/CLAUDE.md` (the workflow; read it before drawing);
  - `docs/designs/sprite-drawing-guidance.md`.
- **Step 03 consumes this step's output:** the five atlas sprites by those exact names.

## Scope and implementation guidance

- **Add** `art/units/bandit_cutthroat.sprite.toml`, `bandit_archer.sprite.toml`, `bandit_brute.sprite.toml`, `bandit_mage.sprite.toml` and `bandit_captain.sprite.toml`. Match the existing units' canvas size, anchors (such as `chest`, if the existing units carry it), frame naming and animation lengths, so the battle screen's tweens and effect points work unchanged.
- **Give the five a shared bandit palette:** muted browns, dull reds, patched cloth. Vary it per role so they are told apart from one another and from goblins, hobgoblins and heroes.
- **Run `npm run sprites`.** Commit the sources and every exported file it changes in `public/assets/sprites/`.
- **Update `public/assets/sprites/README.md`** (provenance and licence) with a row or entry for the five new sprites, in the form of the existing entries.
- **Delegation:** the drawing may be handed to a subagent. Under CLAUDE.md's "Subagents" guidance, drawing that needs judgement inherits the session's model. A mechanical re-export or README row may use `model: "sonnet"`.
- **Out of scope:** any code change (`UnitKind`, `FOE_XP` and the encounter are step 03), new effects, and gear sprites in `art/gear/`.

## Verification

1. **The atlas carries the frames and animations.** From the repo root, for example:

   ```sh
   node -e '
   const atlas = require("./public/assets/sprites/atlas.json");
   const anims = require("./public/assets/sprites/atlas.anims.json");
   const keys = new Set(anims.anims.map((a) => a.key));
   const frames = atlas.frames ?? Object.fromEntries((atlas.textures ?? []).flatMap((t) => t.frames.map((f) => [f.filename, f])));
   for (const k of ["bandit_cutthroat","bandit_archer","bandit_brute","bandit_mage","bandit_captain"]) {
     console.log(k, Boolean(frames[`${k}/idle_0`]), keys.has(`${k}/idle`), keys.has(`${k}/walk`));
   }'
   ```

   Every line must print `true true true`. Adjust the frame lookup to the atlas JSON's actual shape if it differs.
2. **Look at each sprite's preview** (the exported PNGs, or the previews sprite-tool writes). Check that the role reads at a glance, the silhouette is human, and nothing is mistaken for a hero, goblin or hobgoblin.
3. **`make test` passes.** `unitLook.test.ts` does not require these sprites yet; that starts when step 03 adds the bandit kinds to `FOE_XP`. This step must not break any existing atlas test.

## Completion criteria

- [ ] Five sources in `art/units/`, exported with `npm run sprites`, and no PNG edited by hand.
- [ ] The atlas check prints `true true true` for all five.
- [ ] The previews reviewed.
- [ ] `public/assets/sprites/README.md` updated.
- [ ] `make test` passes.
- [ ] Committed once tests pass, on the current branch, without pushing. The message ends with the repo's `Co-Authored-By` attribution line.
- [ ] The index's step 02 row set to `done`, with a completion note here: the commit, the checks run.

## Completion note

- **Status:** done, in the commit "Step 02: bandit sprites" (the commit that carries this note).
- **Built:** five sources in `art/units/`, `bandit_cutthroat`, `bandit_archer`, `bandit_brute`, `bandit_mage` and `bandit_captain`, drawn as whole-frame runs with `outline = "auto"` on the `unit` canvas. Each has a `chest` point, `idle_0`/`idle_1` (`idle_1` moves the rows above the shins a pixel down: rows 0 to 24, the mage's robe 0 to 26) and `walk_0` to `walk_2` with `[anim.idle]` (600 ms) and `[anim.walk]` (`walk_0, walk_1, walk_0, walk_2`, 140 ms), as the warrior's. The gear is drawn in:
  - Cutthroat: a dark hood, a red scarf over the mouth, a patched leather jerkin, a dagger held up;
  - Archer: bareheaded with a red headband, a light tan tunic, a quiver of red-fletched arrows over the shoulder, a bow (its string `unoutlined`, as `gear_bow`'s);
  - Brute: a big bald, bearded man with bare arms, a rust-flecked steel breastplate, red breeches, a double-bladed battle axe held upright;
  - Hedge-Mage: a patched dull-red hooded robe and a white beard, a wand tipped with a gold spark;
  - Captain: a wide-brimmed hat with a red plume, a dark cloak, a steel breastplate with a red sash across it, a round oak shield with a red band, a longsword held upright.
- **Exported** with `npm run sprites` (68 sprites, 152 frames); no PNG edited by hand. The atlas, its animations, `sprites.json`, the manifest and the loose PNGs are committed. `public/assets/sprites/README.md` has a row for the five.
- **Verification:**
  - `sprite check --project art`: ok, 68 sprites, 152 frames. `npm run sprites:check`: up to date.
  - The atlas check prints `true true true` for all five; each `idle_0` carries its `chest` point (`points` in `atlas.json`).
  - Previews reviewed (`sprite preview` of the five, every frame, beside `warrior`, `goblin`, `hobgoblin`, `shaman` and `kobold`): each is a human silhouette in browns, dull reds and rusted steel, its role read from its weapon and dress, none in the heroes' steel limbs, horned helm and red tabard, and none green-skinned. The captain's hat was redrawn once, as a crown over a wide brim, after the first preview read as a lump.
  - `make test`: 63 files, 713 tests passed.
- **For step 03:** the sprite names are exactly the `BanditKind` values of C1. No code was changed.
- **Deviations:** none.
