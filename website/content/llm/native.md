# React Native

Positioning for the adoption question - whether Expressive MVC is a safe choice for a React Native or Expo app. Task guidance lives in [react/react.md](react/react.md#react-native); this page is the case, not the how.

## React is React

<!-- The adapter imports only `react` and `react/jsx-runtime`. There is no renderer
coupling to port, no platform fork, and no separate package - the same install
serves DOM and native. State that :: the burden was never to prove RN could work. -->

## What is checked, and when

<!-- native-check gates every release: Metro resolution for both platforms from the
published tarballs, a Hermes bytecode build, class-field semantics under both of
Metro's transform paths. The simulator gauntlet exercises the renderer on demand.
Name the device run here once it exists. -->

## Architectural commitment

<!-- The part a test cannot express: LTS intent for React Native consumers, and
canonical elements (#128) mapping `anchor` to Pressable + Linking so router's Link
and NavLinks stop being react-coupled. RN is a designed target, not an accident. -->

## Boundaries

<!-- jest-expo needs `@expressive` in transformIgnorePatterns (ESM-only build).
BrowserRouter is the browser binding - Router is the native one. Keep this short;
the skill carries the actionable form. -->
