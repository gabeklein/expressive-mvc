import { State } from '@expressive/mvc';
import { expect, it } from 'vitest';

import { inspect } from './index';

it('will attach and publish a global', async () => {
  await import('./install');
  class Thing extends State {
    value = 1;
  }
  Thing.new();
  expect(globalThis.__EXPRESSIVE_INSPECT__).toBe(inspect);
  expect(inspect.get('Thing.value')).toBe(1);
});
