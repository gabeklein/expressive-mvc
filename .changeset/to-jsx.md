---
"@expressive/mvc": minor
"@expressive/dom": minor
"@expressive/react": patch
---

`@expressive/mvc/runtime` exports `toJSX(observe)`, the `State.on` handlers a host registers to make classes renderable - `render` sealed, PascalCase methods and function fields as subcomponents rendering through the host's tracking proxy - and `composed(instance)`, the render chain composed up the prototype chain. `@expressive/dom` registers `toJSX` on `State`, so a State's render layers compose as a Component's do; `@expressive/react` registers it on `Component`. Both adapters drop their own copies. `Component.use()` throws from core with one message.
