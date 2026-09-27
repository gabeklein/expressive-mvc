import type { Event, Frame, Options, Query } from './journal';
import { SETTLE_TIMEOUT, settle, type Act } from './settle';

export interface Remote {
  record(options?: Options): Required<Options> | Promise<Required<Options>>;
  seq(): number | Promise<number>;
  frames(query: Query): Frame[] | Promise<Frame[]>;
  get(address: string): unknown;
}

/** Resolve `address.key` to the instance `address` names - label, id, or owner path - so frames match it alone. */
async function locate(remote: Remote, target: string) {
  const dot = target.lastIndexOf('.');
  const found = (await remote.get(target.slice(0, dot))) as { $ref?: string } | undefined;
  const key = target.slice(dot + 1);

  return (event: Event) => event.key === key && event.id === found?.$ref;
}

/**
 * Run `step` recording values, wait for `until`, settle, and return what it produced; the prior recording is restored.
 * `local` steps run here, so activity for `until` counts once their synchronous writes flush, not once they resolve.
 */
export async function bracket(
  remote: Remote,
  step: () => unknown,
  wait: () => unknown,
  { until = [], timeout = SETTLE_TIMEOUT, record }: Act = {},
  local?: boolean
) {
  const before = await remote.record();
  const since = await remote.seq();

  await remote.record({ ...record, level: 'values' });

  try {
    const running = step();
    let from: number | undefined;

    if (local) {
      await undefined;
      from = await remote.seq();
    }

    const value = await running;

    from ??= await remote.seq();
    const end = Date.now() + timeout;
    const values = typeof until == 'string' || Array.isArray(until) ? undefined : until;
    const pending = new Set(values ? Object.keys(values) : ([] as string[]).concat(until as string | string[]));
    const matchers = new Map<string, (event: Event) => boolean>();

    if (!values) for (const target of pending) matchers.set(target, await locate(remote, target));

    while (pending.size) {
      if (values) {
        for (const address of pending)
          if (JSON.stringify(await remote.get(address)) === JSON.stringify(values[address])) pending.delete(address);
      } else
        for (const frame of await remote.frames({ since: from }))
          for (const event of frame.events)
            for (const target of pending) if (matchers.get(target)!(event)) pending.delete(target);

      if (!pending.size || Date.now() >= end) break;

      await wait();
    }

    const settled = !pending.size && (await settle(remote.seq, wait, Math.max(0, end - Date.now())));

    return { value, frames: await remote.frames({ since }), settled, pending: [...pending] };
  } finally {
    await remote.record(before);
  }
}
