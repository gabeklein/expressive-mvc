import State from '@expressive/react';

// When we create a State, we're defining a set of values to be tracked.
// It is recommended any State specific to a component is called 'Control'.

class Control extends State {
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

const App = () => {
  // Here we create an instance of the model with the `use` method.
  // It's a hook to create, memoize and observe new instance of Control.
  // Destructured values tell the component to refresh when changed.
  const { is, current, increment, decrement } = Control.use();

  return (
    <div className="container">
      <h1>Counter Example</h1>
      <div className="counter">
        <button onClick={decrement}>{'-'}</button>
        <pre onClick={() => (is.current = 1)}>{current}</pre>
        <button onClick={increment}>{'+'}</button>
      </div>
    </div>
  );
};

export default App;
