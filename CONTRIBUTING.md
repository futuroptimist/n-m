# Contributing to n^m

Thank you for helping build `n^m`. Contributions of any experience level are
welcome. Keep each change focused so it is easy to understand and review.

## Current repository setup

The repository currently contains the MVP specification and lightweight
documentation checks; it does not contain a playable app. Install
[Node.js 22 LTS](https://nodejs.org/) with its bundled npm, clone the
repository, and run:

```sh
npm ci
npm run check
git diff --check
```

`npm ci` installs exactly the versions in `package-lock.json`. `npm run check`
checks Prettier formatting and Markdown lint rules. To apply formatting, run
`npm run format`, then repeat the checks.

## Making a contribution

1. Read [AGENTS.md](AGENTS.md) and the
   [MVP design](docs/design/mvp-expanding-grid.md).
2. Create a short-lived branch and make one scoped change.
3. Update the design when gameplay behavior changes, keeping requirements and
   proposed decisions explicit.
4. Add meaningful tests when executable behavior is introduced. In particular,
   future engine changes need deterministic tests with injected randomness.
5. Run the available checks and describe their results in the pull request.
6. Include screenshots for visible UI work, or state why they are not relevant.

Do not commit `.env` files, API tokens, signing certificates, provisioning
profiles, keystores, or passwords.

## Future mobile development

After a separately scoped Expo application scaffold is added, its package
scripts will document the additional unit, type, and app checks. Expo is the
planned iteration environment. Test interaction changes on representative iOS
and Android devices or simulators; iOS native/simulator work needs macOS and
Xcode, while Android verification needs the Android SDK/emulator or a device.
Hosted build services may help with distribution but are not required for local
contributions. Until those commands actually exist, do not claim to have run
app, native, or device tests.

Contributions are provided under the repository's [MIT License](LICENSE).
