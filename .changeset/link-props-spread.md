---
'@expressive/router': patch
---

`Link.Props` drops the anchor's `is` and `key` attributes, which clashed with the Component `is` callback and `key`, so a `Link.Props` value spreads onto `<Link>`.
