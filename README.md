# n^m

`n^m` is a free, open-source puzzle game planned for iOS and Android. Its MVP
has one mode: a square grid begins at 2×2 and grows when newly merged powers of
two reach milestones controlled by the run's `k` setting.

The repository contains a minimal Expo-managed React Native and TypeScript app.
Its static welcome screen verifies the application shell; gameplay has not been
implemented yet. The planned game engine will remain pure TypeScript and
platform-independent so its rules can be tested without a device.

Read the [MVP expanding-grid design](docs/design/mvp-expanding-grid.md) for the
complete behavior and proposed defaults. See [CONTRIBUTING.md](CONTRIBUTING.md)
before making changes.

## Repository map

| Path                               | Purpose                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| `App.tsx`                          | Static application welcome screen.                           |
| `app.json`                         | Expo application configuration.                              |
| `docs/design/`                     | Product and gameplay specifications.                         |
| `docs/prompts/codex/`              | Reusable guidance for scoped Codex contributions.            |
| `.github/workflows/ci.yml`         | Application and documentation quality checks.                |
| `.github/PULL_REQUEST_TEMPLATE.md` | Pull request checklist.                                      |
| `AGENTS.md`                        | Repository-specific instructions for automated contributors. |
| `CONTRIBUTING.md`                  | Beginner-friendly setup and contribution workflow.           |
| `LICENSE`                          | Existing MIT license.                                        |

## Local development

The project supports Node.js 22 through 24 and uses npm exclusively. The target
Mac development environment uses Node 24. Install and select it with
[nvm](https://github.com/nvm-sh/nvm), then install the locked dependencies:

```sh
nvm install 24
nvm use 24
npm ci
```

Start Metro for the included Expo development client:

```sh
npm start
```

The app currently displays only an accessible, static `n^m` welcome screen. It
does not contain gameplay. A later simulator workflow can create and launch a
local iOS development build with:

```sh
npx expo run:ios
```

That command requires macOS, Xcode, and an installed iOS Simulator runtime. It
generates a local `ios/` project through Expo's Continuous Native Generation; do
not commit that generated directory. For ordinary scaffold validation, no native
project generation is needed.

## Quality checks

Run formatting, Markdown lint, application lint, and TypeScript checks together:

```sh
npm run check
git diff --check
```

The scripts can also be run separately:

```sh
npm run format
npm run format:check
npm run lint:md
npm run lint:app
npm run typecheck
```

`format` writes formatting changes; the other commands only check files. There
is no test script or test runner yet because the static shell has no behavioral
logic to test. Validate Expo configuration and an iOS JavaScript bundle without
creating native projects by running:

```sh
npx expo config --type public
npx expo export --platform ios --output-dir /tmp/n-m-expo-export
```

## License

`n^m` is available under the existing [MIT License](LICENSE).
