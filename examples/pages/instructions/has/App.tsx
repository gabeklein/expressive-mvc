import './App.css';

import { Component, has } from '@expressive/react';

export default class TodoList extends Component {
  todos = has(Item);
  draft = '';

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

class Item extends Component {
  text = '';
  done = false;

  toggle() {
    this.done = !this.done;
  }

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
