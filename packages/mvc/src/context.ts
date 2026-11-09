import { event as signal, listener, Observer, touch } from "./observable";
import { event, Model, observed, parent, uid } from "./model";

const CONTEXT = Symbol("context");
const STACK: [Context, Model][] = [];
const HOME = new WeakMap<Model, Context>();
const HELD = new WeakMap<Model, Map<Model, [Set<() => void>, boolean?]>>();
const HOST = new WeakMap<Context, Model>();
const CLEANUP = new WeakMap<Context, Set<() => void>>();
const DONE = new WeakMap<[Model, boolean], Set<() => void>>();
let ROOT: Context;

type Accept<T extends Model = Model> =
  | T
  | Model.Type<T>
  | Record<string | number, T | Model.Type<T>>;

type Expect<T extends Model = Model> = (
  state: T,
  downstream: boolean,
) => (() => void) | void;

declare namespace Context {
  export { Accept, Expect };
}

/**
 * Registry through which Models find each other - lookups walk up through parents.
 *
 * Every instance has a home context its `get(Type)` lookups start from - its owner's, else the first
 * context to claim it, else root.
 *
 * @example
 * const context = new Context({ Session, Theme });
 * const page = context.push(Page, () => log('closed'));
 *
 * page.get(Session);
 * page.pop();
 */
class Context {
  /**
   * The process-wide context, created on first read.
   *
   * An instance without a home reads from it but is not registered there - `root.add()` or a
   * `.new(Context.root)` argument registers one. Entries are shared across server requests.
   */
  static get root(): Context {
    return ROOT ??= new Context();
  }

  /**
   * The current context - set by `state.get(Type)` or the `get` instruction while they resolve.
   *
   * Elsewhere the host's `resolver` decides - root without a host; a rendering host returns its own.
   */
  static get(): Context;

  /** Home context of `state` - its own, else its owner's, else root. */
  static get(state: Model): Context;

  /**
   * Resolve a static `get` of `Type` by running `compute` against the current context.
   *
   * Inside `state.get(Type)` or the `get` instruction, `from` is that Model; from a tracking proxy,
   * `compute` gets a tracked view of the context and a returned Model is tracked through it. Elsewhere
   * the host's `resolver` runs `compute` and its return is what the caller gets.
   *
   * @param Type - Class `get` was called on.
   * @param compute - Resolves the value from a context.
   */
  static get<R>(
    Type: Model.Extends,
    compute: (context: Context, from?: Model) => R,
  ): R;

  static get(
    arg?: Model | Model.Extends,
    compute: (context: Context, from?: Model) => unknown = (context) => context,
  ): unknown {
    if (!arg || typeof arg == "function") {
      const top = STACK[STACK.length - 1];

      if (!top) return current(arg, compute);

      const [context, from] = top;
      const view = arg ? touch(from, CONTEXT, context) : context;

      return observed(from, arg, compute(view, from.is));
    }

    return home(arg.is) || Context.root;
  }

  /** Unique id - `String(context)` is `Context-<id>`. */
  public id = uid();
  /** Context this was pushed from - none for a root or standalone context. */
  public parent?: Context;
  /** Child contexts pushed from this one, not yet popped. */
  public scope = new Set<Context>();
  public consume = new Map<
    Model.Extends,
    Set<[Expect, boolean | undefined]> | null
  >();
  public provide = new Map<Model.Extends, Set<[Model, boolean]> | null>();

  /**
   * Create a context - a child of a given context, or a new tree registering the given Models.
   *
   * A class is constructed, owned and destroyed when the context pops; an instance is adopted, not
   * destroyed. All are registered explicitly before any activates. Throws for anything but a Model
   * class or instance, and for base `Model`.
   */
  constructor(arg?: Context | Accept) {
    CLEANUP.set(this, new Set());

    if (arg instanceof Context) {
      this.parent = arg;
      arg.scope.add(this);
    } else if (arg) {
      insert(this, arg);
    }
  }

  private traverse(accept: (ctx: Context) => boolean | void) {
    const queue = [...this.scope];
    for (const ctx of queue)
      if (accept(ctx) !== false) for (const c of ctx.scope) queue.push(c);
  }

  private register<T extends Model>(
    type: Model.Extends<T>,
    value: [Expect<T>, boolean | undefined],
    asConsumer: true,
  ): () => void;

  private register<T extends Model>(
    type: Model.Extends<T>,
    value: [T, boolean],
    asConsumer?: false,
  ): () => void;

  private register(type: Model.Extends, value: any, asConsumer?: boolean) {
    const mode = asConsumer ? "consume" : "provide";
    let set = this[mode].get(type) as Set<any>;
    if (!set) this[mode].set(type, (set = new Set()));
    set.add(value);

    for (let ctx = this.parent; ctx; ctx = ctx.parent) {
      if (ctx[mode].has(type)) break;
      ctx[mode].set(type, null);
    }

    return () => set.delete(value);
  }

  /**
   * Find an instance of `Type` here or in the nearest parent which has one - throws if none.
   *
   * Matches subclasses. Returns `null` where several implicit entries match (ambiguous) - even when
   * required. Throws when several explicit entries match.
   */
  public get<T extends Model>(Type: Model.Extends<T>, required?: true): T;

