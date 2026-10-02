import './App.css';

import { Component, State } from '@expressive/mvc';

const SHELF = [
  { name: 'Espresso', price: 3 },
  { name: 'Cortado', price: 4 },
  { name: 'Pour-over', price: 5 }
];

export default () => (
  <div className="container">
    <h1>Context</h1>
    <p>
      <code>{'<Component for>'}</code> puts state in context - a class it constructs
      and will destroy, or an instance it leaves alone. A State's own child states
      come along: the shop owns its cart, so one element provides both. Anything
      below finds either by class with <code>.get()</code>, which is the difference
      between joining state and creating it.
    </p>
    <Component for={Shop}>
      <div className="counter">
        <Greeting />
        <Shelf />
        <Badge />
        <Total />
      </div>
    </Component>
    <small>
      Subscriptions are per component and per field: the badge tracks{' '}
      <code>count</code>, the total tracks <code>total</code>, and the greeting
      re-renders for neither. <code>is</code> is the instance itself - reads
      through it don't subscribe, which is how the shelf writes to a cart it never
      displays.
    </small>
  </div>
);

class Cart extends State {
  count = 0;
  total = 0;

  add(price: number) {
    this.count++;
    this.total += price;
  }
}

class Shop extends State {
  barista = 'Ada';
  cart = new Cart();
}

const Greeting = () => {
  const { barista } = Shop.get();

  return <p className="greeting">{barista} is on bar</p>;
};

const Shelf = () => {
  const { is: cart } = Cart.get();

  return (
    <div className="shelf">
      {SHELF.map(({ name, price }) => (
        <button key={name} onClick={() => cart.add(price)}>
          {name} <small>${price}</small>
        </button>
      ))}
    </div>
  );
};

const Badge = () => {
  const { count } = Cart.get();

  return <p className="badge">{count} in cart</p>;
};

const Total = () => {
  const { total } = Cart.get();

  return <p className="total">Total ${total}</p>;
};
