# n^m

`n^m` is a free, open-source puzzle game planned for iOS and Android. Its MVP
has one mode: a square grid begins at 2×2 and grows when newly merged powers of
two reach milestones controlled by the run's `k` setting.

The repository includes a minimal Expo-managed React Native and TypeScript
application shell. It displays a static welcome screen but does not implement
gameplay yet. The planned game engine will remain pure, platform-independent
TypeScript so rules can be tested without a device.

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
| `.github/workflows/ci.yml`         | Documentation formatting and lint checks.                    |
| `.github/PULL_REQUEST_TEMPLATE.md` | Pull request checklist.                                      |
| `AGENTS.md`                        | Repository-specific instructions for automated contributors. |
| `CONTRIBUTING.md`                  | Beginner-friendly setup and contribution workflow.           |
| `LICENSE`                          | Existing MIT license.                                        |

## Local development

The project supports Node.js 22 through 24 and uses npm exclusively. To match
the current development environment with [nvm](https://github.com/nvm-sh/nvm),
install and select Node 24, then install the locked dependencies:

```sh
nvm install 24
nvm use 24
npm ci
```

Start the Expo development server for the development-build client:

```sh
npm start
```

The app currently shows only the static `n^m` welcome shell. It has no gameplay
or persistence behavior.

On a Mac with Xcode and an iOS Simulator installed, a later local-development
step can generate a temporary native project and launch a supported Expo
development build:

```sh
npx expo run:ios
```

That command generates an `ios/` directory locally through Expo CNG. Do not
commit generated native directories unless repository policy explicitly changes.

## Quality checks

Run formatting, Markdown lint, application lint, and TypeScript validation:

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
is no test script yet because the static shell contains no game behavior to
test. Expo configuration and iOS bundle generation can be validated without
prebuilding native projects:

```sh
npx expo config --type public
npx expo export --platform ios --output-dir /tmp/n-m-expo-export
```

## License

`n^m` is available under the existing [MIT License](LICENSE).
