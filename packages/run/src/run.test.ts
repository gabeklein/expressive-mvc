import { has, map, set, Model } from '@expressive/mvc';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { flushMicrotasks, mockPromise, mockUncaught, mockWarn } from '../test.setup';
import { Job, run, type Runner } from './run';

describe('steps', () => {
  it('will run steps from next through to end', async () => {
    const order: string[] = [];

    class Test extends Model {
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
      { id: 'next#1', key: 'next', args: [1], wrote: [], next: [{ id: 'first#1', key: 'first', args: [2] }] },
      { id: 'first#1', key: 'first', args: [2], wrote: [], next: [{ id: 'second#1', key: 'second', args: [3] }] },
      { id: 'second#1', key: 'second', args: [3], wrote: [], next: [{ id: 'end#1', key: 'end', args: [3] }] },
      { id: 'end#1', key: 'end', args: [3], wrote: [], next: [] }
    ]);
  });

  it('will not touch the prototype', () => {
    class Test extends Model {
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
    class Test extends Model {
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

    class Test extends Model {
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

    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
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

  it('will record which fields each step wrote', async () => {
    class Test extends Model {
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
    expect(test.then.record.map((entry) => entry.wrote)).toEqual([['a'], ['b', 'a']]);
    expect(test.then.record.some((entry) => 'prior' in entry || 'patch' in entry)).toBe(false);
  });

  it('will record prior and patch with rewind', async () => {
    class Test extends Model {
      then = run(this, { rewind: true });
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

  it('will bind Model methods to the instance', async () => {
    let values: Record<string, unknown> | undefined;

    class Test extends Model {
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

    class Test extends Model {
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
    expect(test.then.record[0].wrote).toEqual(['value']);
  });

  it('will not journal writes of a helper', async () => {
    class Test extends Model {
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
    expect(test.then.record[0].wrote).toEqual(['value']);
  });

  it('will pass function fields through', async () => {
    const fn = () => 1;
    let seen: unknown;

    class Test extends Model {
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
    class Test extends Model {
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
    expect(test.then.record.map((entry) => entry.wrote)).toEqual([[], []]);
  });

  it('will type the result from end', async () => {
    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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

    class Test extends Model {
      then = run(this);

      next() {
        this.then(this.a(), this.b());
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

    class Test extends Model {
      then = run(this);

      next() {
        this.then(this.a(), this.b());
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

    class Test extends Model {
      then = run(this);
      x = 0;
      y = 0;

      next() {
        this.then(this.a(), this.b());
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
    expect(test.then.record.map((entry) => [entry.key, entry.wrote])).toEqual([
      ['next', []],
      ['b', ['y']],
      ['a', ['x']]
    ]);
  });

  it('will map items to a group', async () => {
    const seen: unknown[] = [];

    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
      then = run(this);

      next() {
        (this.then as Function)(() => {}, () => {});
      }
    }

    await expect(Test.new().next()).rejects.toThrow('a step cannot await its own run.');
  });

  it('will map an iterable to a group', async () => {
    const seen: string[] = [];

    class Test extends Model {
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
    class Test extends Model {
      then = run(this);

      async next() {
        await this;
      }
    }

    await expect(Test.new().next()).rejects.toThrow('a step cannot await its own run.');
  });

  it('will fail if a group holds what the step did not call', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.then({});
      }
    }

    await expect(Test.new().next()).rejects.toThrow('then() takes steps called by next.');
  });

  it('will not take an array of tokens as a group', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.then([this.a(), this.b()]);
      }

      a() {}
      b() {}
    }

    await expect(Test.new().next()).rejects.toThrow('then() takes steps called by next.');
  });

  it('will group a single token', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.then(this.a());
      }

      a() {}
    }

    const test = Test.new();

    await test.next();
    expect(test.then.record[0].next).toEqual([
      { id: 'then#1', key: 'then', args: [], group: [{ id: 'a#1', key: 'a', args: [] }] }
    ]);
  });

  it('will throw if a group is made outside a step', () => {
    class Test extends Model {
      then = run(this);
    }

    expect(() => Test.new().then([])).toThrow('then(steps) must be called inside a step.');
  });
});

describe('inline', () => {
  it('will run a function as a step in its place in the plan', async () => {
    const order: string[] = [];

    class Test extends Model {
      then = run(this);

      next() {
        this.a();
        this.then(() => void order.push('inline'));
        this.b();
      }

      a() {
        order.push('a');
      }

      b() {
        order.push('b');
      }

      before(key: string) {
        order.push(`before:${key}`);
      }
    }

    const test = Test.new();

    await test.next();
    expect(order).toEqual(['before:next', 'before:a', 'a', 'before:then', 'inline', 'before:b', 'b']);
    expect(test.then.record.map((entry) => entry.id)).toEqual(['next#1', 'a#1', 'then#1', 'b#1']);
    expect(test.then.record[0].next).toEqual([
      { id: 'a#1', key: 'a', args: [] },
      { id: 'then#1', key: 'then', args: [] },
      { id: 'b#1', key: 'b', args: [] }
    ]);
  });

  it('will run a function with its own proxy as a full step', async () => {
    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        this.then(function (this: Test) {
          this.value = 1;
          this.later();
        });
      }

      later() {}
    }

    const test = Test.new();

    await test.next();
    expect(test.then.record.map((entry) => [entry.id, entry.wrote, entry.next.map((node) => node.id)])).toEqual([
      ['next#1', [], ['then#1']],
      ['then#1', ['value'], ['later#1']],
      ['later#1', [], []]
    ]);
  });

  it('will journal the writes of an arrow as its own', async () => {
    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        this.then(() => {
          this.value = 1;
          this.later();
        });
      }

      later() {}
    }

    const test = Test.new();

    await test.next();
    expect(test.value).toBe(1);
    expect(test.then.record.map((entry) => [entry.id, entry.wrote, entry.next.map((node) => node.id)])).toEqual([
      ['next#1', [], ['then#1']],
      ['then#1', ['value'], ['later#1']],
      ['later#1', [], []]
    ]);
  });

  it('will restore the writes of an arrow that throws', async () => {
    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        this.then(async () => {
          this.value = 1;
          throw new Error('boom');
        });
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.value).toBe(0);
  });

  it('will give an arrow its own controller', async () => {
    let signal!: AbortSignal;

    class Test extends Model {
      then = run(this);

      next() {
        this.then(() => {
          signal = this.then.signal;
          this.then(this.a(), this.b());
        });
      }

      a() {}
      b() {}
    }

    const test = Test.new();

    await test.next();
    expect(signal.aborted).toBe(true);
    expect(test.then.record.map((entry) => entry.id)).toEqual(['next#1', 'then#1', 'a#1', 'b#1']);
    expect(test.then.record[1].next).toMatchObject([{ key: 'then', group: [{ id: 'a#1' }, { id: 'b#1' }] }]);
  });

  it('will attribute a nested arrow to its own frame', async () => {
    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        this.then(() => {
          this.then(() => {
            this.value = 2;
          });
        });
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.then.record.map((entry) => [entry.id, entry.wrote])).toEqual([
      ['next#1', []],
      ['then#1', []],
      ['then#2', ['value']]
    ]);
  });

  it('will attribute an arrow beside a step in flight', async () => {
    const slow = mockPromise();

    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        this.then(
          this.load(),
          this.then(async () => {
            this.value = 1;
            slow.resolve();
          })
        );
      }

      async load() {
        await slow;
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.then.record.find((entry) => entry.id == 'then#1')!.wrote).toEqual(['value']);
  });

  it('will not attribute arrows in flight together', async () => {
    const both = mockPromise();
    let ran = 0;

    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        const arrow = async () => {
          if (++ran == 2) both.resolve();

          await both;
          this.value++;
        };

        this.then(this.then(arrow), this.then(arrow));
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.value).toBe(2);
    expect(test.then.record.filter((entry) => entry.key == 'then').map((entry) => entry.wrote)).toEqual([[], []]);
  });

  it('will not schedule from arrows in flight together', async () => {
    const both = mockPromise();
    let ran = 0;

    class Test extends Model {
      then = run(this);

      next() {
        const arrow = async () => {
          if (++ran == 2) both.resolve();

          await both;
          this.later();
        };

        this.then(this.then(arrow), this.then(arrow));
      }

      later() {}
    }

    await expect(Test.new().next()).rejects.toThrow('next has settled; later cannot run.');
  });

  it('will keep a watcher an outside call beside an arrow', async () => {
    const work = mockPromise();

    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        this.then(
          this.then(this.allow, async () => {
            await work;
            this.allow();
          }),
          this.then(() => {
            this.value = 1;
            work.resolve();
          })
        );
      }

      allow() {}
    }

    const test = Test.new();

    await test.next();
    expect(test.value).toBe(1);
    expect(test.then.record.map((entry) => [entry.id, entry.wrote])).toEqual([
      ['next#1', []],
      ['then#1', []],
      ['allow#1', []]
    ]);
  });

  it('will abort the signal when the run stops', async () => {
    const work = mockPromise();
    let signal!: AbortSignal;

    class Test extends Model {
      then = run(this);

      next() {
        this.then(async (given) => {
          signal = given;
          await work;
        });
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(signal).toBeDefined());
    expect(signal.aborted).toBe(false);

    test.then.stop();
    expect(signal.aborted).toBe(true);

    work.resolve();
    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(test.then.record.map((entry) => entry.id)).toEqual(['next#1', 'then#1']);
  });

  it('will run a returned function as the undo', async () => {
    const refund = vi.fn();

    class Test extends Model {
      then = run(this);

      async next() {
        this.fail();

        return this.then((signal) => refund(signal.aborted));
      }

      async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(refund).toHaveBeenCalledWith(false);
    expect(test.then.record[0]).toMatchObject({ undo: { id: 'then#1', key: 'then', args: [] }, undone: true });
    expect(test.then.record[0].next).toEqual([{ id: 'fail#1', key: 'fail', args: [] }]);
  });

  it('will type a returned function as no value', async () => {
    class Test extends Job {
      async next() {
        return this.then(() => {});
      }
    }

    expectTypeOf<ReturnType<Test['next']>>().toEqualTypeOf<Promise<void>>();
    await Test.new().next();
  });

  it('will fail if the function returns a value', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.then(() => 1);
      }
    }

    await expect(Test.new().next()).rejects.toThrow('then returned a value; a step returns nothing, or its undo.');
  });
});

