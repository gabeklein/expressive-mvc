import { Component } from '@expressive/react';

/*
  When using context the first step is to make some State
  as you normally would. Just extend Component instead, it
  is renderable and will provide to children automatically.
  It can contain the values which function components may
  read and others may write. Shared state s de-facto,
  easy communication between components.
*/
class FooBar extends Component {
  foo = 0;
  bar = 0;
}

export default function Demo() {
  return (
    <Component>
      <Foo />
      <Bar />
    </Component>
  );
}

function Foo() {
  // Built-in get() static method is a hook, it returns nearest of
  // same type and syncs component to any values you access.
  // `is` property loops back to instance so you can update values.
  const { is: foobar, bar } = FooBar.get();

  return (
    <div className="card">
      <button
        onClick={() => {
          foobar.foo++;
        } }>
        Foo
      </button>
      <small>(Bar was clicked {bar} times)</small>
    </div>
  );
}

function Bar() {
  // Dependancy tracking is automatic, so this only refreshes
  // when `foo` changes, but not when `bar` does.
  const { is: foobar, foo } = FooBar.get();

  return (
    <div className="card">
      <button
        onClick={() => {
          foobar.bar++;
        } }>
        Bar
      </button>
      <small>(Foo was clicked {foo} times)</small>
    </div>
  );
}