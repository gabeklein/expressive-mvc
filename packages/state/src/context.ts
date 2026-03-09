import { listener } from './observable';
import { event, State } from './state';

/** Context parent of a state. */
const PARENT = new WeakMap<State, State | null>();

/** Context children of a state. */
const CHILDREN = new WeakMap<State, Set<State>>();

/** Registry of provided states, keyed by type. */
const PROVIDE = new WeakMap<State, Map<State.Extends, [State, boolean][]>>();

/** Subscriber callbacks waiting for types to appear. */
const CONSUME = new WeakMap<State, Map<State.Extends, Set<Expect>>>();

/** Previous inputs for apply(). */
const INPUTS = new WeakMap<
  State,
  Record<string | number, State | State.Extends>
>();

/** Cleanup callbacks per state. */
const CLEANUP = new WeakMap<
  State,
  Map<string | number | Function, () => void>
>();

type Accept<T extends State = State> =
  | T
  | State.Type<T>
  | Record<string | number, T | State.Type<T>>;

type Expect<T extends State = State> = (
  state: T,
  child: boolean,
  existing: boolean
) => (() => void) | false | void;

function get<K extends object, T>(
  source: WeakMap<K, T>,
  key: K,
  Type: new () => any
): T;
function get<K, T>(source: Map<K, T>, key: K, Type: new () => any): T;
function get(source: any, key: any, Type: new () => any) {
  let value = source.get(key);
  if (!value) source.set(key, (value = new Type()));
  return value;
}

function types(state: State) {
  let T = state.constructor as State.Extends;
  const out: State.Extends[] = [];
  while (T !== State) {
    out.push(T);
    T = Object.getPrototypeOf(T);
  }
  return out;
}

/** Walk PARENT upward from state, collecting ancestors (inclusive). */
function above(state: State) {
  const out: State[] = [];
  let current: State | undefined = state;
  do out.push(current);
  while ((current = PARENT.get(current) || undefined));
  return out;
}

/** BFS downward via CHILDREN from state (exclusive). */
function below(from: State) {
  const kids = CHILDREN.get(from);
  if (!kids) return new Set<State>();
  const queue = new Set(kids);
  for (const q of queue) {
    const k = CHILDREN.get(q);
    if (k) for (const c of k) queue.add(c);
  }
  return queue;
}

/**
 * Register a target state within a host's context.
 *
 * @param host - The state that owns the context node.
 * @param target - The state to register.
 * @param implicit - If true, registers on nearest ancestor with PROVIDE.
 * @returns Cleanup function to remove the registration.
 */
function include(host: State, target: State, implicit?: boolean) {
  let registrar = host;

  if (implicit) {
    let current: State | undefined = host;
    while (current) {
      if (PROVIDE.has(current)) {
        registrar = current;
        break;
      }
      current = PARENT.get(current) || undefined;
    }
  }

  const registry = get(PROVIDE, registrar, Map);

  const TT = types(target);
  const cleanup = new Map<string | Function, () => void>();

  for (const T of TT) {
    get(registry, T, Array).push([target, !implicit]);
  }

  /* v8 ignore next 9 -- @preserve */
  cleanup.set('', () => {
    for (const T of TT) {
      const arr = registry.get(T);
      if (arr) {
        const idx = arr.findIndex((e) => e[0] === target);
        if (idx >= 0) arr.splice(idx, 1);
        if (!arr.length) registry.delete(T);
      }
    }
  });

  if (!PARENT.get(target)) PARENT.set(target, host);

  get(CHILDREN, host, Set).add(target);

  const IT = types(target);
  const expects: [Expect, boolean][] = [];
  const seen = new Set<Expect>();

  function collect(state: State, child: boolean) {
    for (const T of IT) {
      const map = CONSUME.get(state);
      if (!map) continue;
      const set = map.get(T);
      if (set)
        for (const cb of set)
          if (!seen.has(cb)) {
            seen.add(cb);
            expects.push([cb, child]);
          }
    }
  }

  for (const s of above(registrar)) {
    const isAbove = s !== registrar;
    collect(s, isAbove);
    const provided = PROVIDE.get(s);
    if (provided)
      for (const entries of provided.values())
        for (const [st] of entries) if (st !== target) collect(st, isAbove);
  }

  // For sibling states on the registrar, also collect with child=true
  // so downstream watchers on siblings are notified.
  {
    const provided = PROVIDE.get(registrar);
    if (provided)
      for (const entries of provided.values())
        for (const [st] of entries)
          if (st !== target) {
            for (const T of IT) {
              const map = CONSUME.get(st);
              if (!map) continue;
              const set = map.get(T);
              if (set)
                for (const cb of set)
                  if (seen.has(cb)) expects.push([cb, true]);
            }
          }
  }

  for (const s of below(registrar)) {
    collect(s, false);
    const provided = PROVIDE.get(s);
    if (provided)
      for (const entries of provided.values())
        for (const [st] of entries) if (st !== target) collect(st, false);
  }

  const unwatch = listener(target, (key) => {
    if (key === true)
      for (const [cb, child] of expects) {
        const r = cb(target, child, false);
        if (r) cleanup.set(r, r);
      }
  });

  const reset = () => {
    unwatch();
    cleanup.forEach((cb) => cb());
    cleanup.clear();
    CHILDREN.get(host)?.delete(target);
  };

  const hostCleanup = get(CLEANUP, host, Map);
  const targetCleanup = get(CLEANUP, target, Map);

  const remove = () => {
    hostCleanup.delete(remove);
    targetCleanup.delete(remove);
    reset();
  };

  hostCleanup.set(remove, remove);
  targetCleanup.set(remove, remove);

  return remove;
}

