import { Component, set } from '@expressive/react';

export class Picker extends Component {
  name = '';
  names = [] as string[];
  selected = 0;

  className = set(() => this.name.toLowerCase());

  choose(index: number) {
    this.selected = index;
  }

  Item({ index }: { index: number }) {
    return <>{this.names[index]}</>;
  }

  Summary() {
    return <small>Selected: {this.names[this.selected]}</small>;
  }

  render() {
    return (
      <div className={`picker ${this.className}`}>
        {this.name && <h2>Choose {this.name}</h2>}
        <ul>
          {this.names.map((item, i) => (
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
