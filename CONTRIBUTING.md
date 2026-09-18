# Contributing to n^m

Thanks for helping build `n^m`. First-time mobile contributors are welcome.

## Before you begin

1. Read the [MVP expanding-grid design](docs/design/mvp-expanding-grid.md).
2. Check [AGENTS.md](AGENTS.md) for repository-wide contribution guidance.
3. Keep each change focused. Discuss rule changes in the design instead of
   allowing implementation details to become undocumented rules.

## Current setup

This repository currently has documentation and quality tooling, but no Expo
application. Install Node.js 22 LTS and use the npm version it provides:

```sh
git clone https://github.com/futuroptimist/n-m.git
cd n-m
npm ci
```

Use the lockfile rather than replacing it with another package manager's
lockfile.

## Make and validate a change

```sh
npm run format
npm run check
git diff --check
```

- `format` applies Prettier to supported documentation and configuration.
- `check` verifies formatting and lints Markdown.
- `git diff --check` reports whitespace errors.

Review the diff for accidental credentials and update links or navigation when
files move. In a pull request, explain the purpose, changes, and exact checks
run. Include screenshots for future visible UI changes.

## Future mobile development

After the Expo app is introduced, its README and scripts should document the
additional type, unit, and application checks. Engine changes will need
deterministic automated tests. UI changes will also need Expo/device testing,
including accessibility behavior and representative iOS and Android layouts.
Local iOS simulator and native work requires macOS and Xcode; Android
verification requires the Android toolchain or a suitable device. Those tools
are not needed for today's documentation-only repository.