/**
 * Apply a set of inputs to a host state, diffing against previous inputs.
 * Creates instances for class inputs, fires event() for new instances.
 */
function apply<T extends State>(
  host: State,
  inputs: Accept<T>,
  forEach?: Expect<T>
) {
  const cleanup = get(CLEANUP, host, Map);

  const prev = INPUTS.get(host) || {};
  const init = new Set<State>();

  if (typeof inputs == 'function' || inputs instanceof State)
    inputs = { [0]: inputs } as Record<string | number, T | State.Type<T>>;

  for (const K of Object.keys({ ...prev, ...inputs })) {
    const V = (inputs as Record<string, any>)[K];
    const E = prev[K];

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
    const remove = include(host, state, false);

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

  INPUTS.set(host, inputs);
}

/** Find specified type upstream. Throws if not found. */
function find<T extends State>(state: State, Type: State.Extends<T>): T;

/** Find specified type upstream. Returns undefined if not found. */
function find<T extends State>(
  state: State,
  Type: State.Extends<T>,
  required: false | undefined
): T | undefined;

/** Get all entries of a type registered downstream. */
function find<T extends State>(
  state: State,
  Type: State.Extends<T>,
  below: true
): T[];

/** Subscribe to a type becoming available in either direction. */
function find<T extends State>(
  state: State,
  Type: State.Extends<T>,
  callback: Expect<T>
): () => void;

function find<T extends State>(
  state: State,
  Type: State.Extends<T>,
  arg2?: boolean | Expect<T>
) {
  if (typeof arg2 == 'function') {
    for (const s of above(state)) {
      const registry = PROVIDE.get(s);
      if (!registry) continue;
      const entries = registry.get(Type);
      if (entries) {
        let found: T | undefined;
        let priority = false;

        for (const [st, explicit] of entries) {
          if (found === st) continue;
          if (!found || explicit > priority) {
            found = st as T;
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

    {
      let root: State = state;
      let current: State | undefined = state;
      while (current) {
        if (PROVIDE.has(current)) {
          root = current;
          break;
        }
        current = PARENT.get(current) || undefined;
      }
      for (const s of below(root)) {
        const registry = PROVIDE.get(s);
        if (!registry) continue;
        const entries = registry.get(Type);
        if (entries) for (const [st] of entries) arg2(st as T, true, true);
      }
    }

    const set = get(get(CONSUME, state, Map), Type, Set);
    set.add(arg2 as Expect);

    return () => {
      set.delete(arg2 as Expect);
    };
  }

  if (arg2 === true) {
    let root: State = state;
    let current: State | undefined = state;
    while (current) {
      if (PROVIDE.has(current)) {
        root = current;
        break;
      }
      current = PARENT.get(current) || undefined;
    }

    const out: T[] = [];
    for (const s of below(root)) {
      const registry = PROVIDE.get(s);
      if (!registry) continue;
      const entries = registry.get(Type) || [];
      for (const [st] of entries) out.push(st as T);
    }
    return out;
  }

  let found: T | undefined;
  let priority = false;

  for (const s of above(state)) {
    const registry = PROVIDE.get(s);
    if (!registry) continue;
    const entries = registry.get(Type);
    if (entries) {
      for (const [st, explicit] of entries) {
        if (found === st) continue;
        if (!found || explicit > priority) {
          found = st as T;
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

/**
 * Detach a state from context, recursively cleaning up children.
 */
function detach(state: State) {
  INPUTS.delete(state);

  const kids = CHILDREN.get(state);
  if (kids) {
    for (const child of kids) detach(child);
    kids.clear();
  }

  const cleanup = CLEANUP.get(state);
  if (cleanup) {
    cleanup.forEach((cb) => cb());
    cleanup.clear();
  }

  const p = PARENT.get(state);
  if (p) {
    const pk = CHILDREN.get(p);
    if (pk) pk.delete(state);
  }

  PROVIDE.delete(state);
  CONSUME.delete(state);
}

/** Get context parent of a state. */
function parent(state: State): State | undefined;

/** Get context parent only if it directly owns the state. */
function parent(state: State, direct: true): State | undefined;

function parent(state: State) {
  return PARENT.get(state) || undefined;
}

/**
 * Link two states as parent-child in the context tree.
 * Does NOT register the child in PROVIDE — use include() for that.
 */
function link(p: State, child: State) {
  if (!PARENT.get(child)) PARENT.set(child, p);
  get(CHILDREN, p, Set).add(child);
}

export {
  find,
  include,
  apply,
  detach,
  parent,
  link,
  PARENT,
  CHILDREN,
  PROVIDE,
  CONSUME,
  CLEANUP
};
export type { Accept, Expect };
