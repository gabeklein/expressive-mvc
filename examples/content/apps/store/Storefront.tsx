import { Component, get } from '@expressive/react';
import { Link, Route } from '@expressive/router';

import { categories, inCategory, products, usd } from './catalog';

// The grid does double duty: it's the index route (all products) AND the
// `category/:cat` route (filtered). It reads its own Route to tell which.
export class Storefront extends Component {
  route = get(Route);

  render() {
    // `cat` is present on /category/:cat, absent on the index route. Same-
    // pattern navigation (food -> animals) reconciles this page in place.
    const cat = this.route.match?.cat;
    const shown = cat ? inCategory(cat) : products;

    return (
      <div className="storefront">
        <nav className="chips">
          <Link to="/" className={cat ? 'chip' : 'chip on'}>
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              to={`/category/${c.slug}`}
              className={cat === c.slug ? 'chip on' : 'chip'}>
              {c.label}
            </Link>
          ))}
        </nav>

        <div className="grid">
          {shown.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} className="card">
              <span className="card-emoji">{p.emoji}</span>
              <span className="card-name">{p.name}</span>
              <span className="card-price">{usd(p.price)}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }
}
