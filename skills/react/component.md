# Expressive MVC - Component

Runnable source (complete programs, served as HTML): [`props`](https://expressive.dev/examples/component/props), [`subcomponents`](https://expressive.dev/examples/component/subcomponents), [`lifecycle`](https://expressive.dev/examples/component/lifecycle), [`injection`](https://expressive.dev/examples/component/injection), [`headless`](https://expressive.dev/examples/component/headless), [`suspense`](https://expressive.dev/examples/component/suspense), [`boundary`](https://expressive.dev/examples/component/boundary), [`custom`](https://expressive.dev/examples/component/custom), plus [`extension`](https://expressive.dev/examples/composition/extension) for render composition.

`Component` extends `State` - a persistent class instance owning its rendering, lifecycle, and behavior.

## When to use Component vs State vs function components

- **Function components** present data or define local implementation scopes. They may read contextual state with `.get()`; they own no persistent Expressive instance.
- **State** is display-agnostic - data and logic, no render. Use with `State.use()` in FCs.
- **Component** is for custom components/primitives owning their display logic - reusable, extensible behavior + UI: form controls, media players, data grids, modals. A layout shell earns Component only with owned state; a stateless shell is an FC mounting its children. Exception - the **app/route entrypoint** is a Component even when `render()` is pure composition: owning the construction graph is the state. Replica and region fields provide implicitly, and the instance ships the last-resort `catch` and `fallback` an FC root would hand-roll as Provider + ErrorBoundary + Suspense in `main`.

Premise: **the class tree is the app; rendering is a projection of it.** `App.new()` stands the UX up headless - every feature's status reads off the instance (`inbox.archive.open`, a pool's members, an import's progress) with no DOM. Keep that true: regions as fields rather than Providers, `has()` subtrees contributing to macro-state whether or not placed, render-less Components. Tests, devtools, and agents consume this surface as much as views do.

Rule of thumb: use `Component` when state is intrinsic to display logic - usually meaning it defines `render()`. Intrinsic to *this* display concern, not the surface - a second concern (a resize handle beside send) is a second class, composed as a mounted wrapper, not more fields on the first.

`render()` is optional: without one, a Component passes children through while placement, `mount()`, implicit provide, `catch`, and `fallback` all still run. Omit `render()` unless the class paints - never write `render() { return this.props.children; }`. Headless examples (not a closed set): route controllers throughout an app, progressive `Boundary` wrappers, the app root's last-resort boundary, and mount-only ancestors - a stick-to-bottom scroller, a focus trap, a resize listener that must sit above what it measures. A mount-only ancestor owning fields or a reaction stays a Component; no JSX does not demote it to FC-plus-`useEffect`.

Same rule as the pass-through demotion: a ref plus a DOM-sync reaction never earns the *paint's* instance - but that behavior, separated under its own name, earns its own:

```tsx
// Wrong: paint and scroll policy fused on one class
class Transcript extends Component {
  session = get(Session);
  box = ref<HTMLDivElement>();

  mount() { /* scroll box to bottom as messages arrive */ }
  render() { /* paint messages from session */ }
}

// Right: paint is an FC; the policy is its own name
function Transcript() {
  const { messages } = Session.get();
  return <div className="transcript">{messages}</div>;
}

class Stick extends Component {
  on = true;

  mount() { /* pin scroll to bottom while on */ }
}

<Stick>
  <Transcript />
</Stick>
```

The fused class demotes because scroll-sync was incidental to its paint. `Stick` earns the instance as a feature: unplug is deleting one wrap, and `stick.on` reads off the tree.

Use `State` for headless models/controllers, even ones meaningful only in context. A `Component` carries React instance properties (`props`, `state`, `context`, `setState`, `forceUpdate`), making `.get()` noisier where `State` would suffice.

Prefer an FC when state is reducible or zero and neither boundary nor suspense is wanted. A class of only `inbox = get(Inbox)` and `render()` is a pass-through - an FC snapshotting `Inbox.get()` is the same subscription without an instance. Component earns the class when the instance owns fields, a pool, or its boundary; lifecycle earns it only when managing owned state - a ref plus a reaction mirroring context to the DOM is still an FC (effect over its `.get()` snapshot). Inverse: a leaf widget still on `useState`/`useEffect` whose inputs are its identity - `<Thumbnail src={…} size={…} />` writes class fields; reactions to them live in `mount()` or `set` callbacks.

For one-shot feature builds and hook refactors, don't create `FooState` plus `FooView` by reflex. A local router, tab panel, menu, editor surface, media player, or custom form control is often clearer as `class Foo extends Component` - the state is intrinsic to the rendered unit. An app or route entrypoint stays a Component thru region extraction - regions become its fields; only chrome owning nothing demotes to an FC.

## Basic Usage

```tsx
import { Component } from '@expressive/react';

class Counter extends Component {
  count = 0;

  increment() {
    this.count++;
  }

  render() {
    return <button onClick={this.increment}>{this.count}</button>;
  }
}

<Counter />;
```

Properties read via `this` in `render()` are reactive.

An activated instance renders directly - useful when another object or collection owns its lifecycle, and eliminates wrappers whose only job is managing subscriptions:

```tsx
const first = Item.new({ label: 'First' });
const second = Item.new({ label: 'Second' });
const items = [first, second];

<>{first}</>
<>{items}</>
```

- The adapter exposes each instance as an element keyed by `key`, defaulting lazily to the State uid (`String(instance)`). Override the readonly `key` property for an application-defined identity.
- Mounting subscribes and provides context as usual; unmounting only detaches. The external owner destroys it with `instance.set(null)`.
- One instance may appear beneath separate parents. Repeating it within one sibling collection repeats the key and intentionally produces the host's duplicate-key warning.

When a render reads more than a value or two, destructure everything it reads from `this` at the top - the dependency-snapshot rule of `.get()` / `State.use()` ([react.md](react.md)). Rendering shares the hooks' subscription plumbing, so scattered deep reads carry the same conditional-subscription risk:

```tsx
render() {
  const { count, step, increment } = this;

  return <button onClick={increment}>{count} (+{step})</button>;
}
```

An injected parent (`inbox = get(Inbox)`) is part of that snapshot - reach it and its nested values thru `this`:

```tsx
render() {
  const {
    selected,
    info: { sender, subject },
    inbox: {
      searching,
    },
  } = this;
  ...
}
```

Calling `Inbox.get()` inside `render()` when the class already holds the field opens a second hook subscription to the same instance. Static `Type.get()` belongs in freestanding FCs, which have no `this`.

## Inheritance and Custom Primitives

Build reusable base classes; extend to specialize.

```tsx
abstract class Toggle extends Component {
  active = false;

  toggle() {
    this.active = !this.active;
  }

  // Subclasses override to customize each state
  Active(): ReactNode {
    return null;
  }
  Inactive(): ReactNode {
    return null;
  }

  render() {
    return (
      <div onClick={this.toggle}>
        {this.active ? <this.Active /> : <this.Inactive />}
      </div>
    );
  }
}

class DarkModeSwitch extends Toggle {
  Active() {
    return <span>Dark</span>;
  }
  Inactive() {
    return <span>Light</span>;
  }
}

class Accordion extends Toggle {
  title = 'Details';

  Inactive() {
    return <h3>{this.title}</h3>;
  }
  Active() {
    return (
      <>
        <h3>{this.title}</h3>
        <div>{this.props.children}</div>
      </>
    );
  }
}
```

Base owns behavior + structure, subclass fills in rendering: `<DarkModeSwitch />`, `<Accordion title="FAQ">...</Accordion>`.

## Render Composition

A subclass `render()` **composes** with the base instead of replacing it. Each `render()` up the prototype chain wraps the one below, base-outermost, with inner output passed as `props.children`. No `super.render()`.

```tsx
class Frame extends Component {
  render(props = {} as { children?: ReactNode }) {
    return (
      <section className="frame">
        <header>Frame</header>
        {props.children}
      </section>
    );
  }
}

class Page extends Frame {
  body = 'Hello';

  render() {
    return <p>{this.body}</p>;
  }
}

// <Page /> renders:
// <section class="frame"><header>Frame</header><p>Hello</p></section>
```

Deeper levels nest the same way - each subclass becomes its parent's `children`. Every layer binds to the same live instance and reactive `this`. A base primitive owns shared chrome/suspense/context once; subclasses author only content.

Extend only when the subclass *is a kind of* the base (`Nav` is a `Link`). An add-on - resize, collapse, drag - wraps as a mounted Component (`<Resize>{children}</Resize>`): extending parks the add-on's fields on the subclass's every snapshot, and removing it means rewriting the class rather than dropping the wrap.

`render` is sealed at bootstrap as the **single** composition seam - every other member (methods, getters, subcomponents, lifecycle hooks) overrides with standard replace semantics. Rationale: a reactive base's render is chrome *plus subscriptions and boundaries* the subclass needs, and override-with-`super.render()` makes every subclass remember the call - one forgotten `super` silently drops the base's boundaries. Composing lets the base own its chrome exactly once (see [design.md](../design.md)).

**Footgun:** a wrapper render that never reads `props.children` silently drops everything below it - and since the `children` getter is lazy, the dropped layer never runs. A base meant to wrap subclasses must declare a `props` parameter and render `props.children`.

### Letting a subclass replace the base (opt-out of wrapping)

A base can *defer* to a subclass's render instead of wrapping it - for a leaf primitive (an `<a>`, an `<input>`) usable alone yet fully overridable. The base decides, not the subclass: it detects subclass content and returns it as-is.

The signal is identity - composition synthesizes a fresh `children` getter, so when a subclass authored a render, the `children` the base receives differs from `this.props.children`:

```tsx
class Link extends Component {
  to = '';

  render({ children, ...rest } = {} as Link.Props) {
    // A subclass authored its own render; it arrives as our `children`
    // (base render is outer). Defer to it instead of wrapping in an anchor.
    if (children !== this.props.children) return children;

    return <a {...rest} href={this.to}>{children}</a>;
  }
}

// <Link to="/x">hi</Link>      -> <a href="/x">hi</a>   (base renders)
// class Nav extends Link { render() { return <a className="nav" .../> } }
// <Nav to="/x">hi</Nav>        -> <a class="nav" .../>   (base defers)
```

Plain `<Link>` and render-less subclasses (`class Foo extends Link {}`) keep the anchor - their `children` *is* `this.props.children`.

A subclass can't unilaterally refuse wrapping - that would turn legitimate wrapping into a runtime error and require knowing its ancestor's behavior. Keeping the choice in the base preserves "works standalone *and* overridable."

**React hooks in a render layer.** Reactivity comes from `this`, so hooks are rarely needed, but allowed. The composed chain runs in a single host render, so all layers' hooks stack into one component - fine if the chain as a whole obeys the rules of hooks. A hook in a layer below a wrapper that *conditionally* renders `props.children` runs only sometimes and breaks them. When a layer needs isolated hooks/subscription/boundary, make it a PascalCase subcomponent (`<this.Panel />`) - each is its own component; render layers fold into one.

## Persistent Instance

Instances survive across renders. `this` is stable - store references, pass `this` to external objects, hold imperative state (Sets, Maps, DOM refs).

```tsx
class ChatRoom extends Component {
  messages: Message[] = [];
  url = '';

  mount() {
    const socket = new WebSocket(this.url);
    socket.onmessage = (e) => {
      this.messages = [...this.messages, JSON.parse(e.data)];
    };
    return () => socket.close();
  }

  render() {
    return (
      <ul>
        {this.messages.map((m) => (
          <li key={m.id}>{m.text}</li>
        ))}
      </ul>
    );
  }
}
```

- `is` prop - construction-time, fires once: `<ChatRoom is={c => controller = c} />`. Use when the instance is needed during construction.
- `ref` - Component is a real class component, so `ref` receives the instance after mount and clears to `null` on unmount: `<ChatRoom ref={chatRef} />`. Use for post-mount imperative access.

## Props

State fields become optional JSX props, applied to the instance every render.

```tsx
class Greeting extends Component {
  name = 'World';
  render() {
    return <h1>Hello, {this.name}!</h1>;
  }
}

<Greeting name="React" />;
```

### Render Props

Extra props (beyond state fields) via a `render()` parameter:

```tsx
class Card extends Component {
  title = '';

  render(props = {} as { className: string }) {
    return <div className={props.className}>{this.title}</div>;
  }
}

<Card title="Hello" className="card" />;
```

Non-optional render props become required JSX attributes. All props (state + render + special) are on `this.props`.

### Special Props

- `is` - callback receiving the instance on creation: `<Counter is={c => ref = c} />`
- `ref` - standard React ref (object or callback), attached after mount, cleared on unmount
- `fallback` - ReactNode for suspense/error UI, overrides the instance property; `false` opts out of the component's own boundary so suspension bubbles to an ancestor

## Children and Context

Instances auto-provide to React context. Without `render()`, children pass through the provider:

```tsx
class App extends Component {
  user = 'Alice';
}

function Profile() {
  const app = App.get();
  return <p>{app.user}</p>;
}

<App>
  <Profile />
</App>;
```

## Suspense

`fallback` displays while render or children are suspended:

```tsx
class DataView extends Component {
  data = set<string>(); // undefined until set - suspends render

  fallback = (<span>Loading...</span>);

  render() {
    return <span>{this.data}</span>;
  }
}
```

`fallback={false}` declines the component's own boundary so suspension bubbles to an ancestor - valid only when the pending value is owned **above** the catching boundary. A boundary rebuilds the subtree it retries, so state owned below is reconstructed on every retry and requests again: a silent infinite retry loop.

## Transitions

`pending()` marks work non-urgent - React keeps current content on screen while a replacement gets ready instead of falling back to `fallback`. Writes inside are ordinary; the designation rides with the subscriber updates they queue, including for state this component does not own.

```tsx
import { Component, pending } from '@expressive/react';

class Shell extends Component {
  busy = false;

  go(to: string) {
    this.busy = true;
    pending(() => {
      data.page = to;
    }).then(() => {
      this.busy = false;
    });
  }
}
```

- The returned promise settles once every reader (not just the first) has **absorbed** the work - after a suspended replacement commits, not when the write lands.
- Writes inside run immediately; only notification defers.
- A reader that does not claim absorption settles on replay.
- Scheduling and settlement are independent - an adapter without concurrent deferral may still claim through commit.

**Where the flag is read matters.** The flag is written urgently, so its readers re-render while the work is in flight - reading deferred state at the value already written. A component reading both jumps ahead of the held screen; one that *rebuilds* the deferred content suspends, replacing the screen the deferral meant to keep. Read the flag from a sibling of that content, or from a wrapper receiving it as `children` - both leave its element untouched, so it holds.

```tsx
const Status = () => <b>{Shell.get().busy ? 'loading' : 'idle'}</b>;

const Lock = ({ children }) => (
  <fieldset disabled={Shell.get().busy}>{children}</fieldset>
);

class Shell extends Component {
  render() {
    return <><Status /><Lock><Screen /></Lock></>;
  }
}
```

`Lock` re-renders urgently and disables the outgoing screen; `<Screen />` is the element it already rendered, so it holds. Reading `busy` in `Shell` itself would rebuild `<Screen />` on the same urgent pass - the one arrangement that fails.

## Error Boundaries

Override `catch()` to handle child render errors:

```tsx
class SafeView extends Component {
  async catch(error: Error) {
    this.fallback = <span>Something went wrong</span>;
    // Fallback shown while pending. On resolve, render retries.
    await reportError(error);
  }

  render() {
    return <RiskyComponent />;
  }
}
```

- `this.fallback` set in `catch()` shows error UI, reverted after recovery.
- Rejected `catch()` propagates to the parent boundary.
- Sync `catch()` retries immediately.
- A repeated throw after recovery propagates out.

## Subcomponents

PascalCase methods become reactive React components scoped to `this`:

```tsx
class Dashboard extends Component {
  items = ['a', 'b', 'c'];
  title = 'My Dashboard';

  Sidebar() {
    return (
      <ul>
        {this.items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    );
  }

  Header() {
    return <h1>{this.title}</h1>;
  }

  render() {
    return (
      <div>
        <this.Header />
        <this.Sidebar />
      </div>
    );
  }
}
```

- Each usage subscribes to the parent and accepts props like any component.
- Reachable from context: `Dashboard.get()` then `<dashboard.Sidebar />`.
- **Overridable by subclasses.**
- Destructure what the body reads from `this` at the top, as in `render()`.

Subcomponents are **extension points**, not a general decomposition tool. Test: **would a subclass reasonably replace or wrap this renderer?** If yes - `Toggle.Active`, a grid's `Row`, chrome a theme variant swaps - use a subcomponent. If no, it is an implementation scope: a freestanding FC calling `Dashboard.get()`, keeping dependencies local without the override machinery. Decomposing a busy `render()` into those costs nothing:

```tsx
function SidebarItems() {
  const { items } = Dashboard.get();

  return (
    <ul>
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}
```

## Lifecycle

- `new()` - once after init, synchronously; runs during server render. Return cleanup for teardown.
- `render(props)` - every render.
- `mount()` - once when `<MyComponent />` commits, client only. Return cleanup for unmount. Not called for an instance placed as `{instance}` - the placing component does not own it (see [react.md](react.md)).
- `catch(error)` - error boundary.
- Destruction on unmount or `this.set(null)`.

`MyComponent.use()` throws - a Component is rendered (`<MyComponent />` or `{instance}`), not used. For a bare instance use `MyComponent.new()`.

Anything touching `window`, timers or subscriptions belongs in `mount()`, not `new()`:

```tsx
class Viewport extends Component {
  width = 0;

  mount() {
    const measure = () => (this.width = window.innerWidth);

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }

  render() {
    return <span>{this.width}px</span>;
  }
}
```

## ref() for DOM Access

`ref()` returns a ref callback running imperative setup; return a cleanup.

```tsx
class VideoPlayer extends Component {
  element = ref<HTMLVideoElement>((el) => {
    el.play();
    return () => el.pause();
  });

  render() {
    return <video ref={this.element} src={this.src} />;
  }

  src = '';
}
```

## Strict Mode

One instance despite double-mount.
