
<h1 align="center">
  react-use-controller
</h1>

<p align="center">
  Easy to use state controllers using classes and hooks.
</p>
 
<p align="center">
  <a href="https://www.npmjs.com/package/@gabeklein/use-controller"><img alt="NPM" src="https://img.shields.io/npm/v/@gabeklein/use-controller.svg"></a>
  <a href=""><img alt="Build" src="https://shields-staging.herokuapp.com/npm/types/@gabeklein/use-controller.svg"></a>
</p>

<br/>
<p align="center">
  <b>Use any class into a hook-based view controller!</b>

  <p align="center">Simply make a class with values, methods, and even life-cycle callbacks.<br/>
  The <code>use()</code> hook returns a live-state, which update components when properties do.<br/>Use both per-component or multi-component with the help of context, even as global state!</p>
</p>

<br/>



## Install

<br />

> Install with preferred package manager
```bash
npm install --save react-use-controller
```
<br />

> Import and use in your react apps.

```js
import Controller, { use } from "react-use-controller";
```

<br/>

## Live demos

<br/>

Try it for yourself. 👍 Demo project is in the `/examples` directory with a series of examples you can launch, browse through and modify.

```bash
git clone https://github.com/gabeklein/use-controller.git
cd use-controller
npm install
npm start
```

<br/>

# Tutorial

