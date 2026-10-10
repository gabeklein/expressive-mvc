import './App.css';

import State, { Component, get, has, Provider } from '@expressive/react';
import { Link, Route, Router } from '@expressive/router';
import type { ReactNode } from 'react';

import { Todo } from './Todo';

type Filter = 'all' | 'active' | 'completed';

export default () => (
  <div className="container">
    <h1>TodoMVC</h1>
    <p>
      Todos live in an owned <code>has(Todo)</code> pool. Each one is a
      Component holding its own text, done flag and edit draft, and renders its
      own row - the list drops instances into the tree with no keys or props,
      so toggling or editing re-renders that row alone. Counts are getters over
      the pool; member fields notify it, so nothing is reassigned.
    </p>
    <Todos />
    <small>
      Filters are routes: the list reads <code>:filter</code> off its own match,
      and each tab is a <code>Link</code> subclass lit only by an exact{' '}
      <code>match</code>. Double-click to edit - committing empty text destroys
      the todo, which evicts it from the pool without telling the store.
    </small>
  </div>
);

const Todos = () => (
  <Provider for={Store}>
    <Router>
      <Route as={Layout}>
        <Route as={List} />
        <Route to=":filter" as={List} />
      </Route>
    </Router>
  </Provider>
);

class Store extends State {
  items = has(Todo);
  draft = '';

  get remaining() {
    return this.items.filter((todo) => !todo.done).length;
  }

  get completed() {
    return this.items.size - this.remaining;
  }

  get allDone() {
    return this.items.size > 0 && this.remaining === 0;
  }

  add() {
    const text = this.draft.trim();

    if (!text) return;

    this.items.add({ text });
    this.draft = '';
  }

  toggleAll(done: boolean) {
    for (const todo of this.items) todo.done = done;
  }

  clearCompleted() {
    for (const todo of [...this.items])
      if (todo.done) this.items.delete(todo);
  }

  protected new() {
    this.items.add({ text: 'Taste JavaScript', done: true });
    this.items.add({ text: 'Buy a unicorn' });
  }
}

const Layout = (props: { children?: ReactNode }) => {
  const { is: store, draft } = Store.get();

  return (
    <div className="todomvc">
      <form
        className="new"
        onSubmit={(e) => {
          e.preventDefault();
          store.add();
        }}>
        <input
          autoFocus
          placeholder="What needs to be done?"
          value={draft}
          onChange={(e) => (store.draft = e.target.value)}
        />
      </form>
      {props.children}
      <Footer />
    </div>
  );
};

const Footer = () => {
  const {
    is: store,
    remaining,
    completed,
    items: { size },
  } = Store.get();

  if (size)
    return (
      <footer className="footer">
        <span className="count">
          <b>{remaining}</b> {remaining === 1 ? 'item' : 'items'} left
        </span>
        <nav className="filters">
          <Tab to="/">All</Tab>
          <Tab to="/active">Active</Tab>
          <Tab to="/completed">Completed</Tab>
        </nav>
        {completed > 0 && (
          <button className="clear" onClick={() => store.clearCompleted()}>
            Clear completed
          </button>
        )}
      </footer>
    );
};

class Tab extends Link {
  render() {
    const { href, go, match } = this;

    return (
      <a
        href={href}
        onClick={go}
        className={match === true ? 'selected' : undefined}>
        {this.props.children}
      </a>
    );
  }
}

class List extends Component {
  store = get(Store);
  route = get(Route);

  get filter(): Filter {
    const filter = this.route.match?.filter;

    return filter === 'active' || filter === 'completed' ? filter : 'all';
  }

  get shown() {
    const { items } = this.store;

    switch (this.filter) {
      case 'active':
        return items.filter((todo) => !todo.done);
      case 'completed':
        return items.filter((todo) => todo.done);
      default:
        return [...items];
    }
  }

  render() {
    const {
      shown,
      store: {
        is: store,
        allDone,
        items: { size },
      },
    } = this;

    if (size)
      return (
        <section className="main">
          <label className="toggle-all">
            <input
              type="checkbox"
              checked={allDone}
              onChange={(e) => store.toggleAll(e.target.checked)}
            />
            Toggle all
          </label>
          <ul className="list">{shown}</ul>
        </section>
      );
  }
}
