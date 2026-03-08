import { listener } from './observable';
import { event, PARENT, State } from './state';

/** Context registry: maps context node → type → entries. */
const REGISTRY = new WeakMap<State, Map<State.Extends, [State, boolean][]>>();

/** Context listeners: maps context node → type → subscriber callbacks. */
const CTX_LISTENERS = new WeakMap<
  State,
  Map<State.Extends, Set<Context.Expect>>
>();

/** Context children: maps context node → child context nodes. */
const CHILDREN = new WeakMap<State, Set<State>>();

/** Context cleanup: maps context node → cleanup callbacks. */
const CTX_CLEANUP = new WeakMap<
  State,
  Map<string | number | Function, () => void>
>();

/** Context inputs: maps context node → current input record. */
const INPUTS = new WeakMap<
  State,
  Record<string | number, State | State.Extends>
>();

/** Maps a State to its owning Context (or pending callbacks). */
const LOOKUP = new WeakMap<State, Context | ((got: Context) => void)[]>();

// --- Context -
declare namespace Context {
  type Accept<T extends State = State> =
    | T
    | State.Type<T>
    | Record<string | number, T | State.Type<T>>;

  type Expect<T extends State = State> = (
    state: T,
    child: boolean,
    existing: boolean
  ) => (() => void) | false | void;
}

class Context extends State {
  static root: Context;

  constructor(arg?: Context | Context.Accept) {
    super();
    REGISTRY.set(this, new Map());
    CTX_CLEANUP.set(this, new Map());
    LOOKUP.set(this, this);

    if (arg instanceof Context) {
      PARENT.set(this, arg);
      let children = CHILDREN.get(arg);
      if (!children) CHILDREN.set(arg, (children = new Set()));
      children.add(this);
    }

    event(this);

    if (arg && !(arg instanceof Context)) this.use(arg);
  }

  public use<T extends State>(
    inputs: Context.Accept<T>,
    forEach?: Context.Expect<T>
  ) {
    const cleanup = CTX_CLEANUP.get(this)!;
    const prevInputs = INPUTS.get(this) || {};
    const init = new Set<State>();

    if (typeof inputs == 'function' || inputs instanceof State)
      inputs = { [0]: inputs };

    for (const K of Object.keys({ ...prevInputs, ...inputs })) {
      const V = (inputs as any)[K];
      const E = prevInputs[K];

      if (E === V) continue;

      if (E) {
        cleanup.get(K)?.();
        cleanup.delete(K);
      }

      if (!V) continue;

      if (!(State.is(V) || V instanceof State))
        throw new Error(
          `Context can only include an instance or class of State but got ${
            K == '0' || K == String(V) ? V : `${V} (as '${K}')`
          }.`
        );

      const state = State.is(V) ? new (V as State.Type)() : V;
      const remove = this.add(state, false);

      init.add(state);
      cleanup.set(
        K,
        state === V
          ? remove
          : () => {
              remove();
              event(state, null);
            }
      );
    }

    for (const state of init) {
      event(state);
      if (forEach) forEach(state as T, false, false);
    }

    INPUTS.set(this, inputs as Record<string | number, State | State.Extends>);

    return this;
  }

  add(I: State, implicit?: boolean) {
    return include(this, I, implicit);
  }

  public push(inputs?: Context.Accept) {
    const next = new Context(this);
    if (inputs) next.use(inputs);
    return next;
  }

  public pop() {
    INPUTS.set(this, {});
    const children = CHILDREN.get(this);
    if (children) {
      for (const child of [...children]) (child as Context).pop();
      children.clear();
    }
    const cleanup = CTX_CLEANUP.get(this);
    if (cleanup) {
      cleanup.forEach((cb) => cb());
      cleanup.clear();
    }
    const parent = PARENT.get(this);
    if (parent) CHILDREN.get(parent)?.delete(this);
  }
}

Context.root = new Context();

function ctxTypes(state: State) {
  let T = state.constructor as State.Extends;
  const out: State.Extends[] = [];
  while (T !== State) {
    out.push(T);
    T = Object.getPrototypeOf(T);
  }
  return out;
}

function above(from: State) {
  const out: State[] = [];
  let current: State | null | undefined = from;
  while (current) {
    if (REGISTRY.has(current)) out.push(current as Context);
    current = PARENT.get(current);
  }
  return out;
}

function below(from: State) {
  const children = CHILDREN.get(from);
  if (!children) return new Set<State>();
  const queue = new Set<State>();
  for (const c of children) queue.add(c as State);
  for (const q of queue) {
    const ch = CHILDREN.get(q);
    if (ch) for (const c of ch) queue.add(c as State);
  }
  return queue;
}

function subscribe(ctx: State, T: State.Extends, cb: Context.Expect<any>) {
  let map = CTX_LISTENERS.get(ctx);
  if (!map) CTX_LISTENERS.set(ctx, (map = new Map()));
  let set = map.get(T);
  if (!set) map.set(T, (set = new Set()));
  set.add(cb);
  return () => {
    set.delete(cb);
  };
}

