import './App.css';

import State, { Component, get, has, Provider } from '@expressive/react';
import { Link, Route, Router } from '@expressive/router';

import { Todo } from './Todo';

type Filter = 'all' | 'active' | 'completed';

// `has(Todo)` is an owned pool: `add` spawns a member and returns it, and a
// member that destroys itself is evicted automatically. The aggregate getters
// read each member's `done` straight through the pool - no reassignment, no
// bookkeeping, because member fields notify the collection.
class Store extends State {
  items = has(Todo);
  draft = '';

  // Pools resolve at activation, so seed members from the new() hook.
  protected new() {
    this.items.add({ text: 'Taste JavaScript', done: true });
    this.items.add({ text: 'Buy a unicorn' });
  }

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
}

// Active-link styling by subclassing Link and reading its `match` getter -
// `true` only on an exact match, so "All" (/) lights up solely at "/".
class Tab extends Link {
  render() {
    return (
      <a
        href={this.href}
        onClick={this.go}
        className={this.match === true ? 'selected' : undefined}>
        {this.props.children}
      </a>
    );
  }
}

// The list section - hidden when empty. The active filter comes from this
// route's own match, so navigating between tabs reselects what's shown. Each
// Todo renders itself, so the view is the whole list body.
class List extends Component {
  store = get(Store);
  route = get(Route);

  get filter(): Filter {
    const filter = this.route.match?.filter;
    return filter === 'active' || filter === 'completed' ? filter : 'all';
  }

  // Derived here, in a getter, so the read of each member's `done` is tracked -
  // the list re-renders when one is toggled, added, or evicts itself. A plain
  // method called from render() would compute the same array untracked.
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
    const { store, shown } = this;

    if (!store.items.size) return null;

    return (
      <section className="main">
        <label className="toggle-all">
          <input
            type="checkbox"
            checked={store.allDone}
            onChange={(e) => store.toggleAll(e.target.checked)}
          />
          Toggle all
        </label>
        <ul className="list">{shown}</ul>
      </section>
    );
  }
}

// The layout owns the chrome that persists across filter navigation: the entry
// field and the footer. The matched List arrives as children.
class App extends Component {
  store = get(Store);

  render() {
    const { store } = this;

    return (
      <div className="todomvc">
        <h1>todos</h1>
        <form
          className="new"
          onSubmit={(e) => {
            e.preventDefault();
            store.add();
          }}>
          <input
            autoFocus
            placeholder="What needs to be done?"
            value={store.draft}
            onChange={(e) => (store.draft = e.target.value)}
          />
        </form>

        {this.props.children}

        {store.items.size > 0 && (
          <footer className="footer">
            <span className="count">
              <b>{store.remaining}</b>{' '}
              {store.remaining === 1 ? 'item' : 'items'} left
            </span>
            <nav className="filters">
              <Tab to="/">All</Tab>
              <Tab to="/active">Active</Tab>
              <Tab to="/completed">Completed</Tab>
            </nav>
            {store.completed > 0 && (
              <button className="clear" onClick={() => store.clearCompleted()}>
                Clear completed
              </button>
            )}
          </footer>
        )}
      </div>
    );
  }
}

export default () => (
  <Provider for={Store}>
    <Router>
      <Route as={App}>
        <Route as={List} />
        <Route to=":filter" as={List} />
      </Route>
    </Router>
  </Provider>
);
