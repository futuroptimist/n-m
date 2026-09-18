# Scoped Codex contribution prompt

Use this prompt as a starting point and replace the bracketed request with one
specific, reviewable objective:

```text
Work in the n^m repository on this objective only: [objective and acceptance
criteria].

Before editing, inspect AGENTS.md and the relevant files. Treat
docs/design/mvp-expanding-grid.md as the source of truth for game behavior, and
update it if the requested behavior changes. Preserve unrelated work and keep
platform-independent engine logic separate from mobile UI and services.

Make the smallest complete change. Add deterministic tests for engine behavior
when an engine exists; do not add placeholder checks. Run npm ci,
npm run check, and git diff --check. Report exact results and any checks that
could not run. Summarize the focused diff and remaining risks.
```
