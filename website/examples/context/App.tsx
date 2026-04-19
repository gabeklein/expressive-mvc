import State, { Component, get, Provider } from '@expressive/react';

// Provider makes one State instance available to descendants.
// Each consumer subscribes only to the properties it actually reads -
// click "Foo" and only Bar refreshes (it's the one displaying foo).

class FooBar extends State {
  foo = 0;
  bar = 0;
}

// A Component is a renderable State - it both reads upstream
// context and provides itself to descendants.
class BarBaz extends Component {
  // The `get` **instruction** lets in-context State/Components
  // find each other for direct access to state and methods.
  foobar = get(FooBar);

  announce(){
    alert(`Foo is ${this.foobar.foo} and Bar is ${this.foobar.bar}`);
  }
}

export default function App() {
  return (
    // Provider adds any State to context for descendants to access.
    <Provider for={FooBar}>
      {/* Components directly add themselves to context. */}
      <BarBaz>
        <Foo />
        <Bar />
        <Baz />
      </BarBaz>
    </Provider>
  );
}

function Foo() {
  // `.get()` finds the nearest provided instance (unlike `.use()`
  // which creates one). Destructured fields subscribe either way.
  // `is` loops back to `this` for writes and silent reads.
  const { is, bar } = FooBar.get();

  return (
    <div>
      <button onClick={() => is.foo++}>Foo</button>
      <small>(Bar was clicked {bar} times)</small>
    </div>
  );
}

function Bar() {
  // Dependencies are per-component, so this only
  // refreshes when `foo` changes, not when `bar` does.
  const { is, foo } = FooBar.get();

  return (
    <div>
      <button onClick={() => is.bar++}>Bar</button>
      <small>(Foo was clicked {foo} times)</small>
    </div>
  );
}

function Baz() {
  const { announce } = BarBaz.get();

  return (
    <div>
      <button onClick={announce}>Hello FooBar</button>
    </div>
  );
}
