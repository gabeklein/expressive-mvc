import { expect, it } from 'vitest';

import { Column } from './column';

it('will render nothing', () => {
  expect(Column.new({ name: 'Name' }).render()).toBeNull();
});
