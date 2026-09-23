---
"@expressive/router": patch
---

A section scope re-entered after ceding no longer shows the app `none` Route beside its page. Child registration now notifies every ancestor, so `matches` and `active` see routes a nested scope mounts late.
