import assert from 'node:assert/strict';
import { Steps } from '@expressive/steps';

class Order extends Steps {
  log = [];

  async run(item) {
    this.reserve(item);

    await this;

    return this.log.join(', ');
  }

  async reserve(item) {
    this.log = [...this.log, `reserve ${item}`];
    this.pay();
  }

  async pay() {
    this.log = [...this.log, 'pay'];
  }
}

const order = Order.new();

assert.equal(await order.run('a'), 'reserve a, pay');
assert.equal(order.then.status, 'idle');
assert.equal(order.then.runs, 1);

console.log('steps: run + await this ok');
