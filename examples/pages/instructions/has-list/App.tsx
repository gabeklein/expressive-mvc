import './App.css';

import { Component, has } from '@expressive/react';

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
      <div className="container log">
        <ol className="entries">
          {[...history].map((entry, i) => (
            <li key={i}>
              <span className="idx">{i}</span>
              <span className="entry">{entry}</span>
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
            onChange={(e) => (this.draft = e.target.value)}
          />
          <button type="submit">Push</button>
        </form>

        <footer>
          <small>{history.size} entries · latest: {history.get(-1) ?? '—'}</small>
          <button className="ghost" onClick={() => this.undo()} disabled={!history.size}>
            Undo
          </button>
        </footer>
      </div>
    );
  }
}
