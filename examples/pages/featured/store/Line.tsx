import { Component } from '@expressive/react';
import { Link } from '@expressive/router';

import { getProduct, usd } from './catalog';

export class Line extends Component {
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

  step(by: number) {
    const qty = this.qty + by;

    if (qty > 0) this.qty = qty;
    else this.set(null);
  }

  remove() {
    this.set(null);
  }

  render() {
    const {
      qty,
      subtotal,
      step,
      remove,
      product: {
        id,
        emoji,
        name,
        price
      }
    } = this;

    const to = `/product/${id}`;

    return (
      <li className="line">
        <Link to={to} className="line-emoji">
          {emoji}
        </Link>
        <div className="line-info">
          <Link to={to}>{name}</Link>
          <small>{usd(price)} each</small>
        </div>
        <div className="qty">
          <button onClick={() => step(-1)} aria-label="Decrease quantity">
            −
          </button>
          <span className="qty-val">{qty}</span>
          <button onClick={() => step(1)} aria-label="Increase quantity">
            +
          </button>
        </div>
        <span className="line-sub">{usd(subtotal)}</span>
        <button className="remove" onClick={remove} aria-label={`Remove ${name}`}>
          ✕
        </button>
      </li>
    );
  }
}
