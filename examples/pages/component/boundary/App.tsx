import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/react';

export default () => (
  <div className="container">
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
