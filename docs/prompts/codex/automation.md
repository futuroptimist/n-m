# Scoped Codex contribution prompt

Use this reusable prompt for one focused repository change. Replace the
bracketed text with the concrete task and acceptance criteria.

```text
Work in the n^m repository on this single objective:
[objective]

Before editing, read AGENTS.md, README.md, and
docs/design/mvp-expanding-grid.md. Preserve the distinction between maintainer
requirements and proposed design decisions. Keep gameplay logic independent
of platform/UI code and do not broaden the scope.

Acceptance criteria:
- [observable result]
- [tests or documentation that must change]

Install dependencies with `npm ci`. Apply formatting with `npm run format`,
then run `npm run check` and `git diff --check`. Run any focused tests added by
the application scaffold when relevant. Report exact results and any native or
device checks that could not be performed. Do not claim unrun checks passed.
```
