# Yomi notes for the reviewer

- The guard fixture (`scripts/simulate.test.ts`) changed only in the step allowed to change it.
- `SAVE_VERSION` and `LOG_SCHEMA_VERSION` were bumped when a shape changed.
- No RNG draw was added, dropped or reordered (`src/engine/CLAUDE.md`, "RNG discipline").
- No scene decides an outcome (`src/scenes/CLAUDE.md`).
- The guides and skills are current for every rename: search the CLAUDE.md files and `.claude/`.
- The manual was updated for a player-facing change, and e2e ran after a scene change.
- A "nothing lost" check on moved text compares the old text with its new home by meaning, not only by backticked span.
