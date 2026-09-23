---
"@expressive/mvc": patch
---

Children of a private instance (`State.new()` without `static global`) no longer register in the global root, where any context-less `get()` could find them. They follow their parent instead: providing the instance (`<Provider for={app}>`) provides its children there, and a global parent still puts them in root.
