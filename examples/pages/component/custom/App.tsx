import './App.css';

import { Arc } from './Arc';
import { Scale } from './Scale';

export default () => (
  <div className="container">
    <h1>Custom Control</h1>
    <p>
      Drag the arc, or focus it and use the arrow keys. The number lives on the
      form above it, so the arc, the slider and the input are three views of one
      field - and none of them knows the others exist.
    </p>
    <p>
      Arc is a whole concern of its own - pointer capture, keyboard stepping, the
      geometry that turns an angle into a value - and none of it leaks. It reads
      the Scale above it, writes through <code>to()</code>, and owns its element
      via <code>ref</code>. Nothing about dragging appears in the form.
    </p>
    <Manuscript />
    <small>
      In React that logic has nowhere to live but hooks the parent must arrange -
      state, refs and handlers hoisted into whoever renders the control. Here it
      is a class: instantiated by being rendered, and reusable by being placed
      under any Scale. Arc also declares <code>children</code> on{' '}
      <code>render</code>, so the caller still decides what sits in the well.
    </small>
  </div>
);

class Manuscript extends Scale {
  value = 14;
  max = 100;

  get volume() {
    return roman(this.value);
  }

  render() {
    const { volume } = this;

    return (
      <form className="volume" onSubmit={(e) => e.preventDefault()}>
        <Arc>{volume}</Arc>

        <div className="row">
          <Slider />
          <Digits />
        </div>

        <footer>
          <small>Manuscript, Volume {volume}</small>
        </footer>
      </form>
    );
  }
}

const Slider = () => {
  const { is: scale, value, min, max } = Scale.get();

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => scale.to(e.target.valueAsNumber)}
    />
  );
};

const Digits = () => {
  const { is: scale, value, min, max } = Scale.get();

  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => scale.to(e.target.valueAsNumber)}
    />
  );
};

const NUMERALS = [
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I']
] as const;

// Declared, not an arrow: read by Manuscript above.
function roman(value: number) {
  let out = '';

  for (const [size, glyph] of NUMERALS)
    while (value >= size) {
      out += glyph;
      value -= size;
    }

  return out;
}
