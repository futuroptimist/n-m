# n^m

`n^m` is a free, open-source puzzle game planned for iOS and Android. Its MVP
has one mode: a square grid begins at 2×2 and grows when newly merged powers of
two reach milestones controlled by the run's `k` setting.

The repository contains the MVP design, repository tooling, and a minimal
Expo-managed React Native application shell. The static welcome screen confirms
that the mobile foundation runs; gameplay is intentionally not implemented yet.
The planned game engine will remain pure TypeScript and independent of Expo and
React Native.

Read the [MVP expanding-grid design](docs/design/mvp-expanding-grid.md) for the
complete behavior and proposed defaults. See [CONTRIBUTING.md](CONTRIBUTING.md)
before making changes.

## Repository map

| Path                               | Purpose                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| `App.tsx`                          | Static, accessible application welcome screen.               |
| `app.json`                         | Expo managed-application configuration.                      |
| `docs/design/`                     | Product and gameplay specifications.                         |
| `docs/prompts/codex/`              | Reusable guidance for scoped Codex contributions.            |
| `.github/workflows/ci.yml`         | Formatting, lint, and TypeScript checks.                     |
| `.github/PULL_REQUEST_TEMPLATE.md` | Pull request checklist.                                      |
| `AGENTS.md`                        | Repository-specific instructions for automated contributors. |
| `CONTRIBUTING.md`                  | Beginner-friendly setup and contribution workflow.           |
| `LICENSE`                          | Existing MIT license.                                        |

## Local development

The supported Node.js range is 22 through 24. The repository's `.nvmrc` selects
Node 24, matching the target Mac setup. Install and select it with `nvm`, then
install the npm lockfile exactly:

```sh
nvm install 24
nvm use
npm ci
```

Start the Expo development server for the current static shell:

```sh
npm start
```

The project includes `expo-dev-client` for development builds. On a Mac with
Xcode and an iOS Simulator installed, the later simulator workflow is:

```sh
npm run ios
```

That command invokes `expo run:ios` and uses Expo's Continuous Native Generation
(CNG) workflow. It generates a local `ios/` directory when run; generated native
projects must not be committed. Likewise, do not commit a generated `android/`
directory.

## Quality checks

Run all formatting, documentation, application lint, and TypeScript checks:

```sh
npm run check
git diff --check
```

The scripts can also be run separately:

```sh
npm run format
npm run format:check
npm run lint:md
npm run lint
npm run typecheck
```

`format` writes formatting changes; the other commands only check files. There
is no test script or test runner yet because the static application shell has no
game behavior to test. Deterministic engine tests will arrive with the engine.

## License

`n^m` is available under the existing [MIT License](LICENSE).
