# n^m

**n^m** is a planned free, open-source puzzle game for iOS and Android. Its MVP
has one expanding-grid mode: equal powers of two merge, and the square board
grows when new exponent milestones are reached.

This repository currently contains **design documentation and repository tooling
only**. It is not yet a playable application. The intended stack is React
Native, Expo, and TypeScript, with game rules in a pure, platform-independent
engine.

Read the [MVP expanding-grid design](docs/design/mvp-expanding-grid.md) for the
authoritative behavior specification. See [CONTRIBUTING.md](CONTRIBUTING.md) for
beginner-friendly contribution guidance.

## Repository map

| Path                               | Contents                                                 |
| ---------------------------------- | -------------------------------------------------------- |
| `docs/design/`                     | The implementable MVP game specification.                |
| `docs/prompts/codex/`              | A reusable prompt for scoped Codex contributions.        |
| `.github/workflows/ci.yml`         | Formatting and Markdown checks in CI.                    |
| `.github/PULL_REQUEST_TEMPLATE.md` | A short review checklist.                                |
| `AGENTS.md`                        | Repository-specific guidance for automated contributors. |
| `CONTRIBUTING.md`                  | Local setup and contribution workflow.                   |
| `LICENSE`                          | The MIT license.                                         |
| `package.json`                     | Documentation quality scripts and development tools.     |

## Setup

Install [Node.js 22 LTS](https://nodejs.org/) (the version in `.nvmrc`) and npm,
then install the locked development dependencies:

```sh
nvm use
npm ci
```

No Expo or application runtime dependency is installed yet.

## Quality checks

```sh
npm run format       # apply Prettier formatting
npm run format:check # verify formatting without changing files
npm run lint:md      # lint Markdown
npm run check        # run both non-mutating checks used by CI
git diff --check     # detect whitespace errors in local changes
```

There are no game tests or native build commands yet because the application has
not been scaffolded. The future Expo implementation will add meaningful engine
tests and device-specific validation rather than placeholder scripts.

## License

n^m is available under the existing [MIT License](LICENSE).
