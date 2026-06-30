import { Component, set } from '@expressive/react';

/**
 * A generic, behavior-complete component: it owns the data and the
 * selection logic, but leaves *appearance* to overrideable
 * subcomponents. Think Table, Toast, Loader - defined behavior,
 * undefined aesthetics. The PascalCase methods are the seams.
 */
export class Picker extends Component {
  name = '';
  items = [] as string[];
  selected = 0;

  /**
   * Style pass-through so each consumer can class its own look.
   * Defaults to name.
   */
  className = set(() => this.name.toLowerCase());

  choose(index: number) {
    this.selected = index;
  }

  /**
   * Visual seam: how a single item looks. No behavior here, so an
   * override can't touch the click-to-select wiring in render().
   */
  Item({ index }: { index: number }) {
    return <>{this.items[index]}</>;
  }

  /** Visual seam: a readout of the current choice. */
  Summary() {
    return <small>Selected: {this.items[this.selected]}</small>;
  }

  render() {
    return (
      <div className={`picker ${this.className}`}>
        {this.name && <h2>Choose {this.name}</h2>}
        <ul>
          {this.items.map((item, i) => (
            <li
              key={item}
              className={i === this.selected ? 'active' : ''}
              onClick={() => this.choose(i)}>
              <this.Item index={i} />
            </li>
          ))}
        </ul>
        <this.Summary />
      </div>
    );
  }
}
