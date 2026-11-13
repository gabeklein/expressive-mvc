---
"@expressive/dom": minor
---

`__name` parts style elements inside components a map does not own. `<input __input />` marks a public part; a `__input` key in a `style()` or `use()` map styles marked parts and `input` tags anywhere below the component, at any depth. A marked part's rule beats its owner's own rules, a tag match is a default the owner overrides, and the nearest ancestor wins through CSS `@scope`. Nested under a flag (`_year: { __control }`), a part rule reaches only that element's subtree. Portal roots carry their logical ancestors' anchors. Part names type-check against tags and an augmentable `Parts` interface.

`_name` attributes and map keys now type-check only with a letter or digit after the underscore.
