---
'@expressive/dom': patch
---

Published declarations now type the `css` pack's `mx`, `my`, `px`, `py` and `size` macros. The 0.1.0 declarations dropped them, so a style map using one failed to type-check outside the repo.
