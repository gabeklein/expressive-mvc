
<h1 align="center">
  Expressive MVC
</h1>

<h4 align="center">
  Accessible control for anywhere and everywhere in your React apps
</h4>
 
<p align="center">
  <a href="https://www.npmjs.com/package/react-use-controller"><img alt="NPM" src="https://badge.fury.io/js/react-use-controller.svg"></a>
  <a href=""><img alt="Build" src="https://shields-staging.herokuapp.com/npm/types/react-use-controller.svg"></a>
</p>
<br/>

<p align="center">
  With Models, you can <code>use()</code> simple classes
  to power your UI. <br/>
  Built-in hooks manage renders for you, as needed, for any data.<br/>
  When properties update, your components will too.<br/>
</p>


<br/>

<h1 id="overview-section">Overview</h1>

With Expressive, create and use simple classes to control your components, via built-in hooks. 

When certain methods on a **Model** are used within a component **(a View)**, an instance is either created or found for its use. By watching what values are used on first render, the hook itself **(a Controller)** can keep in sync with them.

This behavior combines with actions, computed properties, events, and the component itself allowing for a [(real this time)](https://stackoverflow.com/a/10596138) **M**odel-**V**iew-**C**ontroller development pattern within React.

<br/>

# Contents 

<!-- Manual bullets because I don't like default <li> -->

### Introductions
  &ensp; •&nbsp; **[Install and Import](#install-section)** <br/>
  &ensp; •&nbsp; [A Simple Example](#good-start) <br/>

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
  &ensp; •&nbsp; [Context Provider](#concept-context) <br/>

**Singletons** <br/>
  &ensp; •&nbsp; [Singletons](#concept-singleton) <br/>

**Accessing** <br/>
  &ensp; •&nbsp; [Hooks](#concept-hooks) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`get` (unbound)](#method-get) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`tap` (one-way)](#method-tap) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`sub` (two-way)](#method-sub) <br/>
  &ensp; •&nbsp; [Consumer](#concept-consumer) <br/>
  

<!-- **Applied State** <br/>
  &ensp; •&nbsp; [Managed Elements](#concept-managed) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`Value`](#component-value) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`Input`](#component-input) <br/> -->
  
**Composition** <br/>
  &ensp; •&nbsp; [Simple Composition](#concept-compose) <br/>
  &ensp; •&nbsp; [Peer Controllers](#concept-peers) <br/>
  &ensp; •&nbsp; [Child Controllers](#concept-children) <br/>
  &ensp; •&nbsp; [Parent Controller](#concept-children) <br/>

**Extension** <br/>
  &ensp; •&nbsp; [Extending Custom Models](#concept-) <br/>
  &ensp; •&nbsp; [Documenting and Types](#concept-) <br/>
  &ensp; •&nbsp; [Impact on Context](#concept-) <br/>
  &ensp; •&nbsp; [Best practices](#concept-) <br/>
  &ensp; •&nbsp; [Using Meta](#concept-meta) <br/>

### Internal Concepts
  &ensp; •&nbsp; [Subscriptions](#concept-lazy) <br/>
  &ensp; •&nbsp; [Auto Debounce](#concept-debounce) <br/>
  &ensp; •&nbsp; [Selectors](#concept-selectors) <br/>
### API
  &ensp; •&nbsp; [Model](#api-controller) <br/>
  &ensp; •&nbsp; [Singleton](#api-singleton) <br/>
  &ensp; •&nbsp; [Patterns](#api-patterns) <br/>
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

<h1 id="good-start">A good start</h1>

### Step 1

First, create a class to extend `Model` and shape it to your liking.

```js
class Counter extends Model {
  current = 1

  increment = () => { this.current++ };
  decrement = () => { this.current-- };
}
```

### Step 2

Pick a built-in hook, such as `.use()`, to make your component stateful.

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

Ultimately the workflow is pretty simple. If you know [MobX](https://mobx.js.org/README.html) this will look familiar, but also a lot more straight-forward.

1. Create a class and fill it with the values, getters, and methods you'll need.
2. Extend `Model` (or any derivative, for that matter) to make it "observable".
3. Within a component, call one of the built-in methods, as you would any normal hook.
4. Destructure out values to make use of them and subscribe.
5. Update those values on demand. Your component will keep sync automagically. ✨
<br/><br/>

### Some Definitions

The following is a crash-course to help get you up to speed quickly.<br/>
To that end, here's some library jargon which will be good to know.

 - **Model**: Any class you'll write extending `Model`; your definition for a type of controller.
 - **Controller**: An instance of your model, usable wherever you need it.
 - **State**: A stateful proxy, specific to the component, managing its behavior. 
 - **Subscriber**: State's better half, a channel to MVC engine, responding to events.
 - **View**: A function-component which may be mounted and accept hooks.
 - **Element**: Instance of a component/view, actively mounted with its own state and lifecycle.

<br/>

Alrighty then, let's get started :clap:
<br/><br/>

<h2 id="concept-simple">Simplest use-case</h2>

Let's back up from our first example, starting with a bare minimum.

```jsx
import Model from "@expressive/mvc";

class Counter extends Model {
  number = 1
}
```

Here we define a class with properties we wish track. Values set in the constructor (or as class properties) serve as initial state. 

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
<a href="https://codesandbox.io/s/deep-state-simple-e3xcf"><sup>View in CodeSandbox</sup></a>
 
One of the static-methods on your class will be `use`. This is a hook; it will create a new instance (of a given model) and bind it to the component.

Now, we can just "edit" properties as we see fit! As the values on this state change, our hook handles any need for a new render.

<br/>

<h2 id="concept-destruct">Destructuring</h2>

[Subscribers are lazy](#concept-lazy), they will only update a view for values seen to be in-use. 

A good idea is to destructure values used by a component. This keeps intent clear and prevents unexpected behavior.

Now, you might wonder how we'd access our instance, having already destructured. To cover for this, you'll see a **`get`** and **`set`** included with the returned state.

> Not to be confused with the keywords! They're just properties, and both a simple reference back to state.

### `set`

Having destructured, we'll need `set` to update the properties of our instance.

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

> HmmMMMmm, `set.number` See what we did there? 🤔

### `get`

Exactly the same as `set`, for other purposes while also keeping things readible. Most of the time, `get` is to pull information without also implying you want updates. <br/>

Usually, when an observable value is accessed, the controller assumes a refresh is needed anytime that property changes. In plenty of situations, this isn't the case, so `get` serves as an escape-hatch.

<br/>

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

What's a class without some methods? Let's add some *actions* [(similar to that of MobX)](https://mobx.js.org/refguide/action.html) to abstract out changes to our state.

```jsx
class Counter extends Model {
  current = 1

  // Note that we're using arrow functions to preserve `this`.
  // In-practice, this acts a lot like a useCallback, but better!
  increment = () => { this.current++ };
  decrement = () => { this.current-- };
}
```


> You may notice this approach is cleaner, but it is also more efficient than inline-functions. Not only do these "actions" have names, but the handlers now won't make a new closure for every render. 😬

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

You'll be happy to know we have a strong equivalent to "computed" properties.

All you need to do is define a `get()` method and it will be managed for you, by the controller. Computed values are run only when first accessed, and actively kept up-to-date thereafter.

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

Getters' values are cached, facing the user. They will only run when a dependency changes, and **not** upon access (besides the first) as you might expect.

Getters do run whenever the controller thinks they *could* change, so make sure to design them with these guiding principles:
- Getters should be *deterministic*. Only expect a change where inputs have changed.
- Avoid computing from values which change a lot, but don't output new values as often.
- [Goes without saying](https://www.youtube.com/watch?v=0i0IlSKn0sE "Goes Without Saying") but, **side-effects are an anti-pattern**, and can cause infinite loops.

<br/>

<h2 id="concept-constructor">Custom arguments</h2>

The method `use(...)`, as it creates the control instance, will pass arguments to your model's constructor. This makes it easy to reuse and customize state for a particular component.

> Typescript 
```ts
class Greetings extends Model {
  firstName: string;
 
  constructor(fullName: string){
    super();
    this.firstName = fullName.split(" ")[0];
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

Besides `use`, there are similar methods, able to assign values after a controller is created. This is a great alternative to manually setting values, as we did in the example above.

<h3 id="method-uses"><code>Model.uses({ ... })</code></h3>

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
> Here we see Greetings "exports" *firstName* & *isBirthday*. Though to do this effectively, it first needs to "import" *name* and *birthday*, which start out undefined. Let's pass in the `props` object to help that along.

```jsx
const HappyBirthday = (props) => {
  const { firstName, isBirthday } = Greetings.uses(props);

  return (
    <big>
      <span>Hi {firstName}<\span>
      {isBirthday &&
        <b>, happy birthday!</b>
      }!
    </big>
  );
}
```
> Now, all that's left is to define in those props. Pretty easy!
```jsx
const SayHello = () => (
  <HappyBirthday
    name="John Doe"
    birthday="January 1"
  />
)
```

This method is naturally picky and will only capture values which exist on our state at creation. However, you could specify what properties you wish to pull from like this:

```js
const state = Model.uses({ ... }, ["name", "birthday"]);
```

This way objects containing _more_ than required data are still usable without polluting your state.

<!-- <sup><a href="https://codesandbox.io/s/example-constructor-params-22lqu">View in CodeSandbox</a></sup> -->

<br/>

### ✅ Level 1 Clear!
> In this chapter we learned the basics of how to create and utilize a custom state. For most people who simply want smarter components, this could be enough! However, we can go well beyond making just a fancy hook.

<br/>

<h1 id="managing-section">Creating a dynamic state</h1>

So far, all of our example controllers have been passive. Our next step will be to give our controller a bigger roll, pushing updates without direct user interaction.

Because state really is a just portable object, we can do whatever we want to values, but more-crucially, whenever and wherever. This makes asynchronous coding pretty low maintenance. We handle the logic for what we want and the controller will handle the rest.

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

<h2 id="concept-events">Events Handling</h2>

Beyond watching for changes in state, what a subscriber really cares about is events. *Updates are just one source of an event.* Whenever a property on your state gains a new value, subscribers are notified and just acting accordingly.

While usually it'll be a controller waiting to refresh a component, anything can subscribe to an event via callbacks. If this event *is* caused by an update, the new value will be its `argument`; if synthetic however, that's be up to the dispatcher.
<br /><br />

<h3 id="concept-listen-event">Listening for events</h3>

> Assume the following callback:

```js
const callback = (value, name) => {
  console.log(`${name} was updated with ${value}!`)
}
```

Instances of `Model` have the following methods for event handling:

#### `state.on(name, callback) => onDone`

Register a new listener on a given key. `callback` will be fired when `state[name]` updates, or a synthetic event is sent.

The method also returns a callback, used to stop subscribing. 

> You do not need to cleanup events yourself, before expiring state. Built-in event `willDestroy` will itself stop any active listeners.

#### `state.once(name, callback) => onCancel`

Same as `on`, however will clean itself after being invoked. You can still cancel though with the returned callback.

#### `state.once(name) => Promise<value>`

If `callback` is not provided, `once` will return a Promise instead, which resolves the next value (or argument) `name` receives.

#### `state.watch(keys, callback, once?) => onDone`

A more versatile method used to monitor one or multiple properties with the same callback.
<br /><br />

<h3 id="concept-builtin-event">Listening for built-in events</h3>

Controllers will also send lifecycle events for their bound components.

All events share names with their respective method-handlers, [listed here](#lifecycle-api).
<br /><br />

<h2 id="concept-push-event">Pushing your own events</h2>

#### `state.update(key, argument?)`

Fires a synthetic event; it will be sent to all listeners of `name`, be them subscribed controllers or one of the listeners above.

This can have slightly different behavior, depending on the occupied-status of a given key.

- no property exists: 
  * Explicit subscribers will receive the event; components cannot.
- Property exists:
  - **no argument:** All subscribers will force-update, listeners get the current value.
  - **has argument:** Property will be overwritten, listeners get the new value.
- property is a getter:
  - **no argument:** Getter will force-compute, listeners get its output regardless if new.
  - **has argument:** Cache will be overwritten (compute skipped), listeners get that value.

Events make it easier to design using closures and callbacks, keeping as few things on your model as possible. Event methods can also be used externally, for other code to interact with as well.
<br /><br />

### Event handling in-practice:

```js
class Counter extends Model {
  seconds = 0;

  componentDidMount(){
    const timer = setInterval(() => this.seconds++, 1000);
    const timerDone = () => clearInterval(timer);

    // run callback every time 'seconds' changes
    this.on("seconds", this.tickTock);

    // run callback when minute event is sent out
    this.on("isMinute", this.alertMinutes);

    // run callback when unmount is sent by controller.
    // using events, we avoid needing a whole method for just this
    this.once("componentWillUnmount", timerDone);
  }

  alertMinutes(minutes){
    alert(`${minutes} minutes have gone by!`)
  }

  tickTock(seconds){
    if(seconds % 2 == 1)
      console.log("tick")
    else
      console.log("tock")

    if(seconds % 60 === 0){
      // send minute event (with optional argument)
      this.update("isMinute", Math.floor(seconds / 60));
    }
  }
}
```

<br />

<h2 id="concept-async">Watching external values</h2>

Sometimes, you may want to detect changes from outside, usually via props. Watching values outside a controller will require you integrate them as part of state, however we do have a handy helper for this.

<h3 id="method-using"><code>Model.using({ ... })</code></h3>

> If you remember [`uses`](#concept-passing-props), this is roughly equivalent.

This method helps "watch" props by assigning argument properties **every render**. Because the observer will already will react to *new* values, this makes for a fairly clean way to watch props. We can combine this with getters and event-listeners, to do all sorts of things when inputs change.

<br />

```ts
class ActivityTracker {
  active = undefined;

  get status(){
    return this.active ? "active" : "inactive";
  }

  componentDidMount(){
    this.on("active", (yes) => {
      if(yes)
        alert("Tracker prop just became active!")
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

> **Note:** This method is also picky (ala `uses`), and will ignore any value not pre-existing on the controller.

```jsx
const Activate = () => {
  const [isActive, setActive] = useState(false);

  return (
    <div onClick={() => setActive(!isActive)}>
      <DetectActivity active={isActive} />
    </div>
  )
}
```
Like this, we can freely interact with all different sources of state!

<br />

<h2 id="concept-async">Working with async and callbacks</h2>

Because dispatch is taken care of, we can just edit values on-demand. This makes the asynchronous stuff like timeouts, promises, callbacks, and fetching a piece of cake.

```ts
class StickySituation extends Model {
  remaining = 60;
  agent = "Bond";

  componentDidMount(){
    const timer = setInterval(this.tickTock, 1000);

    this.watch(
      ["stop", "componentWillUnmount"],
      () => clearInterval(timer)
    );
  }

  tickTock = () => {
    const timeLeft = --this.remaining;
    if(timeLeft === 0)
      this.update("stop");
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
<!-- <sup><a href="https://codesandbox.io/s/example-async-effbq">View in CodeSandbox</a></sup> -->

<br/>

### 👾 Level 2 Clear!


> Notice how our components remains completely independent from the logic sofar; it's a pretty big deal. 
>
> If we want to modify or even duplicate our `ActionSequence`, with a new aesthetic or different verbiage, we don't need to copy or edit any of these actual behaviors. 🤯

We can still take this forward however, becasue with classes, we can _share_ logic just as easily as reuse it.

<br/>

<h1 id="sharing-section">Sharing state</h1>

Upward and onward! Now for the fun part.

One of the most important features of a Model is an ability to share state with any number of subscribers, be them components or [even other controllers](). Whether you want state in-context or to be usable app-wide, you can with a number of simple abstractions.

<br/>

<h2 id="managing-section">Getting Started</h2>

Before going in depth, a use-case should help get the basic point across.

### Step 1
Start with a normal, run-of-the-mill Model.

```js
export class FooBar extends Model {
  foo = 0;
  bar = 0;
};
```

### Step 2
Using the creatively-named `Provider` component, create and pass an instance of your state into its `of` prop. This is all you need to make instance `foobar` available to childern.

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
Similarly to how `FooBar.use()` create's an instance of `FooBar`, we can use `FooBar.get()` to retrieve an *existing* instance of `FooBar`. 

Let's define components _Foo_ and _Bar_ and complete our example.

```jsx
const Foo = () => {
  const { foo } = FooBar.get();

  return (
    <div>
      The current value of foo is {foo}!
    </div>
  )
}

const Bar = () => {
  const { bar } = FooBar.get();

  return (
    <div>
      The current value of bar is {bar}!
    </div>
  )
}
```
You see, we're piggie backing off of the classes themselves. With it, we have a clean way of "selecting" what type of state we want in-context.

Also, if you didn't notice already, there's also another big benefit: *types are preserved!* Classes, when properly documented, get the full power of static-types and JSDocs. Enjoy autocomplete, hover, and intellisense even as you pass controllers all-throughout your app! 🎉 

<br/>

<h2 id="managing-section">Providing via Context</h2>


Here we will cover how to create and cast out state for use, by components and peers. It's in the [next chapter](#access-section) though, where we'll expand on how to consume them.

By default, a `Model` uses [React Context](https://frontarm.com/james-k-nelson/usecontext-react-hook/) under-the-hood to find others from inside a tree.

There's more than one way however, to create a controller and insert it into context. That said, there is nothing special needed on a model to make this work.

```ts
export class FooBar extends Model {
  foo = 0;
  bar = 0;
};
```

> Notice this example does `export` FooBar. You need not keep a Model and it's respective consumers in the same file, let alone module! Want to publish a reusable controller? This can make for a very "consumer-friendly" solution.

<!-- <sup><a href="https://codesandbox.io/s/example-multiple-accessors-79j0m">View in CodeSandbox</a></sup>  -->

<br/>

## Providing an instance

Unlike a normal `Context.Provider`, `Provider` it is fully managed. Simply place what you want made available in it's `of` prop. For any children, your state is now available, via it's class.

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

## Spawning an instance

Assuming no-frills, creating an instance just to provide it can be an unnecessary step. If you pass a Model itself however, to `Provider`, it can both create and provide an instance in one sitting!
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

## Spawning with props

Hey, we remember [`Model.using()`]() right? When given a Model directly, Provider inherits the same behavior! Any other props given applied to it are forwarded to the instance and tracked per-render.

```jsx
const MockFooBar = (props) => {
  return (
    <Provider of={FooBar} foo={5} bar={10}>
      {props.children}
    </Provider>
  )
}
```

> Nice! Now we can easily tweak the values seen by consumers. A big help for quick mock-ups during development.

## Providing multiple at the same time

Finally, the `of` prop can also accept either an object or array of Models and/or State objects. Mix and match as needed to ensure a dry, readible root.

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

<!-- <h3 id="managing-section"><code>MultiProvider</code></h3> -->

<br/>

<h1 id="managing-section">Global Models</h1>

While context is recommended to ensure isolation, very often we may want to use just one controller for a particular purpose. Think concepts like Login, Settings, Routes, and interacting with outside APIs.

> If ever used [react-router](https://github.com/ReactTraining/react-router), you'll know a root `<BrowserRouter>` while necessary, is just a formality.

Here we introduce a new class of Model called `Singleton`. With it, we can create shared state without caring for hierarchy! Hooks work exactly the same as on their `Model` counterparts, except under the hood they always retrieve a single, promoted instance.

## Defining a Singleton

Just a variant of `Model`, we'll be extending `Singleton` instead.

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

<br />

## Activating a Singleton

Something to keep in mind. Singletons are not be useable until their state is initialized in one of three ways.


### Method 1: `Singleton.create(...)`

A built-in function on all Models, `create` on a Singleton will also ensure the instance is made available. This can be done anytime, as long as it's before a dependant (component or peer) tries to access data from it.

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
  const LoginPrompt = () => {
    const { get: state, loggedIn, userName } = Login.use();

    return loggedIn
      ? <Welcome name={userName} />
      : <Prompt onClick={() => state.resumeSession()} />
  }
  ```
Login instance will be freely accessible after `use()` returns. <br/> 
> **Note:** instance **will become unavailable** if `LoginPrompt` does unmount. <br/>
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
> Similarly, the active instance is destroyed when its Provider unmounts. You'd most likely do this when you want to limit side-effects of a Singleton to when a particular UI is on-screen.

<br/>

<h1 id="access-section">Accessing shared state</h1>

Let's recall our `FooBar` example.

```ts
export class FooBar extends Model {
  foo = 0;
  bar = 0;
};
```

Whether our model is that of a Model or Singleton will not matter for this exercise. <br/>
They both present the same, to you the user!
<br/><br/>

<h2 id="managing-section">Via Hooks</h2>
<!-- <h3 id="managing-section"><code>get()</code></h3> -->

<h3 id="managing-section"><code>tap()</code></h3>

> With the method `.tap`, rather than making a new `Central` controller, will obtain the nearest one
```jsx
const InnerFoo = () => {
  const { fooUp, bar } = Central.tap();

  return (
    <div onClick={fooUp}>
      <pre>Foo</pre>
      <small>Bar was clicked {bar} times!</small>
    </div>
  )
}
```
> **Remember:** The controller knows this component needs to update only when foo changes. Lazy subscription ensures only the properties accessed here are refreshed here!
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

<!-- <h3 id="managing-section"><code>sub()</code></h3>

<h2 id="managing-section">Peer Controllers</h2>


<br/>

<h2 id="managing-section">Managed Elements</h2>
<h3 id="managing-section"><code>&lt;Value/&gt;</code></h3>
<h3 id="managing-section"><code>&lt;Input/&gt;</code></h3> -->

<br/>

<h1 id="managing-section">Structuring your state</h1>

Another core purpose of use-controller, and using classes, is to "dumb down" the state you are writing. Ideally we want controllers to be really good at **one** thing, and be able to cooperate with other controllers as an ecosystem.

> **This** is how we'll build better performing, easier to-work-with applications, even with the most complex of behavior.

Here we'll go over, in broad strokes, some of the ways to structure state harmoniously.

<br/>

<h2 id="concept-typescript">Models & Typescript</h2>

Remember to code responsibly. This goes without saying, but typescript is your friend. With controllers you can enjoy full type safety and inference, even within components themselves.

> Typescript

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
<!-- <sup><a href="https://codesandbox.io/s/example-typescript-n21uj">View in CodeSandbox</a></sup> -->

<br/>

<h2 id="concept-compose">Simple composition <small>(and separation of concerns)</small></h2>

There is nothing preventing you from use more than one controller in a component! Take advantage of this to create smaller, cooperating state, rather than big, monolithic state.

```js
  class Ping extends Model {
    value = 1
  }
  
  class Pong extends Model {
    value = 2
  }

  const ControllerAgnostic = () => {
    const ping = Ping.use();
    const pong = Pong.use();

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


<!-- <h2 id="managing-section">Child Controllers</h2> -->

<br/>

<!-- <h1 id="sharing-section">Extending state</h1>

<h2 id="managing-section">Super Controllers</h2>
<h2 id="managing-section">Using Meta</h2>

<br/> -->

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

<br/>
<br/>

<h1>API</h1>
<br/>

<h2 id="controller-api">Model</h2>

Set behavior for certain properties on classes extending `Model`.

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
