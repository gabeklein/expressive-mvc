import { afterEach, describe, expect, it, vi } from 'vitest';

import { SETTLE_TIMEOUT, settle, unsettled } from './settle';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('settle', () => {
  it('will wait until the sequence stops moving', async () => {
    const seen = [1, 2, 3, 3];
    const seq = vi.fn(() => seen.shift()!);
    const wait = vi.fn();

    await settle(seq, wait);

    expect(seq).toHaveBeenCalledTimes(4);
    expect(wait).toHaveBeenCalledTimes(3);
  });

  it('will give up after the timeout', async () => {
    let now = 0;
    let n = 0;

    vi.spyOn(Date, 'now').mockImplementation(() => now);

    await settle(
      () => n++,
      () => {
        now += SETTLE_TIMEOUT / 4;
      }
    );

    expect(n).toBe(5);
  });

  it('will resolve whether it went quiet', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    let n = 0;

    expect(await settle(() => 1, () => {})).toBe(true);
    expect(await settle(() => n++, () => (now += 10), 30)).toBe(false);
    expect(n).toBe(4);
  });

  it('will wait one macrotask even with no timeout', async () => {
    const wait = vi.fn();
    expect(await settle(() => 1, wait, 0)).toBe(true);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it('will wait a macrotask by default', async () => {
    let n = 0;
    const done = settle(() => Math.min(n++, 1));

    await done;

    expect(n).toBe(3);
  });

  it('will warn with the default timeout', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    unsettled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`Still active after ${SETTLE_TIMEOUT}ms`));
  });
});
