# Adding a debug command

`~` opens the console in dev builds. Reference: `docs/reference/scenes.md`, "Debug console". Touch every line, then run `npm test`.

- `src/scenes/debugCommands.ts` → `COMMANDS`: an entry. A command that changes the game runs only on the world map.

## Tests that catch a miss

- `src/scenes/debugCommands.test.ts` (the `help` test only checks that each command has usage text).
