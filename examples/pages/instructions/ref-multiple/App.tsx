import './App.css';

import State, { Component, ref } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Ref Proxy</h1>
    <p>
      <code>ref(this)</code> is the plural form: one call hands back a callable
      handle for <em>every</em> field, keyed by name. Nothing below names a fader -
      the desk walks the state's own keys, and each handle writes the field it
      belongs to.
    </p>
    <Desk />
    <small>
      Add <code>presence = 20</code> to Bands and a fifth fader appears, labelled
      and wired, because the list was never written down anywhere. Nudge and
      Flatten loop that same proxy over whatever is there.
    </small>
  </div>
);

class Bands extends State {
  bass = 40;
  mids = 65;
  treble = 30;
  air = 55;

  refs = ref(this);
}

type Band = Exclude<State.Field<Bands>, 'refs'>;

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
            <input
              type="range"
              value={bands[band]}
              onChange={(e) => (bands.refs[band].current = +e.target.value)}
            />
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
