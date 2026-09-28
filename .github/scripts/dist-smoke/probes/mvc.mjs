import assert from 'node:assert/strict';
import State from '@expressive/mvc';

class Store extends State {
  count = 0;
  get double() { return this.count * 2 }
}

const store = Store.new();
const seen = [];

store.get(({ count }) => { seen.push(count) });

store.count = 2;

const update = await store.set();

assert.deepEqual(update, ['count']);
assert.equal(store.double, 4);
assert.deepEqual(seen, [0, 2]);

store.set(null);

console.log('mvc: State round-trip ok');
