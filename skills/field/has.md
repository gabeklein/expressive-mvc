# `has` - Owned Collections

Runnable source: [`has`](https://expressive.dev/examples/instructions/has) and [`has-list`](https://expressive.dev/examples/instructions/has-list) - complete programs, served as HTML.

```ts
import State, { has } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';
```

> React apps import these from `@expressive/react` - the adapter re-exports every instruction. Examples below show the core import; do not add `@expressive/mvc` to a React app's `package.json`.

A reactive collection a state *has*: an ordered list of values, or a pool of members it spawns and owns. Reads subscribe in active `watch()` / `State.get()` effects; writes notify precisely.

A field instruction like `map()`, `set()`, and `ref()`: it resolves during activation of the hosting state, which adopts the collection in the same step. Not usable standalone. The field is read-only - assigning over it throws.

The argument selects the mode:

| call | interface | insert | identity |
| --- | --- | --- | --- |
| `has<T>()` / `has(values)` | `has.List<T>` | `push` / `put` / `set(index)` | position |
| `has(StateClass)` | `has.Create<T, A>` | `add(...args)` spawns, `add(instance)` admits | the value itself |
| `has(StateClass, fromKey)` | `has.From<T, V>` | `add(from)` spawns, `add(instance)` admits | the value itself |
| `has(factory)` | `has.Pool<T, A>` | `add(...args)` spawns | the value itself |

A list stores values you give it, in order, by index. A pool spawns its members - `add` returns the member, the call site holds the reference, and the value is its own identity for `has`, `delete`, and eviction. A class-mode pool also takes a ready-made instance.

## List

```ts
class Editor extends State {
  history = has<string>();

  record(entry: string) {
    this.history.push(entry);
  }
}
```

Positional: `get(index)` (negative counts from the end), `get(start, end)` ranges, `get(predicate)` first match, `set(index, value)` replacement, `put(index, ...values)` insertion, `pop(index?, count?)` removal, `push` append. Duplicates allowed.

Tracking: `get(index)` tracks that index, ranges their indices, `size` and iteration the length. Mid-list insert or removal notifies every shifted position plus length; replacing an index notifies it alone.

```ts
const { history } = Editor.new();

watch(history, ($) => {
  console.log($.get(-1)); // last entry
});

history.push('a'); // reruns - length changed re-resolves the index
```

## Pool

A `State` class or factory makes a pool - members it owns, addressed by identity, not position.

```ts
class Roster extends State {
  players = has(Player);

  join(id: string) {
    return this.players.add({ key: id });
  }
}
```

`add(...args)` forwards its arguments - to the class constructor exactly as `Type.new()` takes them, or as the factory's own parameters - and returns the member. With a `Component` class, identity `key` arrives this way before `new()` runs. In `@expressive/react` a pool of `Component` values renders directly - `<ul>{roster.players}</ul>` - through the facade; `[...roster.players]` is the manual alternative.

A factory takes any parameters:

```ts
class Board extends State {
  cells = has((at: string, color: string) => new Cell(at, color));
}

const cell = board.cells.add('a1', 'black');
```

A class-mode pool also admits a ready-made member: `add(value)` with a lone instance of the class (or a subclass) holds that value instead of constructing - one field both spawns and injects. Use it for a second pool over members of a first, or to hydrate from a fetch.

```ts
class Store extends State {
  items = has(Item);
  selected = has(Item);
}

store.items.add({ value: 1 });           // spawns - owned
store.items.add(new Item(fetched));      // injects fresh - owned
store.selected.add(item);                // holds an active member - guest
```

Only a lone argument is admitted; `add(a, b)` always constructs, so multi-argument constructors are unaffected. A factory pool never admits - its arguments are its own - so route instances through the factory body (`has((item?: Item) => item || new Item())`).

`has(value)` and `delete(value)` take the member itself. Adding a value already present is a no-op - no duplicate, no events. No positional surface: no `set`, `put`, `push`, or index reads; iteration yields members in insertion order.

### Argument key

A field name after the class assigns `add`'s argument to it - the common case, without a function.

```ts
class Roster extends State {
  players = has(Player, 'id');
}

const player = roster.players.add('abc');   // new Player({ id: 'abc' })
```

The key is a `State.Field<T>` (own field, not a base `State` member) and `add` takes its value type. One key only; more than one value is a factory.

### Declining to add

A factory returning `undefined` or `null` adds nothing, and `add` yields it back - so a factory decides *which* member, not just how to build one. Returning an existing instance makes `add` a lookup-or-create; a member already present is returned untouched.

```ts
const USERS = new Map<string, User>();

class Store extends State {
  active = has((id: string) => USERS.get(id) || new User({ id }));
  online = has((id: string) => USERS.get(id));
  messages = has((dto: MessageDto) =>
    dto.deleted ? undefined : new Message({ info: dto, id: dto.id })
  );
}

store.active.add('abc');         // known user, else spawns one
store.online.add('nope');        // undefined - nothing added
```

Members stay `T` - only `add`'s return widens - so reads never see the miss case.

### Seeding

A pool takes no initial argument: seed it imperatively from `new()`, which runs once the field has resolved. This single seam also covers conditional, ordered, and derived members a static initializer could not.

```ts
class Board extends State {
  columns = has(Column);

  protected new() {
    for (const column of LAYOUT) this.columns.add(column);
  }
}
```

### DTO boundary

Pools are for per-item UI state. A payload already matching the class's init needs no factory - `has(Message)`, then `add(dto)`: integration writes only keys the class declares, skips the rest, and a shared key with a clashing type is a TypeScript error. A factory is the transform case - fat payload folded to one field (DTO in), read back out at the boundary (DTO out); refill on fetch with `clear()` plus `add` per item:

```ts
class Inbox extends State {
  messages = has((dto: MessageDto) => new Message({ info: dto, id: dto.id }));

  get dtos() {
    return this.messages.map((m) => m.info);
  }

  async refresh() {
    const data = await api.list();
    this.messages.clear();
    for (const dto of data) this.messages.add(dto);
  }
}
```

Keep members small: promote a payload key to a reactive field only when views render it or it changes independently - the rest stays one subobject field (`info`). Normalize API `null` to `undefined` here so presence fields stay optional.

Refill destroys member identity - references, flags, and second-pool membership die with it. Selection surviving refresh is a durable key (`selectedId`) plus a re-find getter; references and flags fit pools stable between fetches.

## Ownership

Ownership follows freshness, not how the member arrived: a fresh (never-activated) `State` - instantiated by the pool, constructed by a factory, or admitted directly - is adopted and owned, and destroyed when deleted, cleared, or the owner dies. An already-activated value is a guest: held, never destroyed. Non-State members are never owned.

```ts
class Basket extends State {
  items = has((item?: Item) => item || new Item());
}

const mine = basket.items.add();          // new Item() - owned
basket.items.add(Item.new());             // already activated - guest
```

The hosting state adopts every collection at activation. Fresh `State` members are parented to the owner and activate inside its context: `get(Owner)` resolves directly, and providers above the owner resolve from members.

A `State` member that dies evicts itself - owned or guest - so a pool never serves destroyed members; adding one already destroyed throws. `member.set(null)` is a complete removal on its own. Lists do not adopt, destroy, or evict on death - they store values by position; use a pool (`has(Item)`) when members are owned `State`s.

Destruction is an eviction concern, separate from context, so `has.Pool` and `has.List` can be constructed without an owner (`new has.Pool(Item)`, chiefly for testing) - fresh members are still owned and destroyed on eviction, just not parented into a context.

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

Both modes share a read surface over iteration: `map(fn)` (optional `ignore` sentinel - matching results are skipped), `filter(fn)`, `any(fn)`, `all(fn)`, and `get(predicate)`. Callbacks receive `(value, index, self)`. Tracking follows the iterator: lists track length plus visited indices, pools shape plus visited members.

```ts
class Roster extends State {
  players = has(Player);

  get active() {
    return this.players.filter((p) => p.online);
  }
}

const names = roster.players.map((p) => p.name);
```

`get()` with no arguments returns a shallow snapshot array; nested values with a `.get()` method export through it, matching State snapshots.

Member fields read thru a subscribed context track deeply - a parent rendering `players.filter((p) => p.online)` re-renders when any visited member's `online` changes. A method call on a raw instance subscribes nothing: `page.importFor(id).progress` in a render never repaints. Per-row async status must be a tracked read - member field thru the pool, or the member's own `render()`. Never read solely to force tracking (`void x`) in a render - consume it, or move paint to the member.

## Type Signature

```ts
function has<T>(initial?: Iterable<T> | false | null): has.List<T>;
function has<T extends State>(Type: new (...args: State.Args<T>) => T): has.Create<T, State.Args<T>>;
function has<T extends State, K extends State.Field<T>>(
  Type: new (...args: State.Args<T>) => T,
  fromKey: K
): has.From<T, T[K]>;
function has<R, A extends unknown[]>(
  make: (...args: A) => R
): has.Pool<Exclude<R, null | undefined>, A, R>;

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

class has.Pool<T, A extends unknown[] = unknown[], R = T> {
  readonly size: number;
  add(...args: A): R;                          // constructor's or factory's own signature
  get(): State.Export<T>[];                    // snapshot
  get(predicate): T | undefined;
  has(value: T): boolean;
  delete(value: T): boolean;
  clear(): void;
  // map / filter / any / all / [Symbol.iterator]
}

interface has.Create<T, A extends unknown[]> extends has.Pool<T, A> {
  add(...args: A): T;                          // spawn
  add(instance: T): T;                         // admit
}

interface has.From<T, V> extends has.Create<T, [from: V]> {}
```

`has.List` and `has.Pool` are the runtime classes (`has.Create` and `has.From` type the class-mode pool) - mode is class identity (`instanceof` works; a list has no `add`, a pool no `push`, as natural TypeErrors). Adapters may extend their prototypes - the seam for rendering facades.

## Behavior

- Mode follows the argument: iterable/none is a list, any function (class or factory, any arity) a pool.
- List events are positional: `set(index)` notifies that index; `put`/`pop` notify shifted indices plus length.
- Pool events are by value: `add`/`delete` notify the member plus shape; `has(value)` tracks that member only.
- `add` is a no-op for a value already present, and for nullish from a factory - which it returns.
- Reactivity is shallow. Nested State, `map()`, and `has()` values keep their own reactivity when accessed through the collection.
