import './App.css';

import { Component } from '@expressive/mvc';

const NAMES = [
  'Ada Lovelace',
  'Alan Turing',
  'Barbara Liskov',
  'Donald Knuth',
  'Edsger Dijkstra',
  'Frances Allen',
  'Grace Hopper',
  'Katherine Johnson',
  'Linus Torvalds',
  'Margaret Hamilton'
];

export default () => (
  <div className="container">
    <h1>Async Effect</h1>
    <p>
      An effect that returns a promise runs one at a time. Typing while a lookup
      is in flight starts nothing - the changes queue a single re-run with the
      latest <code>query</code> once it settles, so results never arrive out of
      order and lookups never overlap.
    </p>
    <Search />
    <small>
      The effect reads <code>query</code> by destructuring, which subscribes to
      it. Writes to <code>this</code> after the <code>await</code> land on the
      live instance.
    </small>
  </div>
);

class Search extends Component {
  query = '';
  results: string[] = [];
  keystrokes = 0;
  lookups = 0;

  protected new() {
    this.get(async ({ query }) => {
      this.lookups++;

      await new Promise((done) => setTimeout(done, 600));

      const match = query.toLowerCase();

      this.results = NAMES.filter((name) => name.toLowerCase().includes(match)).slice(0, 5);
    });
  }

  search(event: { currentTarget: { value: string } }) {
    this.keystrokes++;
    this.query = event.currentTarget.value;
  }

  render() {
    const { query, results, keystrokes, lookups } = this;

    return (
      <>
        <input placeholder="Search names" value={query} onInput={this.search} />
        <p className="tally">
          Keystrokes: {keystrokes} · Lookups: {lookups}
        </p>
        <ul className="results">
          {results.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </>
    );
  }
}
