import './App.css';

import { Component } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Headless</h1>
    <p>
      A Component without <code>render()</code> draws nothing. Children pass
      through its context provider, which makes placement in the tree the entire
      feature: it owns a lifecycle and hosts the suspense and error boundaries
      for everything below it.
    </p>
    <Scopes />
    <small>Same Readout, same class, two scopes - each finds the Ticker above it.</small>
  </div>
);

const Scopes = () => (
  <div className="pair">
    <Ticker rate={100}>
      <Readout />
    </Ticker>
    <Ticker rate={1000}>
      <Readout />
    </Ticker>
  </div>
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
