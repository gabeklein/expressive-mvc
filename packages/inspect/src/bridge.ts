import type { inspect as Inspect } from './index';
import { dispatch, type Call } from './dispatch';
import { bracket } from './bracket';
import { tick, unsettled, type Settle } from './settle';
import type { Frame, Options, Query, Summary } from './journal';

export { cdp, type Target } from './cdp';

/**
 * Anything that can run a function in the page: Playwright `Page`, `Frame`, or
 * `Locator` (which passes the element first), puppeteer `Page` or `Frame`.
 */
export interface Evaluates {
  evaluate(fn: (...args: any[]) => unknown, arg?: unknown): Promise<unknown>;
}

/**
 * Drive the page's inspector from a test. Every method is one `evaluate`;
 * `around` brackets a step with the journal forced on and returns its frames.
 */
export function inspect(target: Evaluates) {
  const remote =
    <R>(...path: string[]) =>
    (...args: unknown[]) =>
      target.evaluate(dispatch, [path, args] as Call) as Promise<R>;

  const record = remote<Required<Options>>('journal', 'record');
  const seq = remote<number>('journal', 'seq');
  const frames = remote<Frame[]>('journal', 'frames');

  return {
    get: remote<unknown>('get') as (address?: string) => Promise<unknown>,
    set: remote<void>('set') as (address: string, value: unknown) => Promise<void>,
    call: remote<unknown>('call') as (address: string, ...args: unknown[]) => Promise<unknown>,
    models: remote<ReturnType<typeof Inspect.models>>('models') as () => Promise<ReturnType<typeof Inspect.models>>,
    tree: remote<ReturnType<typeof Inspect.tree>>('tree') as () => Promise<ReturnType<typeof Inspect.tree>>,

    journal: {
      record: record as (options?: Options) => Promise<Required<Options>>,
      seq: seq as () => Promise<number>,
      frames: frames as (query?: Query) => Promise<Frame[]>,
      history: remote<ReturnType<typeof Inspect.journal.history>>('journal', 'history') as (
        query: Query
      ) => Promise<ReturnType<typeof Inspect.journal.history>>,
      export: remote<string>('journal', 'export') as (query?: Query) => Promise<string>,
      summary: remote<Summary[]>('journal', 'summary') as (query?: Query) => Promise<Summary[]>,
      clear: remote<void>('journal', 'clear') as () => Promise<void>
    },

    async around(step: () => unknown, options: Settle = {}): Promise<Frame[]> {
      const result = await bracket({ record, seq, frames }, step, () => target.evaluate(tick), options);
      if (!result.settled) unsettled(options.timeout);
      return result.frames;
    }
  };
}
