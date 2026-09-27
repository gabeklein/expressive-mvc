import type { Frame, Options, Query } from './journal';
import { settle, type Settle } from './settle';

export interface Remote {
  record(options?: Options): Required<Options> | Promise<Required<Options>>;
  seq(): number | Promise<number>;
  frames(query: Query): Frame[] | Promise<Frame[]>;
}

/** Run `step` recording values, settle, and return what it produced; the prior level is restored. */
export async function bracket(remote: Remote, step: () => unknown, wait: () => unknown, { timeout }: Settle = {}) {
  const before = await remote.record();
  const since = await remote.seq();

  if (before.level !== 'values') await remote.record({ level: 'values' });

  try {
    const value = await step();
    const settled = await settle(remote.seq, wait, timeout);

    return { value, frames: await remote.frames({ since }), settled };
  } finally {
    if (before.level !== 'values') await remote.record({ level: before.level });
  }
}
