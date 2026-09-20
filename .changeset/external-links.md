---
"@expressive/router": patch
---

`Link` now preserves external targets and leaves their clicks to the browser.
Scheme-bearing and protocol-relative URLs no longer collapse to the app root or
enter SPA navigation.
