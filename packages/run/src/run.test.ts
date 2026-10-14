import { has, map, set, State } from '@expressive/mvc';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { flushMicrotasks, mockPromise, mockUncaught, mockWarn } from '../test.setup';
import { run, type Runner } from './run';

describe('steps', () => {
  it('will run steps from next through to end', async () => {
    const order: string[] = [];

    class Test extends State {
      then = run(this);

      next(seed: number) {
        order.push(`next:${seed}`);
        this.first(seed + 1);
      }

      async first(n: number) {
        order.push(`first:${n}`);
        this.second(n + 1);
      }

      second(n: number) {
        order.push(`second:${n}`);
        this.end(n);
      }

      end(n: number) {
        order.push(`end:${n}`);
        return n * 10;
      }
    }

    const test = Test.new();

    expect(test.then.on).toBe(test);
    expect(test.then.status).toBe('idle');
    expect(order).toEqual([]);

    expect(await test.next(1)).toBe(30);
    expect(order).toEqual(['next:1', 'first:2', 'second:3', 'end:3']);
    expect(test.then.status).toBe('idle');
    expect(test.then.record).toEqual([
      { id: 'next#1', key: 'next', args: [1], prior: {}, patch: {}, next: [{ id: 'first#1', key: 'first', args: [2] }] },
      { id: 'first#1', key: 'first', args: [2], prior: {}, patch: {}, next: [{ id: 'second#1', key: 'second', args: [3] }] },
      { id: 'second#1', key: 'second', args: [3], prior: {}, patch: {}, next: [{ id: 'end#1', key: 'end', args: [3] }] },
      { id: 'end#1', key: 'end', args: [3], prior: {}, patch: {}, next: [] }
    ]);
  });

  it('will not touch the prototype', () => {
    class Test extends State {
      then = run(this);

      next() {}
    }

    Test.new();

    const before = Object.getOwnPropertyDescriptor(Test.prototype, 'next');
    const test = Test.new();
    const own = Object.getOwnPropertyDescriptor(test, 'next')!;

    expect(Object.getOwnPropertyDescriptor(Test.prototype, 'next')).toEqual(before);
    expect(own.enumerable).toBe(false);
    expect(Object.keys(test)).not.toContain('next');
  });

  it('will not wrap new or getters', async () => {
    class Test extends State {
      then = run(this);
      value = 2;
      ready = false;

      get double() {
        return this.value * 2;
      }

      protected new() {
        this.ready = true;
      }

      next() {
        this.value = this.double;
      }
    }

    const test = Test.new();

    expect(test.ready).toBe(true);
    expect(await test.next()).toEqual({ value: 4, ready: true, double: 8 });
  });

  it('will invoke the next step only after the current one settles', async () => {
    const work = mockPromise();
    const second = vi.fn();

    class Test extends State {
      then = run(this);

      next() {
        this.first();
      }

      async first() {
        await work;
        this.second();
      }

      second() {
        second();
      }
    }

    const test = Test.new();

    test.next();
    await flushMicrotasks();
    expect(second).not.toHaveBeenCalled();
    expect(test.then.active).toBe('first');

    work.resolve();
    await test;
    expect(second).toHaveBeenCalledTimes(1);
    expect(test.then.active).toBeUndefined();
  });

  it('will run steps in sequence, each through what it schedules', async () => {
    const order: string[] = [];

    class Test extends State {
      then = run(this);

      next() {
        this.a();
        this.b();
      }

      async a() {
        order.push('a');
        await flushMicrotasks();
        order.push('a!');
        this.a1();
      }

      a1() {
        order.push('a1');
      }

      b() {
        order.push('b');
      }
    }

    await Test.new().next();
    expect(order).toEqual(['a', 'a!', 'a1', 'b']);
  });

  it('will not run a step awaited inside a step', async () => {
    const order: string[] = [];

    class Test extends State {
      then = run(this);

      async next() {
        await this.a();
        order.push('next');
        this.b();
      }

      a() {
        order.push('a');
      }

      b() {
        order.push('b');
      }
    }

    await Test.new().next();
    expect(order).toEqual(['next', 'a', 'b']);
  });

  it('will loop by calling next inside a step', async () => {
    class Test extends State {
      then = run(this);
      count = 0;

      next(until: number) {
        let done = this.count == until;

        if (done) return;

        this.count++;
        this.next(until);
      }
    }

    const test = Test.new();

    await test.next(3);
    expect(test.count).toBe(3);
    expect(test.then.record.map((entry) => entry.id)).toEqual(['next#1', 'next#2', 'next#3', 'next#4']);
  });

  it('will record prior and patch of what each step wrote', async () => {
    class Test extends State {
      then = run(this);
      a = 0;
      b = '';

      next() {
        this.a = 1;
        this.first();
      }

      first() {
        this.b = 'x';
        this.a = 2;
        this.a = 3;
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.then.record.map(({ prior, patch }) => [prior, patch])).toEqual([
      [{ a: 0 }, { a: 1 }],
      [{ b: '', a: 1 }, { b: 'x', a: 3 }]
    ]);
  });

  it('will bind State methods to the instance', async () => {
    let values: Record<string, unknown> | undefined;

    class Test extends State {
      then = run(this);
      value = 1;

      next() {
        values = this.get();
        this.end();
      }

      end() {
        return String(this);
      }
    }

    const test = Test.new();

    expect(await test.next()).toBe(String(test));
    expect(values).toMatchObject({ value: 1 });
  });

  it('will run helpers on the instance', async () => {
    let self: unknown;

    class Test extends State {
      then = run(this);
      value = 0;

      next() {
        this.value = this._double(2);
      }

      _double(n: number) {
        self = this;
        return n * 2;
      }
    }

    const test = Test.new();

    expect(await test.next()).toEqual({ value: 4 });
    expect(self).toBe(test);
    expect(test.then.record[0].patch).toEqual({ value: 4 });
  });

  it('will not journal writes of a helper', async () => {
    class Test extends State {
      then = run(this);
      value = 0;
      label = '';

      next() {
        this.value = this._double(2);
      }

      _double(n: number) {
        this.label = 'doubled';
        return n * 2;
      }
    }

    const test = Test.new();

    expect(await test.next()).toEqual({ value: 4, label: 'doubled' });
    expect(test.then.record[0]).toMatchObject({ prior: { value: 0 }, patch: { value: 4 } });
  });

  it('will pass function fields through', async () => {
    const fn = () => 1;
    let seen: unknown;

    class Test extends State {
      then = run(this);
      fn = fn;

      next() {
        seen = this.fn;
      }
    }

    await Test.new().next();
    expect(seen).toBe(fn);
  });

  it('will accept writes from outside', async () => {
    class Test extends State {
      then = run(this);
      mode = 'ask';

      async next() {
        await flushMicrotasks();
        this.end(this.mode);
      }

      end(mode: string) {
        void mode;
      }
    }

    const test = Test.new();
    const result = test.next();

    test.mode = 'yolo';

    expect(await result).toBe('yolo');
    expect(test.then.record.map((entry) => entry.patch)).toEqual([{}, {}]);
  });

  it('will type the result from end', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.end(1);
      }

      end(n: number) {
        return { n };
      }
    }

    const test = Test.new();

    test.next();

    const result: { n: number } = await test.then;

    expect(result).toEqual({ n: 1 });
  });

  it('will type the result from a protected end', async () => {
    class Test extends State {
      then = run(this);

      protected async next() {
        this.end(1);
      }

      protected end(n: number) {
        return { n };
      }
    }

    const result = await Test.new();

    expectTypeOf(result).toEqualTypeOf<{ n: number }>();
    expect(result).toEqual({ n: 1 });
  });

  it('will type the result from an async end', async () => {
    class Test extends State {
      then = run(this);

      protected async next() {
        this.end(1);
      }

      protected async end(n: number): Promise<{ n: number }> {
        return { n };
      }
    }

    const result = await Test.new();

    expectTypeOf(result).toEqualTypeOf<{ n: number }>();
    expect(result).toEqual({ n: 1 });
  });

  it('will type the result from the argument of an async end', async () => {
    class Test extends State {
      then = run(this);

      protected async next() {
        this.end('x');
      }

      protected async end(value: string) {
        void value;
      }
    }

    const result = await Test.new();

    expectTypeOf(result).toEqualTypeOf<string>();
    expect(result).toBe('x');
  });
});

