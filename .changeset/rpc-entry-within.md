---
"@expressive/rpc": minor
---

`within(folder, run)` from `@expressive/rpc/calls` runs an entry route's code behind a folder's gates, as a call there would: each gate's `new()` is awaited, so `Session.get()` works inside, and a refusal throws.
