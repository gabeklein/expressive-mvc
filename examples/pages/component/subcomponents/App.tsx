import './App.css';

import Split from '@common/Split';

import { Picker } from './Picker';

export default () => (
  <div className="container">
    <h1>Subcomponents</h1>
    <p>
      Picker owns the data and the selection logic; its PascalCase methods are
      seams a subclass overrides to change only how things look. Fruit replaces{' '}
      <code>Item</code> alone and inherits the rest. Color replaces{' '}
      <code>Summary</code> too, adding a readout Fruit has no use for.
    </p>
    <Split>
      <FruitPicker />
      <PalettePicker />
    </Split>
  </div>
);

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

class PalettePicker extends Picker {
  name = 'Color';
  className = 'palette';

  colors: Record<string, string> = {
    Coral: '#ff6f61',
    Sky: '#4dabf7',
    Mint: '#51cf66'
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
