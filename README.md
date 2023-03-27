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
  <a href="https://www.npmjs.com/package/@expressive/mvc"><img alt="NPM" src="https://badge.fury.io/js/%40expressive%2Fmvc.svg"></a>
  <!-- <a href=""><img alt="Build" src="https://shields-staging.herokuapp.com/npm/types/@expressive/mvc.svg"></a> -->
  <img src="https://img.shields.io/badge/Coverage-100%25-brightgreen.svg">
  <a href="https://join.slack.com/t/expressivejs/shared_invite/zt-s2j5cdhz-gffKn3bTATMbXf~iq4pvHg" alt="Join Slack">
    <img src="https://img.shields.io/badge/Slack-Come%20say%20hi!-blueviolet" />  
  </a>
</p>

<p align="center">
  Define classes to power UI by extending <code>Model</code>.<br/>
  Builtin hooks will manage renders, as needed, for any data.<br/>
  When properties change, your components will too.<br/>
</p>


<br/>
<h1 id="overview-section">Overview</h1>

Classes which extend `Model` can manage behavior for components. Models are easy to extend, use and even provide via context. While hooks are great, state and logic are not a part of well-formed JSX. Models help wrap that stuff in robust, typescript controllers instead.

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
<h1 id="started-section">Getting Started</h1>

Ultimately, the workflow is simple.

1. Create a class. Fill it with the values, getters, and methods you'll need.
2. Extend `Model` (or any derivative, for that matter), making it reactive.
3. Within a component, use built-in methods as you would normal hooks.
4. Destructure out the values used by a component, to then subscribe.
5. Update those values on demand. Component will sync automagically. ✨

<br/>

## A basic example

### Step 1

Create a class to extend `Model` and fill it with values of any kind. 

```js
import Model from "@expressive/react";

class Counter extends Model {
  current = 1

  increment = () => { this.current++ };
  decrement = () => { this.current-- };
}
```

### Step 2

Pick a built-in hook, such as `use()`, inside a component to make it stateful.

```jsx
const KitchenCounter = () => {
  const { current, increment, decrement } = Counter.use();

  return (
    <div>
      <button onClick={decrement}>{"-"}</button>
      <pre>{current}</pre>
      <button onClick={increment}>{"+"}</button>
    </div>
  )
}
```

### Step 3
[See it in action](https://codesandbox.io/s/example-counter-th8xl) 🚀 — You've already got something usable!

<br/>
<h1 id="good-start">Things you can do</h1>

Expressive leverages the advantages of classes to make state management simpler. Model's fascilitate binding between components and the values held by a given instance. Here are some of the things which are possible.
<br />
<br />

### Track any number of values:

Models use property access to know what needs an update when something changes. This optimization prevents properties you do not "import" to cause a refresh. Plus, it makes clear what's being used!

```jsx
class State extends Model {
  foo = 1;
  bar = 2;
  baz = 3;
}

const MyComponent = () => {
  const { foo, bar } = State.use();

  return (
    <ul>
      <li>Foo is {foo}</li>
      <li>Bar is {bar}</li>
    </ul>
  )
}
```
> Here, **MyComponent** will subscribe to `foo` and `bar` from a new instance of **Test**. You'll note `baz` is not being used however - and so it's ignored.

<br/>

### Update using simple assignment:

State management is portable because values are held in an object.
Updates may originate from anywhere with a reference to the model. Logic can live in the class too, having strict types and easy introspection.

```jsx
class State extends Model {
  foo = 1;
  bar = 2;
  baz = 3;

  barPlusOne = () => {
    this.bar++;
  }
}

const MyComponent = () => {
  const { is: state, foo, bar, baz } = State.use();

  useEffect(() => {
    const ticker = setInterval(() => state.baz++, 1000);
    return () => clearInterval(ticker);
  }, [])

  return (
    <ul>
      <li onClick={() => state.foo++}>
        Foo is {foo}!
      </li>
      <li onClick={state.barPlusOne}>
        Bar is {bar}!
      </li>
      <li>
        Bar is {baz}!
      </li>
    </ul>
  )
}
```
> Reserved property `is` loops back to the instance, helpful to update values after having destructured.

<br/>

### Control components with `async` functions:

With no additional libraries, expressive makes it possible to do things like queries quickly and simply. Sometimes, less is more, and async functions are great for this.

```jsx
class Greetings extends Model {
  response = undefined;
  waiting = false;
  error = false;

  sayHello = async () => {
    this.waiting = true;

    try {
      const res = await fetch("http://my.api/hello");
      this.response = await res.text();
    }
    catch(e) {
      this.error = true;
    }
  }
}

const MyComponent = () => {
  const { error, response, waiting, sayHello } = Greetings.use();

  if(response)
    return <p>Server said: {response}</p>

  if(error)
    return <p>There was an error saying hello.</p>

  if(waiting)
    return <p>Sent! Waiting on response...</p>

  return (
    <a onClick={sayHello}>Say hello to server!</a>
  )
}
```

</br>

### Extend to configure:
Capture shared behavior as reusable classes and extend them as needed. This makes logic reusable and easy to document and share!

```ts
abstract class About extends Model {
  abstract name: string;
  abstract birthday: Date;
  abstract wants: any;

  happyBirthday(){
    // ...
  }
}

class AboutJohn extends About {
  name = "John Doe";
  birthday = new Date("January 1");
  wants = "a PS5";
}
```

<br/>

### Share state between components using context:
Providing and consuming models is dead simple using `Provider` and `get` methods. Classes act as their own key!

```jsx
import Model, { Provider } from "@expressive/react";

class State extends Model {
  foo = 1;
  bar = 2;
}

const Parent = () => {
  const state = State.use();

  // Instance `state` is now available as its own class `State`
  return (
    <Provider for={state}>
      <AboutFoo />
      <AboutBar />
    </Provider>
  )
}

const AboutFoo = () => {
  // Like with `use` we retain types and autocomplete!
  const { is: state, foo } = State.get();

  return (
    <p>
      Shared value foo is: {foo}!
      <button onClick={() => state.bar++}>
        Plus one to bar
      </button>
    </p>
  )
}

const AboutBar = () => {
  const { is: state, bar } = State.get();

  return (
    <p>
      Shared value bar is: {bar}!
      <button onClick={() => state.foo++}>
        Plus one to foo
      </button>
    </p>
  )
}
```
<br/>
<br/>

<h2 align="center"> 🚧 More Docs are on the way! 🏗 </h2>
<p align="center">Documenation is actively being built out - stay tuned!</p>
