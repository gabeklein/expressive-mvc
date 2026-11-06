import '../mvc/test.setup';

import { Steps } from './src/steps';

export { flushMicrotasks, mockPromise, mockUncaught, mockWarn } from '../mvc/test.setup';

const RUNS = new WeakMap<object, Steps.Entry[][]>();

/**
 * Extend a Steps class to keep every entry its `after` hook is handed, per run - read with
 * `record(instance)`. Its own hooks still run; a subclass overriding one calls `super`.
 */
export function journal<T extends new (...args: any[]) => Steps>(Base: T): T {
  class Journaled extends (Base as new (...args: any[]) => Steps) {
    protected before(step: string, args: unknown[]) {
      current(this);
      super.before?.(step, args);
    }

    protected after(step: string, entry: Steps.Entry) {
      current(this).push(entry);
      super.after?.(step, entry);
    }
  }

  Object.defineProperty(Journaled, 'name', { value: Base.name });

  return Journaled as unknown as T;
}

function current(instance: Steps) {
  const runs = RUNS.get(instance) || [];
  const index = instance.then.runs;

  RUNS.set(instance, runs);

  return (runs[index] ||= []);
}

/** A Steps base keeping the entries `after` is handed. */
export const Journal = journal(Steps);

/** Entries `after` was handed in the instance's current or last run - or in run `index`. */
export function record(instance: Steps, index = -1): Steps.Entry[] {
  return RUNS.get(instance)?.at(index) || [];
}
