---
"@expressive/mvc": patch
---

An async `set()` factory that settles after its state is destroyed is dropped instead of throwing `Tried to update … but state is destroyed.` - a remount or unmount mid-load no longer surfaces an unhandled rejection.
