
<h1 align="center">
  deep-state
</h1>

<h4 align="center">
  Accessible control for anywhere and everywhere in your (p)React apps
</h4>
 
<p align="center">
  <a href="https://www.npmjs.com/package/react-use-controller"><img alt="NPM" src="https://badge.fury.io/js/react-use-controller.svg"></a>
  <a href=""><img alt="Build" src="https://shields-staging.herokuapp.com/npm/types/react-use-controller.svg"></a>
</p>
<br/>

<p align="center">
  With this, <code>use()</code> simple classes as a <i>ViewController</i>
  for your UIs. <br/>
  Special hooks manage renders, as needed, for any data.<br/>
  When properties update, your components will too!<br/>
</p>

<br/>

### Contents 

&emsp; • **[Overview](#overview-section)** <br/>
&emsp; • **[Install and Import](#install-section)**

**Getting Started** <br/>
  &ensp; • [Basics](#concept-simple) <br/>
  &ensp; • [Destructuring](#concept-destruct) <br/>
  &ensp; • [Methods](#concept-method) <br/>
  &ensp; • [Getters](#concept-getters) <br/>
  &ensp; • [Constructor](#concept-constructor) <br/>
  &ensp; • [Passing Props](#method-uses) <br/>
  &ensp; • [Watching Props](#concept-constructor) <br/>

**Managing state** <br/>
  &ensp; • [Lifecycle](#concept-lifecycle) <br/>
  &ensp; • [Async & Events](#concept-async) <br/>
  &ensp; • [TypeScript](#concept-typescript) <br/>
  &ensp; • [Context](#concept-context) <br/>

**Concepts** <br/>
  &ensp; • [Use less `useState`](#concept-compare) <br/>
  &ensp; • [Simple Composition](#concept-compose) <br/>
  &ensp; • [Lazy Updating](#concept-lazy) <br/>
  &ensp; • [Auto Debounce](#concept-debounce) <br/>

**API** <br/>
  &ensp; • [Hooks](#hooks-api) <br/>
  &ensp; • [Controller](#property-api) <br/>
  &ensp; • [Subscriber](#subscribe-api)

<br/>

<h2 id="overview-section">Overview</h2>

With deep-state, you can create and use javascript classes as controllers (via hooks) within any, or many, React components.

When built-in methods on a `Controller` class are used, an instance is either found or created, specially for a mounted component *(your View)*. By noting what's accessed at render, the hook *(a Controller)* can keep values up-to-date with properties defined by your class *(your Model)*.

This behavior combines with actions, computed properties, events, and the component itself allowing for a [(real this time)](https://stackoverflow.com/a/10596138) **M**odel-**V**iew-**C**ontroller development pattern.

<br/>

<h2 id="install-section">Installation</h2>

Install with your preferred package manager
```bash
npm install --save deep-state
```

Import and use in your react apps.

```js
import VC from "deep-state";
```

> **Note:** `VC` here is short for (View) `Controller`, which is the default export.

<br/>

<h1 id="started-section">Getting Started</h1>

The basic workflow is pretty simple. If you know [MobX](https://mobx.js.org/README.html) this will look pretty familiar, but also *way* more straight-forward.

1. Create a class and fill it with whatever values, getters, and methods you'd like.
2. Extend `Controller` (or any derivative, for that matter) to make it "observable".
3. Within a component, use any  of the built-in methods, as you would a [React hook](https://reactjs.org/docs/hooks-intro.html).
4. Destructure out values you need, for internal hooks to detect and subscribe to.
5. Update those values as needed. Your component will keep sync automagically. ✨
<br/><br/>

<h2 id="concept-simple">Simplest use-case</h2>

Let's make a stateful counter.

```jsx
import VC from "deep-state";

class CountControl extends VC {
  number = 1
}
```
```jsx
const KitchenCounter = () => {
  const state = CountControl.use();

  return (
    <div>
      <span
        onClick={() => state.number -= 1}>
        {"−"}
      </span>
      <pre>{ state.number }</pre>
      <span 
        onClick={() => state.number += 1}>
        {"+"}
      </span>
    </div>
  )
}
```
<!-- <a href="https://codesandbox.io/s/example-simple-wf52i">View in CodeSandbox</a> -->

First, make a class with properties we wish track. Values defined in the constructor (or as class properties) serve as an initial/default state. 
 
Attached to your class is the static-method `use`. This is a hook, which will create a new instance and bind it to your component; naturally, it will also destroy on unmount. 

Now, as values on this instance change, our hook will automatically trigger new renders; you may recognize this as "one-way binding".

<br/>

<h2 id="concept-destruct">Destructuring</h2>

Because of how [subscriptions](#concept-subscription) work, it's a good idea to destructure values you intend to use in a given component. 

The usual downside here though, is needing the original reference in order to update values. This is why two reserved keys `get` and `set` are added automatically; with them we can still access the full object.

> Not to be confused with keywords. Just named properties, they are both are the same, a circular reference to the full state. Use whichever in-practice makes the most sense.

```jsx
const KitchenCounter = () => {
  const { number, set } = CountControl.use();

  return (
    <div>
      <span
        onClick={() => set.number -= 1}>
        {"−"}
      </span>
      <pre>{ number }</pre>
      <span 
        onClick={() => set.number += 1}>
        {"+"}
      </span>
    </div>
  )
}
```
<!-- <sup><a href="https://codesandbox.io/s/example-event-vsmib">View in CodeSandbox</a></sup> -->

> `set.number` See what we did there? 🤔

<br/>

<h2 id="concept-method">Adding methods</h2>

What's a controller without some methods? Add some *actions* [(similar to that of MobX)](https://mobx.js.org/refguide/action.html) to easily abstract changes to our state.

```jsx
class CountControl extends VC {
  number = 1

  // Note that we're using arrow functions here.
  // We'll need a bound `this`.
  increment = () => { this.number++ };
  decrement = () => { this.number-- };
}
```


> You may notice this approach is also more efficient, similar to `useCallback`, the callbacks aren't closured every render like before. 😬

```jsx
const KitchenCounter = () => {
  const { number, decrement, increment } = CountControl.use();

  return (
    <Row>
      <Button onClick={decrement}>{"-"}</Button>
      <Box>{number}</Box>
      <Button onClick={increment}>{"+"}</Button>
    </Row>
  )
}
```
<!-- <sup><a href="https://codesandbox.io/s/example-actions-1dyxg">View in CodeSandbox</a></sup> -->

> With this you can write even the most complex components, all while maintaining key benefits of a functional-component (being much easier on the eyes).

<br/>

<h2 id="concept-getters">What about getters?</h2>

Got you fam. Deep-state has a strong equivalent to `@computed` [(ala MobX again)](https://mobx.js.org/refguide/computed-decorator.html)

Define any getters you want and they will be managed automatically by the controller. They will compute the first time they are accessed, and stay synced in both directions.

> Similar to hooks, getters will know when properties they access are updated. Whenever that happens, they rerun. If a new value is returned, it will pass the change forward to own listeners.

```ts
const { floor } = Math;

class Timer extends VC {
  seconds = 0;
 
  constructor(){
    super();
    setInterval(() => this.seconds++, 1000);
  }

  get minutes(){
    return floor(this.seconds / 60);
  }

  get hours(){
    return floor(this.minutes / 60);
  }

  get format(){
    const { seconds } = this;
    const hr = floor(seconds / 3600);
    const min = floor(seconds / 60) % 60;
    const sec = seconds % 60;

    return `${hr}:${min}:${sec}`;
  }
}
```

> Notice `hours` getter is recursive with `minutes`.<br/> Yep, getters can even subscribe to other getters.

<br/>

<h2 id="concept-constructor">Using outside values</h2>

The method `use(...)`, as it creates the control instance, will also pass its own arguments to the constructor. This makes it easy to customize the initial state of a component.

> Typescript 
```ts
class Greetings extends VC {
  firstName: string;
 
  constructor(name: string){
    super();

    this.firstName = 
      this.name.split(" ")[0];
  }
}
```
```jsx
const MyComponent = ({ name }) => {
  const { firstName } = Greetings.use(name);

  return <b>Hello {firstName}!</b>;
}
```
<!-- <sup><a href="https://codesandbox.io/s/example-constructor-params-22lqu">View in CodeSandbox</a></sup> -->

<br/>

<h2 id="concept-passing-props">Passing props to your controller</h2>

Besides `use`, there are similar methods able to assign props after creating a controller. This is a great alternative to manually distributing values, as we had done in the example above.

<h3 id="method-uses"><code>.uses({ ... })</code></h3>

After constructing state, an analog to `Object.assign(this, props)` is run.<br/> Enumerable properties of `props` will be set (and made observable, if not already) within the controller.

> Typescript
```ts
class Greetings extends VC {
  name: string;
  birthday: string;

  get firstName(){
    return this.name.split(" ")[0];
  }

  get isBirthday(){
    const td = new Date();
    const bd = new Date(this.birthday);

    return (
      td.getMonth() === bd.getMonth() &&
      td.getDate() === bd.getDate()
    )
  }
}
```

```jsx
const HappyBirthday = (props) => {
  const { firstName, isBirthday } = Greetings.uses(props);

  return (
    <big>
      <span>Hi {firstName}<\span>
      {isBirthday &&
        <b> happy birthday!</b>
      }!
    </big>
  );
}
```

```jsx
const SayHello = () => (
  <HappyBirthday
    name="John Doe"
    birthday="September 19"
  />
)
```
<!-- <sup><a href="https://codesandbox.io/s/example-constructor-params-22lqu">View in CodeSandbox</a></sup> -->

<br/>
<br/>

<h1 id="managing-section">Managing your state</h1>

So far, all of our example controllers have been passive. Let's spice things up by controlling state from within the controller itself.<br/><br/>

<h2 id="concept-lifecycle">Lifecycle methods</h2>

The `use()` hook can automatically call certain [lifecycle events](#lifecycle-list) which may be defined on your class as methods.

> Deja-vu, this looks kinda familar to something...
```jsx
class TimerControl extends VC {
  elapsed = 1;

  componentDidMount(){
    this.timer = 
      setInterval(() => this.elapsed++, 1000)
  }

  /** remember to cleanup too! ♻ */
  componentWillUnmount(){
    clearInterval(this.timer);
  }
}
```
```jsx
const MyTimer = () => {
  const { elapsed } = TimerControl.use();

  return <pre>{ elapsed }</pre>;
}
```
<!-- <sup><a href="https://codesandbox.io/s/example-counter-8cmd3">View in CodeSandbox</a></sup> -->

<br />

<h2 id="concept-async">Working with callbacks, and async</h2>

Let's get fancy and add a few more moving parts. You'll notice this setup can do a lot, all while remaining pretty modular! 💪

```ts
class StickySituation extends VC {

  surname = "bond";
  remaining = 60;

  componentDidMount(){
    this.timer = setInterval(this.tickTock, 1000);
  }

  componentWillUnmount(){
    this.cutTheDrama()
  }

  tickTock = () => {
    const timeLeft = --this.remaining;
    if(timeLeft === 0)
      this.cutTheDrama();
  }

  cutTheDrama(){
    clearInterval(this.timer);
  }

  getSomebodyElse = async () => {
    const res = await fetch("https://randomuser.me/api/");
    const data = await res.json();
    const [ recruit ] = data.results;

    this.surname = recruit.name.last;
  }
}
```

> Like this, our component remains completely independant from the controller. <br/> If say, we wanted to change or even duplicate our `ActionSequence`, in a different language or new aestetic, we won't need to copy-paste any of the actual behavior. 🤯

```jsx
const ActionSequence = () => {
  const {
    getSomebodyElse,
    remaining,
    surname
  } = StickySituation.use();

  if(remaining === 0)
    return <h1>{"🙀💥"}</h1>

  return (
    <div>
      <div>
        Agent <b>{surname}</b> we need you to diffuse the bomb!
      </div>
      <div>
        If you can't diffuse it in {remaining} seconds, 
        the cat may or may not die!
      </div>
      <div>
        <span>But there is time! </span>
        <u onClick={getSomebodyElse}>Tap another agent</u> 
        <span> if you think they can do it.</span>
      </div>
    </div>
  )
}
```
<!-- <sup><a href="https://codesandbox.io/s/example-async-effbq">View in CodeSandbox</a></sup> -->

<br/>

<h2 id="concept-typescript">Using with typescript</h2>

Code responsibly. With controllers you can enjoy full type safety and inference, even within components themselves.

> Typescript

```ts
import Controller from "react-use-controller";

class FunActivity extends VC {
  interval: number;
  secondsSofar: number;

  constructor(alreadyMinutes: number = 0){
    super();
    this.secondsSofar = 
      alreadyMinutes * 60;

    this.interval = 
      setInterval(() => {
        this.secondsSofar++;
      }, 1000)
  }

  /* JSDocs on the Controller class will provide descriptors and 
   * autocomplete, making it easier to avoid weird behavior over typos. */
  willUnmount(){
    clearInterval(this.interval)
  }
}
```
```jsx
const PaintDrying = ({ alreadyMinutes }) => {
  /* Your IDE will know `alreadyMinutes` is supposed to be a number */
  const { secondsSofar } = FunActivity.use(alreadyMinutes);

  return (
    <div>
      I've been staring for like, { secondsSofar } seconds now, 
      and I'm starting to see what this is all about! 👀
    </div>
  )
}
```
<!-- <sup><a href="https://codesandbox.io/s/example-typescript-n21uj">View in CodeSandbox</a></sup> -->

<br/>

<h1 id="concept-context">Access state anywhere <sup>(with context!)</sup></h1>

One of the best features of `Controller` is the use of managed [Context](https://frontarm.com/james-k-nelson/usecontext-react-hook/), to create and consume a single state within a hierarchy. 

Of the available static properties, `.Provider` will return just-that to wrap child components with, which may access the parent via same easy hooks. Components within can call the static-method `.get()` on the same class to use the nearest instance of that class.

> Thanks to [lazy-updating](#lazy-concept), only properties used by a consumer will trigger a render in that particular component. 

Another benefit of this, is that actions are made available anywhere in your hierarchy, letting distant components cleanly affect each other, via a shared controller.

<br/>

> Create your controller as usual.
```jsx
export class Central extends VC {
  foo = 0;
  bar = 0;

  incrementFoo = () => this.foo++ 
};
```
> With the `Provider` property, we can easily create both its a state and context in one go!
```jsx
export const App = () => {
  return (
    <Control.Provider>
      <InnerFoo/>
      <InnerBar/>
    </Control.Provider>
  )
}
```
> Now the with the method `.get`, rather than making a new `Central` controller, will obtain the nearest one
```jsx
const InnerFoo = () => {
  const { incrementFoo, bar } = Central.get();

  return (
    <div onClick={incrementFoo}>
      <pre>Foo</pre>
      <small>Bar was clicked {bar} times!</small>
    </div>
  )
}
```
> **Remember:** Controller knows this component needs to update only when foo changes. Lazy subscription ensures only the properties accessed here are refreshed here!
```jsx
const InnerBar = () => {
  const { set, foo } = Central.get();

  return (
    <div onClick={() => set.bar++}>
      <pre>Bar</pre> 
      <small>Foo was clicked {foo} times!</small>
    </div>
  )
}
```
<!-- <sup><a href="https://codesandbox.io/s/example-multiple-accessors-79j0m">View in CodeSandbox</a></sup>  -->

<br/>
<br/>

<h1 id="concept-compare">Concepts</code></h1>
<br/>

<h2 id="concept-compare">Using less <code>useState</code></h2>

The main rational of use-controller is to reduce, if not eliminate the need for multiple hooks in a functional-component. When working on complex state, hooks loose a lot of their appeal to raw messiness.<br/>

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
> Here is heck-ton of vars, inherently hard to scale or modify.

### So how can we fix that?

Simple, make a class containing state (*the model*) and supply it to the `use()` hook.

```jsx
class EmotionalState {
  name = "John Doe"
  emotion = "meh"
  reason = "reasons"
}

const WhatsUp = () => {
  const { name, emotion, reason, set } = use(EmotionalState);

  return (
    <div>
      <div onClick = {() => 
        set.name = prompt("What is your name?", "John Doe") }>
        My name is {name}.
      </div>
      <div>
        <span onClick = {() => 
          set.emotion = "doing better" }>
          I am currently {emotion}
        </span>
        <span onClick = {() => 
          set.reason = "hooks are cooler than my cold-brew coffee! 👓" }>
          , because {reason}.
        </span>
      </div>
    </div>
  )
}
```
<!-- <sup><a href="https://codesandbox.io/s/example-mulitple-values-dg6w0">View in CodeSandbox</a></sup> -->

> With a controller, we can do a lot better on scope. Here we've separated out our model (state) from the view (component) which is pretty nice.

Add as many values as you like, and they'll stay clean and _relatively_ organized in your code. (You'll still need good design!)

<br/>

<h2 id="concept-compose">Simple composition <small>(and seperation of concerns)</small></h2>

There is nothing preventing you from calling `use` more than once, or making use of other hooks at the same time. 

```js
  class PingController extends VC {
    value = 1
  }
  
  class PongController extends VC {
    value = 2
  }

  const ControllerAgnostic = () => {
    const ping = PingController.use();
    const pong = PongController.use();

    return (
      <div>
        <div
          onClick={() => { ping.value += pong.value }}>
          Ping's value is ${ping.value}, click me to add in pong!
        </div>
        <div
          onClick={() => { pong.value += pong.value }}>
          Pong's value is ${pong.value}, click me to add in ping!
        </div>
      </div>
    )
  }
```
<!-- <sup><a href="https://codesandbox.io/s/example-simple-compose-dew5p">View in CodeSandbox</a></sup> -->

> There may be better ways to do it, but calling multiple controllers still can be a great way to separate concerns. 

<br/>

<h2 id="concept-lazy">Subscription based "lazy" updating</h2>

Controllers use a subscription model to decide when to render. Through automatic subscription, components will **only** update for changes to values which are actually accessed.

> Here `LazyComponent` will not update when `bar` does change, because it *seems* to only access `foo` here. 

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
<!-- <sup><a href="https://codesandbox.io/s/example-explict-watch-zyo5v">View in CodeSandbox</a></sup> -->

### Automatic inference 

Instances of a controller can figure out what to subscribe to automatically. They do it by spying on what's **accessed on the initial render** of a component they hook into.

> **Recommended**: While `use` cannot read your functions, destructuring by default is a good way to get consistent behavior. If a property is not accessed on initial render render (being within an `if` statement or ternary), it could fail to update as expected. Destructuring pulls out properties no matter what, so helps in this regard.

<!-- ### Explicit subscription

There are also a number of helper methods you can call to specify which properties you wish to watch. <br/>
Check them out in [Subscription API](#subscription-api) section. -->

<br/>

<h2 id="concept-debounce">Automatic debouncing</h2>

Rest assured. Changes made synchronously are batched as a single new render.

```jsx
class ZeroStakesGame {
  foo = "bar"
  bar = "baz"
  baz = "foo"

  shuffle = () => {
    this.foo = "???"
    this.bar = "foo"
    this.baz = "bar"

    setTimeout(() => {
      this.foo = "baz"
    }, 1000)
  }
}
```
```jsx
const MusicalChairs = () => {
  const { foo, bar, baz, shuffle } = use(ZeroStakesGame);

  return (
    <div>
      <span>Foo is {foo}'s chair!</span>
      <span>Bar is {bar}'s chair!</span>
      <span>Baz is {baz}'s chair!</span>

      <div onClick={shuffle}>🎶🥁🎶🎷🎶</div>
    </div>
  )
}
```
<!-- <sup><a href="https://codesandbox.io/s/example-debouncing-sn1mq">View in CodeSandbox</a></sup> -->

> Even though we're ultimately making four updates, `use()` only needs to re-render twice. It does so once for everybody (being on the same tick), resets when finished, and again wakes for `foo` when settled all in.

<br/>
<br/>

<h1>API</h1>
<br/>

<h2 id="hooks-api">Hooks</h2>



<h2 id="property-api">ModelController</h2>

Set behavior for certain properties on classes extending `Controller`.

While standard practice is for `use` to take all methods (and bind them), all properties (and watch them), there are special circumstances to be aware of. <br /><br />


### Properties

#### `Arrays`
- if a property is an array, it will be forwarded to your components as a special `ReactiveArray` which can also trigger renders on mutate.

#### `isProperty`
- Properties matching `/is([A-Z]\w+)/` and whose value is a boolean will get a corresponding action `toggle$1`.


#### `_anything`
- if a key starts with an underscore it will not trigger a refresh when overwritten (or carry any overhead to do so). No special conversions will happen. It's a shorthand for "private" keys which don't interact with the component.

#### `Anything defined post-constructor`
- important to notice that `use()` can only detect properties which exist (and are enumerable) at time of creation. If you create them after, they're also ignored.

<br />

### Reserved

#### `set` / `get`
- Not to be confused with setters / getters.
- `state.set` returns a circular reference to `state`
- this is useful to access your state object while destructuring

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
> Not really recommended after initializing, but could come in handy in a pinch.

<br />

<h3 id="lifecycle-list">LifeCycle Methods (<code>use</code> will call them)</h3>

#### `didMount(): void`
- `use()` will call this while internally running `useEffect(fn, [])` for itself.

#### `willUnmount(): void`
- `use()` will call this before starting to clean up.

#### `didHook(): void`
- Called every render. A way to pipe data in from other hooks.

#### `willHook(): void`
- Called every render. However `this` references actual state only on first render, otherwise is a dummy. <br/>
  Useful for grabbing data without re-evaluating the properties you set in this callback every render. <br/> 
  (e.g. things from `useContext`)

<!--

#### `willRefresh(didUpdate: Updates): void | false | Updates`
- Called before `Controller` requests a render. <br/>
  Passed as an argument is an object with values which triggered the refresh. <br/>
  - If nothing is returned, update will proceed.
  - If a new object with updates is returned, new state will reflect only those changes, and any others will be discarded.
  - If `false` is returned the update will be canceled.

-->

<br/>
<br/>

# Live demos

<br/>

A demo project is in the `/examples` directory with a series of examples you can launch, browse through and modify.

```bash
git clone https://github.com/gabeklein/use-controller.git
cd use-controller
npm install
npm start
```

<br/>

# License

MIT license. <br/>
