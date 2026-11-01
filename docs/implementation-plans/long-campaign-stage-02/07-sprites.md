# Step 07: Spider and Salamander sprites

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-02-special-attacks-and-elements.md) (§2, the new kinds; stages index, "Sprites")

**Difficulty:** art judgement. Drawing needs the session's model (CLAUDE.md, "Subagents": drawing that needs judgement inherits the session's model); a mechanical re-export or README row may use `model: "sonnet"`.

## Objective

Two unit sprites go into the atlas, `giant_spider` and `salamander`, each with `idle` and `walk` animations and a `chest` point. When step 08 adds the two kinds to `MonsterKind` and `FOE_XP`, the battle screen draws them and `unitLook.test.ts` passes. The stages index says a stage is not done while a unit falls back to a placeholder, so these must be finished drawings.

## Requirements and context

- **The sprite names must be exactly the new `MonsterKind` values of contract C7**, because a unit is drawn as the atlas sprite named for its `UnitKind` (CLAUDE.md, "Assets and docs"):

  ```ts
  // src/game/encounters.ts (step 08)
  export type MonsterKind = /* existing */ | 'giant_spider' | 'salamander'
  ```

- **Each sprite needs** a rest frame `idle_0`, an `idle` animation (`idle_0`, `idle_1`) and a `walk` animation (`walk_0`, `walk_1`, `walk_0`, `walk_2`), and a `[points] chest`, in the form of the existing units in `art/units/*.sprite.toml` (for example `troll.sprite.toml`, a hunched non-human body, and `goblin.sprite.toml`). `unitLook.test.ts` checks that every key of `FOE_XP` has the atlas frame `<kind>/idle_0` and the animations `<kind>/idle` and `<kind>/walk`. The `chest` point is where shots, spells and the new area effects are aimed and fly from.
- **What each must read as, at battle scale** (the `unit` canvas, 32px, shown at 3x; creature size is drawn into the sprite):

  | Sprite | Kind (C7) | Must read as |
  | --- | --- | --- |
  | `giant_spider` | Giant Spider, native level 4, an ambusher that webs from range and bites twice, the second bite poisoning | a large, low, eight-legged spider, dark body, a pale or venom-green mark, fangs; wide rather than tall; told apart from every other unit at a glance |
  | `salamander` | Salamander, native level 5, fire ward 99, spits a cone of fire | a long, low lizard of red and orange scales with a glowing or flame-licked back or tail and a wide mouth; reads as a fire creature, not a goblin, kobold or troll |

- **Not humanoid.** These bodies are not the `warrior` layering scheme: no `GEAR_SPRITES`, no `grip` point. The walk's four beats move the legs; for a spider, alternate leg pairs; for a salamander, the splayed legs and a tail sway. `idle_1` still moves the body a pixel (derived with `move`, as `units/shaman` and `units/warrior` do, over the rows that suit the body).
- **Where the sprites come from:** text sources with sprite-tool. Never edit an exported PNG by hand: change the source and run `npm run sprites`. Draw as whole-frame runs or grids with `outline = "auto"`, and never generate a grid with a script ([`docs/designs/sprite-drawing-guidance.md`](../../designs/sprite-drawing-guidance.md) R1; `art/CLAUDE.md`). Put `[points]` below the top-level `outline = "auto"`, or TOML reads `outline` as a point.

## Dependencies and prerequisites

