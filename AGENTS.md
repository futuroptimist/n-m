# Agent guidance

These instructions apply throughout this repository.

## Scope and behavior

- Read [the MVP design](docs/design/mvp-expanding-grid.md) before changing game
  behavior. It is the source of truth; update it in the same change as any
  proposed rule change and distinguish requirements from proposed decisions.
- Keep changes small and reviewable. Do not scaffold the app or add runtime
  dependencies unless the task specifically calls for them.
- When implemented, keep the pure TypeScript engine independent of React Native,
  Expo, UI, gesture, animation, and storage code. Inject randomness.
- Add deterministic behavioral tests alongside engine behavior. Cover affected
  acceptance cases from the design rather than using placeholder tests.
- Keep documentation and repository maps accurate. Report checks that did not
  run and their exact limitation; never claim an unrun check passed.

## Verification

For the current documentation/tooling repository, run:

```sh
npm ci
npm run check
git diff --check
```

Use `npm run format` before the checks when editing supported text files. Future
UI or runtime work also needs relevant unit checks plus Expo validation on real
devices or emulators. Use macOS/Xcode for iOS simulator or native verification,
and Android Studio/SDK tooling for Android verification; state when required
hardware or host tooling is unavailable.

## Safety

- Preserve the existing MIT license and unrelated work.
- Never commit signing credentials, provisioning profiles, keystores, secrets,
  or local environment files.
- Keep commands, CI claims, and screenshots truthful and current. Include
  screenshots for perceptible UI changes once an application exists.
