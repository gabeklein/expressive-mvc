---
"@expressive/react": minor
---

Raise the React peer range floor to 16.14.

`>=16.8.0` was never accurate: the adapter imports `react/jsx-runtime`, which
does not exist before 16.14, so installs on 16.8-16.13 resolved without warning
and then failed at import. The range now states the version that actually works.

Documented alongside it: revision validation for concurrent rendering applies on
React 18+, and is skipped on 16.14-17 because those renderers cannot interrupt a
render and so have no interleaving to protect against.
