---
'@expressive/dom': minor
---

`createPortal(children, container, key?)` is replaced by a `Portal` element: `<Portal into={container} key={…}>{children}</Portal>`. The context, ownership and suspense behaviour are unchanged. There's no alias.
