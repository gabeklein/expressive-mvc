import './App.css';

import State, { Component, use } from '@expressive/react';

// Each item is its own State - a small reactive object with behavior.
class Item extends State {
  text = '';
  done = false;

  toggle() {
    this.done = !this.done;
  }
}

// A row subscribes to one item with use(), so toggling re-renders just
// that row. (Reading a child's fields off a parent array does NOT
// subscribe the parent - each child is observed where it's rendered.)
const Row = ({ item }: { item: Item }) => {
  const { text, done, toggle } = use(item);

  return (
    <li className={done ? 'done' : ''} onClick={toggle}>
      {text}
    </li>
  );
};

// The list owns the collection. Adding reassigns `items`, so the list
// re-renders to show the new row.
class TodoList extends Component {
  items = [Item.new({ text: 'Learn Expressive' })];
  draft = '';

  add() {
    if (!this.draft) return;
    this.items = [...this.items, Item.new({ text: this.draft })];
    this.draft = '';
  }

  render() {
    const { items, draft } = this;

    return (
      <div className="container">
        <h1>Nested State</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            this.add();
          }}>
          <input
            value={draft}
            placeholder="Add a todo, press Enter"
            onChange={(e) => (this.draft = e.target.value)}
          />
        </form>

        <ul className="todos">
          {items.map((item) => (
            <Row key={String(item)} item={item} />
          ))}
        </ul>

        <small>{items.length} items</small>
      </div>
    );
  }
}

export default () => <TodoList />;
