# Codex contribution prompt

Use this prompt as a starting point for a focused repository task. Replace the
bracketed text with one concrete objective.

```text
Contribute a small, reviewable change to n^m.

Objective: [state one specific outcome]

Before editing, inspect the repository and follow AGENTS.md. Treat
docs/design/mvp-expanding-grid.md as the source of truth for gameplay. Keep the
pure game engine separate from UI and platform code, and update the design when
a requested rule changes.

Stay within the objective, preserve unrelated changes, and do not add secrets
or mobile signing material. Add deterministic behavioral tests if engine
behavior is introduced or changed. Keep documentation and commands accurate.

Run npm ci, npm run check, and git diff --check. Report each command's actual
result and clearly identify any device, native-toolchain, or environment check
that could not run. Summarize the change and any remaining risks.
```
