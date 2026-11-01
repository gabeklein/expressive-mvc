---
'@expressive/react': minor
---

An effect declared during construction of a Component the host owns - rendered as JSX, or constructed by `<Component for>` - holds its first run until that component commits. It never runs during server render or for a render React discards. `mount()` is deprecated: an effect in `new()` covers it.
