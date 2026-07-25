import './App.css';

import { Component, set } from '@expressive/react';

// `set` manages a slot beyond a plain field: a default value, a validator,
// or a change-effect - each just a callback, no useEffect, no deps array.
class Account extends Component {
  // A default, plus a callback that vets every assignment. `throw false`
  // rejects the update - the field never exceeds 12 characters.
  name = set('guest', (next) => {
    if (next.length > 12) throw false;
  });

  // The callback may return a cleanup, run before the next change - so a
  // debounce falls out for free: each keystroke cancels the previous timer.
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
      <div className="container">
        <h1>Managed Slots</h1>

        <label>
          Display name <small>(max 12 chars — extra input is rejected)</small>
          <input value={name} onChange={(e) => (this.name = e.target.value)} />
        </label>

        <label>
          Search <small>(debounced 500ms by the callback’s cleanup)</small>
          <input value={query} onChange={(e) => (this.query = e.target.value)} />
        </label>

        <p className="result">{result}</p>
      </div>
    );
  }
}

export default () => <Account />;
