---
'@expressive/react': patch
---

Document provisional React Native and Expo support, and add `react-native` / `expo` keywords.

No code change - the adapter already resolves and runs under Metro, because it imports only `react` and `react/jsx-runtime`. Verified on Expo SDK 57 (React Native 0.86, React 19.2) for iOS and Android: Metro resolution, a Hermes bytecode build, and render plus re-render on write. Not yet verified on a device or simulator.

Two documented boundaries: `jest-expo` needs `@expressive` in `transformIgnorePatterns` because the build is ESM-only, and `BrowserRouter` from `@expressive/router` throws on native, where `window` has no `location`.
