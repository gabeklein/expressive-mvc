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
      <div className="container todo">
        <h1>Owned Collections</h1>
        <p>
          <code>has(Item)</code> is a pool that spawns and owns its members.
          Each todo is its own Component, so dropping the pool into the tree
          is the whole render.
        </p>

        <div className="card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              this.add();
            }}>
            <input
              value={draft}
              placeholder="Add a task…"
              onChange={(e) => (this.draft = e.target.value)}
            />
            <button type="submit" aria-label="add">+</button>
          </form>

          <ul>{todos}</ul>

          <footer>
            <small>{remaining} of {todos.size} left</small>
            <button className="ghost" onClick={() => this.clearDone()}>
              Clear done
            </button>
          </footer>
        </div>
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
        <button className="check" onClick={this.toggle} aria-label="toggle" />
        <span onClick={this.toggle}>{this.text}</span>
        <button className="remove" onClick={this.remove} aria-label="remove">×</button>
      </li>
    );
  }
}
