---
"@expressive/mvc": patch
---

A child State constructed by a base-class field initializer and overwritten by a subclass initializer no longer warns that it was constructed but never activated. Activation drops pending States constructed between a parent and the last child it adopted.
