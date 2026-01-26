import State, { set } from '@expressive/react';
import { useState } from 'react';

class TodoItem extends State {
  text = '';
  completed = false;

  toggle() {
    this.completed = !this.completed;
  }
}

class TodoList extends State {
  items: TodoItem[] = [];

  // Computed value
  remaining = set(this, ({ items }) => {
    return items.filter((t) => !t.completed).length;
  });

  add(text: string) {
    const todo = TodoItem.new({ text });
    this.items = [...this.items, todo];
  }

  remove(todo: TodoItem) {
    this.items = this.items.filter((t) => t !== todo);
  }
}

function TodoApp() {
  const list = TodoList.use();
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      list.add(inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="todo-app">
      <div className="todo-header">
        <p className="remaining-count">
          {list.remaining} {list.remaining === 1 ? 'item' : 'items'} left
        </p>
      </div>

      <form onSubmit={handleSubmit} className="todo-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="What needs to be done?"
        />
        <button type="submit">Add</button>
      </form>

      <div className="todo-list">
        {list.items.map((item) => (
          <TodoItemView
            key={String(item)}
            item={item}
            onRemove={() => list.remove(item)}
          />
        ))}
      </div>
    </div>
  );
}

function TodoItemView({
  item,
  onRemove
}: {
  item: TodoItem;
  onRemove: () => void;
}) {
  const { text, completed, toggle } = item;

  return (
    <div className={`todo-item ${completed ? 'completed' : ''}`}>
      <input type="checkbox" checked={completed} onChange={toggle} />
      <span className="todo-text">{text}</span>
      <button onClick={onRemove} className="remove-btn">
        ×
      </button>
    </div>
  );
}

export default TodoApp;
