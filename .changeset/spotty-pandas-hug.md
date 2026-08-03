---
"@expressive/mvc": patch
---

Store the underlying instance when a State is assigned from a subscriber.

Reading a child State through a subscriber proxy - a render body, an effect, or any handler which closed over one - yields a tracking proxy for that child, not the child itself. Assigning it back to a managed field stored the proxy. Since the proxy is a fresh object each read, adoption treated it as an unparented State and claimed ownership of it, and clearing the field then fired the terminal event against the proxy. That event resolves the child's real observer through the prototype chain, so every listener on the live child was dropped while the child itself stayed active and unaware.

The visible symptom was a computed getter that stopped recomputing. Its subscription is established once and never re-established, so it never recovered - it returned a frozen value while plain fields, whose subscriptions are rebuilt on each render, kept tracking. Under React this surfaced on the third `{instance}` placement of a child field toggled from an event handler.

Managed fields now hold the instance, so identity, update de-duplication and adoption all reference the same object.
