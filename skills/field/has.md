# `has` - Owned Collections

```ts
import State, { has, watch } from '@expressive/mvc';
```

Declares a reactive collection a state *has*: an ordered list of values, or a pool of members it spawns and owns. Reads register subscriptions in active `watch()` / `State.get()` effects; writes notify precisely.

`has()` is a field instruction like `map()`, `set()`, and `ref()`: it resolves during activation of the hosting state, which adopts the collection in the same step. It is not usable standalone. The field is read-only - assigning over it throws.

The argument selects the mode:

| call | interface | insert | identity |
| --- | --- | --- | --- |
| `has<T>()` / `has(values)` | `has.List<T>` | `push` / `put` / `set(index)` | position |
| `has(StateClass)` / `has(factory)` | `has.Pool<T, A>` | `add(...args)` spawns | the value itself |

A list stores values you give it, in order, addressed by index. A pool admits values only by spawning them - `add` returns the member, the call site holds the reference, and the value is its own identity for `has`, `delete`, and eviction.

## List

```ts
class Editor extends State {
  history = has<string>();

  record(entry: string) {
    this.history.push(entry);
  }
}
```

Lists are positional: `get(index)` (negative indices count from the end), `get(start, end)` ranges, `set(index, value)` replacement, `put(index, ...values)` insertion, `pop(index?, count?)` removal, `push` append. Duplicates are allowed. `get(predicate)` returns the first match.

Reads track precisely: `get(index)` tracks that index only, ranges track their indices, `size` and iteration track length. Inserting or removing mid-list notifies every shifted position plus length; replacing one index notifies that index alone.

```ts
const { history } = Editor.new();

watch(history, ($) => {
  console.log($.get(-1)); // last entry
});

history.push('a'); // reruns - length changed re-resolves the index
```

## Pool

A `State` class or factory makes a pool: an owned collection of members that exist only by being spawned through it.

```ts
class Roster extends State {
  players = has(Player);

  join(id: string) {
    return this.players.add({ key: id });
  }
}
```

`add(...args)` forwards its arguments - to the class constructor exactly as `Type.new()` accepts them, or as the factory's own parameters - and returns the member. With a `Component` class, identity `key` arrives this way before the `new()` lifecycle hook runs. A pool of `Component` values renders directly: `<>{[...roster.players]}</>`.

```ts
class Board extends State {
  cells = has((at: string, color: string) => new Cell(at, color));
}

const cell = board.cells.add('a1', 'black');
```

Guests are the factory's decision, not the pool's: a factory that passes a supplied value through admits it as a guest, and ownership follows provenance - what the factory *made* is owned, what it passed through is not.

```ts
class Basket extends State {
  items = has((item?: Item) => item || new Item());
}

const mine = basket.items.add();         // spawned - owned
basket.items.add(existing);              // passed through - guest
```

`has(value)` and `delete(value)` take the member itself. Adding a value already present is a no-op - no duplicate, no events. There is no positional surface: no `set`, `put`, `push`, or index reads; iteration yields members in insertion order.

## Ownership

Pools own what they spawn: deleting or clearing a spawned `State` member destroys it, and owned members are destroyed with their owner. This includes activated values the factory made (`() => Item.new()`); a passed-through value stays a guest and is never destroyed by the pool. Non-State spawned values are simply dropped.

Every collection is adopted by its hosting state at activation. Fresh (never-activated) `State` members are parented to the owner and activate inside its context: `get(Owner)` resolves directly and providers above the owner resolve from members.

Death also flows the other way: a `State` member that dies evicts itself from the pool - owned or guest - so a pool never serves destroyed members. Destroying a member (`member.set(null)`) is a complete removal gesture on its own. Lists do not adopt or destroy - they store what you give them.

```ts
class Member extends State {
  owner = get(Owner);
}

class Owner extends State {
  members = has(Member);
}

const owner = Owner.new();
const member = owner.members.add(); // member.owner === owner

owner.set(null);                    // member destroyed with owner
```

## Reads

Both modes share a read surface built over iteration: `map(fn)` (with an optional `ignore` sentinel - results matching it are skipped), `filter(fn)`, `any(fn)`, `all(fn)`, and `get(predicate)`. Callbacks receive `(value, index, self)`. Tracking follows the iterator: lists track length plus visited indices, pools track shape plus visited members.

```ts
class Roster extends State {
  players = has(Player);

  get active() {
    return this.players.filter((p) => p.online);
  }
}

const names = roster.players.map((p) => p.name);
```

Calling `get()` with no arguments returns a shallow snapshot array; nested values with a `.get()` method are exported through it, matching State snapshots.

## Type Signature

```ts
function has<T>(initial?: Iterable<T> | null): has.List<T>;
function has<T extends State>(Type: new (...args: State.Args<T>) => T): has.Pool<T, State.Args<T>>;
function has<T, A extends unknown[]>(make: (...args: A) => T): has.Pool<T, A>;

class has.List<T> {
  readonly size: number;
  get(): State.Export<T>[];                    // snapshot
  get(index: number): T | undefined;           // negative counts from end
  get(start: number, end: number): T[];
  get(predicate): T | undefined;
  set(index: number, value: T): void;
  put(index: number, ...values: T[]): void;
  push(...values: T[]): number;
  pop(index?: number, count?: number): T | T[] | undefined;
  clear(): void;
  // map / filter / any / all / [Symbol.iterator]
}

class has.Pool<T, A extends unknown[] = unknown[]> {
  readonly size: number;
  add(...args: A): T;                          // the constructor's or factory's own signature
  get(): State.Export<T>[];                    // snapshot
  get(predicate): T | undefined;
  has(value: T): boolean;
  delete(value: T): boolean;
  clear(): void;
  // map / filter / any / all / [Symbol.iterator]
}
```

`has.List` and `has.Pool` are the runtime classes - mode is class identity (`instanceof` works; a list has no `add`, a pool no `push`, as natural TypeErrors). Adapters may extend their prototypes - this is the seam for rendering facades.

## Behavior

- Mode follows the argument: iterable/none is a list, any function (class or factory, any arity) is a pool.
- List events are positional: `set(index)` notifies that index; `put`/`pop` notify shifted indices plus length.
- Pool events are by value: `add`/`delete` notify the member plus shape; `has(value)` tracks that member only.
- Repeat `add` of a value already present is a no-op.
- `get()` with no arguments returns a snapshot array in both modes.
- Reactivity is shallow. Nested State, `hot()`, and `map()` values keep their own reactivity when accessed through the collection.
