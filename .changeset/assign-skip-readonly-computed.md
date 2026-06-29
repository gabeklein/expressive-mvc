---
"@expressive/mvc": patch
---

Fix prop assignment throwing when a prop shares the name of a read-only (getter-derived) computed. Such a key previously hit the computed's throwing setter and dropped the value; it is now skipped during assignment, leaving the computed to derive it.
