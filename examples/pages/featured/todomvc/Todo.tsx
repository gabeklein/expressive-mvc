import { Component } from '@expressive/react';

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
