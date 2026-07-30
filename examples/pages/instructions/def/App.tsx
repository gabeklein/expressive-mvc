import './App.css';

import { Component, def } from '@expressive/react';

function clamped(value: number, min: number, max: number) {
  return def<number>(() => ({
    value,
    set: (next) => Math.min(max, Math.max(min, next))
  }));
}

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
