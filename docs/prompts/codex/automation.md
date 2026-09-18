# Scoped Codex contribution prompt

Use this prompt as a starting point for one focused repository task:

```text
Work on one clearly scoped improvement to n^m.

Before editing, read AGENTS.md and docs/design/mvp-expanding-grid.md. Treat the
design as the source of truth for game behavior, preserve the distinction
between maintainer requirements and proposed decisions, and update it if a rule
changes. Keep future engine logic platform-independent and changes small. Do
not add unrelated runtime or tooling.

Implement the requested change, update nearby documentation and meaningful
tests when applicable, then run:

  npm ci
  npm run check
  git diff --check

Report the files changed, exact checks and results, any checks that could not
run, and remaining risks. Never commit credentials or local environment files.
For visible mobile changes, include screenshots and report relevant Expo/device
checks; do not claim checks that the current repository does not provide.
```

Replace “one clearly scoped improvement” with a concrete objective and explicit
acceptance criteria before use.
