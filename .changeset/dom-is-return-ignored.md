---
'@expressive/dom': patch
---

The value an `is` callback returns on a plain Model element is now ignored, as it already was for a Component. An arrow like `is={(value) => (held = value)}` returned the instance, which was assigned back onto itself - throwing "read-only" on a `map` or other read-only field.