describe('groups', () => {
  it('will run a group concurrently and join', async () => {
    const order: string[] = [];
    const a = mockPromise();
    const b = mockPromise();

    class Test extends State {
      then = run(this);

      next() {
        this.then([this.a(), this.b()]);
        this.c();
      }

      async a() {
        order.push('a');
        await a;
        order.push('a!');
      }

      async b() {
        order.push('b');
        await b;
        order.push('b!');
      }

      c() {
        order.push('c');
      }
    }

    const test = Test.new();

    test.next();
    await flushMicrotasks();
    expect(order).toEqual(['a', 'b']);

    b.resolve();
    await flushMicrotasks();
    expect(order).toEqual(['a', 'b', 'b!']);
    expect(test.then.active).toBe('a');

    a.resolve();
    await test;
    expect(order).toEqual(['a', 'b', 'b!', 'a!', 'c']);
    expect(test.then.record[0].next).toEqual([
      { id: 'then#1', key: 'then', args: [], group: [{ id: 'a#1', key: 'a', args: [] }, { id: 'b#1', key: 'b', args: [] }] },
      { id: 'c#1', key: 'c', args: [] }
    ]);
  });

  it('will join each member through what it schedules', async () => {
    const order: string[] = [];

    class Test extends State {
      then = run(this);

      next() {
        this.then([this.a(), this.b()]);
        this.c();
      }

      async a() {
        await flushMicrotasks();
        this.a1();
      }

      async a1() {
        await flushMicrotasks();
        order.push('a1');
      }

      b() {
        order.push('b');
      }

      c() {
        order.push('c');
      }
    }

    await Test.new().next();
    expect(order).toEqual(['b', 'a1', 'c']);
  });

  it('will attribute writes to their own step', async () => {
    const a = mockPromise();

    class Test extends State {
      then = run(this);
      x = 0;
      y = 0;

      next() {
        this.then([this.a(), this.b()]);
      }

      async a() {
        await a;
        this.x = 1;
      }

      async b() {
        this.y = 1;
        a.resolve();
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.then.record.map((entry) => [entry.key, entry.patch])).toEqual([
      ['next', {}],
      ['b', { y: 1 }],
      ['a', { x: 1 }]
    ]);
  });

  it('will map items to a group', async () => {
    const seen: unknown[] = [];

    class Test extends State {
      then = run(this);

      next(items: string[]) {
        this.then(items, (item) => this.fetch(item));
      }

      fetch(item: string) {
        seen.push(item);
      }
    }

    await Test.new().next(['a', 'b']);
    expect(seen).toEqual(['a', 'b']);
  });

  it('will map items through a step with its index', async () => {
    const seen: unknown[][] = [];

    class Test extends State {
      then = run(this);

      next(items: string[]) {
        this.then(items, this.fetch);
      }

      fetch(item: string, index: number) {
        seen.push([item, index]);
      }
    }

    await Test.new().next(['a', 'b']);
    expect(seen).toEqual([['a', 0], ['b', 1]]);
  });

  it('will fail if a step calls then as a thenable', async () => {
    class Test extends State {
      then = run(this);

      next() {
        (this.then as Function)(() => {});
      }
    }

    await expect(Test.new().next()).rejects.toThrow('a step cannot await its own run.');
  });

  it('will map an iterable to a group', async () => {
    const seen: string[] = [];

    class Test extends State {
      then = run(this);
      items = new Set(['a', 'b']);

      next() {
        this.then(this.items, this.fetch);
      }

      fetch(item: string) {
        seen.push(item);
      }
    }

    await Test.new().next();
    expect(seen).toEqual(['a', 'b']);
  });

  it('will fail if a step awaits its own run', async () => {
    class Test extends State {
      then = run(this);

      async next() {
        await this;
      }
    }

    await expect(Test.new().next()).rejects.toThrow('a step cannot await its own run.');
  });

  it('will fail if a group holds what the step did not call', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.then([{}]);
      }
    }

    await expect(Test.new().next()).rejects.toThrow('then() takes steps called by next.');
  });

  it('will throw if a group is made outside a step', () => {
    class Test extends State {
      then = run(this);
    }

    expect(() => Test.new().then([])).toThrow('then(steps) must be called inside a step.');
  });
});

describe('end', () => {
  it('will run end after everything else scheduled', async () => {
    const order: string[] = [];

    class Test extends State {
      then = run(this);

      next() {
        this.end();
        this.a();
      }

      async a() {
        order.push('a');
        this.b();
      }

      b() {
        order.push('b');
      }

      end() {
        order.push('end');
      }
    }

    await Test.new().next();
    expect(order).toEqual(['a', 'b', 'end']);
  });

  it('will resolve with the argument when end returns nothing', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.end('value');
      }

      end(value: string) {
        void value;
      }
    }

    expect(await Test.new().next()).toBe('value');
  });

  it('will end with public values when nothing is left', async () => {
    class Test extends State {
      then = run(this);
      count = 0;

      next() {
        this.count = 1;
      }
    }

    expect(await Test.new().next()).toEqual({ count: 1 });
  });

  it('will end from the controller', async () => {
    class Test extends State {
      then = run(this);
      count = 0;

      next() {
        this.count = 1;
        this.then.end();
      }
    }

    expect(await Test.new().next()).toEqual({ count: 1 });
  });

  it('will end from the controller with a value', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.first();
      }

      async first() {
        this.then.end('early');
      }

      end(value: string) {
        void value;
      }
    }

    expect(await Test.new().next()).toBe('early');
  });

  it('will fail if end schedules a step', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.end();
      }

      end() {
        this.more();
      }

      more() {}
    }

    await expect(Test.new().next()).rejects.toThrow('end cannot schedule more.');
  });

  it('will fail if end is scheduled twice', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.end();
        this.then.end();
      }

      end() {}
    }

    await expect(Test.new().next()).rejects.toThrow('end was scheduled twice.');
  });

  it('will do nothing if ended from outside while idle', () => {
    class Test extends State {
      then = run(this);
    }

    const test = Test.new();

    test.then.end('x');

    expect(test.then.status).toBe('idle');
    expect(test.then.runs).toBe(0);
  });

  it('will end from outside once steps in flight settle', async () => {
    const work = mockPromise();
    const more = mockPromise();
    const later = vi.fn();

    class Test extends State {
      then = run(this);
      value = 0;

      async next(work: Promise<void>) {
        await work;
        this.value = 1;
        this.later();
      }

      async later() {
        later();
      }

      protected end(value: string) {
        return `${value}:${this.value}`;
      }
    }

    const test = Test.new();
    const result = test.next(work);
    const queued = test.next(more);

    await flushMicrotasks();
    test.then.end('early');
    test.then.end('again');
    expect(test.then.status).toBe('running');

    work.resolve();

    expect(await result).toBe('early:1');
    expect(later).not.toHaveBeenCalled();
    expect(test.then.runs).toBe(1);

    await flushMicrotasks();
    expect(test.then.status).toBe('running');
    test.then.end('second');
    more.resolve();

    expect(await queued).toBe('second:1');
    expect(test.then.record.map((entry) => entry.id)).toEqual(['next#1', 'end#1']);
  });

  it('will end from outside with the value, else a dump', async () => {
    class Test extends State {
      then = run(this);
      count = 1;

      next() {
        this.then(this.reply);
      }

      async reply() {}
    }

    const test = Test.new();
    const first = test.next();

    await flushMicrotasks();
    expect(test.reply).toBeTypeOf('function');

    test.then.end('x');

    expect(test.reply).toBeUndefined();
    expect(test.then.waiting).toEqual([]);
    expect(await first).toBe('x');

    const second = test.next();

    await flushMicrotasks();
    test.then.end();

    expect(await second).toEqual({ count: 1 });
  });

  it('will fail if a step in flight fails after an outside end', async () => {
    const work = mockPromise();

    class Test extends State {
      then = run(this);

      async next() {
        await work;
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = test.next();

    test.then.end('x');
    work.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(test.then.status).toBe('failed');
  });
});

