import type { inspect as Inspect } from './index';
import type { Frame, Options, Query } from './journal';

/**
 * Anything that can run a function in the page: Playwright `Page`, `Frame`, or
 * `Locator` (which passes the element first), puppeteer `Page` or `Frame`.
 */
export interface Evaluates {
  evaluate(fn: (...args: any[]) => unknown, arg?: unknown): Promise<unknown>;
}

type Call = [path: string[], args: unknown[]];

function bridge(first: unknown, second?: unknown) {
  const call = (second ?? first) as Call;
  const api = (globalThis as { __EXPRESSIVE_INSPECT__?: Record<string, unknown> }).__EXPRESSIVE_INSPECT__;

  if (!api)
    throw new Error(
      "@expressive/inspect is not attached in this page - make '@expressive/inspect/install' the first import of the app entry."
    );

  let target: unknown = api;
  let owner: unknown;

  for (const key of call[0]) {
    owner = target;
    target = (target as Record<string, unknown>)[key];
  }

  return (target as Function).apply(owner, call[1]);
}

/**
 * Drive the page's inspector from a test. Every method is one `evaluate`;
 * `around` brackets a step with the journal forced on and returns its frames.
 */
export function inspect(target: Evaluates) {
  const remote =
    <R>(...path: string[]) =>
    (...args: unknown[]) =>
      target.evaluate(bridge, [path, args] as Call) as Promise<R>;

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
      clear: remote<void>('journal', 'clear') as () => Promise<void>
    },

    async around(step: () => unknown): Promise<Frame[]> {
      const before = await record();
      const since = await seq();

      if (before.level === 'off') await record({ level: 'values' });

      try {
        await step();
        await target.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
        return await frames({ since });
      } finally {
        if (before.level === 'off') await record({ level: 'off' });
      }
    }
  };
}
