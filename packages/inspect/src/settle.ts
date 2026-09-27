import type { Options } from './journal';

export const SETTLE_TIMEOUT = 1000;

export interface Act {
  /**
   * What to wait for before settling: `Type.key` / `id.key` addresses that must each see a frame after the
   * step's synchronous writes, or `{ [address]: value }` pairs that must each hold that value.
   */
  until?: string | string[] | Record<string, unknown>;
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

export function unsettled(timeout = SETTLE_TIMEOUT) {
  console.warn(
    `Still active after ${timeout}ms - frames may be incomplete. Narrow the recording ({ record: { types, paths, keys } }) to exclude background work, or pass { timeout }.`
  );
}

/** `until` not met within `timeout` - carries the frames recorded so far and what never arrived. */
export function unreached(timeout: number, pending: string[], missing: string[], frames: unknown[], hint = '') {
  const list = pending.map((address) => (missing.includes(address) ? `${address} (names no instance)` : address));
  return Object.assign(new Error(`Not reached within ${timeout}ms: ${list.join(', ')}.${hint}`), { frames, pending });
}
