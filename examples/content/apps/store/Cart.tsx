import { Link } from '@expressive/router';

import { usd } from './catalog';
import { Cart } from './Store';

// Reads the shared cart and holds no state of its own, so a plain function
// consuming Cart.get() - re-renders as lines/total/receipt change.
export const CartPage = () => {
  const { is: cart, lines, total, count, receipt } = Cart.get();

  if (!count)
    return (
      <div className="notice">
        <span className="big-emoji">🛒</span>
        <h1>Your cart is empty</h1>
        <Link to="/">Browse the store</Link>
      </div>
    );

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
        <Link to="/" onClick={() => cart.reset()}>
          Continue shopping
        </Link>
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
                onClick={() => cart.setQty(product.id, qty - 1)}
                aria-label="Decrease quantity">
                −
              </button>
              <span className="qty-val">{qty}</span>
              <button
                onClick={() => cart.setQty(product.id, qty + 1)}
                aria-label="Increase quantity">
                +
              </button>
            </div>
            <span className="line-sub">{usd(subtotal)}</span>
            <button
              className="remove"
              onClick={() => cart.remove(product.id)}
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

      <button className="primary checkout" onClick={() => cart.checkout()}>
        Checkout · {usd(total)}
      </button>
    </div>
  );
};
