import { Link } from '@expressive/router';

import { usd } from './catalog';
import { Cart } from './Store';

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

// Dropping the map in renders its values, and each Line renders its own row -
// so this is the entire list body.
const Lines = () => {
  const { items } = Cart.get();

  return <ul className="lines">{items}</ul>;
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
