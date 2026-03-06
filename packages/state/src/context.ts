import { listener } from './observable';
import { access, event, State, PARENT } from './state';

type Expect<T extends State = State> = (
  state: T,
  existing?: true
) => (() => void) | false | void;

type Accept<T extends State = State> =
  | T
  | State.Type<T>
  | Record<string | number, T | State.Type<T>>;

type Input = State | State.Type | (State | State.Type)[];

const REGISTRY = new WeakMap<State, Map<State.Extends, [State, boolean][]>>();
const UPSTREAM = new WeakMap<State, Map<State.Extends, Set<Expect>>>();
const DOWNSTREAM = new WeakMap<State, Map<State.Extends, Set<Expect>>>();
const CHILDREN = new WeakMap<State, Set<State>>();
const CLEANUP = new WeakMap<State, Set<() => void>>();

let ScopeClass: State.Type;

function Scope(): State.Type {
  if (!ScopeClass) {
    ScopeClass = class extends State {} as unknown as State.Type;
  }
  return ScopeClass;
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

function above(from: State): State[] {
  const out: State[] = [from];
  let p = PARENT.get(from);
  while (p) {
    out.push(p);
    p = PARENT.get(p);
  }
  return out;
}

function below(from: State): Set<State> {
  const kids = CHILDREN.get(from);
  if (!kids) return new Set();
  const queue = new Set(kids);
  for (const q of queue) {
    const c = CHILDREN.get(q);
    if (c) for (const x of c) queue.add(x);
  }
  return queue;
}

function addChild(parent: State, child: State) {
  let kids = CHILDREN.get(parent);
  if (!kids) CHILDREN.set(parent, (kids = new Set()));
  kids.add(child);
}

function getRegistry(state: State) {
  let reg = REGISTRY.get(state);
  if (!reg) REGISTRY.set(state, (reg = new Map()));
  return reg;
}

function subscribeTo(
  map: WeakMap<State, Map<State.Extends, Set<Expect>>>,
  on: State,
  T: State.Extends,
  cb: Expect
) {
  let record = map.get(on);
  if (!record) map.set(on, (record = new Map()));
  let set = record.get(T);
  if (!set) record.set(T, (set = new Set()));
  set.add(cb);
  return () => {
    set.delete(cb);
  };
}

const WAITING = new WeakMap<State, ((scope: State) => void)[]>();

/** Get context parent for a state, with optional wait callback. */
function context(state: State): State;
function context(state: State, callback: (scope: State) => void): void;
function context(state: State, required: false): State | undefined;
function context(state: State, required: boolean): State | undefined;
function context({ is }: State, arg?: ((scope: State) => void) | boolean) {
  const parent = PARENT.get(is);

  if (parent) {
    if (typeof arg == 'function') arg(parent);
    return parent;
  }

  if (typeof arg == 'function') {
    const waiting = WAITING.get(is);
    if (waiting) waiting.push(arg);
    else WAITING.set(is, [arg]);
    return;
  }

  if (arg !== false)
    throw new Error(`Could not find context for ${is}.`);
}

/** Find Type registered upstream from a state. */
function get<T extends State>(from: State, Type: State.Extends<T>, require?: true): T;
function get<T extends State>(from: State, Type: State.Extends<T>, require: boolean): T | undefined;
function get<T extends State>(from: State, Type: State.Extends<T>, callback: Expect<T>): () => void;
function get<T extends State>(
  from: State,
  Type: State.Extends<T>,
  arg?: boolean | Expect<T>
) {
  let found: T | undefined;
  let priority = false;

  for (const s of above(from)) {
    const entries = REGISTRY.get(s)?.get(Type);
    if (!entries) continue;
    for (const [state, explicit] of entries) {
      if (found === state) continue;
      if (!found || (!priority && explicit)) {
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

  if (typeof arg == 'function') {
    if (found) arg(found, true);
    return subscribeTo(DOWNSTREAM, from, Type, arg);
  }

  if (found) return found;
  if (arg !== false) throw new Error(`Could not find ${Type} in context.`);
}

/** Find Type registered downstream from a state. */
function has<T extends State>(from: State, Type: State.Extends<T>): T[];
function has<T extends State>(from: State, Type: State.Extends<T>, callback: Expect<T>): () => void;
function has<T extends State>(
  from: State,
  Type: State.Extends<T>,
  cb?: Expect<T>
) {
  const out: T[] = [];

  for (const child of below(from))
    if (REGISTRY.get(child)?.get(Type))
      for (const [state] of REGISTRY.get(child)!.get(Type)!)
        out.push(state as T);

  if (cb) {
    for (const state of out) cb(state, true);
    return subscribeTo(UPSTREAM, from, Type, cb);
  }

  return out;
}

/**
 * Register a state (or class) into a scope. Returns cleanup function.
 */
function register(
  input: Input,
  into: State,
  implicit?: boolean,
  init: (I: State) => void = event
): () => void {
  if (Array.isArray(input)) {
    const clean = input.map((i) => register(i, into, implicit, init));
    return () => clean.forEach((c) => c());
  }

  const I = input instanceof State ? input : new (input as State.Type)();
  const reg = getRegistry(into);
  const cleanup = new Map<string | Function, () => void>();

  const observe = (target: State, explicit: boolean, key: string) => {
    for (const T of types(target)) {
      let arr = reg.get(T);
      if (!arr) reg.set(T, (arr = []));
      arr.push([target, explicit]);
    }

    cleanup.set(key, () => {
      for (const T of types(target)) {
        const arr = reg.get(T);
        if (arr) {
          const idx = arr.findIndex((e) => e[0] === target);
          if (idx >= 0) arr.splice(idx, 1);
          if (!arr.length) reg.delete(T);
        }
      }
    });
  };

  const adopt = (k: string, v: unknown) => {
    cleanup.get(k)?.();
    cleanup.delete(k);

    if (v instanceof State)
      if (PARENT.get(v)) {
        observe(v, false, k);
      } else {
        cleanup.set(k, register(v, into, true));
        event(v);
      }
  };

  observe(I, !implicit, '');

  addChild(into, I);
  const didSetParent = !PARENT.get(I);
  if (didSetParent) PARENT.set(I, into);

  const IT = types(I);
  const expects: Expect[] = [];

  for (const s of above(into))
    for (const T of IT) {
      const subs = UPSTREAM.get(s);
      if (subs) {
        const set = subs.get(T);
        if (set) expects.push(...set);
      }
    }

  const unwatch = listener(I, (key) => {
    if (typeof key === 'string') adopt(key, access(I, key, false));
    else if (key === true) {
      for (const cb of new Set(expects)) {
        const r = cb(I);
        if (r) cleanup.set(r, r);
      }
      for (const [k, v] of I) if (v instanceof State) adopt(k, v);
    }
  });

  for (const target of [into, ...below(into)])
    for (const T of IT) {
      const subs = DOWNSTREAM.get(target);
      if (subs) {
        const set = subs.get(T);
        if (set)
          for (const cb of set) {
            const r = cb(I);
            if (typeof r == 'function') cleanup.set(r, r);
          }
      }
    }

  init(I);

  if (didSetParent) {
    const waiting = WAITING.get(I);
    if (waiting) {
      WAITING.delete(I);
      waiting.forEach((cb) => cb(into));
    }
  }

  const remove = () => {
    const scoped = CLEANUP.get(into);
    if (scoped) scoped.delete(remove);
    unwatch();
    cleanup.forEach((cb) => cb());
    cleanup.clear();
    CHILDREN.get(into)?.delete(I);
    if (I !== input) event(I, null);
  };

  let scoped = CLEANUP.get(into);
  if (!scoped) CLEANUP.set(into, (scoped = new Set()));
  scoped.add(remove);

  return remove;
}

/** Create a child scope linked to a parent. */
function push(parent: State, input?: Input) {
  const child = new (Scope())();
  PARENT.set(child, parent);
  addChild(parent, child);
  event(child);
  if (input) register(input, child);
  return child;
}

/** Clean up a scope and all its children. */
function pop(scope: State) {
  const kids = CHILDREN.get(scope);
  if (kids) {
    for (const child of kids) pop(child);
    kids.clear();
  }

  const cleanups = CLEANUP.get(scope);
  if (cleanups) {
    for (const fn of cleanups) fn();
    cleanups.clear();
  }

  const parent = PARENT.get(scope);
  if (parent) CHILDREN.get(parent)?.delete(scope);
}

/**
 * Diff-based set for use in framework adapters.
 * Registers/unregisters states to match provided inputs.
 */
function set<T extends State>(
  scope: State,
  inputs: Accept<T>,
  forEach?: Expect<T>,
  prev?: Record<string | number, State | State.Extends>
) {
  const localCleanup = new Map<string | number, () => void>();
  const init: State[] = [];

  if (typeof inputs == 'function' || inputs instanceof State)
    inputs = { [0]: inputs } as Record<string | number, T | State.Type<T>>;

  const prevInputs = prev || {};

  for (const K of Object.keys({ ...prevInputs, ...inputs })) {
    const V = (inputs as Record<string, any>)[K];
    const E = prevInputs[K];

    if (E === V) continue;

    if (E) {
      localCleanup.get(K)?.();
      localCleanup.delete(K);
    }

    if (!V) continue;

    if (!(State.is(V) || V instanceof State))
      throw new Error(
        `Context can only include an instance or class of State but got ${
          K == '0' || K == String(V) ? V : `${V} (as '${K}')`
        }.`
      );

    localCleanup.set(
      K,
      register(V, scope, false, (I) => init.push(I))
    );
  }

  for (const state of init) {
    state.set();
    if (forEach) forEach(state as T);
  }

  return {
    inputs: inputs as Record<string | number, State | State.Extends>,
    cleanup: localCleanup
  };
}

export { context, get, has, register, push, pop, set, Scope as createScope };
export type { Expect, Accept, Input };
