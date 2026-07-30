import './App.css';

import { Arc } from './Arc';
import { Scale } from './Scale';

export default () => (
  <div className="container">
    <Manuscript />
  </div>
);

class Manuscript extends Scale {
  value = 14;
  max = 100;

  render() {
    const { value } = this;

    return (
      <form className="volume" onSubmit={(e) => e.preventDefault()}>
        <Arc>{roman(value)}</Arc>

        <div className="row">
          <Slider />
          <Digits />
        </div>

        <footer>
          <small>Manuscript, Volume {roman(value)}</small>
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
