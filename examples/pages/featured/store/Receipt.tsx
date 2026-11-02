import { Component } from '@expressive/mvc';
import { Link } from '@expressive/router';

import { usd } from './catalog';
import { Cart } from './Store';

export class Receipt extends Component {
  count = 0;
  total = 0;

  render() {
    const {
      count,
      total
    } = this;

    const { reset } = Cart.get();

    return (
      <div className="notice">
        <span className="big-emoji">✅</span>
        <h2>Order placed!</h2>
        <p>
          {count} {count === 1 ? 'item' : 'items'} · {usd(total)}
        </p>
        <Link to="/" onClick={reset}>
          Continue shopping
        </Link>
      </div>
    );
  }
}
