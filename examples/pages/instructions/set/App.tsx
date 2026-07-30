import './App.css';

import { Component, set } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Managed Slots</h1>
    <p>
      A value plus a callback makes the field its own gatekeeper. The callback runs
      on every assignment: <code>throw false</code> rejects the update outright,
      and a returned function is cleanup, run before the next change - which is all
      a debounce ever was.
    </p>
    <Account />
    <small>
      Both fields are still read and written as plain properties. No reducer, no
      effect, no dependency array - the rule lives with the field it governs.
    </small>
  </div>
);

class Account extends Component {
  name = set('guest', (next) => {
    if (next.length > 12) throw false;
  });

  query = set('', (next) => {
    this.result = 'typing…';

    const timer = setTimeout(() => {
      this.result = next ? `searching “${next}”` : 'idle';
    }, 500);

    return () => clearTimeout(timer);
  });

  result = 'idle';

  render() {
    const { name, query, result } = this;

    return (
      <>
        <label>
          Display name <small>(max 12 chars — extra input is rejected)</small>
          <input value={name} onChange={(e) => (this.name = e.target.value)} />
        </label>

        <label>
          Search <small>(debounced 500ms by the callback’s cleanup)</small>
          <input value={query} onChange={(e) => (this.query = e.target.value)} />
        </label>

        <p className="result">{result}</p>
      </>
    );
  }
}
