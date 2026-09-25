export const SETTLE_TIMEOUT = 1000;

export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Wait a macrotask at a time until one passes with no new frame, for at most `SETTLE_TIMEOUT`. */
export async function settle(seq: () => number | Promise<number>, wait: () => unknown = tick) {
  const end = Date.now() + SETTLE_TIMEOUT;

  for (let last, next = await seq(); last !== next && Date.now() < end; next = await seq()) {
    last = next;
    await wait();
  }
}
