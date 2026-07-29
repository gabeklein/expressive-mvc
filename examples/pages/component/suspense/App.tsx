import './App.css';

import { Suspense } from 'react';
import State, { Component, Provider, set } from '@expressive/react';

// An async `set` factory suspends on read and resolves straight into the
// field - no `waiting` flag, no `error` state threaded by hand. Compare
// essentials/fetch, which tracks that same lifecycle manually.
class Greeter extends State {
  hello = set(async () => {
    const res = await fetch('https://randomuser.me/api?nat=us&results=1');

    if (!res.ok) throw new Error(`Server responded ${res.status}.`);

    const { first, last } = (await res.json()).results[0].name;
    return `Hello, ${first} ${last}.`;
  });
}

// Reading `hello` while pending throws the suspense signal <Suspense>
// catches; a rejected fetch throws past it to the boundary's catch().
function Hello() {
  return <p className="result">{Greeter.get().hello}</p>;
}

// The Greeter is provided *above* <Suspense> so it survives the suspended
// renders - an instance created inside the boundary would be rebuilt (and
// refetch) on every retry. Bumping `round` remounts it for a fresh request.
export default class Demo extends Component {
  round = 0;
  resume = () => {};

  catch(error: Error) {
    this.fallback = (
      <div className="status error">
        <p>{error.message}</p>
        <button onClick={() => this.again()}>Try again</button>
      </div>
    );

    return new Promise<void>((resolve) => (this.resume = resolve));
  }

  again() {
    this.round++;
    this.resume();
  }

  render() {
    return (
      <div className="container">
        <h1>Suspense</h1>
        <p>
          The greeting is an async <code>set</code> factory. Reading it
          suspends until the fetch resolves — no waiting flag, no error field.
        </p>

        <Provider for={Greeter} key={this.round}>
          <Suspense fallback={<p className="status">Contacting server…</p>}>
            <Hello />
          </Suspense>
        </Provider>

        <button onClick={() => this.again()}>Say hello again</button>
      </div>
    );
  }
}
