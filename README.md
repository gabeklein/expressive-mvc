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

**Global** <br/>
  &ensp; •&nbsp; [Singletons](#section-global) <br/>
  &ensp; •&nbsp; [Register](#section-singleton-activate) <br/>

**Consuming** <br/>
  &ensp; •&nbsp; [Consumer](#concept-consumer) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [render](#consumer-render) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`get` prop](#consumer-get) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`tap` prop](#consumer-tap) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`has` prop](#consumer-has) <br/>
  &ensp; •&nbsp; [Hooks](#concept-consumer-hooks) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`get`](#method-get) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`tap`](#method-tap) <br/>
  &ensp;&ensp;&ensp; ◦&nbsp; [`sub`](#method-sub) <br/>
  
**Composition** <br/>
  &ensp; •&nbsp; [Simple Composition](#concept-compose) <br/>
  &ensp; •&nbsp; [Peer Controllers](#concept-peers) <br/>
  &ensp; •&nbsp; [Child Controllers](#concept-child-model) <br/>
  &ensp; •&nbsp; [Parent Controller](#concept-parent-model) <br/>

**Extension** <br/>
  &ensp; •&nbsp; [Extending Custom Models](#concept-extension) <br/>
  &ensp; •&nbsp; [Impact on Context](#concept-extension-context) <br/>
  &ensp; •&nbsp; [Using Meta](#concept-meta) <br/>

**Best Practices** <br/>
  &ensp; •&nbsp; [Documenting and Types](#concept-typescript) <br/>

### Concepts
  &ensp; •&nbsp; [Subscriptions](#concept-lazy) <br/>
  &ensp; •&nbsp; [Auto Debounce](#concept-debounce) <br/>
  &ensp; •&nbsp; [Selectors](#concept-selectors) <br/>

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

<h1 id="good-start">A good start</h1>

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
3. Within a component, use built-in methods, as you would a normal hook.
4. Destructure the values you'll need, to subscribe.
5. Update those values on demand. 

Your component will now keep sync automagically. ✨
<br/><br/>

### Some Definitions

The following is a crash-course to help get you up to speed quickly.<br/>
To that end, here's library jargon which will be good to know.

 - **Model**: Any class you'll write extending `Model`. Your definition for a type of controller.
 - **Controller**: An instance of your model, usable wherever you need it.
 - **State**: A stateful proxy, specific to the component, managing its behavior. 
 - **Subscriber**: A state, or callback otherwise, responding to updates.
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

Now, we can just "edit" the properties as we see fit! As the values on this state change, our hook handles any need for a new render.

<br/>

<h2 id="concept-destruct">Destructuring</h2>

[Subscribers are lazy](#concept-lazy), they will only update a view for values seen to be in-use. 

A good idea is to destructure values used by a component. This keeps intent clear and prevents unexpected behavior.

Now, having already destructured, you might wonder how we'd access our instance. To cover for this, you'll see a `get` and `set` included with the returned state.

> Not to be confused with the keywords! They're just properties, and both a simple reference back to state.

### `set`

Through the destructure, we'll use `set` to update the properties of our instance.

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

Exactly the same as `set`, for other purposes while also keeping things readible. Most of the time, `get` is to pull information without also implying you want updates. <br/>

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

What's a class without some methods? Let's add some *actions* to abstract changes to our state.

```jsx
class Counter extends Model {
  current = 1

  // Note that we're using arrow functions to preserve `this`.
  // In-practice, this acts a lot like a useCallback, but better!
  increment = () => { this.current++ };
  decrement = () => { this.current-- };
}
```


> You may notice this approach is cleaner, but it is also more efficient than inline-functions. Not only do these actions now have names, we avoid making new closures every render. 😬

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

You'll be happy to know we have a strong equivalent to *computed* properties.

All you need to do is define a `get()` method, which will be managed for you. Computed values first run when first accessed, and actively kept up-to-date thereafter.

Through the same mechanism as hooks, getters know when the specific properties they access are updated. Whenever that happens, they rerun. If a new value is returned, it's passed forward to the getter's own listeners.

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
> Here we see Greetings defines *firstName* & *isBirthday*. For this though, it first needs *name* and *birthday*, which start out undefined. Let's pass in the `props` object to help that along.

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
> Now, all that's left is to define in those props. Pretty easy!
```jsx
const SayHello = () => (
  <HappyBirthday
    name="John Doe"
    birthday="January 1"
  />
)
```

This method is naturally picky and will only capture values which already defined (as explicitly `undefined` or otherwise). However, you can still specify what properties you wish to pull from, like so:

```js
const state = Model.uses({ ... }, ["name", "birthday"]);
```

This way objects containing _more_ than required info are still usable without polluting your state.

<!-- <sup><a href="https://codesandbox.io/s/example-constructor-params-22lqu">View in CodeSandbox</a></sup> -->

<br/>

### ✅ Level 1 Clear!
> In this chapter we learned the basics of how to create and utilize a custom state. For most people who simply want smarter components, this could be enough! However, we can go well beyond making just a fancy hook.

<br/>

<h1 id="managing-section">Creating a dynamic state</h1>

So far, all examples have been passive. Next step will be to give our model a bigger roll, to update without direct interaction.

Because state is a just portable object, we can do whatever to values, but more-crucially, whenever and wherever. This makes asynchronous coding pretty low maintenance. Implement the business-logic and the controllers will handle the rest.

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
> Where have I seen that before... 🤔
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

Beyond watching for changes in state, what a subscriber really cares about is events. *Updates are just one source for an event.* Whenever a property on your state gains a new value, subscribers are simply notified and act accordingly.
<br />
<br />

<h3 id="concept-listen-event">Listening for events directly</h3>

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

<h3 id="concept-push-event">Pushing your own events</h3>

#### `state.update(key)`

Fires a synthetic event; it will be sent to all listeners of `name`, be them subscribed controllers or one of the listeners above. You may use any `string` or `symbol` as a key. However, any key also defined on state will count as an update.

Events make it easier to design using closures and callbacks, keeping as few things on your model as possible. Event methods can also be used externally, for other code to interact with as well.
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

    // wait for component to be mounted, to start timer
    this.once("componentDidMount", this.start);
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
}
```

> Notice how we saved not only two methods, but didn't need to store interval as a property either. Pretty clean!

<br />

<h2 id="concept-external">Watching external values</h2>

Sometimes, you may want to detect changes from outside, usually via props. Watching values outside a controller will require you integrate them as part of state, however we do have a helper for this.

<h3 id="method-using"><code>Model.using({ ... })</code></h3>

> If you remember [`uses`](#concept-passing-props), this is roughly equivalent.

This method helps "watch" props by assigning argument properties **every render**. Because the observer already reacts to *new* values, this makes for a simple way to watch props. We can combine this with getters and event-listeners, to do all sorts of things when inputs change.

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

    // we can watch more than one
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
<!-- <sup><a href="https://codesandbox.io/s/example-async-effbq">View in CodeSandbox</a></sup> -->

<br/>

### 👾 Level 2 Clear!

> Notice how our components remains completely independent from the logic sofar; it's a pretty big deal. 
>
> If we want to modify or even duplicate our `ActionSequence`, with a new aesthetic or different verbiage, we don't need to copy or edit any of these behaviors. 🤯

We can still take this forward however, becasue with classes, we can _share_ logic just as easily as reuse it.

<br/>

<h1 id="sharing-section">Sharing state</h1>

Upward and onward! Now for the fun part.

One of the most important features of a Model is an ability to share state with any number of subscribers, be them components or [even other controllers](). Whether you want state in-context or to be usable app-wide, you can with a number of simple abstractions.

<br/>

<h2 id="concept-sharing">Getting Started</h2>

Before going in depth, a quick use-case should help get basic point across.

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
      The value of foo is {foo}!
    </div>
  )
}

const Bar = () => {
  const { bar } = FooBar.get();

  return (
    <div>
      The value of bar is {bar}!
    </div>
  )
}
```
You see, we're piggie backing off of the class itself. With that, we have a super clear way of "selecting" what type of state we want in-context.

> Also, if you didn't notice already, there's another big benefit here: types are preserved! Classes, when properly documented, get the full power of static-types and JSDocs. Enjoy autocomplete, hover, and intellisense even as you pass controllers all-throughout your app! 🎉 

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

> Notice this example will `export` FooBar.
> 
> You need not keep a Model and it's respective consumers in the same file, let alone module. Want to publish a reusable controller? This can make for a very "consumer-friendly" solution. ☝️😑

<!-- <sup><a href="https://codesandbox.io/s/example-multiple-accessors-79j0m">View in CodeSandbox</a></sup>  -->

<br/>

<h2 id="concept-provider">Providing an instance</h2>

Here we'll pass a needed controller through the `of` prop. For any children, this state is now available, accessible through it's respective class.

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

<h2 id="concept-provider-props">Spawning with props</h2>

Hey, we remember [`Model.using()`](#concept-external) right? When given a Model directly, Provider inherits the same behavior! Any other props given applied to it are forwarded to the instance and watched.

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

Finally, the `of` prop will also accept an object or array of models and/or state objects. Mix and match as needed to ensure a dry, readible root.

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

While context is recommended to ensure isolation, you may want to assign just one controller for a particular purpose. Think concepts like Login, Settings, Routes, and interacting with outside APIs.

> For instance, if ever used [react-router](https://github.com/ReactTraining/react-router), you'll know a root `<BrowserRouter>` is only needed for its Provider.

Here we introduce a new class of Model called `Singleton`. With it, we can create shared state without caring about hierarchy. Hooks work exactly the same as on their `Model` counterparts, except under the hood they always retrieve a single, promoted instance.

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

<h1 id="access-section">Consume a shared state</h1>

Whether our model is that of a Model or Singleton will not matter for this exercise. They both present the same, to you the user!<br/>

```ts
export class FooBar extends Model {
  foo = 0;
  bar = 0;
};
```

> Let's recall our `FooBar` model for this section.

<br/>

<h2 id="concept-consumer">Consumers</h2>

<h3 id="consumer-render">Render Function</h3>

<h3 id="consumer-get"><code>get</code> Prop</h3>

<h3 id="consumer-tap"><code>tap</code> Prop</h3>

<h3 id="consumer-has"><code>has</code> Prop</h3>

<br/>

<h2 id="concept-consumer-hooks">Hooks Methods</h2>
<!-- <h3 id="managing-section"><code>get()</code></h3> -->

<h3 id="method-get"><code>get()</code></h3>

<h3 id="method-tap"><code>tap()</code></h3>

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

<h3 id="method-sub"><code>sub()</code></h3>

<br/>

### 🎮 Level 3 Complete! 

> Congrats on making it through this one, we were getting fancy there for a second. Here we've learned how to make state _accessible_, in more ways than one. Now with these tools we are able to tackle the more advanced connectivity.

Next chapter, we're going to dive into _ecosystems_ and how to split state and behavior into simple, often reusable chunks and hook (pun not intended) them together.

The ideal purpose of Models, and classes in general, is to "dumb down" the state you have to write. This makes code clear and behavior easy to duplicate. Ideally, we want controllers to be really good at **one** thing, and to cooperate with other systems as complexity grows.

<h1 id="managing-section">Composing your state</h1>

The ideal purpose of Models, and classes in general, is to "dumb down" the state you have to write. This makes code clear and behavior easy to duplicate. Ideally, we want controllers to be really good at **one** thing, and to cooperate with other systems as complexity grows.

> **This** is how we'll build better performing, easier to-work-with applications, even with the most complex of apps.

Here we will see, in broad strokes, some of the ways to setup mutliple states to work together.
<br/><br/>

<h2 id="concept-compose">Simple Composition</h2>

Nothing preventing using more than one state per component. Take advantage of this to create smaller, cooperating state, rather than big, monolithic state.

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
        <div onClick={() => { ping.value += pong.value }}>
          Ping's value is ${ping.value}, click to add pong!
        </div>
        <div onClick={() => { pong.value += ping.value }}>
          Pong's value is ${pong.value}, click to add ping!
        </div>
      </div>
    )
  }
```

<h2 id="concept-peers">Peer Controllers</h2>
<h2 id="concept-child-model">Child Controllers</h2>
<h2 id="concept-parent-model">Parent Controller</h2>

<br/>
<br/>
<h1 id="sharing-section">Extending & Reuse</h1>

<h2 id="managing-section">Extending Controllers</h2>
<h2 id="concept-extension-context">Impacts on Context</h2>
<h2 id="managing-section">Using Meta</h2>

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
Here we'll cover some of the features, which will help in understanding how MVC's work under the hood. 

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
<h2 id="concept-debounce">Automatic debouncing</h2>

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


<br/>
<h2 id="concept-debounce">Selectors</h2>


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
