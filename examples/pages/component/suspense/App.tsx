import './App.css';

import Button from '@common/Button';
import { Component, get, set } from '@expressive/react';

export default () => (
  <div className="container">
    <Demo />
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
