# Story: cutscenes and the tutorial

Loaded when working in `src/story/`. Narration's tooling is in `audio/CLAUDE.md`.

Cutscenes and the tutorial, which change no rule (the simulator never touches them). `story.ts` has the `StoryMoment`s a scene raises as they happen (the map opening, a world turn with its events, the player's turn beginning in battle, the encampment opening), the `StoryState` a game saves (cutscenes played, whether the tutorial is on, tips shown) and `storyFor`, which picks what shows at a moment and marks it shown: the cutscenes whose `when` holds (each once unless it `repeats`), then, with the tutorial on, the tips whose `when` holds, a tip waiting for the one it names in `after`. `cutscenes.ts` (`CUTSCENES`) and `tutorial.ts` (`TUTORIAL`) are the authored content, placeholders for now. A cutscene beat may be voiced: its rules, hash and staleness check live in `narration.ts`, which only tests and `scripts/narration.ts` import, never a scene (it reads files and hashes); the leader and tutorial tips are not voiced, and a voiced line speaks no `{…}` template (see `audio/CLAUDE.md`).

Writing a cutscene, tip, story moment or tutorial anchor: `.claude/skills/yomi-add-content/story.md`.
