<br/>

<p align="center">
  <img height="90" src="./assets/logo.svg" alt="Expressive Logo"/>
  <h1 align="center">
    Expressive MVC
  </h1>
</p>

<h4 align="center">
  Accessible control for anywhere and everywhere in React apps
</h4>
 
<p align="center">
  <a href="https://www.npmjs.com/package/@expressive/react"><img alt="NPM" src="https://badge.fury.io/js/%40expressive%2Freact.svg"></a>
  <a href=""><img alt="Build" src="https://shields-staging.herokuapp.com/npm/types/@expressive/react.svg"></a>
</p>

<p align="center">
  Easy-to-<code>use()</code> classes to help
  power your UI. <br/>
  Builtin hooks will manage renders, as needed, for any data.<br/>
  When properties change, your components will too.<br/>
</p>

<br/>

<h1 id="overview-section">Overview</h1>

Expressive lets classes define state and logic for components, via built-in hooks.

When the methods on a **Model** are called inside a component **(a View)**, an instance is either created or found for its use. By watching what values are accessed on render, the hook itself **(a Controller)** can refresh to keep sync with them.

This behavior combines with actions, computed properties, events, and the component itself allowing for a [(real this time)](https://stackoverflow.com/a/10596138) **M**odel-**V**iew-**C**ontroller pattern within React.

<br/>

# Contents 

<!-- Manual bullets because I don't like default <li> -->

### Introductions
  &ensp; •&nbsp; **[Install and Import](#install-section)** <br/>
  &ensp; •&nbsp; [A Simple Example](#good-start) <br/>

**Getting Started** <br/>
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
  &ensp;&ensp;&ensp; ◦&nbsp; [Built-in](#concept-builtin-events) <br/>
  &ensp; •&nbsp; [Monitored Externals](#concept-external) <br/>
  &ensp; •&nbsp; [Async and callbacks](#concept-async) <br/>

**Sharing** <br/>
  &ensp; •&nbsp; [Basics](#concept-sharing) <br/>
  &ensp; •&nbsp; [Provider](#concept-provider) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [Spawning](#concept-provider-spawning) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [With props](#concept-provider-props) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [Multiple](#concept-provider-multi) <br/>

**Globals** <br/>
  &ensp; •&nbsp; [Singletons](#section-global) <br/>
  &ensp; •&nbsp; [Initialize](#section-singleton-activate) <br/>

**Consuming** <br/>
  &ensp; •&nbsp; [Hooks](#concept-consumer-hooks) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`get`](#method-get) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`tap`](#method-tap) <br/>
  &ensp; •&nbsp; [Consumer](#concept-consumer) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [render](#consumer-render) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`get` prop](#consumer-get) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`tap` prop](#consumer-tap) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`has` prop](#consumer-has) <br/>
  
**Composition** <br/>
  &ensp; •&nbsp; [Simple Composition](#concept-compose) <br/>
  &ensp; •&nbsp; [Ambient Controllers](#concept-ambient) <br/>
  &ensp; •&nbsp; [Child Controllers](#concept-child-model) <br/>
  &ensp; •&nbsp; [Parent Controller](#concept-parent-model) <br/>

<!-- **Customizing** <br/>
  &ensp; •&nbsp; [Extending Custom Models](#concept-extension) <br/>
  &ensp; •&nbsp; [Impact on Context](#concept-extension-context) <br/>
  &ensp; •&nbsp; [Instructions](#concept-instruction) <br/>
  &ensp; •&nbsp; [Custom Hooks](#concept-custom-hooks) <br/>
  &ensp; •&nbsp; [Using Meta](#concept-meta) <br/> -->

**Best Practices** <br/>
  &ensp; •&nbsp; [Documenting and Types](#concept-typescript) <br/>

### Concepts
  &ensp; •&nbsp; [Subscriptions](#concept-lazy) <br/>
  &ensp; •&nbsp; [Auto Debounce](#concept-debounce) <br/>
  <!-- &ensp; •&nbsp; [Selectors](#concept-selectors) <br/> -->

### API
  &ensp; •&nbsp; [Model](#api-controller) <br/>
  &ensp; •&nbsp; [Singleton](#api-singleton) <br/>
  &ensp; •&nbsp; [Reserved](#api-reserved) <br/>
  &ensp; •&nbsp; [Lifecycle](#api-lifecycle) <br/>

<br/>

<h1 id="install-section">Installation</h1>

Install with your preferred package manager
```bash
npm install --save @expressive/react
```

Import and use in your react apps

```js
import Model from "@expressive/react";
```

<br/>

<h1 id="good-start">First Steps</h1>

### Step 1

Create a class to extend `Model` and shape it to your liking.

```js
class Counter extends Model {
  current = 1

  increment = () => { this.current++ };
  decrement = () => { this.current-- };
}
```

### Step 2

Pick a built-in hook, such as `use()`, to make your component stateful.

```jsx
const KitchenCounter = () => {
  const { current, increment, decrement } = Counter.use();

  return (
    <Row>
      <Button onClick={decrement}>{"-"}</Button>
      <Box>{current}</Box>
      <Button onClick={increment}>{"+"}</Button>
    </Row>
  )
}
```

### Step 3
[See it in action]() 🚀  You've already got something usable!

<br/>

<h1 id="started-section">Getting Started</h1>

Ultimately, the workflow is simple.

1. Create a class. Fill it with the values, getters, and methods you'll need.
2. Extend `Model` (or any derivative, for that matter) to make it reactive.
3. Within a component, use built-in methods as you would any normal hook.
4. Destructure the values, used by a component, to subscribe.
5. Update those values on demand. Component will sync automagically. ✨
<br/>

### Glossary

The following is a crash-course to help get you up to speed.<br/>
Here's some library jargon which will be good to know.

 - **Model**: Any class you'll write extending `Model`. Your definition for a type of state.
 - **Controller**: An instance of your model, containing its state and behavior.
 - **State**: The values tracked by a controller, as defined by the model. 
 - **Subscriber**: A hook, or otherwise special callback, responding to updates.
 - **View**: A function-component which can accept hooks, to contain some controller.
 - **Element**: Instance of a component/view, actively mounted with its own state and lifecycle.

<br/>
<br/>
<h2 id="concept-simple">Simplest use-case</h2>

Start with a bare minimum:

```jsx
import Model from "@expressive/react";

class Counter extends Model {
  number = 1
}
```

Define a model with any number of properties needed. Values set in constructor (or class properties) are the initial state.

```js
import { Plus, Minus } from "./components";

const KitchenCounter = () => {
  const state = Counter.use();

  return (
    <div>
      <Minus onClick={() => state.number -= 1} />
      <pre>{ state.number }</pre>
      <Plus onClick={() => state.number += 1} />
    </div>
  )
}
```
<!-- <a href="https://codesandbox.io/s/deep-state-simple-e3xcf"><sup>View in CodeSandbox</sup></a> -->
 
One of the static-methods on your class will be `use`. This is a hook; it will create a new instance of your model and attach it to component.

Now, we may edit instance properties as we see fit. When values change, our hook calls for a refresh as needed.

<br/>

<h2 id="concept-destruct">Destructuring</h2>

[Model hooks are lazy](#concept-lazy), and will only update for values seen to be in-use. 

A good idea is to destructure values. This keeps intent clear, and avoids unexpected behavior.

After destructuring though, we might still need access to full state. For this, a `get` and `set` property are defined as a loop-back.

### `set`

We have `set` to assign new values to state.

```jsx
const KitchenCounter = () => {
  const { number, set } = Counter.use();

  return (
    <div>
      <Minus onClick={() => set.number -= 1} />
      <pre>{ number }</pre>
      <Plus onClick={() => set.number += 1} />
    </div>
  )
}
```
<!-- <sup><a href="https://codesandbox.io/s/example-event-vsmib">View in CodeSandbox</a></sup> -->

> `set.number` See what we did there? 🤔

### `get`

When an observable value is accessed, the controller assumes a refresh is needed anytime that property changes. In plenty of situations, this isn't the case, so `get` serves as an escape-hatch.

```js
const { get: state, value } = Model.use();
```
> Is a nicer (and more stable) way of saying:
```js
const state = Model.use();
const { value } = state;
```
<br/>

> **Good to know:** <br/>
> Reason this works is because returned `state` is a proxy, there to spy on property access. On the other hand, `get` and `set` are direct references to state. 

<br/>

<h2 id="concept-method">Adding methods</h2>

What's a class without methods? Defining "actions" can help delineate state-change.

```jsx
class Counter extends Model {
  current = 1

  // Using arrow functions, to preserve `this`.
  // In-practice, this acts a lot like a useCallback, but better!
  increment = () => { this.current++ };
  decrement = () => { this.current-- };
}
```
With this, you can write even the most complex components, all while maintaining key benefits of a functional-component. Much easier on the eyeballs.

```jsx
const KitchenCounter = () => {
  const { current, decrement, increment } = Counter.use();

  return (
    <Row>
      <Minus onClick={decrement} />
      <pre>{ current }</pre>
      <Plus onClick={increment} />
    </Row>
  )
}
```
<br/>

> **Good to know:** <br/>
> While obviously cleaner, this is also more efficient than inline-functions. Not only do actions have names, we avoid having new closures for every render. This can save _a lot_ of unnecessary rendering downstream, for assumed "new" callbacks. 😬
<!-- <sup><a href="https://codesandbox.io/s/example-actions-1dyxg">View in CodeSandbox</a></sup> -->

<br/>

<h2 id="concept-getters">Computed Values</h2>

State can have dynamic values too, just define get-methods on your model. They will be managed by the controller automatically. 

Through the same mechanism as hooks, getters know when the specific properties they accessed are updated. Whenever that happens, they rerun. If a new value is returned, the update is paid forward.

```js
const { floor } = Math;

class Timer extends Model {
  constructor(){
    super();
    setInterval(() => this.seconds++, 1000);
  }

  seconds = 0;

  get minutes(){
    return floor(this.seconds / 60);
  }

  get hours(){
    // getters can subscribe to other getters as well 🤙
    return floor(this.minutes / 60);
  }

  get format(){
    const hrs = this.hours;
    const min = this.minutes % 60;
    const sec = this.seconds % 60;

    return `${hrs}:${min}:${sec}`;
  }
}
```

A getter's value is cached, facing the user. It will only run when a dependency changes, and **not upon access** as you might expect. However, getters are also lazy, so first access is one exception.

Because getters run whenever the controller thinks they *could* change, make sure to design them with these guiding principles:
- Getters should be deterministic. Only expect a change where inputs have changed.
- Avoid computing from values which change a lot, but don't change output as often.
- [Goes without saying](https://www.youtube.com/watch?v=0i0IlSKn0sE "Goes Without Saying") but, **side-effects are an anti-pattern** and can cause infinite loops.

<br/>

<h2 id="concept-constructor">Constructor arguments</h2>

The method `use(...)`, while building an instance, will pass its arguments to the constructor. This helps to reuse models, by customizing initial state.

> Typescript 
```ts
class Greetings extends Model {
  firstName: string;
  surname: string;
 
  constructor(fullName: string){
    super();

    const [ first, last ] = fullName.split(" ");

    this.firstName = first;
    this.surname = last;
  }
}
```
```jsx
const SayHello = ({ fullName }) => {
  const { firstName } = Greetings.use(fullName);

  return <b>Hello {firstName}!</b>;
}
```
<!-- <sup><a href="https://codesandbox.io/s/example-constructor-params-22lqu">View in CodeSandbox</a></sup> -->

<br/>

<h2 id="concept-passing-props">Assigning props to state</h2>

Besides `use`, similar methods can assign values after a controller is created. This is a great alternative to a manual setup, as we did previously.

<h3 id="method-uses"><code>Model.uses(source, keys?)</code></h3>

```js
class Greetings extends Model {
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
Greetings defines *firstName* & *isBirthday*; however those will depend on *name* and *birthday*, which start out undefined. Pass in the `props` object to help with that.

```jsx
const HappyBirthday = (props) => {
  const { firstName, isBirthday } = Greetings.uses(props);

  return (
    <big>
      <span>Hi {firstName}<\span>
      {isBirthday &&
        <b>, happy birthday</b>
      }!
    </big>
  );
}
```
Now, we can just define those props.
```jsx
const SayHello = () => (
  <HappyBirthday
    name="John Doe"
    birthday="January 1"
  />
)
```
This method is naturally picky and will only capture values already defined (as `undefined` or otherwise). You can however, specify properties to pull from, like so:

```js
const state = Model.uses({ ... }, ["name", "birthday"]);
```

This way, objects containing _more_ than required info may be used, without collisions or polluting state.

<!-- <sup><a href="https://codesandbox.io/s/example-constructor-params-22lqu">View in CodeSandbox</a></sup> -->

<br/>

### ✅ Level 1 Clear!
> In this chapter we learned the basics of how to create and utilize a custom state. For most people who just want smarter components, this could be enough! However, we can go well beyond making just a fancy hook.

<br/>

<h1 id="managing-section">Creating a dynamic state</h1>

So far, all examples have been passive. Now we'll give models a bigger roll, to evolve state without user input.

Because state is a portable object, we can do whatever to values, but more-crucially, whenever. This makes asynchronous coding pretty low maintenance. You implement business-logic; controllers will handle the rest.

Here are a few concrete ways though, to smarten up your models:<br/><br/>

<h2 id="concept-lifecycle">Lifecycle</h2>

Built-in hooks will call a number of "special methods" you define on your model, to handle certain "special events" of their parent component.

```jsx
class TimerControl extends Model {
  elapsed = 1;

  componentDidMount(){
    this.timer = setInterval(() => this.elapsed++, 1000);
  }

  componentWillUnmount(){
    /** remember to cleanup ♻ */
    clearInterval(this.timer);
  }
}
```
> Where have I seen this before?... 🤔
```jsx
const MyTimer = () => {
  const { elapsed } = TimerControl.use();

  return <pre>I've existed for { elapsed } seconds!</pre>;
}
```

You can see all available lifecycle methods **[here](#lifecycle-api)**.

<!-- <sup><a href="https://codesandbox.io/s/example-counter-8cmd3">View in CodeSandbox</a></sup> -->

<br />

<h2 id="concept-events">Event Handling</h2>

Besides state change, what a subscriber really cares about is events. *Updates are just one source for an event.* When any property gains a new value, subscribers are simply notified and act accordingly.

> **Good to know:** <br/>
> All changes to state occure in batches, called frames. Whenever state receives a new value, a zero-second timer starts. Anything to update before it the commit-phase is considered "reasonably syncronous" and included. After that, events are fired, and the controller resets for the next event.

<br />

<h3 id="concept-listen-event">Listening for events manually</h3>

```js
const normalCallback = (value, key) => {
  console.log(`${key} was updated with ${value}!`)
}

const squashCallback = (keys) => {
  console.log(`Update did occure for: ${keys}!`)
}
```

> By default, callbacks are run once for every key/value update, even if multiple happen at the same time. If you'd rather know when an event happens for *any* chosen key, squash will fire once for a given frame, with a list of keys updated.

#### `state.on(key, callback, squash?, once?) => remove`

Register a new listener on given key(s). `callback` will be fired when `state[key]` updates, or a synthetic event is sent.

The method also returns a callback; use to stop subscribing. 

#### `state.once(key, callback, squash?) => cancel`

Will also expire when triggered. May be cancelled with the returned callback.

#### `state.once(key) => Promise<keys[]>`

If `callback` is not provided, will return a Promise of keys watched/updated.

<br />
<h3 id="concept-listen-effect">Define effect for one or more values</h3>

```js
function effectCallback(state){
  this === state; // true

  console.log(`Update did occure in one or more watched values.`)

  return () =>
    console.log(`Another update will occure, cleanup may be done here.`)
}
```

#### `state.effect(effectCallback, keys) => remove`

A more versatile method used to monitor one or more properties with the same callback. Optionally, that callback may return a handler to clean-up, when process repeats.

<br/>

```js
function subscribedCallback(state){
  const { name } = state;

  console.log(`Hello ${name}`)

  return () =>
    console.log(`Goodbye ${name}`)
}
```
#### `state.effect(subscribedCallback) => remove`

If no explicit `keys` are given, effect callback will self-subscribe. Just like a hook, it will detect values touched and automatically update for new ones.

> Note: In order to scan for property access, the effect will always run at-least once.

<br />
<h3 id="concept-push-event">Pushing your own events</h3>

#### `state.update(key)`

Fires a synthetic event; it will be sent to all listeners for keys specified, be them components or listeners above. You can use any `string` or `symbol` as a key. Naturally, any key also defined on state will count as an update.

Events make it easier to design around closures and callbacks, keeping as few things on your model as possible. Event methods may also be used externally, for other code to interact with.
<br /><br />

<h3 id="concept-builtin-event">Listening for built-in events</h3>

Controllers will emit lifecycle events for a bound component (depending on the hook).

> Often lifecycle is critical to a controller's correct behavior. While we do have lifecycle-methods, it is recommended to use events where able. This way, if your class is extended and redefines a handler, yours will still run without needing  `super[event]()`.

Lifecycle events share names with respective methods, [listed here](#lifecycle-api).
<br /><br />

### Event handling in-practice:

```js
class TickTockClock extends Model {
  constructor(){
    super();

    // begin timer after component mounts
    this.once("componentDidMount", this.start);
  }

  seconds = 0;

  get minutes(){
    return Math.floor(seconds / 60);
  }

  tickTock(seconds){
    if(seconds % 2 == 1)
      console.log("tick")
    else
      console.log("tock")
  }

  logMinutes(minutes){
    if(minutes)
      console.log(`${minutes} minutes have gone by!`)
  }

  start(){
    const self = setInterval(() => this.seconds++, 1000);
    const stop = () => clearInterval(self);

    // run callback every time 'seconds' changes
    this.on("seconds", this.tickTock);

    // run callback when 'minutes' returns a new value
    this.on("minutes", this.logMinutes);

    // run callback when component unmounts
    this.once("componentWillUnmount", stop);
  }
}
```

> We saved not only two methods, but kept interval in scope, rather than a property. Pretty clean!

<br />

<h2 id="concept-external">Watching external values</h2>

Sometimes, you might want to see changes coming from outside, usually coming in via props. Observing any value will require that you integrate it, however after that, consuming is easy.

<h3 id="method-using"><code>Model.using(source, keys?)</code></h3>

> Roughly equivalent to [`uses()`](#concept-passing-props)

This method helps "watch" props by assigning argument properties on *every render*. Because controller only reacts to new values, this makes for a simple way to watch props. Combine this with getters and event-listeners, to do things when inputs change.

<br />

```ts
class ActivityTracker {
  active = undefined;

  get status(){
    return this.active ? "active" : "inactive";
  }

  constructor(){
    super();

    this.on("active", (yes) => {
      if(yes)
        alert("Tracker just became active!")
    })
  }
}
```
```jsx
const DetectActivity = (props) => {
  const { status } = ActivityTracker.using(props);

  return (
    <big>
      This element is currently {status}.
    </big>
  );
}
```

> **Note:** Method is also picky (ala `uses`), and will ignore values which don't already exist in state.

```jsx
const Activate = () => {
  const [active, setActive] = useState(false);

  return (
    <div onClick={() => setActive(!active)}>
      <DetectActivity active={active} />
    </div>
  )
}
```
With this, we can interact with all different sorts of state!

<br />

<h2 id="concept-async">Working with async and callbacks</h2>

Because dispatch is taken care of, we can focus and edit values however we need to. This makes the asynchronous stuff like timeouts, promises, callbacks, even [Ajax](https://www.w3schools.com/xml/ajax_xmlhttprequest_send.asp) a piece of cake.

```ts
class StickySituation extends Model {
  agent = "Bond";
  remaining = 60;

  constructor(){
    super();
    
    this.once("componentWillMount", this.missionStart);
  }

  missionStart(){
    const timer = setInterval(this.tickTock, 1000);

    // events can be any string or symbol
    // we can even wait for more than one!
    this.once(["componentWillUnmount", "oh no!"], () => {
      clearInterval(timer);
    });
  }

  tickTock = () => {
    const timeLeft = this.remaining -= 1;

    if(timeLeft === 0)
      this.update("oh no!");
  }

  getSomebodyElse = async () => {
    const res = await fetch("https://randomuser.me/api/");
    const data = await res.json();
    const recruit = data.results[0];

    this.agent = recruit.name.last;
  }
}
```
```jsx
const ActionSequence = () => {
  const {
    agent,
    getSomebodyElse,
    remaining
  } = StickySituation.use();

  if(remaining === 0)
    return <h1>🙀💥</h1>

  return (
    <div>
      <div>
        <b>Agent {agent}</b>, we need you to diffuse the bomb!
      </div>
      <div>
        If you can't do it in {remaining} seconds, 
        Schrödinger's cat may or may not die!
      </div>
      <div>
        But there's still time! 
        <u onClick={getSomebodyElse}>Tap another agent</u> 
        if you think they can do it.
      </div>
    </div>
  )
}
```
<sup><a href="https://codesandbox.io/s/example-async-effbq">View in CodeSandbox</a></sup>

> Notice how our components can remain completely independent from the logic.
>
> If we want to modify or even duplicate our `ActionSequence`, with a new aesthetic or different verbiage, we don't need to copy or edit any of these behaviors. 🤯

<br/>

### 👾 Level 2 Clear!

> Nice, we're able to create full-blown experiences, while keeping the number of hooks in a component to a minimum (namely one). That's good, because being able to separate this stuff promotes better patterns. Reduce, reuse, recycle!
>
> However we can keep going, because with Models, _sharing_ logic means more than just reusing.

<br/>
<h1 id="sharing-section">Sharing state</h1>

One of the most important features of a Model is an ability to share a single, active state with any number of users, be them components or even [other controllers](#concept-ambient). Whether you want state in-context or to be usable app-wide, you can, with a number of simple abstractions.

<br/>

<h2 id="concept-sharing">The Basics</h2>

Before going in depth, a quick example should help get the point across.

### Step 1
Start with a normal, run-of-the-mill Model.

```js
export class FooBar extends Model {
  foo = 0;
  bar = 0;
};
```

### Step 2
Into a shiny new, creatively-named `Provider` component, create and pass an instance of your state to its `of` prop. 

```jsx
import { Provider } from "@expressive/react";

const Example = () => {
  const foobar = FooBar.use();

  return (
    <Provider of={foobar}>
      <Foo />
      <Bar />
    </Provider>
  )
}
```
### Step 3
Just as `FooBar.use()` creates an instance of `FooBar`, `FooBar.get()` can find an *existing* instance of `FooBar`. 

```jsx
const Foo = () => {
  const { foo } = FooBar.get();

  return (
    <p>The value of foo is {foo}!</p>
  )
}

const Bar = () => {
  const { bar } = FooBar.get();

  return (
    <p>The value of bar is {bar}!</p>
  )
}
```
Using the class itself, we have a convenient way to "select" what type of state we want, assuming it's in context.

> There's another big benefit here: *types are preserved.*
> 
> Models, when properly documented, maintain autocomplete, hover docs, and intellisense, even as you pass controllers all-throughout your app! 🎉

<br/>

<h2 id="concept-context">Providing via Context</h2>

Let's first create and cast a state, for use by components and peers. In the [next chapter](#access-section), we'll expand on how to consume them.

By default, `Model` uses [React Context](https://frontarm.com/james-k-nelson/usecontext-react-hook/) to find instances upstream.

There are several ways, however, to create a controller and provide it. Nothing special is needed on a model to make it work though.

```ts
export class FooBar extends Model {
  foo = 0;
  bar = 0;
};
```

> Emphesis on `export` here.
> 
> No need to keep a Model and it's respective consumers in the same file, let alone module. Want to publish a reusable controller? This is a pro-consumer solution. ☝️😑

<!-- <sup><a href="https://codesandbox.io/s/example-multiple-accessors-79j0m">View in CodeSandbox</a></sup>  -->

<br/>

<h2 id="concept-provider">Providing an instance</h2>

Here, pass a controller through to `of` prop. For any children, it will be available, accessible via the respective class.

> Unlike a normal `Context.Provider`, `Provider` is generic and good for any (or many) different states.

```jsx
import { Provider } from "@expressive/react";
import { FooBar } from "./controller";

export const App = () => {
  const foobar = FooBar.use();

  return (
    <Provider of={foobar}>
      <Foo/>
      <Bar/>
    </Provider>
  )
}
```

<h2 id="concept-provider-spawning">Spawning an instance</h2>

Assuming no constructor-arguments, creating an instance just to provide it can be an unnecessary step. Pass a Model itself, and you can both create and provide an instance in one sitting.
```jsx
export const App = () => {
  return (
    <Provider of={FooBar}>
      <Foo/>
      <Bar/>
    </Provider>
  )
}
```

<h2 id="concept-provider-props">Spawning with props</h2>

Remember [`Model.using()`](#concept-external) right? When a Model is passed to `of` prop, Provider has the same behavior. All other props are forwarded to state and likewise watched.

```jsx
const MockFooBar = (props) => {
  return (
    <Provider of={FooBar} foo={5} bar={10}>
      {props.children}
    </Provider>
  )
}
```

> Now, consumers can be aware of props which only the parent has access to!

<br/>
<h2 id="concept-provider-multi">Providing Multiple</h2>

Finally, the `of` prop will accept an object or array of models and/or state objects. Mix and match as needed to ensure a dry, readible root.

```jsx
const MockFooBar = () => {
  const hello = Hello.use("world");

  return (
    <Provider of={{ hello, Foo, Bar }}>
      {props.children}
    </Provider>
  )
}
```

<br/>

<h1 id="section-global">Global Models</h1>

While context helps with contextual-isolation, sometimes we'll want one controller to serve a particular purpose for an entire app. Think concepts like login, routes, and interaction with external APIs.

<!-- > For instance, if ever used [react-router](https://github.com/ReactTraining/react-router), you'll know `<BrowserRouter>` is really only needed for its Provider. You won't have more than one at a time. -->

For this, we have `Singleton`, to create and share state, components not withstanding. Hooks are the same as `Model` counterparts, except under the hood they always retrieve a single, promoted instance.

<br/>

## Defining a Singleton

Simply extend `Singleton` instead, a variant of `Model`.

```js
import { Singleton } from "@expressive/react";
import { getCookies } from "./monster";

class Login extends Singleton {
  loggedIn = false;
  userName = undefined;

  componentDidMount(){
    this.resumeSession();
  }

  async resumeSession(){
    const { user } = await getCookies();

    if(user){
      loggedIn = true;
      userName = user.name;
    }
  }
}
```
> Assuming this class for examples below.

<br/>

<h2 id="#section-singleton-activate">Activating a Singleton</h2>

Singletons are not be useable until they initialize in one of three ways:


### Method 1: `Singleton.create(...)`

A method on all Models, `create` on a Singleton will promote the new instance, while avoiding collisions. This can be done anytime, as long as it's before a dependant (component or peer) tries to pull data from it.

```js
window.addEventListener("load", () => {
  const loginController = Login.create();

  loginController.resumeSession();

  ReactDOM.render(<App />, document.getElementById("root"));
});
```

### Method 2: `Singleton.use()`

Create an instance with standard use-methods.

  ```jsx
  const LoginGate = () => {
    const { get: login, loggedIn, userName } = Login.use();

    return loggedIn
      ? <Welcome name={userName} />
      : <Prompt onClick={() => login.resumeSession()} />
  }
  ```
> Login instance is available immediately after `use()` returns. <br/> 
> **However,** instance will then become unavailable if `LoginPrompt` does unmount. If it mounts again, any newly rendered dependents get the latest instance.

### Method 3: `<Provider of={Singleton}>`

```jsx
export const App = () => {
  return (
    <>
      <Provider of={Login} />
      <UserInterface />
    </>
  )
}
```
> This will have no bearing on context, it will simply be "provided" to everyone. Wrapping children, in this case, is doable but optional.
> 
> The active instance is destroyed when its Provider unmounts. You'll most likely use this to limit the existence of a Singleton (and its side-effects), to when a particular UI is on-screen.

<br/>

<h1 id="access-section">Consume a shared state</h1>

Whether our class is a Model or Singleton will not matter for this exercise; they both present the same.<br/>

```ts
export class FooBar extends Model {
  foo = 0;
  bar = 0;
};
```

<br/>

<h2 id="concept-consumer-hooks">Hooks Methods</h2>

Models make getting an instance you need super easy. On every model, there are three `useContext` like methods. They find, return and maintain references to a nearest instance of class they belong to.

<h3 id="method-get"><code>get(key?)</code></h3>

The most straight-forward, `get` will find and return the nearest `instanceof this` within context. When passed a key it will 'drill', either returning a value (if found) or `undefined`.

<h3 id="method-tap"><code>tap(key?, expect?)</code></h3>

In addition to fetching instance, `tap` will subscribe to values on that instance much like `use` will. With this, children sharing a mutual state can affect _eachother's_ state. 

```jsx
const InnerFoo = () => {
  const { bar, set } = FooBar.tap();

  return (
    <>
      <pre onClick={() => set.foo++}>Foo</pre>
      <small>(Bar was clicked {bar} times!)</small>
    </>
  )
}
```
```jsx
const InnerBar = () => {
  const { foo, set } = FooBar.tap();

  return (
    <>
      <pre onClick={() => set.bar++}>Bar</pre> 
      <small>(Foo was clicked {foo} times!)</small>
    </>
  )
}
```

With the `expect` flag, tap will throw if chosen property is undefined at time of use. This is useful because output is cast as non-nullable. This way, value may be destructured without assertions (or complaints from your linter).

<br/>

<h2 id="concept-consumer">Consumers</h2>

Hooks are great, but not all components are functions. For those we have the `Consumer` component. This is also generic, and able to capture state for any Model passed to `of` prop.

There are a number of options, to get info with or without a typical subscription.

<h3 id="consumer-render">Render Function</h3>

When a function is passed as a child, returned elements will replace the Consumer. The function recieves state as its first argument, and subscribed updates will trigger new renders.

> Note: If you spread `props` directly, _all_ possible values will be subscribed to.

```jsx
const CustomConsumer = () => {
  return (
    <Consumer of={ModernController}>
      ({ value }) => <OldSchoolComponent value={value} />
    </Consumer>
  )
}
```

Consumers can drive classical components easily, assuming the values on state match up with expected props.

<h3 id="consumer-tap"><code>tap</code> Prop</h3>

If rendered output is not needed, you can pass a function to the `tap` prop. This is better for side-effects, more specific to a UI than controller itself. 
> Also allows for `async`, since return value (a `Promise`) can just be ignored.

```jsx
const ActiveConsumer = () => {
  return (
    <Consumer of={Timer} tap={({ minutes, seconds }) => {
      console.log(`Timer has been running for ${minutes}m ${seconds}s!`)
    }}/>
  )
}
```

<h3 id="consumer-get"><code>get</code> Prop</h3>

Callback runs per-render of the parent component, rather than per-update.

```jsx
const LazyConsumer = () => {
  return (
    <Consumer of={Timer} get={({ minutes, seconds }) => {
      console.log(`Timer is currently at ${minutes}m ${seconds}s!`)
    }}/>
  )
}
```

> Use `<Consumer />` to intregrate traditional components, almost as easily as modern function-components!

<br/>

### 🎮 Level 3 Complete! 

> Here we've learned how to make state _accessible_, in more ways than one. Now with these tools we are able to tackle the more advanced connectivity. We'll next get into _ecosystems_ and how to split behavior into simple, often-reusable chunks and hook <sup>(pun intended)</sup> them together.

<br/>
<h1 id="composing-section">Composing Models</h1>

Ultimately the purpose of Models, and be that classes in-general, is to compartmentalize logic. This makes code clear and behavior easy to duplicate. Ideally, we want controllers to be really good at one thing, and to cooperate with other systems as complexity grows.

> **This** is how we'll build better performing, easier to work on applications.

In broad strokes, here are some of the ways to setup mutliple states to work together:
<br/><br/>

<h2 id="concept-compose">Simple Composition</h2>

Nothing prevents the use of more than one state per component. Take advantage of this to combine smaller states, rather than make big, monolithic state.

```js
  class Foo extends Model {
    value = 1
  }
  
  class Bar extends Model {
    value = 2
  }

  const FibonacciApp = () => {
    const foo = Foo.use();
    const bar = Bar.use();

    return (
      <div>
        <div onClick={() => { foo.value += bar.value }}>
          Foo's value is ${foo.value}, click to add bar!
        </div>
        <div onClick={() => { bar.value += foo.value }}>
          Bar's value is ${bar.value}, click to add foo!
        </div>
      </div>
    )
  }
```

<br/>
<h2 id="concept-child-model">Child Controllers</h2>

While above works fine, what if we want something cleaner or more reusable? Fortunately, we can "wrap" these models into another, and use that one instead. Think of it like building a custom hook out of smaller (or the core React) hooks.

### `use(Type, callback?)`

Import `use` to wrap another Model, to attach a new instance.

> [This is an instruction](#concept-directives), in-short a factory function. It tells the controller, while initializing: the defined property has special behavior, run some logic to set that up.

```js
import Model, { use } from "@expressive/react";

class FooBar extends Model {
  foo = use(Foo);
  bar = use(Bar);

  get value(){
    return this.foo.value + this.bar.value;
  }

  plusFoo = () => this.bar.value = this.value;
  plusBar = () => this.foo.value = this.value;
}
```

> Now, we have a good way to mixin controllers. More importantly though, we have a place to put _mutually-inclusive_ stuff, before which had to live in component. This brings us back to dumb-component paradise. 🏝

```js
const FibonacciApp = () => {
  const { foo, bar, sum, plusFoo, plusBar } = FooBar.use();

  return (
    <div>
      <div>
        Foo + Bar = {sum}
      </div>
      <div onClick={plusBar}>
        Foo's value is ${foo.value}, click to add in bar!
      </div>
      <div onClick={plusFoo}>
        Bar's value is ${bar.value}, click to add in foo!
      </div>
    </div>
  )
}
```

> Subscriber will not only subscribe to `FooBar` updates, but that of its children as well! This let us pull more complexity out the component, adding features without adding techincal debt.

<br/>
<h2 id="concept-parent-model">Parent Controller</h2>

While separating concerns, there will be times designing a Model expressly to help another makes sense, and a reference to that parent is desirable. For this we have the `parent` instruction.

### `parent(Type, required?)`

Returns a reference to controller to which `this` is a child. Optional `required` parameter will throw if child model is created without that parent, otherwise returning `undefined`.

```js
import Model, { use, parent } from "@expressive/react";

class Control extends Model {
  child = use(Dependant);
}

class Dependant extends Model {
  parent = parent(Control, true);
}
```

<br/>
<h2 id="concept-ambient">Ambient Controller</h2>

Ofcourse, controllers can also access others via context, within the component where used. You probably saw it coming: for this we have a `tap` instruction!

### `tap(Type, required?)`

```js
import Model, { tap } from "@expressive/react";

class Hello extends Model {
  to = "World";
}

class Greet extends Model {
  hello = tap(Hello);

  get greeting(){
    return `Hello ${this.hello.to}`;
  }
}
```
First define a controller which itself defines a peer-property. Controller will fetch requested model from context of the component to which it belongs.
```js
import { Provider } from "@expressive/react";

const App = () => {
  return (
    <Provider of={Hello}>
      <SayHi />
    </Provider>
  )
}

const SayHi = () => {
  const { greeting } = Greet.tap()

  return (
    <p>{greeting}!</p>
  )
}
```
> Here *SayHi*, without direct access to *Hello*, can still get what it needs. The actionable `greeting` comes from *Greet*, which itself touches data on *Hello*. This ends up superior scope-control, leading to code that's more robust and more secure (in theory 😅) overall.

<!-- <br/>
<br/>
<h1 id="sharing-section">Extending & Reuse</h1>

<h2 id="managing-section">Extending Controllers</h2>
<h2 id="concept-extension-context">Impacts on Context</h2>

<br/>
<br/>
<h1 id="sharing-section">Special Properties</h1>

<h2 id="managing-section">Built In Modifiers</h2>
<h2 id="concept-extension-context">Your Own Modifiers</h2>
<h2 id="managing-section">Using Meta</h2> -->

<br/>
<br/>
<h1>Best Practices</h1>
Good things to keep in mind of as you build with MVC patters in your apps. Naturally, just suggestions, but these are design principles to be supported as this library evolves.

<br/>
<br/>
<h2 id="concept-typescript">Models & Typescript</h2>

Typescript is your friend and Expressive is built laregely to facilitate its use within React apps.

A ton of focus has been put in to make sure _all_ features of Expressive are in-line with what Typescript lanaguage supports. Transparency is key for a great developer experience, and MVC's are designed to infer often and fail-fast in static analysis.

```ts
import Model from "@expressive/react";

class FunActivity extends Model {
  /** Interval identifier for cleaning up */
  interval: number;

  /** Number of seconds that have passed */
  secondsSofar: number;

  constructor(alreadyMinutes: number = 0){
    super();

    this.secondsSofar = alreadyMinutes * 60;
    this.interval = setInterval(() => this.secondsSofar++, 1000)
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

<br/>

<h1>Concepts</h1>
Topics to help in understanding how MVC's work under the hood. 

<br/>
<br/>
<h2 id="concept-lazy">Subscription based "lazy" updating</h2>

Controllers use a subscription model to decide when to render, and will **only** refresh for values which are actually used. They do this by watching property access *on the first render*, within a component they hook up to.

That said, while hooks can't actually read your function-component, destructuring is a good way to get consistent behavior. Where a property *is not* accessed on initial render render (inside a conditional or ternary), it could fail to update as expected.

Destructuring pulls out properties no matter what, and so prevents this problem. You'll also find also reads a lot better, and promotes good habits.

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

<br/>
<h2 id="concept-debounce">Automatic debounce</h2>

Changes made synchronously are batched as a single new render.

```jsx
class ZeroStakesGame extends Model {
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
  const { foo, bar, baz, shuffle } = ZeroStakesGame.use();

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

> Even though we're ultimately making four updates, `use()` only needs to re-render twice. It does so once for everybody (being on the same [event-loop](https://blog.sessionstack.com/how-javascript-works-event-loop-and-the-rise-of-async-programming-5-ways-to-better-coding-with-2f077c4438b5)), resets when finished, and again wakes for `foo` when it decides settle in.


<!-- <br/>
<h2 id="concept-debounce">Selectors</h2>
 -->

<br/>
<br/>

<h1>API</h1>

<h2 id="controller-api">Model</h2>

Set behavior for certain properties on classes extending `Model`.

While standard practice is for `use` to take all methods (and bind them), all properties (and watch them), there are special circumstances to be aware of. <br /><br />

<h2 id="singleton-api">Singleton</h2>

Set behavior for certain properties on classes extending `Controller`.

While standard practice is for `use` to take all methods (and bind them), all properties (and watch them), there are special circumstances to be aware of. <br /><br />

<h2 id="reserved-api">Reserved</h2>

#### `set` / `get`
- Not to be confused with setters / getters.
- both return a circular reference to `state`
- this is useful to access your state object while destructuring

#### `export<T>(this: T): { [P in keyof T]: T[P] }`
- takes a snapshot of live state you can pass along, without unintended side effects.
- this will only output the values which exist on state.

<br />

<h2 id="lifecycle-api">Lifecycle</h2>

> Lifecycle methods are called syncronously, via `useLayoutEffect` and thus may block or intercept a render. If you prefer to run side-effects rather, use corresponding events or define your method as `async`. 

#### `componentDidMount`
- `use()` will call this while internally mounting for the first time.

#### `componentWillUnmount`
- `use()` will call this before starting to clean up.

#### `componentWillRender(): void`
- Called every render.

#### `componentWillMount(): void`
- Called on first render, prior to component being drawn on-screen.

#### `componentWillUpdate(): void`
- Called every subsequent render of the same component.

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

MIT license.
