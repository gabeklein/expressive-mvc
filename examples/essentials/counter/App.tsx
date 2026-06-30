import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/react';

// Yes, it's a class with render(). No, it's nothing like the class
// components you were told to avoid: no setState, no lifecycle methods,
// no useState/useCallback/useMemo, no dependency arrays.
//
// Fields are reactive - assign one and the view updates. Methods are
// auto-bound, so you can pull them off `this` and they still work.
// One class is the state AND the view.
class Counter extends Component {
  current = 1;

  // Declared methods, not arrows - binding is intrinsic, not lexical.
  // That's why destructuring them in render() below is safe.
  increment() {
    this.current++;
  }

  decrement() {
    this.current--;
  }

  reset() {
    this.current = 1;
  }

  render() {
    const { current, increment, decrement, reset } = this;

    return (
      <div className="container">
        <h1>Counter Example</h1>
        <div className="counter">
          <Button onClick={decrement}>{'−'}</Button>
          {/* Click the number to reset. */}
          <pre onClick={reset}>{current}</pre>
          <Button onClick={increment}>{'+'}</Button>
        </div>
      </div>
    );
  }
}

// It's the element and the state in one - no hook, no provider.
export default () => <Counter />;
