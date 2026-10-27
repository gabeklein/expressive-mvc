---
'@expressive/mvc': minor
'@expressive/dom': patch
'@expressive/react': patch
---

Context lookups are observable.

- A tracked lookup re-runs when a change can alter its result - a closer provider arriving, the found one removed - and not for providers above the one found, other types or siblings.
- `this.get(Type)` inside an effect or render now refreshes when its provider changes. A required lookup whose provider is removed throws.
- dom: `Model.get` follows a provider replaced by a field assignment or arriving after mount.
- react: `Model.get` follows a provider arriving after mount, including an optional `Model.get(false)` that first found nothing, and returns `null` once its instance leaves context.
