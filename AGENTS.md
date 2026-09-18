# Repository guidance for agents

## Scope and source of truth

- Read [the MVP design](docs/design/mvp-expanding-grid.md) before changing game
  behavior. It is the source of truth for the expanding-grid MVP.
- Reflect any proposed rule change in that design and clearly distinguish
  maintainer requirements from proposed decisions.
- Keep changes small, focused, and accurately documented. Preserve unrelated
  work and report checks that could not run honestly.
- Do not add another playable mode unless the maintainer explicitly changes the
  MVP scope.

## Implementation boundaries

- When application work begins, keep the game engine pure TypeScript and
  independent of React Native, Expo, rendering, gestures, animation, and
  persistence adapters.
- Inject randomness into engine operations. Add deterministic behavioral tests
  for engine rules, including the acceptance cases in the design document.
- Do not create placeholder commands or tests that succeed without meaningful
  validation.

## Verification

For the Expo application and documentation, run:

```sh
npm ci
npm run check
npx expo config --type public
git diff --check
```

Use `npm run format` before the checks when files need formatting. Also run the
documented engine/unit checks once they exist and use Expo on relevant devices.
Do not run Expo prebuild or commit generated `ios/` or `android/` directories
without an explicit repository policy change. UI, gesture, accessibility,
persistence, or native changes require appropriate device/simulator checks;
native iOS checks require macOS/Xcode, and Android checks require the documented
Android tooling. State precisely when those environments are unavailable.

## Security and repository hygiene

- Never commit signing credentials, provisioning profiles, keystores, secrets,
  tokens, or local environment files.
- Keep generated output and machine-local state out of version control while
  avoiding ignores broad enough to hide application source.
- Update navigation and commands when the repository layout or tooling changes.
