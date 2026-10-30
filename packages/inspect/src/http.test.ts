import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  globalThis.__EXPRESSIVE_INSPECT__ = undefined;
});

it('will install and serve the inspector', async () => {
  const { handle } = await import('./http');
  const { inspect } = await import('./index');

  expect(globalThis.__EXPRESSIVE_INSPECT__).toBe(inspect);
  expect((await handle(new Request('http://localhost/'), { ip: '127.0.0.1' })).status).toBe(200);
});
