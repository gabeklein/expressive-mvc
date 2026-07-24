import './App.css';

import { type ReactNode } from 'react';

import { Provider } from '@expressive/react';
import { Link, Route, Router } from '@expressive/router';

import { CartPage } from './Cart';
import { ProductPage } from './Product';
import { Cart } from './Store';
import { Storefront } from './Storefront';

// Persistent chrome: the brand + cart button stay put while the matched page
// arrives as `children`. Purely presentational - it reads nothing reactive
// itself, so a plain function (the badge subscribes inside CartButton).
const Layout = ({ children }: { children?: ReactNode }) => (
  <div className="store">
    <header className="store-head">
      <Link to="/" className="brand">
        🛍️ Emoji Store
      </Link>
      <CartButton />
    </header>
    <div className="store-body">{children}</div>
  </div>
);

// Reads just `count` off the shared cart, so it re-renders only when the item
// count changes - not on every unrelated cart mutation.
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
    <h1>Nothing here</h1>
    <Link to="/">Back to the store</Link>
  </div>
);

// One in-memory Router; the Cart is provided above it so every page shares it.
export default () => (
  <Provider for={Cart}>
    <Router>
      <Route as={Layout}>
        <Route as={Storefront} />
        <Route to="category/:cat" as={Storefront} />
        <Route to="product/:id" as={ProductPage} />
        <Route to="cart" as={CartPage} />
        <Route default as={NotFound} />
      </Route>
    </Router>
  </Provider>
);
