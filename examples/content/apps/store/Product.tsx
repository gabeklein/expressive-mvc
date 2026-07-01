import { Component, get } from '@expressive/react';
import { Link, Route } from '@expressive/router';

import { Breadcrumbs } from './Breadcrumbs';
import { categoryLabel, getProduct, usd } from './catalog';
import { Cart } from './Store';

export class ProductPage extends Component {
  route = get(Route);
  cart = get(Cart);

  // A reactive field on the component - the "buy N" stepper. Assigning it
  // re-renders, no useState needed.
  qty = 1;

  render() {
    const id = this.route.match?.id;
    const product = id ? getProduct(id) : undefined;

    if (!product)
      return (
        <div className="notice">
          <span className="big-emoji">🫥</span>
          <h1>Product not found</h1>
          <Link to="/">Back to the store</Link>
        </div>
      );

    const { qty } = this;

    return (
      <div className="product">
        <Breadcrumbs
          trail={[
            { label: 'Store', to: '/' },
            {
              label: categoryLabel(product.category),
              to: `/category/${product.category}`
            },
            { label: product.name }
          ]}
        />

        <div className="hero">
          <span className="hero-emoji">{product.emoji}</span>
          <div className="hero-info">
            <h1>{product.name}</h1>
            <p className="hero-price">{usd(product.price)}</p>

            <div className="qty">
              <button
                onClick={() => (this.qty = Math.max(1, qty - 1))}
                aria-label="Decrease quantity">
                −
              </button>
              <span className="qty-val">{qty}</span>
              <button
                onClick={() => (this.qty = qty + 1)}
                aria-label="Increase quantity">
                +
              </button>
            </div>

            <button
              className="primary"
              onClick={() => {
                this.cart.add(product.id, qty);
                this.qty = 1;
              }}>
              Add {qty} to cart · {usd(product.price * qty)}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
