# Step 11: Measure, document, play

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-06-multiple-parties.md) (§6 Verification, §7 Risks) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard", "Docs", "Gameplay verification")

**Difficulty:** sonnet / opus. The engineer runs the simulator, writes documentation and walks the play script in a browser: routine but broad, so `model: "sonnet"`. The reviewer is opus (model unset), because it judges whether the docs are true to the code, whether the figures support the claims and whether the play script was really walked.

## 1. Objective

Close the stage:
- measure the early-game guard (`--parties 1`) against step 01's baseline, and how often the default company reaches hall level 4;
- run the company comparison (`--ready-level 10`, `--parties 1` against the default) the design asks for (A12);
- bring CLAUDE.md, the manual and its screenshots, the stage design, the stages index and the two older designs the stage answers up to date;
- walk the design's play script in the real game and record what was seen.

## 2. Requirements and context

- **Design §6, simulator checks:**
  1. *The early-game guard.* Hall level 4 should rarely be reached by level 7, so the figure barely moves. Record how often it is.
  2. *A run with `--ready-level 10`* (the stand-in for a longer campaign on today's map), compared with `--parties 1`. The company should show promotions, guard battles and fewer vanguard walking days.
- **Design §7 risks:** note in the stage's implementation notes how the battles' player time feels, to settle auto-resolve (the stages index's open question, "Revisit after playing it").
- **Done when** (design): all tests pass, the guard holds, the company comparison shows its value, and the play script has been walked.
- **Decisions from the index this step documents** (unchanged): 1 (`--parties` default 3; guard and early figure with `--parties 1`), 2 (the simulator's hall cap `HALL_FOR_PARTIES = [3, 4, 5]`), 3 (reserves ≤ `MAX_RESERVES`, company ≤ `companyLimit` 7, 8, 9, 14, 18), 4 (ids `party_1`–`party_3`, default names, renames, "Your party" while one party), 5 (home, garrison, meet), 6 (stopping short), 7 (wipes; a last party wiped with reserves left re-forms at the encampment; a debug fight's baggage is lost), 8 (the `Exchange` scene), 9 (the encampment's acting party; Guild Hall columns), 10 (the party bar and banners), 11 (map clicks: meet by clicking another party's hex; Home, Garrison, Exchange buttons; only the selected party's walk animated), 12 (interrupts and refusals name the party; `blockingParty` focus; one `partyNoun`), 13 (`campDays` counts days any party camped), 14 (`SAVE_VERSION` 22, migrating from 18; 20 and 21 unreadable), 15 (`LOG_SCHEMA_VERSION` 24, meta `party` and `role`), 16 (the guard policy), 17 (debug `hp`), 18 (out of scope, with reasons).
- **Contracts this step documents** (C1–C8 of the index, as built by steps 01–10):
  - **C1:** `startTravel` (`TravelStart`), `orderAction` in `company.ts`; the simulator's acts and field crafts as day orders; `CampaignRun.vanguard`.
  - **C2:** `SavedBattle.party`; a load fights the saved party.
  - **C3:** `Order` (idle, travel, home, camp, garrison, meet, day), `OrderRequest`, `PartyEvent` with `met`, `MAX_PARTIES`, `PARTY_NAMES`, `partyId`, `partyNoun`, `blockingParty`.
  - **C4:** `GUILD_HALL_LEVELS` with `parties` and `company`; `maxParties`, `companyLimit`, `recruitLevel(game)` = the hall's level, `homeParties`, `homeParty`; `formParty`, `renameParty`, `disband`, `moveHero` (`HeroRef`).
  - **C5:** `exchange` (`ExchangeMove`), `wipeParty` (`Wipe`), `heroesLeft`.
  - **C6:** the party bar's banners, every party on the map, `WorldProbe.parties`, buttons `home`, `garrison`, `exchange`.
  - **C7:** `camp_guild_hall/level_4`, `level_5`; the banner sprites (`BANNER_SPRITES`).
  - **C8:** `--parties`, `Role`, the record's `roles`, `wipes`, `promotions`, `vanguardWalkHomeDays`, `guardBattles`; `fallen` means no hero is left.
- **Shared constraints (from the index):**
  - **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
    - `npm test` (`tsc && vitest run`) is the gate before the commit;
    - `npm run test:browser` after any scene change (read `e2e/CLAUDE.md`);
    - `npm run manual:screenshots` retakes the manual's screenshots;
    - `npm run simulate -- <flags>`: give each run its own `--out` under `logs/` (gitignored, never committed). Never run two `make simulate` at once. A 500-campaign run takes about a minute and writes some 70 MB (company runs may take longer).
  - **The refactor guard.** The fixture in `scripts/simulate.test.ts` was re-recorded once, by step 09, with `--parties 1`. This step does not edit it; if it fails, an earlier step broke it: report, do not re-fixture.
  - **The early-game figure** was 230 of 500 from seed 1 after stage 5; step 01 re-measured it before any change. A move of more than 5 points must be explained in the commit and in CLAUDE.md's rules of scaling (or retuned away, which is not this step's job: report it).
  - **This step changes no rule.** If a measurement looks wrong (for example, the company does worse than one party for a reason that looks like a bug), stop and report it rather than tuning.
  - **Commits.** One commit on `long-campaign-stage-06`, message "Stage 6 step 11: measure, document, play", without pushing. Never switch branches. No attribution lines.
  - **Docs.** CLAUDE.md must stay current ("Keeping this file current"); search it for every name the stage renamed or removed.

## 3. Dependencies and prerequisites

- **Steps 08 and 10 are done** (and through them 01–07 and 09): the Guild Hall columns and `Exchange` scene exist; the simulator plays a company, `--parties` defaults to 3.
- **From step 01's execution record:** the baseline 500-campaign summary (the 230 figure) and log hash, and the 50-campaign summary and hash.
- **From step 04's execution record:** the 50-campaign diff its recruit rule made, if any.
- **From step 09's execution record:** the re-recorded fixture and the `--parties 1` 50-campaign summary.
- **From step 06's execution record:** the banner sprites' names.
- **Environment:** Node 26, Playwright's Chromium, a dev server (`npm run dev`, http://localhost:5173) for the play script.

## 4. Scope and guidance

### 4.1 Measure

Run each from seed 1, each with its own `--out`; keep each printed summary in the execution record (in full for the first, the lines that matter for the rest).

1. **The early-game guard** (`--parties 1`):

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --parties 1 --out logs/s6-guard.jsonl > logs/s6-guard.txt
   ```

   Compare with step 01's baseline: Source share, days, battles, heroes dead. Expected to be within a point or two (only step 04's recruit rule can move it). Over 5 points: explain it in CLAUDE.md's rules of scaling and the commit, and report it.
2. **The default company at the early ready level** (`--parties` default 3, `--ready-level 7`):

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --out logs/s6-company-7.jsonl > logs/s6-company-7.txt
   ```

   Record the Source share and how often hall level 4 (and 5) is reached by the end (the record's `hallLevel`; if the summary does not print a distribution, count it from the records or add a line to the summary, which is not a rule change). Also guard battles, promotions and wipes.
3. **The company comparison** (`--ready-level 10`):

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --ready-level 10 --parties 1 --out logs/s6-solo-10.jsonl > logs/s6-solo-10.txt
   npm run simulate -- --campaign --battles 500 --seed 1 --ready-level 10 --out logs/s6-company-10.jsonl > logs/s6-company-10.txt
   ```

   Compare side by side: the Source share, days, battles, `promotions`, `guardBattles`, `vanguardWalkHomeDays`, wipes, per-role battles and levels at the end, heroes dead. A12 expects promotions and guard battles in the company run and fewer vanguard walking days than with one party. If it does not show that, report it with the figures (the policy is step 10's; this step does not tune it).
4. **The guard test and suites:** `npm test`, `npm run test:browser`, `npm run build`, `npm run sprites:check`.

### 4.2 Document

- **CLAUDE.md** (a full pass over the stage's names; fix what is stale, add what is missing, keep each module to a line or two):
  - **Architecture:** `company.ts` (orders home, garrison and meet; `met`; stopping short; `startTravel`, `orderAction`; `formParty`, `renameParty`, `disband`, `moveHero`, `exchange`, `wipeParty`, `heroesLeft`, `partyNoun`, `blockingParty`); `guildHall.ts` (levels 1–5, `parties`, `company`, `maxParties`, `companyLimit`, `recruitLevel` = the hall's level, `homeParty`); `expedition.ts` (the seven order kinds, `MAX_PARTIES`, `PARTY_NAMES`, ids by lowest free number); `gameState.ts` (parties no longer "one today"); `save.ts` (`SavedBattle.party`, version 22).
  - **Scene layer:** the `Exchange` scene and how it is reached (character panel and footer, decision 8); the Guild Hall's columns, Form party, Rename, Disband; the acting party at the encampment (decision 9); the party bar's banners, every party drawn, meet by clicking another party's hex, Home, Garrison, Exchange buttons, interrupt and refusal focus (decisions 10–12); `BattleScene`'s defeat when other heroes live; `BANNER_SPRITES` and the guild hall's level frames under Assets.
  - **Rules of the world map:** the orders and where each may be given; stopping short; garrisons hold a site by the existing neutral-hex rule; exchange on a shared hex.
  - **Rules of progression / permadeath:** a wiped party is gone, its heroes' gear and baggage left as the location's loot; the game is lost only when the encampment falls or no hero is left; the last party wiped with reserves left re-forms at the encampment; recruits join at the hall's level (replacing "the hall's level or the party's lowest").
  - **Rules of saving:** version 22, 18 migrating, 20 and 21 unreadable.
  - **Commands:** `--parties` among the simulator's flags; the campaign description's company (roles, guard targets, promotions) and the new record lines; `fallen` meaning no hero is left; `LOG_SCHEMA_VERSION` 24 meta.
  - **Debug console:** `hp`; `facility guild_hall` up to 5.
  - **Rules of scaling:** the stage's figures (guard, hall-4 frequency, the comparison), in the paragraph's style.
- **The manual** (`docs/manual/README.md`): check that steps 07 and 08 described the party bar, orders, meeting, exchange, garrisons, the guild hall's columns and upper levels, wipes and the loss condition; fix what is missing or untrue.
- **Screenshots:** `npm run manual:screenshots`. Add shots, in `e2e/manual.shots.ts`, for the party bar with two parties on the map and the Guild Hall's columns, if the shots' setup (debug console or probes) can reach them; otherwise say why in the execution record. View every changed image and keep only those whose change is real (not an animation frame). Reference the new images from the manual.
- **The stage design** (`stage-06-multiple-parties.md`): add "Implementation notes": the figures of §4.1, the decisions that differ from the design (the index's 1–18, briefly), the hazards deferred, and how the battles' player time felt in the play script (for auto-resolve). Set its status to done.
- **The stages index** (`docs/designs/long-campaign/index.md`): stage 6's row gets its status line in the style of stages 1–5, and the guard sentence under "Conventions" gains stage 6's figure; the auto-resolve open question records what the play suggested.
- **Older designs:** mark `docs/designs/blight.md` §5.4 and `docs/designs/guild-hall-and-watchtowers.md` (its non-goals on several parties, §8.2 and §8.3) as answered by stage 6, with a link.

### 4.3 Play script (design §6)

Run `npm run dev`; drive the game in a browser (the `run` skill or the browser tools; headless Chromium is fine). Record for each item what was done and what was seen, with screenshots kept outside the repository (scratch directory) and named in the record.

1. `facility guild_hall 4`, `stock gold 500`, recruit three heroes at the guild hall: they join at level 4. Form a Second Company with them and one veteran.
2. Send both parties out. Use Until something happens and see interrupts focus each party in turn (message prefixed with the party's name). Try to advance while one party confronts monsters: refused, and the map selects that party.
3. Garrison the Second Company on a threatened held site; `days 30`; the site does not fall.
4. Let the First Company take a death (`hp 1 <member> @first`, then a fight). Send the Second Company to meet it (click the First's hex), and exchange a hero and an item in the `Exchange` scene.
5. Lose the Second Company in a hard fight on purpose: `goto <the troll lair's id> @second` (`locations all` lists ids), then Attack (a debug `fight` has no location, so its baggage would be lost, decision 7). See the defeat screen name the baggage left at the lair, the game going on, and the lair's loot holding it (debug `locations` or a later win).
6. Save and reload (menu Load) with two parties in the field and one confronting: both stand where they were, with their orders, and the confronting one still confronts.

Also note how many battles the walk asked for and how the second party's battles felt to play (for auto-resolve).

## 5. Verification

- The four simulator runs' summaries recorded; the guard figure within 5 points of step 01's or explained.
- `npm test`, `npm run test:browser`, `npm run build`, `npm run sprites:check` pass; outputs recorded.
- CLAUDE.md searched for every renamed or removed name of the stage (`recruitLevel(game, party)`, "one today", "a wipe ends the game", `MAX_GUILD_HALL_LEVEL` at 3, "the party has fallen", …) with none stale.
- The manual's images referenced exist; changed images viewed.
- The play script's six items walked, each with what was seen.

## 6. Completion criteria

- [ ] Figures of §4.1 in the execution record and in the stage design's implementation notes and CLAUDE.md's rules of scaling.
- [ ] CLAUDE.md, the manual and its screenshots current.
- [ ] The stage design marked done with implementation notes (including player time / auto-resolve); the stages index's status line and guard sentence updated; blight.md §5.4 and guild-hall-and-watchtowers.md marked answered.
- [ ] Play script walked and recorded.
- [ ] All suites pass; one commit; the index's step 11 row updated with status and commit.

## 7. Execution record

