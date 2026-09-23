import './App.css';

import State, { Component, ref } from '@expressive/react';
import type { ChangeEvent } from 'react';

export default () => (
  <div className="container">
    <h1>Ref Proxy</h1>
    <p>
      <code>ref(this)</code> is the plural form: one call, one handle per field,
      keyed by name. Give it a factory and each key maps to whatever the call site
      wants instead - here the props for that field's input, so the state hands out
      its own wiring. Nothing below names a fader; the desk walks the state's keys.
    </p>
    <Desk />
    <small>
      Add <code>presence = 20</code> to Bands and a fifth fader appears, labelled
      and wired, because the list was never written down anywhere. The buttons use
      the plain proxy - <code>refs[band].current</code> writes a field the loop
      never had to name. Only <code>value</code> stays in render: that read is the
      subscription.
    </small>
  </div>
);

class Bands extends State {
  bass = 40;
  mids = 65;
  treble = 30;
  air = 55;

  fader = ref(this, (key, bands) => {
    const band = key as Band;

    return {
      type: 'range',
      min: 0,
      max: 100,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        bands[band] = event.target.valueAsNumber;
      }
    };
  });

  refs = ref(this);
}

type Band = Exclude<State.Field<Bands>, 'fader' | 'refs'>;

class Desk extends Component {
  bands = new Bands();

  nudge(by: number) {
    const { refs } = this.bands;

    for (const band of faders(this.bands))
      refs[band].current = clamp(refs[band].current + by);
  }

  flatten() {
    const { refs } = this.bands;

    for (const band of faders(this.bands)) refs[band].current = 50;
  }

  render() {
    const { bands } = this;

    return (
      <section className="desk">
        {faders(bands).map((band) => (
          <label key={band}>
            <span>{band}</span>
            <input {...bands.fader[band]} value={bands[band]} />
            <output>{bands[band]}</output>
          </label>
        ))}

        <footer>
          <button onClick={() => this.nudge(-10)}>−10 all</button>
          <button onClick={() => this.flatten()}>Flatten</button>
          <button onClick={() => this.nudge(10)}>+10 all</button>
        </footer>
      </section>
    );
  }
}

// `refs` is non-enumerable, like every instruction, so a state's own keys are
// exactly its faders. Read them off `is`: the tracking proxy a render sees
// forwards property access, not enumeration.
const faders = (bands: Bands) => Object.keys(bands.is) as Band[];

const clamp = (value: number) => Math.max(0, Math.min(100, value));
