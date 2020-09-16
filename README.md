
<h1 align="center">
  deep-state
</h1>

<h4 align="center">
  Accessible control for anywhere and everywhere in your (p)React apps
</h4>
 
<p align="center">
  <a href="https://www.npmjs.com/package/deep-state"><img alt="NPM" src="https://badge.fury.io/js/deep-state.svg"></a>
  <a href=""><img alt="Build" src="https://shields-staging.herokuapp.com/npm/types/deep-state.svg"></a>
</p>
<br/>

<p align="center">
  With this, <code>use()</code> simple classes as <i>View-Controllers</i>
  to power your UI. <br/>
  Special hooks manage renders for you, as needed, for any data.<br/>
  When properties update, your components will too.<br/>
</p>

<br/>

### Contents 

<!-- Manual bullets because I don't like default <li> -->

&emsp; •&nbsp; **[Overview](#overview-section)** <br/>
&emsp; •&nbsp; **[Install and Import](#install-section)**

### Getting Started 
  &ensp; •&nbsp; [The basics](#concept-simple) <br/>
  &ensp; •&nbsp; [Destructuring](#concept-destruct) <br/>
  &ensp; •&nbsp; [Methods](#concept-method) <br/>
  &ensp; •&nbsp; [Getters](#concept-getters) <br/>
  &ensp; •&nbsp; [Constructor](#concept-constructor) <br/>
  &ensp; •&nbsp; [Applied Props](#method-uses) <br/>

**Dynamics** <br/>
  &ensp; •&nbsp; [Lifecycle](#concept-lifecycle) <br/>
  &ensp; •&nbsp; [Events](#concept-events) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [Listening](#concept-listen-event) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [Dispatching](#concept-push-event) <br/>
  &ensp; •&nbsp; [Monitored Externals](#method-using) <br/>
  &ensp; •&nbsp; [Async and callbacks](#concept-async) <br/>

**Sharing** <br/>
  &ensp; •&nbsp; [Context](#concept-context) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [Provider](#concept-provider) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [MultiProvider](#concept-provider-multi) <br/>
  &ensp; •&nbsp; [Singletons](#concept-singleton) <br/>

**Accessing** <br/>
  &ensp; •&nbsp; [Hooks](#concept-hooks) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`get` (unbound)](#method-get) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`tap` (one-way)](#method-tap) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`sub` (two-way)](#method-sub) <br/>

**Applied State** <br/>
  &ensp; •&nbsp; [Managed Elements](#concept-managed) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`Value`](#component-value) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`Input`](#component-input) <br/>
  
**Structuring** <br/>
  &ensp; •&nbsp; [Applied Typescript](#concept-typescript) <br/>
  &ensp; •&nbsp; [Simple Composition](#concept-compose) <br/>
  &ensp; •&nbsp; [Child Controllers](#concept-children) <br/>
  &ensp; •&nbsp; [Peer Controllers](#concept-peers) <br/>

**Extension** <br/>
  &ensp; •&nbsp; [Super-Controllers](#concept-super) <br/>
  &ensp; •&nbsp; [Using Meta](#concept-meta) <br/>

### API
  &ensp; •&nbsp; [Controller](#api-controller) <br/>
  &ensp; •&nbsp; [Singleton](#api-singleton) <br/>
  &ensp; •&nbsp; [Patterns](#api-patterns) <br/>
  &ensp; •&nbsp; [Reserved](#api-reserved) <br/>
  &ensp; •&nbsp; [Lifecycle](#api-lifecycle) <br/>

### Internal Concepts
  &ensp; •&nbsp; [Subscriptions](#concept-lazy) <br/>
  &ensp; •&nbsp; [Auto Debounce](#concept-debounce) <br/>

<br/>

<h2 id="overview-section">Overview</h2>

With deep-state, you can create and use javascript classes as controllers (via hooks) within any, or many, React components. 

When built-in methods on a `Controller` class are used, an instance is either found or created, specially for the mounted component *(your View)*. By noting what's used at render, the hook *(a Controller)* can keep values up-to-date, following properties defined by your class *(the Model)*.

This behavior combines with actions, computed properties, events, and the component itself allowing for a [(real this time)](https://stackoverflow.com/a/10596138) **M**odel-**V**iew-**C**ontroller development pattern.

<br/>

<h2 id="install-section">Installation</h2>

Install with your preferred package manager
```bash
npm install --save deep-state
```

Import and use in your react ([or preact!](https://preactjs.com)) apps.

```js
import VC from "deep-state";
```

> **Note:** `VC` here is short for (View) `Controller`, which is the default export.

<br/>

<h1 id="started-section">Getting Started</h1>

The basic workflow is pretty simple. If you know [MobX](https://mobx.js.org/README.html) this will look pretty familiar, but also *a lot* more straight-forward.

1. Create a class and fill it with the values, getters, and methods you'll need.
2. Extend `Controller` (or any derivative, for that matter) to make it "observable".
3. Within a component, call one of the built-in methods, as you would any [React hook](https://reactjs.org/docs/hooks-intro.html).
4. Destructure out values, in a component, for controller to detect and subscribe to.
5. Update those values on demand. Your component will keep sync automagically. ✨
<br/><br/>

### Some Definitions

> The following is a guided crash-course to help get you up to speed (hopefully) pretty quick.<br/>
Here are some library-specific terms which will be good to know.

<details>
  <summary><ins>Tutorial Glossary</ins></summary><br/>

  - **`VC`**: Alias for `Controller`, the core class powering most of deep-state.
  - **Model**: Any class you'll write extending `VC`; the definition for a type of controller.
  - **State**: An instance of your model, usable to a live component.
  - **Controller**: The logic (inherited from `VC`) in an instance of state, managing its behavior.
  - **View**: A defined function-component which may be mounted and can accept hooks.
  - **Element**: Invocation of a component/view, actively mounted with a state and lifecycle.
  - **Subscription**: An open channel to deep-state's communication engine, managing events.
  
</details>
<br/>

<h2 id="concept-simple">Simplest use-case</h2>

Let's make a stateful counter.

```jsx
import VC from "deep-state";

class Counter extends VC {
  number = 1
}
```
```jsx
const KitchenCounter = () => {
  const state = Counter.use();

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
<a href="https://codesandbox.io/s/deep-state-simple-e3xcf"><sup>View in CodeSandbox</sup></a>

Make a class with properties we wish track. Values defined in the constructor (or as class properties) serve as initial/default state. 
 
Attached to your class is the static method `use`. This is a hook; it will create a new instance of your state and bind it to a component.

Now, as values on this instance change, our hook will trigger new renders! You may recognize this as "one-way binding".

<br/>

<h2 id="concept-destruct">Destructuring</h2>

Because of how [subscriptions](#concept-subscription) work, a good idea is to destructure values intended for the component. To cover normal pitfalls, you'll see a **`set`** and **`get`** added to the returned state.

> Not to be confused with the keywords. Just properties, they are both a circular reference to state.

### `set`

The usual downside to destructuring is you can't use it for assignments. To solve this, we have `set` for updating values on the full state.

```jsx
const KitchenCounter = () => {
  const { number, set } = Counter.use();

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

### `get`

Good for bracket-notation (i.e. `get["property"]`), and avoiding clutter where necessary. 

Also, the main way to ignore updates. <br/>

Usually, when you read an observable value directly, a controller will assume you want to refresh anytime that property changes. In a lot of situations, this isn't the case, and so `get` serves as a bypass.

Use this when using values from inside a closure, such as callbacks and event-handlers.

<br/>

<h2 id="concept-method">Adding methods</h2>

What's a controller without some methods? Let's add some *actions* [(similar to that of MobX)](https://mobx.js.org/refguide/action.html) to easily abstract changes to our state.

```jsx
class CountControl extends VC {
  number = 1

  // Note that we're using arrow functions here.
  // We'll need a bound `this`.
  increment = () => { this.number++ };
  decrement = () => { this.number-- };
}
```


> You may notice this approach is also more efficient. These handlers won't make new closures every time we render now. 😬

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

With this you can write even the most complex components, all while maintaining key benefits of a functional-component, being much easier on the eyeballs.

<br/>

<h2 id="concept-getters">What about getters?</h2>

Deep-state does have a strong equivalent to *computed* properties [(ala MobX again)](https://mobx.js.org/refguide/computed-decorator.html).

Simply define the getters you need and they will be automatically managed by the controller. Computed when first accessed, they will be actively kept in-sync thereafter.

Through the same mechanism as hooks, getters know when properties they access are updated. Whenever that happens, they rerun. If a new value is returned, it will be passed forward to own listeners.

```ts
const round = Math.floor;

class Timer extends VC {
  seconds = 0;
 
  constructor(){
    super();
    setInterval(() => this.seconds++, 1000);
  }

  get minutes(){
    return round(this.seconds / 60);
  }

  get hours(){
    // getters can also subscribe to other getters 🤙
    return round(this.minutes / 60);
  }

  get format(){
    const { seconds } = this;
    const hr = round(seconds / 3600);
    const min = round(seconds / 60) % 60;
    const sec = seconds % 60;

    return `${hr}:${min}:${sec}`;
  }
}
```

<br/>

> **Important Caveat:** Controller getters are cached, facing the user. They will only run when a dependency changes, and **not** upon access (besides initially) as you might except.

Getters run whenever the controller thinks they *could* change, so design them with three guiding principles:
- Getters should be *deterministic*. Only expect a change where inputs have changed.
- Avoid computing from values which change a lot, but don't affect output as often.
- [GWS](https://www.youtube.com/watch?v=0i0IlSKn0sE "Goes Without Saying") but, **side-effects are a major anti-pattern**, and could cause infinite loops.

<br/>

<h2 id="concept-constructor">Custom arguments</h2>

The method `use(...)`, as it creates the control instance, will pass its own arguments to the class's constructor. This makes it easy to customize the initial state of a component.

> Typescript 
```ts
class Greetings extends VC {
  firstName: string;
 
  constructor(name: string){
    super();

    this.firstName = name.split(" ")[0];
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

Besides `use`, there are similar methods able to assign props after a controller is created. This is a great alternative to manually distributing values, as we did in the example above.

<h3 id="method-uses"><code>.uses({ ... }, greedy?)</code></h3>

After constructing state, something similar to `Object.assign(this, input)` is run. However based on value of `greedy`, this will have one of three biases.

- Default: greedy is **undefined**
  - only properties already `in` state (as explicitly `undefined` or some default value) will be captured 
- If greedy is **true**
  - all properties of `input` will be added, and made observable if not already.
- If greedy is **false**
  - only properties explicitly `undefined` on state (just after construction) will be overridden.



```js
class Greetings extends VC {
  name = undefined;
  birthday = undefined;

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

### ✅ Level 1 Clear!
> In this chapter we learned the basics of how to create and utilize a custom state. For most people, who simply want smart components, this could even be enough! However, we can make our controllers into much more than just some fancy hooks.

<br/>

<h1 id="managing-section">Managing your state</h1>

So far, all of our example controllers have been passive. Here we'll give our controller a bigger roll, by pushing updates without direct user interaction.

Because state is just a class-instance, we can do whatever we want to values, and more-crucially, whenever. This makes asynchronous coding pretty low maintenance. We handle the logic of what we want and `Controller` will handle the rest.

Here are a few concrete ways though, to smarten up your controllers:<br/><br/>


<h2 id="concept-lifecycle">Lifecycle</h2>

Deep-state hooks can automatically call a number of "special methods" you'll define on your class, to handle certain "events" within components.

```jsx
class TimerControl extends VC {
  elapsed = 1;

  componentDidMount(){
    this.timer = 
      setInterval(() => this.elapsed++, 1000)
  }

  /** remember to cleanup ♻ */
  componentWillUnmount(){
    clearInterval(this.timer);
  }
}
```
> De ja vu... could swear that looks awfully familiar... 😏👆
```jsx
const MyTimer = () => {
  const { elapsed } = TimerControl.use();

  return <pre>{ elapsed }</pre>;
}
```

You can see all the available lifecycle methods **[here](#lifecycle-api)**.

<!-- <sup><a href="https://codesandbox.io/s/example-counter-8cmd3">View in CodeSandbox</a></sup> -->

<br />

<h2 id="concept-events">Events Handling</h2>

Beyond watching for state-change, what a subscriber really cares about is events. *Updates are just one cause for an event.* Whenever a property on your state gains a new value, subscribers are simply being notified.

While usually it will be a view-controller waiting to refresh a component, anything can subscribe to an event via callbacks. If this event *is* caused by a property update, its new value will serve as an `argument`; if synthetic, that will be up to the dispatcher.
<br /><br />

<h3 id="concept-listen-event">Listening for events</h3>

```js
const callback = (value, name) => {
  console.log(`${name} was updated with ${value}!`)
}
```

#### `.on(name, callback) => onDone`

Instances of `Controller` have an `on` method, which will register a new listener to a given key. `callback` will be fired when the managed-property `name` is updated, or when a synthetic event is sent.

The method also returns a callback, with which you can kill the messenger. &nbsp; 👀 Worth noting however, you will not need to at (target) `willDestroy` or `componentWillUnmount` events, as listener will be stopped naturally.

#### `.once(name, callback) => onCancel`

There is also a `once` method. Naturally, it will delete itself after being invoked. You can cancel it though, with the returned callback.

#### `.once(name) => Promise<value>`

If `callback` is not provided, `once` will return a Promise instead, which resolves the next value (or argument) `name` receives.

#### `.watch(arrayOfNames, callback, once?) => onStop`

A more versatile method `watch` can be used to monitor one or multiple keys with the same callback.
<br /><br />

<h3 id="concept-builtin-event">Listening for built-in events</h3>

Controllers will also dispatch lifecycle events for both themselves and that of bound components.

All events share names with their respective methods, [listed here](#lifecycle-api).
<br /><br />

<h3 id="concept-push-event">Pushing your own events</h3>

#### `.update(name, argument?)`

Fire a synthetic event; it will be sent to all listeners of `name`, be them subscribed controllers or one of the listener above.
This can have slightly tweaked behavior depending on the occupied-status of a given key.

- no property exists: 
  * Explicit subscribers will receive the event; controllers cannot.
- Property exists:
  - **no argument:** Subscribers will force-refresh, listeners will get current value.
  - **has argument:** Property will be overwritten, listeners get new value.
- property is a getter:
  - **no argument:** Getter will force-compute, listeners get output regardless if new.
  - **has argument:** Cache will be overwritten (compute skipped), listeners get said value.

<br />

Events make it easier to design around closures, keeping as few things on your base-state as possible. Event methods can also be used externally, for other code to interact with!
<br /><br />

### Event handling in-practice:

```js
class Counter extends VC {
  seconds = 0;

  alertMinutes = (minutes) => {
    alert(`${minutes} minutes have gone by!`)
  }

  tickTock = () => {
    if(seconds % 2 == 1)
      console.log("tick")
    else
      console.log("tock")

    if(seconds % 60 === 0){
      // send 'minutes' event (optionally, with an argument)
      this.update("minutes", Math.floor(seconds / 60));
    }
  }

  componentDidMount(){
    const timer = setInterval(() => this.seconds++, 1000);
    const timerDone = () => clearInterval(timer);

    // run callback every time 'seconds' changes
    this.on("seconds", this.tickTock);

    // run callback when 'minutes' event is sent
    this.on("minutes", this.alertMinutes);

    // run callback when unmount is sent by controller
    // using events, we avoid needing a separate method
    this.once("componentWillUnmount", timerDone);
  }
}
```

<br />

<h2 id="concept-async">Monitoring external values</h2>

Sometimes you'll want to detect changes in some outside-info, usually props. Watching outside values does require you integrate them as part of your state, however we do have a handy helper for this.

<h3 id="method-using"><code>.using({ ... }, greedy?)</code></h3>

> If you remember [`uses`](#concept-passing-props), this has almost the exact same behavior.

This method helps integrate outside values by repeatedly assigning `input` properties **every render**. Because the observer will only react to *new* values, this makes for a fairly efficient way to observe props. We can combine this with getters and event-listeners, to do all sorts of things when inputs change.

Like `uses`, this method is naturally picky and will only capture values which are predefined. We do have the `greedy` flag though, which behaves exactly [the same](#concept-passing-props).

<br />

```ts
class ActivityTracker {
  active = undefined;

  componentDidMount(){
    this.on("active", is => {
      if(is === true)
        alert("Tracker prop became active!")
    })
  }
}
```

<br />

<h2 id="concept-async">Working with async and callbacks</h2>

Because dispatch is taken care of, all we need to do is edit values as needed. This makes the asynchronous stuff like timeouts, promises, and fetching a piece of cake.

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

### 👾 Level 2 Clear!


> Sidebar, notice how our component remains completely independent from the logic sofar; it's a pretty big deal. <br/>If we wanted to modify or even duplicate our `ActionSequence`, says in a different language or with a new aesthetic, we don't need to copy, or even edit, *any* of these actual behaviors. 🤯

<br/>

<h1 id="sharing-section">Sharing state</h1>

One of the most significant features of deep-state is an ability to share state with any number of subscribers, be them components or peer controllers. Whether you want state from up-stream or to be usable app-wide, you can with a number of simple abstractions.

In this chapter we will cover how to create and cast state for use by components and peers. It's in the [next chapter](#access-section) though, where we'll see how to access them.

<br/>

<h2 id="managing-section">Sharing with Context</h2>

By default, a `Controller` is biased towards context as it's sharing mechanism. You probably guessed this, but through a managed [React Context](https://frontarm.com/james-k-nelson/usecontext-react-hook/) can we create and consume a single state inside a component hierarchy.


Let's go over the ways to create a controller and insert it into context, for more than one component. There is nothing you need to do, on the model, to make this work.

```ts
export class Central extends VC {
  foo = 0;
  bar = 0;

  incrementFoo = () => this.foo++;
};
```

> We start with a sample controller class, nothing too special. We'll be reusing it for the following examples.

<!-- <sup><a href="https://codesandbox.io/s/example-multiple-accessors-79j0m">View in CodeSandbox</a></sup>  -->

<br/>

<h3 id="managing-section"><code>Provider</code> (instance property)</h3>

Another reserved property on a controller instance is `Property`. Within the context of a component, this should be visible. Wrap it around elements making up the component, to declare your state for down-stream.

```jsx
export const App = () => {
  const { Provider } = Control.use();

  return (
    <Provider>
      <InnerFoo/>
      <InnerBar/>
    </Provider>
  )
}
```

<h3 id="managing-section"><code>Provider</code> (class property)</h3>

Assume we don't need special construction, or any other values in the parent component. <br/> With the `Provider` class-property, we can create both new a state and its context provider in one go!
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

<h3 id="managing-section"><code>MultiProvider</code></h3>

<br/>

<h2 id="managing-section">Singleton Controller</h2>

<br/>

<h1 id="access-section">Accessing state</h1>
<br/>

<h2 id="managing-section">Hooks</h2>
<h3 id="managing-section"><code>get()</code></h3>


<h3 id="managing-section"><code>tap()</code></h3>

> With the method `.tap`, rather than making a new `Central` controller, will obtain the nearest one
```jsx
const InnerFoo = () => {
  const { incrementFoo, bar } = Central.tap();

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
  const { set, foo } = Central.tap();

  return (
    <div onClick={() => set.bar++}>
      <pre>Bar</pre> 
      <small>Foo was clicked {foo} times!</small>
    </div>
  )
}
```

<h3 id="managing-section"><code>sub()</code></h3>

<br/>

<h2 id="managing-section">Managed Elements</h2>
<h3 id="managing-section"><code>&lt;Value/&gt;</code></h3>
<h3 id="managing-section"><code>&lt;Input/&gt;</code></h3>

<br/>

<h1 id="managing-section">Structuring your state</h1>

Another core purpose of deep-state, and using classes, is to "dumb down" the state you are writing. Ideally we want controllers to be really good at **one** thing, and be able to cooperate with other controllers as an ecosystem.

> **This** is how we'll build better performing, easier to-work-with applications, even with the most complex of behavior.

Here we'll go over, in broad strokes, some of the ways to structure state harmoniously.

<br/>

<h2 id="concept-typescript">Controllers & Typescript</h2>

Remember to code responsibly. This goes without saying, but typescript is your friend. With controllers you can enjoy full type safety and inference, even within components themselves.

> Typescript

```ts
import Controller from "deep-state";

class FunActivity extends VC {
  /** Interval identifier for cleaning up */
  interval: number;

  /** Number of seconds that have passed */
  secondsSofar: number;

  constructor(alreadyMinutes: number = 0){
    super();

    this.secondsSofar = alreadyMinutes * 60;
    this.interval = setInterval(
      () => this.secondsSofar++,
      1000
    )
  }

  /** JSDocs too can help provide description beyond simple 
   * autocomplete, making it easier reduce, reuse and repurpose. */
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

<h2 id="concept-compose">Simple composition <small>(and separation of concerns)</small></h2>

There is nothing preventing you from use more than one controller in a component! Take advantage of this to create cooperating smaller state, rather than big, monolithic state.

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


<h2 id="managing-section">Child Controllers</h2>
<h2 id="managing-section">Peer Controllers</h2>

<br/>

<h1 id="sharing-section">Extending state</h1>

<h2 id="managing-section">Super Controllers</h2>
<h2 id="managing-section">Using Meta</h2>

<br/>

<h1>Concepts</h1>


<h2 id="concept-lazy">Subscription based "lazy" updating</h2>

Controllers use a subscription model to decide when to render, and will **only** refresh for values which are actually used. They do this by watching property access *on the first render*, within a component they hook up to.

That said, while hooks can't actually read your function-component, destructuring is a good way to get consistent behavior. Where a property *is not* accessed on initial render render (inside a conditional or ternary), it could fail to update as expected.

Destructuring pulls out properties no matter what, and so prevents this problem. You'll also find also reads a lot better, and promotes better habits.

<br/>

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


> Here `LazyComponent` will not update when `bar` does change, because it only accessed `foo` here. 
<!-- <sup><a href="https://codesandbox.io/s/example-explict-watch-zyo5v">View in CodeSandbox</a></sup> -->


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

<h2 id="controller-api">Controller</h2>

Set behavior for certain properties on classes extending `Controller`.

While standard practice is for `use` to take all methods (and bind them), all properties (and watch them), there are special circumstances to be aware of. <br /><br />

<h2 id="singleton-api">Singleton</h2>

Set behavior for certain properties on classes extending `Controller`.

While standard practice is for `use` to take all methods (and bind them), all properties (and watch them), there are special circumstances to be aware of. <br /><br />



<h2 id="pattern-api">Pattern</h2>

#### `Arrays`
- if a property is an array, it will be forwarded to your components as a special `ReactiveArray` which can also trigger renders on mutate.

#### `isProperty`
- Properties matching `/is([A-Z]\w+)/` and whose value is a boolean will get a corresponding action `toggle$1`.


#### `_anything`
- if a key starts with an underscore it will not trigger a refresh when overwritten (or carry any overhead to do so). No special conversions will happen. It's a shorthand for "private" keys which don't interact with the component.

#### `Anything defined post-constructor`
- important to notice that `use()` can only detect properties which exist (and are enumerable) at time of creation. If you create them after, they're also ignored.

<br />

<h2 id="reserved-api">Reserved</h2>

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

<h2 id="lifecycle-api">Lifecycle</h2>

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

# License

MIT license. <br/>
