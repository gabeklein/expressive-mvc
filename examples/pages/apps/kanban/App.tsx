import './App.css';

import { Component, get, has } from '@expressive/react';

// The board owns every card in one pool and its columns in another, and
// provides itself to both (and to the cards) so they reach it with
// get(Board). Columns are a pool, not a list: the pool spawns each column
// owned and activated inside the board's context, which is what lets a
// column resolve get(Board) and pull its own cards.
export default class Board extends Component {
  cards = has(Card);
  columns = has(Column);

  // Where a drop would land: a card's key (insert before it) or a column
  // id (append). Empty between drags. Cards and columns read it to draw the
  // indicator, so a hover anywhere refreshes only what the position touches.
  over = '';

  protected new() {
    const { columns } = this;

    columns.add({ id: "todo", label: "To Do", accent: "#6366f1" });
    columns.add({ id: "doing", label: "In Progress", accent: "#f59e0b" });
    columns.add({ id: "done", label: "Done", accent: "#10b981" });

    this.add('Ship map + has', 'done');
    this.add('Wire drag and drop', 'doing');
    this.add('Write the migration guide', 'todo');
    this.add('Deprecate hot (someday)', 'todo');
  }

  add(title: string, column: string) {
    this.cards.add({ title, column, order: this.next() });
  }

  // One increasing order shared across columns - only compared within a
  // column, so a global value still sorts each correctly. Reads the current
  // max, not the count, so it survives deletes and the fractional orders a
  // drop inserts.
  next() {
    return Math.max(0, ...this.cards.map((c) => c.order)) + 1;
  }

  // Place the dragged card into a column, before `target` if given -
  // fractional ordering keeps neighbors untouched.
  drop(key: string, column: string, target?: Card) {
    this.over = '';

    const card = [...this.cards].find((c) => c.key === key);

    if (!card) return;

    // Clear here, not in onDragEnd: the drop reparents the card's node into
    // another column, and a moved node may never fire dragend.
    card.dragging = false;

    if (card === target) return;

    if (target) {
      const siblings = ordered(this.cards, column).filter((c) => c !== card);
      const prev = siblings[siblings.indexOf(target) - 1];
      card.order = prev ? (prev.order + target.order) / 2 : target.order - 1;
    } else {
      card.order = this.next();
    }

    card.column = column;
  }

  render() {
    return (
      <div className="container kanban">
        <h1>Kanban</h1>
        <p>Drag cards between columns; double-click a card to rename.</p>
        <div className="board">{this.columns}</div>
      </div>
    );
  }
}

// The cards of one column, in order. A plain function, not a method: read
// through a component's render proxy (`ordered(this.cards, ...)`) it also
// subscribes that component to member moves.
const ordered = (cards: has.Pool<Card>, column: string) =>
  cards.filter((card) => card.column === column).sort((a, b) => a.order - b.order);

// A card is a Component - it owns its data, its inline editor, and its
// own markup. An activated instance renders directly as an element, so
// columns drop the card straight into JSX; no <Row>, props, or keys.
class Card extends Component {
  board = get(Board);

  title = '';
  column = 'todo';
  order = 0;
  editing = false;
  dragging = false;

  rename(title: string) {
    title = title.trim();
    if (title) this.title = title;
    this.editing = false;
  }

  // Destroying a member is a complete removal: the owning pool evicts it.
  remove() {
    this.set(null);
  }

  render() {
    const { title, editing, dragging, board } = this;
    const over = board.over === this.key && !dragging;

    return (
      <li
        className={`card${dragging ? ' dragging' : ''}${over ? ' over' : ''}`}
        draggable={!editing}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', this.key);
          this.dragging = true;
        }}
        onDragEnd={() => {
          this.dragging = false;
          board.over = '';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          board.over = this.key;
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          board.drop(e.dataTransfer.getData('text/plain'), this.column, this);
        }}>
        {editing ? (
          <input
            autoFocus
            defaultValue={title}
            onBlur={(e) => this.rename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') this.rename(e.currentTarget.value);
              if (e.key === 'Escape') this.editing = false;
            }}
          />
        ) : (
          <>
            <span onDoubleClick={() => (this.editing = true)}>{title}</span>
            <button className="remove" onClick={this.remove} aria-label="delete">
              ×
            </button>
          </>
        )}
      </li>
    );
  }
}

// A column pulls its own slice of the board's cards. Reading
// this.board.cards through the render proxy (via the ordered() helper, not
// a bound method) subscribes the column to its members' moves.
class Column extends Component {
  board = get(Board);

  id = '';
  label = '';
  accent = '';
  draft = '';

  get cards() {
    return ordered(this.board.cards, this.id);
  }

  add() {
    const title = this.draft.trim();
    if (!title) return;

    this.draft = '';
    this.board.cards.add({
      title,
      column: this.id,
      order: this.board.next()
    });
  }

  render() {
    const { cards, label, accent, draft, board } = this;
    const over = board.over === this.id;

    return (
      <section
        className={over ? 'column over-end' : 'column'}
        style={{ '--accent': accent } as any}
        onDragOver={(e) => {
          e.preventDefault();
          board.over = this.id;
        }}
        onDrop={(e) => board.drop(e.dataTransfer.getData('text/plain'), this.id)}>
        <header>
          <h2>{label}</h2>
          <span className="count">{cards.length}</span>
        </header>
        <ul className="cards">{cards}</ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            this.add();
          }}>
          <input
            value={draft}
            placeholder="+ Add a card"
            onChange={(e) => (this.draft = e.target.value)}
          />
        </form>
      </section>
    );
  }
}