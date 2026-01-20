<br/>

<p align="center">
  <img height="90" src=".github/logo.svg" alt="Expressive Logo"/>
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
  Define classes to power UI by extending <code>State</code>.<br/>
  Builtin hooks will manage renders, as needed, for any data.<br/>
  When properties change, your components will too.<br/>
</p>

<br/>
<h1 id="overview-section">Overview</h1>

Classes which extend `State` can manage behavior for components. States are easy to extend, use and even provide via context. While hooks are great, state and logic are not a part of well-formed JSX. States help wrap that stuff in robust, typescript controllers instead.

<br/>

<h1 id="install-section">Installation</h1>

Install with your preferred package manager

```bash
npm install --save @expressive/react
```

Import and use in your react apps

```js
import State from '@expressive/react';
```

<br/>
<h1 id="started-section">Getting Started</h1>

Ultimately, the workflow is simple.

1. Create a class. Fill it with the values, getters, and methods you'll need.
2. Extend `State` (or any derivative, for that matter), making it reactive.
3. Within a component, use built-in methods as you would normal hooks.
4. Destructure out the values used by a component, to then subscribe.
5. Update those values on demand. Component will sync automagically. ✨

<br/>

## A basic example

### Step 1

Create a class to extend `State` and fill it with values of any kind.

```js
import State from '@expressive/react';

class Counter extends State {
  current = 1;

  increment = () => {
    this.current += 1;
  };
  decrement = () => {
    this.current -= 1;
  };
}
```

### Step 2

Pick a built-in hook, such as `use()`, inside a component to make it stateful.

```jsx
const KitchenCounter = () => {
  const { current, increment, decrement } = Counter.use();

  return (
    <div>
      <button onClick={decrement}>{'-'}</button>
      <pre>{current}</pre>
      <button onClick={increment}>{'+'}</button>
    </div>
  );
};
```

### Step 3

[See it in action](https://codesandbox.io/s/example-counter-th8xl) 🚀 — You've already got something usable!

<br/>
<h1 id="good-start">Things you can do</h1>

Expressive leverages the advantages of classes to make state management simpler. State's fascilitate binding between components and the values held by a given instance. Here are some of the things which are possible.
<br />
<br />

### Track any number, even nested values:

States use property access to know what needs an update when something changes. This optimization prevents properties you do not "import" to cause a refresh. Plus, it makes clear what's being used!

```jsx
class Info extends State {
  info = new Extra();
  foo = 1;
  bar = 2;
  baz = 3;
}

class Extra extends State {
  value1 = 1;
  value2 = 2;
}

const MyComponent = () => {
  const {
    foo,
    bar,
    info: { value1 }
  } = Info.use();

  return (
    <ul>
      <li>Foo is {foo}</li>
      <li>Bar is {bar}</li>
      <li>Info 1 is {value1}</li>
    </ul>
  );
};
```

<sup><a href="https://codesandbox.io/s/example-nested-ow9opy">View in CodeSandbox</a></sup>

> Here, **MyComponent** will subscribe to `foo` and `bar` from a new instance of **Test**. You'll note `baz` is not being used however - and so it's ignored.

<br/>

### Update using simple assignment:

State management is portable because values are held in an object.
Updates may originate from anywhere with a reference to the model. Logic can live in the class too, having strict types and easy introspection.

```jsx
class State extends State {
  foo = 1;
  bar = 2;
  baz = 3;

  barPlusOne = () => {
    this.bar++;
  };
}

const MyComponent = () => {
  const { is: state, foo, bar, baz } = State.use();

  useEffect(() => {
    const ticker = setInterval(() => {
      state.baz += 1;
    }, 1000);

    return () => clearInterval(ticker);
  }, []);

  return (
    <ul>
      <li onClick={() => state.foo++}>Foo is {foo}!</li>
      <li onClick={state.barPlusOne}>Bar is {bar}!</li>
      <li>Bar is {baz}!</li>
    </ul>
  );
};
```

<sup><a href="https://codesandbox.io/s/example-async-inmk4">View in CodeSandbox</a></sup>

> Reserved property `is` loops back to the instance, helpful to update values after having destructured.

<br/>

### Control components with `async` functions:

With no additional libraries, expressive makes it possible to do things like queries quickly and simply. Sometimes, less is more, and async functions are great for this.

```jsx
class Greetings extends State {
  response = undefined;
  waiting = false;
  error = false;

  sayHello = async () => {
    this.waiting = true;

    try {
      const res = await fetch('http://my.api/hello');
      this.response = await res.text();
    } catch (e) {
      this.error = true;
    }
  };
}

const MyComponent = () => {
  const { error, response, waiting, sayHello } = Greetings.use();

  if (response) return <p>Server said: {response}</p>;

  if (error) return <p>There was an error saying hello.</p>;

  if (waiting) return <p>Sent! Waiting on response...</p>;

  return <a onClick={sayHello}>Say hello to server!</a>;
};
```

<sup><a href="https://codesandbox.io/s/example-fetch-wh4ppg">View in CodeSandbox</a></sup>

</br>

### Extend to configure:

Capture shared behavior as reusable classes and extend them as needed. This makes logic reusable and easy to document and share!

```ts
import { toQueryString } from 'helpers';

abstract class Query extends State {
  /** This is where you will get the data */
  url: string;

  /** Any query data you want to add. */
  query?: { [param: string]: string | number };

  response = undefined;
  waiting = false;
  error = false;

  sayHello = async () => {
    this.waiting = true;

    try {
      let { url, query } = this;

      if (query) url += toQueryString(query);

      const res = await fetch(url);
      this.response = await res.text();
    } catch (e) {
      this.error = true;
    }
  };
}
```

Now you can extend it in order to use!

```jsx
class Greetings extends Query {
  url = 'http://my.api/hello';
  params = {
    name: 'John Doe'
  };
}

const Greetings = () => {
  const { error, response, waiting, sayHello } = Greetings.use();

  return <div />;
};
```

Or you can just use it directly...

```jsx
const Greetings = () => {
  const { error, response, waiting, sayHello } = Query.use({
    url: 'http://my.api/hello',
    params: { name: 'John Doe' }
  });

  return <div />;
};
```

> It works either way!

<br/>

### Share state between components using context:

Providing and consuming models is dead simple using `Provider` and `get` methods. Classes act as their own key!

```jsx
import State, { Provider } from '@expressive/react';

class Control extends Control {
  foo = 1;
  bar = 2;
}

const Parent = () => {
  // Instance of `state` is now available as its own class `Control`
  return (
    <Provider for={Control}>
      <AboutFoo />
      <AboutBar />
    </Provider>
  );
};

const AboutFoo = () => {
  // Like with `use` we retain types and autocomplete!
  const { is: state, foo } = Control.get();

  return (
    <p>
      Shared value foo is: {foo}!
      <button onClick={() => state.bar++}>Plus one to bar</button>
    </p>
  );
};

const AboutBar = () => {
  const { is: state, bar } = Control.get();

  return (
    <p>
      Shared value bar is: {bar}!
      <button onClick={() => state.foo++}>Plus one to foo</button>
    </p>
  );
};
```

<sup><a href="https://codesandbox.io/s/example-shared-state-5vvtr">View in CodeSandbox</a></sup>
<br/>
<br/>

<h2 align="center"> 🚧 More Docs are on the way! 🏗 </h2>
<p align="center">Documenation is actively being built out - stay tuned!</p>
