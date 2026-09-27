import type { Options } from './journal';

export const SETTLE_TIMEOUT = 1000;

export interface Act {
  /** `Type.key` or `id.key` addresses that must each see a recorded frame before settling. */
  until?: string | string[];
  /** Longest to wait, in ms; default 1000. */
  timeout?: number;
  /** Recording filters for this window, instead of the journal's - `{ paths: [], types: [], keys: [] }` records everything. */
  record?: Omit<Options, 'level'>;
}

export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Wait a macrotask at a time until one passes with no new frame. Resolves `false` if `timeout` passes first. */
export async function settle(seq: () => number | Promise<number>, wait: () => unknown = tick, timeout = SETTLE_TIMEOUT) {
  const end = Date.now() + timeout;

  for (let last = await seq(); ; ) {
    await wait();

    const next = await seq();

    if (next === last) return true;
    if (Date.now() >= end) return false;

    last = next;
  }
}

export function unsettled(timeout = SETTLE_TIMEOUT, pending: string[] = []) {
  console.warn(
    pending.length
      ? `No frame for ${pending.join(', ')} within ${timeout}ms - frames may be incomplete.`
      : `Still active after ${timeout}ms - frames may be incomplete. Narrow the recording ({ record: { types, paths, keys } }) to exclude background work, or pass { timeout }.`
  );
}
