import { expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  const react = { ...(actual.default ?? actual), useSyncExternalStore: undefined };

  return { ...actual, default: react, useSyncExternalStore: undefined };
});

it('will not validate without useSyncExternalStore', async () => {
  const { Runtime } = await import('./runtime');

  await import('./index');

  expect(Runtime.useRevision).toBeUndefined();
});
