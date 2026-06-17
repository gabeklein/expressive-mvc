# Working in this repo

## Conventions

- **Always ask before adding new public surface.** Do not introduce new exported
  functions, methods, types, or fields (anything reachable from a package's
  public entry, including additions to shared registries like `Runtime` or the
  `Component`/`State` interfaces) without first confirming with the user.
  Prefer reusing or reshaping existing surface; when new surface seems needed,
  propose it and wait for a decision.
