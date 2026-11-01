---
"@expressive/dom": minor
---

Add `macro.From<typeof pack>` to declare a macro pack's `Registry` entries from its value: `interface Registry extends macro.From<typeof app> {}`.

A macro whose argument is optional now type-checks as a flag: `row: true`.
