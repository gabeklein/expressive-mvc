import { Component } from '@expressive/react';

// A todo is a Component: it owns its text, its done flag, and its edit draft,
// and it renders its own row. The list drops the instance into the tree - no
// key, no props, no <Row> wrapper. Every mutation here is local to one item,
// so toggling or editing re-renders that row alone.
export class Todo extends Component {
  text = '';
  done = false;
  editing = false;
  draft = '';

  toggle() {
    this.done = !this.done;
  }

  begin() {
    this.draft = this.text;
    this.editing = true;
  }

  // Committing empty text is a delete; destroying itself evicts it from the
  // pool, so the store never has to be told.
  commit() {
    const text = this.draft.trim();

    if (!text) return this.set(null);

    this.text = text;
    this.editing = false;
  }

  cancel() {
    this.editing = false;
  }

  remove() {
    this.set(null);
  }

  render() {
    const { text, done, editing, draft } = this;

    if (editing)
      return (
        <li className="editing">
          <input
            className="edit"
            autoFocus
            value={draft}
            onChange={(e) => (this.draft = e.target.value)}
            onBlur={this.commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') this.commit();
              else if (e.key === 'Escape') this.cancel();
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
          onChange={this.toggle}
        />
        <label onDoubleClick={() => this.begin()}>{text}</label>
        <button className="destroy" onClick={this.remove}>
          ×
        </button>
      </li>
    );
  }
}
