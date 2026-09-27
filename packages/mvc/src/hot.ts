import { rechain } from './component';
import { event } from './observable';
import { State, patch, track } from './state';

/** The subset of a bundler's `import.meta.hot` this module uses. */
interface Hot {
  data: Record<string, any>;
}

interface Entry {
  type: Function;
  shape: string;
}

const DATA = '@expressive/mvc';
const REFRESH = Symbol.for('@expressive/mvc.refresh');

function isState(value: unknown): value is State.Extends {
  return typeof value == 'function' && value.prototype instanceof State;
}

/** Class source, less its methods and accessors - what a patch cannot carry. */
function shape(type: Function) {
  const text = Function.prototype.toString;
  let source = text.call(type);

  for (const target of [type.prototype, type])
    for (const desc of Object.values(Object.getOwnPropertyDescriptors(target)))
      for (const fn of [desc.value, desc.get, desc.set])
        if (typeof fn == 'function' && fn !== type)
          source = source.replace(text.call(fn), '');

  return source.replace(/\s+/g, ' ');
}

/**
 * Canonicalize a module's State classes across hot updates. On first run each
 * class is recorded; on later runs a compatible class is patched onto the one
 * recorded, which is returned in its place so identity holds for importers,
 * context and live instances. An incompatible class is returned as-is.
 */
function accept<T extends Record<string, unknown>>(hot: Hot, classes: T): T {
  const store: Record<string, Entry> = (hot.data[DATA] ||= {});
  const output = { ...classes } as Record<string, unknown>;
  const refresh = new Set<State>();

  track();

  for (const [name, type] of Object.entries(classes)) {
    if (!isState(type)) continue;

    const prev = store[name];
    const next = { type, shape: shape(type) };

    if (!prev || prev.type === type || prev.shape !== next.shape) {
      store[name] = next;
      continue;
    }

    try {
      for (const state of patch(prev.type as State.Extends, type)) refresh.add(state);
      output[name] = prev.type;
    } catch (error) {
      console.error(error);
      store[name] = next;
    }
  }

  if (refresh.size) {
    rechain();
    for (const state of refresh) event(state, REFRESH);
  }

  return output as T;
}

/**
 * Compare a module's exports across a hot update. Returns `'reload'` when a
 * State class changed in a way no patch can carry - live instances keep the old
 * shape - or a message when some other export importers hold would go stale.
 * A patched class, or a component the host refreshes itself, passes.
 */
function verify(prev: Record<string, unknown>, next?: Record<string, unknown>) {
  if (!next) return;

  for (const key of Object.keys(prev)) {
    const before = prev[key];
    const after = next[key];

    if (before === after) continue;

    if (isState(before) || isState(after)) return 'reload';

    if (!(key in next) || typeof after != 'function' || !/^[A-Z]/.test(after.name))
      return `@expressive/mvc: "${key}" export cannot be hot-patched.`;
  }
}

export { accept, verify };
export type { Hot };
