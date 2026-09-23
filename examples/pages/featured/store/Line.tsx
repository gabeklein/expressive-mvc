import { Component } from '@expressive/react';
import { Link } from '@expressive/router';

import { getProduct, usd } from './catalog';

// A cart line is a Component the cart's map spawns, keyed by product id. It
// owns its quantity and renders its own row, so the cart page drops the map
// straight into the tree - no <CartLine>, no props, no key.
export class Line extends Component {
  // Spawns at zero; `Cart.add` bumps it, so one code path covers both the
  // first add and every repeat.
  qty = 0;

  constructor(readonly sku: string) {
    super();
  }

  get product() {
    return getProduct(this.sku)!;
  }

  get subtotal() {
    return this.product.price * this.qty;
  }

  // Stepping to zero is a removal; destroying itself evicts it from the map.
  step(by: number) {
    const qty = this.qty + by;

    if (qty > 0) this.qty = qty;
    else this.set(null);
  }

  remove() {
    this.set(null);
  }

  render() {
    const { product, qty, subtotal } = this;
    const to = `/product/${product.id}`;

    return (
      <li className="line">
        <Link to={to} className="line-emoji">
          {product.emoji}
        </Link>
        <div className="line-info">
          <Link to={to}>{product.name}</Link>
          <small>{usd(product.price)} each</small>
        </div>
        <div className="qty">
          <button onClick={() => this.step(-1)} aria-label="Decrease quantity">
            −
          </button>
          <span className="qty-val">{qty}</span>
          <button onClick={() => this.step(1)} aria-label="Increase quantity">
            +
          </button>
        </div>
        <span className="line-sub">{usd(subtotal)}</span>
        <button
          className="remove"
          onClick={this.remove}
          aria-label={`Remove ${product.name}`}>
          ✕
        </button>
      </li>
    );
  }
}
