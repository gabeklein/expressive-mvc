import './App.css';

import Split from '@common/Split';

// Picker is kept separate as a reusable, behavior-complete base.
import { Picker } from './Picker';

export default () => (
  <div className="container">
    <h1>Overrideable Subcomponents</h1>
    <Split>
      <FruitPicker />
      <PalettePicker />
    </Split>
  </div>
);

// A plain vertical list. Only Item is overridden - selection behavior
// and the default Summary are inherited untouched.
class FruitPicker extends Picker {
  name = 'Fruit';
  names = ['Apple', 'Banana', 'Cherry'];

  Item({ index }: { index: number }) {
    return (
      <>
        {index === this.selected ? '🍎 ' : '🍏 '}
        {this.names[index]}
      </>
    );
  }
}

// A very different UX from the same base: a horizontal row of color
// swatches. It overrides Item AND Summary - the hex readout is a
// feature the FruitPicker doesn't have.
class PalettePicker extends Picker {
  name = 'Color';
  className = 'palette';

  colors: Record<string, string> = {
    Coral: '#ff6f61',
    Sky: '#4dabf7',
    Mint: '#51cf66',
  };

  names = Object.keys(this.colors);

  Item({ index }: { index: number }) {
    return <span className="swatch" style={{ background: this.colors[this.names[index]] }} />;
  }

  Summary() {
    const name = this.names[this.selected];
    return (
      <small>
        {name} <code>{this.colors[name]}</code>
      </small>
    );
  }
}
