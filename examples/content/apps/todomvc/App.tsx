import './App.css';

import { Component, get, Provider, use } from '@expressive/react';
import { Link, Route, Router } from '@expressive/router';

import { Filter, Store, Todo } from './Store';

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

// One row subscribes to its own Todo via use(); nothing else re-renders
// when it toggles or enters edit mode.
const Row = ({ todo }: { todo: Todo }) => {
  const store = Store.get();
  const { text, done, editing, draft } = use(todo);

  const commit = () => {
    const value = todo.draft.trim();
    if (value) {
      todo.text = value;
      todo.editing = false;
    } else store.remove(todo);
  };

  if (editing)
    return (
      <li className="editing">
        <input
          className="edit"
          ref={(el) => {
            if (el) {
              el.focus();
              el.select();
            }
          }}
          value={draft}
          onChange={(e) => (todo.draft = e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') {
              todo.draft = todo.text;
              todo.editing = false;
            }
          }}
        />
      </li>
    );

  return (
    <li className={done ? 'done' : ''}>
      <input
        type="checkbox"
        className="toggle"
        checked={done}
        onChange={() => store.toggle(todo)}
      />
      <label onDoubleClick={() => todo.begin()}>{text}</label>
      <button className="destroy" onClick={() => store.remove(todo)}>
        ×
      </button>
    </li>
  );
};

// The list section - hidden when empty. The active filter comes from this
// route's own match, so navigating between tabs reselects what's shown.
class List extends Component {
  store = get(Store);
  route = get(Route);

  get filter(): Filter {
    const f = this.route.match?.filter;
    return f === 'active' || f === 'completed' ? f : 'all';
  }

  render() {
    const { store, filter } = this;

    if (!store.items.length) return null;

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
        <ul className="list">
          {store.view(filter).map((todo) => (
            <Row key={String(todo)} todo={todo} />
          ))}
        </ul>
      </section>
    );
  }
}

// The layout owns the chrome that persists across filter navigation: the
// entry field and the footer. The matched List arrives as children.
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

        {store.items.length > 0 && (
          <footer className="footer">
            <span className="count">
              <b>{store.remaining}</b> {store.remaining === 1 ? 'item' : 'items'} left
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