function attach(state: State, ctx: Context) {
  const waiting = LOOKUP.get(state);
  if (waiting instanceof Context) return;
  if (waiting instanceof Array) waiting.forEach((cb) => cb(ctx));
  LOOKUP.set(state, ctx);
  return () => LOOKUP.delete(state);
}

function find<T extends State>(
  from: State,
  Type: State.Extends<T>,
  arg2?: boolean | Context.Expect<T>
): any {
  if (typeof arg2 == 'function') {
    for (const ctx of above(from)) {
      const entries = REGISTRY.get(ctx)!.get(Type);
      if (entries) {
        let found: T | undefined;
        let priority = false;

        for (const [state, explicit] of entries) {
          if (found === state) continue;
          if (!found || explicit > priority) {
            found = state as T;
            priority = explicit;
            continue;
          }
          if (!priority && !explicit) found = undefined;
          else if (explicit)
            throw new Error(
              `Did find ${Type} in context, but multiple were defined.`
            );
        }

        if (found) arg2(found, false, true);
        break;
      }
    }

    for (const ctx of below(from)) {
      const entries = REGISTRY.get(ctx)!.get(Type);
      if (entries) for (const [state] of entries) arg2(state as T, true, true);
    }

    return subscribe(from, Type, arg2);
  }

  if (arg2 === true) {
    const out: T[] = [];
    for (const ctx of below(from)) {
      const entries = REGISTRY.get(ctx)?.get(Type) || [];
      for (const [state] of entries) out.push(state as T);
    }
    return out;
  }

  let found: T | undefined;
  let priority = false;

  for (const ctx of above(from)) {
    const entries = REGISTRY.get(ctx)!.get(Type);
    if (entries) {
      for (const [state, explicit] of entries) {
        if (found === state) continue;
        if (!found || explicit > priority) {
          found = state as T;
          priority = explicit;
          continue;
        }
        if (!priority) return null;
        if (explicit)
          throw new Error(
            `Did find ${Type} in context, but multiple were defined.`
          );
      }
      break;
    }
  }

  if (found) return found;
  if (arg2 !== false) throw new Error(`Could not find ${Type} in context.`);
}

export function include(ctx: Context, I: State, implicit?: boolean) {
  const registry = REGISTRY.get(ctx)!;
  const cleanup = new Map<string | Function, () => void>();
  const TT = ctxTypes(I);

  for (const T of TT) {
    let arr = registry.get(T);
    if (!arr) registry.set(T, (arr = []));
    arr.push([I, !implicit]);
  }

  /* v8 ignore next 9 -- @preserve */
  cleanup.set('', () => {
    for (const T of TT) {
      const arr = registry.get(T);
      if (arr) {
        const idx = arr.findIndex((e) => e[0] === I);
        if (idx >= 0) arr.splice(idx, 1);
        if (!arr.length) registry.delete(T);
      }
    }
  });

  const IT = ctxTypes(I);
  const expects = [] as [Context.Expect, boolean][];
  const seen = new Set<Context.Expect>();

  for (const actx of above(ctx))
    for (const T of IT) {
      const listeners = CTX_LISTENERS.get(actx);
      if (!listeners) continue;
      const set = listeners.get(T);
      if (set)
        for (const cb of set)
          if (!seen.has(cb)) {
            seen.add(cb);
            expects.push([cb, actx !== ctx]);
          }
    }

  for (const bctx of below(ctx))
    for (const T of IT) {
      const listeners = CTX_LISTENERS.get(bctx);
      if (!listeners) continue;
      const set = listeners.get(T);
      if (set)
        for (const cb of set)
          if (!seen.has(cb)) {
            seen.add(cb);
            expects.push([cb, false]);
          }
    }

  const unwatch = listener(I, (key) => {
    if (key === true)
      for (const [cb, child] of expects) {
        const r = cb(I, child, false);
        if (r) cleanup.set(r, r);
      }
  });

  const reset = () => {
    unwatch();
    cleanup.forEach((cb) => cb());
    cleanup.clear();
  };

  const release = attach(I, ctx);

  const ctxCleanup = CTX_CLEANUP.get(ctx)!;

  const remove = () => {
    ctxCleanup.delete(remove);
    reset();
    if (release) release();
  };

  ctxCleanup.set(remove, remove);

  return remove;
}

/**
 * Get the context for a specified State. If a callback is provided, it will be run when
 * the context becomes available.
 */
function context(on: State, callback: (got: Context) => void): void;

/** Get the context for a specified State. Returns undefined if none are found. */
function context(on: State, required?: true): Context;

function context(on: State, required: boolean): Context | undefined;

function context({ is }: State, arg?: ((got: Context) => void) | boolean) {
  const found = LOOKUP.get(is);

  if (found instanceof Context) {
    if (typeof arg == 'function') arg(found);
    return found;
  }

  if (typeof arg == 'function')
    if (found) found.push(arg);
    else LOOKUP.set(is, [arg]);
  else if (arg !== false) {
    attach(is, Context.root);
    return Context.root;
  }
}

export { Context, context, find };
