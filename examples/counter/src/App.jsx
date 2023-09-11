import Model from "@expressive/react";

// When we create a model, we're defining a set of values to be tracked.
// It is recommended any Model specific to a component is called 'Control'.

class Control extends Model {
  // Here we only need one property, `current`, which initial value is 1.
  // This value will be tracked by the model, and any changes to it will
  // trigger a re-render.
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

export default () => (
  <div className="container">
    <h1>Simplest Example: Counter</h1>
    <Counter />
  </div>
)