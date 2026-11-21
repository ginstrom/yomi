# Yomi notes for the PR reviewer

- There is no CI workflow. The CI equivalent is `npm test`, `npm run build` and `npm run test:browser`, plus `yomi-asset-check` when `art/` or `audio/` changed.
- Prefix commands with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.
- `make test` and `make test-browser` run them in podman; use `make test-browser` when Chromium is missing on the host. If a check cannot run, say so.
