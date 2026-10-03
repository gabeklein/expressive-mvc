---
"@expressive/mvc": minor
"@expressive/dom": minor
"@expressive/react": patch
---

`@expressive/mvc/jsx-runtime` exports `subcomponents(target, observe)`, which rewrites PascalCase methods and function fields into subcomponents rendering through the host's tracking proxy. It also exports `compose`, which renders `this` through its class's render layers composed up the prototype chain. Each host registers `subcomponents` itself: `@expressive/dom` on `State`, so a State's render layers compose as a Component's do, and `@expressive/react` on `Component`, where it also seals `render`. Both adapters drop their own copies. `Component.use()` throws from core with one message.