describe('runs', () => {
  it('will repeat with a record each and fields kept', async () => {
    class Test extends State {
      then = run(this);
      count = 0;

      next(by: number) {
        this.count += by;
      }
    }

    const test = Test.new();

    expect(await test.next(1)).toEqual({ count: 1 });
    expect(await test.next(2)).toEqual({ count: 3 });
    expect(test.then.runs).toBe(2);
    expect(test.then.status).toBe('idle');
    expect(test.then.record).toEqual([
      { id: 'next#1', key: 'next', args: [2], prior: { count: 1 }, patch: { count: 3 }, next: [] }
    ]);
  });

  it('will queue next while a run is active', async () => {
    const work = mockPromise();
    const queues: unknown[][][] = [];

    class Test extends State {
      then = run(this);
      seen: string[] = [];

      async next(label: string) {
        await work;
        this.seen = this.seen.concat(label);
      }
    }

    const test = Test.new();

    test.get((self) => void queues.push(self.then.queue.slice()));

    const first = test.next('a');
    const second = test.next('b');
    const third = test.next('c');

    expect(test.then.queue).toEqual([['b'], ['c']]);

    work.resolve();

    expect(await first).toEqual({ seen: ['a'] });
    expect(await second).toEqual({ seen: ['a', 'b'] });
    expect(await third).toEqual({ seen: ['a', 'b', 'c'] });
    expect(test.then.queue).toEqual([]);
    expect(queues).toEqual([[], [['b'], ['c']], [['c']], []]);
  });

  it('will await the instance through the queue', async () => {
    const work = mockPromise();

    class Test extends State {
      then = run(this);

      async next(value?: string) {
        await work;
        this.end(value);
      }

      end(value?: string) {
        void value;
      }
    }

    const test = Test.new();

    test.next('a');
    test.next('b');

    const awaited = test.then((value) => value);

    test.next('c');
    work.resolve();

    expect(await awaited).toBe('c');
    expect(test.then.runs).toBe(3);
  });

  it('will start a run when awaited idle', async () => {
    const next = vi.fn();

    class Test extends State {
      then = run(this);

      next(value = 'x') {
        next(value);
        this.then.end(value);
      }
    }

    const test = Test.new();

    expect(await test).toBe('x');
    expect(await test.next('y')).toBe('y');
    expect(await test).toBe('x');
    expect(next.mock.calls).toEqual([['x'], ['y'], ['x']]);
    expect(test.then.runs).toBe(3);
  });

  it('will reject an idle await when next takes arguments', async () => {
    class Test extends State {
      then = run(this);

      next(prompt: string) {
        this.then.end(prompt);
      }
    }

    const test = Test.new();

    await expect(test.then((value) => value)).rejects.toThrow(
      `${test} is idle. next() takes arguments; call it to start a run.`
    );
    expect(test.then.runs).toBe(0);
    expect(await test.next('x')).toBe('x');
  });

  it('will join a run when next takes arguments', async () => {
    class Test extends State {
      then = run(this);

      next(prompt: string) {
        this.then.end(prompt);
      }
    }

    const test = Test.new();

    test.next('x');

    expect(await test).toBe('x');
  });

  it('will start on idle await when next has defaults', async () => {
    class Test extends State {
      then = run(this);

      next(x = 1) {
        this.then.end(x);
      }
    }

    expect(await Test.new()).toBe(1);
  });

  it('will not start on idle await when next has an optional parameter', async () => {
    class Test extends State {
      then = run(this);

      next(x?: number) {
        this.then.end(x);
      }
    }

    const test = Test.new();

    await expect(test).rejects.toThrow(`${test} is idle. next() takes arguments; call it to start a run.`);
  });

  it('will reject the instance when the last run failed', async () => {
    class Test extends State {
      then = run(this);

      next(fail?: boolean) {
        if (fail) throw new Error('boom');
      }
    }

    const test = Test.new();

    test.next(true);

    const awaited = test.then((value) => value);

    test.next(false);
    expect(await awaited).toEqual({});

    test.next(true);
    await expect(test).rejects.toThrow('boom');
    expect(test.then.status).toBe('failed');
    expect(test.then.runs).toBe(3);
  });

  it('will reset error and status on the next run', async () => {
    class Test extends State {
      then = run(this);

      next(fail: boolean) {
        if (fail) throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next(true)).rejects.toThrow('boom');
    expect(test.then.error).toEqual(new Error('boom'));

    await test.next(false);
    expect(test.then.error).toBeUndefined();
    expect(test.then.status).toBe('idle');
  });

  it('will be observed through the instance', async () => {
    const seen: string[] = [];

    class Test extends State {
      then = run(this);

      next() {
        this.first();
      }

      async first() {
        await flushMicrotasks();
      }
    }

    const test = Test.new();

    test.get((self) => void seen.push(`${self.then.status}:${self.then.active}`));
    await test.next();
    await flushMicrotasks();

    expect(seen).toEqual([
      'idle:undefined',
      'running:next',
      'running:undefined',
      'running:first',
      'running:undefined',
      'idle:undefined'
    ]);
  });

  it('will not expose a step outside unless a wait accepts it', () => {
    class Test extends State {
      then = run(this);

      second() {}
    }

    const test = Test.new();

    expect(test.second).toBeUndefined();
    expect(Object.keys(test)).not.toContain('second');
  });
});

describe('then', () => {
  it('will await the instance', async () => {
    class Test extends State {
      then = run(this);

      protected new() {
        this.next();
      }

      next() {
        this.first();
      }

      first() {
        this.then.end('x');
      }
    }

    const test = Test.new();

    expect(await test).toBe('x');
    expect(await Promise.resolve(test)).toBe('x');
    expect(test.then.status).toBe('idle');
  });

  it('will type the result from end through the instance', async () => {
    class Test extends State {
      then = run(this);

      protected new() {
        this.next();
      }

      next() {
        this.end(1);
      }

      end(n: number) {
        return { n };
      }
    }

    const result: { n: number } = await Test.new();
    const awaited: Awaited<Test> = result;

    expect(awaited).toEqual({ n: 1 });
  });

  it('will observe then as a view which is not callable', async () => {
    const seen: string[] = [];
    let view: unknown;

    class Test extends State {
      then = run(this);

      async next() {
        await flushMicrotasks();
      }
    }

    const test = Test.new();

    test.get((self) => {
      view = self.then;
      seen.push(self.then.status);
    });

    expect(typeof view).toBe('object');

    await test.next();
    await flushMicrotasks();

    expect(seen).toEqual(['idle', 'running', 'idle']);
  });

  it('will resolve a set factory to the result', async () => {
    class Test extends State {
      then = run(this);

      protected new() {
        this.next();
      }

      next() {
        this.then.end('x');
      }
    }

    class Other extends State {
      value = set(async () => Test.new());
    }

    const other = Other.new();

    expect(() => other.value).toThrow(expect.any(Promise));

    await flushMicrotasks();

    expect(other.value).toBe('x');
  });

  it('will export then as a field and exclude it from the dump', async () => {
    class Test extends State {
      then = run(this);
      count = 1;

      next() {}
    }

    const test = Test.new();

    expect(Object.keys(test)).toContain('then');
    expect(test.get().then).toBe(test.then);
    expect(await test.next()).toEqual({ count: 1 });
  });

  it('will spread to a snapshot and iterate its record', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.a();
      }

      a() {}
    }

    const test = Test.new();

    await test.next();

    const snapshot = { ...test.then };

    expect(snapshot).toEqual({
      status: 'idle',
      active: undefined,
      record: test.then.record,
      queue: [],
      waiting: [],
      runs: 1,
      error: undefined
    });
    expect(test.then.get()).toEqual(snapshot);
    expect([...test.then].map((entry) => entry.id)).toEqual(['next#1', 'a#1']);
  });
});

