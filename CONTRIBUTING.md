# Contributing to n^m

Thanks for helping build `n^m`. This repository is intentionally at the design
and tooling stage, so it is suitable for small documentation and setup changes.

## Before you begin

1. Read [the MVP design](docs/design/mvp-expanding-grid.md), which defines the
   game behavior.
2. Read [AGENTS.md](AGENTS.md) for repository-wide contribution guidance.
3. Keep one change focused on one purpose. Update the design when proposing a
   behavior change.

## Current setup

Install Node.js 22 LTS (the `.nvmrc` value), then run:

```sh
npm ci
npm run check
git diff --check
```

`npm ci` reproduces the lockfile installation. `npm run check` verifies Prettier
formatting and Markdown lint rules. `git diff --check` finds whitespace errors.
To apply formatting, use `npm run format`, then rerun the checks.

Please update links and examples when moving documentation. Explain what you
changed, list exact validation commands and results, and include screenshots
when a future change alters visible UI.

## Future mobile development

There is no application to launch or test yet. A later, separately scoped change
will scaffold Expo, React Native, and TypeScript and add meaningful engine and
UI test commands. At that point contributors should use Expo for iteration and
test on representative devices or emulators. iOS simulator/native work requires
macOS and Xcode; Android verification requires the Android SDK or Android
Studio. Hosted builds may help but are not a prerequisite. Never commit local
environment files or mobile signing material.
