import { rechain } from './component';
import { event } from './observable';
import { State, patch, track } from './state';

interface Entry {
  type: Function;
  shape: string;
  kinds: Record<string, 'get' | 'fn'>;
}

/** A module as a build integration parsed it. */
interface Module {
  /** Stable module id - the same on every run of the module. */
  id: string;
  /** Top-level classes bound by `class` or `let`, which can be reassigned. */
  classes: string[];
  /** Export name to local binding. */
  exports: Record<string, string>;
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
          if (target !== type) kinds[key] = desc.get ? 'get' : 'fn';
        }

  return { type, shape: shape.replace(/\s+/g, ' '), kinds };
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
      for (const state of patch(prev.type as State.Extends, type)) refresh.add(state);
      known[name] = { ...next, type: prev.type };
      output[name] = prev.type;
    } catch (error) {
      console.error(error);
      known[name] = next;
    }
  }

  if (refresh.size) {
    rechain();
    for (const state of refresh) event(state, REFRESH);
  }

  return output as T;
}

/**
 * Compare a module's exports across runs. Returns `'reload'` if a State class
 * changed shape, a message if another export importers hold went stale.
 */
function verify(prev: Record<string, unknown>, next?: Record<string, unknown>) {
  if (!next) return;

  for (const key of Object.keys(prev)) {
    const before = prev[key];
    const after = next[key];

    if (before === after) continue;

    if (isState(before) || isState(after)) return 'reload';

    if (typeof after != 'function' || !/^[A-Z]/.test(after.name))
      return `"${key}" export cannot be hot-patched.`;
  }
}

/** Code to append to a module, binding it to `accept` and `verify`. */
function inject({ id, classes, exports }: Module) {
  if (!classes.length) return '';

  const assign = classes.map((name) => `${name} = __hot.${name};`).join('\n  ');
  const record = Object.entries(exports)
    .map(([name, local]) => `${JSON.stringify(name)}: ${local}`)
    .join(', ');

  return `
import { hot as __expressive } from '@expressive/mvc/runtime';
{
  const __hot = __expressive.accept(${JSON.stringify(id)}, { ${classes.join(', ')} });
  ${assign}
}
if (import.meta.hot) {
  const __exports = { ${record} };
  import.meta.hot.accept((next) => {
    const verdict = __expressive.verify(__exports, next);
    if (verdict === 'reload' && typeof location == 'object') location.reload();
    else if (verdict) import.meta.hot.invalidate(verdict);
  });
}
`;
}

export { accept, inject, verify };
export type { Module };