describe('stop', () => {
  it('will discard pending and let a step in flight commit', async () => {
    const work = mockPromise();
    const later = vi.fn();

    class Test extends State {
      then = run(this);
      value = 0;

      async next() {
        await work;
        this.value = 1;
        this.later();
      }

      later() {
        later();
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.then.stop();
    expect(test.then.status).toBe('stopped');

    work.resolve();
    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(later).not.toHaveBeenCalled();
    expect(test.value).toBe(1);
    expect(test.then.record.map((entry) => entry.id)).toEqual(['next#1']);
    expect(test.then.status).toBe('stopped');
    expect(test.then.runs).toBe(1);
  });

  it('will reject queued runs', async () => {
    const work = mockPromise();

    class Test extends State {
      then = run(this);

      async next() {
        await work;
      }
    }

    const test = Test.new();
    const first = test.next();
    const second = test.next();

    test.then.stop();
    expect(test.then.queue).toEqual([]);
    await expect(second).rejects.toMatchObject({ name: 'Stopped' });

    work.resolve();
    await expect(first).rejects.toMatchObject({ name: 'Stopped' });
    expect(test.then.runs).toBe(1);
  });

  it('will unwind on stop with undo', async () => {
    const work = mockPromise();
    const undo = vi.fn();

    class Test extends State {
      then = run(this);
      value = 0;

      next() {
        this.value = 1;
        this.second();
        return undo;
      }

      async second() {
        await work;
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.then.stop({ undo: true });
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(undo).toHaveBeenCalled();
    expect(test.value).toBe(0);
    expect(test.then.record.map((entry) => entry.undone)).toEqual([true, true]);
  });

  it('will stop from inside a step', async () => {
    const later = vi.fn();

    class Test extends State {
      then = run(this);

      next() {
        this.then.stop();
        this.later();
      }

      later() {
        later();
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toMatchObject({ name: 'Stopped' });
    expect(later).not.toHaveBeenCalled();
    expect(test.then.record[0].next).toEqual([{ id: 'later#1', key: 'later', args: [] }]);
  });

  it('will stop when the instance is destroyed', async () => {
    const work = mockPromise();

    class Test extends State {
      then = run(this);

      async next() {
        await work;
      }
    }

    const test = Test.new();
    const result = test.next();

    test.set(null);
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(test.then.status).toBe('stopped');
  });

  it('will not stop when idle', () => {
    class Test extends State {
      then = run(this);
    }

    const test = Test.new();

    test.then.stop();
    expect(test.then.status).toBe('idle');
  });

  it('will not resolve when stopped during end', async () => {
    const work = mockPromise();

    class Test extends State {
      then = run(this);

      next() {
        this.end();
      }

      async end() {
        await work;
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.then.stop();
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
  });

  it('will run again after a stop', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.then.stop();
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toMatchObject({ name: 'Stopped' });
    await expect(test.next()).rejects.toMatchObject({ name: 'Stopped' });
    expect(test.then.runs).toBe(2);
  });
});

describe('wait', () => {
  it('will park until a listed step answers', async () => {
    class Test extends State {
      then = run(this);
      answer = '';

      next() {
        this.ask('question');
        this.later();
      }

      ask(question: string) {
        this.then(this.reply, this.skip);
      }

      reply(answer: string) {
        this.answer = answer;
        this.thanks();
      }

      skip() {}
      thanks() {}
      later() {}
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    expect(test.then.status).toBe('waiting');
    expect(test.then.waiting).toEqual([{ id: 'wait#1', step: 'ask', args: ['question'], answers: ['reply', 'skip'] }]);

    test.reply('yes');
    expect(test.then.waiting).toEqual([]);
    expect(test.then.status).toBe('running');

    expect(await result).toEqual({ answer: 'yes' });
    expect(test.then.record.map((entry) => entry.id)).toEqual(['next#1', 'ask#1', 'reply#1', 'thanks#1', 'later#1']);
    expect(test.then.record[1].next).toEqual([{ id: 'wait#1', key: 'wait', args: [], answers: ['reply', 'skip'] }]);
    expect(test.then.record[2]).toMatchObject({ wake: 'wait#1', patch: { answer: 'yes' } });
  });

  it('will run what follows a wait after its answer', async () => {
    const order: string[] = [];

    class Test extends State {
      then = run(this);

      next() {
        this.then(this.reply);
        this.log('after');
      }

      reply() {
        this.log('reply');
        this.log('reply again');
      }

      log(message: string) {
        order.push(message);
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    expect(order).toEqual([]);

    test.reply();
    await result;

    expect(order).toEqual(['reply', 'reply again', 'after']);
  });

  it('will answer the oldest wait first', async () => {
    class Test extends State {
      then = run(this);
      answers: string[] = [];

      next() {
        this.then(['a', 'b'], this.ask);
      }

      ask(name: string) {
        this.then(this.reply);
      }

      reply(answer: string) {
        this.answers = this.answers.concat(answer);
      }
    }

    const test = Test.new();
    const seen: unknown[] = [];
    const result = test.next();

    test.get((self) => void seen.push(self.then.waiting.map((wait) => wait.args[0])));

    await flushMicrotasks();
    test.reply('1');
    await flushMicrotasks();
    test.reply('2');

    await result;
    expect(test.answers).toEqual(['1', '2']);
    expect(test.then.record.filter((entry) => entry.wake).map((entry) => [entry.wake, entry.args])).toEqual([
      ['wait#1', ['1']],
      ['wait#2', ['2']]
    ]);
    expect(seen).toEqual([[], ['a', 'b'], ['b'], []]);
  });

  it('will expose a step only while a wait accepts it', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.then(this.reply);
      }

      reply() {}
    }

    const test = Test.new();
    const seen: boolean[] = [];

    test.get((self) => void seen.push(typeof self.reply == 'function'));

    expect(test.reply).toBeUndefined();

    const result = test.next();

    await flushMicrotasks();
    expect(test.reply).toBeTypeOf('function');
    expect(Object.keys(test)).not.toContain('reply');

    test.reply();
    expect(test.reply).toBeUndefined();

    await result;
    await flushMicrotasks();
    expect(seen).toEqual([false, true, false]);
  });

  it('will schedule a waited-for step from inside a step', async () => {
    class Test extends State {
      then = run(this);
      count = 0;

      next() {
        this.reply();
      }

      reply() {
        this.count++;
      }
    }

    expect(await Test.new().next()).toEqual({ count: 1 });
  });

  it('will answer the wait opened with the same first argument', async () => {
    class Test extends State {
      then = run(this);
      answers: string[] = [];

      next() {
        this.then(['a', 'b'], this.ask);
      }

      ask(name: string) {
        this.then(this.reply);
      }

      reply(name: string) {
        this.answers = this.answers.concat(name);
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.reply('b');

    expect(test.then.waiting.map((wait) => wait.args[0])).toEqual(['a']);

    test.reply('a');
    await result;

    expect(test.then.record.filter((entry) => entry.wake).map((entry) => [entry.wake, entry.args])).toEqual([
      ['wait#2', ['b']],
      ['wait#1', ['a']]
    ]);
  });

  it('will resolve an answer once its own branch is done', async () => {
    const work = mockPromise();
    const order: string[] = [];

    class Test extends State {
      then = run(this);

      next() {
        this.then(this.reply);
        this.later();
      }

      async reply() {
        this.follow();
      }

      async follow() {
        await work;
        order.push('follow');
      }

      async later() {
        await work;
        order.push('later');
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();

    const answered = test.reply().then(() => order.push('answered'));

    await flushMicrotasks();
    expect(order).toEqual([]);

    work.resolve();
    await answered;
    expect(order).toEqual(['follow', 'answered']);

    await result;
    expect(order).toEqual(['follow', 'answered', 'later']);
  });

  it('will reject an answer if the run stops first', async () => {
    const work = mockPromise();

    class Test extends State {
      then = run(this);

      next() {
        this.then(this.reply);
      }

      async reply() {
        this.follow();
      }

      async follow() {
        await work;
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();

    const answered = test.reply();

    await flushMicrotasks();
    test.then.stop();
    work.resolve();

    await expect(answered).rejects.toMatchObject({ name: 'Stopped' });
    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
  });

  it('will reject an answer if its step fails', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.then(this.reply);
      }

      async reply() {
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();

    await expect(test.reply()).rejects.toThrow('boom');
    await expect(result).rejects.toThrow('boom');
  });

  it('will not answer a wait with a step it does not list', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.then(this.reply);
      }

      reply() {}
      other() {}
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    expect(test.other).toBeUndefined();

    test.reply();
    await result;
  });

  it('will fail if next or end answers a wait', async () => {
    class Test extends State {
      then = run(this);

      next(end: boolean) {
        if (end) this.then(this.end);
        else this.then(this.next);
      }

      end() {}
    }

    const test = Test.new();

    await expect(test.next(true)).rejects.toThrow('end cannot answer a wait.');
    await expect(test.next(false)).rejects.toThrow('next cannot answer a wait.');
  });

  it('will fail if a step returns its wait', async () => {
    class Test extends State {
      then = run(this);

      next() {
        return this.then(this.reply);
      }

      reply() {}
    }

    await expect(Test.new().next()).rejects.toThrow('next returned a value; a step returns nothing, or its undo.');
  });

  it('will not wait on a step of another instance', async () => {
    class Test extends State {
      then = run(this);

      next(other?: Test) {
        if (other) this.then(other.reply);
      }

      reply() {}
    }

    const other = Test.new();

    await expect(Test.new().next(other)).rejects.toThrow('a step cannot await its own run.');
  });

  it('will warn once if undo closures are held', async () => {
    const warn = mockWarn();

    class Test extends State {
      then = run(this);

      next() {
        this.ask();
        this.ask();
        return () => {};
      }

      ask() {
        this.then(this.reply);
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.reply();
    await flushMicrotasks();
    test.reply();
    await result;

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(`${test} is waiting with undo closures held; a closure does not survive a resume.`);
  });

  it('will release waits on stop', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.then(this.reply);
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();

    const { reply } = test;

    test.then.stop();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(test.then.waiting).toEqual([]);
    expect(() => reply()).toThrow('reply cannot be called from outside; call next() to run.');
  });

  it('will not have wait on the runner', () => {
    class Test extends State {
      then = run(this);
    }

    const test = Test.new();

    expect('wait' in test.then).toBe(false);
    expect(() => test.then.retry({ attempts: 2 })).toThrow('retry must be called inside a step.');
  });
});

describe('retry', () => {
  afterEach(() => void vi.useRealTimers());

  it('will try again and journal failed attempts', async () => {
    let tries = 0;

    class Test extends State {
      then = run(this);
      value = 0;

      next() {
        this.then.retry({ attempts: 3 });
        this.value = ++tries;

        if (tries < 3) throw new Error(`try ${tries}`);
      }
    }

    const test = Test.new();

    expect(await test.next()).toEqual({ value: 3 });
    expect(test.then.record).toEqual([
      { id: 'next#1', key: 'next', args: [], prior: {}, patch: {}, next: [], attempt: 1, error: new Error('try 1') },
      { id: 'next#1', key: 'next', args: [], prior: {}, patch: {}, next: [], attempt: 2, error: new Error('try 2') },
      { id: 'next#1', key: 'next', args: [], prior: { value: 0 }, patch: { value: 3 }, next: [], attempt: 3 }
    ]);
  });

  it('will fail after the last attempt', async () => {
    class Test extends State {
      then = run(this);
      value = 0;

      next() {
        this.then.retry({ attempts: 2 });
        this.value++;
        throw new Error('nope');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('nope');
    expect(test.value).toBe(0);
    expect(test.then.record).toHaveLength(1);
  });

  it('will back off between attempts', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });

    const backoff = vi.fn((attempt: number) => attempt * 100);
    let tries = 0;

    class Test extends State {
      then = run(this);

      async next() {
        this.then.retry({ attempts: 3, backoff });

        if (++tries < 3) throw new Error('later');
      }
    }

    const result = Test.new().next();

    await vi.advanceTimersByTimeAsync(99);
    expect(tries).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(tries).toBe(2);

    await vi.advanceTimersByTimeAsync(200);
    expect(tries).toBe(3);
    expect(backoff.mock.calls).toEqual([[1], [2]]);

    await result;
  });

  it('will not try again once stopped', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });

    let tries = 0;

    class Test extends State {
      then = run(this);

      next() {
        this.then.retry({ attempts: 3, backoff: () => 100 });
        tries++;
        throw new Error('later');
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.advanceTimersByTimeAsync(0);
    test.then.stop();
    await vi.advanceTimersByTimeAsync(100);

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(tries).toBe(1);
  });

  it('will not retry a broken rule', async () => {
    let tries = 0;

    class Test extends State {
      then = run(this);
      value = 0;

      next() {
        this.then.retry({ attempts: 3 });
        tries++;
        this.a();
        this.value = 1;
      }

      a() {}
    }

    await expect(Test.new().next()).rejects.toThrow('next wrote value after scheduling a.');
    expect(tries).toBe(1);
  });

  it('will not fire hooks on retry', async () => {
    const order: string[] = [];
    let tries = 0;

    class Test extends State {
      then = run(this);

      next() {
        this.then.retry({ attempts: 2 });
        order.push('next');

        if (++tries < 2) throw new Error('again');
      }

      before(key: string) {
        order.push(`before:${key}`);
      }

      after(key: string) {
        order.push(`after:${key}`);
      }
    }

    await Test.new().next();
    expect(order).toEqual(['before:next', 'next', 'next', 'after:next']);
  });
});

describe('hooks', () => {
  it('will call hooks around each step', async () => {
    const order: unknown[][] = [];

    class Test extends State {
      then = run(this);
      value = 0;

      async next() {
        this.ship('a', 1);
      }

      protected async ship(id: string, n: number) {
        order.push(['ship', id, n]);
      }

      protected before(key: string, args: unknown[], skip: boolean) {
        this.value++;
        order.push(['before', key, args, skip]);
      }

      protected after(key: string, entry: Runner.Entry, skip: boolean) {
        order.push(['after', key, entry.id, skip]);
      }

      protected beforeShip(skip: boolean, id: string, n: number) {
        order.push(['beforeShip', skip, id, n]);
      }

      protected afterShip(skip: boolean, entry: Runner.Entry) {
        order.push(['afterShip', skip, entry.id]);
      }
    }

    const test = Test.new();

    await test.next();
    expect(order).toEqual([
      ['before', 'next', [], false],
      ['after', 'next', 'next#1', false],
      ['before', 'ship', ['a', 1], false],
      ['beforeShip', false, 'a', 1],
      ['ship', 'a', 1],
      ['afterShip', false, 'ship#1'],
      ['after', 'ship', 'ship#1', false]
    ]);
    expect(test.value).toBe(2);
    expect(test.then.record.map((entry) => entry.patch)).toEqual([{}, {}]);
  });

  it('will not wrap hooks as steps', async () => {
    class Test extends State {
      then = run(this);

      next() {}

      beforeNext() {
        return 'hook';
      }

      beforehand() {}
    }

    const test = Test.new();

    expect(test.beforeNext()).toBe('hook');
    expect(test.beforehand).toBeUndefined();
  });

  it('will fail when a hook throws', async () => {
    class Test extends State {
      then = run(this);

      next() {}

      beforeNext() {
        throw new Error('hook');
      }
    }

    await expect(Test.new().next()).rejects.toThrow('hook');
  });

  it('will throw if a hook has no step', () => {
    class Test extends State {
      then = run(this);

      afterShip() {}
    }

    expect(() => Test.new()).toThrow('afterShip has no step ship.');
  });

  it('will call back once the unwind completes', async () => {
    const order: unknown[] = [];

    class Test extends State {
      then = run(this);
      value = 0;

      async next() {
        this.value = 1;
        this.fail();

        return () => void order.push('undo');
      }

      protected async fail() {
        throw new Error('boom');
      }

      protected back(error: unknown) {
        order.push(['back', this.value, this.then.status, (error as Error).message]);
      }
    }

    const test = Test.new();
    const result = test.next().catch((error: Error) => void order.push(['rejected', error.message]));

    await result;
    expect(order).toEqual(['undo', ['back', 0, 'failed', 'boom'], ['rejected', 'boom']]);
    expect(test.then.record.map((entry) => entry.key)).toEqual(['next']);
  });

  it('will call back after a halted unwind', async () => {
    mockWarn();

    const back = vi.fn();

    class Item extends State {}

    class Test extends State {
      then = run(this);
      items = has(Item);

      protected new() {
        this.items.add({});
      }

      next() {
        this.items.clear();
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }

      protected back(error: unknown) {
        back(error, this.then.record[0].halted);
      }
    }

    await expect(Test.new().next()).rejects.toThrow('boom');
    expect(back).toHaveBeenCalledWith(new Error('boom'), true);
  });

  it('will call back on stop with undo', async () => {
    const work = mockPromise();
    const back = vi.fn();

    class Test extends State {
      then = run(this);

      async next() {
        await work;
      }

      protected back(error: unknown) {
        back(error);
      }
    }

    const test = Test.new();
    const result = test.next();

    test.then.stop({ undo: true });
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(back).toHaveBeenCalledTimes(1);
    expect(back.mock.calls[0][0]).toMatchObject({ name: 'Stopped' });
  });

  it('will not call back on stop without undo', async () => {
    const work = mockPromise();
    const back = vi.fn();

    class Test extends State {
      then = run(this);

      async next() {
        await work;
      }

      protected back() {
        back();
      }
    }

    const test = Test.new();
    const result = test.next();

    test.then.stop();
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(back).not.toHaveBeenCalled();
  });

  it('will replace the error when back throws', async () => {
    class Test extends State {
      then = run(this);

      async next() {
        throw new Error('boom');
      }

      protected back() {
        throw new Error('back');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('back');
    expect(test.then.error).toEqual(new Error('back'));
  });

  it('will not wrap back as a step', async () => {
    class Test extends State {
      then = run(this);

      next() {}

      back() {
        return this;
      }
    }

    const test = Test.new();

    expect(test.back()).toBe(test);
    await test.next();
    expect(test.then.record.map((entry) => entry.key)).toEqual(['next']);
  });
});

describe('undo', () => {
  it('will unwind every step in reverse and restore fields', async () => {
    const order: string[] = [];

    class Test extends State {
      then = run(this);
      a = 0;
      b = 0;
      c = 0;

      next() {
        this.a = 1;
        this.first();
        return () => void order.push(`undo next a=${this.a}`);
      }

      first() {
        this.b = 2;
        this.second();
      }

      second() {
        this.c = 3;
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(order).toEqual(['undo next a=1']);
    expect(test.get()).toMatchObject({ a: 0, b: 0, c: 0 });
    expect(test.then.record.map((entry) => [entry.key, entry.undo, entry.undone])).toEqual([
      ['next', 'closure', true],
      ['first', undefined, true]
    ]);
  });

  it('will not roll back writes of a helper', async () => {
    class Test extends State {
      then = run(this);
      value = 0;
      count = 0;

      next() {
        this.value = this._count();
        this.first();
      }

      first() {
        this._count();
        throw new Error('boom');
      }

      _count() {
        return ++this.count;
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.value).toBe(0);
    expect(test.count).toBe(2);
  });

  it('will unwind a branch which commits after another fails', async () => {
    const work = mockPromise();
    const undo = vi.fn();

    class Test extends State {
      then = run(this);
      value = 0;

      next() {
        this.then([this.a(), this.b()]);
      }

      async a() {
        await work;
        this.value = 1;
        return undo;
      }

      b() {
        work.resolve();
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(undo).toHaveBeenCalled();
    expect(test.value).toBe(0);
    expect(test.then.record.map((entry) => [entry.key, entry.undone])).toEqual([
      ['next', true],
      ['a', true]
    ]);
  });

  it('will unwind through a returned step', async () => {
    const undo = vi.fn();

    class Test extends State {
      then = run(this);

      next() {
        this.first();
      }

      async first() {
        this.second();
        return this.release('r1');
      }

      second() {
        throw new Error('boom');
      }

      release(id: string) {
        undo(id);
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(undo).toHaveBeenCalledWith('r1');
    expect(test.then.record[1].undo).toEqual({ id: 'release#1', key: 'release', args: ['r1'] });
    expect(test.then.record[1].next.map((node) => node.key)).toEqual(['second']);
  });

  it('will stop unwinding where an undo throws', async () => {
    const order: string[] = [];

    class Test extends State {
      then = run(this);

      next() {
        this.first();
        return () => void order.push('undo next');
      }

      first() {
        this.second();
        return () => {
          throw new Error('undo failed');
        };
      }

      second() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('undo failed');
    expect(order).toEqual([]);
    expect(test.then.record.map((entry) => entry.undone)).toEqual([undefined, 'failed']);
  });

  it('will throw if an undo schedules a step', async () => {
    class Test extends State {
      then = run(this);

      next() {
        this.second();
        return this.release();
      }

      second() {
        throw new Error('boom');
      }

      release() {
        this.next();
      }
    }

    await expect(Test.new().next()).rejects.toThrow(/is failed; next cannot run/);
  });
});

describe('collections', () => {
  class Item extends State {
    name = '';
  }

  it('will roll back list push, put, pop and set', async () => {
    class Test extends State {
      then = run(this);
      items = has(['a', 'b', 'c']);

      next() {
        this.items.push('d');
        this.items.put(0, 'z');
        this.items.pop(1);
        this.items.set(-1, 'e');
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.items.get()).toEqual(['a', 'b', 'c']);
    expect(test.then.record).toEqual([
      expect.objectContaining({
        prior: { items: ['a', 'b', 'c'] },
        patch: { items: ['z', 'b', 'c', 'e'] },
        undone: true
      })
    ]);
  });

  it('will record nothing for a read without change', async () => {
    class Test extends State {
      then = run(this);
      items = has(['a']);
      count = 0;

      next() {
        this.count = this.items.size;
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.then.record[0]).toMatchObject({ prior: { count: 0 }, patch: { count: 1 } });
  });

  it('will journal a collection in its export form', async () => {
    class Test extends State {
      then = run(this);
      items = has(Item);

      next(name: string) {
        this.items.add({ name });
      }
    }

    const test = Test.new();

    await test.next('a');
    await test.next('b');
    expect(test.then.record[0]).toMatchObject({
      prior: { items: [{ name: 'a' }] },
      patch: { items: [{ name: 'a' }, { name: 'b' }] }
    });
  });

  it('will not capture writes outside a step proxy', async () => {
    class Test extends State {
      then = run(this);
      items = has<string>();

      next() {
        this.is.items.push('a');
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.then.record[0].patch).toEqual({});
  });

  it('will restore a list before a retry', async () => {
    let tries = 0;

    class Test extends State {
      then = run(this);
      items = has<string>();

      next() {
        this.then.retry({ attempts: 2 });
        this.items.push(`try ${++tries}`);

        if (tries < 2) throw new Error('flaky');
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.items.get()).toEqual(['try 2']);
    expect(test.then.record.map((entry) => entry.patch)).toEqual([{}, { items: ['try 2'] }]);
  });

  it('will attribute a change to every parallel step reading the list', async () => {
    const gate = mockPromise();

    class Test extends State {
      then = run(this);
      items = has(['a']);

      next() {
        this.then([this.write(), this.read()]);
        this.fail();
      }

      protected async write() {
        await gate;
        this.items.push('b');
      }

      protected async read() {
        this.items.size;
        await gate;
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    gate.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(test.items.get()).toEqual(['a']);
    expect(test.then.record.map((entry) => [entry.key, entry.prior, entry.patch])).toEqual([
      ['next', {}, {}],
      ['write', { items: ['a'] }, { items: ['a', 'b'] }],
      ['read', { items: ['a'] }, { items: ['a', 'b'] }]
    ]);
  });

  it('will restore the earliest snapshot of parallel steps', async () => {
    const first = mockPromise();
    const second = mockPromise();

    class Test extends State {
      then = run(this);
      items = has(['a']);

      next() {
        this.then([this.early(), this.late()]);
        this.fail();
      }

      protected async early() {
        this.items.push('b');
        await first;
      }

      protected async late() {
        await second;
        this.items.push('c');
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    second.resolve();
    await flushMicrotasks();
    first.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(test.items.get()).toEqual(['a']);
  });

  it('will roll back a map', async () => {
    class Test extends State {
      then = run(this);
      values = map([['a', 1], ['b', 2], ['c', 3]]);

      next() {
        this.values.set('a', 10);
        this.values.delete('b');
        this.values.set('d', 4);
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.values.get()).toEqual(new Map([['a', 1], ['b', 2], ['c', 3]]));
    expect(test.then.record[0]).toMatchObject({
      prior: { values: new Map([['a', 1], ['b', 2], ['c', 3]]) },
      patch: { values: new Map([['a', 10], ['c', 3], ['d', 4]]) }
    });
  });

  it('will restore a guest State removed from a map', async () => {
    const guest = Item.new({ name: 'guest' });

    class Test extends State {
      then = run(this);
      values = map<string, Item>([['a', guest]]);

      next() {
        this.values.delete('a');
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.values.get('a')).toBe(guest);
    expect(test.then.record[0].irreversible).toBeUndefined();
  });

  it('will remove pool members added by a failed run', async () => {
    class Test extends State {
      then = run(this);
      items = has(Item);

      protected new() {
        this.items.add({ name: 'kept' });
      }

      next() {
        this.add();
        this.fail();
      }

      protected async add() {
        this.items.add({ name: 'a' });
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');

    expect(test.then.record[1].patch).toEqual({ items: [{ name: 'kept' }, { name: 'a' }] });
    expect(test.items.map((item) => item.name)).toEqual(['kept']);
  });

  it('will destroy a member a failing step added', async () => {
    let added!: Item;

    class Test extends State {
      then = run(this);
      items = has(Item);

      next() {
        added = this.items.add({ name: 'a' });
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.items.size).toBe(0);
    expect(added.get(null)).toBe(true);
  });
});

describe('irreversible', () => {
  class Item extends State {
    name = '';
  }

  it('will stop the unwind at a removed pool member', async () => {
    const warn = mockWarn();

    class Test extends State {
      then = run(this);
      items = has(Item);
      value = 0;

      protected new() {
        this.items.add({ name: 'a' });
      }

      next() {
        this.value = 1;
        this.drop();
      }

      protected async drop() {
        this.value = 2;
        this.items.clear();
        this.fail();
      }

      protected async fail() {
        this.value = 3;
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.value).toBe(2);
    expect(test.then.error).toEqual(new Error('boom'));
    expect(test.then.record.map((entry) => [entry.key, entry.irreversible, entry.halted, entry.undone])).toEqual([
      ['next', undefined, undefined, undefined],
      ['drop', ['items'], true, undefined]
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(`${test} stopped unwinding at drop#1: items cannot be restored.`);
  });

  it('will unwind steps after an irreversible one', async () => {
    mockWarn();

    class Test extends State {
      then = run(this);
      items = has(Item);
      value = 0;

      protected new() {
        this.items.add({ name: 'a' });
      }

      next() {
        this.drop();
      }

      protected async drop() {
        this.items.clear();
        this.write();
      }

      protected async write() {
        this.value = 1;
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.value).toBe(0);
    expect(test.then.record.map((entry) => [entry.key, entry.undone])).toEqual([
      ['next', undefined],
      ['drop', undefined],
      ['write', true]
    ]);
  });

  it('will be reversible with an undo of its own', async () => {
    const undo = vi.fn();

    class Test extends State {
      then = run(this);
      items = has(Item);
      values = map((key: string) => new Item({ name: key }));

      protected new() {
        this.items.add({ name: 'a' });
        this.values.set('a');
      }

      next() {
        this.items.clear();
        this.values.delete('a');
        this.values.set('b');
        this.fail();
        return undo;
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(undo).toHaveBeenCalledTimes(1);
    expect(test.items.size).toBe(0);
    expect([...test.values.keys()]).toEqual([]);
    expect(test.then.record[0]).toMatchObject({ undo: 'closure', undone: true });
    expect(test.then.record[0].irreversible).toBeUndefined();
  });

  it('will be irreversible when a map evicts an owned value', async () => {
    mockWarn();

    class Test extends State {
      then = run(this);
      values = map<string, Item>();

      protected new() {
        this.values.set('a', new Item({ name: 'a' }));
      }

      next() {
        this.values.set('a', new Item({ name: 'b' }));
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.values.get('a')!.name).toBe('b');
    expect(test.then.record[0]).toMatchObject({ irreversible: ['values'], halted: true });
  });

  it('will not retry an irreversible step', async () => {
    mockWarn();

    const attempt = vi.fn();

    class Test extends State {
      then = run(this);
      items = has(Item);
      value = 0;

      protected new() {
        this.items.add({ name: 'a' });
      }

      next() {
        this.then.retry({ attempts: 3 });
        attempt();
        this.value = 1;
        this.items.clear();
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(test.value).toBe(1);
    expect(test.then.record).toEqual([
      {
        id: 'next#1',
        key: 'next',
        args: [],
        prior: { value: 0, items: [{ name: 'a' }] },
        patch: { value: 1, items: [] },
        next: [],
        error: new Error('boom'),
        irreversible: ['items'],
        attempt: 1,
        halted: true
      }
    ]);
  });

  it('will keep the writes of a failing irreversible step', async () => {
    const warn = mockWarn();

    class Test extends State {
      then = run(this);
      items = has(Item);
      value = 0;

      protected new() {
        this.items.add({ name: 'a' });
      }

      next() {
        this.value = 1;
        this.drop();
      }

      protected async drop() {
        this.value = 2;
        this.items.clear();
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.value).toBe(2);
    expect(test.then.record.map((entry) => [entry.key, entry.error, entry.halted, entry.undone])).toEqual([
      ['next', undefined, undefined, undefined],
      ['drop', new Error('boom'), true, undefined]
    ]);
    expect(warn).toHaveBeenCalledWith(`${test} stopped unwinding at drop#1: items cannot be restored.`);
  });
});

describe('failures', () => {
  it('will reject when a step throws synchronously', async () => {
    class Test extends State {
      then = run(this);

      next() {
        throw new Error('sync');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('sync');
    expect(test.then.status).toBe('failed');
    expect(test.then.error).toEqual(new Error('sync'));
  });

  it('will reject when a step rejects and discard what it scheduled', async () => {
    const next = vi.fn();

    class Test extends State {
      then = run(this);

      async next() {
        this.second();
        throw new Error('after scheduling');
      }

      second() {
        next();
      }
    }

    await expect(Test.new().next()).rejects.toThrow('after scheduling');
    expect(next).not.toHaveBeenCalled();
  });

  it('will reject when a step returns a value', async () => {
    class Test extends State {
      then = run(this);

      async next() {
        return 1 as unknown as void;
      }
    }

    await expect(Test.new().next()).rejects.toThrow('next returned a value; a step returns nothing, or its undo.');
  });

  it('will reject when a step writes after scheduling', async () => {
    class Test extends State {
      then = run(this);
      value = 0;

      next() {
        this.first();
        this.value = 1;
      }

      first() {}
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('next wrote value after scheduling first.');
    expect(test.value).toBe(0);
  });

  it('will not guard writes of a helper after scheduling', async () => {
    class Test extends State {
      then = run(this);
      value = 0;

      next() {
        this.first();
        this._set();
      }

      _set() {
        this.value = 1;
      }

      first() {}
    }

    const test = Test.new();

    await test.next();

    expect(test.value).toBe(1);
    expect(test.then.record[0].patch).toEqual({});
  });

  it('will reject when a step keeps working after scheduling', async () => {
    class Test extends State {
      then = run(this);

      async next() {
        this.second();
        await flushMicrotasks();
      }

      second() {}
    }

    await expect(Test.new().next()).rejects.toThrow('next kept working after scheduling second.');
  });

  it('will throw if a step is called after its caller settled', async () => {
    let late: () => unknown = () => {};

    class Test extends State {
      then = run(this);

      next() {
        late = () => this.second();
      }

      second() {}
    }

    await Test.new().next();
    expect(late).toThrow('next has settled; second cannot run.');
  });

  it('will throw uncaught when nobody awaits a failed run', async () => {
    const caught = mockUncaught();

    class Test extends State {
      then = run(this);

      protected new() {
        this.next();
      }

      next() {
        throw new Error('nobody listening');
      }
    }

    Test.new();
    await flushMicrotasks();

    expect(caught).toEqual([new Error('nobody listening')]);
  });

  it('will not throw uncaught when awaited before the rethrow', async () => {
    const caught = mockUncaught();

    class Test extends State {
      then = run(this);

      next() {
        throw new Error('late listener');
      }
    }

    const result = Test.new().next();

    await Promise.resolve();
    await expect(result).rejects.toThrow('late listener');
    await flushMicrotasks();

    expect(caught).toEqual([]);
  });

  it('will not throw uncaught when stopped', async () => {
    const caught = mockUncaught();

    class Test extends State {
      then = run(this);

      next() {
        this.then.stop();
      }
    }

    Test.new().next();
    await flushMicrotasks();

    expect(caught).toEqual([]);
  });

  it('will keep a list field through a run', async () => {
    class Test extends State {
      then = run(this);
      items = has<string>();

      next(item: string) {
        this.items.push(item);
      }
    }

    const test = Test.new();

    await test.next('a');
    await test.next('b');
    expect([...test.items]).toEqual(['a', 'b']);
  });
});
