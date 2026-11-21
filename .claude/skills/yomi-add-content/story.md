# Adding a cutscene, tip, story moment or tutorial anchor

Touch every line, then run `npm test`. The modules and `storyFor`'s order stay in `src/story/CLAUDE.md`.

- `src/story/cutscenes.ts` → `CUTSCENES`: an entry (beats of text, a speaker, a portrait, a backdrop loaded from `public/assets/cutscenes/<name>.png`).
- `src/story/tutorial.ts` → `TUTORIAL`: a tip, in order, maybe pointing at a `TutorialAnchor`.
- Text may say `{encampment}` and `{leader}` (`fillText`).
- A new moment: a case in `StoryMoment` (`src/story/story.ts`) and a scene that raises it.
- A new anchor: a name in `TutorialAnchor` and a place in the `anchors()` of the scene that has the control.
- A voiced beat's fields (`line`, `voice`, `emotion`, `intensity`, `spoken`, `take`): `audio/CLAUDE.md`, "Narration". The leader and the tutorial tips are not voiced, and a voiced line speaks no `{…}` template.

## Tests that catch a miss

- `src/story/story.test.ts` and `src/story/narration.test.ts`.
- A backdrop file or a scene that raises a new moment: not enforced; check by hand.
