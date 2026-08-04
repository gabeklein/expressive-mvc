# CI/CD Workflow Overview

## pr.yml (pull requests -> main)

Blocking: `bun run test`, `bun run build` and `dist-check.ts` (static invariants
on the emitted dist - relative specifiers resolve, side-effect imports are
declared). Steps backed by a script under `.github/scripts` invoke it directly;
only workspace-wide commands are `package.json` entries. The frozen-lockfile
install in the `setup` action doubles as the internal-dependency desync guard -
a workspace version that falls outside a sibling's range cannot reach main.

Non-blocking signals: `changeset status` (a preview of which packages would
bump) and `npm publish --dry-run` pack validation for the publishable packages.

## release.yml (push -> main)

`changesets/action` maintains the "Version Packages" PR (`changeset version`
+ `bun install` so the lockfile stays consistent with the bumps). Merging that
PR builds the packages, runs `dist-smoke.ts` and `native-check.ts`, then
`changeset publish`.

`dist-smoke.ts` packs each publishable package, installs the tarballs into a
throwaway project outside the repo and executes them under native Node ESM - the
only consumer-shaped check of the built dist, since tests alias the `@expressive`
scope onto sources. `native-check.ts` is its React Native counterpart: the same
tarballs into a throwaway Expo app, asserting Metro resolves every published
subpath for ios and android, `expo export` emits Hermes bytecode, and a `State`
subclass behaves the same whether Metro keeps native class fields
(`caller.engine` is `hermes`) or downlevels them to assignment (`jsEngine: jsc`).
Both sit in `ci:publish` rather than `pr.yml` so a failure blocks the publish,
and ordinary merges pay nothing for them.

Publishing authenticates via npm OIDC trusted publishing - no token secrets.
Each published package's npm settings trust this exact workflow filename under
the GitHub `release` environment (deployment branches restricted to `main`).
Renaming this file breaks every npm-side config. `changeset publish` skips
versions already on the registry, so re-running a failed job completes a
partial release.

First publish of a new package cannot use OIDC (npm requires the package to
exist before a trusted publisher attaches) - publish a stub manually, attach
the trusted publisher, then release normally.