There are two ways to use view-controllers, with the `use()` hook or by [extending `Controller`](#controller-section). Both ways behave pretty much the same, albeit with different features.

What they both do is pretty simple. They take a class and turn it into ✨*live-state* ✨ for your components!


<br/>

## The `use()` hook

> Let's start with a simple example to get the basic point across.

```jsx
class Count {
  number = 1
}

const Counter = () => {
  const state = use(Count);

  return (
    <Container>
      <Button 
        onClick={() => { state.number -= 1 }}>
        {"-"}
      </Button>
      <Box>{state.number}</Box>
      <Button 
        onClick={() => { state.number += 1 }}>
        {"+"}
      </Button>
    </Container>
  )
}
```

> Just for simplicity's sake, we are using only one value.

Here we create a state controller `Count`, and pass it into `use()` hook within our component. This will create a new instance of the class and scan it for values. Our returned `state` reflects that instance exactly, however is able to watch for changes, compare values, and if different... trigger renders! 🐰🎩 No need for `setValue` callbacks, and you can have as many properties as you want!

<br/>

## Why do it this way? 

> Remember that React is an MVC?

### A quick comparison

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

<!-- <br/> -->

### How can we do better?

Make a class containing state (*the Model*) and supply it to the `use()` hook.

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

> A lot better on the variables, plus we've removed our Model (the data) out of our View (the component)!

This hook's argument, its *constructor*, will only run at mount; and the returned object will be bootstrapped into a live state.

This component now updates when any of your declared values change. Add as many values as you like, and they'll stay clean and relatively organized in your code.

<br />

## Destructuring

Using reserved key `set`, we're also able to update values, even while destructuring.

```jsx
const HappyTown = () => {
  const {
    set, // ⬅ a proxy for `state`
    name,
    emotion,
    reason
  } = use(EmotionalState);

  return (
    <div>
      <div onClick = {() => {
        set.name = prompt("What is your name?", "John Doe");
      }}>
        My name is {name}.
      </div>
      <div>
        <span onClick = {() => {
          set.emotion = "doing better"
        }}>
          I am currently {emotion} 
        </span>
        <span onClick = {() => {
          set.reason = "hooks are cooler than my nitro-cold-brew® coffee! 🕶"
        }}>
          , because {reason}.
        </span>
      </div>
    </div>
  )
}
```

> See what we did there? 🤔

<br/>

# Adding Methods

Similar to [MobX](https://github.com/mobxjs/mobx), we can place methods, getters, and setters along side watched values, to create transactions. <br/>
They access live state and work [generally as you'd expect](https://www.destroyallsoftware.com/talks/wat), with regards to `this` keyword. 

**All methods are bound automatically** (both arrow and proto functions), so you can pass them as callbacks or to sub-elements.

<br/>

> Let's go back to our counter example. There is one big improvement we can make.


```jsx
class Count {
  current = 1

  increment = () => this.current++;
  decrement = () => this.current--;
}

const KitchenCounter = () => {
  const count = use(Count);

  return (
    <Row>
      <Button
        onClick={count.decrement}>
        {"-"}
      </Button>
      <Box>{count.current}</Box>
      <Button 
        onClick={count.increment}>
        {"+"}
      </Button>
    </Row>
  )
}
```

> Nice! Now all logic (*the Controller*) is out of our component, and we're left with a pure *View*. Super clean 💪

<br/>

## Automatic debouncing

Rest assured. Updates you make synchronously will be batched together as only one update.

```jsx
class ZeroStakesGame {
  foo = "bar"
  bar = "baz"
  baz = "foo"

  shuffle(){
    this.foo = "???"
    setTimeout(() => {
      this.foo = "baz"
    }, 500)
    this.bar = "foo"
    this.baz = "bar"
  }
}

const MusicalChairs = () => {
  const chair = use(ZeroStakesGame);

  <span>Foo is {chair.foo}'s chair!</span>
  <span>Bar is {chair.bar}'s chair!</span>
  <span>Baz is {chair.baz}'s chair!</span>

  <div onClick={chair.shuffle}>🎶🥁🎶🎷🎶</div>
}
```

> Even though we're ultimately making four updates, `use()` only needs to update-render twice. It does it once for everybody (being on the same tick), resets, and again wakes for `foo` when all settled in.

<br/>

## Lifestyle methods

If you define the [reserved callbacks](), `use()` will call them internally when appropriate!

> Here we'll spawn an interval on mount, which should also be cleaned up when the component unmounts.

```js
class FunActivity {
  duration = 0;

  didMount(){
    this._interval = 
      setInterval(() => {
        this.duration++;
      }, 1000)
  }

  willUnmount(){
      clearInterval(this._interval)
  }
}
```

```jsx
const PaintDrying = () => {
  const fun = use(FunActivity);

  return <div>Well there's {fun.duration} seconds I'm never getting back...</div>
}
```
> So boring, yet exciting at the same time. 👀

<br/>
<br/>

<h1 href="controller-section">The <code>Controller</code> superclass</h1>

While you get a lot from `use()` and standard (or otherwise extended) classes, there's a few key benefits in actually extending `Controller`.

- You can pass arguments to your constructor
- Type inferences are maintained, making type-checking a lot better
- Nuanced updates (subscription based rendering)
- No need for underscores on un-tracked properties.
- Access to the `Provider`, making state accessible anywhere.
- An optional error-boundary

<br/>

## Refactoring our previous example

Import **Controller** as whatever you like from `"react-use-controller"` and extend your class with it. <br/>
> We'll use TS for this example, because types inferences are back with this approach!

```tsx
/* typescript */

import Control from "react-use-controller";

class FunActivity extends Control {
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

  willUnmount(){
    clearInterval(this.interval)
  }
}
```
> Now instead of the `use()` hook, we'll use *the 2019-all-new* `.use()` hook!

```jsx
const PaintDrying = ({ alreadyMinutes }) => {
  const { secondsSofar } = FunActivity.use(alreadyMinutes);

  return (
    <div>
      I've been staring for like, { secondsSofar } seconds now, 
      and I'm starting to see what this is all about! 👀
    </div>
  )
}
```

### There's a lot to unpack here

- This static method will hook your component and construct state only once, the same as standard `use()` would. <br/>
- We've moved the `setTimeout` to the constructor, to grab an initial value.
- For class `T` the static method `.use()` returns `InstanceType<T>` thus provides full type inference within the component.
- Notice we did not underscore `interval` in this example. That's because of [lazy updating]() explained below.<br/>

<br/>

## Subscription based rendering

Controller, unlike `use()`, uses a subscription model to decide when to render. Components will **only** update for changes to values which are needed for rendering.

```jsx
class LazyController extends Control {
  foo = "bar"
  bar = "foo"
}

const LazyComponent = () => {
  const { set, foo } = LazyController.use();

  function barIsBaz(){
    set.bar = "baz"
  }

  return (
    <h1 onClick={barIsBaz}>
      Foo is {foo} but click here to update bar!
    </h1>
  )
}
```

> Here, unlike regular use, `.use()` will not bother to update `LazyComponent` when `.bar` does, because it is only subscribes to `.foo` here. 

<br/>

## Automatic subscription

Instances of `.use()` can figure out what to subscribe to automatically. They do it by spying on what's **accessed on the initial render** of any given component they're hooked into.

> That's why, in [the refactor]() of `FunActivity`, we didn't need to hint with underscores anymore.

**NOTE**: This does mean that it's generally recommended to always destructure. If a property is not accessed every render (within an `if` statement or ternary), it may not be detected!

<br/>

## Explicit subscription

There are a number of helper methods you can call to specify which properties you wish to watch.

> if you have constructor arguments chain after `use(...)`, if not you can also call a `"useVariant"` to keep things clean.

<br/>

### `.on()`  `.useOn()`

Declare properties you want to do want to watch, in addition to inferred properties.

```js
const View = (props) => {
  const { set, foo } = Controller.use(props).on("bar");
  return foo && (
    <span>{set.bar}</span>
  );
}
```
> This will refresh when either `foo` or `bar` change, even if `foo` starts out false.

<br/>

### `.only()`  `.useOnly()`
Declare the properties you wish to renew for. This will skip automatic inference.

```js
const View = () => {
  const control = Controller.useOnly("foo", "bar");
  // ...
}
```

<br/>

### `.except()`  `.useExcept()`

Declare properties you want to exclude. *May also be chained with `on()`*

```js
const View = () => {
  const { foo, bar } = Controller.useExcept("bar");
  return <span>{foo}</span>;
}
```
> This will only update when `foo` is updated, even though `bar` is definitely accessed.

<br/>

### `.once()`  `.useOnce()`

Will disable all but explicit `.refresh()` from this particular controller.

```js
const View = () => {
  const { foo, bar } = Controller.useOnce("bar");
  return false;
}
```
> This generates state, but never automatically updates.



<!--

### We can very easily translate our previous example and build from there.

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

Keeping the **M**, **V**, and **C** nice and separate.

```jsx
const ActionSequence = () => {
  const agent = StickySituation.use();

  if(agent.remaining == 0)
    return <h1>🙀💥</h1>

  return (
    <div>
      <div>Agent <b>{agent.surname}</b> we need you to diffuse the bomb!</div>
      <div>
        If you can't diffuse it in {agent.remaining} seconds, the cat may or may not die!
      </div>
      <div>
        But there is time! 
        <u onClick={agent.getSomebodyElse}>
          Tap another agent
        </u> 
        if you think they can do it.
      </div>
    </div>
  )
}
```

<br/>

# Sidebar: `use()` also accepts an object

If you prefer to prepare your initial values, without anything fancy, you can do that too.<br/>
This can be especially useful for situations with closures or [HOC's](https://reactjs.org/docs/higher-order-components.html).

> *Just don't give `use()` an object literal.*<br/>
> *It will get regenerated every render!* 


```jsx
const values = {
  name: "Bob"
}   

const Component = () => {
  const state = use(values);

  return (
    <div
      onClick = {() => {
        state.name = "Robert"
      }}>
      Hello {state.name}
    </div>
  )
}
```

Keep in mind updated values are stored on the given object. This can be helpful but only in particular use cases.

-->

<!--

## Special Entries

While standard practice is for `use` to take all methods (and bind them), all properties (and watch them), there are special circumstances to be aware of.

### Properties

#### `set`
- Not to be confused with setters.
- `state.set` always returns a reference to `state`
- this is useful to access your state object when destructuring

<!--

#### `Arrays`
- if a property is an array, it will be forwarded to your components as a `ReactiveArray` which may also trigger a render on mutate.


#### `_anything`
- if a key starts with an underscore it will not trigger a refresh when overwritten (or carry any overhead to do so). No special conversions will happen either. It's a shorthand for "private" keys which don't interact with the component.

#### `Anything defined post-constructor`
- important to notice that `use()` can only detect properties which exist (and are enumerable) at time of creation. If you create them after, they're effectively ignored.


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


### LifeCycle Methods (`use` will call them)

#### `didMount(): void`
- `use()` will call this while internally running `useEffect(fn, [])` for itself.

#### `willUnmount(): void`
- `use()` will call this before starting to clean up.

<br/>

<br/>


### 🚧 More ideas are currently under construction, so stay tuned! 🏗

-->

<br/>
<br/>
<br/>
<br/>
<br/>
<br/>
<br/>
<br/>

# License

MIT license. <br/>