import { State } from '@expressive/mvc';
import { hot } from '@expressive/mvc/runtime';
import { describe, expect, it } from 'vitest';

import { flushMicrotasks, mockWarn } from '../test.setup';
import { act, attach, journal, models } from './index';

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

  it('will filter by path - label, typeId, or id on the left', async () => {
    attach();
    const composer = Composer.new();
    const other = Other.new();
    const typeId = models().find((m) => m.id === String(other))!.typeId;
    journal.record({ level: 'keys', paths: ['Composer.draft', `${typeId}.value`] });

    composer.draft = 'a';
    composer.rows = 2;
    other.value = 1;
    expect(journal.history({}).map((h) => `${h.event.type}.${h.event.key}`)).toEqual(['Composer.draft', 'Other.value']);

    journal.clear();
    journal.record({ paths: [`${composer}.rows`] });
    composer.draft = 'b';
    composer.rows = 3;
    expect(journal.history({}).map((h) => h.event.key)).toEqual(['rows']);
  });

  it('will filter by key on any type, and OR the filters together', () => {
    attach();
    const composer = Composer.new();
    const other = Other.new();
    journal.record({ level: 'keys', keys: ['value'], types: ['Composer'] });
    composer.rows = 2;
    other.value = 1;
    expect(journal.record().keys).toEqual(['value']);
    expect(journal.history({}).map((h) => `${h.event.type}.${h.event.key}`)).toEqual(['Composer.rows', 'Other.value']);
  });

  it('will record calls and destroy for a path-filtered type', () => {
    attach();
    journal.record({ level: 'keys', calls: true, paths: ['Composer.submit'] });
    const composer = Composer.new();
    composer.submit('x');
    composer.set(null);
    expect(journal.history({}).map((h) => h.event.kind)).toEqual(['call', 'destroy']);
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

  it('will act until work deferred across macrotasks settles', async () => {
    attach();
    const composer = Composer.new();
    const frames = await act(() => {
      setTimeout(() => {
        composer.draft = 'a';
        setTimeout(() => {
          composer.draft = 'b';
          setTimeout(() => (composer.draft = 'c'));
        });
      });
    });
    expect(frames.map((frame) => frame.events[0].value)).toEqual(['a', 'b', 'c']);
  });

  it('will act with values while keys are on, then keep recording keys', async () => {
    attach();
    journal.record({ level: 'keys' });
    const composer = Composer.new();
    const frames = await act(() => {
      composer.draft = 'x';
    });
    expect(frames[0].events[0].value).toBe('x');
    composer.draft = 'y';
    await flushMicrotasks();
    expect(journal.frames().at(-1)!.events[0].value).toBeUndefined();
    expect(journal.frames().length).toBe(2);
  });

  it('will act at values without changing the level', async () => {
    attach();
    journal.record({ level: 'values' });
    const composer = Composer.new();
    const frames = await act(() => {
      composer.draft = 'x';
    });
    expect(frames[0].events[0].value).toBe('x');
    expect(journal.record().level).toBe('values');
  });

  it('will warn when act outlasts its timeout', async () => {
    const warn = mockWarn();
    attach();
    const composer = Composer.new();
    const loop = setInterval(() => composer.rows++, 0);
    try {
      const frames = await act(() => (composer.draft = 'x'), { timeout: 20 });
      expect(frames[0].events[0].value).toBe('x');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Still active after 20ms'));
    } finally {
      clearInterval(loop);
    }
  });

  it('will record an until address the app filter excludes, then restore the filter', async () => {
    attach();
    journal.record({ level: 'keys', paths: ['Other.value'] });
    const composer = Composer.new();

    const frames = await act(() => void setTimeout(() => (composer.draft = 'late'), 5), { until: 'Composer.draft' });

    expect(frames.at(-1)!.events[0]).toMatchObject({ key: 'draft', value: 'late' });
    expect(journal.record()).toMatchObject({ level: 'keys', paths: ['Other.value'] });
  });

  it('will read a value target whatever the app records', async () => {
    attach();
    journal.record({ level: 'keys', paths: ['Other.value'] });
    const composer = Composer.new();

    await act(() => void setTimeout(() => (composer.draft = 'late'), 5), { until: { 'Composer.draft': 'late' } });

    expect(composer.draft).toBe('late');
  });

  it('will act past a write the step makes itself', async () => {
    attach();
    const composer = Composer.new();
    const frames = await act(
      () => {
        composer.draft = 'sending';
        setTimeout(() => (composer.draft = 'sent'), 20);
      },
      { until: 'Composer.draft' }
    );
    expect(frames.flatMap((frame) => frame.events.map((event) => event.value))).toEqual(['sending', 'sent']);
  });

  it('will count a write an async step awaited', async () => {
    const warn = mockWarn();
    attach();
    const composer = Composer.new();
    await act(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        composer.draft = 'done';
      },
      { until: 'Composer.draft', timeout: 200 }
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('will act until an address holds a value', async () => {
    attach();
    const composer = Composer.new();
    const frames = await act(
      () => {
        composer.draft = 'sending';
        setTimeout(() => (composer.draft = 'sent'), 20);
      },
      { until: { 'Composer.draft': 'sent' } }
    );
    expect(frames.at(-1)!.events[0].value).toBe('sent');
  });

  it('will act until an unmanaged _ key holds a value', async () => {
    class Job extends State {
      _handle: string | null = 'running';
    }

    attach();
    const job = Job.new();

    await act(() => void setTimeout(() => (job._handle = null), 5), { until: { 'Job._handle': null } });

    expect(job._handle).toBeNull();
  });

  it('will not wait for a value already held', async () => {
    const warn = mockWarn();
    attach();
    Composer.new();
    expect(await act(() => {}, { until: { 'Composer.draft': '' } })).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('will throw when a value never holds', async () => {
    attach();
    Composer.new();
    await expect(act(() => {}, { until: { 'Composer.draft': 'never' }, timeout: 20 })).rejects.toThrow(
      'Not reached within 20ms: Composer.draft.'
    );
  });

  it('will say when a value names no instance', async () => {
    attach();
    await expect(act(() => {}, { until: { 'Missing.draft': 'x' }, timeout: 20 })).rejects.toThrow(
      'Not reached within 20ms: Missing.draft (names no instance).'
    );
  });

  it('will act until an instance address sees a frame', async () => {
    attach();
    const composer = Composer.new();
    const frames = await act(
      () => {
        setTimeout(() => {
          composer.draft = 'first';
          setTimeout(() => (composer.rows = 5), 5);
        });
      },
      { until: `${composer}.rows` }
    );
    expect(frames.flatMap((frame) => frame.events.map((event) => event.key))).toEqual(['draft', 'rows']);
  });

  it('will summarize frames per instance, latest first', async () => {
    attach();
    journal.record({ level: 'values', calls: true });
    const composer = Composer.new();
    const other = Other.new();

    composer.submit('a');
    await flushMicrotasks();
    composer.draft = 'b';
    await flushMicrotasks();
    other.set(null);
    await flushMicrotasks();

    const [first, second] = journal.summary();

    expect(first).toMatchObject({ id: String(other), destroyed: true });
    expect(second).toMatchObject({
      id: String(composer),
      type: 'Composer',
      keys: { draft: { count: 2, value: 'b' } },
      calls: { submit: 1 },
      destroyed: false
    });
    expect(first.last).toBeGreaterThan(second.last);
    expect(journal.summary({ type: 'Composer' })).toHaveLength(1);
  });

  it('will summarize keys without values below values level', async () => {
    attach();
    journal.record({ level: 'keys' });
    const composer = Composer.new();

    composer.draft = 'x';
    await flushMicrotasks();

    expect(journal.summary()[0].keys).toEqual({ draft: { count: 1 } });
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

describe('hot', () => {
  let count = 0;

  const version = (step: number, extra?: boolean) => {
    class Counter extends State {
      value = 0;
      bump() {
        this.value += step;
      }
    }

    if (extra)
      Object.defineProperty(Counter.prototype, 'reset', {
        configurable: true,
        writable: true,
        value(this: Counter) {
          this.value = 0;
        }
      });

    return Counter;
  };

  it('will follow a hot patch while recording calls', async () => {
    const id = `journal-${count++}`;

    attach();
    journal.record({ level: 'keys', calls: true });

    const Counter = version(1);

    hot.accept(id, { Counter });

    const counter = Counter.new();

    counter.bump();
    hot.accept(id, { Counter: version(10, true) });
    await flushMicrotasks();

    counter.bump();
    (counter as any).reset();
    await flushMicrotasks();

    const events = journal.frames().flatMap((frame) => frame.events);

    expect(counter.value).toBe(0);
    expect(events.filter((event) => event.kind == 'call').map((event) => event.key)).toEqual(['bump', 'bump', 'reset']);
  });

  it('will follow an inherited method while recording calls', async () => {
    const id = `journal-${count++}`;

    attach();
    journal.record({ level: 'keys', calls: true });

    const Counter = version(1);

    hot.accept(id, { Counter });

    class Sub extends Counter {}

    const sub = Sub.new();

    hot.accept(id, { Counter: version(10) });
    await flushMicrotasks();

    sub.bump();

    expect(sub.value).toBe(10);
  });

  it('will record a patch as hot', async () => {
    const id = `journal-${count++}`;

    attach();
    journal.record({ level: 'keys' });

    const Counter = version(1);

    hot.accept(id, { Counter });

    const counter = Counter.new();

    hot.accept(id, { Counter: version(10) });
    await flushMicrotasks();

    expect(journal.frames().flatMap((frame) => frame.events)).toEqual([
      { id: String(counter), type: 'Counter', key: 'patch', kind: 'hot' }
    ]);
    expect(journal.summary()[0].hot).toBe(1);
  });

  it('will not record a patch filtered out', async () => {
    const id = `journal-${count++}`;

    attach();
    journal.record({ level: 'keys', types: ['Other'] });

    const Counter = version(1);

    hot.accept(id, { Counter });
    Counter.new();
    hot.accept(id, { Counter: version(10) });
    await flushMicrotasks();

    expect(journal.frames()).toEqual([]);
  });

  it('will record a page-level hot update while on', async () => {
    journal.hot('update', ['/src/app.ts']);
    expect(journal.frames()).toEqual([]);

    journal.record({ level: 'keys' });
    journal.hot('update', ['/src/app.ts']);
    journal.hot('reload');

    expect(journal.frames()[0].events).toEqual([
      { id: '', type: 'vite', key: 'update', kind: 'hot', value: ['/src/app.ts'] },
      { id: '', type: 'vite', key: 'reload', kind: 'hot' }
    ]);
    expect(journal.summary()).toEqual([]);
  });
});
