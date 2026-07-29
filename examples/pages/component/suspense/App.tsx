import './App.css';

import Button from '@common/Button';
import { Component, get, set } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Suspense</h1>
    <p>
      An async <code>set</code> factory resolves straight into its field, and
      reading it while pending suspends the render. Every Component carries a
      boundary for that, so <code>fallback</code> is the whole of the wiring -
      there is no <code>&lt;Suspense&gt;</code> anywhere in this file.
    </p>
    <Demo />
    <small>
      The second card declines its own boundary with{' '}
      <code>{'fallback={false}'}</code>, so Panel covers it. That works only
      because Panel owns the pending value: a boundary rebuilds the subtree it
      retries, so state owned below would be rebuilt and requested again forever.
    </small>
  </div>
);

class Demo extends Component {
  round = 0;

  render() {
    const { round } = this;

    return (
      <>
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

        {/* An async factory resolves once, so a fresh request means a fresh
            instance - which is what keying the owner asks for. */}
        <Button primary onClick={() => this.round++}>
          Ask again
        </Button>
      </>
    );
  }
}

class Greeter extends Component {
  name = 'world';

  greeting = set(async () => {
    await wait(900);
    return `Hello, ${this.name}.`;
  });

  fallback = <small>Greeting someone…</small>;

  render() {
    return <p className="result">{this.greeting}</p>;
  }
}

class Panel extends Component {
  farewell = set(async () => {
    await wait(1400);
    return 'Goodbye, Grace.';
  });

  fallback = <small>The panel is waiting…</small>;
}

class Reader extends Component {
  panel = get(Panel);

  render() {
    return <p className="result">{this.panel.farewell}</p>;
  }
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
