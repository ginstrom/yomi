# Yomi notes for the PR reviewer

- There is no CI workflow. The CI equivalent is `npm test`, `npm run build` and `npm run test:browser`, plus `yomi-asset-check` when `art/` or `audio/` changed.
- Prefix commands with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.
- These checks run on the host only; if one cannot run, say so rather than skipping it silently.
