import { describe, expect, it, vi } from 'vitest';

import { mockPromise } from '../../test.setup';
import { Source } from './source';

class Pages extends Source<number> {
  query = vi.fn(async (offset: number) =>
    offset < 4 ? [offset, offset + 1] : []
  );
}

describe('more', () => {
  it('will append pages from current offset', async () => {
    const source = Pages.new();

    await source.more();
    await source.more();

    expect(source.data).toEqual([0, 1, 2, 3]);
    expect(source.query).toHaveBeenNthCalledWith(2, 2);
  });

  it('will mark done on an empty page', async () => {
    const source = Pages.new();

    await source.more();
    await source.more();
    await source.more();

    expect(source.done).toBe(true);
    expect(source.empty).toBe(false);
  });

  it('will not query once done', async () => {
    const source = Pages.new({ done: true });

    await source.more();

    expect(source.query).not.toHaveBeenCalled();
  });

  it('will not re-enter while loading', async () => {
    const promise = mockPromise<number[]>();
    const source = Pages.new();

    source.query.mockReturnValueOnce(promise);

    const first = source.more();

    expect(source.loading).toBe(true);

    await source.more();
    expect(source.query).toHaveBeenCalledTimes(1);

    promise.resolve([1]);
    await first;

    expect(source.loading).toBe(false);
    expect(source.data).toEqual([1]);
  });

  it('will treat a missing page as exhaustion', async () => {
    const source = Pages.new();

    source.query.mockResolvedValueOnce(undefined as any);
    await source.more();

    expect(source.done).toBe(true);
    expect(source.empty).toBe(true);
  });

  it('will capture an error', async () => {
    const error = new Error('nope');
    const source = Pages.new();

    source.query.mockRejectedValueOnce(error);
    await source.more();

    expect(source.error).toBe(error);
    expect(source.loading).toBe(false);
  });

  it('will wrap a non-error', async () => {
    const source = Pages.new();

    source.query.mockRejectedValueOnce('nope');
    await source.more();

    expect(source.error?.message).toBe('nope');
  });
});

it('will reset', async () => {
  const source = Pages.new();

  source.query.mockRejectedValueOnce(new Error());
  await source.more();
  await source.more();
  await source.more();
  await source.more();

  source.reset();

  expect(source.data).toEqual([]);
  expect(source.done).toBe(false);
  expect(source.error).toBeUndefined();
});
