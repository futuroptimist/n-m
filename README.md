# n^m

`n^m` is a free, open-source puzzle game planned for iOS and Android. Its MVP
has one mode: a square grid begins at 2×2 and grows when newly merged powers of
two reach milestones controlled by the run's `k` setting.

The repository includes a minimal Expo-managed React Native and TypeScript app
shell. It is not yet a playable application: the current screen only confirms
that the mobile foundation runs. The planned game engine remains a pure,
platform-independent TypeScript module so rules can be tested without a device.

Read the [MVP expanding-grid design](docs/design/mvp-expanding-grid.md) for the
complete behavior and proposed defaults. See [CONTRIBUTING.md](CONTRIBUTING.md)
before making changes.

## Repository map

| Path                               | Purpose                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| `docs/design/`                     | Product and gameplay specifications.                         |
| `docs/prompts/codex/`              | Reusable guidance for scoped Codex contributions.            |
| `App.tsx`                          | Static, accessible Expo application shell.                   |
| `app.json`                         | Expo managed-app configuration.                              |
| `.github/workflows/ci.yml`         | Formatting, lint, and TypeScript checks.                     |
| `.github/PULL_REQUEST_TEMPLATE.md` | Pull request checklist.                                      |
| `AGENTS.md`                        | Repository-specific instructions for automated contributors. |
| `CONTRIBUTING.md`                  | Beginner-friendly setup and contribution workflow.           |
| `LICENSE`                          | Existing MIT license.                                        |

## Setup and quality checks

Install Node.js 24 with nvm, then install the locked dependencies with npm:

```sh
nvm install 24
nvm use 24
npm ci
```

Start the Expo development server:

```sh
npm start
```

Open the app with a compatible development build. The shell displays the `n^m`
identity and an “App shell ready” message; it intentionally has no game behavior
yet. On a Mac with Xcode and an iOS Simulator installed, create and run the
local development build with:

```sh
npx expo run:ios
```

This command generates native files locally through Expo CNG. Do not commit the
generated `ios/` directory. `expo-dev-client` is included so this and later
native-module work use Expo's supported development-build path.

Run all currently available checks:

```sh
npm run check
npx expo config --type public
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
is no game test command yet because gameplay has not been implemented.

## License

`n^m` is available under the existing [MIT License](LICENSE).
