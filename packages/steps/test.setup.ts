import '../mvc/test.setup';

import { Steps } from './src/steps';

export { flushMicrotasks, mockPromise, mockUncaught, mockWarn } from '../mvc/test.setup';

const RUNS = new WeakMap<object, Steps.Entry[][]>();
const OPEN = new WeakSet<object>();

/**
 * Extend a Steps class to keep every entry its `after` hook is handed, per run - read with
 * `record(instance)`. Its own hooks still run; a subclass overriding one calls `super`.
 */
export function journal<T extends new (...args: any[]) => Steps>(Base: T): T {
  class Journaled extends (Base as new (...args: any[]) => Steps) {
    protected before(step: string, args: unknown[], skip: boolean) {
      current(this);
      super.before?.(step, args, skip);
    }

    protected after(step: string, entry: Steps.Entry, skip: boolean) {
      current(this).push(entry);
      super.after?.(step, entry, skip);
    }

    protected exit(outcome: Steps.Outcome) {
      OPEN.delete(this);
      super.exit?.(outcome);
    }
  }

  Object.defineProperty(Journaled, 'name', { value: Base.name });

  return Journaled as unknown as T;
}

function current(instance: object) {
  if (!OPEN.has(instance)) {
    OPEN.add(instance);
    RUNS.set(instance, [...(RUNS.get(instance) || []), []]);
  }

  return RUNS.get(instance)!.at(-1)!;
}

/** A Steps base keeping the entries `after` is handed. */
export const Journal = journal(Steps);

/** Entries `after` was handed in the instance's current or last run - or in run `index`. */
export function record(instance: Steps, index = -1): Steps.Entry[] {
  return RUNS.get(instance)?.at(index) || [];
}
