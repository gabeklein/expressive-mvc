---
'@expressive/dom': minor
---

`lazy()` no longer caches a failed load. The rejection reaches the nearest `catch`, and the render after recovery calls the loader again, so a chunk that failed to load can retry. A lazy State or Component class now accepts its attributes in JSX, typed from the loaded class. Previously only function components carried props.
