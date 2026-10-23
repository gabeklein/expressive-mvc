import '../mvc/test.setup';

import { Job, type Runner } from './src/run';

export { flushMicrotasks, mockPromise, mockUncaught, mockWarn } from '../mvc/test.setup';

const RUNS = new WeakMap<object, Runner.Entry[][]>();
const OPEN = new WeakSet<object>();

/**
 * Extend a Job class to keep every entry its `after` hook is handed, per run - read with
 * `record(job)`. Its own hooks still run; a subclass overriding one calls `super`.
 */
export function journal<T extends new (...args: any[]) => Job>(Base: T): T {
  class Journaled extends (Base as new (...args: any[]) => Job) {
    protected before(step: string, args: unknown[], skip: boolean) {
      current(this);
      super.before?.(step, args, skip);
    }

    protected after(step: string, entry: Runner.Entry, skip: boolean) {
      current(this).push(entry);
      super.after?.(step, entry, skip);
    }

    protected exit(outcome: Runner.Outcome) {
      OPEN.delete(this);
      super.exit?.(outcome);
    }
  }

  Object.defineProperty(Journaled, 'name', { value: Base.name });

  return Journaled as unknown as T;
}

function current(job: object) {
  if (!OPEN.has(job)) {
    OPEN.add(job);
    RUNS.set(job, [...(RUNS.get(job) || []), []]);
  }

  return RUNS.get(job)!.at(-1)!;
}

/** A Job keeping the entries `after` is handed. */
export const Journal = journal(Job);

/** Entries `after` was handed in the job's current or last run - or in run `index`. */
export function record(job: Job, index = -1): Runner.Entry[] {
  return RUNS.get(job)?.at(index) || [];
}
