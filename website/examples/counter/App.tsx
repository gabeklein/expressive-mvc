import State from '@expressive/react';

// When we create a State, we're defining a set of values to be tracked.
// Recommend any State specific to one component is called 'Control'.

class Control extends State {
  // Here only one property needed, `current` whose initial value will be 1.
  // All properties are tracked by a controller, so any changes to a value
  // used by a component, will intelligently re-render that component.
  current = 1;

  // For convenience, we define two methods to increment and decrement the
  // value of `current`. Methods can be used by component to decouple logic.
  decrement = () => this.current--;
  increment = () => this.current++;
}

const App = () => {
  // Control.use() is a hook to create, memoize and observe Control.
  // Destructured values tell the component what to refresh for.
  const { is, current, increment, decrement } = Control.use();

  return (
    <div className="container">
      <h1>Counter Example</h1>
      <div className="counter">
        <button onClick={decrement}>{'-'}</button>
        {/* `is` points to the instance we can assign to directly. */}
        <pre onClick={() => (is.current = 1)}>{current}</pre>
        <button onClick={increment}>{'+'}</button>
      </div>
    </div>
  );
};

export default App;
