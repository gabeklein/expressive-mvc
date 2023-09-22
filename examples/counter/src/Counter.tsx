import Model from '@expressive/react';
import React from 'react';

// When we create a Model, we're defining a set of values to be tracked.
// It is recommended any Model specific to a component is called 'Control'.

class Control extends Model {
  // Here we only need one property, `current` whose initial value will be 1.
  // All properties are tracked by a controller, so any changes to a value
  // used by a component, will intelligently re-render that component.
  current = 1;

  // For convenience, we define two methods to increment and decrement the
  // value of `current`. These methods will be passed to the component below.
  // Assignments to `this` update state so the component will refresh!
  decrement = () => this.current--;
  increment = () => this.current++;
}

const Counter = () => {
  // Here we create an instance of the model with the `use` method.
  // It is a hook and will create, memoize and observe new instance of Control.
  // If touched values ever become stale, the component renders automatically!
  const { current, increment, decrement } = Control.use();

  return (
    <div className="counter">
      <button onClick={decrement}>{"-"}</button>
      <pre>{current}</pre>
      <button onClick={increment}>{"+"}</button>
    </div>
  );
};

export default Counter;