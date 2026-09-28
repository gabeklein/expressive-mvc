import { rechain } from './component';
import { event, observer } from './observable';
import { State, handlers, patch, track } from './state';

interface Entry {
  type: Function;
  shape: string;
  kinds: Record<string, 'get' | 'accessor' | 'fn'>;
  own: ReturnType<typeof handlers>;
}

const MODULES = new Map<string, Record<string, Entry>>();
const REFRESH = Symbol.for('@expressive/mvc.refresh');

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
  if (prev.shape !== next.shape) return false;

  for (const key in next.kinds)
    if (key in prev.kinds && prev.kinds[key] !== next.kinds[key]) return false;

  return true;
}

/**
 * Keep a module's State classes stable across runs. A class seen before is
 * patched with its replacement and returned in its place, refreshing live
 * instances; one whose shape changed is returned as-is.
 */
function accept<T extends Record<string, unknown>>(id: string, classes: T): T {
  let known = MODULES.get(id);

  if (!known) MODULES.set(id, (known = {}));

  const output: Record<string, unknown> = { ...classes };
  const refresh = new Set<State>();
  let patched = false;

  track();

  for (const [name, type] of Object.entries(classes)) {
    if (!isState(type)) continue;

    const prev = known[name];

    if (prev?.type === type) continue;

    const next = describe(type);

    if (!prev || !compatible(prev, next)) {
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
      known[name] = next;
    }
  }

  if (patched) rechain();

  for (const state of refresh) if (observer(state)?.ready) event(state, REFRESH);

  return output as T;
}

export { accept };
