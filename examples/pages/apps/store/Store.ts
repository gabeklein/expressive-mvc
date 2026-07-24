import State, { map } from '@expressive/react';

import { Line } from './Line';

// One cart, provided at the app root and read by every page via Cart.get().
export class Cart extends State {
  // Keyed by product id, spawning a Line per entry. The key is the retrieval
  // handle, so `add` finds an existing line and bumps it instead of rebuilding
  // a record - and a line that steps to zero evicts itself.
  items = map((id: string) => new Line(id));

  // After checkout we stash a receipt to show the confirmation, then empty.
  receipt: null | { count: number; total: number } = null;

  add(id: string, qty = 1) {
    const line = this.items.get(id) ?? this.items.set(id).get(id)!;

    line.qty += qty;
  }

  checkout() {
    if (!this.count) return;

    this.receipt = { count: this.count, total: this.total };
    this.items.clear();
  }

  reset() {
    this.receipt = null;
  }

  // `values(fn)` tracks the map's shape plus each line it visits, so these
  // recompute when a line is added, evicted, or restepped.
  get count() {
    return sum(this.items.values((line) => line.qty));
  }

  get total() {
    return sum(this.items.values((line) => line.subtotal));
  }
}

const sum = (values: Iterable<number>) => {
  let total = 0;

  for (const value of values) total += value;

  return total;
};
