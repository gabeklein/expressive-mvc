import { Link } from '@expressive/router';

import { usd } from './catalog';
import { Cart } from './Store';

export const CartPage = () => {
  const {
    receipt,
    count
  } = Cart.get();

  if (receipt) return <>{receipt}</>;

  if (count)
    return (
      <div className="cart">
        <h2>Your Cart</h2>
        <Lines />
        <Checkout />
      </div>
    );

  return <Empty />;
};

const Empty = () => (
  <div className="notice">
    <span className="big-emoji">🛒</span>
    <h2>Your cart is empty</h2>
    <Link to="/">Browse the store</Link>
  </div>
);

const Lines = () => {
  const { items } = Cart.get();

  return <ul className="lines">{items}</ul>;
};

const Checkout = () => {
  const {
    total,
    checkout
  } = Cart.get();

  return (
    <>
      <div className="summary">
        <span>Total</span>
        <span className="total">{usd(total)}</span>
      </div>
      <button className="primary checkout" onClick={checkout}>
        Checkout · {usd(total)}
      </button>
    </>
  );
};
