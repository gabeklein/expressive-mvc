import { Link, Route } from '@expressive/router';

import { categories, inCategory, products, usd } from './catalog';

export const Storefront = () => {
  const {
    match: {
      cat
    } = {}
  } = Route.get();

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
};
