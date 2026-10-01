import { owner } from './adapter';
import type { Scope } from './adapter';
import { schedule } from './scheduler';

interface Family {
  current: Function;
  scopes: Set<Scope>;
}

const FAMILIES = new Map<string, Family>();
const FAMILY = new WeakMap<Function, Family>();

/** The latest implementation of a component registered for hot refresh. */
function latest(type: Function) {
  return FAMILY.get(type)?.current || type;
}

/** Whether two element types are one component, across hot edits. */
function same(a: unknown, b: unknown) {
  if (a === b) return true;

  const sub = owner(a);

  if (sub) {
    const other = owner(b);
    return !!other && other.owner === sub.owner && other.key === sub.key;
  }

  const family = typeof a == 'function' && FAMILY.get(a);

  return !!family && family === FAMILY.get(b as Function);
}

function track(type: Function, scope: Scope) {
  FAMILY.get(type)?.scopes.add(scope);
}

function untrack(type: Function, scope: Scope) {
  FAMILY.get(type)?.scopes.delete(scope);
}

/**
 * Register a module's function components under stable ids. A component seen
 * before takes its new implementation and re-renders where it is mounted.
 */
function hot(id: string, components: Record<string, unknown>) {
  for (const [name, type] of Object.entries(components)) {
    if (typeof type != 'function') continue;

    const key = `${id}#${name}`;
    let family = FAMILIES.get(key);

    if (!family) FAMILIES.set(key, (family = { current: type, scopes: new Set() }));

    FAMILY.set(type, family);

    if (family.current === type) continue;

    family.current = type;

    for (const scope of family.scopes) {
      scope.hot = true;
      schedule(scope);
    }
  }
}

export { hot, latest, same, track, untrack };