describe('end', () => {
  it('will run end after everything else scheduled', async () => {
    const order: string[] = [];

    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
      then = run(this);
      count = 0;

      next() {
        this.count = 1;
      }
    }

    expect(await Test.new().next()).toEqual({ count: 1 });
  });

  it('will end from the controller', async () => {
    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
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
      { id: 'next#1', key: 'next', args: [2], wrote: ['count'], next: [] }
    ]);
  });

  it('will queue next while a run is active', async () => {
    const work = mockPromise();
    const queues: unknown[][][] = [];

    class Test extends Model {
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

    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
      then = run(this);

      next(x = 1) {
        this.then.end(x);
      }
    }

    expect(await Test.new()).toBe(1);
  });

  it('will not start on idle await when next has an optional parameter', async () => {
    class Test extends Model {
      then = run(this);

      next(x?: number) {
        this.then.end(x);
      }
    }

    const test = Test.new();

    await expect(test).rejects.toThrow(`${test} is idle. next() takes arguments; call it to start a run.`);
  });

  it('will reject the instance when the last run failed', async () => {
    class Test extends Model {
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
    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
      then = run(this);

      protected new() {
        this.next();
      }

      next() {
        this.then.end('x');
      }
    }

    class Other extends Model {
      value = set(async () => Test.new());
    }

    const other = Other.new();

    expect(() => other.value).toThrow(expect.any(Promise));

    await flushMicrotasks();

    expect(other.value).toBe('x');
  });

  it('will export then as a field and exclude it from the dump', async () => {
    class Test extends Model {
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
    class Test extends Model {
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

    class Test extends Model {
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

    class Test extends Model {
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

    class Test extends Model {
      then = run(this, { rewind: true });
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
    test.then.stop(true);
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(undo).toHaveBeenCalled();
    expect(test.value).toBe(0);
    expect(test.then.record.map((entry) => entry.undone)).toEqual([true, true]);
  });

  it('will stop from inside a step', async () => {
    const later = vi.fn();

    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
      then = run(this);
    }

    const test = Test.new();

    test.then.stop();
    expect(test.then.status).toBe('idle');
  });

  it('will not resolve when stopped during end', async () => {
    const work = mockPromise();

    class Test extends Model {
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
    class Test extends Model {
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

  it('will carry a reason to the run, queue, back and exit', async () => {
    const work = mockPromise();
    const back = vi.fn();
    const exit = vi.fn();

    class Test extends Model {
      then = run(this);

      async next() {
        await work;
      }

      protected back(reason: unknown) {
        back(reason);
      }

      exit(outcome: Runner.Outcome) {
        exit(outcome);
      }
    }

    const test = Test.new();
    const first = test.next();
    const second = test.next();

    test.then.stop(true, 'cancelled by user');
    work.resolve();

    const stopped = { name: 'Stopped', message: 'cancelled by user', cause: 'cancelled by user' };

    await expect(second).rejects.toMatchObject(stopped);
    await expect(first).rejects.toMatchObject(stopped);
    await expect(first).rejects.toBe(await second.catch((error) => error));
    expect(back.mock.calls[0][0]).toMatchObject(stopped);
    expect(exit.mock.calls[0][0]).toMatchObject({ status: 'stopped', error: stopped });
    expect(test.then.error).toBeUndefined();
  });

  it('will carry a reason without undo', async () => {
    const work = mockPromise();
    const reason = { code: 499 };

    class Test extends Model {
      then = run(this);

      async next() {
        await work;
      }
    }

    const test = Test.new();
    const result = test.next();

    test.then.stop(false, reason);
    work.resolve();

    const error = await result.catch((error) => error);

    expect(error).toMatchObject({ name: 'Stopped', message: `${test} was stopped.` });
    expect(error.cause).toBe(reason);
  });

  it('will not set a cause without a reason', async () => {
    const work = mockPromise();

    class Test extends Model {
      then = run(this);

      async next() {
        await work;
      }
    }

    const test = Test.new();
    const result = test.next();

    test.then.stop();
    work.resolve();

    const error = await result.catch((error) => error);

    expect(error.message).toBe(`${test} was stopped.`);
    expect('cause' in error).toBe(false);
  });
});

describe('wait', () => {
  it('will park until a listed step answers', async () => {
    class Test extends Model {
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
    expect(test.then.record[2]).toMatchObject({ wake: 'wait#1', wrote: ['answer'] });
  });

  it('will run what follows a wait after its answer', async () => {
    const order: string[] = [];

    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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

    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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

  it('will not wait on a step of another instance', async () => {
    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
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

  it('will answer its own wait through a settled step', async () => {
    const calls = new Map<string, () => unknown>();

    class Test extends Model {
      then = run(this);
      answers: string[] = [];

      next() {
        this.then(['a', 'b'], this.ask);
      }

      ask(name: string) {
        calls.set(name, () => this.reply(name.toUpperCase()));
        this.then(this.reply);
      }

      reply(answer: string) {
        this.answers = this.answers.concat(answer);
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.then.waiting).toHaveLength(2));

    await calls.get('b')!();
    expect(test.then.waiting.map((wait) => wait.args[0])).toEqual(['a']);

    await calls.get('a')!();
    await result;

    expect(test.answers).toEqual(['B', 'A']);
    expect(test.then.record.filter((entry) => entry.wake).map((entry) => [entry.wake, entry.args])).toEqual([
      ['wait#2', ['B']],
      ['wait#1', ['A']]
    ]);
  });

  it('will route a settled step call as an outside call', async () => {
    let poke!: () => unknown;

    class Test extends Model {
      then = run(this);
      answer = '';

      next() {
        poke = () => this.reply('poked');
        this.ask();
      }

      ask() {
        this.then(this.reply);
      }

      reply(answer: string) {
        this.answer = answer;
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    await poke();

    expect(await result).toEqual({ answer: 'poked' });
  });

  it('will bind a settled step call to its run', async () => {
    let poke!: () => unknown;

    class Test extends Model {
      then = run(this);

      next() {
        poke = () => this.reply();
        this.then(this.reply);
      }

      reply() {}
    }

    const test = Test.new();
    const first = test.next();
    const stale = poke;

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    test.reply();
    await first;

    const second = test.next();

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    expect(() => stale()).toThrow('next has settled; reply cannot run.');
    expect(test.then.waiting).toHaveLength(1);

    await poke();
    await second;
  });

  it('will not journal writes through a settled step', async () => {
    let write!: () => void;

    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        write = () => void (this.value = 1);
        this.then(this.reply);
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    write();
    test.reply();
    await result;

    expect(test.value).toBe(1);
    expect(test.then.record.map((entry) => entry.wrote)).toEqual([[], []]);
  });

  it('will not have wait on the runner', () => {
    class Test extends Model {
      then = run(this);
    }

    const test = Test.new();

    expect('wait' in test.then).toBe(false);
    expect('retry' in test.then).toBe(false);
  });
});

describe('watchers', () => {
  afterEach(() => void vi.useRealTimers());

  function delay(ms: number, { signal }: { signal: AbortSignal }) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);

      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason);
      });
    });
  }

  it('will answer a wait from a watcher', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    class Test extends Model {
      then = run(this);
      answer = '';

      next() {
        this.then(this.allow, this.deny, async (signal) => {
          await delay(100, { signal });
          this.deny('timeout');
        });
      }

      allow() {
        this.answer = 'allowed';
      }

      deny(reason: string) {
        this.answer = reason;
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.advanceTimersByTimeAsync(99);
    expect(test.then.status).toBe('waiting');

    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual({ answer: 'timeout' });
    expect(test.then.record.map((entry) => [entry.id, entry.wake])).toEqual([
      ['next#1', undefined],
      ['deny#1', 'wait#1']
    ]);
    expect(test.then.record[0].next).toEqual([{ id: 'wait#1', key: 'wait', args: [], answers: ['allow', 'deny'] }]);
  });

  it('will abort watchers once answered from outside', async () => {
    let signal!: AbortSignal;
    const lost = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.then(this.reply, async (given) => {
          signal = given;
          await delay(100, { signal: given }).catch(lost);
          throw new Error('lost');
        });
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(signal).toBeDefined());
    expect(signal.aborted).toBe(false);

    test.reply();
    expect(signal.aborted).toBe(true);

    expect(await result).toEqual({});
    expect(lost).toHaveBeenCalled();
  });

  it('will leave the wait open if a watcher settles without answering', async () => {
    const nudge = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.then(this.reply, async () => {
          nudge();
        });
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(nudge).toHaveBeenCalled());
    await flushMicrotasks();
    expect(test.then.status).toBe('waiting');

    test.reply();
    await result;
  });

  it('will start watchers when the plan reaches the wait', async () => {
    const work = mockPromise();
    const watcher = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.slow();
        this.ask();
      }

      async slow() {
        await work;
      }

      ask() {
        this.then(this.reply, watcher);
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    expect(watcher).not.toHaveBeenCalled();

    work.resolve();
    await vi.waitFor(() => expect(watcher).toHaveBeenCalledWith(expect.any(AbortSignal)));

    test.reply();
    await result;
  });

  it('will call a watcher function on the step which opened the wait', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.ask('question');
      }

      ask(question: string) {
        this.then(this.reply, function (this: Test) {
          this.reply(`re: ${question}`);
        });
      }

      reply(answer: string) {
        this.end(answer);
      }

      end(answer: string) {
        void answer;
      }
    }

    expect(await Test.new().next()).toBe('re: question');
  });

  it('will answer each wait from its own watcher', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    class Test extends Model {
      then = run(this);

      next() {
        this.then([200, 100], this.ask);
      }

      ask(ms: number) {
        this.then(this.reply, async (signal) => {
          await delay(ms, { signal });
          this.reply();
        });
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.next();

    await vi.advanceTimersByTimeAsync(200);
    await result;

    expect(test.then.record.filter((entry) => entry.wake).map((entry) => entry.wake)).toEqual(['wait#2', 'wait#1']);
  });

  it('will fail the run if a watcher throws before the wait closes', async () => {
    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        this.value = 1;
        this.then(this.reply, async () => {
          throw new Error('watcher');
        });
      }

      reply() {}
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('watcher');
    expect(test.value).toBe(1);
    expect(test.then.waiting).toEqual([]);
    expect(test.then.status).toBe('failed');
  });

  it('will not let a stale watcher answer the next run', async () => {
    const gate = mockPromise();
    const late = vi.fn();

    class Test extends Model {
      then = run(this);

      next(first: boolean) {
        this.then(this.reply, async () => {
          if (!first) return;

          await gate;

          try {
            this.reply();
          } catch (error) {
            late(error);
            throw error;
          }
        });
      }

      reply() {}
    }

    const test = Test.new();
    const first = test.next(true);

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    test.reply();
    await first;

    const second = test.next(false);

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    gate.resolve();
    await vi.waitFor(() => expect(late).toHaveBeenCalledWith(new Error('next has settled; reply cannot run.')));
    expect(test.then.waiting).toHaveLength(1);

    test.reply();
    await second;
  });

  it('will abort watchers when the run stops', async () => {
    let signal!: AbortSignal;

    class Test extends Model {
      then = run(this);

      next() {
        this.then(this.reply, (given) => void (signal = given));
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(signal).toBeDefined());
    test.then.stop();

    expect(signal.aborted).toBe(true);
    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
  });

  it('will fail if tokens are mixed with step references', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.then(this.a(), this.reply);
      }

      a() {}
      reply() {}
    }

    await expect(Test.new().next()).rejects.toThrow('then() takes called steps or step references, not both.');
  });

  it('will type a watcher signal', () => {
    class Test extends Job {
      async next() {
        this.then(this.reply, async (signal) => {
          expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
        });
      }

      async reply() {}
    }

    expect(Test.new().then.status).toBe('idle');
  });
});

