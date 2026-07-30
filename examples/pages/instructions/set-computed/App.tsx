import './App.css';

import { Component, set } from '@expressive/react';

export default () => (
  <div className="container">
    <h1>Computed</h1>
    <p>
      Declare a parameter and the same instruction becomes a computed slot -{' '}
      <code>set(self =&gt; …)</code> re-runs whenever a field it read is updated,
      where <code>set(() =&gt; …)</code> would have run once and cached. Arity is
      the whole difference.
    </p>
    <Invoice />
    <small>
      Because a derivation is a value rather than a getter, it can be factored out
      and reused - <code>money()</code> below builds two of these fields, which no
      pair of getters could share.
    </small>
  </div>
);

class Invoice extends Component {
  hours = 12;
  rate = 85;
  discount = 10;

  subtotal = set((self: Invoice) => self.hours * self.rate);
  due = set((self: Invoice) => self.subtotal * (1 - self.discount / 100));

  gross = money((self: Invoice) => self.subtotal);
  net = money((self: Invoice) => self.due);

  render() {
    const { hours, rate, discount, gross, net } = this;

    return (
      <section className="invoice">
        <label>
          Hours
          <input
            type="number"
            value={hours}
            onChange={(e) => (this.hours = +e.target.value)}
          />
        </label>

        <label>
          Rate
          <input
            type="number"
            value={rate}
            onChange={(e) => (this.rate = +e.target.value)}
          />
        </label>

        <label>
          Discount {discount}%
          <input
            type="range"
            max={50}
            value={discount}
            onChange={(e) => (this.discount = +e.target.value)}
          />
        </label>

        <footer>
          <span>{gross}</span>
          <b>{net}</b>
        </footer>
      </section>
    );
  }
}

function money<T>(pick: (self: T) => number) {
  return set((self: T) => `$${pick(self).toFixed(2)}`);
}
