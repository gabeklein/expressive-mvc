import { listener } from "./observable";
import { event, Model, observed, uid } from "./state";

const STACK: [Context, Model?][] = [];
const LOOKUP = new WeakMap<Model, Context>();
const HELD = new WeakMap<Model, Map<Model, Set<() => void>>>();
const HOST = new WeakMap<Context, Model>();
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

class Context {
  static get root(): Context {
    return ROOT ??= new Context();
  }

  /** Innermost context set by {@link Context.set}, if any. */
  static get current(): Context | undefined {
    return STACK[STACK.length - 1]?.[0];
  }

  /** Current context - innermost set by {@link Context.set}, otherwise root. Hosts may return their own while rendering. */
  static get(): Context;

  /** Get the context a Model was added to - root if none. */
  static get(state: Model): Context;

  /**
   * Resolve a static `get` of `Type` by running `compute` against the current
   * context. Within {@link Context.set} for a Model, `from` is that Model and a
   * returned Model is tracked through it; otherwise hosts may run `compute`
   * against their own context and track the result.
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
    compute?: (context: Context, from?: Model) => unknown,
  ): unknown {
    if (arg && typeof arg != "function") return LOOKUP.get(arg.is) || Context.root;

    const [context = Context.root, from] = STACK[STACK.length - 1] || [];

    if (!compute) return context;

    return from ? observed(from, arg, compute(context, from.is)) : compute(context);
  }

  /**
   * Run `fn` with `target` as current context - for a Model, its context, with
   * the Model as origin of any `get` resolved within. Nests.
   *
   * @returns Whatever `fn` returns.
   */
  static set<R>(target: Model | Context, fn: () => R): R {
    STACK.push(target instanceof Context ? [target] : [Context.get(target), target]);

    try {
      return fn();
    } finally {
      STACK.pop();
    }
  }

  public id = uid();
  public parent?: Context;
  public scope = new Set<Context>();
  public consume = new Map<
    Model.Extends,
    Set<[Expect, boolean | undefined]> | null
  >();
  public provide = new Map<Model.Extends, Set<[Model, boolean]> | null>();

  protected inputs: Record<string | number, Model | Model.Extends> = {};

  private cleanup = new Map<string | number | Function, () => void>();

