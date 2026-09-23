import './App.css';

import State, { Component, get } from '@expressive/react';

const TAGS = ['all', 'math', 'code'];

export default () => (
  <div className="container">
    <h1>Separation of Concerns</h1>
    <p>
      This screen has three concerns - what is being asked for, what there is to
      show, and what the reader picked - so it has three classes. None is a
      feature of the library; the pattern is just that a concern is a class, and
      the screen owns one of each.
    </p>
    <Screen />
    <p>
      Only <code>Results</code> needs all three. The filter bar cannot reach the
      selection, and the detail pane cannot see the query - not by convention, but
      because neither asked for it.
    </p>
    <small>
      Every seam here is a type. <code>query.</code> completes to the fields and
      methods that exist, a rename carries every reader with it, and a concern is
      testable without a component in sight - none of which survives a string key
      or a selector function.
    </small>
  </div>
);

class Query extends State {
  text = '';
  tag = 'all';
}

class Catalog extends State {
  books = [
    { title: 'Analysis I', tag: 'math' },
    { title: 'Structure and Interpretation', tag: 'code' },
    { title: 'Concrete Mathematics', tag: 'math' },
    { title: 'The Art of Computer Programming', tag: 'code' }
  ];

  find(text: string, tag: string) {
    const match = text.trim().toLowerCase();

    return this.books.filter(
      (book) =>
        (tag === 'all' || book.tag === tag) &&
        book.title.toLowerCase().includes(match)
    );
  }
}

class Selection extends State {
  title: string | null = null;
}

class Screen extends Component {
  query = new Query();
  catalog = new Catalog();
  selection = new Selection();

  render() {
    return (
      <section className="screen">
        <Filters />
        <Results />
        <Detail />
      </section>
    );
  }
}

class Filters extends Component {
  query = get(Query);

  render() {
    const { query } = this;

    return (
      <div className="filters">
        <input
          value={query.text}
          placeholder="Search titles"
          onChange={(e) => (query.text = e.target.value)}
        />
        <div className="tags">
          {TAGS.map((tag) => (
            <button
              key={tag}
              className={query.tag === tag ? 'tag on' : 'tag'}
              onClick={() => (query.tag = tag)}>
              {tag}
            </button>
          ))}
        </div>
      </div>
    );
  }
}

class Results extends Component {
  query = get(Query);
  catalog = get(Catalog);
  selection = get(Selection);

  render() {
    const { query, catalog, selection } = this;
    const found = catalog.find(query.text, query.tag);

    return (
      <ul className="results">
        {found.map(({ title }) => (
          <li
            key={title}
            className={selection.title === title ? 'hit on' : 'hit'}
            onClick={() => (selection.title = title)}>
            {title}
          </li>
        ))}
        {!found.length && <li className="empty">nothing matches</li>}
      </ul>
    );
  }
}

class Detail extends Component {
  selection = get(Selection);

  render() {
    const { selection } = this;

    return (
      <footer className="detail">
        {selection.title ?? 'no book selected'}
      </footer>
    );
  }
}
