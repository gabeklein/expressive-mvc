import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Error Boundary</h1>
    <p>
      Override <code>catch()</code> and a Component becomes the boundary for
      everything it renders - per-feature error handling without nesting{' '}
      <code>&lt;ErrorBoundary&gt;</code> wrappers. Boundary below has no{' '}
      <code>render()</code> at all; it exists to sit in the tree and catch.
    </p>

    <Boundary>
      <div className="card">
        <h2>Handled in place</h2>
        <Recoverable />
      </div>

      <div className="card">
        <h2>Escalated</h2>
        <Escalating message="The widget gave up." />
      </div>
    </Boundary>

    <small>
      The first card keeps its error, so only it swaps to a fallback while the
      rest stays put. The second declines - its <code>catch()</code> rejects, so
      the boundary above takes the whole group.
    </small>
  </div>
);

class Boundary extends Component {
  error?: Error;
  resume = () => {};

  Fallback() {
    return (
      <div className="error">
        <p>Reached the boundary: {this.error?.message}</p>
        <Button primary onClick={() => this.resume()}>
          Start over
        </Button>
      </div>
    );
  }

  catch(error: Error) {
    this.error = error;
    this.fallback = <this.Fallback />;

    return new Promise<void>((resolve) => {
      this.resume = resolve;
    });
  }
}

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

class Recoverable extends Fragile {
  resume = () => {};

  Fallback() {
    return (
      <div className="error">
        <p>Caught right here: {this.message}</p>
        <Button onClick={() => this.recover()}>Retry</Button>
      </div>
    );
  }

  // Returning a pending promise holds the fallback up; resolving immediately
  // would re-render, throw again, and loop.
  catch() {
    this.fallback = <this.Fallback />;

    return new Promise<void>((resolve) => {
      this.resume = resolve;
    });
  }

  recover() {
    this.broken = false;
    this.resume();
  }
}

class Escalating extends Fragile {
  async catch(error: Error) {
    this.broken = false;
    throw error;
  }
}
