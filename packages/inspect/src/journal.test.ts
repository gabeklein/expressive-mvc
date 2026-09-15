import { State } from '@expressive/mvc';
import { describe, expect, it } from 'vitest';

import { flushMicrotasks } from '../test.setup';
import { act, attach, journal } from './index';

class Composer extends State {
  draft = '';
  rows = 1;

  submit(text: string) {
    this.draft = text;
    return text.length;
  }
}

class Other extends State {
  value = 0;
}

describe('journal', () => {
  it('will record nothing until enabled', async () => {
    attach();
    const composer = Composer.new();
    composer.draft = 'a';
    await flushMicrotasks();
    expect(journal.frames()).toEqual([]);
  });

  it('will group synchronous writes into one frame', async () => {
    attach();
    journal.record({ level: 'keys' });
    const composer = Composer.new();
    composer.draft = 'a';
    composer.rows = 2;
    await flushMicrotasks();
    composer.rows = 3;
    await flushMicrotasks();

    const frames = journal.frames();
    expect(frames.length).toBe(2);
    expect(frames[0].events.map((e) => e.key)).toEqual(['draft', 'rows']);
    expect(frames[0].events[0]).toMatchObject({ id: String(composer), type: 'Composer', kind: 'update' });
    expect(frames[0].events[0].value).toBeUndefined();
    expect(frames[1].seq).toBe(2);
  });

  it('will include values when asked', async () => {
    attach();
    journal.record({ level: 'values' });
    const composer = Composer.new();
    composer.draft = 'hello';
    expect(journal.history({ key: 'draft' }).map((h) => h.event.value)).toEqual(['hello']);
  });

  it('will filter by type, id, key, and since', async () => {
    attach();
    journal.record({ level: 'keys' });
    const composer = Composer.new();
    const other = Other.new();
    composer.draft = 'a';
    other.value = 1;
    await flushMicrotasks();
    other.value = 2;

    expect(journal.frames({ type: 'Other' }).flatMap((f) => f.events.map((e) => e.key))).toEqual(['value', 'value']);
    expect(journal.frames({ id: String(composer) }).length).toBe(1);
    expect(journal.frames({ since: 1 }).length).toBe(1);
    expect(journal.history({ key: 'draft' }).length).toBe(1);
    expect(journal.record().types).toEqual([]);
  });

  it('will restrict to named types', () => {
    attach();
    journal.record({ level: 'keys', types: ['Other'] });
    const composer = Composer.new();
    const other = Other.new();
    composer.draft = 'a';
    other.value = 1;
    expect(journal.frames().flatMap((f) => f.events.map((e) => e.type))).toEqual(['Other']);
  });

  it('will record custom events, calls, and destroy', () => {
    attach();
    journal.record({ level: 'values', calls: true });
    const composer = Composer.new();
    expect(composer.submit('hey')).toBe(3);
    composer.set('custom');
    composer.set(null);

    const kinds = journal.frames().flatMap((f) => f.events.map((e) => [e.kind, e.key]));
    expect(kinds).toEqual([
      ['call', 'submit'],
      ['update', 'draft'],
      ['event', 'custom'],
      ['destroy', '']
    ]);
    expect(journal.history({ key: 'submit' })[0].event.args).toEqual(['hey']);
  });

  it('will wrap already-live instances when calls turn on', () => {
    attach();
    const composer = Composer.new();
    journal.record({ calls: true });
    journal.record({ calls: true });
    composer.submit('x');
    const calls = journal.history({ key: 'submit' });
    expect(calls.length).toBe(1);
    expect(calls[0].event.args).toBeUndefined();
  });

  it('will not record calls unless asked', () => {
    attach();
    journal.record({ level: 'keys' });
    const composer = Composer.new();
    composer.submit('x');
    expect(journal.history({ key: 'submit' })).toEqual([]);
  });

  it('will not record calls for excluded types', () => {
    attach();
    journal.record({ level: 'keys', calls: true, types: ['Other'] });
    const composer = Composer.new();
    composer.submit('x');
    expect(journal.frames()).toEqual([]);
  });

  it('will clear frames and reset sequence', () => {
    attach();
    journal.record({ level: 'keys' });
    const composer = Composer.new();
    composer.draft = 'a';
    journal.clear();
    expect(journal.frames()).toEqual([]);
    composer.draft = 'b';
    expect(journal.frames()[0].seq).toBe(1);
  });

  it('will link frames scheduled by a flush through cause', async () => {
    class Reactor extends State {
      input = 0;
      output = 0;

      constructor() {
        super();
        this.get((self) => {
          const next = self.input * 2;
          queueMicrotask(() => {
            self.output = next;
          });
        });
      }
    }
    attach();
    journal.record({ level: 'keys' });
    const reactor = Reactor.new();
    await flushMicrotasks();
    journal.clear();

    reactor.input = 2;
    await flushMicrotasks();
    reactor.input = 3;
    await flushMicrotasks();

    const frames = journal.frames();
    expect(frames.map((f) => [f.seq, f.cause, f.events[0].key])).toEqual([
      [1, undefined, 'input'],
      [2, 1, 'output'],
      [3, undefined, 'input'],
      [4, 3, 'output']
    ]);
    expect(journal.downstream(1).map((f) => f.seq)).toEqual([2]);
    expect(journal.frames({ cause: 3 }).map((f) => f.seq)).toEqual([4]);
    expect(journal.seq()).toBe(4);

    expect(journal.export().split('\n').length).toBe(4);
    const lines = journal.export({ since: 3 }).split('\n');
    expect(lines.length).toBe(1);
    expect(JSON.parse(lines[0])).toMatchObject({ seq: 4, cause: 3, key: 'output' });
  });

  it('will act without leaving recording on', async () => {
    attach();
    const composer = Composer.new();
    const frames = await act(() => {
      composer.draft = 'x';
    });
    expect(frames[0].events[0].value).toBe('x');
    composer.draft = 'y';
    expect(journal.frames().length).toBe(1);
  });

  it('will act while recording is already on', async () => {
    attach();
    journal.record({ level: 'keys' });
    const composer = Composer.new();
    const frames = await act(() => {
      composer.draft = 'x';
    });
    expect(frames[0].events[0].value).toBeUndefined();
    composer.draft = 'y';
    expect(journal.frames().length).toBe(2);
  });

  it('will cap retained frames', async () => {
    attach();
    journal.record({ level: 'keys' });
    const composer = Composer.new();
    for (let i = 0; i < 505; i++) {
      composer.rows = i;
      await flushMicrotasks();
    }
    const frames = journal.frames();
    expect(frames.length).toBe(500);
    expect(frames[0].seq).toBe(6);
  });
});
