import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/react';

export default () => (
  <div className="container">
    <Dashboard />
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
