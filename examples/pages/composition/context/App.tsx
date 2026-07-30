import './App.css';

import State, { Consumer, Provider } from '@expressive/react';

const SHELF = [
  { name: 'Espresso', price: 3 },
  { name: 'Cortado', price: 4 },
  { name: 'Pour-over', price: 5 }
];

export default () => (
  <div className="container">
    <h1>Context</h1>
    <p>
      <code>Provider</code> puts state in context - a class it constructs and will
      destroy, an instance it leaves alone, or a map of several at once. Anything
      below finds it by class with <code>.get()</code>, which is the difference
      between joining state and creating it.
    </p>
    <Provider for={{ shop: Shop, cart: Cart }}>
      <div className="counter">
        <Greeting />
        <Shelf />
        <Badge />
        <Consumer for={Cart}>
          {(cart) => <p className="total">Total ${cart.total}</p>}
        </Consumer>
      </div>
    </Provider>
    <small>
      Subscriptions are per component and per field: the badge tracks{' '}
      <code>count</code>, the total tracks <code>total</code>, and the greeting
      re-renders for neither. <code>is</code> is the instance itself - reads
      through it don't subscribe, which is how the shelf writes to a cart it never
      displays.
    </small>
  </div>
);

class Shop extends State {
  barista = 'Ada';
}

class Cart extends State {
  count = 0;
  total = 0;

  add(price: number) {
    this.count++;
    this.total += price;
  }
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
