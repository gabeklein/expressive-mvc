
<h1 align="center">
  use-controller
</h1>

<p align="center">
  Easy to use state controllers using classes and hooks.
</p>
 
<p align="center">
  <a href="https://www.npmjs.com/package/@gabeklein/use-controller"><img alt="NPM" src="https://img.shields.io/npm/v/@gabeklein/use-controller.svg"></a>
  <a href=""><img alt="Build" src="https://shields-staging.herokuapp.com/npm/types/@gabeklein/use-controller.svg"></a>
</p>

# Quick Start

<br />

> Install with preferred package manager
```bash
npm install --save @gabeklein/use-controller
```
<br />

> Import and use in your react apps.

```js
import Controller, { use } from "@gabeklein/use-controller";
```

<br/>

## Live demos

<br/>

Try it for yourself! A demo project is in the `/examples` directory with a series of examples you can launch, browse through and modify.

```bash
git clone https://github.com/gabeklein/use-controller.git
cd use-controller
npm install
npm start
```

<br/>

# What does this do?

There are two ways to use hooked-controllers, with the `use()` hook or by extending your control-classes with `Controller`. Both ways behave pretty much the same, albeit with different features.

What they both do is pretty simple. They take a class and turn it into ✨*live-state* ✨ for your components!


<br/>

# The `use(class)` hook

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
        onClick={() => { 
          state.number -= 1
        }}>
        {"-"}
      </Button>
      <Box>{state.number}</Box>
      <Button 
        onClick={() => { 
          state.number += 1
        }}>
        {"+"}
      </Button>
    </Container>
  )
}
```

> Just for sake of simplicity, we are only using one value.

Here we create a state controller, with the `use()` hook, passing in `Counter`. This will create a new instance of your class, then scan the resulting instance for values. On the returned state, `use()` will watch for changes in those values, compare updates, and if they're different... trigger a render! 🐰🎩 No need for `setValue` callbacks, and you can have as many as you want!

<br/>

## Why do it this way? 


### A quick comparison

> Here is an example where we have multiple values to track. <br/>
> It's a heck-ton of vars and it only adds up; not always easy to read or infer. 

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

<br/>

### How can we do better?

> Use a class and the `use()` hook.

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

> A lot better on the variables.

The hook's argument over there, its *constructor*, will only run at mount, and the returned object will then be bootstrapped into live state.

The component now updates when any of your declared values change (using assigned setters). You can add as many values as you like, and they'll stay clean and relatively organized in your code.

<br />

### Destructuring

> The reserved key `set` has you covered for updating!

```jsx
const HappyTown = () => {
  const {
    set, // ⬅ proxy value for `state`
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

Similar to actions in [MobX](https://github.com/mobxjs/mobx), you can place methods amongst your watched values. 

They'll access your live state and work [generally as you'd expect](https://www.destroyallsoftware.com/talks/wat), with regards to `this` keyword. 

All methods are bound automatically (both arrow and proto functions), so you can pass them to callbacks and sub-components.

<br/>

> Let's go back to our counter example. There's a big improvement we can make.


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
        onClick={count.incremement}>
        {"+"}
      </Button>
    </Row>
  )
}
```

> Nice! Now all logic is completely out of the component. Super clean 💪

<br/>

# Automatic debouncing

Any updates you make synchronously will be batched together as only one update.

```jsx
class Multiple {
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
  const chair = use(Multiple);

  <span>Foo is {chair.foo}'s chair!</span>
  <span>Bar is {chair.bar}'s chair!</span>
  <span>Baz is {chair.baz}'s chair!</span>

  <div onClick={chair.shuffle}>🎶🥁🎶🎷🎶</div>
}
```

> We have `Foo` here blindfold so they'll be a bit slow finding a seat.<br/>
No worries though, even though we're ultimately updating values four times, `use()` only needs to re-render twice. It updates once for everybody together (being on the same tick), then resets and wakes again for `foo`!

<br/>

# Special Entries

While standard practice is for `use` to take all methods (and bind them), all properties (and watch them), there are special circumstances to be aware of.

<!-- <br/> -->

## Properties

#### `set`
- Not to be confused with setters.
- `state.set` always returns a reference to `state`
- this is useful to access your state object when destructuring

<!--

#### `Arrays`
- if a property is an array, it will be forwarded to your components as a `ReactiveArray` which may also trigger a render on mutate.

-->

#### `_anything`
- if a key starts with an underscore it will not trigger a refresh when overwritten (or carry any overhead to do so). No special conversions will happen either. It's a shorthand for "private" keys which don't interact with the component.

#### `Anything defined post-constructor`
- important to notice that `use()` can only detect properties which exist (and are enumerable) at time of creation. If you create them after, they're effectively ignored.

<br/>

## Reserved methods (`use` will define them)

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

<br/>

## LifeCycle Methods (`use` will call them)

#### `didMount(): void`
- `use()` will call this while internally running `useEffect(fn, [])` for itself.

#### `willUnmount(): void`
- `use()` will call this before starting to clean up.

<br/>

### Example using lifestyle methods

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

<br/>
<br/>

# The `Controller` superclass

While we get a lot from `use()` and standard (or otherwise extended) classes, there's a few key benefits in actually extending `Controller`.

- You can pass arguments to your constructor
- Type inferences are maintained, making intellisense a lot better
- Nuanced updates (will only render for actually-used properties)
- No need for underscores on un-tracked properties.
- Access to context features
- Optional error boundaries

<br/>

## Refactoring our previous example (and then some)
<br/>

Import "Controller" as whatever you like from `"@gabeklein/use-controller"` and extend yours with it. <br/>
> We'll be using Typescript on this one, because types inferences are back with this approach.

```tsx
import Control from "@gabeklein/use-controller";

class FunActivity extends Control {
  duration: number;
  interval: number;

  constructor(alreadyMinutes: number = 0){
    this.duration = 
      alreadyMinutes * 60;

    this.interval = 
      setInterval(() => {
        this.duration++;
      }, 1000)
  }

  get minutes(){
    return Math.floor(this.duration / 60);
  }

  willUnmount(){
    clearInterval(this.interval)
  }
}
```
> Now instead of the `use()` hook, we will use *the all-new* `.use()` hook!

```jsx
const PaintDrying = ({ already }) => {
  const { minutes } = FunActivity.use(already);

  return (
    <div>
      I've been staring for { minutes } minutes now, 
      and I'm starting to see what this is all about!
    </div>
  )
}
```

### There's a lot to unpack here

- This static method will hook into your component and construct state only once, the same as standard `use()` would. <br/>

- For `Class<T>` the static method `.use()` returns `InstanceType<T>` so you have access to type checking in the component.

- Notice we did not underscore `interval` this time: <br/>

  - Controller extended classes, smartly, will only subscribe to values which are **accessed on the first render of a component they're consumed in.**
  - As such, we don't need to hint with that underscore anymore! And, because `minutes` will use `duration` itself, `.use()` still knows to watch it.

- We also moved the `setTimeout` to the constructor, to grab an initial value. 

<br/>

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

  getSombodyElse(){
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
        <u onClick={agent.getSombodyElse}>
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

<br/>


### 🚧 More ideas are currently under construction, so stay tuned! 🏗

<br/>

# License

MIT license. <br/>