# `hot` - Reactive Arrays & Objects

```ts
import State, { hot, watch } from '@expressive/mvc';
```

Wraps an array or object in keyed reactivity. Reads register subscriptions in active `watch()` / `State.get()` effects, and writes notify only the keys that changed.

`hot()` is not a field instruction like `set()`, `get()`, `ref()`, or `def()`. It returns a reactive value that can be assigned directly to a State field or used outside State with `watch()`.

## Usage

### Reactive Array

```ts
class Game extends State {
  board = hot(Array(9).fill(''));

  play(index: number) {
    this.board[index] = 'X';
  }
}

const game = Game.new();

game.get(($) => {
  console.log($.board[0]);
});

game.board[0] = 'X'; // reruns the effect
game.board[5] = 'O'; // does not rerun an effect that only read index 0
```

Array reads track the accessed index or `length`. Native array methods keep their normal behavior, so methods like `slice()`, `find()`, and `some()` subscribe to the indices they actually read.

```ts
const items = hot(['a', 'b', 'c', 'd']);

watch(items, ($) => {
  $.slice(0, 2); // tracks length, index 0, and index 1
});

items[3] = 'x'; // does not notify the slice effect
items[1] = 'x'; // notifies the slice effect
```

### Reactive Object

```ts
class Form extends State {
  values = hot({
    name: '',
    email: ''
  });
}

const form = Form.new();

form.get(($) => {
  console.log($.values.email);
});

form.values.email = 'a@example.com'; // reruns the effect
form.values.name = 'Ada'; // does not rerun an effect that only read email
```

Object reads track individual property keys. Adding or deleting a property notifies effects that already read that key.

## Dense Array Contract

`hot()` arrays must be dense. Sparse arrays are rejected on creation, and operations that would create holes throw.

```ts
hot(Array(3)); // throws
hot([1, , 3]); // throws

const items = hot(['a', 'b']);

items[2] = 'c'; // ok: appends the next index
items[4] = 'e'; // throws: creates holes at 2 and 3
items.length = 5; // throws: creates holes
delete items[0]; // throws: creates a hole
```

Use `undefined` or `null` as an intentional empty value. Use `splice()` to remove entries.

```ts
items[0] = undefined; // ok
items.splice(0, 1); // ok
```

Length truncation is allowed because it removes entries without creating holes.

```ts
const items = hot(['a', 'b', 'c']);

items.length = 1; // ok, notifies length and removed index subscribers
```

## Nesting

`hot()` is shallow. It does not recursively wrap nested arrays or objects.

```ts
const model = hot({
  nested: { value: 1 }
});

model.nested.value = 2; // not reactive by itself
```

Use child State instances or separate `hot()` calls for nested reactivity.

```ts
class Cell extends State {
  value = '';
}

class Game extends State {
  cells = hot([Cell.new()]);
  options = hot({
    active: hot({ value: true })
  });
}
```

Nested State instances and nested `hot()` values keep their own reactivity when accessed through a parent hot collection.

## Snapshots

Hot values are included in State snapshots as frozen shallow copies.

```ts
class Model extends State {
  list = hot([1, 2, 3]);
  object = hot({ a: 1 });
}

const model = Model.new();
const snapshot = model.get();

snapshot.list; // readonly [1, 2, 3]
snapshot.object; // readonly { a: 1 }
```

Mutating the original input value outside the returned hot proxy bypasses reactivity, because storage is shared with the input.

```ts
const source = [1, 2, 3];
const list = hot(source);

source[0] = 99; // changes storage, but dispatches no event
list[0] = 100; // changes storage and dispatches
```

## Type Signatures

```ts
function hot<T>(value: T[]): T[];
function hot<T extends object>(value: T): T;
```

## Behavior

- Only arrays and objects are accepted.
- Array index reads, `length` reads, and normal method reads are tracked through native array behavior.
- Array writes notify changed indices; appends also notify `length`.
- Array `push`, `unshift`, `pop`, `shift`, `splice`, `sort`, and `reverse` work through native methods and notify the affected keys.
- Array holes are not allowed; use placeholders or `splice()`.
- Object property reads and writes are tracked by property key.
- Object key enumeration (`Object.keys`/`values`/`entries`, spread, `for...in`) is shape-reactive: key add and delete re-run the effect, while writes to existing keys stay tracked per key.
- Symbol keys and function values are passed through without keyed tracking.
- Nested arrays and objects are not wrapped recursively.
