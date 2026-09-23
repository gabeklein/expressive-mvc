import './App.css';

import { Component, get } from '@expressive/react';
import { Route, Router } from '@expressive/router';
import type { ReactNode } from 'react';

const BOOKS = [
  { title: 'Analysis I', year: 2016, tag: 'math' },
  { title: 'Concrete Mathematics', year: 1994, tag: 'math' },
  { title: 'Structure and Interpretation', year: 1985, tag: 'code' }
];

export default () => (
  <Router>
    <Route as={Frame}>
      <Route as={Catalog} />
    </Route>
  </Router>
);

const Frame = (props: { children?: ReactNode }) => (
  <div className="container">
    <h1>Query</h1>
    <p>
      <code>query</code> is not a string - it is a reactive map of the search
      params. Reading a key subscribes to that key alone; writing or deleting one
      navigates, pushing a history entry exactly as <code>goto</code> would.
    </p>
    {props.children}
    <small>
      The URL stays the only source of truth, so Back walks the sort and filter
      changes in order - no separate state to keep in step with it.
    </small>
  </div>
);

class Catalog extends Component {
  route = get(Route);
  router = get(Router);

  render() {
    const { route, router } = this;
    const { query } = route;
    const tag = query.get('tag');
    const sort = query.get('sort') ?? 'title';

    const books = BOOKS.filter((book) => !tag || book.tag === tag).sort((a, b) =>
      sort === 'year' ? a.year - b.year : a.title.localeCompare(b.title)
    );

    return (
      <section className="catalog">
        <div className="controls">
          <button onClick={() => query.set('sort', 'title')}>Sort title</button>
          <button onClick={() => query.set('sort', 'year')}>Sort year</button>
          <button onClick={() => query.set('tag', 'math')}>Only math</button>
          <button onClick={() => query.delete('tag')}>Clear tag</button>
        </div>

        <ul className="books">
          {books.map(({ title, year }) => (
            <li key={title}>
              {title} <small>{year}</small>
            </li>
          ))}
        </ul>

        <footer>
          <code>{router.url}</code>
          <button onClick={() => router.back()}>Back</button>
        </footer>
      </section>
    );
  }
}
