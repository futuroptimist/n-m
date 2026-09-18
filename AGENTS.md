# Agent guidance

These instructions apply to the entire repository.

## Start here

- Read [the MVP design](docs/design/mvp-expanding-grid.md). It is the source of
  truth for game behavior.
- Keep changes small, scoped, and reviewable. Preserve unrelated work.
- If a proposed change alters a rule, update the design document in the same
  change and clearly distinguish maintainer requirements from proposed design
  decisions.
- Keep README commands and repository maps accurate. Never claim a check ran
  when it did not; report the command and limitation.

## Architecture and tests

- Keep the future TypeScript game engine pure and independent of React Native,
  Expo, rendering, gestures, animation, and storage.
- Inject randomness into engine operations. When the engine is implemented,
  add deterministic behavioral tests for rule changes, including growth,
  movement, spawning, scoring, and game-over behavior.
- Do not scaffold application or native projects unless the task explicitly
  requests it.

## Verification

For documentation and repository-tooling changes, run:

```sh
npm ci
npm run check
git diff --check
```

Use `npm run format` before the non-mutating checks. Once application code
exists, also run its documented unit/type checks. Gameplay, gesture,
accessibility, layout, or native changes require Expo testing on relevant
devices or simulators; report platforms that were not available.

## Safety

Keep signing credentials, provisioning profiles, keystores, secrets, and local
environment files out of version control. Do not invent approval gates or
tools that the repository does not have.