  /**
   * Find an instance of `Type` here or in the nearest parent which has one.
   *
   * `required: false` returns `undefined` when none is found; `null` where it is ambiguous.
   */
  public get<T extends Model>(
    Type: Model.Extends<T>,
    required?: boolean,
  ): T | undefined;

  /**
   * Call `callback` for each instance of `Type` available - upstream, downstream, or both.
   *
   * `downstream` - omitted for both, `true` for child contexts only, `false` for this and its parents.
   * The callback gets the instance and a downstream flag. Instances present now are passed at once,
   * one added later once ready - a function returned runs when that instance is removed. Returns a
   * function to stop.
   *
   * @example
   * const context = Context.get(this);
   * const stop = context.get(Panel, (panel) => {
   *   panels.add(panel);
   *   return () => panels.delete(panel);
   * }, true);
   */
  public get<T extends Model>(
    Type: Model.Extends<T>,
    callback: Expect<T>,
    downstream?: boolean,
  ): () => void;

  /** Lookup excluding a specific instance (used by Model.prototype.get for upstream-of-self semantics). */
  public get<T extends Model>(
    Type: Model.Extends<T>,
    arg: boolean | Expect<T> | undefined,
    downstream: boolean | undefined,
    skip?: Model,
  ): T | undefined | (() => void);

  public get<T extends Model>(
    Type: Model.Extends<T>,
    arg?: boolean | Expect<T>,
    downstream?: boolean,
    skip?: Model,
  ) {
    let found: T | null | undefined;
    let entry: [Model, boolean] | undefined;
    let priority = false;

    for (let ctx: Context | undefined = this; ctx; ctx = above(ctx)) {
      touch(ctx, Type);
      const entries = ctx.provide.get(Type);
      if (!entries) continue;

      for (const next of entries) {
        const [state, explicit] = next;

        if (state === skip || found === state) continue;

        if (explicit) {
          if (priority)
            throw new Error(
              `Did find ${Type} in context, but multiple were defined.`,
            );

          found = state as T;
          entry = next;
          priority = true;
        } else if (!priority) {
          found = found === undefined ? (state as T) : null;
          entry = next;
        }
      }
      if (found !== undefined) break;
    }

    if (typeof arg === "function") {
      const call = (entry: [Model, boolean], downstream: boolean) => {
        const done = arg(entry[0] as T, downstream);
        if (done) DONE.get(entry)!.add(done);
      };

      if (found && !downstream) call(entry!, false);

      if (downstream !== false) {
        this.traverse((ctx) => {
          const has = ctx.provide.get(Type);
          if (has) for (const x of has) if (x[0] !== skip) call(x, true);
          return has !== undefined;
        });
      }

      return this.register(Type, [arg as Expect, downstream], true);
    }

    if (found) return found;
    if (found === null) return null;
    if (arg !== false) throw new Error(`Could not find ${Type} in context.`);
  }

  /**
   * Register an instance under its class and every superclass up to `Model` - returns a remover.
   *
   * `explicit` - outranks implicit entries of a type; two explicit ones throw on lookup.
   * Implicit is how owned children register. Does not activate the instance. Becomes its home when it
   * has none - an owned one only when explicit and its owner has no home. Subscribers waiting on the
   * type are called once it is ready.
   */
  add(I: Model, explicit = false) {
    const TT: Model.Extends[] = [];

    for (
      let T = I.constructor as Model.Extends;
      T !== Model;
      T = Object.getPrototypeOf(T)
    )
      TT.push(T);

    const expects = new Map<Expect, () => void>();
    const onDone = new Set<() => void>();
    const entry: [Model, boolean] = [I, explicit];

    DONE.set(entry, onDone);

    for (const T of TT) {
      onDone.add(this.register(T, entry));
      onDone.add(() => emit(this, T));
      emit(this, T);
    }

    function queue(ctx: Context, downstream: boolean, same?: boolean) {
      let found = false;
      for (const T of TT) {
        const list = ctx.consume.get(T);
        if (list !== undefined) found = true;
        if (list)
          for (const [cb, filter] of list)
            if (same || filter == null || filter === downstream)
              expects.set(cb, () => {
                const r = cb(I, filter ?? downstream);
                if (r) onDone.add(r);
              });
      }
      return found;
    }

    queue(this, true, true);
    for (let ctx = this.parent; ctx; ctx = ctx.parent) queue(ctx, true);
    this.traverse((ctx) => queue(ctx, false));

    const owner = parent(I);
    const placed = explicit && !(owner && home(owner));

    if (!HOME.has(I) && (!owner || placed)) HOME.set(I, this);

    listener(I, () => {
      expects.forEach((f) => f());
      expects.clear();
      return null;
    });

    function flush() {
      onDone.forEach((r) => r());
      onDone.clear();
    }

    const cleanup = CLEANUP.get(this)!;
    const held = Array.from(HELD.get(I) || [], ([child, [added, explicit]]) => {
      const done = this.add(child, explicit);
      added.add(done);
      return () => {
        if (added.delete(done)) done();
      };
    });

    function remove() {
      cleanup.delete(remove);
      held.forEach((done) => done());
      flush();
    }

    cleanup.add(remove);

    return remove;
  }

