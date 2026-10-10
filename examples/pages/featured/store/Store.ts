import State, { map } from '@expressive/react';

import { Line } from './Line';

export class Cart extends State {
  items = map((id: string) => new Line(id));

  receipt?: { count: number; total: number };

  get count() {
    return sum(this.items.values((line) => line.qty));
  }

  get total() {
    return sum(this.items.values((line) => line.subtotal));
  }

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
    this.receipt = undefined;
  }
}

const sum = (values: Iterable<number>) => {
  let total = 0;

  for (const value of values) total += value;

  return total;
};
