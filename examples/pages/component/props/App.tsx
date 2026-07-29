import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Props</h1>
    <p>
      Every state field is an optional JSX prop, reapplied on each render - so
      whoever passes one owns it. <code>unit</code> is declared on{' '}
      <code>render</code> instead, which keeps it out of state and, being
      non-optional there, makes it a required attribute.
    </p>
    <Dashboard />
    <small>
      CPU takes its value from above, so its own buttons only hold until the next
      render up there reapplies the preset. Disk keeps its own, seeded once by{' '}
      <code>is</code> at construction.
    </small>
  </div>
);

class Dashboard extends Component {
  preset = 'idle';

  presets: Record<string, number> = { idle: 8, busy: 62, peak: 97 };

  render() {
    const { preset, presets } = this;

    return (
      <>
        <div className="row">
          {Object.keys(presets).map((name) => (
            <Button key={name} primary={name === preset} onClick={() => (this.preset = name)}>
              {name}
            </Button>
          ))}
        </div>

        <Gauge label="CPU" value={presets[preset]} unit="%" />
        <Gauge label="Disk" max={512} step={32} unit=" GB" is={(disk) => (disk.value = 128)} />
      </>
    );
  }
}

class Gauge extends Component {
  label = 'Metric';
  value = 0;
  max = 100;
  step = 10;

  get percent() {
    return Math.round((this.value / this.max) * 100);
  }

  bump(by: number) {
    this.value = Math.min(this.max, Math.max(0, this.value + by));
  }

  render(props = {} as { unit: string }) {
    const { label, value, percent, step } = this;

    return (
      <div className="gauge">
        <header>
          <span>{label}</span>
          <output>
            {value}
            {props.unit}
          </output>
        </header>
        <div className="track">
          <div className="fill" style={{ width: `${percent}%` }} />
        </div>
        <footer>
          <button onClick={() => this.bump(-step)}>−</button>
          <button onClick={() => this.bump(step)}>+</button>
        </footer>
      </div>
    );
  }
}