  /**
   * Create a child context, optionally registering Models to it.
   *
   * @param input Model instance to adopt, Model class to create - and destroy when the context pops - or an object of them, all registered before any activates.
   * @param cleanup Called once when the context pops, before its Models are removed.
   */
  public push(input?: Accept, cleanup?: () => void) {
    const next = new Context(this);

    if (cleanup) CLEANUP.get(next)!.add(cleanup);
    if (input) insert(next, input);

    return next;
  }

  /**
   * Close this context and its descendants - entries removed, created Models destroyed.
   *
   * Child contexts pop first. `push` cleanups run before entries are removed. Adopted instances
   * survive; their home is unchanged.
   */
  public pop() {
    this.scope.forEach((x) => x.pop());
    this.scope.clear();
    const cleanup = CLEANUP.get(this)!;
    cleanup.forEach((cb) => cb());
    cleanup.clear();
    this.consume.clear();
    this.provide.clear();
    if (this.parent) {
      this.parent.scope.delete(this);
    }
  }
}

Object.defineProperties(Context.prototype, {
  toString: {
    value() {
      return `Context-${this.id}`;
    },
  },
  [Observer]: {
    get(this: Context) {
      Object.defineProperty(this, Observer, { writable: true });
      signal(this);
      return (this as any)[Observer];
    },
  },
});

function emit(ctx: Context, T: Model.Extends) {
  if (Object.getOwnPropertyDescriptor(ctx, Observer)) signal(ctx, T as any);
}

type Resolve = (
  Type: Model.Extends | undefined,
  compute: (context: Context) => unknown,
) => unknown;

let current: Resolve = (_Type, compute) => compute(Context.root);

/**
 * Install how a host runs `compute` for a `Context.get` outside any origin -
 * `Type` is undefined for bare `Context.get()`. Its return value is what the
 * caller receives, so a host may track or wrap it. Returns the previous
 * resolver, for the host to call where it is not rendering.
 */
function resolver(next: Resolve): Resolve {
  const previous = current;
  current = next;
  return previous;
}

/**
 * Run `fn` with the context of `origin` current, and `origin` as origin of
 * any `get` resolved within. Nests.
 */
function within<R>(origin: Model, fn: () => R): R {
  STACK.push([Context.get(origin), origin]);

  try {
    return fn();
  } finally {
    STACK.pop();
  }
}

/**
 * Add `value` to the lookup origin of `state`. A context-less `state` holds
 * it instead - every context adding `state` later adds its held children too.
 */
function join(state: Model, value: Model, explicit?: boolean): () => void {
  const ctx = home(state.is);
  const none = () => {};

  if (ctx) {
    for (let at: Context | undefined = ctx; at; at = at.parent)
      for (const [x, is] of at.provide.get(value.constructor as Model.Extends) || [])
        if (x === value && is) return none;

    return ctx.add(value, explicit);
  }

  const held = HELD.get(state) || new Map<Model, [Set<() => void>, boolean?]>();

  if (held.get(value)?.[1]) return none;

  const added = new Set<() => void>();

  HELD.set(state, held.set(value, [added, explicit]));

  return () => {
    held.delete(value);
    added.forEach((done) => {
      added.delete(done);
      done();
    });
  };
}

function above(ctx: Context) {
  return ctx.parent && touch(ctx, "parent", ctx.parent);
}

/** Home context of `state` - its own, else its owner's. */
function home(state: Model): Context | undefined;
/** Set home context for state. Noop and returns false if has one. */
function home(state: Model, context: Context): boolean;
function home(state: Model, context?: Context): Context | boolean | undefined {
  const owner = parent(state);

  if (context) {
    if (owner || HOME.has(state)) return false;

    listener(state, context.add(state, true), null);
    return true;
  }

  return HOME.get(state) || (owner ? home(owner) : undefined);
}

/** The Model a host mounted `state` under - the one its nearest enclosing context was set up for. */
function host(state: Model) {
  for (let ctx = home(state); ctx; ctx = ctx.parent) {
    const found = HOST.get(ctx);
    if (found && found !== state) return found;
  }
}

function insert(into: Context, input: Accept) {
  const single = typeof input == "function" || input instanceof Model;
  const entries = Object.entries(single ? { input } : input);
  const init: Model[] = [];
  const owns: Model[] = [];

  for (const [K, V] of entries) {
    const owned = Model.is(V);

    if (!(owned || V instanceof Model)) {
      const as = single || K == String(V) ? V : `${V} (as '${K}')`;
      throw new Error(
        `Context can only include an instance or class of Model but got ${as}.`,
      );
    }

    const state = owned ? new V() : V.is;

    into.add(state, true);
    init.push(state);

    if (single) HOST.set(into, state);
    if (owned) owns.push(state);
  }

  const cleanup = CLEANUP.get(into)!;

  for (const state of owns) cleanup.add(() => event(state, null));
  for (const state of init) event(state);
}

export { Context, home, host, join, resolver, within };
