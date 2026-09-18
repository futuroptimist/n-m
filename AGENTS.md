# Agent guidance

These instructions apply to the whole repository.

## Sources and scope

- Read `README.md` and `docs/design/mvp-expanding-grid.md` before changing game
  behavior. The design document is the source of truth for MVP rules.
- Reflect any proposed rule change in the design, clearly distinguishing a
  maintainer requirement from a proposed design decision.
- Keep changes small, reviewable, and limited to the requested scope. Keep the
  repository map and commands accurate; report checks that could not run.
- Do not scaffold the Expo application until a task explicitly requests it.

## Future implementation

- Keep the game engine pure TypeScript and independent of React Native,
  rendering, gestures, animation, and storage.
- Add deterministic behavioral tests with injected randomness when engine code
  is implemented. Cover the acceptance cases in the design document.
- Run native or physical-device checks for changes involving gestures,
  accessibility, animation, layouts, persistence integration, or platform
  configuration. State which platforms and devices were actually checked.
- Do not create a generalized mode framework before another mode is required.

## Verification

After installing dependencies with `npm ci`, run:

```sh
npm run check
git diff --check
```

Run `npm run format` before those checks when editing supported text files.
There are currently no runtime, test, or native build scripts.

Never commit signing credentials, provisioning profiles, keystores, secrets, or
local environment files. Preserve the MIT license and attribution.
