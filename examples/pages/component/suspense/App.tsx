import './App.css';

import Button from '@common/Button';
import { Component, get, set } from '@expressive/react';

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

// An async `set` factory resolves straight into the field. Reading it while
// pending suspends the render - no waiting flag, no error state threaded by
// hand. Compare essentials/fetch, which tracks that lifecycle manually.
class Greeter extends Component {
  name = 'world';

  greeting = set(async () => {
    await wait(900);
    return `Hello, ${this.name}.`;
  });

  // A Component is its own boundary. This covers whatever its render suspends
  // on, which is why there is no <Suspense> anywhere in this file.
  fallback = <small>Greeting someone…</small>;

  render() {
    return <p className="result">{this.greeting}</p>;
  }
}

// Headless, so it draws nothing. It owns the pending value AND the boundary
// that covers it - the order that matters, because a boundary rebuilds the
// subtree it retries. State owned below would be reconstructed on every
// attempt and request again, forever.
class Panel extends Component {
  farewell = set(async () => {
    await wait(1400);
    return 'Goodbye, Grace.';
  });

  fallback = <small>The panel is waiting…</small>;
}

// Declines its own boundary, so the suspension bubbles to Panel. Safe here
// only because the value it reads lives above that boundary.
class Reader extends Component {
  panel = get(Panel);

  render() {
    return <p className="result">{this.panel.farewell}</p>;
  }
}

export default class Demo extends Component {
  round = 0;

  render() {
    const { round } = this;

    return (
      <div className="container">
        <h1>Suspense</h1>
        <p>
          Reading a pending property suspends the render. Every Component
          carries a boundary for it, so <code>fallback</code> is the whole of
          the wiring.
        </p>

        <div className="card">
          <h2>Its own boundary</h2>
          <Greeter key={`own-${round}`} name="Ada" />
        </div>

        <div className="card">
          <h2>Deferred to an ancestor</h2>
          <Panel key={`panel-${round}`}>
            <Reader fallback={false} />
          </Panel>
        </div>

        {/* An async factory resolves once. Keying the owner is how you ask for
            a fresh instance, and so for a fresh request. */}
        <Button primary onClick={() => this.round++}>
          Ask again
        </Button>
      </div>
    );
  }
}
