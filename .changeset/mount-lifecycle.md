---
"@expressive/react": minor
---

Add `mount()`, a commit-phase lifecycle hook for a State whose lifetime a
component owns - `State.use()` and `<Component />`. It is called once when that
component commits, and the function it returns runs on unmount.

This fills a gap `new()` could not. `new()` runs synchronously at construction,
which means it also runs during server render, making it the wrong home for
anything touching `window`, timers, or subscriptions - the workaround being a
`typeof window === 'undefined'` guard at the top of every such hook. `mount()`
never runs on the server, and never for an instance no component owns, so
client-only effects can be written plainly:

```tsx
class Viewport extends State {
  width = 0;

  mount() {
    const measure = () => (this.width = window.innerWidth);

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }
}
```

`mount()` is deliberately an ownership hook, not an observation one, so it does
not fire on paths that reach an instance owned elsewhere - `State.get()`, or
placing one as `{instance}`. Those are many-to-one: any number of components can
observe or place a single instance, each for less time than the instance lives,
and a hook firing once per observer would not be a lifecycle. Use `State.get()`
or an event to react to an instance a component does not own.

`new()` and `use()` are unchanged: `new()` stays construction-time setup with a
teardown, and `use()` stays the render-phase hook that intercepts `State.use()`
arguments and hosts other hooks.

Under StrictMode a remount repeats none of the three stages - setup, mount and
cleanup now share one render counter.

**Breaking:** `Component.use()` is no longer available. A Component is rendered,
not used; the static now throws and is typed `never` so the call is rejected at
compile time. Render one with `<MyComponent />` or `{instance}`, or take a bare
instance with `MyComponent.new()`.

**Known gap:** `<Provider for={SomeState}>` does own the instance it creates, so
it should mount, but does not yet - the Provider cannot currently distinguish
instances it created from ones it merely provides.
