import type { Event, Frame, Options, Query } from './journal';
import { SETTLE_TIMEOUT, settle, type Act } from './settle';

export interface Remote {
  record(options?: Options): Required<Options> | Promise<Required<Options>>;
  seq(): number | Promise<number>;
  frames(query: Query): Frame[] | Promise<Frame[]>;
}

const hits = (target: string, event: Event) => {
  const dot = target.indexOf('.');
  return event.key === target.slice(dot + 1) && (event.type === target.slice(0, dot) || event.id === target.slice(0, dot));
};

/** Run `step` recording values, wait for `until`, settle, and return what it produced; the prior recording is restored. */
export async function bracket(remote: Remote, step: () => unknown, wait: () => unknown, { until = [], timeout = SETTLE_TIMEOUT, record }: Act = {}) {
  const before = await remote.record();
  const since = await remote.seq();

  await remote.record({ ...record, level: 'values' });

  try {
    const value = await step();
    const end = Date.now() + timeout;
    const pending = new Set(([] as string[]).concat(until));

    while (pending.size) {
      for (const frame of await remote.frames({ since }))
        for (const event of frame.events)
          for (const target of pending) if (hits(target, event)) pending.delete(target);

      if (!pending.size || Date.now() >= end) break;

      await wait();
    }

    const settled = !pending.size && (await settle(remote.seq, wait, Math.max(0, end - Date.now())));

    return { value, frames: await remote.frames({ since }), settled, pending: [...pending] };
  } finally {
    await remote.record(before);
  }
}
