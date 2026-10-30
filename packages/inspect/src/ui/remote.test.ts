import { describe, expect, it, vi } from 'vitest';

import { remote } from './remote';

describe('remote', () => {
  it('will dispatch method calls through send', async () => {
    const send = vi.fn(async (call: unknown) => call);
    const api = remote(send);

    await api.get('Composer.draft');
    await api.get('Composer', { draft: true }, { depth: 4 });
    await api.set('Composer.draft', 'x');
    await api.call('Composer.submit', 'x', 1);
    await api.models();
    await api.tree();
    await api.health();
    await api.journal.record({ level: 'keys' });
    await api.journal.seq();
    await api.journal.frames({ since: 3 });
    await api.journal.clear();

    expect(send.mock.calls.map(([call]) => call)).toEqual([
      [['get'], ['Composer.draft']],
      [['get'], ['Composer', { draft: true }, { depth: 4 }]],
      [['set'], ['Composer.draft', 'x']],
      [['call'], ['Composer.submit', 'x', 1]],
      [['models'], []],
      [['tree'], []],
      [['health'], []],
      [['journal', 'record'], [{ level: 'keys' }]],
      [['journal', 'seq'], []],
      [['journal', 'frames'], [{ since: 3 }]],
      [['journal', 'clear'], []]
    ]);
  });
});
