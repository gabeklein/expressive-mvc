import State from '@expressive/react';

// A State tracks values; `Control` is convention for component-scoped state.
class Control extends State {
  current = 1;

  decrement = () => this.current--;
  increment = () => this.current++;
}

const App = () => {
  // `.use()` creates and subscribes. Destructured fields trigger re-renders.
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
