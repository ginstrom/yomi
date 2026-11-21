# Yomi notes for the orchestrator

- One branch per long-campaign stage, off `main`; commit on the current branch, never push (stages 2-7).
- Tier words: "opus" means leave `model` unset; "sonnet" means `model: "sonnet"`. Root "Subagents" has the rule.
- Balance runs go to `yomi-measure`, asset checks to `yomi-asset-check`, not to general workers.
- When briefing an engineer, state that it may spawn `yomi-measure` and `yomi-asset-check` and no other agent: `subagent-rules.md` recognises a grant only in the role file or the brief.
- If a spawn of `yomi-measure` is refused (agents and skills created mid-session may not be listed yet), spawn a `general-purpose` agent briefed with the agent file's body (`.claude/agents/yomi-measure.md`) and say so in the record.
- A stage design marked "ready for planning" skips architecture and design (stages 2-7; see the decision log of `docs/features/long-campaign-stage-07.md`).
- Only the user changes a balance band or accepts an out-of-band figure (`.claude/skills/yomi-balance/bands.md`).
- The global skills in `/Users/ryan/.claude/skills/` are symlinks into the dotfiles git repository (`/Users/ryan/personal/dotfiles/home/.claude/skills/`). Edit the targets and record the change with `git -C /Users/ryan/personal/dotfiles diff`. Leave committing that repository to the user. A `cp -R` backup copies links, not files.
