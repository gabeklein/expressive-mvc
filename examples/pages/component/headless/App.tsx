import './App.css';

import Split from '@common/Split';
import { Component } from '@expressive/react';

export default () => (
  <div className="container">
    <Scopes />
  </div>
);

const Scopes = () => (
  <Split>
    <Ticker rate={100}>
      <Readout />
    </Ticker>
    <Ticker rate={1000}>
      <Readout />
    </Ticker>
  </Split>
);

class Ticker extends Component {
  rate = 1000;
  elapsed = 0;

  get seconds() {
    return (this.elapsed / 1000).toFixed(1);
  }

  mount() {
    const started = Date.now();
    const timer = setInterval(() => {
      this.elapsed = Date.now() - started;
    }, this.rate);

    return () => clearInterval(timer);
  }
}

const Readout = () => {
  const { seconds, rate } = Ticker.get();

  return (
    <div className="readout">
      <strong>{seconds}s</strong>
      <small>every {rate}ms</small>
    </div>
  );
};
