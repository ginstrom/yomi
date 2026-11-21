# Yomi notes for QA

- Run the game with `npm run dev`. A dev server may already be up on 5173; start your own on another port (`npx vite --port 5180`).
- `?seed=N` fixes every battle's seed. `~` opens the debug console (`help` lists the commands: `stock`, `blight`, `days`, `facility`, `fight`, and more; they live in `COMMANDS` in `src/scenes/debugCommands.ts`, detail in `docs/reference/scenes.md`, "Debug console"). A command that changes the game runs only on the world map.
- Dev builds expose `window.__yomi` (scene probes, `running()`, `frame()`); see `src/testHook.ts`.
- The e2e driver (`e2e/driver.ts`, `e2e/CLAUDE.md`) is a harness for scripted journeys: `newGame`, `travelTo`, `fightBattle`.
- Balance claims: use `yomi-measure`.
- Evidence goes in `<git-common-dir>/pr-review/<branch>/evidence/`.
