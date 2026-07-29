import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Error Boundary</h1>
    <p>
      Override <code>catch()</code> and a Component becomes the boundary for
      everything it renders. Per-feature error handling, without nesting{' '}
      <code>&lt;ErrorBoundary&gt;</code> wrappers.
    </p>
    <Demo />
  </div>
);

class Demo extends Component {
  round = 0;
  resume = () => {};

  // The outermost boundary on this page. Nothing below it declared a catch that
  // kept the error, so it lands here.
  catch(error: Error) {
    this.fallback = (
      <div className="error">
        <p>Reached the page: {error.message}</p>
        <Button primary onClick={() => this.restart()}>
          Start over
        </Button>
      </div>
    );

    return new Promise<void>((resolve) => {
      this.resume = resolve;
    });
  }

  restart() {
    this.round++;
    this.resume();
  }

  render() {
    const { round } = this;

    return (
      <>
        <div className="card">
          <h2>Handled in place</h2>
          <Recoverable key={`local-${round}`} />
          <small>Only this card swaps to the fallback; the page stays put.</small>
        </div>

        <div className="card">
          <h2>Escalated</h2>
          <Escalating key={`up-${round}`} message="The widget gave up." />
          <small>Its catch() rejects, so the page boundary takes over.</small>
        </div>
      </>
    );
  }
}

// Throws on demand, and defines no catch() of its own - so whichever subclass
// or ancestor owns a boundary is the one that hears about it.
class Fragile extends Component {
  message = 'The widget failed to render.';
  broken = false;

  Child() {
    if (this.broken) throw new Error(this.message);

    return <Button onClick={() => (this.broken = true)}>Break it</Button>;
  }

  render() {
    return <this.Child />;
  }
}

// Handles it in place. Setting `fallback` inside catch() supplies the error UI,
// and the returned promise keeps it up until the user retries - a catch that
// resolved immediately would re-render, throw again, and loop.
class Recoverable extends Fragile {
  resume = () => {};

  catch(error: Error) {
    this.fallback = (
      <div className="error">
        <p>Caught right here: {error.message}</p>
        <Button onClick={() => this.recover()}>Retry</Button>
      </div>
    );

    return new Promise<void>((resolve) => {
      this.resume = resolve;
    });
  }

  recover() {
    this.broken = false;
    this.resume();
  }
}

// Declines it. A rejected catch() propagates to the next boundary above, the
// same way rethrowing does anywhere else.
class Escalating extends Fragile {
  async catch(error: Error) {
    throw error;
  }
}
