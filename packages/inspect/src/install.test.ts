import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  globalThis.__EXPRESSIVE_INSPECT__ = undefined;
});

async function load() {
  const { State } = await import('@expressive/mvc');
  const index = await import('./index');
  await import('./install');
  return { State, ...index };
}

it('will attach and publish a global', async () => {
  const { State, inspect, journal } = await load();

  class Thing extends State {
    value = 1;
  }

  Thing.new();
  expect(globalThis.__EXPRESSIVE_INSPECT__).toBe(inspect);
  expect(inspect.get('Thing.value')).toBe(1);
  expect(journal.record().level).toBe('off');
});

it('will record from boot as a preset global asks', async () => {
  globalThis.__EXPRESSIVE_INSPECT__ = { record: { level: 'values' } } as never;
  const { State, inspect, journal } = await load();

  class Booting extends State {
    value = 1;
  }

  Booting.new().value = 2;
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(globalThis.__EXPRESSIVE_INSPECT__).toBe(inspect);
  expect(journal.frames({ since: 0 }).flatMap((frame) => frame.events.map((event) => event.value))).toContain(2);
  inspect.detach();
});
