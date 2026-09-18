# n^m

`n^m` is a free, open-source puzzle game planned for iOS and Android. Its MVP
has one mode: merging powers of two grows an initially 2×2 board when the run's
highest merge milestone crosses intervals selected by the player.

This repository currently contains **design documentation and repository
tooling, not a playable application**. The authoritative behavior specification
is the [MVP expanding-grid design](docs/design/mvp-expanding-grid.md).

## Proposed stack

The planned application will use React Native, Expo, and TypeScript. A pure,
platform-independent TypeScript game engine will remain separate from React
Native rendering, gestures, animation, and storage. Expo should make a first
mobile project approachable while retaining routes to device and native testing.
No Expo or application runtime dependency has been added yet.

## Repository map

| Path                               | Contents                                                   |
| ---------------------------------- | ---------------------------------------------------------- |
| `docs/design/`                     | Source-of-truth MVP behavior and implementation decisions. |
| `docs/prompts/codex/`              | Reusable prompt for scoped automated contributions.        |
| `.github/workflows/ci.yml`         | Documentation formatting and lint checks.                  |
| `.github/PULL_REQUEST_TEMPLATE.md` | Short contribution review checklist.                       |
| `AGENTS.md`                        | Repository guidance for automated contributors.            |
| `CONTRIBUTING.md`                  | Beginner-friendly setup and contribution workflow.         |
| `package.json`                     | npm-based documentation quality commands.                  |
| `LICENSE`                          | Existing MIT license.                                      |

## Setup and checks

Install [Node.js 22 LTS](https://nodejs.org/) (also recorded in `.nvmrc`) and
then install exactly the locked dependencies:

```sh
npm ci
```

Use the same quality gate locally and in CI:

```sh
npm run check
git diff --check
```

Individual commands are `npm run format`, `npm run format:check`, and
`npm run lint:md`. Formatting writes supported files; the other commands only
check them. See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change.

## License

`n^m` is available under the existing [MIT License](LICENSE).
