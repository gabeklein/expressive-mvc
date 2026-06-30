import './App.css';

import { Component } from '@expressive/react';

// Owns the boundary: `catch()` handles a throw from anything it renders.
class Guard extends Component {
  failing = true;

  // A subcomponent that throws during render until recovered.
  Child() {
    if (this.failing)
      throw new Error('The child failed to render.');

    return <p className="ok">Recovered - rendering normally now.</p>;
  }

  // Set `this.fallback` for the error UI; the returned promise keeps it up
  // until the user retries. (A catch that resolves immediately would just
  // re-render, throw again, and loop.)
  catch(error: Error) {
    this.fallback = (
      <div className="error">
        <p>Caught: {error.message}</p>
        <button onClick={() => this.recover()}>Retry</button>
      </div>
    );

    return new Promise<void>((resolve) => {
      this.resume = resolve;
    });
  }

  resume = () => {};

  recover() {
    this.failing = false;
    this.resume(); // resolve catch -> boundary retries the render
  }

  render() {
    return <this.Child />;
  }
}

// Title lives outside the boundary, so only the Guard subtree swaps to
// the fallback while the rest of the page stays put.
export default () => (
  <div className="container">
    <h1>Error Boundary</h1>
    <Guard />
  </div>
);
