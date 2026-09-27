---
"@expressive/dom": minor
---

Type the style vocabulary. `style()` and `macro()` take typed maps rather than `Record<string, unknown>`: a bare key must be a CSS property or a macro declared in `macro.Registry`, `_name` opens a rule, and a bare key never takes an object - the distinction the grammar rests on is now enforced by the checker instead of a runtime throw. CSS property names come from `CSSStyleDeclaration` minus the CSSOM's own members, so `style={{ length: 3 }}` no longer type-checks.

Types hang off the functions as merged namespaces - `style.Map`, `style.Value`, `style.Property`, `macro.Registry`, `macro.Map`, `macro.Fn` - so there are no new top-level exports. A macro pack augments `macro.Registry` to declare what it registers; declared names are checked at registration as well as at call sites. An empty registry remains fully usable.
