import { map, Model } from '@expressive/mvc';

import { Line } from './Line';
import { Receipt } from './Receipt';

export class Cart extends Model {
  items = map((id: string) => new Line(id));

  receipt?: Receipt;

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

    this.receipt = new Receipt({ count: this.count, total: this.total });
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
