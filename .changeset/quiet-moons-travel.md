---
'@expressive/react': patch
---

Document React Native and Expo support, and add `react-native` / `expo` keywords.

No code change - the adapter imports only `react` and `react/jsx-runtime`, so Metro resolves and runs it as published. Releases gate on `native-check.ts`, which installs the published tarballs into a throwaway Expo app (SDK 57, React Native 0.86) and asserts Metro resolution for iOS and Android, a Hermes bytecode build, and class-field semantics under both of Metro's transform paths. A simulator gauntlet exercises the adapter on the iOS renderer, run on demand rather than per release. No physical device is tested, which is the one sense in which support is provisional.

Two boundaries: `jest-expo` needs `@expressive` in `transformIgnorePatterns` because the build is ESM-only, and `BrowserRouter` is the browser binding - use `Router` on native.
