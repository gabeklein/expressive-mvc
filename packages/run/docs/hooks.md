# Hooks - Before and After

Methods named `before`/`after`, or those followed by an uppercase letter (`beforeShip`), are hooks: never wrapped, never scheduled - from outside they are plain methods. `beforehand` is a step.

```ts
protected before(key: string, args: unknown[], skip: boolean) {}
protected after(key: string, entry: Runner.Entry, skip: boolean) {}

protected beforeShip(skip: boolean, chargeId: string) {}
protected afterShip(skip: boolean, entry: Runner.Entry) {}
```

Order around each step: `before` → `before<Step>` → step → `after<Step>` → `after`. The after hooks see the committed entry. `skip` is always `false` at this tier - it is reserved for replay in the job tier.

Hooks are `protected` by convention ([README.md](README.md#conventions)) and synchronous. Hooks run with the raw instance as `this`: their writes are in no patch and do not count as step work; their return is ignored and not awaited. A hook that throws fails the run. Hooks fire for `next`, `end` and steps answering a wait; not per retry, and not for undos.

A per-step hook without its step throws when the instance is created: `afterShip has no step ship.` The signature is not checked by type - see FEATURE.md.
