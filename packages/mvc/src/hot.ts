import { rechain } from './component';
import { hot } from './context';
import { event } from './observable';
import {
  State,
  GETTERS,
  LATEST,
  METHODS,
  SETUP,
  UNBIND,
  classify,
  compute,
  type Handler
} from './state';

interface Entry {
  type: Function;
  shape: string;
  kinds: Record<string, 'get' | 'accessor' | 'fn'>;
  own: Handler[];
}

interface Replaced {
  /** Module id the class was accepted under. */
  id: string;
  /** Local declaration name of the class. */
  name: string;
  /** Class live instances belong to. */
  prev: State.Extends;
  /** Class that took its place. */
  next: State.Extends;
}

const define = Object.defineProperty;

/** Method implementations replaced by a hot patch. */
const PAST = new WeakSet<Function>();

/** Live instances, tracked once hot patching is enabled. */
let LIVE: Set<WeakRef<State>> | undefined;

/** Bootstrapped subclasses of each class, tracked once hot patching is enabled. */
const SUBCLASSES = new WeakMap<Function, Set<State.Extends>>();

const MODULES = new Map<string, Record<string, Entry>>();
const LISTENERS = new Set<(event: Replaced) => void>();
const REFRESH = Symbol.for('@expressive/mvc.refresh');
const PRIVATE = /(?:^|[\s;{}*])#[\w$]+(?=[\s=;(}])/;

/** Begin tracking live instances, so a hot patch can reach them. */
function track() {
  if (LIVE) return;

  LIVE = new Set();
  hot();

  State.on({
    type(type) {
      const parent = Object.getPrototypeOf(type);
      let children = SUBCLASSES.get(parent);
      if (!children) SUBCLASSES.set(parent, (children = new Set()));
      children.add(type);
    },
    setup(state) {
      const ref = new WeakRef(state);
      LIVE!.add(ref);
      return () => LIVE!.delete(ref);
    }
  });
}

/**
 * Move the members of `next` onto `prev`, which keeps its identity. Returns the
 * live instances of `prev`, each needing a refresh.
 */
function patch(prev: State.Extends, next: State.Extends, own: Handler[]): State[] {
  const proto = prev.prototype;
  const incoming = Object.getOwnPropertyDescriptors(next.prototype);
  const keys = METHODS.get(prev);
  const getters = GETTERS.get(prev);
  const methods = new Map<string, Function>();
  const knownKeys = new Set(keys?.keys());
  const knownGetters = new Set(getters?.keys());

  let setup = SETUP.get(prev);

  for (const handler of own) setup!.delete(handler);
  for (const handler of handlers(next)) {
    if (!setup) SETUP.set(prev, (setup = new Set()));
    setup.add(handler);
  }

  for (const key of Reflect.ownKeys(next)) {
    if (key == 'prototype' || key == 'length' || key == 'name') continue;
    if (Object.getOwnPropertyDescriptor(prev, key)?.configurable !== false)
      define(prev, key, Object.getOwnPropertyDescriptor(next, key)!);
  }

  const removed = new Set<string>();

  for (const key of Object.getOwnPropertyNames(proto))
    if (key != 'constructor' && !(key in incoming)) {
      const bind = keys?.get(key);

      if (bind && Object.getOwnPropertyDescriptor(proto, key)!.get === bind) {
        PAST.add(UNBIND.get(bind));
        keys!.delete(key);
      }

      removed.add(key);
      Reflect.deleteProperty(proto, key);
      getters?.delete(key);
    }

  for (const [key, desc] of Object.entries(incoming)) {
    if (key == 'constructor') continue;

    const current = Object.getOwnPropertyDescriptor(proto, key);

    if (typeof desc.value == 'function') methods.set(key, desc.value);
    if (current?.configurable === false) {
      if (current.writable) (proto as any)[key] = desc.value;
      continue;
    }

    if (current?.get && keys?.get(key) === current.get)
      PAST.add(UNBIND.get(current.get));

    const getter = getters?.get(key);

    if (getter) LATEST.set(getter, desc.get!);

    define(proto, key, { ...desc, configurable: true });
  }

  if (keys) {
    for (let T: State.Extends = prev; ; T = Object.getPrototypeOf(T)) {
      for (const handler of SETUP.get(T) || [])
        if (handler.type) handler.type(prev);

      if (T === State) break;
    }

    classify(prev, keys, getters!);
  }

  const live: State[] = [];

  for (const ref of LIVE!) {
    const state = ref.deref();

    if (!state) LIVE!.delete(ref);
    else if (state instanceof prev) live.push(state);
  }

  const descendants = new Set([prev, ...live.map((state) => state.constructor as State.Extends)]);

  for (const type of descendants) for (const child of SUBCLASSES.get(type) || []) descendants.add(child);

  descendants.delete(prev);

  for (const type of descendants) {
    const inherit = METHODS.get(type)!;
    const computed = GETTERS.get(type)!;

    for (const [key, bind] of keys!) if (!knownKeys.has(key) && !inherit.has(key)) inherit.set(key, bind);
    for (const [key, get] of getters!) if (!knownGetters.has(key) && !computed.has(key)) computed.set(key, get);
    for (const key of removed)
      if (!(key in type.prototype)) {
        inherit.delete(key);
        computed.delete(key);
      }
  }

  for (const state of live) {
    for (const [key, value] of methods) {
      const desc = Object.getOwnPropertyDescriptor(state, key);

      if (!desc) continue;
      if (desc.set) desc.set.call(state, value);
      else if (PAST.has(UNBIND.get(desc.value))) delete (state as any)[key];
    }

    for (const key of removed)
      if (PAST.has(UNBIND.get(Object.getOwnPropertyDescriptor(state, key)?.value))) delete (state as any)[key];

    for (const [key, get] of GETTERS.get(state.constructor)!)
      if (!knownGetters.has(key) && get === getters!.get(key)) compute.call(state, get, key);
  }

  return live;
}

