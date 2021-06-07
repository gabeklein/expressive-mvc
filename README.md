<br/>

<p align="center">
  <img height="90" src="./assets/logo.svg" alt="Expressive Logo"/>
  <h1 align="center">
    Expressive MVC
  </h1>
</p>

<h4 align="center">
  Accessible control for anywhere and everywhere in your React apps
</h4>
 
<p align="center">
  <a href="https://www.npmjs.com/package/react-use-controller"><img alt="NPM" src="https://badge.fury.io/js/react-use-controller.svg"></a>
  <a href=""><img alt="Build" src="https://shields-staging.herokuapp.com/npm/types/react-use-controller.svg"></a>
</p>

<p align="center">
  With Models, easy-to-<code>use()</code> classes
  power your UI. <br/>
  Built-in hooks manage renders for you, as needed, for any data.<br/>
  When properties change, your components will too.<br/>
</p>

<br/>

<h1 id="overview-section">Overview</h1>

Expressive allows for the creation and use of classes to define stateful logic for components, via built-in hooks. 

When the methods on a **Model** are used within a component **(a View)**, an instance is either created or found for its use. By watching what values are used on first render, the hook itself **(a Controller)** can keep in-sync with them.

This behavior combines with actions, computed properties, events, and the component itself allowing for a [(real this time)](https://stackoverflow.com/a/10596138) **M**odel-**V**iew-**C**ontroller development pattern within React.

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
  &ensp; •&nbsp; [Register](#section-singleton-activate) <br/>

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

<!--
**Extension** <br/>
  &ensp; •&nbsp; [Extending Custom Models](#concept-extension) <br/>
  &ensp; •&nbsp; [Impact on Context](#concept-extension-context) <br/>
  &ensp; •&nbsp; [Using Meta](#concept-meta) <br/>

**Customizing** <br/>
  &ensp; •&nbsp; [Extending Custom Models](#concept-extension) <br/>
  &ensp; •&nbsp; [Impact on Context](#concept-extension-context) <br/>
  &ensp; •&nbsp; [Using Meta](#concept-meta) <br/>
-->

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
npm install --save @expressive/mvc
```

Import and use in your react apps

```js
import Model from "@expressive/mvc";
```

<br/>

<h1 id="good-start">A good example</h1>

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

Ultimately the workflow is pretty simple. If you know [MobX](https://mobx.js.org/README.html) this will look familiar, but also more straight-forward.

1. Create a class and fill it with the values, getters, and methods you'll need.
2. Extend `Model` (or any derivative, for that matter) to make it "observable".
3. Within a component, use built-in methods as you would a normal hook.
4. Destructure the values, needed by a particular component, to subscribe.
5. Update those values on demand. Components keep sync automagically. ✨
<br/><br/>

### Glossary

The following is a bascially crash-course to help get you up to speed.<br/>
To that end, here's some library jargon which will be good to know.

 - **Model**: Any class you'll write extending `Model`. Your definition for a type of controller.
 - **Controller**: An instance of your model, usable wherever you need it.
 - **State**: The state belonging to a controller, values on instance, defined by model. 
 - **Subscriber**: A hook, or otherwise special callback, responding to updates.
 - **View**: A function-component which may be mounted and accept hooks.
 - **Element**: Instance of a component/view, actively mounted with its own state and lifecycle.

<br/>

Alrighty, lets go :clap:
<br/><br/>

<h2 id="concept-simple">Simplest use-case</h2>

Backing up from our first example, we start with a bare minimum.

```jsx
import Model from "@expressive/mvc";

class Counter extends Model {
  number = 1
}
```

Define a model with any number of properties we want to track. Values set in the constructor (or as class properties) serve as initial state.

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
 
One of the static-methods on your model will be `use`. It is a hook; it will create a new instance (of the given model) and bind it to this component.

Now, we can "edit" the instance properties as we see fit. When values change, our hook handles the need for a new render.

<br/>

<h2 id="concept-destruct">Destructuring</h2>

[Subscribers are lazy](#concept-lazy), they will only update a view for values seen to be in-use. 

A good idea is to destructure out values used by a component. This keeps intent clear, and avoids unexpected behavior.

Having destructured though, we may still need access to the full state. To cover for this, there is an included `get` and `set` property.

> Not to be confused with the keywords! Simple properties, both a reference back to state.

### `set`

From the destructure, we have `set` to update properties on our state.

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

The same, but for other purposes. Most of the time, to get information without implying you also want updates. <br/>

> Usually, when an observable value is accessed, the controller assumes a refresh is needed anytime that property changes. In plenty of situations, this isn't the case, so `get` serves as an escape-hatch.


```js
const { get: instance, value } = Model.use();
```
> Is just a nicer (and more stable) way of saying:
```js
const instance = Model.use();
const { value } = instance;
```

Also worth mentioning, you can use it for bracket-notation too (i.e. `get["property"]`), and to generally avoid clutter. 

<br/>

<h2 id="concept-method">Adding methods</h2>

What's a class without methods? Let's add some *actions* to abstract changes to our state.

```jsx
class Counter extends Model {
  current = 1

  // Note that we're using arrow functions, to preserve `this`.
  // In-practice, this acts a lot like a useCallback, but better!
  increment = () => { this.current++ };
  decrement = () => { this.current-- };
}
```


> While this approach is obviously cleaner, it's also subtly more efficient than inline-functions. Not only do these actions have names, we avoid making a new closure for every render. This can save _a lot_ of unnecessary rendering downstream, for otherwise "new" callbacks. 😬

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
<!-- <sup><a href="https://codesandbox.io/s/example-actions-1dyxg">View in CodeSandbox</a></sup> -->

With this you can write even the most complex components, all while maintaining key benefits of a functional-component. Much easier on the eyeballs.

<br/>

<h2 id="concept-getters">Can we get some getters?</h2>

You'll be happy to know, we have a strong equivalent to *computed* properties. Simply define a get-method, to be managed by controller. 

Through the same mechanism as hooks, getters know when the specific properties they accessed are updated. Whenever that happens, they rerun. If a new value is returned, it's passed forward to the getter's own listeners.

```js
const { floor } = Math;

class Timer extends Model {
  seconds = 0;
 
  constructor(){
    super();
    setInterval(() => this.seconds++, 1000);
  }

  get minutes(){
    return floor(this.seconds / 60);
  }

  get hours(){
    // getters can subscribe to other getters as well 🤙
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

### Good to know:

A getter's value is cached, facing the user. It will only run when a dependency changes, and **not** upon access as you might expect.

Getters are lazy however, and will not run until first accessed. Afterwards, they will run whenever the controller thinks they *could* change, so make sure to design them with these guiding principles:
- Getters should be *deterministic*. Only expect a change where inputs have changed.
- Avoid computing from values which change a lot, but don't output new values as often.
- [Goes without saying](https://www.youtube.com/watch?v=0i0IlSKn0sE "Goes Without Saying") but, **side-effects are an anti-pattern**, and can cause infinite loops.

<br/>

<h2 id="concept-constructor">Constructor arguments</h2>

The method `use(...)`, as it builds an instance, will pass arguments to the constructor. This makes it easy to reuse and customize state for a particular component.

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
const MyComponent = ({ fullName }) => {
  const { firstName } = Greetings.use(fullName);

  return <b>Hello {firstName}!</b>;
}
```
<!-- <sup><a href="https://codesandbox.io/s/example-constructor-params-22lqu">View in CodeSandbox</a></sup> -->

<br/>

<h2 id="concept-passing-props">Passing props to your controller instead</h2>

Besides `use` there are similar methods, able to assign values just after a controller is created. This is a great alternative to manually setting values, as we did in the example above.

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
Here Greetings will define *firstName* & *isBirthday*. However, first it would need *name* and *birthday*, which start out undefined. We pass in the `props` object to help that along.

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
Now, all that's left is to define in those props.
```jsx
const SayHello = () => (
  <HappyBirthday
    name="John Doe"
    birthday="January 1"
  />
)
```
This method is naturally picky and will only capture values which already defined (as explicitly `undefined` or otherwise). However, you could specify what properties you wish to pull from, like so:

```js
const state = Model.uses({ ... }, ["name", "birthday"]);
```

This way objects containing _more_ than required info are still usable without polluting your state.

<!-- <sup><a href="https://codesandbox.io/s/example-constructor-params-22lqu">View in CodeSandbox</a></sup> -->

<br/>

### ✅ Level 1 Clear!
> In this chapter we learned the basics of how to create and utilize a custom state. For most people who just want smarter components, this could be enough! However, we can go well beyond making what is just a fancy hook.

<br/>

<h1 id="managing-section">Creating a dynamic state</h1>

So far, all examples have been passive. Next we'll give models a bigger roll, to update without direct interaction.

Because state is a portable object, we can do whatever to values, but more-crucially, whenever. This makes asynchronous coding pretty low maintenance. You implement business-logic; controllers will handle the rest.

Here are a few concrete ways though, to smarten up your models:<br/><br/>

<h2 id="concept-lifecycle">Lifecycle</h2>

Built-in hooks will automatically call a number of "special methods" you'll define on your model, to handle certain "special events" within their parent component.

```jsx
class TimerControl extends Model {
  elapsed = 1;

  componentDidMount(){
    this.timer = setInterval(() => this.elapsed++, 1000);
  }

  /** remember to cleanup ♻ */
  componentWillUnmount(){
    clearInterval(this.timer);
  }
}
```
> Where have I seen this before... 🤔
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

Aside watching for changes in state, what a subscriber really cares about is events. *Updates are just one source for an event.* Whenever a property on your state gains a new value, subscribers are notified and act accordingly.
<br />
<br />

<h3 id="concept-listen-event">Listening for events manually</h3>

```js
const callback = (value, key) => {
  console.log(`${key} was updated with ${value}!`)
}
```

#### `state.on(key, callback) => remove`

Register a new listener on a given key. `callback` will be fired when `state[key]` updates, or a synthetic event is sent.

The method also returns a callback, used to stop subscribing. 

#### `state.once(key, callback) => cancel`

Will clean itself after being invoked. May be cancelled with the returned callback.

#### `state.once(key) => Promise<value>`

If `callback` is not provided, `once` will return a Promise, resolving the next value `key` receives.

<br />
<h3 id="concept-listen-effect">Define effect for one or more values</h3>

```js
function effectCallback(target){
  this === target; // true

  console.log(`Update did occure in one or more watched values.`)

  return () =>
    console.log(`Another update will occure, cleanup may be done here.`)
}
```

#### `state.effect(effectCallback, keys) => onDone`

A more versatile method used to monitor one or multiple properties with the same callback.

<br />
<h3 id="concept-push-event">Pushing your own events</h3>

#### `state.update(key)`

Fires a synthetic event; it will be sent to all listeners of `name`, be them components or listeners above. You may use any `string` or `symbol` as a key. Naturally, any key also defined on state will count as an update.

Events make it easier to design around closures and callbacks, keeping as few things on your model as possible. Event methods may also be used externally, for other code to interact with as well.
<br /><br />

<h3 id="concept-builtin-event">Listening for built-in events</h3>

Controllers will repeat lifecycle events for bound components (depending on the hook).

> Often a Model's behavior is be bound to the lifecycle of a component it's used by. While we do have lifecycle-methods, it is recommended to use events where able. This way, if your class is extended and redefines a handler, yours will still run without `super.componentDidMount()`.

All events share names with their respective method-handlers, [listed here](#lifecycle-api).
<br /><br />

### Event handling in-practice:

```js
class TickTockClock extends Model {
  seconds = 0;

  get minutes(){
    return Math.floor(seconds / 60);
  }

  constructor(){
    super();

    // begin timer after component mounts
    this.once("componentDidMount", this.start);
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

    // run callback when unmount event is sent
    this.once("componentWillUnmount", stop);
  }
}
```

> Notice how we saved not only two methods, but didn't need to store interval as a property either. Pretty clean!

<br />

<h2 id="concept-external">Watching external values</h2>

Sometimes, you may want to detect changes from outside, usually via props. Observing any value will require you integrate it as part of state, however there is are helpers for this.

<h3 id="method-using"><code>Model.using(source, keys?)</code></h3>

> If you remember [`uses`](#concept-passing-props), this is roughly equivalent.

This method helps "watch" props by assigning argument properties on *every render*. Because the observer already reacts to *new* values, this makes for a simple way to watch props. We can combine this with getters and event-listeners, to do all sorts of things when inputs change.

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

> **Note:** This method is also picky (ala `uses`), and will ignore any value not pre-existing on controller.

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
With this, we can freely interact with all different sources of state!

<br />

<h2 id="concept-async">Working with async and callbacks</h2>

Because dispatch is taken care of, we can focus on editing values however we need to. This makes the asynchronous stuff like timeouts, promises, callbacks, and fetching a piece of cake.

```ts
class StickySituation extends Model {
  remaining = 60;
  agent = "Bond";

  constructor(){
    super();
    setup();
  }

  setup(){
    let timer;

    this.once("componentWillMount", () => {
      timer = setInterval(this.tickTock, 1000);
    });

    // we can watch more than one too
    this.once(["componentWillUnmount", "done"], () => {
      clearInterval(timer);
    });
  }

  tickTock = () => {
    const timeLeft = --this.remaining;

    if(timeLeft === 0)
      this.update("done");
  }

  getSomebodyElse = async () => {
    const res = await fetch("https://randomuser.me/api/");
    const data = await res.json();
    const [ recruit ] = data.results;

    this.agent = recruit.name.last;
  }
}
```
```jsx
const ActionSequence = () => {
  const {
    getSomebodyElse,
    remaining,
    agent
  } = StickySituation.use();

  if(remaining === 0)
    return <h1>{"🙀💥"}</h1>

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
        But there is still time! 
        <u onClick={getSomebodyElse}>Tap another agent</u> 
        if you think they can do it.
      </div>
    </div>
  )
}
```
<sup><a href="https://codesandbox.io/s/example-async-effbq">View in CodeSandbox</a></sup>

<br/>

### 👾 Level 2 Clear!

> Notice how our components remains completely independent from the logic sofar; it's a pretty big deal. 
>
> If we want to modify or even duplicate our `ActionSequence`, with a new aesthetic or different verbiage, we don't need to copy or edit any of these behaviors. 🤯

We can still take this forward however, becasue with Models, we can _share_ logic just as easily as reuse it.

<br/>
<h1 id="sharing-section">Sharing state</h1>

One of the most important features of a Model is an ability to share state with any number of subscribers, be them components or [even other controllers](#concept-ambient). Whether you want state in-context or to be usable app-wide, you can, with a number of simple abstractions.

<br/>

<h2 id="concept-sharing">Getting Started</h2>

Before going in depth, a quick use-case should help get the basic point across.

### Step 1
Start with a normal, run-of-the-mill Model.

```js
export class FooBar extends Model {
  foo = 0;
  bar = 0;
};
```

### Step 2
Using the creatively-named `Provider` component, create and pass an instance of your state to `of` prop. 

```jsx
import { Provider } from "@expressive/mvc";

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
Just as `FooBar.use()` creates an instance of `FooBar`, `FooBar.get()` will try to find an *existing* instance of `FooBar`. 

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
Using the class itself, we get a clear way to "select" what type of state we'd like, assuming it exists in context.

> There's another big benefit here: types are preserved.
> 
> Models, when properly documented, maintain autocomplete, hover docs, and intellisense, even as you pass controllers all-throughout your app! 🎉 

<br/>

<h2 id="concept-context">Providing via Context</h2>

Here we will cover how to create and cast state, for use by components and peers. It's in the [next chapter](#access-section) though, where we'll expand on how to consume them.

By default, a `Model` uses [React Context](https://frontarm.com/james-k-nelson/usecontext-react-hook/) under-the-hood to find others from inside a tree.

There's more than one way, however, to create a controller and provide it into context. That said, nothing special is needed on a model to make this work.

```ts
export class FooBar extends Model {
  foo = 0;
  bar = 0;
};
```

> Emphesis on `export` here.
> 
> You need not keep a Model and it's respective consumers in the same file, let alone module. Want to publish a reusable controller? This can make for a very "consumer-friendly" solution. ☝️😑

<!-- <sup><a href="https://codesandbox.io/s/example-multiple-accessors-79j0m">View in CodeSandbox</a></sup>  -->

<br/>

<h2 id="concept-provider">Providing an instance</h2>

Here we'll pass a needed controller through `of` prop. For any children, this state is now available, accessible through it's respective class.

> Unlike a normal `Context.Provider`, `Provider` is universal and good for any (or many) different states.

```jsx
import { Provider } from "@expressive/mvc";
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

Assuming no-frills, creating an instance just to provide it can be an unnecessary step. If you pass a Model itself however, you can both create and provide an instance in one sitting.
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

Hey, we remember [`Model.using()`](#concept-external) right? When given a Model directly, Provider inherits the same behavior. Any other props are forwarded to state and likewise watched.

```jsx
const MockFooBar = (props) => {
  return (
    <Provider of={FooBar} foo={5} bar={10}>
      {props.children}
    </Provider>
  )
}
```

> Now we can easily tweak the values seen by consumers. A big help for quick mock-up during development.

<h2 id="concept-provider-multi">Providing Multiple</h2>

Finally, the `of` prop may accept an object or array of models and/or state objects. Mix and match as needed to ensure a dry, readible root.

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

While context is recommended to ensure isolation, you may want to have just one controller for a particular purpose. Think concepts like Login, Settings, Routes, and interacting with outside APIs.

> For instance, if ever used [react-router](https://github.com/ReactTraining/react-router), you'll know `<BrowserRouter>` is really only needed for its Provider. You won't have more than one at a time.

Here we introduce a new class of Model called `Singleton`. With it, we can create shared state while ignoring placement. Hooks work exactly the same as on their `Model` counterparts, except under the hood they always retrieve a single, promoted instance.

<br/>

## Defining a Singleton

Just a variant of `Model`, extend `Singleton` instead.

```js
import { Singleton } from "@expressive/mvc";
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
<br/>

<h2 id="#section-singleton-activate">Activating a Singleton</h2>

Something to keep in mind. Singletons are not be useable until they're initialized in one of three ways.


### Method 1: `Singleton.create(...)`

A built-in function on all Models, `create` on a Singleton will also ensure the instance is made available. This can be done anytime, as long as it's before a dependant (component or peer) tries to pull data from it.

```js
window.addEventListener("load", () => {
  const loginController = Login.create();

  loginController.resumeSession();

  ReactDOM.render(<App />, document.getElementById("root"));
});
```

### Method 2: `Singleton.use()`

Create an instance with any one of the create-hooks, such as `use`.

  ```jsx
  const LoginGate = () => {
    const { get: login, loggedIn, userName } = Login.use();

    return loggedIn
      ? <Welcome name={userName} />
      : <Prompt onClick={() => login.resumeSession()} />
  }
  ```
Login instance is freely accessible after `use()` returns. <br/> 
> **Note:** Instance will become unavailable if `LoginPrompt` does unmount. <br/>
Likewise, if `LoginPrompt` mounts again, any newly rendered dependents get the newly created instance.

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
This will have no bearing on context, it will simply be "provided" to everyone. Wrapping children, in this case, is doable but optional.
> The active instance is destroyed when its Provider unmounts. You'll most likely use this to limit the side-effects of a Singleton, to when a particular UI is rendered.

<br/>

<h1 id="access-section">Consume a shared state</h1>

Whether our model is that of a Model or Singleton will not matter for this exercise. They both present the same, to you the user!<br/>

```ts
export class FooBar extends Model {
  foo = 0;
  bar = 0;
};
```

> We again reuse `FooBar` model for this section.

<br/>

<h2 id="concept-consumer-hooks">Hooks Methods</h2>
Models make finding a relevant instance from context super easy. On your custom-class you'll find a number of methods, which are themsevles hooks. They find, maintain, and return a reference to the nearest instance of their respective class.

<h3 id="method-get"><code>get(key?)</code></h3>

The most straight-forward of these hooks, `get` will find and return the nearest `instanceof this` within context. If given a key, it will either return the value of said key (if state was found, otherwise `undefined`).

<h3 id="method-tap"><code>tap(key?)</code></h3>

In addition to fetching nearest instance, `tap` will subscribe to values on that instance much like `use` will. With this, mutual children of a particular state can easily affect _eachother's_ state. 

```jsx
const InnerFoo = () => {
  const { bar, set } = Central.tap();

  return (
    <>
      <pre onClick={() => set.foo++}>Foo</pre>
      <small>Bar was clicked {bar} times!</small>
    </>
  )
}
```
```jsx
const InnerBar = () => {
  const { foo, set } = Central.tap();

  return (
    <>
      <pre onClick={() => set.bar++}>Bar</pre> 
      <small>Foo was clicked {foo} times!</small>
    </>
  )
}
```

<h3 id="method-has"><code>has(key)</code></h3>

Similar to tap, has will throw if chosen property is undefined at time of access. This is useful because output is cast as non-nullable. This way, value may be destructured without assertions (and complaints from type-checker).

<br/>

<h2 id="concept-consumer">Consumers</h2>

While hooks are great, not every set of components are functions. For those situations we have `Consumer` component. This is also generic, and able to capture state for any Model passed to `of` prop.

There are a number of options, to get info with or without a typical subscription.

<h3 id="consumer-render">Render Function</h3>

When you use a function as child, returned elements will replace the Consumer. The function recieves state as its first argument, and subscribed updates will trigger new renders.

```jsx
const CustomConsumer = () => {
  return (
    <Consumer of={ModernController}>
      (state) => <OldSchoolComponent {...state} />
    </Consumer>
  )
}
```

> Consumers can drive classical components easily, assuming values on state match up with expected props.

<h3 id="consumer-tap"><code>tap</code> Prop</h3>

If rendered output is not needed, you can pass a function into `tap` prop. This is great for special effects, more specific to a UI than controller itself.

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

If you just need info from a state. Callback runs per-render of the parent component, rather than per-update.

```jsx
const LazyConsumer = () => {
  return (
    <Consumer of={Timer} get={() => {
      console.log(`Timer is currently at ${minutes}m ${seconds}s!`)
    }}/>
  )
}
```

> Use `<Consumer />` to intregrate traditional components, almost as easily as modern function-components!

<br/>

### 🎮 Level 3 Complete! 

> Here we've learned how to make state _accessible_, in more ways than one. Now with these tools we are able to tackle the more advanced connectivity.

Next chapter, we'll dive into _ecosystems_ and how to split state and behavior into simple, often-reusable chunks and hook <sup>(hehe)</sup> them together.

<br/>
<h1 id="composing-section">Composing Models</h1>

Ultimately the purpose of Models, and be that classes in general, is to split and localize logic. This makes code clear and behavior easy to duplicate. Ideally, we want controllers to be really good at **one** thing, and to cooperate with other systems as complexity grows.

> **This** is how we'll build better performing, easier to-work-with applications.

In broad strokes, here are some of the ways to setup mutliple states to work together:
<br/><br/>

<h2 id="concept-compose">Simple Composition</h2>

Nothing preventing using more than one state per component. Take advantage of this to create smaller, cooperating state, rather than big, monolithic state.

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
          Bar's value is ${bar.value}, click to add ping!
        </div>
      </div>
    )
  }
```

<br/>
<h2 id="concept-child-model">Child Controllers</h2>

While the above example works fine, what if we need this cleaner or more reusable? Fortunately we can "wrap" these models into another, and use that one instead. Think of it like building a custom hook out of smaller (or core React) hooks.

### `use(Type, callback?)`

Import `use` to wrap a model, producing an instance of given type.

> [This is a modifier](#concept-directives), in-short a factory function. It tells the controller, while initializing: the defined property has special behavior, run logic to set that up.

```js
import Model, { use } from "@expressive/mvc";

class FooBar extends Model {
  foo = use(Foo);
  bar = use(Bar);

  get sum(){
    return this.foo.value + this.bar.value;
  }

  plusFoo = () => this.bar.value = this.sum;
  plusBar = () => this.foo.value = this.sum;
}
```

Now, we have a good way to mixin controllers. On top of that we add logic which, only mutually, would apply to both children.

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

>  This let us pull more complexity out the component, adding features without adding techincal debt.

<br/>
<h2 id="concept-parent-model">Parent Controller</h2>

While separating concerns, there will be times designing a Model to serve another makes sense, and a reference to that parent may be desirable. For this we have the `parent` modifier.

### `parent(Type, required?)`

Returns a reference to controller to which `this` is a child. Optional `required` parameter will throw if child model is spawned without that parent, otherwise returning `undefined`.

```js
import Model, { use, parent } from "@expressive/mvc";

class Control extends Model {
  child = use(Child);
}

class Child extends Model {
  parent = parent(Control, true);
}
```

<br/>
<h2 id="concept-ambient">Ambient Controller</h2>

Controllers can also access others which exist in context of a component where used. For this we have the `tap` modifier.

### `tap(Type, required?)`

```js
import Model, { tap } from "@expressive/mvc";

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
First define a controller which itself defines a peer-property. Controller will fetch requested model from the context of component to which it belongs.
```js
import { Provider } from "@expressive/mvc";

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
> Here *SayHi*, without direct access to *Hello*, can still get what it needs. The actionable value `greeting` comes from *Greet*, which itself touches data on *Hello*. This ends up superior scope-control, leading to more robust code overall.

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
Good things to keep in mind of as you build with MVC patters in your apps. Naturally, just suggestions, but these are design principles to be most supported as this library evolves.

<br/>
<h2 id="concept-typescript">Models & Typescript</h2>

Remember to code responsibly. This goes without saying, but typescript is your friend. With controllers you can enjoy full type safety and inference, even within components themselves.

> A ton of focus has been put in to make sure _all_ features of Expressive are in-line with what Typescript lanaguage supports. Transparency is key for a great developer experience, and MVC's are designed to fail-fast in static analysis.

```ts
import Model from "@expressive/mvc";

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

#### `didMount`
- `use()` will call this while internally running `useEffect(fn, [])` for itself.

#### `willUnmount`
- `use()` will call this before starting to clean up.

#### `willRender(): void`
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
