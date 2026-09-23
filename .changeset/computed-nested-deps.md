---
"@expressive/mvc": patch
---

A computed getter read between an update and its refresh keeps its nested dependencies. Previously only direct fields carried over, so a getter reading `this.child.value` stopped updating - in `@expressive/router`, a guard that redirected once left its scope unable to reach its `none` Route later.
