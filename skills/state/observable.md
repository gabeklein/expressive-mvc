# Observable Protocol (advanced)

The reactive substrate beneath `State`. Reach for this only to build a **custom observable** - an object that is not a `State` but hooks into the same subscription/dispatch system so `watch()`, `State.use()`, and adapter hooks can track it. If you are writing application logic, use `State`, computed getters, and `hot()` instead; this is library-authoring surface.

```ts
import { observer, touch, event, listener, watch, Observer } from '@expressive/mvc';
```

The canonical implementation is **`hot()`** ([field/hot.md](../field/hot.md)) - the array/object reactive sugar is built entirely on `touch` + `event`. Read its source (`packages/mvc/src/field/hot.ts`) as the reference.

## The contract

An observable is any object carrying an `Observer` bundle. Two calls make a plain object reactive:

- **On read** - call `touch(self, key, value)` inside a getter/proxy-get. It registers `key` as a dependency of the active watch context and returns `value` (passing nested observables through so they subscribe too). Outside a watch context it is a no-op that just returns the value.
- **On write** - call `event(self, key)` to fire a keyed update. Subscribers watching that key are notified on the next microtask (dispatch is batched). Call `event(self)` with no key once to emit the **ready** signal and activate the bundle.

That is the whole loop: reads `touch`, writes `event`. The `Observer` bundle is created lazily on the first `event`/`listener` call; you rarely create it by hand.

## Functions

| Function | Purpose |
| -------- | ------- |
| `touch(self, key, value?)` | Register `key` as accessed in the current watch context; returns `value`. Use in reads. A nested observable value is auto-subscribed. |
| `event(self, key?, silent?)` | Dispatch. `key` = property/custom event; omitted = **ready** (activation); `null` = **terminal** (destroyed). `silent` suppresses notification. |
| `listener(self, cb, select?)` | Low-level subscription. `cb(signal)` runs on each event (`string` key, `true` ready, `false` flush done, `null` destroyed). `select` filters to specific signals. Returns an unsubscribe fn. |
| `watch(self, effect, requireValues?)` | High-level tracked effect. Runs `effect` immediately and re-runs when any *accessed* property changes (auto-tracked). Return a cleanup fn or `null` (run once, no subscription). `true` makes reads of `undefined` throw. Returns an unsubscribe fn. |
| `observer(self, create?)` | Fetch the bundle. Returns it if active, `null` if terminated, `undefined` if never observable. `observer(self, true)` attaches a fresh bundle (throws if terminated). Use to opt an object in explicitly, or to test observability. |
| `Observer` | The symbol under which the bundle lives, and the bundle interface type. |

## Signals

`listener`/`watch` callbacks receive a `Signal`:

| Signal | Means |
| ------ | ----- |
| `string \| symbol \| number` | A property or custom event fired |
| `true` | Ready - the subject emitted its initial activation event |
| `false` | An update flush completed |
| `null` | Destroyed - terminal, no further events |

All events are batched and flushed via `queueMicrotask()`.

## Worked example

A minimal custom observable - a reactive cell that is not a `State`:

```ts
import { touch, event, watch } from '@expressive/mvc';

function cell<T>(initial: T) {
  let value = initial;
  const self = {
    get value() {
      return touch(self, 'value', value); // read -> register dependency
    },
    set value(next: T) {
      if (next === value) return;
      value = next;
      event(self, 'value');               // write -> fire keyed update
    }
  };
  event(self);                            // mark ready / activate
  return self;
}

const count = cell(0);

const stop = watch(count, (c) => {
  console.log(c.value); // re-runs whenever `value` changes
});

count.value++; // logs 1 (next microtask)
stop();
```

`hot()` is the same idea applied through a `Proxy`: every traps' get calls `touch`, every set/delete calls `event(proxy, key)`, and a one-time `event(proxy)` activates it. See its source for dense-array handling, snapshotting via `get`, and length events.

## Notes

- A `State` is just an observable with classified fields, computed getters, lifecycle, and context layered on top. Anything `watch()` can observe, `State.use()` / `use()` can subscribe a component to.
- Keep custom observables single-level; for nested reactivity compose child observables (as `hot()` documents) rather than deep-proxying.
