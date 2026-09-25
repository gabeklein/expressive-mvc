import { afterEach, describe, expect, it, vi } from 'vitest';

import { SETTLE_TIMEOUT, settle } from './settle';

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

  it('will wait a macrotask by default', async () => {
    let n = 0;
    const done = settle(() => Math.min(n++, 1));

    await done;

    expect(n).toBe(3);
  });
});
