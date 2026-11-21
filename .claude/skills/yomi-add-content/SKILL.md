---
name: yomi-add-content
description: Every place to touch when adding or renaming Yomi content (spell, status, ability, trait, element, skill node, foe, encounter, facility, item, rune, icon, location, portrait, banner, day action, battle event, debug command, story). Use before adding one.
---

# Adding content

Open the file for your case, touch every item in it, then run `npm test`. Each file lists every place across all directories, so you need not read the guides to find them.

| File | Content type |
| --- | --- |
| [spell.md](spell.md) | a spell (hero or monster) |
| [status.md](status.md) | a status |
| [ability.md](ability.md) | a monster ability or hero technique |
| [trait.md](trait.md) | a trait |
| [element.md](element.md) | an element |
| [skill-node.md](skill-node.md) | a perk node of the trees |
| [battle-event.md](battle-event.md) | a new event kind or a changed event shape |
| (no file) | a sound effect: `audio/CLAUDE.md`, "Which sound plays when" |

## General rules

- A full `Record` makes `tsc` ask for an entry; follow its errors.
- Coverage tests enforce some lists: `src/scenes/sounds.test.ts`, `src/scenes/unitLook.test.ts` and the yardstick test in `src/game/encounters.test.ts`.
- Run `npm run test:browser` after touching a scene.
- Anything that moves an outcome goes through `yomi-balance` (`.claude/skills/yomi-balance/`).
- Sprites go through `art/CLAUDE.md` (`yomi-sprites` from stage 4), and sounds through `audio/CLAUDE.md` (`yomi-sound` from stage 4).
- A renamed name gets a search of the CLAUDE.md files and `.claude/`.
