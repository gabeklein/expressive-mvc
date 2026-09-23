# React Native

Positioning for the adoption question - whether Expressive MVC is a safe choice for a React Native or Expo app. Task guidance lives in [react/react.md](react/react.md#react-native); this page is the case, not the how.

## React is React

The adapter imports `react` and `react/jsx-runtime` - nothing else. No renderer coupling to port, no platform fork, no second package: `npm install @expressive/react` is the whole install on either target, and Metro resolves it as published.

State, instructions, context, suspense, and error boundaries are renderer-independent by construction. The question was never whether React Native *could* work, and treating it as unproven inverts the burden.

## What is checked, and when

`native-check` gates every release. It installs the published tarballs into a throwaway Expo app (SDK 57, React Native 0.86) and asserts Metro resolves every subpath for iOS and Android, that `expo export` emits Hermes bytecode, and that a `State` subclass behaves identically whether Metro keeps native class fields or downlevels them to assignment. A failure blocks the publish.

A gauntlet runs the library as an app - on an iOS simulator and an Android emulator, in Debug and in Release. Release matters most: minified Hermes bytecode with `__DEV__` false, where an uncaught render error terminates the process instead of drawing a redbox. Fourteen checks cover dispatch batching, computed getters, async `set()` suspension, context resolution, `map`/`has`/`ref`, both routers, a full error-boundary recovery cycle, and a write re-rendering through the native renderer. It runs on `react-native`-labeled PRs, monthly, and on demand.

That gauntlet has already earned its place: it caught a regression that made every instruction throw on Hermes - `WeakMap` keyed by a `Symbol`, which Hermes does not implement - before it shipped. Nothing in the 1300-test suite could see it, because that suite runs unminified sources under a DOM shim and never touches Hermes.

## Architectural commitment

React Native is a designed target. The adapter's renderer independence is a constraint held deliberately, not a coincidence that might lapse - and consumers shipping to React Native are covered by the same long-term support intent as the web.

The remaining coupling is routing, and it is scoped work rather than an open question. `Link` renders an `<a>` and `NavLinks` a `<ul>`, so both are DOM-bound today. Canonical elements ([#128](https://github.com/gabeklein/expressive-mvc/issues/128)) maps semantic intrinsics onto host components - `anchor` to `Pressable` plus `Linking` - which removes that coupling at the root instead of forking the router per platform.

## Boundaries

State management on React Native is supported. Routing is not yet: the headless `Router` constructs and tracks navigation state, but `Link` and `NavLinks` need #128 before they render on a native host. `BrowserRouter` is the browser binding - it reads `window.location` and throws elsewhere, by design.

Under Jest, add `@expressive` to `transformIgnorePatterns`; the build is ESM-only.
