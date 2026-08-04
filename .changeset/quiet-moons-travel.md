---
'@expressive/react': patch
---

Document provisional React Native and Expo support, and add `react-native` / `expo` keywords.

No code change - the adapter imports only `react` and `react/jsx-runtime`, so Metro resolves and runs it as-is. Releases are now gated on `native-check.ts`, which installs the published tarballs into a throwaway Expo app (SDK 57, React Native 0.86) and asserts Metro resolution for iOS and Android, a Hermes bytecode build, and class-field semantics under both of Metro's transform paths. No device or simulator run is part of CI.

Two documented boundaries: `jest-expo` needs `@expressive` in `transformIgnorePatterns` because the build is ESM-only, and `BrowserRouter` from `@expressive/router` throws on native, where `window` has no `location`.
