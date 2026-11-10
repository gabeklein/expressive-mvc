---
"@expressive/dom": minor
---

Subcomponent styles are scoped to the class that defines the method. A `_Title` body in `style(Card, …)` applies only to the `Title()` that `Card` itself defines: a subclass inheriting `Title` keeps `Card`'s body, and a subclass overriding it starts with only its own - a parent's piece styles no longer land on a replacement.

**Breaking:** restyling an inherited piece through a subclass no longer applies, and `style(Fancy, { _Title: … })` now throws unless `Fancy` defines `Title()`. Override the method, or have the owner put a rule on the element (`<this.Title _title />`) and style `_title`. A PascalCase field holding a function is not a subcomponent - style it with `style(fn, …)` and read its owner with `Parent.get()`.
