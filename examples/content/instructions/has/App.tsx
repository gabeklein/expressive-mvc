import './App.css';

import { Component, has } from '@expressive/react';

// `has(Item)` is an owned pool. `add` spawns a member and returns it;
// members carry their own identity, so dropping the pool into the tree
// is the whole render - no keys, no spread, no <Row>, no use().
export default class TodoList extends Component {
  todos = has(Item);
  draft = '';

  // Pools resolve at activation, so seed members from the new() hook.
  protected new() {
    this.add('Learn Expressive');
  }

  add(text: string = this.draft) {
    if (!text) return;
    this.todos.add({ text });
    this.draft = '';
  }

  clearDone() {
    for (const item of [...this.todos])
      if (item.done) this.todos.delete(item);
  }

  get remaining() {
    return this.todos.filter((item) => !item.done).length;
  }

  render() {
    const { todos, draft, remaining } = this;

    return (
      <div className="container">
        <h1>Owned Collections</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            this.add();
          }}>
          <input
            value={draft}
            placeholder="Add a todo, press Enter"
            onChange={(e) => (this.draft = e.target.value)}
          />
        </form>

        <ul>{todos}</ul>

        <footer>
          <small>{remaining} of {todos.size} remaining</small>
          <button onClick={() => this.clearDone()}>Clear done</button>
        </footer>
      </div>
    );
  }
}

// Each todo is a Component - it owns its fields, its behavior, and its
// own markup. With #247 an instance renders directly as an element, so
// the parent never writes a row wrapper or wires props.
class Item extends Component {
  text = '';
  done = false;

  toggle() {
    this.done = !this.done;
  }

  // A member that destroys itself is evicted from the pool automatically.
  remove() {
    this.set(null);
  }

  render() {
    return (
      <li className={this.done ? 'done' : ''}>
        <span onClick={this.toggle}>{this.text}</span>
        <button onClick={this.remove} aria-label="remove">×</button>
      </li>
    );
  }
}