/** Lifecycle handlers registered on a class itself. */
function handlers(type: State.Extends): Handler[] {
  return [...(SETUP.get(type) || [])];
}

function isState(value: unknown): value is State.Extends {
  return typeof value == 'function' && value.prototype instanceof State;
}

/** What a patch cannot carry: class source less its members, and member kinds. */
function describe(type: Function): Entry {
  const text = Function.prototype.toString;
  const kinds: Entry['kinds'] = {};
  let shape = text.call(type);

  for (const target of [type.prototype, type])
    for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(target)))
      for (const fn of [desc.value, desc.get, desc.set])
        if (typeof fn == 'function' && fn !== type) {
          shape = shape.replace(text.call(fn), '');
          if (target !== type) kinds[key] = desc.set ? 'accessor' : desc.get ? 'get' : 'fn';
        }

  return { type, shape: shape.replace(/\s+/g, ' '), kinds, own: handlers(type as State.Extends) };
}

function compatible(prev: Entry, next: Entry) {
  if (prev.shape !== next.shape || PRIVATE.test(next.shape)) return false;
  if (Object.getPrototypeOf(prev.type) !== Object.getPrototypeOf(next.type)) return false;

  for (const key in next.kinds)
    if (key in prev.kinds && prev.kinds[key] !== next.kinds[key]) return false;

  return true;
}

/**
 * Keep a module's State classes stable across runs. A class seen before is
 * patched with its replacement and returned in its place, refreshing live
 * instances; one whose shape or parent changed is returned as-is, and
 * reported to `replaced` listeners before `accept` returns.
 */
function accept<T extends Record<string, unknown>>(id: string, classes: T): T {
  let known = MODULES.get(id);

  if (!known) MODULES.set(id, (known = {}));

  const output: Record<string, unknown> = { ...classes };
  const refresh = new Set<State>();
  const replace: Replaced[] = [];
  let patched = false;

  track();

  for (const [name, type] of Object.entries(classes)) {
    if (!isState(type)) continue;

    const prev = known[name];

    if (prev?.type === type) continue;

    const next = describe(type);

    if (!prev || !compatible(prev, next)) {
      if (prev) replace.push({ id, name, prev: prev.type as State.Extends, next: type });
      known[name] = next;
      continue;
    }

    try {
      for (const state of patch(prev.type as State.Extends, type, prev.own)) refresh.add(state);
      patched = true;
      known[name] = { ...next, type: prev.type };
      output[name] = prev.type;
    } catch (error) {
      console.error(error);
      replace.push({ id, name, prev: prev.type as State.Extends, next: type });
      known[name] = next;
    }
  }

  if (patched) rechain();

  for (const state of refresh) event(state, REFRESH);

  for (const event of replace)
    for (const listener of LISTENERS)
      try {
        listener(event);
      } catch (error) {
        console.error(error);
      }

  return output as T;
}

/**
 * Observe classes `accept` replaced instead of patching. Fires synchronously
 * inside `accept`, while the module re-runs, so a host can retire instances of
 * `prev` before anything resolves the module again.
 */
function replaced(listener: (event: Replaced) => void): () => void {
  LISTENERS.add(listener);
  return () => void LISTENERS.delete(listener);
}

export { accept, replaced };
export type { Replaced };
