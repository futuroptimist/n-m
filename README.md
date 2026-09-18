# n^m

`n^m` is a free, open-source puzzle game planned for iOS and Android. Its MVP
has one mode: a 2×2 board expands as the player creates new powers of two, with
the selected `k` value controlling how many exponent milestones are needed for
each expansion.

> [!IMPORTANT]
> This repository currently contains design documentation and repository
> tooling. It does **not** contain a playable application or application
> runtime.

The proposed implementation uses React Native, Expo, and TypeScript. Game rules
will live in a pure, platform-independent engine so they can be tested without
a device or renderer. Read the [MVP expanding-grid design](docs/design/mvp-expanding-grid.md)
for the complete behavior specification and [CONTRIBUTING.md](CONTRIBUTING.md)
before making changes.

## Repository map

| Path                               | Purpose                                                  |
| ---------------------------------- | -------------------------------------------------------- |
| `docs/design/`                     | Product and gameplay specifications.                     |
| `docs/prompts/codex/`              | Reusable guidance for scoped Codex contributions.        |
| `.github/workflows/ci.yml`         | Documentation formatting and lint checks.                |
| `.github/PULL_REQUEST_TEMPLATE.md` | Pull request checklist.                                  |
| `AGENTS.md`                        | Repository-specific guidance for automated contributors. |
| `CONTRIBUTING.md`                  | Beginner-friendly setup and contribution workflow.       |
| `package.json`                     | npm-based documentation quality commands.                |

## Setup

Install [Node.js 22 LTS](https://nodejs.org/) and npm, then install the exact
locked dependencies:

```sh
npm ci
```

No Expo or native dependencies are installed yet.

## Quality checks

```sh
npm run format       # apply Prettier formatting
npm run format:check # verify formatting without changing files
npm run lint:md      # lint Markdown
npm run check        # run both non-mutating checks
git diff --check     # find whitespace errors in the current diff
```

CI runs `npm ci` and `npm run check`. These checks cover the repository's
current documentation/tooling phase; device and native checks will be added
with the application.

## License

`n^m` is available under the existing [MIT License](LICENSE).