describe('slot', () => {
  afterEach(() => void vi.useRealTimers());

  const gates = (...keys: string[]) => new Map(keys.map((key) => [key, mockPromise()]));

  it('will run a group at most max at a time, in order', async () => {
    const work = gates('a', 'b', 'c', 'd');
    const started: string[] = [];

    class Test extends Job {
      async next() {
        this.then(['a', 'b', 'c', 'd'], this.visit);
      }

      protected async visit(site: string) {
        this.then.slot({ max: 2 });
        this.scan(site);
      }

      protected async scan(site: string) {
        started.push(site);
        await work.get(site);
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    expect(started).toEqual(['a', 'b']);

    work.get('b')!.resolve();
    await flushMicrotasks();
    expect(started).toEqual(['a', 'b', 'c']);

    work.get('a')!.resolve();
    await flushMicrotasks();
    expect(started).toEqual(['a', 'b', 'c', 'd']);

    work.get('c')!.resolve();
    work.get('d')!.resolve();
    await result;
    expect(test.then.record[1].next).toEqual([
      { id: 'slot#1', key: 'slot', args: [] },
      { id: 'scan#1', key: 'scan', args: ['a'] }
    ]);
  });

  it('will follow a max read live', async () => {
    const work = gates('a', 'b', 'c');
    const started: string[] = [];

    class Test extends Job {
      limit = 1;

      async next() {
        this.then(['a', 'b', 'c'], this.visit);
      }

      protected async visit(site: string) {
        this.then.slot({ max: () => this.limit });
        this.scan(site);
      }

      protected async scan(site: string) {
        started.push(site);
        await work.get(site);
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    expect(started).toEqual(['a']);

    test.limit = 2;
    await flushMicrotasks();
    expect(started).toEqual(['a', 'b']);

    test.limit = 1;
    work.get('a')!.resolve();
    await flushMicrotasks();
    expect(started).toEqual(['a', 'b']);

    work.get('b')!.resolve();
    await flushMicrotasks();
    expect(started).toEqual(['a', 'b', 'c']);

    work.get('c')!.resolve();
    await result;
  });

  it('will wait after ms before taking a slot', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const scan = vi.fn();

    class Test extends Job {
      async next() {
        this.then.slot({ after: 1000 });
        this.scan();
      }

      protected async scan() {
        scan();
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.advanceTimersByTimeAsync(999);
    expect(scan).not.toHaveBeenCalled();
    expect(test.then.status).toBe('running');

    await vi.advanceTimersByTimeAsync(1);
    await result;
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it('will share a keyed slot across jobs', async () => {
    const lock = {};
    const work = gates('one', 'two');
    const started: string[] = [];

    class Test extends Job {
      name = '';

      async next() {
        this.then.slot({ key: lock, max: 1 });
        this.work();
      }

      protected async work() {
        started.push(this.name);
        await work.get(this.name);
      }
    }

    const one = Test.new({ name: 'one' });
    const two = Test.new({ name: 'two' });
    const done = Promise.all([one.next(), two.next()]);

    await flushMicrotasks();
    expect(started).toEqual(['one']);

    work.get('one')!.resolve();
    await flushMicrotasks();
    expect(started).toEqual(['one', 'two']);

    work.get('two')!.resolve();
    await done;
  });

  it('will share a primitive key across groups of one job', async () => {
    const work = gates('x', 'y');
    const started: string[] = [];

    class Test extends Job {
      async next() {
        this.then(this.one(), this.two());
      }

      protected async one() {
        this.then(['x'], this.work);
      }

      protected async two() {
        this.then(['y'], this.work);
      }

      protected async work(name: string) {
        this.then.slot({ key: 'db', max: 1 });
        this.query(name);
      }

      protected async query(name: string) {
        started.push(name);
        await work.get(name);
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    expect(started).toEqual(['x']);

    work.get('x')!.resolve();
    await flushMicrotasks();
    expect(started).toEqual(['x', 'y']);

    work.get('y')!.resolve();
    await result;
  });

  it('will slot a step outside any group on the job', async () => {
    const order: string[] = [];

    class Test extends Job {
      async next() {
        this.then.slot({ max: 1 });
        this.a();
        this.b();
      }

      protected async a() {
        this.then.slot({ max: 1 });
        order.push('a');
      }

      protected async b() {
        order.push('b');
      }
    }

    const test = Test.new();

    await test.next();
    expect(order).toEqual(['a', 'b']);
    expect(test.then.record[0].next.map((node) => node.id)).toEqual(['slot#1', 'a#1', 'b#1']);
  });

  it('will re-enter a slot held above it', async () => {
    const done = vi.fn();

    class Test extends Job {
      async next() {
        this.then(['a', 'b'], this.visit);
      }

      protected async visit(site: string) {
        this.then.slot({ max: 1 });
        this.inner(site);
      }

      protected async inner(site: string) {
        this.then.slot({ max: 1 });
        this.finish(site);
      }

      protected async finish(site: string) {
        done(site);
      }
    }

    const test = Test.new();

    await test.next();
    expect(done.mock.calls).toEqual([['a'], ['b']]);
  });

  it('will release slots when a run fails', async () => {
    const lock = {};
    const gate = mockPromise();
    const work = vi.fn();

    class Failing extends Job {
      async next() {
        this.then.slot({ key: lock, max: 1 });
        this.fail();
        this.then.slot({ key: lock, max: 1 });
        this.never();
      }

      protected async fail() {
        await gate;
        throw new Error('boom');
      }

      protected async never() {
        work('never');
      }
    }

    class Other extends Job {
      async next() {
        this.then.slot({ key: lock, max: 1 });
        this.work();
      }

      protected async work() {
        work('other');
      }
    }

    const failing = Failing.new();
    const other = Other.new();
    const failed = failing.next();

    await flushMicrotasks();

    const waiting = other.next();

    await flushMicrotasks();
    expect(work).not.toHaveBeenCalled();

    const failure = expect(failed).rejects.toThrow('boom');

    gate.reject(new Error('boom'));

    await waiting;
    await failure;
    expect(work.mock.calls).toEqual([['other']]);
  });

  it('will release held and pending slots when stopped', async () => {
    const lock = {};
    const gate = mockPromise();
    const work = vi.fn();

    class Holder extends Job {
      async next() {
        this.then(['a', 'b'], this.visit);
      }

      protected async visit(site: string) {
        this.then.slot({ key: lock, max: 1 });
        this.hold(site);
      }

      protected async hold(site: string) {
        work(site);
        await gate;
      }
    }

    class Other extends Job {
      async next() {
        this.then.slot({ key: lock, max: 1 });
        this.work();
      }

      protected async work() {
        work('other');
      }
    }

    const holder = Holder.new();
    const other = Other.new();
    const stopped = holder.next();

    await flushMicrotasks();

    const waiting = other.next();

    await flushMicrotasks();
    expect(work.mock.calls).toEqual([['a']]);

    holder.then.stop();
    await waiting;
    expect(work.mock.calls).toEqual([['a'], ['other']]);

    gate.resolve();
    await expect(stopped).rejects.toThrow('was stopped');
    expect(work.mock.calls).toEqual([['a'], ['other']]);
  });

  it('will release slots when ended from outside', async () => {
    const lock = {};
    const gate = mockPromise();

    class Test extends Job {
      async next() {
        this.then.slot({ key: lock, max: 1 });
        this.hold();
      }

      protected async hold() {
        await gate;
      }
    }

    const one = Test.new();
    const two = Test.new();
    const ended = one.next();

    await flushMicrotasks();

    const waiting = two.next();

    one.then.end('early');
    gate.resolve();

    expect(await ended).toBe('early');
    await waiting;
  });

  it('will cancel a slot whose step a back discards', async () => {
    const never = vi.fn();

    class Test extends Job {
      async next() {
        this.then(this.first(), this.second());
      }

      protected async first() {
        this.then.slot({ max: 0 });
        this.never();
      }

      protected async second() {
        this.then(this.waiter(), this.third());
      }

      protected async waiter() {
        this.then.slot({ max: 0, key: 'other' });
        this.never();
      }

      protected async third() {
        this.then.back(this.first, 'reset');
      }

      protected async never() {
        never();
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    expect(test.then.record.at(-1)).toMatchObject({ key: 'back', to: 'first#1' });
    expect(test.then.status).toBe('running');

    test.then.stop();
    await expect(result).rejects.toThrow('was stopped');
    expect(never).not.toHaveBeenCalled();
  });

  it('will not reach a slot after a failure', async () => {
    const never = vi.fn();

    class Test extends Job {
      async next() {
        this.then(this.fail(), this.slow());
      }

      protected async fail() {
        throw new Error('boom');
      }

      protected async slow() {
        await Promise.resolve();
        this.then.slot();
        this.never();
      }

      protected async never() {
        never();
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(never).not.toHaveBeenCalled();
  });

  it('will not group or return a slot', async () => {
    class Grouped extends Job {
      async next() {
        this.then(this.then.slot() as never);
      }
    }

    class Returned extends Job {
      async next() {
        return this.then.slot() as never;
      }
    }

    await expect(Grouped.new().next()).rejects.toThrow('slot() cannot be grouped.');
    await expect(Returned.new().next()).rejects.toThrow('next returned a value; a step returns nothing, or its undo.');
  });

  it('will throw outside a step', () => {
    class Test extends Job {}

    expect(() => Test.new().then.slot()).toThrow('slot must be called inside a step.');
  });
});

describe('catch', () => {
  afterEach(() => void vi.useRealTimers());

  it('will unwind a caught branch and continue', async () => {
    const undo = vi.fn();

    class Test extends Job {
      static readonly rewind = true;

      value = 0;

      async next() {
        this.a().catch();
        this.b();
      }

      protected async a() {
        this.value = 1;
        this.a1();

        return undo;
      }

      protected async a1() {
        this.value = 2;
        throw new Error('boom');
      }

      protected async b() {}
    }

    const test = Test.new();

    expect(await test.next()).toEqual({ value: 0 });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(test.then.record).toEqual([
      {
        id: 'next#1',
        key: 'next',
        args: [],
        wrote: [],
        prior: {},
        patch: {},
        next: [
          { id: 'a#1', key: 'a', args: [], rescue: true },
          { id: 'b#1', key: 'b', args: [] }
        ]
      },
      expect.objectContaining({ id: 'a#1', undo: 'closure', undone: true }),
      { id: 'a1#1', key: 'a1', args: [], next: [], wrote: [], error: new Error('boom') },
      expect.objectContaining({ id: 'b#1' })
    ]);
  });

  it('will run a step in the caught branch\'s place with its args', async () => {
    const seen = vi.fn();

    class Test extends Job {
      async next() {
        this.scan('x').catch(this.fallback);
        this.after1();
      }

      protected async scan(site: string) {
        throw new Error(`${site} is down`);
      }

      protected async fallback(site: string) {
        seen(site, this.then.caught, this.then.attempt);
      }

      protected async after1() {
        seen('after');
      }
    }

    const test = Test.new();

    await test.next();
    expect(seen.mock.calls).toEqual([['x', new Error('x is down'), 0], ['after']]);
    expect(test.then.record[0].next[0]).toEqual({ id: 'scan#1', key: 'scan', args: ['x'], rescue: 'fallback' });
    expect(test.then.record.map((entry) => entry.id)).toEqual(['next#1', 'scan#1', 'fallback#1', 'after1#1']);
  });

  it('will count attempts of a step re-run from its own catch', async () => {
    const attempts: number[] = [];

    class Test extends Job {
      async next() {
        this.then(['a'], (site) => this.visit(site).catch());
      }

      protected async visit(site: string) {
        attempts.push(this.then.attempt);

        if (this.then.attempt == 2) throw new Error('give up');

        this.scan(site).catch(this.visit);
      }

      protected async scan(site: string) {
        throw new Error(`${site} is down`);
      }
    }

    const test = Test.new();

    await test.next();
    expect(attempts).toEqual([0, 1, 2]);
    expect(test.then.record.map(({ id, attempt, error }) => [id, attempt, (error as Error)?.message])).toEqual([
      ['next#1', undefined, undefined],
      ['visit#1', undefined, undefined],
      ['scan#1', undefined, 'a is down'],
      ['visit#2', 1, undefined],
      ['scan#2', undefined, 'a is down'],
      ['visit#3', 2, 'give up']
    ]);
  });

  it('will count a step caught by itself as a first repeat', async () => {
    const attempts: number[] = [];

    class Test extends Job {
      async next() {
        this.scan().catch(this.scan);
      }

      protected async scan() {
        attempts.push(this.then.attempt);
        throw new Error('down');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('down');
    expect(attempts).toEqual([0, 1]);
  });

  it('will back off a retry with a slot', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    let tries = 0;

    class Test extends Job {
      async next() {
        this.then.slot({ after: 100 * this.then.attempt });
        this.scan().catch(this.then.attempt < 2 ? this.next : undefined);
      }

      protected async scan() {
        if (++tries < 3) throw new Error('later');
      }
    }

    const result = Test.new().next();

    await vi.advanceTimersByTimeAsync(0);
    expect(tries).toBe(1);

    await vi.advanceTimersByTimeAsync(99);
    expect(tries).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(tries).toBe(2);

    await vi.advanceTimersByTimeAsync(200);
    expect(tries).toBe(3);

    await result;
  });

  it('will run a function in the caught branch\'s place given the error', async () => {
    class Test extends Job {
      value = '';

      async next() {
        this.scan().catch((error: Error) => {
          this.value = error.message;
        });
      }

      protected async scan() {
        throw new Error('down');
      }
    }

    const test = Test.new();

    expect(await test.next()).toEqual({ value: 'down' });
    expect(test.then.record[0].next).toEqual([{ id: 'scan#1', key: 'scan', args: [], rescue: 'then' }]);
    expect(test.then.record.at(-1)).toMatchObject({ id: 'then#1', key: 'then', args: [], wrote: ['value'] });
  });

  it('will settle a mapped group with what succeeded', async () => {
    class Test extends Job {
      found = has<string>();

      async next() {
        this.then(['a', 'b', 'c'], (site) => this.visit(site).catch());
      }

      protected async visit(site: string) {
        this.found.push(site);
        await Promise.resolve();

        if (site == 'b') throw new Error('blocked');
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.found.get()).toEqual(['a', 'c']);
  });

  it('will catch a group token', async () => {
    const gate = mockPromise();
    const after = vi.fn();

    class Test extends Job {
      static readonly rewind = true;

      value = 0;

      async next() {
        this.then(this.a(), this.b(), this.c()).catch();
        this.d();
      }

      protected async a() {
        this.value = 1;
      }

      protected async b() {
        await gate;
        throw new Error('b');
      }

      protected async c() {
        await gate;
        await Promise.resolve();
        throw new Error('c');
      }

      protected async d() {
        after(this.value);
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    gate.resolve();

    await result;
    expect(after).toHaveBeenCalledWith(0);
    expect(test.then.record.filter((entry) => entry.error).map((entry) => entry.id)).toEqual(['b#1', 'c#1']);
  });

  it('will catch an answer or watcher of a caught wait', async () => {
    class Test extends Job {
      async next() {
        this.then(this.answer).catch();
        this.then(this.answer, async () => {
          throw new Error('watcher');
        }).catch();
      }

      async answer() {
        throw new Error('answer');
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    await test.answer();

    await result;
    expect(test.then.status).toBe('idle');
  });

  it('will fail the run when a caught branch\'s undo throws', async () => {
    class Test extends Job {
      async next() {
        this.a().catch();
      }

      protected async a() {
        this.b();

        return () => {
          throw new Error('undo');
        };
      }

      protected async b() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('undo');
    expect(test.then.record[1]).toMatchObject({ id: 'a#1', undone: 'failed' });
  });

  it('will not run a handler once the run stops', async () => {
    const gate = mockPromise();
    const handler = vi.fn();

    class Test extends Job {
      async next() {
        this.a().catch(handler);
      }

      protected async a() {
        this.b();

        return () => gate;
      }

      protected async b() {
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.then.stop();
    gate.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('will not catch a broken rule', async () => {
    class Test extends Job {
      value = 0;

      async next() {
        this.a().catch();
      }

      protected async a() {
        this.b();
        this.value = 1;
      }

      protected async b() {}
    }

    await expect(Test.new().next()).rejects.toThrow('a wrote value after scheduling b.');
  });

  it('will not catch back, slot or end', async () => {
    const errors: unknown[] = [];

    class Test extends Job {
      async next() {
        for (const token of [() => this.then.back(this.next), () => this.then.slot(), () => this.then.end()])
          try {
            (token() as unknown as Promise<void>).catch();
          } catch (error) {
            errors.push(error);
          }
      }
    }

    await Test.new().next().catch(() => {});
    expect(errors).toEqual([new Error('back() cannot be caught.'), new Error('slot() cannot be caught.'), new Error('end() cannot be caught.')]);
  });

  it('will throw for a handler not a function', async () => {
    class Test extends Job {
      async next() {
        this.a().catch('a' as never);
      }

      protected async a() {}
    }

    await expect(Test.new().next()).rejects.toThrow('catch() takes a step, a function or nothing.');
  });

  it('will throw attempt and caught outside a step', () => {
    class Test extends Job {}

    const test = Test.new();

    expect(() => test.then.attempt).toThrow('attempt must be read inside a step.');
    expect(() => test.then.caught).toThrow('caught must be read inside a step.');
  });
});

describe('suspense', () => {
  it('will wait in next for a pending value', async () => {
    let tries = 0;

    class Test extends Model {
      then = run(this);
      price = set<number>();
      total = 0;

      next() {
        tries++;
        this.total = this.price * 2;
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    expect(tries).toBe(1);
    expect(test.then.status).toBe('running');
    expect(test.then.active).toBe('next');
    expect(test.then.record).toEqual([]);

    test.price = 3;

    await result;
    expect(tries).toBe(2);
    expect(test.total).toBe(6);
    expect(test.then.record).toEqual([{ id: 'next#1', key: 'next', args: [], wrote: ['total'], next: [] }]);
  });

  it('will restore writes and drop tokens of a suspended try', async () => {
    const order: string[] = [];

    class Test extends Model {
      then = run(this);
      price = set<number>();
      note = '';

      next() {
        this.quote();
      }

      async quote() {
        this.note = 'quoting';
        order.push(`quote:${this.note}`);
        this.report();
        this.price;
      }

      async report() {
        order.push(`report:${this.note}`);
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(order).toEqual(['quote:quoting']));
    expect(test.note).toBe('');

    test.price = 5;

    await result;
    expect(order).toEqual(['quote:quoting', 'quote:quoting', 'report:quoting']);
    expect(test.then.record.map(({ id, wrote, next }) => [id, wrote, next.map((node) => node.id)])).toEqual([
      ['next#1', [], ['quote#1']],
      ['quote#1', ['note'], ['report#2']],
      ['report#2', [], []]
    ]);
  });

  it('will wait for a getter over a pending value', async () => {
    class Test extends Model {
      then = run(this);
      price = set<number>();
      total = 0;

      get taxed() {
        return this.price * 2;
      }

      next() {
        this.total = this.taxed;
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.price = 4;

    await result;
    expect(test.total).toBe(8);
  });

  it('will wait after an await', async () => {
    const work = mockPromise();
    let tries = 0;

    class Test extends Model {
      then = run(this);
      price = set<number>();
      total = 0;

      async next() {
        tries++;
        await work;
        this.total = this.price;
      }
    }

    const test = Test.new();
    const result = test.next();

    work.resolve();
    await vi.waitFor(() => expect(tries).toBe(1));
    await flushMicrotasks();

    test.price = 7;

    await result;
    expect(tries).toBe(2);
    expect(test.total).toBe(7);
  });

  it('will fail with the rejection of a pending value', async () => {
    const pending = mockPromise();

    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        this.value = 1;
        throw pending;
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    pending.reject(new Error('gone'));

    await expect(result).rejects.toThrow('gone');
    expect(test.value).toBe(0);
    expect(test.then.status).toBe('failed');
    expect(test.then.record).toEqual([]);
  });

  it('will not count a suspended try as an attempt', async () => {
    const pending = mockPromise();
    const attempts: number[] = [];

    class Test extends Job {
      async next() {
        this.flaky().catch(this.flaky);
      }

      protected async flaky() {
        attempts.push(this.then.attempt);

        if (attempts.length == 1) throw pending;
        if (attempts.length == 2) throw new Error('flaky');
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    pending.resolve();

    await result;
    expect(attempts).toEqual([0, 0, 1]);
    expect(test.then.record.slice(1)).toEqual([
      { id: 'flaky#1', key: 'flaky', args: [], wrote: [], next: [], error: new Error('flaky') },
      { id: 'flaky#2', key: 'flaky', args: [], wrote: [], next: [], attempt: 1 }
    ]);
  });

  it('will catch a rejected pending value', async () => {
    const pending = mockPromise();
    let tries = 0;

    class Test extends Job {
      async next() {
        this.flaky().catch(this.flaky);
      }

      protected async flaky() {
        if (++tries == 1) throw pending;
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    pending.reject(new Error('gone'));

    await result;
    expect(tries).toBe(2);
    expect(test.then.record.slice(1).map(({ attempt, error }) => [attempt, error])).toEqual([
      [undefined, new Error('gone')],
      [1, undefined]
    ]);
  });

  it('will not fire hooks again', async () => {
    const order: string[] = [];

    class Test extends Model {
      then = run(this);
      price = set<number>();

      next() {
        order.push(`next:${this.price}`);
      }

      before(key: string) {
        order.push(`before:${key}`);
      }

      after(key: string) {
        order.push(`after:${key}`);
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.price = 1;

    await result;
    expect(order).toEqual(['before:next', 'next:1', 'after:next']);
  });

  it('will abort when stopped while waiting', async () => {
    class Test extends Model {
      then = run(this);
      price = set<number>();
      value = 0;

      next() {
        this.value = 1;
        this.value = this.price;
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.then.stop();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(test.value).toBe(0);
    expect(test.then.status).toBe('stopped');
    expect(test.then.record).toEqual([]);
  });

  it('will end without the step when ended while waiting', async () => {
    class Test extends Model {
      then = run(this);
      price = set<number>();

      next() {
        this.price;
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.then.end('early');

    expect(await result).toBe('early');
    expect(test.then.record.map((entry) => entry.id)).toEqual(['end#1']);
  });

  it('will abort a pending read after the step was stopped', async () => {
    const work = mockPromise();

    class Test extends Model {
      then = run(this);
      price = set<number>();

      async next() {
        await work;
        this.price;
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.then.stop();
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(test.then.error).toBeUndefined();
  });

  it('will fail a committed step reading a pending value', async () => {
    const pending = mockPromise();

    class Test extends Model {
      then = run(this);

      next() {
        this.then.commit();
        throw pending;
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toBe(pending);
    expect(test.then.record).toMatchObject([{ id: 'next#1', committed: true, error: pending }]);
  });

  it('will fail a hook reading a pending value after its step', async () => {
    class Test extends Model {
      then = run(this);
      price = set<number>();

      next() {}

      after() {
        this.price;
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toBeInstanceOf(Promise);
  });
});

describe('hooks', () => {
  it('will call hooks around each step', async () => {
    const order: unknown[][] = [];

    class Test extends Model {
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
    expect(test.then.record.map((entry) => entry.wrote)).toEqual([[], []]);
  });

  it('will not wrap hooks as steps', async () => {
    class Test extends Model {
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
    class Test extends Model {
      then = run(this);

      next() {}

      beforeNext() {
        throw new Error('hook');
      }
    }

    await expect(Test.new().next()).rejects.toThrow('hook');
  });

  it('will throw if a hook has no step', () => {
    class Test extends Model {
      then = run(this);

      afterShip() {}
    }

    expect(() => Test.new()).toThrow('afterShip has no step ship.');
  });

  it('will call back once the unwind completes', async () => {
    const order: unknown[] = [];

    class Test extends Model {
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
    expect(order).toEqual(['undo', ['back', 1, 'failed', 'boom'], ['rejected', 'boom']]);
    expect(test.then.record.map((entry) => entry.key)).toEqual(['next']);
  });

  it('will call back after a halted unwind', async () => {
    mockWarn();

    const back = vi.fn();

    class Item extends Model {}

    class Test extends Model {
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

    class Test extends Model {
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

    test.then.stop(true);
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(back).toHaveBeenCalledTimes(1);
    expect(back.mock.calls[0][0]).toMatchObject({ name: 'Stopped' });
  });

  it('will not call back on stop without undo', async () => {
    const work = mockPromise();
    const back = vi.fn();

    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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

  it('will call exit last when a run ends', async () => {
    const order: unknown[] = [];

    class Test extends Model {
      then = run(this);

      async next() {
        this.end('ok');
      }

      end(value: string) {
        order.push('end');
        return value;
      }

      exit(outcome: Runner.Outcome) {
        order.push(['exit', outcome]);
      }
    }

    const test = Test.new();

    await test.next().then((result) => void order.push(['resolved', result]));
    expect(order).toEqual(['end', ['exit', { status: 'done', result: 'ok' }], ['resolved', 'ok']]);
    expect(test.then.status).toBe('idle');
  });

  it('will call exit after back when a run fails', async () => {
    const order: unknown[] = [];

    class Test extends Model {
      then = run(this);

      async next() {
        throw new Error('boom');
      }

      back() {
        order.push('back');
      }

      exit(outcome: Runner.Outcome) {
        order.push(['exit', outcome]);
      }
    }

    await Test.new().next().catch((error: Error) => void order.push(['rejected', error.message]));
    expect(order).toEqual(['back', ['exit', { status: 'failed', error: new Error('boom') }], ['rejected', 'boom']]);
  });

  it('will call exit once when a run is stopped', async () => {
    const exit = vi.fn();
    const work = mockPromise();

    class Test extends Model {
      then = run(this);

      async next() {
        await work;
        this.then.end();
      }

      exit(outcome: Runner.Outcome) {
        exit(outcome);
      }
    }

    const test = Test.new();
    const result = test.next();

    test.then.stop();
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit.mock.calls[0][0]).toMatchObject({ status: 'stopped', error: { name: 'Stopped' } });
  });

  it('will reject a finished run when exit throws', async () => {
    const queued = vi.fn();

    class Test extends Model {
      then = run(this);
      runs = 0;

      next() {
        this.runs++;
      }

      exit() {
        if (this.runs == 1) throw new Error('exit');
        queued();
      }
    }

    const test = Test.new();
    const first = test.next();
    const second = test.next();

    await expect(first).rejects.toThrow('exit');
    await second;
    expect(queued).toHaveBeenCalled();
  });

  it('will replace the error when exit throws', async () => {
    class Test extends Model {
      then = run(this);

      async next() {
        throw new Error('boom');
      }

      exit() {
        throw new Error('exit');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('exit');
    expect(test.then.status).toBe('failed');
  });

  it('will not wrap exit as a step', async () => {
    class Test extends Model {
      then = run(this);

      next() {}

      exit() {
        return this;
      }
    }

    const test = Test.new();

    expect(test.exit()).toBe(test);
    await test.next();
    expect(test.then.record.map((entry) => entry.key)).toEqual(['next']);
  });

  it('will call an overridden hook once', async () => {
    const order: string[] = [];

    class Parent extends Model {
      then = run(this, { base: Parent });

      next() {}

      protected exit() {
        order.push('parent');
      }
    }

    class Child extends Parent {
      protected exit() {
        order.push('child');
      }
    }

    await Child.new().next();
    expect(order).toEqual(['child']);
  });

  it('will call hooks passed as options', async () => {
    const order: unknown[] = [];

    class Test extends Model {
      value = 0;

      then = run(this, {
        before(step, args, skip) {
          this.value++;
          order.push(['before', step, args, skip]);
        },
        after(step, entry, skip) {
          order.push(['after', step, entry.id, skip]);
        },
        back(error) {
          order.push(['back', (error as Error).message]);
        },
        exit(outcome) {
          order.push(['exit', outcome.status, this === test]);
        }
      });

      async next() {
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(order).toEqual([
      ['before', 'next', [], false],
      ['after', 'next', 'next#1', false],
      ['before', 'fail', [], false],
      ['back', 'boom'],
      ['exit', 'failed', true]
    ]);
    expect(test.value).toBe(2);
    expect(test.then.record.map((entry) => entry.wrote)).toEqual([[]]);
  });

  it('will call class hooks before option hooks', async () => {
    const order: string[] = [];

    class Test extends Model {
      then = run(this, {
        before: () => void order.push('option before'),
        after: () => void order.push('option after'),
        back: () => void order.push('option back'),
        exit: () => void order.push('option exit')
      });

      async next() {
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }

      protected before() {
        order.push('before');
      }

      protected beforeFail() {
        order.push('beforeFail');
      }

      protected after() {
        order.push('after');
      }

      protected back() {
        order.push('back');
      }

      protected exit() {
        order.push('exit');
      }
    }

    await expect(Test.new().next()).rejects.toThrow('boom');
    expect(order).toEqual([
      'before',
      'option before',
      'after',
      'option after',
      'before',
      'option before',
      'beforeFail',
      'back',
      'option back',
      'exit',
      'option exit'
    ]);
  });

  it('will fail when an option hook throws', async () => {
    const before = vi.fn();

    class Test extends Model {
      then = run(this, {
        before() {
          throw new Error('hook');
        }
      });

      next() {}

      protected beforeNext() {
        before();
      }
    }

    await expect(Test.new().next()).rejects.toThrow('hook');
    expect(before).not.toHaveBeenCalled();
  });

  it('will call option exit when the class exit throws', async () => {
    const exit = vi.fn();

    class Test extends Model {
      then = run(this, { exit });

      next() {}

      exit() {
        throw new Error('exit');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('exit');
    expect(exit).toHaveBeenCalledWith({ status: 'done', result: {} });
    expect(test.then.status).toBe('failed');
  });

  it('will check hook options by signature', () => {
    class Test extends Model {
      value = 0;

      then = run(this, {
        // @ts-expect-error
        before(step: number) {
          void step;
        },
        // @ts-expect-error
        back(error: unknown, more: number) {
          void error, more;
        },
        exit(outcome) {
          expectTypeOf(outcome.status).toEqualTypeOf<'done' | 'failed' | 'stopped'>();
          this.value++;
        }
      });

      next() {}
    }

    run(Test.new(), {
      // @ts-expect-error
      bakc() {}
    });

    run(Test.new(), {
      exit(outcome) {
        expectTypeOf(outcome).toEqualTypeOf<Runner.Outcome<Model.Values<Test>>>();
      }
    });

    expect(Test.new().then.status).toBe('idle');
  });
});

describe('undo', () => {
  it('will run undos in reverse and keep committed writes', async () => {
    const order: string[] = [];

    class Test extends Model {
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
    expect(test.get()).toMatchObject({ a: 1, b: 2, c: 0 });
    expect(test.then.record.map((entry) => [entry.key, entry.undo, entry.undone])).toEqual([
      ['next', 'closure', true],
      ['first', undefined, undefined]
    ]);
  });

  it('will unwind every step in reverse and restore fields with rewind', async () => {
    const order: string[] = [];

    class Test extends Model {
      then = run(this, { rewind: true });
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
    class Test extends Model {
      then = run(this, { rewind: true });
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

    class Test extends Model {
      then = run(this, { rewind: true });
      value = 0;

      next() {
        this.then(this.a(), this.b());
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

    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
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

describe('undo tokens', () => {
  afterEach(() => void vi.useRealTimers());

  it('will run the members of a returned group', async () => {
    const order: string[] = [];
    const refund = mockPromise();

    class Test extends Model {
      then = run(this);

      async next() {
        this.fail();

        return this.then(this.refund(), this.notify());
      }

      async refund() {
        order.push('refund');
        await refund;
        order.push('refunded');
      }

      async notify() {
        order.push('notify');
      }

      async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(order).toEqual(['refund', 'notify']));
    refund.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(order).toEqual(['refund', 'notify', 'refunded']);
    expect(test.then.record[0]).toMatchObject({
      undo: { id: 'then#1', key: 'then', args: [], group: [{ id: 'refund#1' }, { id: 'notify#1' }] },
      undone: true
    });
    expect(test.then.record[0].next).toEqual([{ id: 'fail#1', key: 'fail', args: [] }]);
  });

  it('will park the unwind on a returned wait', async () => {
    const charge = vi.fn();

    class Test extends Model {
      then = run(this, { rewind: true });
      charged = false;

      async next() {
        this.pay('ch_1');
      }

      async pay(id: string) {
        this.charged = true;
        this.fail();

        return this.then(this.refund, this.keep);
      }

      async fail() {
        throw new Error('boom');
      }

      async refund(id: string) {
        charge(id);
      }

      async keep() {}
    }

    const test = Test.new();
    const result = test.next();
    let settled = false;

    result.catch(() => (settled = true));

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    await flushMicrotasks();

    expect(settled).toBe(false);
    expect(test.charged).toBe(true);
    expect(test.then.error).toEqual(new Error('boom'));
    expect(test.then.waiting).toEqual([{ id: 'wait#1', step: 'pay', args: ['ch_1'], answers: ['refund', 'keep'] }]);
    expect(test.refund).toBeTypeOf('function');

    await test.refund('ch_1');

    await expect(result).rejects.toThrow('boom');
    expect(charge).toHaveBeenCalledWith('ch_1');
    expect(test.charged).toBe(false);
    expect(test.then.status).toBe('failed');
    expect(test.then.record.map((entry) => [entry.id, entry.wake, entry.undone])).toEqual([
      ['next#1', undefined, true],
      ['pay#1', undefined, true],
      ['refund#1', 'wait#1', undefined]
    ]);
    expect(test.then.record[1].undo).toEqual({ id: 'wait#1', key: 'wait', args: [], answers: ['refund', 'keep'] });
  });

  it('will continue the unwind after an answer which does nothing', async () => {
    class Test extends Model {
      then = run(this, { rewind: true });
      value = 0;

      async next() {
        this.value = 1;
        this.fail();

        return this.then(this.refund, this.keep);
      }

      async fail() {
        throw new Error('boom');
      }

      async refund() {}
      async keep() {}
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    await test.keep();

    await expect(result).rejects.toThrow('boom');
    expect(test.value).toBe(0);
    expect(test.then.record.map((entry) => [entry.id, entry.undone])).toEqual([
      ['next#1', true],
      ['keep#1', undefined]
    ]);
  });

  it('will not let an unwind answer schedule', async () => {
    class Test extends Model {
      then = run(this);

      async next() {
        this.fail();

        return this.then(this.refund);
      }

      async fail() {
        throw new Error('boom');
      }

      async refund() {
        this.more();
      }

      async more() {}
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    await expect(test.refund()).rejects.toThrow(`${test} is failed; more cannot run.`);

    await expect(result).rejects.toThrow(`${test} is failed; more cannot run.`);
    expect(test.then.record.map((entry) => [entry.id, entry.undone])).toEqual([['next#1', 'failed']]);
  });

  it('will not call hooks for an unwind answer', async () => {
    const before = vi.fn();

    class Test extends Model {
      then = run(this);

      async next() {
        this.fail();

        return this.then(this.refund);
      }

      async fail() {
        throw new Error('boom');
      }

      async refund() {}

      before(key: string) {
        before(key);
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    await test.refund();

    await expect(result).rejects.toThrow('boom');
    expect(before.mock.calls).toEqual([['next'], ['fail']]);
  });

  it('will halt a parked unwind on stop', async () => {
    const undo = vi.fn();

    class Test extends Model {
      then = run(this, { rewind: true });
      value = 0;

      async next() {
        this.value = 1;
        this.first();

        return undo;
      }

      async first() {
        this.value = 2;
        this.second();

        return this.then(this.refund);
      }

      async second() {
        this.value = 3;
        this.fail();
      }

      async fail() {
        throw new Error('boom');
      }

      async refund() {}
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    expect(test.value).toBe(2);

    test.then.stop();

    await expect(result).rejects.toThrow('boom');
    expect(undo).not.toHaveBeenCalled();
    expect(test.value).toBe(2);
    expect(test.then.status).toBe('failed');
    expect(test.refund).toBeUndefined();
    expect(test.then.record.map((entry) => [entry.id, entry.undone, entry.halted])).toEqual([
      ['next#1', undefined, undefined],
      ['first#1', undefined, true],
      ['second#1', true, undefined]
    ]);
  });

  it('will answer an unwind wait from a watcher', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });

    const refund = vi.fn();

    class Test extends Model {
      then = run(this);

      async next() {
        this.fail();

        return this.then(this.refund, this.keep, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.refund();
        });
      }

      async fail() {
        throw new Error('boom');
      }

      async refund() {
        refund();
      }

      async keep() {}
    }

    const test = Test.new();
    const result = test.next();

    result.catch(() => {});

    await vi.advanceTimersByTimeAsync(99);
    expect(test.then.status).toBe('waiting');

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).rejects.toThrow('boom');
    expect(refund).toHaveBeenCalled();
  });

  it('will fail the undo if a watcher of its wait throws', async () => {
    class Test extends Model {
      then = run(this);

      async next() {
        this.fail();

        return this.then(this.refund, async () => {
          throw new Error('watcher');
        });
      }

      async fail() {
        throw new Error('boom');
      }

      async refund() {}
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('watcher');
    expect(test.then.waiting).toEqual([]);
    expect(test.then.record.map((entry) => entry.undone)).toEqual(['failed']);
  });

  it('will keep a step Promise<void> when it returns a group or a wait', () => {
    class Test extends Job {
      async next() {
        return this.then(this.a(), this.b());
      }

      protected async a() {
        return this.then(this.refund, this.keep);
      }

      protected async b() {
        return this.then([1, 2], this.refund);
      }

      async refund() {}
      async keep() {}
    }

    expectTypeOf<ReturnType<Test['next']>>().toEqualTypeOf<Promise<void>>();
    expect(Test.new().then.status).toBe('idle');
  });
});

describe('collections', () => {
  class Item extends Model {
    name = '';
  }

  it('will roll back list push, put, pop and set', async () => {
    class Test extends Model {
      then = run(this, { rewind: true });
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
    class Test extends Model {
      then = run(this);
      items = has(['a']);
      count = 0;

      next() {
        this.count = this.items.size;
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.then.record[0].wrote).toEqual(['count']);
  });

  it('will journal a collection in its export form', async () => {
    class Test extends Model {
      then = run(this, { rewind: true });
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
    class Test extends Model {
      then = run(this);
      items = has<string>();

      next() {
        this.is.items.push('a');
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.then.record[0].wrote).toEqual([]);
  });

  it('will restore a list before a retry', async () => {
    let tries = 0;

    class Test extends Job {
      items = has<string>();

      async next() {
        this.push().catch(this.push);
      }

      protected async push() {
        this.items.push(`try ${++tries}`);

        if (tries < 2) throw new Error('flaky');
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.items.get()).toEqual(['try 2']);
    expect(test.then.record.map((entry) => entry.wrote)).toEqual([[], [], ['items']]);
  });

  it('will attribute a change only to the step making it', async () => {
    const gate = mockPromise();

    class Test extends Model {
      then = run(this, { rewind: true });
      items = has(['a']);

      next() {
        this.then(this.write(), this.read());
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
    expect(test.then.record.map((entry) => [entry.key, entry.wrote, entry.prior, entry.patch])).toEqual([
      ['next', [], {}, {}],
      ['write', ['items'], { items: ['a'] }, { items: ['a', 'b'] }],
      ['read', [], {}, {}]
    ]);
  });

  it('will keep a sibling\'s pushes when a parallel step fails', async () => {
    const gate = mockPromise();

    class Test extends Model {
      then = run(this);
      items = has<string>();

      next() {
        this.then(this.good(), this.bad());
      }

      protected async good() {
        this.items.push('good');
      }

      protected async bad() {
        this.items.push('bad');
        await gate;
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    expect(test.items.get()).toEqual(['good', 'bad']);

    gate.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(test.items.get()).toEqual(['good']);
  });

  it('will keep a sibling\'s pushes when a parallel step retries', async () => {
    let tries = 0;

    class Test extends Model {
      then = run(this);
      items = has<string>();

      next() {
        this.then(this.flaky().catch(this.flaky), this.steady());
      }

      protected async flaky() {
        this.items.push(`flaky ${++tries}`);
        await Promise.resolve();

        if (tries < 2) throw new Error('flaky');
      }

      protected async steady() {
        this.items.push('steady');
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.items.get()).toEqual(['steady', 'flaky 2']);
  });

  it('will undo only its own change around a sibling\'s', async () => {
    const gate = mockPromise();

    class Test extends Model {
      then = run(this);
      items = has(['a', 'b']);

      next() {
        this.then(this.bad(), this.good());
      }

      protected async bad() {
        this.items.push('x', 'y');
        this.items.set(0, 'z');
        await gate;
        throw new Error('boom');
      }

      protected async good() {
        await Promise.resolve();
        this.items.put(0, 'first');
        this.items.push('last');
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    expect(test.items.get()).toEqual(['first', 'z', 'b', 'x', 'y', 'last']);

    gate.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(test.items.get()).toEqual(['first', 'a', 'b', 'last']);
  });

  it('will skip an undo whose value a sibling removed', async () => {
    const gate = mockPromise();

    class Test extends Model {
      then = run(this);
      items = has(['a']);

      next() {
        this.then(this.bad(), this.good());
      }

      protected async bad() {
        this.items.push('x');
        this.items.set(0, 'z');
        await gate;
        throw new Error('boom');
      }

      protected async good() {
        await Promise.resolve();
        this.items.clear();
        this.items.push('kept');
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    gate.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(test.items.get()).toEqual(['kept']);
  });

  it('will undo the nearest of equal values', async () => {
    class Test extends Model {
      then = run(this);
      items = has(['a', 'b', 'a', 'c', 'a']);

      next() {
        this.items.put(2, 'a');
        this.items.clear();
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.items.get()).toEqual(['a', 'b', 'a', 'c', 'a']);
  });

  it('will record nothing for a list call changing nothing', async () => {
    class Test extends Model {
      then = run(this);
      items = has(['a']);

      next() {
        this.items.push();
        this.items.put(0);
        this.items.set(5, 'x');
        this.items.set(0, 'a');
        this.items.pop(3);
        this.items.pop(0, 1);
        this.items.pop();
        this.items.clear();
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.then.record[0].wrote).toEqual(['items']);
    expect(test.items.size).toBe(0);
  });

  it('will fail a collection change after scheduling', async () => {
    class Test extends Model {
      then = run(this);
      items = has(['a']);

      next() {
        this.later();
        this.items.push('b');
      }

      protected async later() {}
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('next wrote items after scheduling later.');
    expect(test.items.get()).toEqual(['a']);
  });

  it('will not fail a collection call changing nothing after scheduling', async () => {
    class Test extends Model {
      then = run(this);
      items = has<string>();

      next() {
        this.later();
        this.items.pop();
      }

      protected async later() {}
    }

    const test = Test.new();

    await test.next();
    expect(test.then.status).toBe('idle');
  });

  it('will leave a change through a settled step\'s collection unmanaged', async () => {
    let items!: has.List<string>;

    class Test extends Model {
      then = run(this);
      list = has<string>();

      next() {
        items = this.list;
      }
    }

    const test = Test.new();

    await test.next();
    items.push('late');
    expect(test.list.get()).toEqual(['late']);
    expect(test.then.record[0].wrote).toEqual([]);
  });

  it('will hand one wrapper per collection to a step', async () => {
    class Test extends Model {
      then = run(this);
      items = has(['a']);
      same = false;

      next() {
        this.same = this.items === this.items && this.items.get(0) === 'a' && this.items.size == 1;
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.same).toBe(true);
  });

  it('will restore the earliest snapshot of parallel steps', async () => {
    const first = mockPromise();
    const second = mockPromise();

    class Test extends Model {
      then = run(this, { rewind: true });
      items = has(['a']);

      next() {
        this.then(this.early(), this.late());
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
    class Test extends Model {
      then = run(this, { rewind: true });
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

  it('will restore a guest Model removed from a map', async () => {
    const guest = Item.new({ name: 'guest' });

    class Test extends Model {
      then = run(this, { rewind: true });
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
    class Test extends Model {
      then = run(this, { rewind: true });
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

    class Test extends Model {
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

  it('will keep a sibling\'s map entries when a parallel step fails', async () => {
    const gate = mockPromise();

    class Test extends Model {
      then = run(this);
      values = map<string, number>([['a', 1], ['b', 2]]);

      next() {
        this.then(this.bad(), this.good());
      }

      protected async bad() {
        this.values.set('a', 2).set('n', 1);
        this.values.delete('b');
        await gate;
        throw new Error('boom');
      }

      protected async good() {
        await Promise.resolve();
        this.values.set('g', 1);
        this.values.set('n', 5);
        this.values.set('b', 7);
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    gate.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(test.values.get()).toEqual(new Map([['a', 1], ['n', 5], ['g', 1], ['b', 7]]));
  });

  it('will restore a cleared map', async () => {
    class Test extends Model {
      then = run(this);
      values = map<string, number>([['a', 1], ['b', 2]]);
      empty = map<string, number>();

      next() {
        this.values.clear();
        this.values.set('c', 3);
        this.values.set('c', 3);
        this.values.delete('x');
        this.empty.clear();
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.values.get()).toEqual(new Map([['a', 1], ['b', 2]]));
  });

  it('will remove a key it added and replaced', async () => {
    class Test extends Model {
      then = run(this);
      values = map<string, Model>();
      plain = map<string, number>();

      next() {
        this.values.set('a', Item.new({ name: 'a' }));
        this.values.set('a', Item.new({ name: 'b' }));
        this.values.delete('a');
        this.values.set('a', Item.new({ name: 'c' }));
        this.plain.set('x', 1);
        this.plain.set('x', 2);
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.values.size).toBe(0);
    expect(test.plain.size).toBe(0);
    expect(test.then.record).toEqual([]);
  });

  it('will keep a sibling\'s pool members when a parallel step fails', async () => {
    const gate = mockPromise();
    const kept = Item.new({ name: 'kept' });

    class Test extends Model {
      then = run(this);
      items = has(Item);

      protected new() {
        this.items.add(kept);
      }

      next() {
        this.then(this.bad(), this.good());
      }

      protected async bad() {
        this.items.add({ name: 'bad' });
        this.items.add(kept);
        this.items.delete(Item.new());
        await gate;
        throw new Error('boom');
      }

      protected async good() {
        await Promise.resolve();
        this.items.add({ name: 'good' });
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    gate.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(test.items.map((item) => item.name)).toEqual(['kept', 'good']);
  });

  it('will not be irreversible removing members it added', async () => {
    class Test extends Model {
      then = run(this);
      items = has(Item);
      empty = has(Item);

      next() {
        const item = this.items.add({ name: 'a' });

        this.items.delete(item);
        this.items.add({ name: 'b' });
        this.items.clear();
        this.empty.clear();
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(test.items.size).toBe(0);
    expect(test.then.record).toEqual([]);
  });
});

describe('irreversible', () => {
  class Item extends Model {
    name = '';
  }

  it('will stop the unwind at a removed pool member', async () => {
    const warn = mockWarn();

    class Test extends Model {
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

    class Test extends Model {
      then = run(this, { rewind: true });
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

    class Test extends Model {
      then = run(this, { rewind: true });
      items = has(Item);
      values = map((key: string) => new Item({ name: key }));

      protected new() {
        this.items.add({ name: 'a' });
        this.values.set('a');
        this.values.set('c');
      }

      next() {
        this.items.clear();
        this.values.delete('a');
        this.values.set('b');
        this.values.set('c');
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
    expect([...test.values.keys()]).toEqual(['c']);
    expect(test.then.record[0]).toMatchObject({ undo: 'closure', undone: true });
    expect(test.then.record[0].irreversible).toBeUndefined();
  });

  it('will be irreversible when a map evicts an owned value', async () => {
    mockWarn();

    class Test extends Model {
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

  it('will not catch an irreversible step', async () => {
    mockWarn();

    const attempt = vi.fn();

    class Test extends Model {
      then = run(this);
      items = has(Item);
      value = 0;

      protected new() {
        this.items.add({ name: 'a' });
      }

      next() {
        this.drop().catch(this.drop);
      }

      protected async drop() {
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
    expect(test.then.record[1]).toEqual({
      id: 'drop#1',
      key: 'drop',
      args: [],
      wrote: ['value', 'items'],
      next: [],
      error: new Error('boom'),
      irreversible: ['items'],
      halted: true
    });
  });

  it('will keep the writes of a failing irreversible step', async () => {
    const warn = mockWarn();

    class Test extends Model {
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

describe('commit', () => {
  it('will stop the unwind at a committed step', async () => {
    const warn = mockWarn();
    const refund = vi.fn();
    const recall = vi.fn();

    class Test extends Model {
      then = run(this, { rewind: true });
      charged = false;
      notified = false;

      next() {
        this.pay();
      }

      protected async pay() {
        this.then.commit();
        this.charged = true;
        this.notify();

        return refund;
      }

      protected async notify() {
        this.notified = true;
        this.ship();

        return recall;
      }

      protected async ship() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(recall).toHaveBeenCalled();
    expect(refund).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(test.get()).toMatchObject({ charged: true, notified: false });
    expect(test.then.record.map((entry) => [entry.key, entry.committed, entry.halted, entry.undone])).toEqual([
      ['next', undefined, undefined, undefined],
      ['pay', true, true, undefined],
      ['notify', undefined, undefined, true]
    ]);
  });

  it('will not catch or restore a step failing after commit', async () => {
    const attempt = vi.fn();

    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        this.pay().catch(this.pay);
      }

      protected async pay() {
        attempt();
        this.value = 1;
        this.then.commit();
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(test.value).toBe(1);
    expect(test.then.record[1]).toEqual(
      { id: 'pay#1', key: 'pay', args: [], next: [], wrote: ['value'], committed: true, error: new Error('boom'), halted: true }
    );
  });

  it('will throw if commit is called outside a step', () => {
    class Test extends Model {
      then = run(this);
    }

    expect(() => Test.new().then.commit()).toThrow('commit must be called inside a step.');
  });

  it('will throw if commit is called after its step settled', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.then(this.reply, async () => {
          this.then.commit();
        });
      }

      reply() {}
    }

    await expect(Test.new().next()).rejects.toThrow('next has settled; commit cannot run.');
  });
});

describe('back', () => {
  it('will unwind and end normally', async () => {
    const order: string[] = [];

    class Test extends Model {
      then = run(this);
      a = 0;
      b = 0;

      next() {
        this.a = 1;
        this.first();

        return () => void order.push('undo next');
      }

      first() {
        this.b = 1;
        this.second();

        return () => void order.push('undo first');
      }

      second() {
        this.then.back(this.next, 'changed my mind');
      }

      back(reason: unknown) {
        order.push(`back ${reason}`);
      }
    }

    const test = Test.new();

    expect(await test.next()).toEqual({ a: 1, b: 1 });
    expect(order).toEqual(['undo first', 'back changed my mind']);
    expect(test.then.status).toBe('idle');
    expect(test.then.error).toBeUndefined();
    expect(test.then.record).toEqual([
      { id: 'next#1', key: 'next', args: [], wrote: ['a'], next: [{ id: 'first#1', key: 'first', args: [] }], undo: 'closure' },
      { id: 'first#1', key: 'first', args: [], wrote: ['b'], next: [{ id: 'second#1', key: 'second', args: [] }], undo: 'closure', undone: true },
      { id: 'second#1', key: 'second', args: [], wrote: [], next: [{ id: 'back#1', key: 'back', args: [] }] },
      { id: 'back#1', key: 'back', args: [], wrote: [], next: [], to: 'next#1', reason: 'changed my mind' }
    ]);
  });

  it('will unwind what committed after a step', async () => {
    const undo = vi.fn();

    class Test extends Model {
      then = run(this, { rewind: true });
      a = 0;
      b = 0;

      next() {
        this.first();

        return () => undo('next');
      }

      first() {
        this.a = 1;
        this.second();

        return () => undo('first');
      }

      second() {
        this.b = 1;
        this.third();

        return () => undo('second');
      }

      third() {
        this.then.back(this.first);
      }
    }

    const test = Test.new();

    await test.next();
    expect(undo.mock.calls).toEqual([['second']]);
    expect(test.get()).toMatchObject({ a: 1, b: 0 });
    expect(test.then.record.map((entry) => [entry.id, entry.undone])).toEqual([
      ['next#1', undefined],
      ['first#1', undefined],
      ['second#1', true],
      ['third#1', undefined],
      ['back#1', undefined]
    ]);
    expect(test.then.record[4]).toEqual({ id: 'back#1', key: 'back', args: [], next: [], wrote: [], to: 'first#1' });
  });

  it('will leave fields of unwound steps without rewind', async () => {
    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        this.first();
      }

      first() {
        this.value = 1;
        this.second();
      }

      second() {
        this.then.back(this.next);
      }
    }

    const test = Test.new();

    await test.next();
    expect(test.value).toBe(1);
    expect(test.then.record.map((entry) => entry.undone)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('will call a step again after back', async () => {
    const refund = vi.fn();

    class Test extends Model {
      then = run(this, { rewind: true });
      charged = '';

      next() {
        this.pay('card1');
      }

      pay(card: string) {
        this.charged = card;
        this.ship();

        return () => refund(card);
      }

      ship() {
        if (this.charged != 'card1') return;

        this.then.back(this.next);
        this.pay('card2');
      }
    }

    const test = Test.new();

    expect(await test.next()).toEqual({ charged: 'card2' });
    expect(refund.mock.calls).toEqual([['card1']]);
    expect(test.then.record.map((entry) => [entry.id, entry.args, entry.undone])).toEqual([
      ['next#1', [], undefined],
      ['pay#1', ['card1'], true],
      ['ship#1', [], undefined],
      ['back#1', [], undefined],
      ['pay#2', ['card2'], undefined],
      ['ship#2', [], undefined]
    ]);
    expect(test.then.record[3]).toMatchObject({ to: 'next#1' });
  });

  it('will discard what unwound steps scheduled', async () => {
    const receipt = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.pay();
        this.more();
      }

      pay() {
        this.ship();
        this.receipt();
        this.then.end();
      }

      ship() {
        this.then.back(this.next);
      }

      receipt() {
        receipt();
      }

      more() {}
    }

    const test = Test.new();

    await test.next();
    expect(receipt).not.toHaveBeenCalled();
    expect(test.then.record.map((entry) => entry.id)).toEqual(['next#1', 'pay#1', 'ship#1', 'back#1', 'more#1']);
  });

  it('will unwind steps scheduled before back and run those after', async () => {
    const undo = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.first();
      }

      first() {
        this.early();
        this.then.back(this.next);
        this.later();
      }

      early() {
        return () => undo('early');
      }

      later() {
        this.then.end('done');
      }
    }

    const test = Test.new();

    expect(await test.next()).toBe('done');
    expect(undo).toHaveBeenCalledWith('early');
    expect(test.then.record.map((entry) => [entry.id, entry.undone])).toEqual([
      ['next#1', undefined],
      ['first#1', undefined],
      ['early#1', true],
      ['back#1', undefined],
      ['later#1', undefined],
      ['end#1', undefined]
    ]);
  });

  it('will abort and unwind a parallel step it discards', async () => {
    const mailed = mockPromise();
    const signals: AbortSignal[] = [];
    const recall = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.pay();
      }

      pay() {
        this.then(this.ship(), this.receipt(), this.notify());
      }

      async ship() {
        await Promise.resolve();
        this.then.back(this.next);
      }

      async receipt() {
        signals.push(this.then.signal);
        await mailed;

        return recall;
      }

      async notify() {
        const { signal } = this.then;

        await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(signals[0]?.aborted).toBe(true));
    mailed.resolve();

    await result;
    expect(recall).toHaveBeenCalled();
    expect(test.then.record.map((entry) => [entry.id, entry.undone])).toEqual([
      ['next#1', undefined],
      ['pay#1', undefined],
      ['ship#1', undefined],
      ['receipt#1', true],
      ['back#1', undefined]
    ]);
  });

  it('will release a wait opened by a step it unwinds', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.then(this.ask(), this.cancel());
      }

      ask() {
        this.then(this.answer);
      }

      async cancel() {
        await Promise.resolve();
        this.then.back(this.next);
      }

      answer() {}
    }

    const test = Test.new();

    await test.next();
    expect(test.answer).toBeUndefined();
    expect(test.then.record.map((entry) => entry.id)).toEqual(['next#1', 'ask#1', 'cancel#1', 'back#1']);
  });

  it('will call back with its reason, and with the error on failure', async () => {
    const order: unknown[] = [];

    class Test extends Model {
      then = run(this, {
        back: (reason) => void order.push(['option', reason])
      });

      next(fail: boolean) {
        this.first(fail);
      }

      first(fail: boolean) {
        this.then.back(this.next, 'retreat');
        this.second(fail);
      }

      second(fail: boolean) {
        order.push('second');

        if (fail) throw new Error('boom');
      }

      back(reason: unknown) {
        order.push(['back', reason]);
      }
    }

    const test = Test.new();

    await test.next(false);
    expect(order).toEqual([['back', 'retreat'], ['option', 'retreat'], 'second']);

    order.length = 0;

    await expect(test.next(true)).rejects.toThrow('boom');
    expect(order).toEqual([['back', 'retreat'], ['option', 'retreat'], 'second', ['back', new Error('boom')], ['option', new Error('boom')]]);
  });

  it('will end with an end scheduled after back', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.pay();
      }

      pay() {
        this.first();
        this.end('first');
      }

      first() {
        this.then.back(this.next);
        this.end('second');
      }

      end(value: string) {
        return value;
      }
    }

    expect(await Test.new().next()).toBe('second');
  });

  it('will fail if end is scheduled twice across back', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.first();
        this.end();
      }

      first() {
        this.second();
      }

      second() {
        this.then.back(this.next);
        this.end();
      }

      end() {}
    }

    await expect(Test.new().next()).rejects.toThrow('end was scheduled twice.');
  });

  it('will fail if to has no committed entry', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.first();
      }

      first() {
        this.then.back(this.second);
      }

      second() {}
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('back() found no committed second.');
    expect(test.then.status).toBe('failed');
  });

  it('will not unwind the step calling back', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.first();
      }

      first() {
        this.then.back(this.first);
      }
    }

    await expect(Test.new().next()).rejects.toThrow('back() found no committed first.');
  });

  it('will throw if to is not a step', async () => {
    class Test extends Model {
      then = run(this);

      next(step?: unknown) {
        this.then.back(step === 'call' ? (this.first() as never) : (step as () => void));
      }

      first() {}
    }

    const test = Test.new();

    const message = 'back() takes a step to go back to; stop(true) unwinds the whole run.';

    await expect(test.next()).rejects.toThrow(message);
    await expect(test.next('first')).rejects.toThrow(message);
    await expect(test.next('call')).rejects.toThrow(message);
    await expect(test.next(() => {})).rejects.toThrow(message);

    class End extends Model {
      then = run(this);

      next() {
        this.then.back(this.end);
      }

      end() {}
    }

    await expect(End.new().next()).rejects.toThrow(message);
  });

  it('will throw if back is called outside a step', () => {
    class Test extends Model {
      then = run(this);
    }

    expect(() => Test.new().then.back(() => {})).toThrow('back must be called inside a step.');
  });

  it('will not group or return a back token', async () => {
    class Grouped extends Model {
      then = run(this);

      next() {
        this.then(this.then.back(this.next) as never, this.first());
      }

      first() {}
    }

    await expect(Grouped.new().next()).rejects.toThrow('back() cannot be grouped.');

    class Returned extends Model {
      then = run(this);

      next() {
        return this.then.back(this.next);
      }
    }

    await expect(Returned.new().next()).rejects.toThrow('next returned a value; a step returns nothing, or its undo.');
  });

  it('will halt at a committed step and continue the run', async () => {
    const refund = vi.fn();
    const recall = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.pay('card1');
      }

      pay(card: string) {
        this.then.commit();
        this.notify(card);

        return refund;
      }

      notify(card: string) {
        this.ship(card);

        return recall;
      }

      ship(card: string) {
        if (card != 'card1') return;

        this.then.back(this.next);
        this.pay('card2');
      }
    }

    const test = Test.new();

    await test.next();
    expect(recall).toHaveBeenCalledTimes(1);
    expect(refund).not.toHaveBeenCalled();
    expect(test.then.record.map((entry) => [entry.id, entry.halted, entry.undone])).toEqual([
      ['next#1', undefined, undefined],
      ['pay#1', true, undefined],
      ['notify#1', undefined, true],
      ['ship#1', undefined, undefined],
      ['back#1', undefined, undefined],
      ['pay#2', undefined, undefined],
      ['notify#2', undefined, undefined],
      ['ship#2', undefined, undefined]
    ]);
  });

  it('will halt at an irreversible step and continue the run', async () => {
    const warn = mockWarn();

    class Item extends Model {}

    class Test extends Model {
      then = run(this);
      items = has(Item);

      protected new() {
        this.items.add({});
      }

      next() {
        this.drop();
      }

      drop() {
        this.items.clear();
        this.first();
      }

      first() {
        this.then.back(this.next);
        this.then.end('kept going');
      }
    }

    const test = Test.new();

    expect(await test.next()).toBe('kept going');
    expect(warn).toHaveBeenCalledWith(`${test} stopped unwinding at drop#1: items cannot be restored.`);
    expect(test.then.record.map((entry) => [entry.id, entry.halted])).toEqual([
      ['next#1', undefined],
      ['drop#1', true],
      ['first#1', undefined],
      ['back#1', undefined],
      ['end#1', undefined]
    ]);
  });

  it('will wait for an outside call to retry', async () => {
    const refund = vi.fn();

    class Test extends Model {
      then = run(this, { rewind: true });
      card = '';
      tracking = '';

      next() {
        this.pay('card1');
      }

      pay(card: string) {
        this.card = card;
        this.ship();

        return () => refund(card);
      }

      ship() {
        let declined = this.card == 'card1';

        if (declined) {
          this.then.back(this.next, 'declined');
          this.then(this.pay);
        }
        else this.tracking = `trk_${this.card}`;
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.pay).toBeDefined());
    expect(refund).toHaveBeenCalledWith('card1');
    expect(test.card).toBe('');
    expect(test.then.waiting).toEqual([{ id: 'wait#1', step: 'ship', args: [], answers: ['pay'] }]);

    await test.pay('card2');

    expect(await result).toEqual({ card: 'card2', tracking: 'trk_card2' });
    expect(test.then.record.map((entry) => [entry.id, entry.wake, entry.undone])).toEqual([
      ['next#1', undefined, undefined],
      ['pay#1', undefined, true],
      ['ship#1', undefined, undefined],
      ['back#1', undefined, undefined],
      ['pay#2', 'wait#1', undefined],
      ['ship#2', undefined, undefined]
    ]);
  });

  it('will not unwind entries a back already undid', async () => {
    const undo = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.first();
      }

      first() {
        this.then.back(this.next);
        this.second();

        return () => undo('first');
      }

      second() {
        this.then.back(this.next);
        this.third();
      }

      third() {
        throw new Error('boom');
      }
    }

    await expect(Test.new().next()).rejects.toThrow('boom');
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('will run backs from parallel steps one at a time', async () => {
    const undo = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.first();
      }

      first() {
        this.then(this.left(), this.right());

        return () => undo('first');
      }

      async left() {
        this.then.back(this.next);
      }

      async right() {
        this.then.back(this.next);
      }
    }

    const test = Test.new();

    await test.next();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(test.then.record.map((entry) => entry.key)).toEqual(['next', 'first', 'left', 'right', 'back']);
  });

  it('will fail when an undo throws and stop unwinding there', async () => {
    const undo = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.first();

        return () => undo('next');
      }

      first() {
        this.second();

        return () => {
          throw new Error('undo');
        };
      }

      second() {
        this.then.back(this.next);
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('undo');
    expect(undo).not.toHaveBeenCalled();
    expect(test.then.record.map((entry) => [entry.id, entry.undone])).toEqual([
      ['next#1', undefined],
      ['first#1', 'failed'],
      ['second#1', undefined]
    ]);
  });

  it('will fail when the back hook throws', async () => {
    class Test extends Model {
      then = run(this);

      next() {
        this.first();
      }

      first() {
        this.then.back(this.next, 'once');
      }

      back(reason: unknown) {
        if (reason == 'once') throw new Error('hook');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('hook');
    expect(test.then.status).toBe('failed');
  });

  it('will halt a parked unwind on stop', async () => {
    const order: string[] = [];

    class Test extends Model {
      then = run(this);

      next() {
        this.first();

        return () => void order.push('undo next');
      }

      first() {
        this.second();

        return this.then(this.refund);
      }

      second() {
        this.then.back(this.next);
      }

      refund() {}
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.refund).toBeDefined());
    test.then.stop();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(order).toEqual([]);
    expect(test.then.record.map((entry) => [entry.id, entry.halted, entry.undone])).toEqual([
      ['next#1', undefined, undefined],
      ['first#1', undefined, undefined],
      ['second#1', undefined, undefined]
    ]);
  });

  it('will stop unwinding between undos when stopped', async () => {
    const refunded = mockPromise();
    const undo = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.zero();
      }

      zero() {
        this.first();

        return undo;
      }

      first() {
        this.second();

        return () => refunded;
      }

      second() {
        this.then.back(this.next);
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.then.record.at(-1)?.id).toBe('second#1'));
    test.then.stop();
    refunded.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(undo).not.toHaveBeenCalled();
    expect(test.then.record.map((entry) => [entry.id, entry.undone])).toEqual([
      ['next#1', undefined],
      ['zero#1', undefined],
      ['first#1', true],
      ['second#1', undefined]
    ]);
  });

  it('will hand a parked unwind to the failure unwind', async () => {
    const order: string[] = [];

    class Test extends Model {
      then = run(this);

      next() {
        this.first();

        return () => void order.push('undo next');
      }

      first() {
        this.second();

        return this.then(this.refund);
      }

      second() {
        this.then.back(this.next);
      }

      refund() {
        order.push('refund');
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.refund).toBeDefined());
    test.then.stop(true);

    await vi.waitFor(() => expect(test.refund).toBeDefined());
    await test.refund();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(order).toEqual(['refund', 'undo next']);
  });

  it('will stop unwinding when ended from outside', async () => {
    const work = mockPromise();
    const undo = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.first();

        return undo;
      }

      first() {
        this.then(this.slow(), this.quick());
      }

      async slow() {
        await work;
      }

      async quick() {
        await Promise.resolve();
        this.then.back(this.next);
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.then.record.at(-1)?.id).toBe('quick#1'));
    await flushMicrotasks();
    test.then.end('early');
    work.resolve();

    expect(await result).toBe('early');
    expect(undo).not.toHaveBeenCalled();
    expect(test.then.record.map((entry) => entry.id)).toEqual(['next#1', 'first#1', 'quick#1', 'slow#1', 'end#1']);
  });

  it('will stop unwinding when a discarded step fails', async () => {
    const work = mockPromise();
    const undo = vi.fn();

    class Test extends Model {
      then = run(this);

      next() {
        this.first();

        return undo;
      }

      first() {
        this.then(this.slow(), this.quick());
      }

      async slow() {
        await work;
        throw new Error('boom');
      }

      async quick() {
        await Promise.resolve();
        this.then.back(this.next);
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.then.record.at(-1)?.id).toBe('quick#1'));
    await flushMicrotasks();
    work.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('will halt an unwind at an answer which commits', async () => {
    const undo = vi.fn();

    class Test extends Model {
      then = run(this, { rewind: true });
      value = 0;

      next() {
        this.first();

        return undo;
      }

      first() {
        this.value = 1;
        this.fail();

        return this.then(this.refund, this.keep);
      }

      fail() {
        throw new Error('boom');
      }

      refund() {}

      keep() {
        this.then.commit();
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.keep).toBeDefined());
    await test.keep();

    await expect(result).rejects.toThrow('boom');
    expect(undo).not.toHaveBeenCalled();
    expect(test.value).toBe(1);
    expect(test.then.record.map((entry) => [entry.id, entry.halted, entry.committed])).toEqual([
      ['next#1', undefined, undefined],
      ['first#1', true, undefined],
      ['keep#1', undefined, true]
    ]);
  });

  it('will not leave an answer promise rejecting unhandled', async () => {
    const caught = mockUncaught();

    class Test extends Model {
      then = run(this);

      next() {
        this.then(this.abort);
      }

      abort() {
        throw new Error('abort');
      }
    }

    const test = Test.new();
    const result = test.next();

    await vi.waitFor(() => expect(test.abort).toBeDefined());
    test.abort();

    await expect(result).rejects.toThrow('abort');
    await flushMicrotasks();
    expect(caught).toEqual([]);
  });
});

describe('signal', () => {
  const aborted = (signal: AbortSignal) =>
    new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));

  it('will abort the signal of a step in flight on stop', async () => {
    const attempt = vi.fn();

    class Test extends Model {
      then = run(this);
      value = 0;

      async next() {
        attempt();
        this.value = 1;
        await aborted(this.then.signal);
        this.later();
      }

      later() {}
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.then.stop();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(test.value).toBe(0);
    expect(test.then.status).toBe('stopped');
    expect(test.then.error).toBeUndefined();
    expect(test.then.record).toEqual([]);
  });

  it('will abort the signal of a step in flight on an outside end', async () => {
    class Test extends Model {
      then = run(this);
      value = 0;

      next() {
        this.slow();
      }

      async slow() {
        this.value = 1;
        await aborted(this.then.signal);
      }
    }

    const test = Test.new();
    const result = test.next();

    await flushMicrotasks();
    test.then.end('early');

    expect(await result).toBe('early');
    expect(test.value).toBe(0);
    expect(test.then.record.map((entry) => entry.key)).toEqual(['next', 'end']);
  });

  it('will abort the signal of a step in flight when another fails', async () => {
    let signal!: AbortSignal;

    class Test extends Model {
      then = run(this);

      next() {
        this.then(this.slow(), this.fail());
      }

      async slow() {
        signal = this.then.signal;
        await aborted(signal);
      }

      async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.next()).rejects.toThrow('boom');
    expect(signal.aborted).toBe(true);
    expect(test.then.error).toEqual(new Error('boom'));
  });

  it('will abort the signal once its step settles', async () => {
    const seen: boolean[] = [];
    let signal!: AbortSignal;

    class Test extends Model {
      then = run(this);

      async next() {
        signal = this.then.signal;
        seen.push(signal.aborted);
        this.second();
      }

      async second() {
        seen.push(signal.aborted, this.then.signal === signal);
      }
    }

    await Test.new().next();
    expect(seen).toEqual([false, true, false]);
  });

  it('will throw if signal is read outside a step', () => {
    class Test extends Model {
      then = run(this);
    }

    expect(() => Test.new().then.signal).toThrow('signal must be read inside a step.');
  });
});

describe('failures', () => {
  it('will reject when a step throws synchronously', async () => {
    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
      then = run(this);

      async next() {
        return 1 as unknown as void;
      }
    }

    await expect(Test.new().next()).rejects.toThrow('next returned a value; a step returns nothing, or its undo.');
  });

  it('will reject when a step writes after scheduling', async () => {
    class Test extends Model {
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
    class Test extends Model {
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
    expect(test.then.record[0].wrote).toEqual([]);
  });

  it('will reject when a step keeps working after scheduling', async () => {
    class Test extends Model {
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

    class Test extends Model {
      then = run(this);

      next() {
        late = () => this.second();
      }

      second() {}
    }

    await Test.new().next();
    expect(late).toThrow('next has settled; second cannot run.');
  });

  it('will throw if a settled step schedules through then', async () => {
    let late: () => unknown = () => {};

    class Test extends Model {
      then = run(this);

      next() {
        late = () => this.then.end();
      }
    }

    await Test.new().next();
    expect(late).toThrow('next has settled; end cannot run.');
  });

  it('will throw uncaught when nobody awaits a failed run', async () => {
    const caught = mockUncaught();

    class Test extends Model {
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

    class Test extends Model {
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

    class Test extends Model {
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
    class Test extends Model {
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

describe('base', () => {
  class Feed extends Model {
    items: string[] = [];

    load() {
      return ['a'];
    }

    exit() {
      throw new Error('exit');
    }

    afterShip() {}
  }

  it('will leave methods above the instance class plain by default', async () => {
    class Sync extends Feed {
      then = run(this);

      async next() {
        this.ship();
      }

      protected async ship() {
        this.items = this.load();
      }
    }

    const sync = Sync.new();

    expect(sync.load()).toEqual(['a']);
    expect(() => sync.exit()).toThrow('exit');

    await sync.next();

    expect(sync.items).toEqual(['a']);
    expect(sync.then.record.map((entry) => entry.key)).toEqual(['next', 'ship']);
  });

  it('will wrap only a subclass own methods when extending a runner without base', async () => {
    class Sync extends Model {
      then = run(this);

      async next() {}

      protected async pull() {}
    }

    class Paged extends Sync {
      protected async page() {}
    }

    const paged = Paged.new() as any;

    expect(paged.pull).toBeInstanceOf(Function);
    expect(paged.page).toBeUndefined();

    await paged.next();

    expect(paged.then.record).toEqual([]);
  });

  it('will leave methods above base plain', async () => {
    class Sync extends Feed {
      then = run(this, { base: Sync });

      async next() {
        this.pull();
      }

      protected async pull() {
        this.items = this.load();
      }
    }

    const sync = Sync.new();

    expect(sync.load()).toEqual(['a']);
    expect(() => sync.exit()).toThrow('exit');

    await sync.next();

    expect(sync.items).toEqual(['a']);
    expect(sync.then.status).toBe('idle');
    expect(sync.then.record.map((entry) => entry.key)).toEqual(['next', 'pull']);
  });

  it('will wrap methods of a subclass of base', async () => {
    class Sync extends Feed {
      then = run(this, { base: Sync });

      async next() {
        this.pull();
      }

      protected async pull() {}
    }

    class Paged extends Sync {
      protected async pull() {
        this.page();
      }

      protected async page() {
        this.items = this.load();
      }
    }

    const paged = Paged.new();

    await paged.next();

    expect(paged.items).toEqual(['a']);
    expect(paged.then.record.map((entry) => entry.key)).toEqual(['next', 'pull', 'page']);
  });

  it('will accept Model as base', async () => {
    class Test extends Model {
      then = run(this, { base: Model });

      async next() {
        this.step();
      }

      protected async step() {}
    }

    const test = Test.new();

    await test.next();
    expect(test.then.record.map((entry) => entry.key)).toEqual(['next', 'step']);
  });

  it('will throw if not an instance of base', () => {
    class Other extends Model {}

    class Test extends Model {
      then = run(this, { base: Other });
    }

    expect(() => Test.new()).toThrow(/^Test-\w+ does not extend Other\.$/);
  });
});

describe('Job', () => {
  it('will run and type the result from end', async () => {
    class Test extends Job {
      value = 0;

      async next(n: number) {
        this.value = n;
        this.end();
      }

      protected end() {
        return { n: this.value };
      }
    }

    const test = Test.new();
    const result = await test.next(2);

    expectTypeOf(test.then).toEqualTypeOf<Runner<Test>>();
    expectTypeOf(test.then.status).toEqualTypeOf<Runner.Status>();
    expectTypeOf<Awaited<Test>>().toEqualTypeOf<{ n: number }>();
    expect(result).toEqual({ n: 2 });
    expect(test.then.on).toBe(test);
    expect(test.then.record.map((entry) => entry.key)).toEqual(['next', 'end']);
  });

  it('will type the result as values without end', async () => {
    class Test extends Job {
      value = 1;

      async next() {}
    }

    const result = await Test.new();

    expectTypeOf(result).toEqualTypeOf<Model.Values<Test>>();
    expect(result).toEqual({ value: 1 });
  });

  it('will allow next to narrow its parameters', async () => {
    class Test extends Job {
      prompt = '';

      async next(prompt: string) {
        this.prompt = prompt;
      }
    }

    const test = Test.new();

    expectTypeOf(test.next).parameters.toEqualTypeOf<[prompt: string]>();
    await test.next('hi');
    expect(test.prompt).toBe('hi');
  });

  it('will collect steps through intermediate classes', async () => {
    class B extends Job {
      async next() {
        this.first();
      }

      protected async first() {
        this.second();
      }

      protected async second() {}
    }

    class C extends B {
      protected async second() {
        this.third();
      }

      protected async third() {}
    }

    const test = C.new();

    await test.next();
    expect(test.then.record.map((entry) => entry.key)).toEqual(['next', 'first', 'second', 'third']);
  });

  it('will rewind when the class opts in', async () => {
    class Light extends Job {
      value = 0;

      async next() {
        this.value = 1;
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    class Rewind extends Light {
      static readonly rewind = true;
    }

    const light = Light.new();
    const rewind = Rewind.new();

    await expect(light.next()).rejects.toThrow('boom');
    await expect(rewind.next()).rejects.toThrow('boom');

    expect(Object.hasOwn(Job, 'rewind')).toBe(false);
    expect(light.value).toBe(1);
    expect(light.then.record[0]).not.toHaveProperty('prior');
    expect(rewind.value).toBe(0);
    expect(rewind.then.record[0]).toMatchObject({ prior: { value: 0 }, patch: { value: 1 }, undone: true });
  });

  it('will not define hooks on the prototype', () => {
    const own = Object.getOwnPropertyNames(Job.prototype);

    expect(own).toEqual(['constructor']);
  });

  it('will call hooks declared by override', async () => {
    const order: unknown[] = [];

    class Test extends Job {
      async next() {
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }

      protected override before(step: string) {
        order.push(['before', step]);
      }

      protected override after(step: string, entry: Runner.Entry) {
        order.push(['after', step, entry.id]);
      }

      protected override back(error: unknown) {
        order.push(['back', (error as Error).message]);
      }
    }

    await expect(Test.new().next()).rejects.toThrow('boom');
    expect(order).toEqual([
      ['before', 'next'],
      ['after', 'next', 'next#1'],
      ['before', 'fail'],
      ['back', 'boom']
    ]);
  });

  it('will type exit by the result of end', async () => {
    const outcomes: Runner.Outcome<{ n: number }>[] = [];

    class Test extends Job {
      async next() {
        this.end();
      }

      protected end() {
        return { n: 1 };
      }

      protected override exit(outcome: Runner.Outcome<{ n: number }>) {
        outcomes.push(outcome);
      }
    }

    await Test.new();
    expect(outcomes).toEqual([{ status: 'done', result: { n: 1 } }]);
  });

  it('will check hooks by declaration', () => {
    class Test extends Job {
      async next() {}

      // @ts-expect-error
      protected override before(step: number) {
        void step;
      }

      // @ts-expect-error
      protected override back(error: unknown, more: number) {
        void error, more;
      }

      // @ts-expect-error
      protected override bakc() {}
    }

    const assign = (test: Test) => {
      // @ts-expect-error
      test.then = run(test);
    };

    expectTypeOf(assign).toBeFunction();
    expect(Test.new().then.status).toBe('idle');
  });
});
