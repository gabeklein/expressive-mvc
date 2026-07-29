import './App.css';

// Arc is the reusable control; Scale is the contract it looks for above it.
import { Arc } from './Arc';
import { Scale } from './Scale';

export default () => (
  <div className="container">
    <h1>Custom Control</h1>
    <p>
      Drag the arc. The number lives on the form above it, so the arc, the
      slider and the input are three views of one field.
    </p>
    <Manuscript />
  </div>
);

// The form owns the number. Placing a control inside it is not ownership -
// which is why three of them can disagree about presentation and never
// about the value.
class Manuscript extends Scale {
  title = 'Meditations';
  value = 14;
  max = 100;

  render() {
    const { title, value } = this;

    return (
      <form className="volume" onSubmit={(e) => e.preventDefault()}>
        <label>
          Title
          <input value={title} onChange={(e) => (this.title = e.target.value)} />
        </label>

        <Volume />

        <div className="row">
          <Slider />
          <Digits />
        </div>

        <footer>
          <small>
            {title}, Volume {roman(value)}
          </small>
        </footer>
      </form>
    );
  }
}

// Only the well of the arc changes. `Readout` is a subcomponent, so this
// replaces it outright - overriding `render` would have wrapped the arc.
class Volume extends Arc {
  Readout() {
    return <em>{roman(this.scale.value)}</em>;
  }
}

// The plain controls are function components, because nothing about them is
// worth extending. Both find the same Scale and write the same field.
function Slider() {
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
}

function Digits() {
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
}

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

// 1 through 100 is the range worth dragging: it visits every subtractive
// pair the notation has below CD - IV, IX, XL, XC.
function roman(value: number) {
  let out = '';

  for (const [size, glyph] of NUMERALS)
    while (value >= size) {
      out += glyph;
      value -= size;
    }

  return out;
}
