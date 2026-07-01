import State from '@expressive/react';

import { getProduct, Product } from './catalog';

export interface Line {
  product: Product;
  qty: number;
  subtotal: number;
}

// One cart, provided at the app root and read by every page via Cart.get().
export class Cart extends State {
  // id -> quantity. Reassigned (never mutated in place) so subscribers refresh.
  items: Record<string, number> = {};

  // After checkout we stash a receipt to show the confirmation, then empty.
  receipt: null | { count: number; total: number } = null;

  add(id: string, qty = 1) {
    const now = (this.items[id] ?? 0) + qty;
    this.items = { ...this.items, [id]: now };
  }

  setQty(id: string, qty: number) {
    if (qty < 1) return this.remove(id);
    this.items = { ...this.items, [id]: qty };
  }

  remove(id: string) {
    const { [id]: _drop, ...rest } = this.items;
    this.items = rest;
  }

  checkout() {
    if (!this.count) return;
    this.receipt = { count: this.count, total: this.total };
    this.items = {};
  }

  reset() {
    this.receipt = null;
  }

  // Getters are auto-memoized and dependency-tracked: they recompute only when
  // `items` changes, and reading one subscribes the reading component to it.
  get count() {
    return Object.values(this.items).reduce((sum, qty) => sum + qty, 0);
  }

  get lines(): Line[] {
    return Object.entries(this.items).flatMap(([id, qty]) => {
      const product = getProduct(id);
      return product ? [{ product, qty, subtotal: product.price * qty }] : [];
    });
  }

  get total() {
    return this.lines.reduce((sum, line) => sum + line.subtotal, 0);
  }
}