  constructor(arg?: Context | Accept) {
    if (arg instanceof Context) {
      this.parent = arg;
      arg.scope.add(this);
    } else if (arg) {
      this.set(arg);
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

  /** Find specified type upstream. Throws if not found. */
  public get<T extends Model>(Type: Model.Extends<T>, required?: true): T;

  /** Find specified type upstream. Returns undefined if not found. */
  public get<T extends Model>(
    Type: Model.Extends<T>,
    required?: boolean,
  ): T | undefined;

  /** Subscribe to a type becoming available in context. */
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
    let priority = false;

    for (let ctx: Context | undefined = this; ctx; ctx = ctx.parent) {
      const entries = ctx.provide.get(Type);
      if (!entries) continue;

      for (const [state, explicit] of entries) {
        if (state === skip || found === state) continue;
        if (!found || (explicit && !priority)) {
          found = state as T;
          priority = explicit;
          continue;
        }
        if (!priority) {
          found = null;
          break;
        }
        if (explicit)
          throw new Error(
            `Did find ${Type} in context, but multiple were defined.`,
          );
      }
      if (found !== undefined) break;
    }

    if (typeof arg === "function") {
      if (found && !downstream) arg(found, false);

      if (downstream !== false) {
        this.traverse((ctx) => {
          const has = ctx.provide.get(Type);
          if (has) for (const x of has) if (x[0] !== skip) arg(x[0] as T, true);
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
   * Register one or more Models to this context.
   *
   * Context will add or remove Models as needed to keep with provided input.
   *
   * @param inputs Model, Model class, or map of Models / Model classes to register.
   * @param forEach Optional callback to run for each Model registered. Receives
   *   whether this context created the Model - and so will destroy it - as
   *   opposed to it having been provided already active. May return a callback
   *   to run before that entry is dropped.
   */
  public set<T extends Model>(
    inputs: Accept<T>,
    forEach?: (state: T, owned: boolean) => (() => void) | void,
  ) {
    const init = new Set<() => void>();
    const { cleanup } = this;

    const single = typeof inputs == "function" || inputs instanceof Model;

    if (typeof inputs == "function" || inputs instanceof Model)
      inputs = { [0]: inputs };

    for (const K of Object.keys({ ...this.inputs, ...inputs })) {
      const V = inputs[K];
      const E = this.inputs[K];

      if (E === V) continue;

      if (E) {
        cleanup.get(K)?.();
        cleanup.delete(K);
      }

      if (!V) continue;

      // a class is constructed here - and so destroyed here; an instance is
      // adopted as-is and outlives this context
      const owned = Model.is(V);

      if (!(owned || V instanceof Model)) {
        const as = K == "0" || K == String(V) ? V : `${V} (as '${K}')`;
        throw new Error(
          `Context can only include an instance or class of Model but got ${as}.`,
        );
      }

      const state = owned ? new (V as Model.Type)() : V.is;
      const remove = this.add(state, true);

      if (single && this !== ROOT) HOST.set(this, state);

      init.add(() => {
        event(state);
        const dispose = forEach?.(state as T, owned);
        cleanup.set(K, () => {
          if (typeof dispose == "function") dispose();
          remove();
          if (owned) event(state, null);
        });
      });
    }

    for (const i of init) i();

    this.inputs = inputs;

    return this;
  }

  add(I: Model, explicit = false) {
    const { cleanup, provide } = this;
    const root = this === Context.root;
    const TT: Model.Extends[] = [];

    function conflict(T: Model.Extends) {
      const entries = provide.get(T);
      if (entries)
        for (const entry of entries)
          if (!entry[1] && entry[0] !== I) return entries.delete(entry);
    }

    for (
      let T = I.constructor as Model.Extends;
      T !== Model;
      T = Object.getPrototypeOf(T)
    )
      if (explicit || !root || !conflict(T)) TT.push(T);

    const expects = new Map<Expect, () => void>();
    const onDone = new Set<() => void>();

    for (const T of TT) onDone.add(this.register(T, [I, explicit]));

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

    if (!LOOKUP.has(I)) LOOKUP.set(I, this);

    listener(I, () => {
      expects.forEach((f) => f());
      expects.clear();
      return null;
    });

    function flush() {
      onDone.forEach((r) => r());
      onDone.clear();
    }

    const held = Array.from(HELD.get(I) || [], ([child, added]) => {
      const done = this.add(child);
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

    cleanup.set(remove, remove);

    return remove;
  }

  /**
   * Create a child context, optionally registering one or more Models to it.
   *
   * @param inputs Model, Model class, or map of Models / Model classes to register.
   */
  public push(inputs?: Accept) {
    const next = new Context(this);
    if (inputs) next.set(inputs);
    return next;
  }

  /**
   * Remove all Models from this context.
   *
   * Will also run any cleanup callbacks registered when Models were added.
   */
  public pop() {
    this.inputs = {};
    this.scope.forEach((x) => x.pop());
    this.scope.clear();
    this.cleanup.forEach((cb) => cb());
    this.cleanup.clear();
    this.consume.clear();
    this.provide.clear();
    if (this.parent) {
      this.parent.scope.delete(this);
    }
  }
}

Object.defineProperty(Context.prototype, "toString", {
  value() {
    return `Context-${this.id}`;
  },
});

/**
 * Add `value` to the context `state` was added to. A context-less `state` holds
 * it instead - every context adding `state` later adds its held children too.
 */
function join(state: Model, value: Model): () => void {
  const ctx = LOOKUP.get(state.is);

  if (ctx) return ctx.add(value);

  const held = HELD.get(state) || new Map();
  const added = new Set<() => void>();

  HELD.set(state, held.set(value, added));

  return () => {
    held.delete(value);
    added.forEach((done) => {
      added.delete(done);
      done();
    });
  };
}

/** The Model a host mounted `state` under - the one its nearest enclosing context was set up for. */
function host(state: Model) {
  for (let ctx = LOOKUP.get(state); ctx; ctx = ctx.parent) {
    const found = HOST.get(ctx);
    if (found && found !== state) return found;
  }
}

export { Context, host, join };
