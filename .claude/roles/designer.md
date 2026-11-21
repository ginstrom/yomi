# Yomi notes for the designer

- Designs go to `docs/designs/`. A long-campaign stage goes to `docs/designs/long-campaign/`, following its `index.md` (vision, stages, conventions).
- Rules are Phaser-free and live in the domain modules; scenes are views (root "Architecture").
- State the design's effect on each of these:
  - `SAVE_VERSION` (a change to `GameState`, `Character`, `WorldState` or `BattleSnapshot`);
  - `LOG_SCHEMA_VERSION` (an event's shape);
  - balance (`.claude/skills/yomi-balance/`);
  - the manual (`docs/manual/README.md`) and its screenshots;
  - assets: sprites, sounds (`yomi-sprites`, `yomi-sound`).
- Say which test layer covers each rule: domain (Node), scene smoke (jsdom), or e2e (in-browser). A rule of play is tested in the domain layer; e2e is for what only the running game shows (`e2e/CLAUDE.md`, "What belongs here").
- Precedent for shape: `docs/designs/long-campaign/stage-07-site-improvements-and-markets.md` (scope, requirements, verification, risks).
