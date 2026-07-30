import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/react';

class Counter extends Component {
  current = 1;

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
        <div className="counter">
          <Button onClick={decrement}>{'−'}</Button>
          <pre onClick={reset}>{current}</pre>
          <Button onClick={increment}>{'+'}</Button>
        </div>
      </div>
    );
  }
}

export default () => <Counter />;
