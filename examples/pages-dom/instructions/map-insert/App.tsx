/** @jsxImportSource @expressive/dom */
import './App.css';

import { Component, map } from '@expressive/mvc';

// `map<K, V>()` is the insert mode: a reactive Map of values you place by
// key with `set(key, value)` - no factory, no spawning. Bumping one key
// notifies only that entry; adding or removing a key notifies shape.
export default class Inventory extends Component {
  stock = map<string, number>();
  item = '';

  protected new() {
    this.stock.set('apples', 3);
    this.stock.set('bread', 1);
    this.stock.set('milk', 2);
  }

  add(name = this.item) {
    name = name.trim().toLowerCase();
    if (!name) return;
    this.stock.set(name, (this.stock.get(name) ?? 0) + 1);
    this.item = '';
  }

  render() {
    const { stock, item } = this;
    const total = [...stock.values()].reduce((sum, n) => sum + n, 0);

    return (
      <div class="container inv">
        <h1>Reactive Map</h1>
        <p>
          <code>map&lt;string, number&gt;()</code> keys values you insert with{' '}
          <code>set(key, value)</code>. Re-adding a name bumps its count in
          place.
        </p>

        <ul class="stock">
          {[...stock].map(([name, qty]) => (
            <li key={name}>
              <span class="name">{name}</span>
              <span class="qty">
                <button onClick={() => stock.set(name, Math.max(0, qty - 1))}>−</button>
                <output>{qty}</output>
                <button onClick={() => stock.set(name, qty + 1)}>+</button>
              </span>
            </li>
          ))}
        </ul>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            this.add();
          }}>
          <input
            value={item}
            placeholder="Add or bump an item…"
            onInput={(e) => (this.item = (e.currentTarget as HTMLInputElement).value)}
          />
          <button type="submit">Add</button>
        </form>

        <footer>
          <small>{stock.size} items · {total} in stock</small>
        </footer>
      </div>
    );
  }
}
