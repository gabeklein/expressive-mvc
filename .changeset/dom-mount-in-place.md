---
"@expressive/dom": patch
---

A child appearing before existing siblings mounts in its place instead of at the end, so the siblings no longer move and a focused one keeps focus - `{placed && <Arrow />}{children}` no longer blurs an input in `children`.
