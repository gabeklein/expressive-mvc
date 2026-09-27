/** @jsxImportSource @expressive/dom */
import './App.css';

import { Component, has } from '@expressive/mvc';

// `has<string>()` is the list mode: an ordered collection of plain values you
// push, addressed by index. No spawned members, no keys - just a log. Reads
// track precisely, so `get(-1)` re-renders on a new tail, `size` on length.
export default class Editor extends Component {
  history = has<string>();
  draft = '';

  protected new() {
    this.history.push('open document');
  }

  commit(text = this.draft) {
    text = text.trim();
    if (!text) return;
    this.history.push(text);
    this.draft = '';
  }

  undo() {
    this.history.pop();
  }

  render() {
    const { history, draft } = this;

    return (
      <div class="container log">
        <h1>Owned List</h1>
        <p>
          <code>has&lt;string&gt;()</code> stores values by position. Push to
          append, pop to undo; <code>get(-1)</code> reads the latest entry.
        </p>

        <ol class="entries">
          {[...history].map((entry, i) => (
            <li key={i}>
              <span class="idx">{i}</span>
              <span class="entry">{entry}</span>
            </li>
          ))}
        </ol>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            this.commit();
          }}>
          <input
            value={draft}
            placeholder="Record an action…"
            onInput={(e) => (this.draft = (e.currentTarget as HTMLInputElement).value)}
          />
          <button type="submit">Push</button>
        </form>

        <footer>
          <small>{history.size} entries · latest: {history.get(-1) ?? '—'}</small>
          <button class="ghost" onClick={() => this.undo()} disabled={!history.size}>
            Undo
          </button>
        </footer>
      </div>
    );
  }
}
