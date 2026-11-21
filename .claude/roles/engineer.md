# Yomi notes for the engineer

- Read the skill files your task names before you start.
- `npm test` before every commit; `npm run test:browser` after a scene change.
- You may spawn `yomi-measure` and `yomi-asset-check` (this profile, with the orchestrator's brief, grants it) and no other agent.
- Search the CLAUDE.md files and `.claude/` for every renamed or deleted name.
- Record measurements in the plan's `log.md`.
- Checklist work (`.claude/skills/yomi-add-content/`): a "tests that catch a miss" line names only a test that really fails on the omission; otherwise it says "not enforced; check by hand". Steps 03 and 04 of the modular-context plan each needed review fixes for this.
- Editing the global skills: they are symlinks into the dotfiles git repository (`/Users/ryan/personal/dotfiles/home/.claude/skills/`). Edit the targets, record the change with `git -C /Users/ryan/personal/dotfiles diff`, and leave committing that repository to the user.
