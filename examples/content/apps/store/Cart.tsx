import { Link } from '@expressive/router';

import { usd } from './catalog';
import { Cart, type Line } from './Store';

// Each slice below does its own Cart.get() and subscribes only to what it
// reads - the page just picks a branch. Receipt wins over Empty: checkout
// clears the items, so both are true at once.
export const CartPage = () => {
  const { receipt, count } = Cart.get();

  if (receipt) return <Receipt />;
  if (!count) return <Empty />;

  return (
    <div className="cart">
      <h1>Your Cart</h1>
      <Lines />
      <Checkout />
    </div>
  );
};

// Post-checkout confirmation. `reset()` clears it back to the live cart.
const Receipt = () => {
  const { is: cart, receipt } = Cart.get();

  if (!receipt) return null;

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
};

const Empty = () => (
  <div className="notice">
    <span className="big-emoji">🛒</span>
    <h1>Your cart is empty</h1>
    <Link to="/">Browse the store</Link>
  </div>
);

const Lines = () => {
  const { lines } = Cart.get();

  return (
    <ul className="lines">
      {lines.map((line) => (
        <CartLine key={line.product.id} line={line} />
      ))}
    </ul>
  );
};

// Reads no cart values - only methods via `is` - so rows render from props
// alone, without a subscription of their own.
const CartLine = ({ line: { product, qty, subtotal } }: { line: Line }) => {
  const { is: cart } = Cart.get();

  return (
    <li className="line">
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
  );
};

const Checkout = () => {
  const { is: cart, total } = Cart.get();

  return (
    <>
      <div className="summary">
        <span>Total</span>
        <span className="total">{usd(total)}</span>
      </div>
      <button className="primary checkout" onClick={() => cart.checkout()}>
        Checkout · {usd(total)}
      </button>
    </>
  );
};
