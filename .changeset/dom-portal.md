---
'@expressive/dom': minor
---

`createPortal` is renamed `portal`, matching dom's other lowercase helpers (`render`, `lazy`, `style`, `macro`). There is no alias: replace `createPortal(children, container, key?)` with `portal(children, container, key?)`.