- **No step dependency.** This step may run at any time, in parallel with steps 02 to 06. It touches only `art/` and `public/assets/sprites/`.
- **Existing tools and references:**
  - the `sprite` CLI, installed on the host (not in the podman image); run `sprite guide --project art` first: it prints the file format, the palette and the canvas classes;
  - `art/CLAUDE.md` (the workflow, the loop, the unit animations; read it before drawing);
  - `docs/designs/sprite-drawing-guidance.md` (runs and `outline = "auto"`, no generator scripts);
  - `art/palette.toml`, shared by every sprite (a muted Baldur's Gate-style palette);
  - `npm run sprites`, which exports the loose PNGs, `sprites.json`, the atlas (`atlas.png`, `atlas.json`, `atlas.anims.json`) and `.sprite-tool-manifest.json` into `public/assets/sprites/`.
- **Step 08 consumes this step's output:** the two atlas sprites by those exact names. Step 08 must not add the kinds to `FOE_XP` until this step is committed.

## Scope and implementation guidance

- **Add** `art/units/giant_spider.sprite.toml` and `art/units/salamander.sprite.toml`, created with `sprite new giant_spider --canvas unit --project art --dir units` (and the same for `salamander`), or with `--runs`. Match the existing units' frame names, animation timings (`[anim.idle]` 600 ms, `[anim.walk]` 140 ms, as the warrior's and the bandits') and the `chest` point.
- **The loop** (from `art/CLAUDE.md`): `sprite check --project art` until it prints `ok`; `sprite show <id> --project art` to read the result as text, outline included; `sprite preview <id> --grid --project art` for the colours, looking at the PNG it names (and `--points` to see the `chest`); `sprite show <id> --frame <name> --diff` for a derived frame; then `npm run sprites`.
- **Commit** the sources and everything the build writes in `public/assets/sprites/`, `.sprite-tool-manifest.json` included.
- **Update `public/assets/sprites/README.md`** (provenance and licence) with a row or entry for the two sprites, in the form of the existing entries.
- **Delegation:** the drawing may be handed to a subagent (session model); see the difficulty note.
- **Out of scope:** any code change (`MonsterKind`, `FOE_XP`, the stat blocks and the encounters are step 08); new battle effects (`art/effects/`; the area effects reuse the existing `fx_burst` and drawn shapes in step 06); a map sprite (monster locations use `map_monsters`).

## Verification

1. **The atlas carries the frames and animations.** From the repo root, for example:

   ```sh
   node -e '
   const atlas = require("./public/assets/sprites/atlas.json");
   const anims = require("./public/assets/sprites/atlas.anims.json");
   const keys = new Set(anims.anims.map((a) => a.key));
   const frames = atlas.frames ?? Object.fromEntries((atlas.textures ?? []).flatMap((t) => t.frames.map((f) => [f.filename, f])));
   for (const k of ["giant_spider","salamander"]) {
     console.log(k, Boolean(frames[`${k}/idle_0`]), keys.has(`${k}/idle`), keys.has(`${k}/walk`));
   }'
   ```

   Both lines must print `true true true`. Adjust the frame lookup to the atlas JSON's actual shape if it differs. Check also that each `idle_0` carries its `chest` point in `atlas.json`.
2. **Look at each sprite's preview** (`sprite preview <id> --grid --project art`, every frame), beside `troll`, `kobold` and `goblin`: the spider reads as a spider and the salamander as a fire lizard at a glance, neither is mistaken for another unit, and the walk reads as legs moving.
3. **`sprite check --project art`** prints `ok`, and **`npm run sprites:check`** says the exports are up to date.
4. **`make test` passes.** `unitLook.test.ts` does not require these sprites yet; that starts when step 08 adds the kinds to `FOE_XP`. This step must not break any existing atlas test.

## Completion criteria

- [ ] Two sources in `art/units/`, exported with `npm run sprites`, and no PNG edited by hand.
- [ ] The atlas check prints `true true true` for both, each with a `chest` point.
- [ ] The previews reviewed; no placeholder.
- [ ] `public/assets/sprites/README.md` updated.
- [ ] `sprite check` ok, `npm run sprites:check` up to date, `make test` passes.
- [ ] Committed once tests pass, on the current branch, without pushing. The message ends with the repo's `Co-Authored-By` attribution line.
- [ ] The index's step 07 row set to `done` with the commit, and the execution record below filled in.

## Execution record

- **Drawn** (as whole-frame runs, `outline = "auto"`, no generator script), by the session model:
  - `art/units/giant_spider.sprite.toml`: a dark brown body, a bulging abdomen with a moss-green hourglass mark, red eyes and bone fangs; eight legs, the four near ones tan with high knees (a front and a back arch, two low legs), the four far ones dark brown. Wide and low: columns 1 to 30, knees at row 8, body rows 14 to 24. `chest = [18, 20]` (the cephalothorax). `idle_1` moves rows 0 to 26 down a pixel, so the body sinks and the knees bend while the feet stay; `walk_1` and `walk_2` lift alternate sets of four feet (near back and front-low with far back-low and front, then the others).
  - `art/units/salamander.sprite.toml`: a long, low, splay-legged lizard of red scales (`R` spine, `r` sides) and a rust-orange belly, four tongues of flame (`o`, `y`, `Y`) along its spine, a flame-tipped tail curled up behind, and a wide mouth line with a gold glow in the jaw. `chest = [15, 20]`. `idle_1` moves rows 0 to 25 down a pixel (everything above the feet); `walk_1` and `walk_2` lift the diagonal pairs in turn (near back with far front, then near front with far back), and the tail tip sways forward a pixel on each lift.
  - Timings as the bandits': `idle` 600 ms, `walk` 140 ms (`walk_0`, `walk_1`, `walk_0`, `walk_2`). `walk_0` is `idle_0` unchanged for both (neither body has a "legs apart" stance distinct from its rest).
- **Verification:**
  - `sprite check --project art`: `ok: 74 sprites, 170 frames`.
  - `npm run sprites`: `built: 74 sprites, 170 frames, 2 targets`; `npm run sprites:check`: `up to date`.
  - Atlas check (the task's script, with `atlas.frames` an object keyed by name): `giant_spider true true true` and `salamander true true true`; `atlas.frames["giant_spider/idle_0"].points` is `{"chest":[18.5,20.5]}` and the salamander's `{"chest":[15.5,20.5]}` (each sinking a pixel in `idle_1`).
  - Previews (`sprite preview ... --anim walk|idle`, `--points`, and the exported `idle_0` at 3x over the battle board's slate and taupe floor beside `troll`, `kobold` and `goblin`): the spider reads as a spider and the salamander as a fire lizard at a glance; neither resembles another unit (the salamander shares the kobold's reds but is a horizontal quadruped with a flame crest).
  - `make test`: 71 files, 956 tests passed.
- **Deviations:** none. No code change; `unitLook.test.ts` starts requiring the two sprites when step 08 adds the kinds to `FOE_XP`.
- **For step 08:** the atlas sprites are `giant_spider` and `salamander`, each with `idle_0`, `idle`, `walk` and a `chest` point.
