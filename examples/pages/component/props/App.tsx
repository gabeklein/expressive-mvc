import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/react';

// Every state field below doubles as an optional JSX prop, applied to the
// instance on each render. `unit` is different: it is declared on render's
// parameter, so it never joins state - and being non-optional there, it is a
// required JSX attribute.
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

export default class Dashboard extends Component {
  preset = 'idle';

  presets: Record<string, number> = { idle: 8, busy: 62, peak: 97 };

  render() {
    const { preset, presets } = this;

    return (
      <div className="container">
        <h1>Props</h1>
        <p>
          State fields are optional props. Whoever passes one owns it, because
          props reapply every render.
        </p>

        <div className="row">
          {Object.keys(presets).map((name) => (
            <Button key={name} primary={name === preset} onClick={() => (this.preset = name)}>
              {name}
            </Button>
          ))}
        </div>

        {/* `value` arrives from here, so this gauge's own buttons only hold
            until the next render above - picking a preset reapplies it. */}
        <Gauge label="CPU" value={presets[preset]} unit="%" />

        {/* No `value` prop, so the gauge keeps its own. `is` seeds it once at
            construction, before new() runs. */}
        <Gauge label="Disk" max={512} step={32} unit=" GB" is={(disk) => (disk.value = 128)} />
      </div>
    );
  }
}
