# CI/CD Workflow Overview

## pr.yml (pull requests -> main)

Blocking: `bun run test`, `bun run build` and `dist-check.ts` (static invariants
on the emitted dist - relative specifiers resolve, side-effect imports are
declared). Steps backed by a script under `.github/scripts` invoke it directly;
only workspace-wide commands are `package.json` entries. The frozen-lockfile
install in the `setup` action doubles as the internal-dependency desync guard -
a workspace version that falls outside a sibling's range cannot reach main.

Non-blocking signals: `changeset status` (a preview of which packages would
bump) and bundle size.

Beside `verify`, one run per push also holds:

- `dist-smoke` - `dist-smoke.ts` (see below) on Node 24, so a dist a consumer
  cannot load fails the PR that caused it rather than the release.
- `e2e` - every example page's Playwright spec on React and dom.
- `native` - calls `native.yml` for a PR labeled `react-native`.

`verify` and `e2e` are required checks, matched by job name - renaming either
job needs the branch protection updated with it.

A PR in a GitHub stack runs as if it targets the stack's base, so the `main`
filter covers every layer. `verify` runs on each layer; the other three run only
on the top one (`stack.position == stack.size`), whose head is what lands when
the stack merges - a skipped required check counts as passed. A PR merely based
on another PR's branch, outside a stack, runs nothing: create stacks with
`gh stack`.

## release.yml (push -> main)

`changesets/action` maintains the "Version Packages" PR (`changeset version`
+ `bun install` so the lockfile stays consistent with the bumps). Merging that
PR builds the packages, runs `dist-smoke.ts` and `native-check.ts`, then
`changeset publish`.

`dist-smoke.ts` packs each publishable package, installs the tarballs into a
throwaway project outside the repo and executes the probes and consumer app in
`scripts/dist-smoke/` under native Node ESM - the
only consumer-shaped check of the built dist, since tests alias the `@expressive`
scope onto sources. `native-check.ts` is its React Native counterpart: the same
tarballs into a throwaway Expo app, asserting Metro resolves every published
subpath for ios and android, `expo export` emits Hermes bytecode, and a `State`
subclass behaves the same whether Metro keeps native class fields
(`caller.engine` is `hermes`) or downlevels them to assignment (`jsEngine: jsc`).
Both sit in `ci:publish` so a failure blocks the publish. `native-check.ts`
stays out of `pr.yml` - ordinary merges pay nothing for an Expo build.

Publishing authenticates via npm OIDC trusted publishing - no token secrets.
Each published package's npm settings trust this exact workflow filename under
the GitHub `release` environment (deployment branches restricted to `main`).
Renaming this file breaks every npm-side config. `changeset publish` skips
versions already on the registry, so re-running a failed job completes a
partial release.

First publish of a new package cannot use OIDC (npm requires the package to
exist before a trusted publisher attaches) - publish a stub manually, attach
the trusted publisher, then release normally.

## native.yml (`react-native` label, monthly, or manual)

Builds a throwaway Expo app around the packed tarballs, runs it on a booted iOS
simulator and an Android emulator, and asserts fourteen behaviors from the log
stream - the engine's weak-key constraint, dispatch batching, computed getters,
suspense, context, `map`/`has`/`ref`, both routers, error recovery, and a write
re-rendering through the native renderer.

Opt a PR in with the `react-native` label: adding it runs the gauntlet at once,
and `pr.yml` calls it on every later push. Only adding a label creates a
separate Native run - skipped unless the label is `react-native`. It also runs
monthly, which is what catches an Expo or React Native SDK bump breaking
resolution when no PR is involved. `workflow_dispatch` takes a `configuration`
choice; otherwise the run is Release - minified Hermes bytecode with `__DEV__`
false, the only configuration where an uncaught render
error is fatal rather than a redbox.

A Release build embeds the bundle, so the app's console never reaches Metro -
markers are read from `simctl log stream` on iOS and `adb logcat` on Android.
iOS forwards `console.error` to os_log but not `console.log`, so the fixture
reports on whichever channel `__DEV__` implies.
