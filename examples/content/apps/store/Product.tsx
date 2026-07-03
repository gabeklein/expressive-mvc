import { Component, get } from '@expressive/react';
import { Link, Route } from '@expressive/router';

import { Breadcrumbs } from './Breadcrumbs';
import { categoryLabel, getProduct, usd } from './catalog';
import { Cart } from './Store';

export class ProductPage extends Component {
  route = get(Route);
  cart = get(Cart);

  // The "buy N" stepper - reactive field on the component itself. Assigning it
  // re-renders, no useState needed.
  qty = 1;

  // Getters derive from route + qty and recompute only when those change -
  // render() stays thin markup over them.
  get product() {
    const id = this.route.match?.id;
    return id ? getProduct(id) : undefined;
  }

  get subtotal() {
    return this.product ? this.product.price * this.qty : 0;
  }

  quantity(by: number){
    this.qty = Math.max(1, this.qty + by);
  }

  addToCart() {
    this.cart.add(this.product!.id, this.qty);
    this.qty = 1;
  }

  render() {
    const { product, qty, subtotal, quantity } = this;

    if (!product)
      return (
        <div className="notice">
          <span className="big-emoji">🫥</span>
          <h1>Product not found</h1>
          <Link to="/">Back to the store</Link>
        </div>
      );

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
                onClick={() => quantity(-1)}
                aria-label="Decrease quantity">
                −
              </button>
              <span className="qty-val">{qty}</span>
              <button
                onClick={() => quantity(1)}
                aria-label="Increase quantity">
                +
              </button>
            </div>

            <button className="primary" onClick={this.addToCart}>
              Add {qty} to cart · {usd(subtotal)}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
