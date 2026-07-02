import State from '@expressive/react';

// One item is its own State, so a row can subscribe to just its todo -
// toggling or editing it re-renders that row alone, not the whole list.
export class Todo extends State {
  text = '';
  done = false;

  // Editing lives on the item too; entering/leaving edit mode and typing
  // the draft touch only this row.
  editing = false;
  draft = '';

  begin() {
    this.draft = this.text;
    this.editing = true;
  }
}

export type Filter = 'all' | 'active' | 'completed';

// The store owns the collection and every mutation. Aggregate getters
// (remaining, completed) read each item's `done`, so a mutation that
// flips `done` also reassigns `items` - that reassignment is what makes
// the counts recompute, since a parent can't subscribe to its children.
export class Store extends State {
  items: Todo[] = [
    Todo.new({ text: 'Taste JavaScript', done: true }),
    Todo.new({ text: 'Buy a unicorn' })
  ];

  draft = '';

  get remaining() {
    return this.items.filter((t) => !t.done).length;
  }

  get completed() {
    return this.items.length - this.remaining;
  }

  get allDone() {
    return this.items.length > 0 && this.remaining === 0;
  }

  view(filter: Filter) {
    switch (filter) {
      case 'active':
        return this.items.filter((t) => !t.done);
      case 'completed':
        return this.items.filter((t) => t.done);
      default:
        return this.items;
    }
  }

  add() {
    const text = this.draft.trim();
    if (!text) return;

    this.items = [...this.items, Todo.new({ text })];
    this.draft = '';
  }

  toggle(todo: Todo) {
    todo.done = !todo.done;
    this.items = [...this.items];
  }

  toggleAll(done: boolean) {
    for (const todo of this.items) todo.done = done;
    this.items = [...this.items];
  }

  remove(todo: Todo) {
    this.items = this.items.filter((t) => t !== todo);
  }

  clearCompleted() {
    this.items = this.items.filter((t) => !t.done);
  }
}
