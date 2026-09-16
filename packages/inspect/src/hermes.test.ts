import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('FinalizationRegistry', undefined);
  vi.stubGlobal('WeakRef', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('will run without FinalizationRegistry or WeakRef', async () => {
  const { State } = await import('@expressive/mvc');
  const { attach, detach, models } = await import('./index');
  class Thing extends State {
    value = 1;
  }
  attach();
  const thing = Thing.new();
  expect(models().map((m) => m.id)).toEqual([String(thing)]);
  thing.set(null);
  expect(models()).toEqual([]);
  detach();
});
