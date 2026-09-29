import { rechain } from './component';
import { event, observer } from './observable';
import { State, handlers, patch, track } from './state';

interface Entry {
  type: Function;
  shape: string;
  kinds: Record<string, 'get' | 'accessor' | 'fn'>;
  own: ReturnType<typeof handlers>;
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

const MODULES = new Map<string, Record<string, Entry>>();
const LISTENERS = new Set<(event: Replaced) => void>();
const REFRESH = Symbol.for('@expressive/mvc.refresh');
const PRIVATE = /(?:^|[\s;{}*])#[\w$]+(?=[\s=;(}])/;

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

  for (const state of refresh) if (observer(state)?.ready) event(state, REFRESH);

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
