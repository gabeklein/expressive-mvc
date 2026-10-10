import { State } from '@expressive/mvc';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { mockWarn } from '../test.setup';

import { attach, inspect as local, journal } from './index';
import { inspect, type Evaluates } from './bridge';

class Composer extends State {
  draft = '';

  submit(text: string) {
    this.draft = text;
    return text.length;
  }
}

const page: Evaluates = {
  evaluate: async (fn, arg) => fn(arg)
};

const locator: Evaluates = {
  evaluate: async (fn, arg) => fn({ tagName: 'BODY' }, arg)
};

let composer: Composer;
let api: ReturnType<typeof inspect>;

beforeEach(() => {
  globalThis.__EXPRESSIVE_INSPECT__ = local;
  attach();
  composer = Composer.new();
  api = inspect(page);
});

afterEach(() => {
  globalThis.__EXPRESSIVE_INSPECT__ = undefined;
});

describe('inspect(page)', () => {
  it('will read, write, and call through evaluate', async () => {
    expect(await api.get('Composer.draft')).toBe('');
    await api.set('Composer.draft', 'typed');
    expect(composer.draft).toBe('typed');
    expect(await api.call('Composer.submit', 'sent')).toBe(4);
    expect((await api.models())[0].type).toBe('Composer');
    expect((await api.tree())[0].id).toBe(String(composer));
    expect((await api.health()).copies).toBe(1);
  });

  it('will read a selection in one call', async () => {
    expect(await api.get('Composer', { draft: true })).toEqual({ $ref: String(composer), $type: 'Composer', draft: '' });
  });

  it('will drive the journal', async () => {
    expect((await api.journal.record({ level: 'keys', types: ['Composer'] })).types).toEqual(['Composer']);
    const since = await api.journal.seq();
    composer.draft = 'a';
    expect((await api.journal.frames({ since }))[0].events[0].key).toBe('draft');
    expect((await api.journal.history({ key: 'draft' })).length).toBe(1);
    expect(JSON.parse(await api.journal.export({ since }))).toMatchObject({ key: 'draft', kind: 'update' });
    await api.journal.clear();
    expect(await api.journal.frames()).toEqual([]);
  });

  it('will bracket a step with act and restore the level', async () => {
    const frames = await api.act(() => composer.submit('hi'));

    expect(frames[0].events[0]).toMatchObject({ key: 'draft', value: 'hi' });
    expect(journal.record().level).toBe('off');
    composer.draft = 'later';
    expect(journal.frames().length).toBe(1);
  });

  it('will wait a step until deferred work settles', async () => {
    const frames = await api.act(() => {
      setTimeout(() => {
        composer.draft = 'a';
        setTimeout(() => (composer.draft = 'b'));
      });
    });

    expect(frames.map((frame) => frame.events[0].value)).toEqual(['a', 'b']);
  });

  it('will record its own filters for the window and restore the journal after', async () => {
    journal.record({ level: 'keys', types: ['Other'] });

    const frames = await api.act(() => void (composer.draft = 'x'), { record: { types: [] } });

    expect(frames[0].events[0]).toMatchObject({ type: 'Composer', value: 'x' });
    expect(journal.record()).toMatchObject({ level: 'keys', types: ['Other'] });
  });

  it('will wait until a target sees a frame', async () => {
    const frames = await api.act(
      () => void setTimeout(() => setTimeout(() => setTimeout(() => (composer.draft = 'late'), 5))),
      { until: 'Composer.draft' }
    );

    expect(frames.at(-1)!.events[0]).toMatchObject({ key: 'draft', value: 'late' });
  });

  it('will wait until an address holds a value', async () => {
    const frames = await api.act(
      async () => {
        composer.draft = 'sending';
        setTimeout(() => (composer.draft = 'sent'), 20);
      },
      { until: { 'Composer.draft': 'sent' } }
    );

    expect(frames.flatMap((frame) => frame.events.map((event) => event.value))).toEqual(['sending', 'sent']);
  });

  it('will throw naming a target that never saw a frame, with the bridge caveat', async () => {
    await expect(api.act(() => {}, { until: ['Composer.draft'], timeout: 20 })).rejects.toThrow(
      /^Not reached within 20ms: Composer\.draft\. On the bridge, activity counts once the step resolves/
    );
  });

  it('will throw for an unmet value without the caveat', async () => {
    await expect(api.act(() => {}, { until: { 'Composer.draft': 'x' }, timeout: 20 })).rejects.toThrow(
      /^Not reached within 20ms: Composer\.draft\.$/
    );
  });

  it('will warn when act outlasts its timeout', async () => {
    const warn = mockWarn();
    const loop = setInterval(() => (composer.draft += '.'), 0);

    try {
      await api.act(() => {}, { timeout: 20 });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Still active after 20ms'));
    } finally {
      clearInterval(loop);
    }
  });

  it('will summarize the journal', async () => {
    await api.act(() => void (composer.draft = 'x'));
    expect(await api.journal.summary()).toMatchObject([{ type: 'Composer', keys: { draft: { count: 1, value: 'x' } } }]);
  });

  it('will accept a locator, which passes the element first', async () => {
    const api = inspect(locator);
    expect(await api.get('Composer.draft')).toBe('');
    const frames = await api.act(() => void (composer.draft = 'via locator'));
    expect(frames[0].events[0].value).toBe('via locator');
  });

  it('will throw a short error when the page has no inspector', async () => {
    globalThis.__EXPRESSIVE_INSPECT__ = undefined;
    await expect(api.get('Composer')).rejects.toThrow(/first import of the app entry/);
  });
});
