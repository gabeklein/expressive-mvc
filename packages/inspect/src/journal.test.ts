import { State, unbind } from '@expressive/mvc';
import * as hot from '@expressive/mvc/hot';
import { beforeEach, describe, expect, it } from 'vitest';

import { flushMicrotasks, mockWarn } from '../test.setup';
import { act, attach, journal, models, type Options } from './index';

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

const start = (options?: Options) => {
  attach();
  if (options) journal.record(options);
  return Composer.new();
};

describe('journal', () => {
  it('will record nothing until enabled', async () => {
    start().draft = 'a';
    await flushMicrotasks();
    expect(journal.frames()).toEqual([]);
  });

  it('will group synchronous writes into one frame', async () => {
    const composer = start({ level: 'keys' });
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
    start({ level: 'values' }).draft = 'hello';
    expect(journal.history({ key: 'draft' }).map((h) => h.event.value)).toEqual(['hello']);
  });

  it('will filter by type, id, key, and since', async () => {
    const composer = start({ level: 'keys' });
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
    const composer = start({ level: 'keys', types: ['Other'] });
    const other = Other.new();
    composer.draft = 'a';
    other.value = 1;
    expect(journal.frames().flatMap((f) => f.events.map((e) => e.type))).toEqual(['Other']);
  });

  it('will filter by path - label, typeId, or id on the left', async () => {
    const composer = start();
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
    const composer = start({ level: 'keys', keys: ['value'], types: ['Composer'] });
    composer.rows = 2;
    Other.new().value = 1;
    expect(journal.record().keys).toEqual(['value']);
    expect(journal.history({}).map((h) => `${h.event.type}.${h.event.key}`)).toEqual(['Composer.rows', 'Other.value']);
  });

  it('will record calls and destroy for a path-filtered type', () => {
    const composer = start({ level: 'keys', calls: true, paths: ['Composer.submit'] });
    composer.submit('x');
    composer.set(null);
    expect(journal.history({}).map((h) => h.event.kind)).toEqual(['call', 'destroy']);
  });

  it('will record custom events, calls, and destroy', () => {
    const composer = start({ level: 'values', calls: true });
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

  it('will record calls of live instances once calls turn on', () => {
    const composer = start();
    journal.record({ calls: true });
    journal.record({ calls: true });
    composer.submit('x');
    const calls = journal.history({ key: 'submit' });
    expect(calls.length).toBe(1);
    expect(calls[0].event.args).toBeUndefined();
  });

  it('will record a method replaced through set', () => {
    const composer = start({ level: 'values', calls: true });
    composer.submit('a');
    composer.set({ submit: (text: string) => text.length * 2 });
    expect(composer.submit('bb')).toBe(4);
    expect(journal.history({ key: 'submit' }).map((h) => h.event.args)).toEqual([['a'], ['bb']]);
  });

  it('will keep this for a replaced method called unbound', () => {
    class Test extends State {
      self(): unknown {
        return undefined;
      }
    }

    start({ level: 'keys', calls: true });
    const test = Test.new();
    const other = {};
    test.set({ self() { return this; } });
    expect(unbind(test.self).call(other)).toBe(other);
  });

  it('will not record calls of a class bootstrapped before attach', () => {
    class Early extends State {
      go() {}
    }

    Early.new();
    start({ level: 'keys', calls: true });
    const early = Early.new();
    early.go();
    early.go();
    expect(journal.history({ key: 'go' })).toEqual([]);
  });

  it('will record a super call once', () => {
    class Base extends State {
      go() {
        return 1;
      }
    }

    class Sub extends Base {
      go() {
        return super.go() + 1;
      }
    }

    start({ level: 'keys', calls: true });
    expect(Sub.new().go()).toBe(2);
    expect(journal.history({ key: 'go' }).length).toBe(1);
  });

  it('will not record render', () => {
    class View extends State {
      render() {
        return null;
      }
    }

    start({ level: 'keys', calls: true });
    View.new().render();
    expect(journal.history({ key: 'render' })).toEqual([]);
  });

  it('will stop recording calls once turned off', () => {
    const composer = start({ level: 'keys', calls: true });
    composer.submit('a');
    journal.record({ calls: false });
    composer.submit('b');
    expect(journal.history({ key: 'submit' }).length).toBe(1);
  });

  it.each([
    ['unless asked', { level: 'keys' }],
    ['for excluded types', { level: 'keys', calls: true, types: ['Other'] }]
  ] as [string, Options][])('will not record calls %s', (_, options) => {
    start(options).submit('x');
    expect(journal.history({ key: 'submit' })).toEqual([]);
  });

  it('will clear frames and reset sequence', () => {
    const composer = start({ level: 'keys' });
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
    start({ level: 'keys' });
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
    const composer = start();
    const frames = await act(() => void (composer.draft = 'x'));
    expect(frames[0].events[0].value).toBe('x');
    composer.draft = 'y';
    expect(journal.frames().length).toBe(1);
  });

  it('will act until work deferred across macrotasks settles', async () => {
    const composer = start();
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
    const composer = start({ level: 'keys' });
    const frames = await act(() => void (composer.draft = 'x'));
    expect(frames[0].events[0].value).toBe('x');
    composer.draft = 'y';
    await flushMicrotasks();
    expect(journal.frames().at(-1)!.events[0].value).toBeUndefined();
    expect(journal.frames().length).toBe(2);
  });

  it('will act at values without changing the level', async () => {
    const composer = start({ level: 'values' });
    const frames = await act(() => void (composer.draft = 'x'));
    expect(frames[0].events[0].value).toBe('x');
    expect(journal.record().level).toBe('values');
  });

  it('will warn when act outlasts its timeout', async () => {
    const warn = mockWarn();
    const composer = start();
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
    const composer = start({ level: 'keys', paths: ['Other.value'] });

    const frames = await act(() => void setTimeout(() => (composer.draft = 'late'), 5), { until: 'Composer.draft' });

    expect(frames.at(-1)!.events[0]).toMatchObject({ key: 'draft', value: 'late' });
    expect(journal.record()).toMatchObject({ level: 'keys', paths: ['Other.value'] });
  });

  it('will read a value target whatever the app records', async () => {
    const composer = start({ level: 'keys', paths: ['Other.value'] });
    await act(() => void setTimeout(() => (composer.draft = 'late'), 5), { until: { 'Composer.draft': 'late' } });
    expect(composer.draft).toBe('late');
  });

  it.each([
    ['past a write the step makes itself', 'Composer.draft'],
    ['until an address holds a value', { 'Composer.draft': 'sent' }]
  ])('will act %s', async (_, until) => {
    const composer = start();
    const frames = await act(
      () => {
        composer.draft = 'sending';
        setTimeout(() => (composer.draft = 'sent'), 20);
      },
      { until }
    );
    expect(frames.flatMap((frame) => frame.events.map((event) => event.value))).toEqual(['sending', 'sent']);
  });

  it('will count a write an async step awaited', async () => {
    const warn = mockWarn();
    const composer = start();
    await act(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        composer.draft = 'done';
      },
      { until: 'Composer.draft', timeout: 200 }
    );
    expect(warn).not.toHaveBeenCalled();
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
    start();
    expect(await act(() => {}, { until: { 'Composer.draft': '' } })).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['when a value never holds', { 'Composer.draft': 'never' }, 'Composer.draft.'],
    ['naming a value with no instance', { 'Missing.draft': 'x' }, 'Missing.draft (names no instance).']
  ])('will throw %s', async (_, until, message) => {
    start();
    await expect(act(() => {}, { until, timeout: 20 })).rejects.toThrow(`Not reached within 20ms: ${message}`);
  });

  it('will act until an instance address sees a frame', async () => {
    const composer = start();
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
    const composer = start({ level: 'values', calls: true });
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
    start({ level: 'keys' }).draft = 'x';
    await flushMicrotasks();
    expect(journal.summary()[0].keys).toEqual({ draft: { count: 1 } });
  });

  it('will cap retained frames', async () => {
    const composer = start({ level: 'keys' });
    for (let i = 0; i < 505; i++) {
      composer.rows = i;
      await null;
    }
    const frames = journal.frames();
    expect(frames.length).toBe(500);
    expect(frames[0].seq).toBe(6);
  });
});

describe('hot', () => {
  let count = 0;
  let id: string;

  beforeEach(() => {
    id = `journal-${count++}`;
    attach();
  });

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

  it('will drop a recorded method a patch removed', async () => {
    journal.record({ level: 'keys', calls: true });

    const Before = class Counter extends State {
      gone() {}
    };
    const After = class Counter extends State {};

    hot.accept(id, { Counter: Before });

    const counter = Before.new() as any;

    counter.gone();
    hot.accept(id, { Counter: After });
    await flushMicrotasks();

    expect(counter.gone).toBeUndefined();
  });

  it('will record a patch as hot', async () => {
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
