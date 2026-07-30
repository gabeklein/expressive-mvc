import './App.css';

import { Component, set } from '@expressive/react';

class Account extends Component {
  name = set('guest', (next) => {
    // `throw false` rejects the assignment; the field keeps its old value.
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
      <div className="container">
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
