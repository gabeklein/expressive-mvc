export const SETTLE_TIMEOUT = 1000;

export interface Settle {
  /** Longest to wait for quiet, in ms; default 1000. */
  timeout?: number;
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
    `Still active after ${timeout}ms - frames may be incomplete. Narrow journal.record({ types, paths, keys }) to exclude background work, or pass { timeout }.`
  );
}
