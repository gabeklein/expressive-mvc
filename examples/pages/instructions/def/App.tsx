import './App.css';

import { Component, def } from '@expressive/react';

// `def` is the low-level primitive every other instruction is built on. Its
// factory runs at init and returns a property descriptor; a `set` that
// returns a value rewrites each assignment. Two tiny reusable instructions:

// Keeps a number within range.
function clamped(value: number, min: number, max: number) {
  return def<number>(() => ({
    value,
    set: (next) => Math.min(max, Math.max(min, next))
  }));
}

// Coerces every assignment into a URL-safe slug.
function slug(value = '') {
  return def<string>(() => ({
    value,
    set: (next) => next.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }));
}

class Profile extends Component {
  volume = clamped(5, 0, 10);
  handle = slug('');

  render() {
    const { volume, handle } = this;

    return (
      <div className="container">
        <h1>Custom Instruction</h1>

        <p>
          Both fields are governed by instructions we defined with{' '}
          <code>def</code> - the same primitive <code>set</code> and{' '}
          <code>get</code> are built on.
        </p>

        <label>
          Volume <small>(clamped to 0–10)</small>
          <div className="stepper">
            <button onClick={() => (this.volume -= 3)}>−3</button>
            <output>{volume}</output>
            <button onClick={() => (this.volume += 3)}>+3</button>
          </div>
        </label>

        <label>
          Handle <small>(slugified on input)</small>
          <input
            value={handle}
            placeholder="Type A Name"
            onChange={(e) => (this.handle = e.target.value)}
          />
        </label>
      </div>
    );
  }
}

export default () => <Profile />;
