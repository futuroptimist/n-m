# Contributing to n^m

Thank you for helping with n^m. Small, focused changes are easiest to review,
especially while this first mobile project is taking shape.

## Current setup

1. Install Node.js 22 LTS and npm. If you use `nvm`, run `nvm use` from the
   repository root.
2. Install the exact locked development dependencies:

   ```sh
   npm ci
   ```

3. Read the [MVP design](docs/design/mvp-expanding-grid.md). It is the source of
   truth for gameplay behavior.

The repository currently contains documentation and quality tooling, not an Expo
application. You do not need Xcode, Android Studio, or Expo for a documentation
contribution.

## Make a contribution

- Keep one change focused on one concern.
- Preserve maintainer requirements. Label newly selected behavior as a proposed
  design decision, and update the design when rules change.
- Update navigation and examples when adding or moving documentation.
- Never commit `.env` files, API keys, signing certificates, provisioning
  profiles, or Android keystores.

Format and validate the current repository:

```sh
npm run format
npm run check
git diff --check
```

In a pull request, summarize the purpose, list meaningful changes, and report
the exact checks run. Include screenshots only for visible UI changes.

## Future mobile work

After a separately scoped task creates the Expo application, contributors will
also run deterministic engine tests and the checks introduced by that scaffold.
Use Expo and physical devices for routine iteration. iOS simulator or native
work requires Xcode on macOS; Android verification requires the relevant Android
SDK/emulator or a device. Do not claim a platform check unless it was actually
performed.
