import './App.css';

import { Component } from '@expressive/react';

// A PascalCase method becomes a subcomponent scoped to `this`.
// Each is a real component: it subscribes only to what it reads, and
// `render()` stays a flat composition of named pieces instead of one
// long tree.
class Dashboard extends Component {
  fruits = ['Apple', 'Banana', 'Cherry'];
  selected = 0;

  select(index: number) {
    this.selected = index;
  }

  // Subcomponent - reads `fruits` and `selected`.
  List() {
    return (
      <ul>
        {this.fruits.map((fruit, i) => (
          <li
            key={fruit}
            className={i === this.selected ? 'active' : ''}
            onClick={() => this.select(i)}>
            {fruit}
          </li>
        ))}
      </ul>
    );
  }

  // Another subcomponent, refreshed on its own when selection changes.
  Detail() {
    return <p className="detail">You picked {this.fruits[this.selected]}.</p>;
  }

  render() {
    return (
      <div className="container">
        <h1>Subcomponents</h1>
        <this.List />
        <this.Detail />
      </div>
    );
  }
}

export default () => <Dashboard />;
