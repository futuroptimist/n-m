# n^m

`n^m` is a free, open-source puzzle game planned for iOS and Android. Its MVP
has one mode: a square grid begins at 2×2 and grows when newly merged powers of
two reach milestones controlled by the run's `k` setting.

This repository currently contains **design documentation and repository tooling
only**. It is not yet a playable application. The planned implementation uses
React Native, Expo, and TypeScript, with a pure, platform-independent game
engine so rules can be tested without a device.

Read the [MVP expanding-grid design](docs/design/mvp-expanding-grid.md) for the
complete behavior and proposed defaults. See [CONTRIBUTING.md](CONTRIBUTING.md)
before making changes.

## Repository map

| Path                               | Purpose                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| `docs/design/`                     | Product and gameplay specifications.                         |
| `docs/prompts/codex/`              | Reusable guidance for scoped Codex contributions.            |
| `.github/workflows/ci.yml`         | Documentation formatting and lint checks.                    |
| `.github/PULL_REQUEST_TEMPLATE.md` | Pull request checklist.                                      |
| `AGENTS.md`                        | Repository-specific instructions for automated contributors. |
| `CONTRIBUTING.md`                  | Beginner-friendly setup and contribution workflow.           |
| `LICENSE`                          | Existing MIT license.                                        |

## Setup and quality checks

Install Node.js 22 LTS and npm, then install the locked development tools:

```sh
npm ci
```

Run all currently available checks:

```sh
npm run check
git diff --check
```

The scripts can also be run separately:

```sh
npm run format
npm run format:check
npm run lint:md
```

`format` writes formatting changes; the other commands only check files. There
are no runtime build or game test commands yet because the Expo application has
not been scaffolded.

## License

`n^m` is available under the existing [MIT License](LICENSE).
