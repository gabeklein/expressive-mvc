import { State } from '@expressive/mvc';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

beforeEach(() => {
  globalThis.__EXPRESSIVE_INSPECT__ = local;
  attach();
});

afterEach(() => {
  globalThis.__EXPRESSIVE_INSPECT__ = undefined;
});

describe('inspect(page)', () => {
  it('will read, write, and call through evaluate', async () => {
    const composer = Composer.new();
    const api = inspect(page);

    expect(await api.get('Composer.draft')).toBe('');
    await api.set('Composer.draft', 'typed');
    expect(composer.draft).toBe('typed');
    expect(await api.call('Composer.submit', 'sent')).toBe(4);
    expect((await api.models())[0].type).toBe('Composer');
    expect((await api.tree())[0].id).toBe(String(composer));
  });

  it('will drive the journal', async () => {
    const composer = Composer.new();
    const api = inspect(page);

    expect((await api.journal.record({ level: 'keys', types: ['Composer'] })).types).toEqual(['Composer']);
    const since = await api.journal.seq();
    composer.draft = 'a';
    expect((await api.journal.frames({ since }))[0].events[0].key).toBe('draft');
    expect((await api.journal.history({ key: 'draft' })).length).toBe(1);
    await api.journal.clear();
    expect(await api.journal.frames()).toEqual([]);
  });

  it('will bracket a step with around and restore the level', async () => {
    const composer = Composer.new();
    const api = inspect(page);

    const frames = await api.around(() => {
      composer.submit('hi');
    });

    expect(frames[0].events[0]).toMatchObject({ key: 'draft', value: 'hi' });
    expect(journal.record().level).toBe('off');
    composer.draft = 'later';
    expect(journal.frames().length).toBe(1);
  });

  it('will leave an active journal on after around', async () => {
    const composer = Composer.new();
    const api = inspect(page);
    journal.record({ level: 'keys' });

    const frames = await api.around(() => {
      composer.draft = 'x';
    });

    expect(frames[0].events[0].value).toBeUndefined();
    expect(journal.record().level).toBe('keys');
  });

  it('will accept a locator, which passes the element first', async () => {
    const composer = Composer.new();
    const api = inspect(locator);
    expect(await api.get('Composer.draft')).toBe('');
    const frames = await api.around(() => {
      composer.draft = 'via locator';
    });
    expect(frames[0].events[0].value).toBe('via locator');
  });

  it('will throw a short error when the page has no inspector', async () => {
    globalThis.__EXPRESSIVE_INSPECT__ = undefined;
    await expect(inspect(page).get('Composer')).rejects.toThrow(/first import of the app entry/);
  });
});
