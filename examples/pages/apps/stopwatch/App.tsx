import './App.css';

import { Component } from '@expressive/react';

class Stopwatch extends Component {
  elapsed = 0;
  running = false;

  // A single interval lives for the component's lifetime; it only
  // accumulates while `running`. Returning a cleanup clears it on unmount.
  protected new() {
    const id = setInterval(() => {
      if (this.running) this.elapsed += 10;
    }, 10);

    return () => clearInterval(id);
  }

  get display() {
    const cs = Math.floor(this.elapsed / 10) % 100;
    const s = Math.floor(this.elapsed / 1000) % 60;
    const m = Math.floor(this.elapsed / 60000);
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${pad(m)}:${pad(s)}.${pad(cs)}`;
  }

  toggle() {
    this.running = !this.running;
  }

  reset() {
    this.running = false;
    this.elapsed = 0;
  }

  render() {
    const { display, running, elapsed, toggle, reset } = this;

    return (
      <div className="stopwatch">
        <h1>Stopwatch</h1>
        <p className={`time ${running ? 'running' : ''}`}>{display}</p>
        <div className="controls">
          <button onClick={toggle}>{running ? 'Stop' : 'Start'}</button>
          <button onClick={reset} disabled={!elapsed && !running}>
            Reset
          </button>
        </div>
      </div>
    );
  }
}

export default Stopwatch;
