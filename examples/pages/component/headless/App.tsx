import './App.css';

import Split from '@common/Split';
import { Component } from '@expressive/react';

// No render(), so this Component contributes no markup at all. Children pass
// straight through its context provider, which makes placement in the tree the
// entire feature: everything below reaches it with Ticker.get(), and the two
// instances below scope to their own subtrees.
class Ticker extends Component {
  rate = 1000;
  elapsed = 0;

  get seconds() {
    return (this.elapsed / 1000).toFixed(1);
  }

  // Props are applied before commit, so `rate` is already the one passed in.
  mount() {
    const started = Date.now();
    const timer = setInterval(() => {
      this.elapsed = Date.now() - started;
    }, this.rate);

    return () => clearInterval(timer);
  }
}

// A plain function component, unaware of which Ticker it sits under.
function Readout() {
  const { seconds, rate } = Ticker.get();

  return (
    <div className="readout">
      <strong>{seconds}s</strong>
      <small>every {rate}ms</small>
    </div>
  );
}

export default () => (
  <div className="container">
    <h1>Headless</h1>
    <p>
      A Component without <code>render()</code> is pure placement: it provides
      itself to its subtree, owns a lifecycle, and hosts the suspense and error
      boundaries - all without drawing anything.
    </p>

    <Split>
      <Ticker rate={100}>
        <Readout />
      </Ticker>
      <Ticker rate={1000}>
        <Readout />
      </Ticker>
    </Split>

    <small>
      Same Readout, same class, two scopes - each finds the Ticker above it.
    </small>
  </div>
);
