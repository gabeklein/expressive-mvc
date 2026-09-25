import './App.css';

import { type ReactNode } from 'react';

import { Provider } from '@expressive/react';
import { Link, Route, Router } from '@expressive/router';

import { CartPage } from './Cart';
import { ProductPage } from './Product';
import { Cart } from './Store';
import { Storefront } from './Storefront';

export default () => (
  <div className="container shop">
    <h1>Storefront</h1>
    <p>
      The cart is a <code>map</code> keyed by product id, spawning a{' '}
      <code>Line</code> per entry. Adding a product again finds its line by key
      and bumps it; a line stepped to zero destroys itself, which evicts it from
      the map.
    </p>
    <Provider for={Cart}>
      <Router>
        <Route as={Layout}>
          <Route as={Storefront} />
          <Route to="category/:cat" as={Storefront} />
          <Route to="product/:id" as={ProductPage} />
          <Route to="cart" as={CartPage} />
          <Route none as={NotFound} />
        </Route>
      </Router>
    </Provider>
    <small>
      Each line renders its own row, so the cart page drops the map straight
      into a <code>&lt;ul&gt;</code>. The badge reads only <code>count</code>,
      and the product page's quantity stepper reads the page through context.
    </small>
  </div>
);

const Layout = ({ children }: { children?: ReactNode }) => (
  <div className="store">
    <header className="store-head">
      <Link to="/" className="brand">
        🛍️ Emoji Store
      </Link>
      <CartButton />
    </header>
    {children}
  </div>
);

const CartButton = () => {
  const { count } = Cart.get();

  return (
    <Link to="/cart" className="cart-btn" aria-label="Cart">
      🛒
      {count > 0 && <span className="badge">{count}</span>}
    </Link>
  );
};

const NotFound = () => (
  <div className="notice">
    <span className="big-emoji">🧭</span>
    <h2>Nothing here</h2>
    <Link to="/">Back to the store</Link>
  </div>
);
