import { Component, get } from '@expressive/react';
import { Link } from '@expressive/router';

import { usd } from './catalog';
import { Cart } from './Store';

// NOTE: this reads the cart and holds no state of its own, so by the "keep it
// lite" rule it *should* be a plain function calling Cart.get(). It is a class
// only to work around a reactivity bug: an FC reading the `lines`/`total`
// computed getters via Cart.get() re-renders once, then stops. A class
// re-reads the getters in render() each time and updates reliably. See the
// PR discussion; revert to an FC once the getter-subscription bug is fixed.
export class CartPage extends Component {
  cart = get(Cart);

  render() {
    const { lines, total, count, receipt } = this.cart;

    // Post-checkout confirmation. `reset()` clears it back to the live cart.
    if (receipt)
      return (
        <div className="notice">
          <span className="big-emoji">✅</span>
          <h1>Order placed!</h1>
          <p>
            {receipt.count} {receipt.count === 1 ? 'item' : 'items'} ·{' '}
            {usd(receipt.total)}
          </p>
          <Link to="/" onClick={() => this.cart.reset()}>
            Continue shopping
          </Link>
        </div>
      );

    if (!count)
      return (
        <div className="notice">
          <span className="big-emoji">🛒</span>
          <h1>Your cart is empty</h1>
          <Link to="/">Browse the store</Link>
        </div>
      );

    return (
      <div className="cart">
        <h1>Your Cart</h1>

        <ul className="lines">
          {lines.map(({ product, qty, subtotal }) => (
            <li key={product.id} className="line">
              <Link to={`/product/${product.id}`} className="line-emoji">
                {product.emoji}
              </Link>
              <div className="line-info">
                <Link to={`/product/${product.id}`}>{product.name}</Link>
                <small>{usd(product.price)} each</small>
              </div>
              <div className="qty">
                <button
                  onClick={() => this.cart.setQty(product.id, qty - 1)}
                  aria-label="Decrease quantity">
                  −
                </button>
                <span className="qty-val">{qty}</span>
                <button
                  onClick={() => this.cart.setQty(product.id, qty + 1)}
                  aria-label="Increase quantity">
                  +
                </button>
              </div>
              <span className="line-sub">{usd(subtotal)}</span>
              <button
                className="remove"
                onClick={() => this.cart.remove(product.id)}
                aria-label={`Remove ${product.name}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div className="summary">
          <span>Total</span>
          <span className="total">{usd(total)}</span>
        </div>

        <button
          className="primary checkout"
          onClick={() => this.cart.checkout()}>
          Checkout · {usd(total)}
        </button>
      </div>
    );
  }
}
