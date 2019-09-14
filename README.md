
<h1 align="center">
  react-use-controller
</h1>

<p align="center">
  Easy to use state controllers, turning javascript classes into react super-hooks.
</p>
 
<p align="center">
  <a href="https://www.npmjs.com/package/react-use-controller"><img alt="NPM" src="https://img.shields.io/npm/v/@gabeklein/use-controller.svg"></a>
  <a href=""><img alt="Build" src="https://shields-staging.herokuapp.com/npm/types/react-use-controller.svg"></a>
</p>

<br/>
<p align="center">
  <b>Use any class as a hook-based view controller</b><br/>
  with values, methods, and even some life-cycles ones to control components.
  <p align="center">
  The <code>use()</code> hook refreshes your components as needed, for any data.<br/>
  When values update your component will too.<br/>
</p>

### Contents 

• **[Install and Import](#install-section)**

**[`use`](#started-section) hook (Simple)**
  - [Basic Controller](#concept-basic)
  - [Methods](#concept-method)
  - [Lifecycle](#concept-lifecycle)
  - [Destructuring](#concept-destruct)
  - [Debouncing](#concept-debounce)
  - [Lazy Updating](#concept-lazy)

**[`Controller`](#controller-section) (Advanced)**
  - [Constructor Arguments](#concept-constructor)
  - [Context](#concept-context)
  - [TypeScript](#concept-typescript)

• **[Why better than hooks?](#compare-section)** <br/>
• **[Property API](#property-api)** <br/>
• **[Subscriber API](#subscribe-api)**

<br/>

<h2 id="install-section">Installation</h2>

<br />

Install with your preferred package manager
```bash
npm install --save react-use-controller
```

Import and use in your react apps.

```js
import { use, Controller } from "react-use-controller";
```

> Note: `Controller` is also the default export!

<br/>

<h1 id="started-section">Getting Started</h1>

There are two ways to use a view controller, supply any class to the `use` hook or [extend it with `Controller`](#controller-section). <br/>
Both ways behave pretty much the same, though extending has some key benefits.

> It is generally recommended to extend, but for simple cases, `use` is helpful for its brevity.

<br/>

<h2 id="concept-simple">Simplest use-case</h2>

Let's make a stateful counter component.

```jsx
import { use } from "react-use-controller";

/* Put together any class, with as many values as you want. 
 * They'll be tracked for updates and trigger renders as needed. */
class CountControl {
  number = 1
}

const KitchenCounter = () => {
  /* Pass that class to `use()`,
   * it will create and return a new instance, bound to your component-instance. */
  const state = use(CountControl);

  /* Simply modify properties directly to trigger a new render. */
  return (
    <Row>
      <Button
        onClick={() => { state.number -= 1 }}>
        {"-"}
      </Button>
      <Box>{state.number}</Box>
      <Button 
        onClick={() => { state.number += 1 }}>
        {"+"}
      </Button>
    </Row>
  )
}
```

<br/>

<h2 id="concept-method">Adding methods</h2>

What's a view controller without its methods? Add some ["actions"](https://mobx.js.org/refguide/action.html) to easily abstract changes to your state.

```jsx
class CountControl {
  number = 1

  /* We can edit state directly using `this`.
   * Notice these are arrow functions and `this` is bound */
  increment = () => this.number++;
  decrement = () => this.number--;
}
```

```jsx
const KitchenCounter = () => {
  /* You can destructure for cleaner code, */
  const { number, decrement, increment } = use(CountControl);

  /* and pass bound-callbacks directly from the instance. */
  return (
    <Row>
      <Button onClick={decrement}>{"-"}</Button>
      <Box>{number}</Box>
      <Button onClick={increment}>{"+"}</Button>
    </Row>
  )
}
```

<br/>

<h2 id="concept-lifecycle">Lifecycle methods</h2>

The `use()` hook will automatically call built-in [lifecycle helper methods](#lifecycle-list) when appropriate.
```jsx
import React from "react";

class TimerControl {
  elapsed = 1;

  /* Automatically called from an internal `useEffect()` */
  didMount(){
    this.timer = 
      setInterval(
        () => this.elapsed++, 
        1000
      )
  }

  willUnmount(){
    /* remember to cleanup too! */
    clearInterval(this.timer);
  }
}
```

```jsx
const KitchenTimer = () => {
  const state = use(TimerControl);

  return <Box>{state.elapsed}</Box>;
}
```

<!-- > Technically, this does also work with `use()`, but it's still recommended you extend your classes. <br/> 
> It's safer and more consistent, for anything but the simplest of controllers. -->

<br />

<h2 id="concept-destruct">Destructuring</h2>

Not only can you destructure easily enough, with two reserved keys `get` and `set`, we can still retrieve and update values even after doing so.

> These are the same, just a circular reference to full `state`. Use whatever makes the most sense semantically.

```jsx
const AboutMe = () => {
  const {
    set, // ⬅ a proxy for `state`
    name
  } = use(AboutYou);

  return (
    <div onClick = {() => {
      set.name = window.prompt("What is your name?", "John Doe");
    }}>
      My name is {name}.
    </div>
  )
}
```

> See what we did there? 🤔

<br/>

<h2 id="concept-debounce">Automatic debouncing</h2>

Rest assured. Updates you make synchronously will be batched together as only one update.

```jsx
class ZeroStakesGame {
  foo = "bar"
  bar = "baz"
  baz = "foo"

  shuffle(){
    this.foo = "???"
    this.bar = "foo"
    this.baz = "bar"

    setTimeout(() => {
      this.foo = "baz"
    }, 1000)
  }
}

const MusicalChairs = () => {
  const { foo, bar, baz, shuffle } = use(ZeroStakesGame);

  <span>Foo is {foo}'s chair!</span>
  <span>Bar is {bar}'s chair!</span>
  <span>Baz is {baz}'s chair!</span>

  <div onClick={shuffle}>🎶🥁🎶🎷🎶</div>
}
```

> Even though we're ultimately making four updates, `use()` only needs to re-render twice. It does so once for everybody (being on the same tick), resets, and again wakes for `foo` when settled all in.

<br/>

<h2 id="concept-lazy">Subscription based "lazy" updating</h2>

Controllers uses a subscription model to decide when to render. Through automatic subscription, elements will **only** update for changes to values which are accessed on the first render.

> Here, unlike regular use, `.use()` will not bother to update `LazyComponent` when `bar` does change, because it only subscribes to `foo` here. 


```jsx
class FooBar {
  foo = "bar"
  bar = "foo"
}

const LazyComponent = () => {
  const { set, foo } = use(FooBar);

  return (
    <h1 
      onClick={() => set.bar = "baz" }>
      Foo is {foo} but click here to update bar!
    </h1>
  )
}
```

### Automatic subscription

Instances of `use()` can figure out what to subscribe to automatically. They do it by spying on what's **accessed on the initial render** of a component they hook into.

**NOTE**: This does mean that it's generally recommended to always destructure. If a property is not accessed every render (within an `if` statement or ternary), it may not be detected!


### Explicit subscription

There are a number of helper methods you can call to specify which properties you wish to watch. <br/>
Check them out in [Subscription API](#subscription-api) section.

<br/>

<h1 href="controller-section">The <code>Controller</code> superclass</h1>

While you get a lot from `use()` and standard (or otherwise extended) classes, there's a few key benefits in actually extending `Controller`.

- You can pass arguments to your constructor
- Type inferences are maintained, making type-checking a lot better
- Nuance your updates (explicit subscription based rendering)
- Generate a linked `Provider`, making state accessible anywhere.
- An optional error-boundary (Coming Soon)

<br/>

> To use, rather than passing a class into `use`, extend it with `Controller` and call any static-method hooks.

```jsx
import Controller from "react-use-controller"

class Control extends Controller {
  value = 1;
}
```
```jsx
const Component = () => {
  const { value } = Control.use();

  return <div>{value}</div>;
}
```
> `.use` will hook your component and construct state only once, the same as standard `use` would.

<br/>

<h2 id="concept-constructor">Passing arguments to constructor</h2>

By extending Controller, the static method `use()` will pass its arguments to the constructor, while creating a new instance. 

```typescript
/* typescript */

class Control extends Controller {
  value: number;

  constructor(init: number){
    this.value = init;
  }
}
```
```jsx
const Component = ({ initial }) => {
  const { value } = Control.use(initial);

  return <div>{value}</div>;
}
```

<br/>

<h2 id="concept-context">Access state anywhere <sup>(with context!)</sup></h2>

One of the best features of `Controller` classes is [using Context](https://frontarm.com/james-k-nelson/usecontext-react-hook/), to create and consume the same state from anywhere in your app. 

Of the available static methods, `.create()` will produce a [Provider](https://reactjs.org/docs/context.html#contextprovider) to wrap child-components with. Components nested can call static-method `.get()` on the same constructor to access the nearest instance of that class.

Thanks to [lazy-updating](#lazy-concept), only properties used in a consumer will trigger render for their component. Plus, actions are made available anywhere in your hierarchy, letting distant components cleanly modify each-other's shared state.


```jsx
export class Central extends Controller {
  foo = 0;
  bar = 0;

  fooUp = () => this.foo++ 
  barUp = () => this.bar++ 
};

export const App = () => {
  /* An alternative to use(), create() will directly return a <Provider> with a new live-state. 
   * If you want values too, you can access { Provider } from .use() as well. */
  const Control = Central.create();

  return (
    <Control>
      <InnerFoo/>
      <InnerBar/>
    </Control>
  )
}
```

```jsx
const InnerFoo = () => {
  /* .get, rather than making a new `Central` controller, 
   * will return the nearest one (in this case from `App`). */
  const { fooUp, bar } = Central.get();

  return (
    <div onClick={fooUp}>
      <pre>Foo</pre>
      <small>Bar was clicked {bar} times!</small>
    </div>
  )
}
```

```jsx
const InnerBar = () => {
  /* Controller knows this component needs to update only when foo changes.
   * Lazy refreshing ensures only properties accessed on initial render are watched here. */
  const { barUp, foo } = Central.get();

  return (
    <div onClick={barUp}>
      <pre>Bar</pre> 
      <small>Foo was clicked {foo} times!</small>
    </div>
  )
}
```

> This makes context kind of easy a little bit.

<br/>

<h2 id="concept-typescript">Using with typescript</h2>

Importing and extending **Controller** as whatever you like will allow type definitions to pass-through to your controllers definitions.<br/>

> For class `T` the static method `.use()` returns `InstanceType<T>` thus provides full type inference within the component too.

```tsx
/* typescript */

import Controller from "react-use-controller";

class FunActivity extends Controller {
  secondsSofar: number;
  interval: number;

  constructor(alreadyMinutes: number = 0){
    this.secondsSofar = 
      alreadyMinutes * 60;

    this.interval = 
      setInterval(() => {
        this.secondsSofar++;
      }, 1000)
  }

  /* JSDocs on the Controller class will provide yours with useful hints,
   * making it easier to avoid weird behavior due to collisions. */
  willUnmount(){
    clearInterval(this.interval)
  }
}
```

```jsx
const PaintDrying = ({ alreadyMinutes }) => {
  /* Your IDE will know seconds is supposed to be a number 👌 */
  const { secondsSofar } = FunActivity.use(alreadyMinutes);

  return (
    <div>
      I've been staring for like, { secondsSofar } seconds now, 
      and I'm starting to see what this is all about! 👀
    </div>
  )
}
```

<br/>
<br/>

### (If not already convinced)
<h1 id="compare-section">How is this better than regular hooks?</h1>

Here is an example where we have multiple values to track. <br/>
> It's a heck-ton of vars and only adds up.

```jsx
const EmotionalState = () => {
  const [name, setName] = useState("John Doe");
  const [emotion, setEmotion] = useState("meh");
  const [reason, setReason] = useState("reasons.");

  return (
    <div>
      <div onClick = {() => {
        const name = prompt("What is your name?", name);
        setName(name);
      }}>
        My name is {name}.
      </div>
      <div>
        <span onClick = {() => {
          setEmotion("sad");
        }}>
          I am currently {emotion}
        </span>
        <span onClick = {() => {
          setReason("hooks are still not hipster enough.")
        }}>
          , because {reason}.
        </span>
      </div>
    </div>
  )
}
```

### And how can we fix that?

Simple, make a class containing state (*the Model*) and supply it to the `use()` hook.

```jsx
class EmotionalState {
  name = "John Doe"
  emotion = "meh"
  reason = "reasons"
}

const HappyTown = () => {
  const state = use(EmotionalState);

  return (
    <div>
      <div onClick = {() => {
        state.name = prompt("What is your name?", "John Doe");
      }}>
        My name is {state.name}.
      </div>
      <div>
        <span onClick = {() => {
          state.emotion = "doing better"
        }}>
          I am currently {state.emotion} 
        </span>
        <span onClick = {() => {
          state.reason = "hooks are cooler than my cold-brew coffee! 👓"
        }}>
          , because {state.reason}.
        </span>
      </div>
    </div>
  )
}
```

> With a controller, we can do a lot better on the vars. Plus in an [MVC](https://www.tutorialsteacher.com/mvc/mvc-architecture) sense, we've removed our Model (data) out of the View (component)!

This hook's argument, its *constructor*, will only run at mount; and the returned object will be bootstrapped into a live state.

This component now updates when any of your declared values change. Add as many values as you like, and they'll stay clean and relatively organized in your code.

<br/>

<h1 id="property-api">Property API</h1>

Set behavior for certain methods on classes consumed by `use()` or extending `Controller`.

While standard practice is for `use` to take all methods (and bind them), all properties (and watch them), there are special circumstances to be aware of.

<br />

### Properties

#### `set` & `get`
- Not to be confused with setters / getters.
- `state.set` returns a circular reference to `state`
- this is useful to access your state object when destructuring

#### `Arrays`
- if a property is an array, it will be forwarded to your components as a special `ReactiveArray` which can also trigger a render on mutate.


#### `_anything`
- if a key starts with an underscore it will not trigger a refresh when overwritten (or carry any overhead to do so). No special conversions will happen. It's a shorthand for "private" keys which don't interact with the component.

#### `Anything defined post-constructor`
- important to notice that `use()` can only detect properties which exist (and are enumerable) at time of creation. If you create them after, they're effectively ignored.

<br />

### Reserved methods (`use` will define them)

#### `refresh(): void`
- requests a render without requiring that a value has changed. 
- Helpful when working with getters, async and random-number-generators.

#### `export<T>(this: T): { [P in keyof T]: T[P] }`
- takes a snapshot of live state you can pass along, without unintended side effects.
- this will only output the values which were enumerable in the source object.

#### `add(key: string, value?: any): boolean`
- adds a new tracked value to the live-state. 
- this will return `true` if adding the key succeeded, `false` if did not (because it exists).
- setting value is optional, if absent, `key` simply begins watching.
> Not really recommended after initializing, but can come in handy.

<br />

<h3 id="lifecycle-list">LifeCycle Methods (<code>use</code> will call them)</h3>

#### `didMount(): void`
- `use()` will call this while internally running `useEffect(fn, [])` for itself.

#### `willUnmount(): void`
- `use()` will call this before starting to clean up.

<br/> 

<h1 id="subscribe-api">Subscription API</h1>

Chain after `use(...)` or your class to control what values explicitly will trigger a new render if-changed.

> if you have constructor arguments chain after `use(...)` or `get()`, <br />
> if not you can also call a `"useX"` / `"getX"` for brevity.

<br/>

#### `.use(...).on()` / `.useOn()`

Declare properties you want to do want to watch, in addition to inferred properties.

```js
const View = (props) => {
  const state = Controller.use(props).on("bar");

  return state.foo && (
    <span>{state.bar}</span>
  );
}
```
> This will refresh when either `foo` or `bar` change, even if `foo` starts out false.

<br/>

#### `.use(...).only()` / `.useOnly()`

Declare the properties you wish to renew for. This will skip automatic inference.

```js
const View = () => {
  const control = Controller.useOnly("foo", "bar");
  // ...
}
```

<br/>

#### `.use(...).not()` / `.useExcept()`

Declare properties you want to exclude. *May also be chained with `on()`*

```js
const View = () => {
  const { foo, bar } = Controller.useExcept("bar");

  return <span>{foo}</span>;
}
```
> This will only update when `foo` is updated, even though `bar` is definitely accessed.

<br/>

#### `.use(...).once()` / `.useOnce()`

Will disable all but explicit `.refresh()` from this particular controller.

```js
const View = () => {
  const { foo, bar } = Controller.useOnce("bar");

  return false;
}
```
> This generates state, but never automatically updates.

<br/>
<br/>

# Good Examples


### • The Special Mission

```jsx
class StickySituation extends Control {
  remaining = 60;
  surname = "bond";

  didMount(){
    this._timer = 
      setInterval(() => {
        const remains = this.remaining -= 1
        if(remains == 0)
          cutTheDrama();
      }, 1000);
  }

  willUnmount(){
    this.cutTheDrama()
  }

  cutTheDrama(){
    clearInterval(this._timer);
  }

  getSomebodyElse(){
    fetch("https://randomuser.me/api/")
    .then(res => res.json())
    .then(data => data.results[0])
    .then(recruit => {
      this.surname = recruit.name.last
    })
  }
}
```

```jsx
const ActionSequence = () => {
  const { remaining, surname, getSomebodyElse } = StickySituation.use();

  if(remaining == 0)
    return <h1>🙀💥</h1>

  return (
    <div>
      <div>Agent <b>{surname}</b> we need you to diffuse the bomb!</div>
      <div>
        If you can't diffuse it in {remaining} seconds, the cat may or may not die!
      </div>
      <div>
        But there is time! 
        <u onClick={getSomebodyElse}>
          Tap another agent
        </u> 
        if you think they can do it.
      </div>
    </div>
  )
}
```

<br/>

# Live demos

<br/>

Try it for yourself! Demo project is in the `/examples` directory with a series of examples you can launch, browse through and modify.

```bash
git clone https://github.com/gabeklein/use-controller.git
cd use-controller
npm install
npm start
```

<br/>

### 🚧 More ideas are currently under construction, so stay tuned! 🏗

<br/>

# License

MIT license. <br/>