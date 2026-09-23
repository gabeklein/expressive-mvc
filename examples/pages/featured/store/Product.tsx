import { Component, get } from '@expressive/react';
import { Link, Route } from '@expressive/router';

import { categoryLabel, getProduct, usd } from './catalog';
import { Cart } from './Store';

export class ProductPage extends Component {
  route = get(Route);
  cart = get(Cart);

  qty = 1;

  get product() {
    const id = this.route.match?.id;

    return id ? getProduct(id) : undefined;
  }

  get subtotal() {
    return this.product ? this.product.price * this.qty : 0;
  }

  quantity(by: number) {
    this.qty = Math.max(1, this.qty + by);
  }

  addToCart() {
    const { product, qty } = this;

    if (!product) return;

    this.cart.add(product.id, qty);
    this.qty = 1;
  }

  render() {
    const {
      product,
      qty,
      subtotal,
      addToCart
    } = this;

    if (product)
      return (
        <div className="product">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Store</Link>
            <Link to={`/category/${product.category}`}>
              {categoryLabel(product.category)}
            </Link>
            <span aria-current="page">{product.name}</span>
          </nav>

          <div className="hero">
            <span className="hero-emoji">{product.emoji}</span>
            <div className="hero-info">
              <h2>{product.name}</h2>
              <p className="hero-price">{usd(product.price)}</p>
              <Stepper />
              <button className="primary" onClick={addToCart}>
                Add {qty} to cart · {usd(subtotal)}
              </button>
            </div>
          </div>
        </div>
      );

    return <NotFound />;
  }
}

const Stepper = () => {
  const {
    qty,
    quantity
  } = ProductPage.get();

  return (
    <div className="qty">
      <button onClick={() => quantity(-1)} aria-label="Decrease quantity">
        −
      </button>
      <span className="qty-val">{qty}</span>
      <button onClick={() => quantity(1)} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
};

const NotFound = () => (
  <div className="notice">
    <span className="big-emoji">🫥</span>
    <h2>Product not found</h2>
    <Link to="/">Back to the store</Link>
  </div>
);
