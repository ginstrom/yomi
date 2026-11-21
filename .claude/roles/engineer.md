# Yomi notes for the engineer

- Read the skill files your task names before you start.
- `npm test` before every commit; `npm run test:browser` after a scene change.
- You may spawn `yomi-measure` and `yomi-asset-check` (this profile, with the orchestrator's brief, grants it) and no other agent. If a `yomi-measure` spawn is refused (agents created mid-session may not be listed yet), spawn a `general-purpose` agent briefed with the body of `.claude/agents/yomi-measure.md`.
- Search the CLAUDE.md files and `.claude/` for every renamed or deleted name.
- Record measurements in the plan's `log.md`.
- Checklist work (`.claude/skills/yomi-add-content/`): a "tests that catch a miss" line names only a test that really fails on the omission; otherwise it says "not enforced; check by hand".
- Editing the global skills: every file under `/Users/ryan/.claude/skills/` is a symlink into the dotfiles git repository (`/Users/ryan/personal/dotfiles/home/.claude/skills/`): edit the targets, and create a new file at the dotfiles path and link it. Record the change with `git -C /Users/ryan/personal/dotfiles diff`; leave committing that repository to the user.
