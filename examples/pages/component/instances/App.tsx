import './App.css';

import Button from '@common/Button';
import { Component } from '@expressive/react';

class Cart extends Component {
  items = 0;

  add() {
    this.items++;
  }

  render() {
    return (
      <button className="cart" onClick={this.add}>
        Cart <strong>{this.items}</strong>
      </button>
    );
  }
}

class Step extends Component {
  label = '';
  done = false;

  toggle() {
    this.done = !this.done;
  }

  render() {
    return (
      <li className={this.done ? 'done' : ''} onClick={this.toggle}>
        {this.label}
      </li>
    );
  }
}

// Built here, outside React, and owned by this module. `.new()` activates the
// instance so it is ready to place; nothing in the tree constructs or destroys
// it. The owner would end its life with `cart.set(null)`.
const cart = Cart.new();

const steps = ['Browse', 'Checkout', 'Confirm'].map((label) => Step.new({ label }));

export default () => (
  <div className="container">
    <h1>Instances</h1>
    <p>
      An activated instance is an element. Placing it subscribes and provides
      context as usual, but the placement never owns it.
    </p>
    <Demo />
  </div>
);

class Demo extends Component {
  footer = true;

  render() {
    const { footer } = this;

    return (
      <>
        {/* The same instance in two places. React needs a distinct key per
            sibling, which each instance supplies from its own identity - the
            readonly `key` field, defaulting to the State uid. */}
        <header className="bar">Header {cart}</header>

        {/* Collections need no wrapper component and no key plumbing. */}
        <ul>{steps}</ul>

        {footer && <footer className="bar">Footer {cart}</footer>}

        <Button primary onClick={() => (this.footer = !footer)}>
          {footer ? 'Unmount footer' : 'Mount footer'}
        </Button>

        <small>
          One cart, two placements. Unmounting the footer only detaches it - the
          count survives, because destruction stays with the owner.
        </small>
      </>
    );
  }
}
