import { expect, it, vi } from 'vitest';

import '.';
import { seam } from './element';
import { Runtime } from './runtime';

it('will seam host elements without a dev store', () => {
  const template = { $$typeof: Symbol.for('react.transitional.element') };

  vi.spyOn(Runtime, 'createElement').mockReturnValueOnce(template);

  const self = {} as any;
  const type = () => null;

  expect(seam(self, false, type, 'key')).toBe(template.$$typeof);
  expect(self.type).toBe(type);
  expect(self.key).toBe('key');
});
