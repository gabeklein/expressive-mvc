import { listener } from "./observable";
import { event, Model, parent, uid } from "./state";

const HOME = new WeakMap<Model, Context>();
const HELD = new WeakMap<Model, Map<Model, [Set<() => void>, boolean?]>>();
const HOST = new WeakMap<Context, Model>();
const CLEANUP = new WeakMap<Context, Set<() => void>>();
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

  /** Get the context for a Model. Adapters may override to provide framework context. */
  static get(state?: Model): Context {
    return state && home(state.is) || Context.root;
  }

  public id = uid();
  public parent?: Context;
  public scope = new Set<Context>();
  public consume = new Map<
    Model.Extends,
    Set<[Expect, boolean | undefined]> | null
  >();
  public provide = new Map<Model.Extends, Set<[Model, boolean]> | null>();

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
    skip: Model,
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

  add(I: Model, explicit = false) {
    const { provide } = this;
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

    if (!HOME.has(I) && !parent(I)) HOME.set(I, this);

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
   * Remove all Models from this context.
   *
   * Will also run any cleanup callbacks registered when Models were added.
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

Object.defineProperty(Context.prototype, "toString", {
  value() {
    return `Context-${this.id}`;
  },
});

/**
 * Add `value` to the lookup origin of `state`. A context-less `state` holds
 * it instead - every context adding `state` later adds its held children too.
 */
function join(state: Model, value: Model, explicit?: boolean): () => void {
  const ctx = home(state.is);
  const held = HELD.get(state) || new Map();
  let provided = !ctx && held.get(value)?.[1];

  for (let at = ctx; at && !provided; at = at.parent) {
    const entries = at.provide.get(value.constructor as Model.Extends) || [];
    for (const [x, is] of entries) if (x === value && is) provided = true;
  }

  if (provided) return () => {};
  if (ctx) return ctx.add(value, explicit);

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

function home(state: Model): Context | undefined {
  const owner = parent(state);
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

export { Context, host, join };
