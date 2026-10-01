---
"@expressive/mvc": minor
"@expressive/dom": minor
"@expressive/react": patch
---

`@expressive/mvc/jsx-runtime` exports `compose`, which renders `this` through its class's render layers composed up the prototype chain, so a State's render layers compose as a Component's do. `@expressive/react` seals `render` on Components itself. `Component.use()` throws from core with one message.
