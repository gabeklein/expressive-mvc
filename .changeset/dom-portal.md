---
'@expressive/dom': minor
---

`createPortal(children, container, key?)` is replaced by a `Portal` element: `<Portal into={container} key={…}>{children}</Portal>`. `into` also takes a selector string, resolved when the portal mounts; it throws unless exactly one element matches. The context, ownership and suspense behaviour are unchanged. There's no alias.
