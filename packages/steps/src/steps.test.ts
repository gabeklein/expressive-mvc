import { Component, Context, has, map, set, Model } from '@expressive/mvc';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { flushMicrotasks, Journal, mockPromise, mockUncaught, mockWarn, record } from '../test.setup';
import { Steps } from './steps';

describe('steps', () => {
  it('will run steps from run through to its result', async () => {
    const order: string[] = [];

    class Test extends Journal {
      total = 0;

      async run(seed: number) {
        order.push(`run:${seed}`);
        this.first(seed + 1);

        await this;

        order.push(`result:${this.total}`);
        return this.total * 10;
      }

      async first(n: number) {
        order.push(`first:${n}`);
        this.second(n + 1);
      }

      second(n: number) {
        order.push(`second:${n}`);
        this.total = n;
      }
    }

    const test = Test.new();

    expect(test.then.on).toBe(test);
    expect(test.then.status).toBe('idle');
    expect(order).toEqual([]);

    expect(await test.run(1)).toBe(30);
    expect(order).toEqual(['run:1', 'first:2', 'second:3', 'result:3']);
    expect(test.then.status).toBe('idle');
    expect(record(test)).toEqual([
      { id: 'run#1', key: 'run', args: [1], wrote: [], next: [{ id: 'first#1', key: 'first', args: [2] }] },
      { id: 'first#1', key: 'first', args: [2], wrote: [], next: [{ id: 'second#1', key: 'second', args: [3] }] },
      { id: 'second#1', key: 'second', args: [3], wrote: ['total'], next: [] }
    ]);
  });

  it('will not touch the prototype', () => {
    class Test extends Steps {
      async run() {}
    }

    Test.new();

    const before = Object.getOwnPropertyDescriptor(Test.prototype, 'run');
    const test = Test.new();
    const own = Object.getOwnPropertyDescriptor(test, 'run')!;

    expect(Object.getOwnPropertyDescriptor(Test.prototype, 'run')).toEqual(before);
    expect(own.enumerable).toBe(false);
    expect(Object.keys(test)).not.toContain('run');
  });

  it('will not wrap new or getters', async () => {
    class Test extends Steps {
      value = 2;
      ready = false;

      get double() {
        return this.value * 2;
      }

      protected new() {
        this.ready = true;
      }

      async run() {
        this.value = this.double;
      }
    }

    const test = Test.new();

    expect(test.ready).toBe(true);
    await test.run();
    expect(test.get()).toEqual({ value: 4, ready: true, double: 8 });
  });

  it('will invoke the next step only after the current one settles', async () => {
    const work = mockPromise();
    const second = vi.fn();

    class Test extends Steps {
      async run() {
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

    test.run();
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

    class Test extends Steps {
      async run() {
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

    await Test.new().run();
    expect(order).toEqual(['a', 'a!', 'a1', 'b']);
  });

  it('will not run a step awaited inside a step', async () => {
    const order: string[] = [];

    class Test extends Steps {
      async run() {
        await this.a();
        order.push('run');
        this.b();
      }

      a() {
        order.push('a');
      }

      b() {
        order.push('b');
      }
    }

    await Test.new().run();
    expect(order).toEqual(['run', 'a', 'b']);
  });

  it('will loop by calling run inside a step', async () => {
    class Test extends Journal {
      count = 0;

      async run(until: number) {
        let done = this.count == until;

        if (done) return;

        this.count++;
        this.run(until);
      }
    }

    const test = Test.new();

    await test.run(3);
    expect(test.count).toBe(3);
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'run#2', 'run#3', 'run#4']);
  });

  it('will record which fields each step wrote', async () => {
    class Test extends Journal {
      a = 0;
      b = '';

      async run() {
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

    await test.run();
    expect(record(test).map((entry) => entry.wrote)).toEqual([['a'], ['b', 'a']]);
    expect(record(test).some((entry) => 'prior' in entry || 'patch' in entry)).toBe(false);
  });

  it('will bind Model methods to the instance', async () => {
    let values: Record<string, unknown> | undefined;

    class Test extends Steps {
      value = 1;

      async run() {
        values = this.get();

        await this;

        return String(this);
      }
    }

    const test = Test.new();

    expect(await test.run()).toBe(String(test));
    expect(values).toMatchObject({ value: 1 });
  });

  it('will run helpers on the instance', async () => {
    let self: unknown;

    class Test extends Journal {
      value = 0;

      async run() {
        this.value = this._double(2);
      }

      _double(n: number) {
        self = this;
        return n * 2;
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.value).toBe(4);
    expect(self).toBe(test);
    expect(record(test)[0].wrote).toEqual(['value']);
  });

  it('will not journal writes of a helper', async () => {
    class Test extends Journal {
      value = 0;
      label = '';

      async run() {
        this.value = this._double(2);
      }

      _double(n: number) {
        this.label = 'doubled';
        return n * 2;
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.get()).toEqual({ value: 4, label: 'doubled' });
    expect(record(test)[0].wrote).toEqual(['value']);
  });

  it('will pass function fields through', async () => {
    const fn = () => 1;
    let seen: unknown;

    class Test extends Steps {
      fn = fn;

      async run() {
        seen = this.fn;
      }
    }

    await Test.new().run();
    expect(seen).toBe(fn);
  });

  it('will accept writes from outside', async () => {
    class Test extends Journal {
      mode = 'ask';

      async run() {
        this.wait();

        await this;

        return this.mode;
      }

      protected async wait() {
        await flushMicrotasks();
      }
    }

    const test = Test.new();
    const result = test.run();

    test.mode = 'yolo';

    expect(await result).toBe('yolo');
    expect(record(test).map((entry) => entry.wrote)).toEqual([[], []]);
  });

  it('will type the result from run', async () => {
    class Test extends Steps {
      n = 0;

      async run(n: number) {
        this.store(n);

        await this;

        return { n: this.n };
      }

      protected async store(n: number) {
        this.n = n;
      }
    }

    const test = Test.new();
    const called = test.run(1);

    expectTypeOf(called).toEqualTypeOf<Promise<{ n: number }>>();
    expect(await called).toEqual({ n: 1 });

    test.run(2);

    const joined = await test;

    expectTypeOf(joined).toEqualTypeOf<{ n: number }>();
    expect(joined).toEqual({ n: 2 });
  });

  it('will type a result returned without awaiting the run', async () => {
    class Test extends Steps {
      async run() {
        return 'now';
      }
    }

    const result = await Test.new();

    expectTypeOf(result).toEqualTypeOf<string>();
    expect(result).toBe('now');
  });

  it('will type a caught failure as a result', async () => {
    class Test extends Steps {
      async run() {
        this.fail();

        try {
          await this;
        } catch {
          return { failed: true as const };
        }

        return { failed: false as const };
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = await test.run();

    expectTypeOf(result).toEqualTypeOf<{ failed: true } | { failed: false }>();
    expect(result).toEqual({ failed: true });
    expect(test.then.status).toBe('failed');
    expect(test.then.error).toEqual(new Error('boom'));
  });

  it('will type then read in the body of run', async () => {
    class Test extends Steps {
      async run() {
        let idle = this.then.status == 'idle';

        await this;

        return idle;
      }
    }

    const result = await Test.new();

    expectTypeOf(result).toEqualTypeOf<boolean>();
    expect(result).toBe(false);
  });

  it('will fail if run awaits other work before its run', async () => {
    class Test extends Steps {
      async run() {
        await new Promise((resolve) => setTimeout(resolve));
        this.first();

        await this;

        return 'done';
      }

      protected async first() {}
    }

    await expect(Test.new().run()).rejects.toThrow('run awaited work before its plan - it takes arguments, calls steps and awaits this.');
  });

  it('will fail if run awaits other work and returns', async () => {
    class Test extends Steps {
      async run() {
        await new Promise((resolve) => setTimeout(resolve));

        return 'done';
      }
    }

    await expect(Test.new().run()).rejects.toThrow('run awaited work before its plan - it takes arguments, calls steps and awaits this.');
  });

  it('will reject with what run throws after its run', async () => {
    class Test extends Steps {
      async run() {
        this.first();

        await this;

        throw new Error('tail');
      }

      protected async first() {}
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('tail');
    expect(test.then.status).toBe('failed');
    expect(test.then.error).toEqual(new Error('tail'));
  });

  it('will not type a result read from awaiting the run', () => {
    class Test extends Steps {
      // @ts-expect-error - its type would come from its own return: TS7023
      async run() {
        const prior = await this;

        return prior;
      }
    }

    void Test;
  });

  it('will resolve context and owner from inside a step', async () => {
    const found: Model[] = [];

    class Service extends Model {}

    class Test extends Steps {
      async run() {
        found.push(this.get(Service), this.get(Model));
      }
    }

    class Host extends Model {
      service = new Service();
      test = new Test();
    }

    const host = Host.new();

    new Context(host);
    await host.test.run();

    expect(found[0]).toBe(host.service);
    expect(found[1]).toBe(host);
  });

  it('will run under a component its host has not committed', async () => {
    const statuses: string[] = [];
    const placed = mockPromise<void>();

    class Test extends Steps {
      async run() {}
    }

    class Host extends Component {
      test = new Test();
    }

    const stop = Component.on({ setup: () => placed });
    const host = Host.new();

    stop();

    host.test.get((self) => void statuses.push(self.then.status));

    await host.test.run();
    expect(host.test.then.runs).toBe(1);
    expect(statuses).toEqual([]);

    placed.resolve();
    await flushMicrotasks();

    expect(statuses).toEqual(['idle']);
  });
});

describe('groups', () => {
  it('will run a group concurrently and join', async () => {
    const order: string[] = [];
    const a = mockPromise();
    const b = mockPromise();

    class Test extends Journal {
      async run() {
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

    test.run();
    await flushMicrotasks();
    expect(order).toEqual(['a', 'b']);

    b.resolve();
    await flushMicrotasks();
    expect(order).toEqual(['a', 'b', 'b!']);
    expect(test.then.active).toBe('a');

    a.resolve();
    await test;
    expect(order).toEqual(['a', 'b', 'b!', 'a!', 'c']);
    expect(record(test)[0].next).toEqual([
      { id: 'then#1', key: 'then', args: [], group: [{ id: 'a#1', key: 'a', args: [] }, { id: 'b#1', key: 'b', args: [] }] },
      { id: 'c#1', key: 'c', args: [] }
    ]);
  });

  it('will join each member through what it schedules', async () => {
    const order: string[] = [];

    class Test extends Steps {
      async run() {
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

    await Test.new().run();
    expect(order).toEqual(['b', 'a1', 'c']);
  });

  it('will attribute writes to their own step', async () => {
    const a = mockPromise();

    class Test extends Journal {
      x = 0;
      y = 0;

      async run() {
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

    await test.run();
    expect(record(test).map((entry) => [entry.key, entry.wrote])).toEqual([
      ['run', []],
      ['b', ['y']],
      ['a', ['x']]
    ]);
  });

  it('will map items to a group', async () => {
    const seen: unknown[] = [];

    class Test extends Steps {
      async run(items: string[]) {
        this.then(items, (item) => this.fetch(item));
      }

      fetch(item: string) {
        seen.push(item);
      }
    }

    await Test.new().run(['a', 'b']);
    expect(seen).toEqual(['a', 'b']);
  });

  it('will map items through a step with its index', async () => {
    const seen: unknown[][] = [];

    class Test extends Steps {
      async run(items: string[]) {
        this.then(items, this.fetch);
      }

      fetch(item: string, index: number) {
        seen.push([item, index]);
      }
    }

    await Test.new().run(['a', 'b']);
    expect(seen).toEqual([['a', 0], ['b', 1]]);
  });

  it('will fail if a step calls then as a thenable', async () => {
    class Test extends Steps {
      async run() {
        (this.then as Function)(() => {}, () => {});
      }
    }

    await expect(Test.new().run()).rejects.toThrow('a step cannot await its own run.');
  });

  it('will map an iterable to a group', async () => {
    const seen: string[] = [];

    class Test extends Steps {
      items = new Set(['a', 'b']);

      async run() {
        this.then(this.items, this.fetch);
      }

      fetch(item: string) {
        seen.push(item);
      }
    }

    await Test.new().run();
    expect(seen).toEqual(['a', 'b']);
  });

  it('will fail if a step other than run awaits its own run', async () => {
    class Test extends Steps {
      async run() {
        this.first();
      }

      protected async first() {
        await this;
      }
    }

    await expect(Test.new().run()).rejects.toThrow('a step cannot await its own run.');
  });

  it('will fail if a group holds what the step did not call', async () => {
    class Test extends Steps {
      async run() {
        this.then({});
      }
    }

    await expect(Test.new().run()).rejects.toThrow('then() takes steps called by run.');
  });

  it('will not take an array of tokens as a group', async () => {
    class Test extends Steps {
      async run() {
        this.then([this.a(), this.b()]);
      }

      a() {}
      b() {}
    }

    await expect(Test.new().run()).rejects.toThrow('then() takes steps called by run.');
  });

  it('will group a single token', async () => {
    class Test extends Journal {
      async run() {
        this.then(this.a());
      }

      a() {}
    }

    const test = Test.new();

    await test.run();
    expect(record(test)[0].next).toEqual([
      { id: 'then#1', key: 'then', args: [], group: [{ id: 'a#1', key: 'a', args: [] }] }
    ]);
  });

  it('will throw if a group is made outside a step', () => {
    class Test extends Steps {
    }

    expect(() => Test.new().then([])).toThrow('then(steps) must be called inside a step.');
  });
});

describe('inline', () => {
  it('will run a function as a step in its place in the plan', async () => {
    const order: string[] = [];

    class Test extends Journal {
      async run() {
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

    await test.run();
    expect(order).toEqual(['before:run', 'before:a', 'a', 'before:then', 'inline', 'before:b', 'b']);
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'a#1', 'then#1', 'b#1']);
    expect(record(test)[0].next).toEqual([
      { id: 'a#1', key: 'a', args: [] },
      { id: 'then#1', key: 'then', args: [] },
      { id: 'b#1', key: 'b', args: [] }
    ]);
  });

  it('will run a function with its own proxy as a full step', async () => {
    class Test extends Journal {
      value = 0;

      async run() {
        this.then(function (this: Test) {
          this.value = 1;
          this.later();
        });
      }

      later() {}
    }

    const test = Test.new();

    await test.run();
    expect(record(test).map((entry) => [entry.id, entry.wrote, entry.next.map((node) => node.id)])).toEqual([
      ['run#1', [], ['then#1']],
      ['then#1', ['value'], ['later#1']],
      ['later#1', [], []]
    ]);
  });

  it('will journal the writes of an arrow as its own', async () => {
    class Test extends Journal {
      value = 0;

      async run() {
        this.then(() => {
          this.value = 1;
          this.later();
        });
      }

      later() {}
    }

    const test = Test.new();

    await test.run();
    expect(test.value).toBe(1);
    expect(record(test).map((entry) => [entry.id, entry.wrote, entry.next.map((node) => node.id)])).toEqual([
      ['run#1', [], ['then#1']],
      ['then#1', ['value'], ['later#1']],
      ['later#1', [], []]
    ]);
  });

  it('will restore the writes of an arrow that throws', async () => {
    class Test extends Steps {
      value = 0;

      async run() {
        this.then(async () => {
          this.value = 1;
          throw new Error('boom');
        });
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.value).toBe(0);
  });

  it('will give an arrow its own controller', async () => {
    let signal!: AbortSignal;

    class Test extends Journal {
      async run() {
        this.then(() => {
          signal = this.then.signal;
          this.then(this.a(), this.b());
        });
      }

      a() {}
      b() {}
    }

    const test = Test.new();

    await test.run();
    expect(signal.aborted).toBe(true);
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'then#1', 'a#1', 'b#1']);
    expect(record(test)[1].next).toMatchObject([{ key: 'then', group: [{ id: 'a#1' }, { id: 'b#1' }] }]);
  });

  it('will attribute a nested arrow to its own frame', async () => {
    class Test extends Journal {
      value = 0;

      async run() {
        this.then(() => {
          this.then(() => {
            this.value = 2;
          });
        });
      }
    }

    const test = Test.new();

    await test.run();
    expect(record(test).map((entry) => [entry.id, entry.wrote])).toEqual([
      ['run#1', []],
      ['then#1', []],
      ['then#2', ['value']]
    ]);
  });

  it('will attribute an arrow beside a step in flight', async () => {
    const slow = mockPromise();

    class Test extends Journal {
      value = 0;

      async run() {
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

    await test.run();
    expect(record(test).find((entry) => entry.id == 'then#1')!.wrote).toEqual(['value']);
  });

  it('will not attribute arrows in flight together', async () => {
    const both = mockPromise();
    let ran = 0;

    class Test extends Journal {
      value = 0;

      async run() {
        const arrow = async () => {
          if (++ran == 2) both.resolve();

          await both;
          this.value++;
        };

        this.then(this.then(arrow), this.then(arrow));
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.value).toBe(2);
    expect(record(test).filter((entry) => entry.key == 'then').map((entry) => entry.wrote)).toEqual([[], []]);
  });

  it('will not schedule from arrows in flight together', async () => {
    const both = mockPromise();
    let ran = 0;

    class Test extends Steps {
      async run() {
        const arrow = async () => {
          if (++ran == 2) both.resolve();

          await both;
          this.later();
        };

        this.then(this.then(arrow), this.then(arrow));
      }

      later() {}
    }

    await expect(Test.new().run()).rejects.toThrow('run has settled; later cannot run.');
  });

  it('will keep a watcher an outside call beside an arrow', async () => {
    const work = mockPromise();

    class Test extends Journal {
      value = 0;

      async run() {
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

    await test.run();
    expect(test.value).toBe(1);
    expect(record(test).map((entry) => [entry.id, entry.wrote])).toEqual([
      ['run#1', []],
      ['then#1', []],
      ['allow#1', []]
    ]);
  });

  it('will abort the signal when the run stops', async () => {
    const work = mockPromise();
    let signal!: AbortSignal;

    class Test extends Journal {
      async run() {
        this.then(async (given) => {
          signal = given;
          await work;
        });
      }
    }

    const test = Test.new();
    const result = test.run();

    await vi.waitFor(() => expect(signal).toBeDefined());
    expect(signal.aborted).toBe(false);

    test.then.stop();
    expect(signal.aborted).toBe(true);

    work.resolve();
    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'then#1']);
  });

  it('will run a function compensation given the error', async () => {
    const refund = vi.fn();

    class Test extends Journal {
      async run() {
        this.charge();
      }

      protected async charge() {
        this.then.undo(refund);
        this.fail();
      }

      async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(refund).toHaveBeenCalledWith(new Error('boom'));
    expect(record(test)[1]).toMatchObject({ undo: [{ id: 'then#1', key: 'then', args: [] }], unwound: true });
    expect(record(test)[1].next).toEqual([{ id: 'fail#1', key: 'fail', args: [] }]);
  });

  it('will type a returned function as no value', async () => {
    class Test extends Steps {
      async run() {
        return this.then(() => {});
      }
    }

    expectTypeOf<ReturnType<Test['run']>>().toEqualTypeOf<Promise<void>>();
    await Test.new().run();
  });

  it('will fail if the function returns a value', async () => {
    class Test extends Steps {
      async run() {
        this.then(() => 1);
      }
    }

    await expect(Test.new().run()).rejects.toThrow('then returned a value; a step returns nothing - its undo is this.then.undo(...).');
  });
});

describe('end', () => {
  it('will pass an end to after, not an implicit one', async () => {
    const seen: string[] = [];

    class Test extends Steps {
      cut = false;

      async run() {
        this.first();
      }

      protected async first() {
        if (this.cut) this.then.end();
      }

      protected after(step: string) {
        seen.push(step);
      }
    }

    const test = Test.new();

    await test.run();
    expect(seen).toEqual(['run', 'first']);

    seen.length = 0;
    test.cut = true;

    await test.run();
    expect(seen).toEqual(['run', 'first', 'end']);
  });

  it('will fail the run when after throws on end', async () => {
    class Test extends Steps {
      async run() {
        this.then.end();
      }

      protected after(step: string) {
        if (step == 'end') throw new Error('after end');
      }
    }

    await expect(Test.new().run()).rejects.toThrow('after end');
  });

  it('will end at its place and drop what is left', async () => {
    const order: string[] = [];

    class Test extends Journal {
      reason = '';

      async run() {
        this.a();
        this.b();
        this.c();

        await this;

        order.push('result');
        return this.reason;
      }

      a() {
        order.push('a');
      }

      b() {
        order.push('b');
        this.reason = 'early';
        this.b1();
        this.then.end();
      }

      b1() {
        order.push('b1');
      }

      c() {
        order.push('c');
      }
    }

    const test = Test.new();

    expect(await test.run()).toBe('early');
    expect(order).toEqual(['a', 'b', 'b1', 'result']);
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'a#1', 'b#1', 'b1#1', 'end#1']);
  });

  it('will fail if a class declares end', () => {
    class Test extends Steps {
      async run() {}

      end() {}
    }

    expect(() => new Test()).toThrow('Test declares end; return the result from run, end early with this.then.end().');
  });

  it('will fail if a step is called after end', async () => {
    const a = vi.fn();

    class Test extends Steps {
      async run() {
        this.then.end();
        this.a();
      }

      a() {
        a();
      }
    }

    await expect(Test.new().run()).rejects.toThrow('end must be the last call in a step.');
    expect(a).not.toHaveBeenCalled();
  });

  it('will keep a compensation registered before end', async () => {
    const refund = vi.fn();

    class Test extends Journal {
      paid = false;

      async run(fail: boolean) {
        this.pay(fail);

        await this;

        return this.paid ? 'paid' : 'unpaid';
      }

      pay(fail: boolean) {
        if (fail) throw new Error('declined');

        this.paid = true;
        this.then.undo(this.refund());
        this.then.end();
      }

      async refund() {
        refund();
      }
    }

    const test = Test.new();

    expect(await test.run(false)).toBe('paid');
    expect(refund).not.toHaveBeenCalled();
    expect(record(test)[1]).toMatchObject({ id: 'pay#1', next: [{ id: 'end#1', key: 'end' }], undo: [{ id: 'refund#1', key: 'refund' }] });
  });

  it('will end with the first end the plan reaches', async () => {
    const slow = mockPromise();
    const after = vi.fn();

    class Test extends Journal {
      winner = '';

      async run() {
        this.then(this.fast(), this.slow());

        await this;

        return this.winner;
      }

      async fast() {
        this.winner = 'fast';
        this.then.end();
      }

      async slow() {
        await slow;
        this.more();
        this.then.end();
      }

      more() {
        after();
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    slow.resolve();

    expect(await result).toBe('fast');
    expect(after).not.toHaveBeenCalled();
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'fast#1', 'slow#1', 'end#1']);
  });

  it('will resolve with nothing when run returns nothing', async () => {
    class Test extends Steps {
      count = 0;

      async run() {
        this.count = 1;
      }
    }

    const test = Test.new();

    expect(await test.run()).toBeUndefined();
    expect(test.count).toBe(1);
  });

  it('will not call hooks for an implicit end', async () => {
    const after = vi.fn();

    class Test extends Steps {
      async run() {}

      protected after(step: string) {
        after(step);
      }
    }

    await Test.new().run();
    expect(after.mock.calls).toEqual([['run']]);
  });

  it('will end from the controller', async () => {
    class Test extends Steps {
      count = 0;

      async run() {
        this.first();

        await this;

        return this.count;
      }

      async first() {
        this.count = 1;
        this.then.end();
      }
    }

    expect(await Test.new().run()).toBe(1);
  });

  it('will fail if end is called twice in a step', async () => {
    class Test extends Steps {
      async run() {
        this.then.end();
        this.then.end();
      }
    }

    await expect(Test.new().run()).rejects.toThrow('end must be the last call in a step.');
  });

  it('will do nothing if ended from outside while idle', () => {
    class Test extends Steps {
    }

    const test = Test.new();

    test.then.end();

    expect(test.then.status).toBe('idle');
    expect(test.then.runs).toBe(0);
  });

  it('will end from outside once steps in flight settle', async () => {
    const work = mockPromise();
    const more = mockPromise();
    const later = vi.fn();

    class Test extends Journal {
      value = 0;

      async run(work: Promise<void>) {
        this.load(work);

        await this;

        return `ended:${this.value}`;
      }

      protected async load(work: Promise<void>) {
        await work;
        this.value = 1;
        this.later();
      }

      async later() {
        later();
      }
    }

    const test = Test.new();
    const result = test.run(work);
    const queued = test.run(more);

    await flushMicrotasks();
    test.then.end();
    test.then.end();
    expect(test.then.status).toBe('running');

    work.resolve();

    expect(await result).toBe('ended:1');
    expect(later).not.toHaveBeenCalled();
    expect(test.then.runs).toBe(1);

    await flushMicrotasks();
    expect(test.then.status).toBe('running');
    test.then.end();
    more.resolve();

    expect(await queued).toBe('ended:1');
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'load#1', 'end#1']);
  });

  it('will end from outside while waiting', async () => {
    class Test extends Steps {
      count = 1;

      async run() {
        this.then(this.reply);

        await this;

        return this.count;
      }

      async reply() {}
    }

    const test = Test.new();
    const first = test.run();

    await flushMicrotasks();
    expect(test.reply).toBeTypeOf('function');

    test.then.end();

    expect(test.reply).toBeUndefined();
    expect(test.then.waiting).toEqual([]);
    expect(await first).toBe(1);
  });

  it('will fail if a step in flight fails after an outside end', async () => {
    const work = mockPromise();

    class Test extends Steps {
      async run() {
        this.load();
      }

      protected async load() {
        await work;
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.end();
    work.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(test.then.status).toBe('failed');
  });
});

describe('runs', () => {
  it('will repeat with a record each and fields kept', async () => {
    class Test extends Journal {
      count = 0;

      async run(by: number) {
        this.count += by;

        return this.count;
      }
    }

    const test = Test.new();

    expect(await test.run(1)).toBe(1);
    expect(await test.run(2)).toBe(3);
    expect(test.then.runs).toBe(2);
    expect(test.then.status).toBe('idle');
    expect(record(test)).toEqual([
      { id: 'run#1', key: 'run', args: [2], wrote: ['count'], next: [] }
    ]);
  });

  it('will queue run while a run is active', async () => {
    const work = mockPromise();
    const queues: unknown[][][] = [];

    class Test extends Steps {
      seen: string[] = [];

      async run(label: string) {
        this.see(label);

        await this;

        return this.seen;
      }

      protected async see(label: string) {
        await work;
        this.seen = this.seen.concat(label);
      }
    }

    const test = Test.new();

    test.get((self) => void queues.push(self.then.queue.slice()));

    const first = test.run('a');
    const second = test.run('b');
    const third = test.run('c');

    expect(test.then.queue).toEqual([['b'], ['c']]);

    work.resolve();

    expect(await first).toEqual(['a']);
    expect(await second).toEqual(['a', 'b']);
    expect(await third).toEqual(['a', 'b', 'c']);
    expect(test.then.queue).toEqual([]);
    expect(queues).toEqual([[], [['b'], ['c']], [['c']], []]);
  });

  it('will await the instance through the queue', async () => {
    const work = mockPromise();

    class Test extends Steps {
      async run(value?: string) {
        this.load();

        await this;

        return value;
      }

      protected async load() {
        await work;
      }
    }

    const test = Test.new();

    test.run('a');
    test.run('b');

    const awaited = test.then((value) => value);

    test.run('c');
    work.resolve();

    expect(await awaited).toBe('c');
    expect(test.then.runs).toBe(3);
  });

  it('will start a run when awaited idle', async () => {
    const called = vi.fn();

    class Test extends Steps {
      async run(value = 'x') {
        called(value);

        return value;
      }
    }

    const test = Test.new();

    expect(await test).toBe('x');
    expect(await test.run('y')).toBe('y');
    expect(await test).toBe('x');
    expect(called.mock.calls).toEqual([['x'], ['y'], ['x']]);
    expect(test.then.runs).toBe(3);
  });

  it('will reject an idle await when run takes arguments', async () => {
    class Test extends Steps {
      async run(prompt: string) {
        return prompt;
      }
    }

    const test = Test.new();

    await expect(test.then((value) => value)).rejects.toThrow(
      `${test} is idle. run() takes arguments; call it to start a run.`
    );
    expect(test.then.runs).toBe(0);
    expect(await test.run('x')).toBe('x');
  });

  it('will join a run when run takes arguments', async () => {
    class Test extends Steps {
      async run(prompt: string) {
        return prompt;
      }
    }

    const test = Test.new();

    test.run('x');

    expect(await test).toBe('x');
  });

  it('will start on idle await when run has defaults', async () => {
    class Test extends Steps {
      async run(x = 1) {
        return x;
      }
    }

    expect(await Test.new()).toBe(1);
  });

  it('will not start on idle await when run has an optional parameter', async () => {
    class Test extends Steps {
      async run(x?: number) {
        return x;
      }
    }

    const test = Test.new();

    await expect(test).rejects.toThrow(`${test} is idle. run() takes arguments; call it to start a run.`);
  });

  it('will reject the instance when the last run failed', async () => {
    class Test extends Steps {
      async run(fail?: boolean) {
        if (fail) throw new Error('boom');

        return 'ok';
      }
    }

    const test = Test.new();

    test.run(true);

    const awaited = test.then((value) => value);

    test.run(false);
    expect(await awaited).toBe('ok');

    test.run(true);
    await expect(test).rejects.toThrow('boom');
    expect(test.then.status).toBe('failed');
    expect(test.then.runs).toBe(3);
  });

  it('will reset error and status on the next run', async () => {
    class Test extends Steps {
      async run(fail: boolean) {
        if (fail) throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run(true)).rejects.toThrow('boom');
    expect(test.then.error).toEqual(new Error('boom'));

    await test.run(false);
    expect(test.then.error).toBeUndefined();
    expect(test.then.status).toBe('idle');
  });

  it('will be observed through the instance', async () => {
    const seen: string[] = [];

    class Test extends Steps {
      async run() {
        this.first();
      }

      async first() {
        await flushMicrotasks();
      }
    }

    const test = Test.new();

    test.get((self) => void seen.push(`${self.then.status}:${self.then.active}`));
    await test.run();
    await flushMicrotasks();

    expect(seen).toEqual([
      'idle:undefined',
      'running:run',
      'running:undefined',
      'running:first',
      'running:undefined',
      'idle:undefined'
    ]);
  });

  it('will not expose a step outside unless a wait accepts it', () => {
    class Test extends Steps {
      second() {}
    }

    const test = Test.new();

    expect(test.second).toBeUndefined();
    expect(Object.keys(test)).not.toContain('second');
  });
});

describe('then', () => {
  it('will await the instance', async () => {
    class Test extends Steps {
      protected new() {
        this.run();
      }

      async run() {
        this.first();

        await this;

        return 'x';
      }

      first() {}
    }

    const test = Test.new();

    expect(await test).toBe('x');
    expect(await Promise.resolve(test)).toBe('x');
    expect(test.then.status).toBe('idle');
  });

  it('will type the result from run through the instance', async () => {
    class Test extends Steps {
      protected new() {
        this.run();
      }

      async run() {
        return { n: 1 };
      }
    }

    const result: { n: number } = await Test.new();
    const awaited: Awaited<Test> = result;

    expect(awaited).toEqual({ n: 1 });
  });

  it('will observe then as a callable view', async () => {
    const seen: string[] = [];
    let view: unknown;

    class Test extends Steps {
      async run() {
        this.wait();

        await this;

        return 'done';
      }

      protected async wait() {
        await flushMicrotasks();
      }
    }

    const test = Test.new();

    test.get((self) => {
      view = self.then;
      seen.push(self.then.status);
    });

    expect(typeof view).toBe('function');
    expect(view).not.toBe(test.then);

    await test.run();
    await flushMicrotasks();

    expect(seen).toEqual(['idle', 'running', 'idle']);
    await expect(Promise.resolve({ then: view })).resolves.toBe('done');
  });

  it('will resolve a set factory to the result', async () => {
    class Test extends Steps {
      protected new() {
        this.run();
      }

      async run() {
        return 'x';
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

  it('will not export then', async () => {
    class Test extends Steps {
      count = 1;

      async run() {}
    }

    const test = Test.new();

    expect(Object.keys(test)).not.toContain('then');
    expect(test.get()).toEqual({ count: 1 });
    expect(await test.run()).toBeUndefined();
  });

  it('will spread to a snapshot', async () => {
    class Test extends Steps {
      async run() {
        this.a();
      }

      a() {}
    }

    const test = Test.new();

    await test.run();

    const snapshot = { ...test.then };

    expect(snapshot).toEqual({
      status: 'idle',
      active: undefined,
      queue: [],
      waiting: [],
      runs: 1,
      error: undefined
    });
    expect(test.then.get()).toEqual(snapshot);
    expect(test.then).not.toHaveProperty('record');
    expect(Symbol.iterator in test.then).toBe(false);
  });
});

describe('stop', () => {
  it('will discard pending and let a step in flight commit', async () => {
    const work = mockPromise();
    const later = vi.fn();

    class Test extends Journal {
      value = 0;

      async run() {
        this.load();
      }

      protected async load() {
        await work;
        this.value = 1;
        this.later();
      }

      later() {
        later();
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.stop();
    expect(test.then.status).toBe('stopped');

    work.resolve();
    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(later).not.toHaveBeenCalled();
    expect(test.value).toBe(1);
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'load#1']);
    expect(test.then.status).toBe('stopped');
    expect(test.then.runs).toBe(1);
  });

  it('will reject queued runs', async () => {
    const work = mockPromise();

    class Test extends Steps {
      async run() {
        await work;
      }
    }

    const test = Test.new();
    const first = test.run();
    const second = test.run();

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

    class Test extends Journal {
      value = 0;

      async run() {
        this.first();
      }

      protected first() {
        this.value = 1;
        this.then.undo(undo);
        this.second();
      }

      async second() {
        await work;
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.stop(true);
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(undo).toHaveBeenCalledWith(expect.objectContaining({ name: 'Stopped' }));
    expect(test.value).toBe(0);
    expect(record(test).map((entry) => entry.unwound)).toEqual([undefined, true, undefined]);
  });

  it('will stop from inside a step', async () => {
    const later = vi.fn();

    class Test extends Journal {
      async run() {
        this.then.stop();
        this.later();
      }

      later() {
        later();
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toMatchObject({ name: 'Stopped' });
    expect(later).not.toHaveBeenCalled();
    expect(record(test)[0].next).toEqual([{ id: 'later#1', key: 'later', args: [] }]);
  });

  it('will stop when the instance is destroyed', async () => {
    const work = mockPromise();

    class Test extends Steps {
      async run() {
        await work;
      }
    }

    const test = Test.new();
    const result = test.run();

    test.set(null);
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(test.then.status).toBe('stopped');
  });

  it('will not stop when idle', () => {
    class Test extends Steps {
    }

    const test = Test.new();

    test.then.stop();
    expect(test.then.status).toBe('idle');
  });

  it('will reject the run when run does not catch a stop', async () => {
    const work = mockPromise();
    const after = vi.fn();

    class Test extends Steps {
      async run() {
        this.load();

        await this;

        after();
        return 'done';
      }

      protected async load() {
        await work;
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.stop();
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(after).not.toHaveBeenCalled();
  });

  it('will resolve with what run returns when it catches a stop', async () => {
    const caught = mockUncaught();

    class Test extends Steps {
      async run() {
        this.then(this.reply);

        try {
          await this;
        } catch (error) {
          return (error as Error).name;
        }
      }

      async reply() {}
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.stop();

    expect(await result).toBe('Stopped');
    expect(test.then.status).toBe('stopped');
    await flushMicrotasks();
    expect(caught).toEqual([]);
  });

  it('will run again after a stop', async () => {
    class Test extends Steps {
      async run() {
        this.then.stop();
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toMatchObject({ name: 'Stopped' });
    await expect(test.run()).rejects.toMatchObject({ name: 'Stopped' });
    expect(test.then.runs).toBe(2);
  });

  it('will carry a reason to the run, queue and compensations', async () => {
    const work = mockPromise();
    const undo = vi.fn();

    class Test extends Steps {
      async run() {
        this.hold();
      }

      protected hold() {
        this.then.undo(undo);
        this.wait();
      }

      protected async wait() {
        await work;
      }
    }

    const test = Test.new();
    const first = test.run();
    const second = test.run();

    await flushMicrotasks();
    test.then.stop(true, 'cancelled by user');
    work.resolve();

    const stopped = { name: 'Stopped', message: 'cancelled by user', cause: 'cancelled by user' };

    await expect(second).rejects.toMatchObject(stopped);
    await expect(first).rejects.toMatchObject(stopped);
    await expect(first).rejects.toBe(await second.catch((error) => error));
    expect(undo.mock.calls[0][0]).toMatchObject(stopped);
    expect(test.then.error).toBeUndefined();
  });

  it('will carry a reason without undo', async () => {
    const work = mockPromise();
    const reason = { code: 499 };

    class Test extends Steps {
      async run() {
        await work;
      }
    }

    const test = Test.new();
    const result = test.run();

    test.then.stop(false, reason);
    work.resolve();

    const error = await result.catch((error) => error);

    expect(error).toMatchObject({ name: 'Stopped', message: `${test} was stopped.` });
    expect(error.cause).toBe(reason);
  });

  it('will not set a cause without a reason', async () => {
    const work = mockPromise();

    class Test extends Steps {
      async run() {
        await work;
      }
    }

    const test = Test.new();
    const result = test.run();

    test.then.stop();
    work.resolve();

    const error = await result.catch((error) => error);

    expect(error.message).toBe(`${test} was stopped.`);
    expect('cause' in error).toBe(false);
  });
});

describe('wait', () => {
  it('will park until a listed step answers', async () => {
    class Test extends Journal {
      answer = '';

      async run() {
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
    const result = test.run();

    await flushMicrotasks();
    expect(test.then.status).toBe('waiting');
    expect(test.then.waiting).toEqual([{ id: 'wait#1', step: 'ask', args: ['question'], answers: ['reply', 'skip'] }]);

    test.reply('yes');
    expect(test.then.waiting).toEqual([]);
    expect(test.then.status).toBe('running');

    await result;
    expect(test.answer).toBe('yes');
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'ask#1', 'reply#1', 'thanks#1', 'later#1']);
    expect(record(test)[1].next).toEqual([{ id: 'wait#1', key: 'wait', args: [], answers: ['reply', 'skip'] }]);
    expect(record(test)[2]).toMatchObject({ wake: 'wait#1', wrote: ['answer'] });
  });

  it('will run what follows a wait after its answer', async () => {
    const order: string[] = [];

    class Test extends Steps {
      async run() {
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
    const result = test.run();

    await flushMicrotasks();
    expect(order).toEqual([]);

    test.reply();
    await result;

    expect(order).toEqual(['reply', 'reply again', 'after']);
  });

  it('will answer the oldest wait first', async () => {
    class Test extends Journal {
      answers: string[] = [];

      async run() {
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
    const result = test.run();

    test.get((self) => void seen.push(self.then.waiting.map((wait) => wait.args[0])));

    await flushMicrotasks();
    test.reply('1');
    await flushMicrotasks();
    test.reply('2');

    await result;
    expect(test.answers).toEqual(['1', '2']);
    expect(record(test).filter((entry) => entry.wake).map((entry) => [entry.wake, entry.args])).toEqual([
      ['wait#1', ['1']],
      ['wait#2', ['2']]
    ]);
    expect(seen).toEqual([[], ['a', 'b'], ['b'], []]);
  });

  it('will expose a step only while a wait accepts it', async () => {
    class Test extends Steps {
      async run() {
        this.then(this.reply);
      }

      reply() {}
    }

    const test = Test.new();
    const seen: boolean[] = [];

    test.get((self) => void seen.push(typeof self.reply == 'function'));

    expect(test.reply).toBeUndefined();

    const result = test.run();

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
    class Test extends Steps {
      count = 0;

      async run() {
        this.reply();
      }

      reply() {
        this.count++;
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.count).toBe(1);
  });

  it('will answer the wait opened with the same first argument', async () => {
    class Test extends Journal {
      answers: string[] = [];

      async run() {
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
    const result = test.run();

    await flushMicrotasks();
    test.reply('b');

    expect(test.then.waiting.map((wait) => wait.args[0])).toEqual(['a']);

    test.reply('a');
    await result;

    expect(record(test).filter((entry) => entry.wake).map((entry) => [entry.wake, entry.args])).toEqual([
      ['wait#2', ['b']],
      ['wait#1', ['a']]
    ]);
  });

  it('will resolve an answer once its own branch is done', async () => {
    const work = mockPromise();
    const order: string[] = [];

    class Test extends Steps {
      async run() {
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
    const result = test.run();

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

    class Test extends Steps {
      async run() {
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
    const result = test.run();

    await flushMicrotasks();

    const answered = test.reply();

    await flushMicrotasks();
    test.then.stop();
    work.resolve();

    await expect(answered).rejects.toMatchObject({ name: 'Stopped' });
    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
  });

  it('will reject an answer if its step fails', async () => {
    class Test extends Steps {
      async run() {
        this.then(this.reply);
      }

      async reply() {
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();

    await expect(test.reply()).rejects.toThrow('boom');
    await expect(result).rejects.toThrow('boom');
  });

  it('will not answer a wait with a step it does not list', async () => {
    class Test extends Steps {
      async run() {
        this.then(this.reply);
      }

      reply() {}
      other() {}
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    expect(test.other).toBeUndefined();

    test.reply();
    await result;
  });

  it('will fail if run answers a wait', async () => {
    class Test extends Steps {
      async run() {
        this.then(this.run);
      }
    }

    await expect(Test.new().run()).rejects.toThrow('run cannot answer a wait.');
  });

  it('will not wait on a step of another instance', async () => {
    class Test extends Steps {
      async run(other?: Test) {
        if (other) this.then(other.reply);
      }

      reply() {}
    }

    const other = Test.new();

    await expect(Test.new().run(other)).rejects.toThrow('a step cannot await its own run.');
  });

  it('will warn once if closure compensations are held', async () => {
    const warn = mockWarn();

    class Test extends Steps {
      async run() {
        this.hold();
      }

      protected hold() {
        this.then.undo(() => {});
        this.ask();
        this.ask();
      }

      ask() {
        this.then(this.reply);
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.reply();
    await flushMicrotasks();
    test.reply();
    await result;

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(`${test} is waiting with closure compensations held; a closure does not survive a resume.`);
  });

  it('will release waits on stop', async () => {
    class Test extends Steps {
      async run() {
        this.then(this.reply);
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();

    const { reply } = test;

    test.then.stop();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(test.then.waiting).toEqual([]);
    expect(() => reply()).toThrow('reply cannot be called from outside; call run() to start a run.');
  });

  it('will answer its own wait through a settled step', async () => {
    const calls = new Map<string, () => unknown>();

    class Test extends Journal {
      answers: string[] = [];

      async run() {
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
    const result = test.run();

    await vi.waitFor(() => expect(test.then.waiting).toHaveLength(2));

    await calls.get('b')!();
    expect(test.then.waiting.map((wait) => wait.args[0])).toEqual(['a']);

    await calls.get('a')!();
    await result;

    expect(test.answers).toEqual(['B', 'A']);
    expect(record(test).filter((entry) => entry.wake).map((entry) => [entry.wake, entry.args])).toEqual([
      ['wait#2', ['B']],
      ['wait#1', ['A']]
    ]);
  });

  it('will route a settled step call as an outside call', async () => {
    let poke!: () => unknown;

    class Test extends Steps {
      answer = '';

      async run() {
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
    const result = test.run();

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    await poke();
    await result;

    expect(test.answer).toBe('poked');
  });

  it('will bind a settled step call to its run', async () => {
    let poke!: () => unknown;

    class Test extends Steps {
      async run() {
        poke = () => this.reply();
        this.then(this.reply);
      }

      reply() {}
    }

    const test = Test.new();
    const first = test.run();
    const stale = poke;

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    test.reply();
    await first;

    const second = test.run();

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    expect(() => stale()).toThrow('run has settled; reply cannot run.');
    expect(test.then.waiting).toHaveLength(1);

    await poke();
    await second;
  });

  it('will not journal writes through a settled step', async () => {
    let write!: () => void;

    class Test extends Journal {
      value = 0;

      async run() {
        write = () => void (this.value = 1);
        this.then(this.reply);
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.run();

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    write();
    test.reply();
    await result;

    expect(test.value).toBe(1);
    expect(record(test).map((entry) => entry.wrote)).toEqual([[], []]);
  });

  it('will not have wait on the runner', () => {
    class Test extends Steps {
    }

    const test = Test.new();

    expect('wait' in test.then).toBe(false);
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

    class Test extends Journal {
      answer = '';

      async run() {
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
    const result = test.run();

    await vi.advanceTimersByTimeAsync(99);
    expect(test.then.status).toBe('waiting');

    await vi.advanceTimersByTimeAsync(1);
    await result;
    expect(test.answer).toBe('timeout');
    expect(record(test).map((entry) => [entry.id, entry.wake])).toEqual([
      ['run#1', undefined],
      ['deny#1', 'wait#1']
    ]);
    expect(record(test)[0].next).toEqual([{ id: 'wait#1', key: 'wait', args: [], answers: ['allow', 'deny'] }]);
  });

  it('will abort watchers once answered from outside', async () => {
    let signal!: AbortSignal;
    const lost = vi.fn();

    class Test extends Steps {
      async run() {
        this.then(this.reply, async (given) => {
          signal = given;
          await delay(100, { signal: given }).catch(lost);
          throw new Error('lost');
        });
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.run();

    await vi.waitFor(() => expect(signal).toBeDefined());
    expect(signal.aborted).toBe(false);

    test.reply();
    expect(signal.aborted).toBe(true);

    await result;
    expect(lost).toHaveBeenCalled();
  });

  it('will leave the wait open if a watcher settles without answering', async () => {
    const nudge = vi.fn();

    class Test extends Steps {
      async run() {
        this.then(this.reply, async () => {
          nudge();
        });
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.run();

    await vi.waitFor(() => expect(nudge).toHaveBeenCalled());
    await flushMicrotasks();
    expect(test.then.status).toBe('waiting');

    test.reply();
    await result;
  });

  it('will start watchers when the plan reaches the wait', async () => {
    const work = mockPromise();
    const watcher = vi.fn();

    class Test extends Steps {
      async run() {
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
    const result = test.run();

    await flushMicrotasks();
    expect(watcher).not.toHaveBeenCalled();

    work.resolve();
    await vi.waitFor(() => expect(watcher).toHaveBeenCalledWith(expect.any(AbortSignal)));

    test.reply();
    await result;
  });

  it('will call a watcher function on the step which opened the wait', async () => {
    class Test extends Steps {
      answer = '';

      async run() {
        this.ask('question');

        await this;

        return this.answer;
      }

      ask(question: string) {
        this.then(this.reply, function (this: Test) {
          this.reply(`re: ${question}`);
        });
      }

      reply(answer: string) {
        this.answer = answer;
      }
    }

    expect(await Test.new().run()).toBe('re: question');
  });

  it('will answer each wait from its own watcher', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    class Test extends Journal {
      async run() {
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
    const result = test.run();

    await vi.advanceTimersByTimeAsync(200);
    await result;

    expect(record(test).filter((entry) => entry.wake).map((entry) => entry.wake)).toEqual(['wait#2', 'wait#1']);
  });

  it('will fail the run if a watcher throws before the wait closes', async () => {
    class Test extends Steps {
      value = 0;

      async run() {
        this.value = 1;
        this.then(this.reply, async () => {
          throw new Error('watcher');
        });
      }

      reply() {}
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('watcher');
    expect(test.value).toBe(1);
    expect(test.then.waiting).toEqual([]);
    expect(test.then.status).toBe('failed');
  });

  it('will not let a stale watcher answer the next run', async () => {
    const gate = mockPromise();
    const late = vi.fn();

    class Test extends Steps {
      async run(first: boolean) {
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
    const first = test.run(true);

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    test.reply();
    await first;

    const second = test.run(false);

    await vi.waitFor(() => expect(test.then.status).toBe('waiting'));
    gate.resolve();
    await vi.waitFor(() => expect(late).toHaveBeenCalledWith(new Error('run has settled; reply cannot run.')));
    expect(test.then.waiting).toHaveLength(1);

    test.reply();
    await second;
  });

  it('will abort watchers when the run stops', async () => {
    let signal!: AbortSignal;

    class Test extends Steps {
      async run() {
        this.then(this.reply, (given) => void (signal = given));
      }

      reply() {}
    }

    const test = Test.new();
    const result = test.run();

    await vi.waitFor(() => expect(signal).toBeDefined());
    test.then.stop();

    expect(signal.aborted).toBe(true);
    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
  });

  it('will fail if tokens are mixed with step references', async () => {
    class Test extends Steps {
      async run() {
        this.then(this.a(), this.reply);
      }

      a() {}
      reply() {}
    }

    await expect(Test.new().run()).rejects.toThrow('then() takes called steps or step references, not both.');
  });

  it('will type a watcher signal', () => {
    class Test extends Steps {
      async run() {
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

    class Test extends Journal {
      async run() {
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
    const result = test.run();

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
    expect(record(test)[1].next).toEqual([
      { id: 'slot#1', key: 'slot', args: [] },
      { id: 'scan#1', key: 'scan', args: ['a'] }
    ]);
  });

  it('will follow a max read live', async () => {
    const work = gates('a', 'b', 'c');
    const started: string[] = [];

    class Test extends Steps {
      limit = 1;

      async run() {
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
    const result = test.run();

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

  it('will follow a max tracked on another Model', async () => {
    const work = gates('a', 'b', 'c');
    const started: string[] = [];
    const reads = vi.fn();

    class Settings extends Model {
      limit = 1;
    }

    class Test extends Steps {
      settings = new Settings();

      async run() {
        this.then(['a', 'b', 'c'], this.visit);
      }

      protected async visit(site: string) {
        this.then.slot({ max: ($) => (reads(), $.settings.limit) });
        this.scan(site);
      }

      protected async scan(site: string) {
        started.push(site);
        await work.get(site);
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    expect(started).toEqual(['a']);

    test.settings.limit = 3;
    await flushMicrotasks();
    expect(started).toEqual(['a', 'b', 'c']);

    reads.mockClear();
    test.settings.limit = 4;
    await flushMicrotasks();
    expect(reads).not.toHaveBeenCalled();

    for (const gate of work.values()) gate.resolve();
    await result;
  });

  it('will stop tracking max once nothing waits', async () => {
    const work = gates('a', 'b');
    const reads = vi.fn();

    class Settings extends Model {
      limit = 1;
    }

    const settings = Settings.new();

    class Test extends Steps {
      settings = settings;

      async run() {
        this.then(['a', 'b'], this.visit);
      }

      protected async visit(site: string) {
        this.then.slot({
          max: ($) => {
            reads(site);
            return $.settings.limit;
          }
        });
        this.scan(site);
      }

      protected async scan(site: string) {
        await work.get(site);
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    expect(reads.mock.calls).toEqual([['a'], ['b']]);

    settings.limit = 0.5;
    await flushMicrotasks();
    expect(reads.mock.calls).toEqual([['a'], ['b'], ['b']]);

    work.get('a')!.resolve();
    await flushMicrotasks();
    reads.mockClear();

    settings.limit = 2;
    await flushMicrotasks();
    expect(reads).not.toHaveBeenCalled();

    work.get('b')!.resolve();
    await result;

    settings.limit = 3;
    await flushMicrotasks();
    expect(reads).not.toHaveBeenCalled();
    expect(test.then.status).toBe('idle');
  });

  it('will stop tracking max when the run stops', async () => {
    const reads = vi.fn();

    class Test extends Steps {
      limit = 0;

      async run() {
        this.then.slot({ max: ($) => (reads(), $.limit) });
        this.run();
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    expect(reads).toHaveBeenCalledTimes(1);

    test.then.stop();
    await expect(result).rejects.toMatchObject({ name: 'Stopped' });

    test.limit = 1;
    await flushMicrotasks();
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('will read max before the instance is ready', async () => {
    const ready = mockPromise();
    const scan = vi.fn();

    class Test extends Steps {
      limit = 1;

      protected async new() {
        await this.run();
        await ready;
      }

      async run() {
        this.then.slot({ max: ($) => $.limit });
        this.scan();
      }

      protected async scan() {
        scan();
      }
    }

    Test.new();
    await flushMicrotasks();

    expect(scan).toHaveBeenCalledTimes(1);
    ready.resolve();
  });

  it('will wait after ms before taking a slot', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const scan = vi.fn();

    class Test extends Steps {
      async run() {
        this.then.slot({ after: 1000 });
        this.scan();
      }

      protected async scan() {
        scan();
      }
    }

    const test = Test.new();
    const result = test.run();

    await vi.advanceTimersByTimeAsync(999);
    expect(scan).not.toHaveBeenCalled();
    expect(test.then.status).toBe('running');

    await vi.advanceTimersByTimeAsync(1);
    await result;
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it('will share a keyed slot across instances', async () => {
    const lock = {};
    const work = gates('one', 'two');
    const started: string[] = [];

    class Test extends Steps {
      name = '';

      async run() {
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
    const done = Promise.all([one.run(), two.run()]);

    await flushMicrotasks();
    expect(started).toEqual(['one']);

    work.get('one')!.resolve();
    await flushMicrotasks();
    expect(started).toEqual(['one', 'two']);

    work.get('two')!.resolve();
    await done;
  });

  it('will share a primitive key across groups of one instance', async () => {
    const work = gates('x', 'y');
    const started: string[] = [];

    class Test extends Steps {
      async run() {
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
    const result = test.run();

    await flushMicrotasks();
    expect(started).toEqual(['x']);

    work.get('x')!.resolve();
    await flushMicrotasks();
    expect(started).toEqual(['x', 'y']);

    work.get('y')!.resolve();
    await result;
  });

  it('will slot a step outside any group on the instance', async () => {
    const order: string[] = [];

    class Test extends Journal {
      async run() {
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

    await test.run();
    expect(order).toEqual(['a', 'b']);
    expect(record(test)[0].next.map((node) => node.id)).toEqual(['slot#1', 'a#1', 'b#1']);
  });

  it('will re-enter a slot held above it', async () => {
    const done = vi.fn();

    class Test extends Steps {
      async run() {
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

    await test.run();
    expect(done.mock.calls).toEqual([['a'], ['b']]);
  });

  it('will queue a retry behind those waiting', async () => {
    const scanned: string[] = [];
    let failed = false;

    class Test extends Steps {
      async run() {
        this.then(['a', 'b', 'c'], this.visit);
      }

      protected async visit(site: string) {
        this.then.slot({ max: 1 });
        this.scan(site).catch(() => {
          this.visit(site);
        });
      }

      protected async scan(site: string) {
        scanned.push(site);
        await Promise.resolve();

        if (site == 'a' && !failed) {
          failed = true;
          throw new Error('down');
        }
      }
    }

    await Test.new().run();
    expect(scanned).toEqual(['a', 'b', 'c', 'a']);
  });

  it('will not hold a slot through a retry\'s backoff', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const scanned: string[] = [];
    let failed = false;

    class Test extends Steps {
      async run() {
        this.then(['a', 'b'], this.visit);
      }

      protected async visit(site: string) {
        this.then.slot({ max: 1, after: this.then.retry && 1000 });
        this.scan(site).catch(() => {
          this.visit(site);
        });
      }

      protected async scan(site: string) {
        scanned.push(site);

        if (site == 'a' && !failed) {
          failed = true;
          throw new Error('down');
        }
      }
    }

    const result = Test.new().run();

    await vi.advanceTimersByTimeAsync(0);
    expect(scanned).toEqual(['a', 'b']);

    await vi.advanceTimersByTimeAsync(1000);
    await result;
    expect(scanned).toEqual(['a', 'b', 'a']);
  });

  it('will not deadlock a retry under a slot held above its issuer', async () => {
    const scanned: string[] = [];
    let failed = false;

    class Test extends Steps {
      async run() {
        this.then.slot({ key: 'db', max: 1 });
        this.visit('a');
      }

      protected async visit(site: string) {
        this.then.slot({ key: 'db', max: 1 });
        this.scan(site).catch(() => {
          this.visit(site);
        });
      }

      protected async scan(site: string) {
        scanned.push(site);

        if (!failed) {
          failed = true;
          throw new Error('down');
        }
      }
    }

    await Test.new().run();
    expect(scanned).toEqual(['a', 'a']);
  });

  it('will release slots when a run fails', async () => {
    const lock = {};
    const gate = mockPromise();
    const work = vi.fn();

    class Failing extends Steps {
      async run() {
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

    class Other extends Steps {
      async run() {
        this.then.slot({ key: lock, max: 1 });
        this.work();
      }

      protected async work() {
        work('other');
      }
    }

    const failing = Failing.new();
    const other = Other.new();
    const failed = failing.run();

    await flushMicrotasks();

    const waiting = other.run();

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

    class Holder extends Steps {
      async run() {
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

    class Other extends Steps {
      async run() {
        this.then.slot({ key: lock, max: 1 });
        this.work();
      }

      protected async work() {
        work('other');
      }
    }

    const holder = Holder.new();
    const other = Other.new();
    const stopped = holder.run();

    await flushMicrotasks();

    const waiting = other.run();

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

    class Test extends Steps {
      async run() {
        this.then.slot({ key: lock, max: 1 });
        this.hold();
      }

      protected async hold() {
        await gate;
      }
    }

    const one = Test.new();
    const two = Test.new();
    const ended = one.run();

    await flushMicrotasks();

    const waiting = two.run();

    one.then.end();
    gate.resolve();

    await ended;
    expect(one.then.status).toBe('idle');
    await waiting;
  });

  it('will cancel a slot whose step a caught failure discards', async () => {
    const never = vi.fn();
    const caught = vi.fn();

    class Test extends Steps {
      async run() {
        this.then(this.first(), this.second()).catch(caught);
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
        throw new Error('reset');
      }

      protected async never() {
        never();
      }
    }

    await Test.new().run();
    expect(caught).toHaveBeenCalledWith(new Error('reset'));
    expect(never).not.toHaveBeenCalled();
  });

  it('will not reach a slot after a failure', async () => {
    const never = vi.fn();

    class Test extends Steps {
      async run() {
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

    await expect(test.run()).rejects.toThrow('boom');
    expect(never).not.toHaveBeenCalled();
  });

  it('will not group or return a slot', async () => {
    class Grouped extends Steps {
      async run() {
        this.then(this.then.slot() as never);
      }
    }

    class Returned extends Steps {
      async run() {
        this.hold();
      }

      protected async hold() {
        return this.then.slot() as never;
      }
    }

    await expect(Grouped.new().run()).rejects.toThrow('slot() cannot be grouped.');
    await expect(Returned.new().run()).rejects.toThrow('hold returned a value; a step returns nothing - its undo is this.then.undo(...).');
  });

  it('will throw outside a step', () => {
    class Test extends Steps {}

    expect(() => Test.new().then.slot()).toThrow('slot must be called inside a step.');
  });
});

describe('catch', () => {
  afterEach(() => void vi.useRealTimers());

  it('will unwind a caught branch and continue', async () => {
    const undo = vi.fn();

    class Test extends Journal {
      value = 0;

      async run() {
        this.a().catch();
        this.b();
      }

      protected async a() {
        this.value = 1;
        this.then.undo(undo);
        this.a1();
      }

      protected async a1() {
        this.value = 2;
        throw new Error('boom');
      }

      protected async b() {}
    }

    const test = Test.new();

    await test.run();
    expect(test.value).toBe(0);
    expect(undo).toHaveBeenCalledWith(new Error('boom'));
    expect(record(test)).toEqual([
      {
        id: 'run#1',
        key: 'run',
        args: [],
        wrote: [],
        next: [
          { id: 'a#1', key: 'a', args: [], rescue: true },
          { id: 'b#1', key: 'b', args: [] }
        ]
      },
      expect.objectContaining({ id: 'a#1', undo: [{ id: 'then#1', key: 'then', args: [] }], unwound: true }),
      expect.objectContaining({ id: 'a1#1', error: new Error('boom') }),
      expect.objectContaining({ id: 'b#1' })
    ]);
  });

  it('will pass a caught try to after', async () => {
    const seen: unknown[] = [];

    class Test extends Steps {
      async run() {
        this.scan('x').catch(this.fallback);
      }

      protected async scan(site: string) {
        throw new Error(`${site} is down`);
      }

      protected async fallback() {}

      protected after(step: string, entry: Steps.Entry) {
        seen.push([step, entry.error]);
      }
    }

    await Test.new().run();

    expect(seen).toEqual([
      ['run', undefined],
      ['scan', new Error('x is down')],
      ['fallback', undefined]
    ]);
  });

  it('will fail the run when after throws on a caught try', async () => {
    class Test extends Steps {
      async run() {
        this.scan().catch();
      }

      protected async scan() {
        throw new Error('down');
      }

      protected after(step: string, entry: Steps.Entry) {
        if (entry.error) throw new Error('after');
      }
    }

    await expect(Test.new().run()).rejects.toThrow('after');
  });

  it('will run a step in the caught branch\'s place given the error', async () => {
    const seen = vi.fn();

    class Test extends Journal {
      async run() {
        this.scan('x').catch(this.fallback);
        this.after1();
      }

      protected async scan(site: string) {
        throw new Error(`${site} is down`);
      }

      protected async fallback(error: unknown) {
        seen(error, this.then.retry);
      }

      protected async after1() {
        seen('after');
      }
    }

    const test = Test.new();

    await test.run();
    expect(seen.mock.calls).toEqual([[new Error('x is down'), 0], ['after']]);
    expect(record(test)[0].next[0]).toEqual({ id: 'scan#1', key: 'scan', args: ['x'], rescue: 'fallback' });
    expect(record(test).map((entry) => [entry.id, entry.args])).toEqual([
      ['run#1', []],
      ['scan#1', ['x']],
      ['fallback#1', [{ name: 'Error', message: 'x is down' }]],
      ['after1#1', []]
    ]);
  });

  it('will count retries of a step re-run from its own catch', async () => {
    const retries: number[] = [];

    class Test extends Journal {
      async run() {
        this.then(['a'], (site) => this.visit(site).catch());
      }

      protected async visit(site: string) {
        retries.push(this.then.retry);

        if (this.then.retry == 2) throw new Error('give up');

        this.then(this.scan(site)).catch(this.visit(site));
      }

      protected async scan(site: string) {
        throw new Error(`${site} is down`);
      }
    }

    const test = Test.new();

    await test.run();
    expect(retries).toEqual([0, 1, 2]);
    expect(record(test).map(({ id, retry, error }) => [id, retry, (error as Error)?.message])).toEqual([
      ['run#1', undefined, undefined],
      ['visit#1', undefined, undefined],
      ['scan#1', undefined, 'a is down'],
      ['visit#2', 1, undefined],
      ['scan#2', undefined, 'a is down'],
      ['visit#3', 2, 'give up']
    ]);
  });

  it('will count a step a handler calls again on its own failure as a first repeat', async () => {
    const calls: unknown[][] = [];

    class Test extends Steps {
      async run() {
        this.scan('x').catch(() => {
          this.scan('x');
        });
      }

      protected async scan(site: string) {
        calls.push([site, this.then.retry]);
        throw new Error('down');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('down');
    expect(calls).toEqual([['x', 0], ['x', 1]]);
  });

  it('will back off a retry with a slot', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    let tries = 0;

    class Test extends Steps {
      async run() {
        this.then.slot({ after: 100 * this.then.retry });
        this.scan().catch(this.then.retry < 2 ? this.run : undefined);
      }

      protected async scan() {
        if (++tries < 3) throw new Error('later');
      }
    }

    const result = Test.new().run();

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
    class Test extends Journal {
      value = '';

      async run() {
        this.scan().catch((error: Error) => {
          this.value = error.message;
        });
      }

      protected async scan() {
        throw new Error('down');
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.value).toBe('down');
    expect(record(test)[0].next).toEqual([{ id: 'scan#1', key: 'scan', args: [], rescue: 'then' }]);
    expect(record(test).at(-1)).toMatchObject({ id: 'then#1', key: 'then', args: [new Error('down')], wrote: ['value'] });
  });

  it('will settle a mapped group with what succeeded', async () => {
    class Test extends Steps {
      found = has<string>();

      async run() {
        this.then(['a', 'b', 'c'], (site) => this.visit(site).catch());
      }

      protected async visit(site: string) {
        this.found.push(site);
        await Promise.resolve();

        if (site == 'b') throw new Error('blocked');
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.found.get()).toEqual(['a', 'c']);
  });

  it('will catch a group token', async () => {
    const gate = mockPromise();
    const after = vi.fn();

    class Test extends Journal {
      value = 0;

      async run() {
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
    const result = test.run();

    await flushMicrotasks();
    gate.resolve();

    await result;
    expect(after).toHaveBeenCalledWith(0);
    expect(record(test).map((entry) => [entry.id, entry.unwound])).toEqual([['run#1', undefined], ['a#1', true], ['b#1', undefined], ['c#1', undefined], ['d#1', undefined]]);
  });

  it('will catch an answer or watcher of a caught wait', async () => {
    class Test extends Steps {
      async run() {
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
    const result = test.run();

    await flushMicrotasks();
    await test.answer();

    await result;
    expect(test.then.status).toBe('idle');
  });

  it('will fail the run when a caught branch\'s compensation throws', async () => {
    class Test extends Journal {
      async run() {
        this.a().catch();
      }

      protected async a() {
        this.then.undo(() => {
          throw new Error('undo');
        });
        this.b();
      }

      protected async b() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('undo');
    expect(record(test)[1]).toMatchObject({ id: 'a#1', unwound: 'failed' });
  });

  it('will not run a handler once the run stops', async () => {
    const gate = mockPromise();
    const handler = vi.fn();

    class Test extends Steps {
      async run() {
        this.a().catch(handler);
      }

      protected async a() {
        this.then.undo(() => gate);
        this.b();
      }

      protected async b() {
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.stop();
    gate.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('will not catch a broken rule', async () => {
    class Test extends Steps {
      value = 0;

      async run() {
        this.a().catch();
      }

      protected async a() {
        this.b();
        this.value = 1;
      }

      protected async b() {}
    }

    await expect(Test.new().run()).rejects.toThrow('a wrote value after scheduling b.');
  });

  it('will not catch slot or end', async () => {
    const errors: unknown[] = [];

    class Test extends Steps {
      async run() {
        for (const token of [() => this.then.slot(), () => this.then.end()])
          try {
            (token() as unknown as Promise<void>).catch();
          } catch (error) {
            errors.push(error);
          }
      }
    }

    await Test.new().run().catch(() => {});
    expect(errors).toEqual([new Error('slot() cannot be caught.'), new Error('end() cannot be caught.')]);
  });

  it('will throw for a handler not a function', async () => {
    class Test extends Steps {
      async run() {
        this.a().catch('a' as never);
      }

      protected async a() {}
    }

    await expect(Test.new().run()).rejects.toThrow('catch() takes a step, a function, steps called for it or nothing.');
  });

  it('will throw retry, catch and reset outside a step', () => {
    class Test extends Steps {}

    const test = Test.new();

    expect(() => test.then.retry).toThrow('retry must be read inside a step.');
    expect(() => test.then.undo(() => {})).toThrow('undo must be called inside a step.');
    expect(() => test.then.reset()).toThrow('reset must be called inside a step.');
  });
});

describe('suspense', () => {
  it('will wait in run for a pending value', async () => {
    let tries = 0;

    class Test extends Journal {
      price = set<number>();
      total = 0;

      async run() {
        tries++;
        this.total = this.price * 2;
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    expect(tries).toBe(1);
    expect(test.then.status).toBe('running');
    expect(test.then.active).toBe('run');
    expect(record(test)).toEqual([]);

    test.price = 3;

    await result;
    expect(tries).toBe(2);
    expect(test.total).toBe(6);
    expect(record(test)).toEqual([
      { id: 'run#1', key: 'run', args: [], wrote: ['total'], next: [] }
    ]);
  });

  it('will restore writes and drop tokens of a suspended try', async () => {
    const order: string[] = [];

    class Test extends Journal {
      price = set<number>();
      note = '';

      async run() {
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
    const result = test.run();

    await vi.waitFor(() => expect(order).toEqual(['quote:quoting']));
    expect(test.note).toBe('');

    test.price = 5;

    await result;
    expect(order).toEqual(['quote:quoting', 'quote:quoting', 'report:quoting']);
    expect(record(test).map(({ id, wrote, next }) => [id, wrote, next.map((node) => node.id)])).toEqual([
      ['run#1', [], ['quote#1']],
      ['quote#1', ['note'], ['report#2']],
      ['report#2', [], []]
    ]);
  });

  it('will wait for a getter over a pending value', async () => {
    class Test extends Steps {
      price = set<number>();
      total = 0;

      get taxed() {
        return this.price * 2;
      }

      async run() {
        this.total = this.taxed;
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.price = 4;

    await result;
    expect(test.total).toBe(8);
  });

  it('will wait after an await', async () => {
    const work = mockPromise();
    let tries = 0;

    class Test extends Steps {
      price = set<number>();
      total = 0;

      async run() {
        tries++;
        await work;
        this.total = this.price;
      }
    }

    const test = Test.new();
    const result = test.run();

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

    class Test extends Journal {
      value = 0;

      async run() {
        this.value = 1;
        throw pending;
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    pending.reject(new Error('gone'));

    await expect(result).rejects.toThrow('gone');
    expect(test.value).toBe(0);
    expect(test.then.status).toBe('failed');
    expect(record(test)).toEqual([]);
  });

  it('will not count a suspended try as a retry', async () => {
    const pending = mockPromise();
    const retries: number[] = [];

    class Test extends Journal {
      async run() {
        this.flaky().catch(this.flaky);
      }

      protected async flaky() {
        retries.push(this.then.retry);

        if (retries.length == 1) throw pending;
        if (retries.length == 2) throw new Error('flaky');
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    pending.resolve();

    await result;
    expect(retries).toEqual([0, 0, 1]);
    expect(record(test).slice(1)).toEqual([
      { id: 'flaky#1', key: 'flaky', args: [], wrote: [], next: [], error: new Error('flaky') },
      { id: 'flaky#2', key: 'flaky', args: [{ name: 'Error', message: 'flaky' }], wrote: [], next: [], retry: 1 }
    ]);
  });

  it('will catch a rejected pending value', async () => {
    const pending = mockPromise();
    let tries = 0;

    class Test extends Journal {
      async run() {
        this.flaky().catch(this.flaky);
      }

      protected async flaky() {
        if (++tries == 1) throw pending;
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    pending.reject(new Error('gone'));

    await result;
    expect(tries).toBe(2);
    expect(record(test).slice(1).map(({ retry, error }) => [retry, error])).toEqual([[undefined, new Error('gone')], [1, undefined]]);
  });

  it('will not fire hooks again', async () => {
    const order: string[] = [];

    class Test extends Steps {
      price = set<number>();

      async run() {
        order.push(`run:${this.price}`);
      }

      before(key: string) {
        order.push(`before:${key}`);
      }

      after(key: string) {
        order.push(`after:${key}`);
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.price = 1;

    await result;
    expect(order).toEqual(['before:run', 'run:1', 'after:run']);
  });

  it('will abort when stopped while waiting', async () => {
    class Test extends Journal {
      price = set<number>();
      value = 0;

      async run() {
        this.value = 1;
        this.value = this.price;
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.stop();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(test.value).toBe(0);
    expect(test.then.status).toBe('stopped');
    expect(record(test)).toEqual([]);
  });

  it('will end without the step when ended while waiting', async () => {
    class Test extends Journal {
      price = set<number>();

      async run() {
        this.price;
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.end();

    expect(await result).toBeUndefined();
    expect(test.then.status).toBe('idle');
    expect(test.then.runs).toBe(1);
  });

  it('will abort a pending read after the step was stopped', async () => {
    const work = mockPromise();

    class Test extends Steps {
      price = set<number>();

      async run() {
        await work;
        this.price;
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.stop();
    work.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(test.then.error).toBeUndefined();
  });

  it('will fail a committed step reading a pending value', async () => {
    const pending = mockPromise();

    class Test extends Steps {
      async run() {
        this.then.commit();
        throw pending;
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toBe(pending);
    expect(test.then.error).toBe(pending);
  });

  it('will fail a hook reading a pending value after its step', async () => {
    class Test extends Steps {
      price = set<number>();

      async run() {}

      after() {
        this.price;
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toBeInstanceOf(Promise);
  });
});

describe('hooks', () => {
  it('will call hooks around each step', async () => {
    const order: unknown[][] = [];
    const wrote: string[][] = [];

    class Test extends Steps {
      value = 0;

      async run() {
        this.ship('a', 1);
      }

      protected async ship(id: string, n: number) {
        order.push(['ship', id, n]);
      }

      protected before(key: string, args: unknown[]) {
        this.value++;
        order.push(['before', key, args]);
      }

      protected after(key: string, entry: Steps.Entry) {
        order.push(['after', key, entry.id]);
        wrote.push(entry.wrote);
      }
    }

    const test = Test.new();

    await test.run();
    expect(order).toEqual([
      ['before', 'run', []],
      ['after', 'run', 'run#1'],
      ['before', 'ship', ['a', 1]],
      ['ship', 'a', 1],
      ['after', 'ship', 'ship#1']
    ]);
    expect(test.value).toBe(2);
    expect(wrote).toEqual([[], []]);
  });

  it('will not wrap hooks as steps', async () => {
    const before = vi.fn();

    class Test extends Steps {
      async run() {}

      before(step: string) {
        before(step);
      }

      beforeNext() {}
    }

    const test = Test.new();

    test.before('outside');
    expect(before).toHaveBeenCalledWith('outside');
    expect(test.beforeNext).toBeUndefined();
  });

  it('will fail when a hook throws', async () => {
    class Test extends Steps {
      async run() {}

      protected before() {
        throw new Error('hook');
      }
    }

    await expect(Test.new().run()).rejects.toThrow('hook');
  });

  it('will clean up in the tail on every outcome', async () => {
    const cleaned: string[] = [];

    class Test extends Steps {
      async run(outcome: 'done' | 'failed' | 'stopped') {
        this.work(outcome);

        try {
          await this;
        } finally {
          cleaned.push(outcome);
        }

        return outcome;
      }

      protected async work(outcome: string) {
        if (outcome == 'failed') throw new Error('boom');
        if (outcome == 'stopped') this.then.stop();
      }
    }

    const test = Test.new();

    expect(await test.run('done')).toBe('done');
    await expect(test.run('failed')).rejects.toThrow('boom');
    await expect(test.run('stopped')).rejects.toMatchObject({ name: 'Stopped' });
    expect(cleaned).toEqual(['done', 'failed', 'stopped']);
  });

  it('will compensate before the tail when a run fails', async () => {
    const order: string[] = [];

    class Test extends Steps {
      async run() {
        this.hold();

        try {
          await this;
        } catch (error) {
          order.push(`tail: ${(error as Error).message}`);
          throw error;
        }
      }

      protected async hold() {
        this.then.undo(() => void order.push('undo'));
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    await expect(Test.new().run()).rejects.toThrow('boom');
    expect(order).toEqual(['undo', 'tail: boom']);
  });

  it('will not stop a run while its tail is pending', async () => {
    const work = mockPromise();

    class Test extends Steps {
      async run() {
        await this;
        await work;

        return 'kept';
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.stop();
    work.resolve();

    expect(await result).toBe('kept');
    expect(test.then.status).toBe('idle');
  });

  it('will call an overridden hook once', async () => {
    const order: string[] = [];

    class Parent extends Steps {
      async run() {}

      protected after() {
        order.push('parent');
      }
    }

    class Child extends Parent {
      protected after() {
        order.push('child');
      }
    }

    await Child.new().run();
    expect(order).toEqual(['child']);
  });

});

describe('undo', () => {
  it('will run compensations newest first and restore every step', async () => {
    const order: string[] = [];

    class Test extends Journal {
      a = 0;
      b = 0;
      c = 0;

      async run() {
        this.zero();
      }

      zero() {
        this.a = 1;
        this.then.undo(() => void order.push(`undo zero a=${this.a}`));
        this.first();
      }

      first() {
        this.b = 2;
        this.then.undo(() => void order.push(`undo first b=${this.b}`));
        this.second();
      }

      second() {
        this.c = 3;
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(order).toEqual(['undo first b=2', 'undo zero a=1']);
    expect(test.get()).toMatchObject({ a: 0, b: 0, c: 0 });
    expect(record(test).map((entry) => [entry.key, entry.undo?.length, entry.unwound])).toEqual([
      ['run', undefined, undefined],
      ['zero', 1, true],
      ['first', 1, true]
    ]);
  });

  it('will restore a step without a compensation, not run', async () => {
    class Test extends Journal {
      kept = 0;
      value = 0;

      async run() {
        this.kept = 1;
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

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.get()).toMatchObject({ kept: 1, value: 0 });
    expect(record(test).map((entry) => [entry.id, entry.unwound])).toEqual([
      ['run#1', undefined],
      ['write#1', true]
    ]);
  });

  it('will not mark a step which wrote nothing unwound', async () => {
    class Test extends Journal {
      async run() {
        this.idle();
      }

      protected async idle() {
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(record(test)[1].unwound).toBeUndefined();
  });

  it('will not roll back writes of a helper', async () => {
    class Test extends Steps {
      value = 0;
      count = 0;

      async run() {
        this.zero();
      }

      zero() {
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

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.value).toBe(0);
    expect(test.count).toBe(2);
  });

  it('will unwind a branch which commits after another fails', async () => {
    const work = mockPromise();
    const undo = vi.fn();

    class Test extends Journal {
      value = 0;

      async run() {
        this.then(this.a(), this.b());
      }

      async a() {
        this.then.undo(undo);
        await work;
        this.value = 1;
      }

      b() {
        work.resolve();
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(undo).toHaveBeenCalledWith(new Error('boom'));
    expect(test.value).toBe(0);
    expect(record(test).map((entry) => [entry.key, entry.unwound])).toEqual([
      ['run', undefined],
      ['a', true]
    ]);
  });

  it('will run steps a compensation calls as part of the unwind', async () => {
    const undo = vi.fn();

    class Test extends Journal {
      async run() {
        this.first();
      }

      async first() {
        this.then.undo(() => {
          this.release('r1');
        });
        this.second();
      }

      second() {
        throw new Error('boom');
      }

      release(id: string) {
        undo(id);
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(undo).toHaveBeenCalledWith('r1');
    expect(record(test)[1].undo).toEqual([{ id: 'then#1', key: 'then', args: [] }]);
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'first#1', 'release#1']);
  });

  it('will run what a compensation\'s steps schedule, groups included, before older compensations', async () => {
    const order: string[] = [];

    class Test extends Steps {
      async run() {
        this.first();
      }

      async first() {
        this.then.undo(() => void order.push('first'));
        this.second();
      }

      async second() {
        this.then.undo(() => {
          this.refund();
        });
        this.fail();
      }

      async fail() {
        throw new Error('boom');
      }

      async refund() {
        order.push('refund');
        this.then(this.notify('a'), this.notify('b'));
        this.log();
      }

      async notify(to: string) {
        order.push(`notify ${to}`);
      }

      async log() {
        order.push('log');
      }
    }

    await expect(Test.new().run()).rejects.toThrow('boom');
    expect(order).toEqual(['refund', 'notify a', 'notify b', 'log', 'first']);
  });

  it('will fail the unwind when a step a compensation calls throws', async () => {
    class Test extends Journal {
      async run() {
        this.first();
      }

      async first() {
        this.then.undo(() => {
          this.refund();
        });
        this.fail();
      }

      async fail() {
        throw new Error('boom');
      }

      async refund() {
        throw new Error('refund failed');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('refund failed');
    expect(record(test)[1].unwound).toBe('failed');
  });

  it('will run compensations of one step newest first', async () => {
    const order: string[] = [];

    class Test extends Steps {
      async run() {
        this.first();
      }

      protected async first() {
        this.then.undo(() => void order.push('a'));
        this.then.undo(() => void order.push('b'));
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    await expect(Test.new().run()).rejects.toThrow('boom');
    expect(order).toEqual(['b', 'a']);
  });

  it('will compensate a step failing after it registered, on its own writes', async () => {
    const seen: number[] = [];

    class Test extends Journal {
      value = 0;
      other = 0;

      async run() {
        this.charge();
      }

      protected async charge() {
        this.then.undo(() => {
          seen.push(this.value);
          this.other = 5;
        });
        this.value = 1;
        this.other = 1;
        await Promise.resolve();
        throw new Error('declined');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('declined');
    expect(seen).toEqual([1]);
    expect(test.get()).toMatchObject({ value: 0, other: 5 });
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1']);
  });

  it('will restore a step failing while the run ends before compensating it', async () => {
    const work = mockPromise();
    const seen: number[] = [];

    class Test extends Steps {
      value = 0;

      async run() {
        this.charge();
      }

      protected async charge() {
        const { signal } = this.then;

        this.then.undo(() => void seen.push(this.value));
        this.value = 1;
        await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('late'))));
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.end();
    work.resolve();

    await expect(result).rejects.toThrow('late');
    expect(seen).toEqual([0]);
    expect(test.value).toBe(0);
  });

  it('will see the unwound state and keep what it writes', async () => {
    class Test extends Journal {
      value = 0;
      notice = '';

      async run() {
        this.first();
      }

      protected async first() {
        this.value = 1;
        this.notice = 'placed';
        this.then.undo((error) => {
          this.notice = `took back ${this.value}: ${(error as Error).message}`;
        });
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.get()).toMatchObject({ value: 0, notice: 'took back 1: boom' });
  });

  it('will stop unwinding where a compensation throws', async () => {
    const order: string[] = [];

    class Test extends Journal {
      async run() {
        this.first();
      }

      first() {
        this.then.undo(() => void order.push('undo first'));
        this.second();
      }

      second() {
        this.then.undo(() => {
          throw new Error('undo failed');
        });
        this.third();
      }

      third() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('undo failed');
    expect(order).toEqual([]);
    expect(record(test).map((entry) => entry.unwound)).toEqual([undefined, undefined, 'failed']);
  });

  it('will not plan an end, slot or wait in a compensation', async () => {
    class Test extends Steps {
      async run() {
        this.first();
      }

      first() {
        this.then.undo(() => {
          this.then.end();
        });
        this.second();
      }

      second() {
        throw new Error('boom');
      }
    }

    await expect(Test.new().run()).rejects.toThrow('end() cannot run in an undo.');
  });

  it('will throw for a compensation in run', async () => {
    class Test extends Steps {
      async run() {
        this.then.undo(() => {});
      }
    }

    await expect(Test.new().run()).rejects.toThrow('run cleans up in its tail - try/catch around await this.');
  });

  it('will throw for a compensation not a function', async () => {
    class Test extends Steps {
      async run() {
        this.first();
      }

      protected async first() {
        (this.then.undo as (handler: unknown) => void)('x');
      }
    }

    await expect(Test.new().run()).rejects.toThrow('then.undo() takes steps called for it - this.release(id) - or one function.');
  });

  it('will throw for a compensation once settled', async () => {
    let held: Steps.Controller | undefined;

    class Test extends Steps {
      async run() {
        this.first();
      }

      protected async first() {
        held = this.then;
        this.second();
      }

      protected async second() {
        held!.undo(() => {});
      }
    }

    await expect(Test.new().run()).rejects.toThrow('first has settled; undo cannot run.');
  });

});

describe('collections', () => {
  class Item extends Model {
    name = '';
  }

  it('will roll back list push, put, pop and set', async () => {
    class Test extends Journal {
      items = has(['a', 'b', 'c']);

      async run() {
        this.charge();
      }

      async charge() {
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

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.items.get()).toEqual(['a', 'b', 'c']);
    expect(record(test)).toEqual([expect.objectContaining({ id: 'run#1' }), expect.objectContaining({ wrote: ['items'], unwound: true })]);
  });

  it('will record nothing for a read without change', async () => {
    class Test extends Journal {
      items = has(['a']);
      count = 0;

      async run() {
        this.count = this.items.size;
      }
    }

    const test = Test.new();

    await test.run();
    expect(record(test)[0].wrote).toEqual(['count']);
  });

  it('will journal a changed collection by name, without values', async () => {
    class Test extends Journal {
      items = has(Item);

      async run(name: string) {
        this.items.add({ name });
      }
    }

    const test = Test.new();

    await test.run('a');
    await test.run('b');
    expect(record(test)).toEqual([{ id: 'run#1', key: 'run', args: ['b'], next: [], wrote: ['items'] }]);
  });

  it('will not capture writes outside a step proxy', async () => {
    class Test extends Journal {
      items = has<string>();

      async run() {
        this.is.items.push('a');
      }
    }

    const test = Test.new();

    await test.run();
    expect(record(test)[0].wrote).toEqual([]);
  });

  it('will restore a list before a retry', async () => {
    let tries = 0;

    class Test extends Journal {
      items = has<string>();

      async run() {
        this.push().catch(this.push);
      }

      protected async push() {
        this.items.push(`try ${++tries}`);

        if (tries < 2) throw new Error('flaky');
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.items.get()).toEqual(['try 2']);
    expect(record(test).map((entry) => entry.wrote)).toEqual([[], [], ['items']]);
  });

  it('will attribute a change only to the step making it', async () => {
    const gate = mockPromise();

    class Test extends Journal {
      items = has(['a']);

      async run() {
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
    const result = test.run();

    await flushMicrotasks();
    gate.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(test.items.get()).toEqual(['a']);
    expect(record(test).map((entry) => [entry.key, entry.wrote, entry.unwound])).toEqual([
      ['run', [], undefined],
      ['write', ['items'], true],
      ['read', [], undefined]
    ]);
  });

  it('will keep a sibling\'s pushes when a parallel step fails', async () => {
    const gate = mockPromise();

    class Test extends Steps {
      items = has<string>();

      async run() {
        this.then(this.good(), this.bad().catch());
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
    const result = test.run();

    await flushMicrotasks();
    expect(test.items.get()).toEqual(['good', 'bad']);

    gate.resolve();

    await result;
    expect(test.items.get()).toEqual(['good']);
  });

  it('will keep a sibling\'s pushes when a parallel step retries', async () => {
    let tries = 0;

    class Test extends Steps {
      items = has<string>();

      async run() {
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

    await test.run();
    expect(test.items.get()).toEqual(['steady', 'flaky 2']);
  });

  it('will undo only its own change around a sibling\'s', async () => {
    const gate = mockPromise();

    class Test extends Steps {
      items = has(['a', 'b']);

      async run() {
        this.then(this.bad().catch(), this.good());
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
    const result = test.run();

    await flushMicrotasks();
    expect(test.items.get()).toEqual(['first', 'z', 'b', 'x', 'y', 'last']);

    gate.resolve();

    await result;
    expect(test.items.get()).toEqual(['first', 'a', 'b', 'last']);
  });

  it('will skip an undo whose value a sibling removed', async () => {
    const gate = mockPromise();

    class Test extends Steps {
      items = has(['a']);

      async run() {
        this.then(this.bad().catch(), this.good());
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
    const result = test.run();

    await flushMicrotasks();
    gate.resolve();

    await result;
    expect(test.items.get()).toEqual(['kept']);
  });

  it('will undo the nearest of equal values', async () => {
    class Test extends Steps {
      items = has(['a', 'b', 'a', 'c', 'a']);

      async run() {
        this.items.put(2, 'a');
        this.items.clear();
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.items.get()).toEqual(['a', 'b', 'a', 'c', 'a']);
  });

  it('will record nothing for a list call changing nothing', async () => {
    class Test extends Journal {
      items = has(['a']);

      async run() {
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

    await test.run();
    expect(record(test)[0].wrote).toEqual(['items']);
    expect(test.items.size).toBe(0);
  });

  it('will fail a collection change after scheduling', async () => {
    class Test extends Steps {
      items = has(['a']);

      async run() {
        this.later();
        this.items.push('b');
      }

      protected async later() {}
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('run wrote items after scheduling later.');
    expect(test.items.get()).toEqual(['a']);
  });

  it('will not fail a collection call changing nothing after scheduling', async () => {
    class Test extends Steps {
      items = has<string>();

      async run() {
        this.later();
        this.items.pop();
      }

      protected async later() {}
    }

    const test = Test.new();

    await test.run();
    expect(test.then.status).toBe('idle');
  });

  it('will leave a change through a settled step\'s collection unmanaged', async () => {
    let items!: has.List<string>;

    class Test extends Journal {
      list = has<string>();

      async run() {
        items = this.list;
      }
    }

    const test = Test.new();

    await test.run();
    items.push('late');
    expect(test.list.get()).toEqual(['late']);
    expect(record(test)[0].wrote).toEqual([]);
  });

  it('will hand one wrapper per collection to a step', async () => {
    class Test extends Steps {
      items = has(['a']);
      same = false;

      async run() {
        this.same = this.items === this.items && this.items.get(0) === 'a' && this.items.size == 1;
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.same).toBe(true);
  });

  it('will restore the earliest snapshot of parallel steps', async () => {
    const first = mockPromise();
    const second = mockPromise();

    class Test extends Steps {
      items = has(['a']);

      async run() {
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
    const result = test.run();

    await flushMicrotasks();
    second.resolve();
    await flushMicrotasks();
    first.resolve();

    await expect(result).rejects.toThrow('boom');
    expect(test.items.get()).toEqual(['a']);
  });

  it('will roll back a map', async () => {
    class Test extends Journal {
      values = map([['a', 1], ['b', 2], ['c', 3]]);

      async run() {
        this.charge();
      }

      async charge() {
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

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.values.get()).toEqual(new Map([['a', 1], ['b', 2], ['c', 3]]));
  });

  it('will restore a guest Model removed from a map', async () => {
    const guest = Item.new({ name: 'guest' });

    class Test extends Journal {
      values = map<string, Item>([['a', guest]]);

      async run() {
        this.charge();
      }

      async charge() {
        this.values.delete('a');
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.values.get('a')).toBe(guest);
    expect(record(test)[1].irreversible).toBeUndefined();
  });

  it('will remove pool members added by a failed run', async () => {
    class Test extends Journal {
      items = has(Item);

      protected new() {
        this.items.add({ name: 'kept' });
      }

      async run() {
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

    await expect(test.run()).rejects.toThrow('boom');

    expect(record(test)[1]).toMatchObject({ wrote: ['items'], unwound: true });
    expect(test.items.map((item) => item.name)).toEqual(['kept']);
  });

  it('will destroy a member a failing step added', async () => {
    let added!: Item;

    class Test extends Steps {
      items = has(Item);

      async run() {
        added = this.items.add({ name: 'a' });
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.items.size).toBe(0);
    expect(added.get(null)).toBe(true);
  });

  it('will keep a sibling\'s map entries when a parallel step fails', async () => {
    const gate = mockPromise();

    class Test extends Steps {
      values = map<string, number>([['a', 1], ['b', 2]]);

      async run() {
        this.then(this.bad().catch(), this.good());
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
    const result = test.run();

    await flushMicrotasks();
    gate.resolve();

    await result;
    expect(test.values.get()).toEqual(new Map([['a', 1], ['n', 5], ['g', 1], ['b', 7]]));
  });

  it('will restore a cleared map', async () => {
    class Test extends Steps {
      values = map<string, number>([['a', 1], ['b', 2]]);
      empty = map<string, number>();

      async run() {
        this.values.clear();
        this.values.set('c', 3);
        this.values.set('c', 3);
        this.values.delete('x');
        this.empty.clear();
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.values.get()).toEqual(new Map([['a', 1], ['b', 2]]));
  });

  it('will remove a key it added and replaced', async () => {
    class Test extends Journal {
      values = map<string, Model>();
      plain = map<string, number>();

      async run() {
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

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.values.size).toBe(0);
    expect(test.plain.size).toBe(0);
    expect(record(test)).toEqual([]);
  });

  it('will keep a sibling\'s pool members when a parallel step fails', async () => {
    const gate = mockPromise();
    const kept = Item.new({ name: 'kept' });

    class Test extends Steps {
      items = has(Item);

      protected new() {
        this.items.add(kept);
      }

      async run() {
        this.then(this.bad().catch(), this.good());
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
    const result = test.run();

    await flushMicrotasks();
    gate.resolve();

    await result;
    expect(test.items.map((item) => item.name)).toEqual(['kept', 'good']);
  });

  it('will not be irreversible removing members it added', async () => {
    class Test extends Journal {
      items = has(Item);
      empty = has(Item);

      async run() {
        const item = this.items.add({ name: 'a' });

        this.items.delete(item);
        this.items.add({ name: 'b' });
        this.items.clear();
        this.empty.clear();
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.items.size).toBe(0);
    expect(record(test)).toEqual([]);
  });
});

describe('irreversible', () => {
  class Item extends Model {
    name = '';
  }

  it('will stop the unwind at a removed pool member', async () => {
    const warn = mockWarn();

    class Test extends Journal {
      items = has(Item);
      value = 0;

      protected new() {
        this.items.add({ name: 'a' });
      }

      async run() {
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

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.value).toBe(2);
    expect(test.then.error).toEqual(new Error('boom'));
    expect(record(test).map((entry) => [entry.key, entry.irreversible, entry.halted, entry.unwound])).toEqual([
      ['run', undefined, undefined, undefined],
      ['drop', ['items'], true, undefined]
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(`${test} stopped unwinding at drop#1: items cannot be restored.`);
  });

  it('will unwind steps after an irreversible one', async () => {
    mockWarn();

    class Test extends Journal {
      items = has(Item);
      value = 0;

      protected new() {
        this.items.add({ name: 'a' });
      }

      async run() {
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

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.value).toBe(0);
    expect(record(test).map((entry) => [entry.key, entry.unwound])).toEqual([
      ['run', undefined],
      ['drop', undefined],
      ['write', true]
    ]);
  });

  it('will be reversible with a compensation of its own', async () => {
    const undo = vi.fn();

    class Test extends Journal {
      items = has(Item);
      values = map((key: string) => new Item({ name: key }));

      protected new() {
        this.items.add({ name: 'a' });
        this.values.set('a');
        this.values.set('c');
      }

      async run() {
        this.charge();
      }

      async charge() {
        this.then.undo(undo);
        this.items.clear();
        this.values.delete('a');
        this.values.set('b');
        this.values.set('c');
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(undo).toHaveBeenCalledTimes(1);
    expect(test.items.size).toBe(0);
    expect([...test.values.keys()]).toEqual(['c']);
    expect(record(test)[1]).toMatchObject({ undo: [{ id: 'then#1', key: 'then', args: [] }], unwound: true });
    expect(record(test)[1].irreversible).toBeUndefined();
  });

  it('will be irreversible when a map evicts an owned value', async () => {
    mockWarn();

    class Test extends Journal {
      values = map<string, Item>();

      protected new() {
        this.values.set('a', new Item({ name: 'a' }));
      }

      async run() {
        this.values.set('a', new Item({ name: 'b' }));
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.values.get('a')!.name).toBe('b');
    expect(record(test)[0]).toMatchObject({ irreversible: ['values'], halted: true });
  });

  it('will not catch an irreversible step', async () => {
    const warn = mockWarn();

    const attempt = vi.fn();

    class Test extends Journal {
      items = has(Item);
      value = 0;

      protected new() {
        this.items.add({ name: 'a' });
      }

      async run() {
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

    await expect(test.run()).rejects.toThrow('boom');
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(test.value).toBe(1);
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1']);
    expect(warn).toHaveBeenCalledWith(`${test} stopped unwinding at drop#1: items cannot be restored.`);
  });

  it('will keep the writes of a failing irreversible step', async () => {
    const warn = mockWarn();

    class Test extends Journal {
      items = has(Item);
      value = 0;

      protected new() {
        this.items.add({ name: 'a' });
      }

      async run() {
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

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.value).toBe(2);
    expect(record(test).map((entry) => [entry.key, entry.halted, entry.unwound])).toEqual([['run', undefined, undefined]]);
    expect(warn).toHaveBeenCalledWith(`${test} stopped unwinding at drop#1: items cannot be restored.`);
  });
});

describe('commit', () => {
  it('will stop the unwind at a committed step', async () => {
    const warn = mockWarn();
    const refund = vi.fn();
    const recall = vi.fn();

    class Test extends Journal {
      charged = false;
      notified = false;

      async run() {
        this.pay();
      }

      protected async pay() {
        this.then.undo(refund);
        this.then.commit();
        this.charged = true;
        this.notify();
      }

      protected async notify() {
        this.notified = true;
        this.then.undo(recall);
        this.ship();
      }

      protected async ship() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(recall).toHaveBeenCalled();
    expect(refund).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(test.get()).toMatchObject({ charged: true, notified: false });
    expect(record(test).map((entry) => [entry.key, entry.committed, entry.halted, entry.unwound])).toEqual([
      ['run', undefined, undefined, undefined],
      ['pay', true, true, undefined],
      ['notify', undefined, undefined, true]
    ]);
  });

  it('will not catch or restore a step failing after commit', async () => {
    const attempt = vi.fn();

    class Test extends Journal {
      value = 0;

      async run() {
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

    await expect(test.run()).rejects.toThrow('boom');
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(test.value).toBe(1);
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1']);
  });

  it('will throw if commit is called outside a step', () => {
    class Test extends Steps {
    }

    expect(() => Test.new().then.commit()).toThrow('commit must be called inside a step.');
  });

  it('will throw if commit is called after its step settled', async () => {
    class Test extends Steps {
      async run() {
        this.then(this.reply, async () => {
          this.then.commit();
        });
      }

      reply() {}
    }

    await expect(Test.new().run()).rejects.toThrow('run has settled; commit cannot run.');
  });
});

describe('durable handlers', () => {
  it('will compensate with a step called for it, and keep working after', async () => {
    const released = vi.fn();

    class Test extends Journal {
      hold = '';

      async run() {
        this.reserve();
      }

      protected async reserve() {
        this.hold = 'h1';
        this.then.undo(this.release('h1'));
        await Promise.resolve();
        this.hold = 'h2';
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }

      protected async release(hold: string) {
        released(hold, this.hold);
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(released).toHaveBeenCalledWith('h1', 'h2');
    expect(test.hold).toBe('');
    expect(record(test)[1]).toMatchObject({ next: [{ key: 'fail' }], undo: [{ id: 'release#1', key: 'release', args: ['h1'] }] });
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'reserve#1', 'release#1']);
  });

  it('will run steps called for one compensation as a group', async () => {
    const order: string[] = [];

    class Test extends Journal {
      async run() {
        this.pay();
      }

      protected async pay() {
        this.then.undo(this.cancel('a'), this.refund('b'));
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }

      protected async cancel(id: string) {
        order.push(`cancel ${id}`);
        await Promise.resolve();
        order.push('cancelled');
      }

      protected async refund(id: string) {
        order.push(`refund ${id}`);
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(order).toEqual(['cancel a', 'refund b', 'cancelled']);
    expect(record(test)[1].undo).toMatchObject([{ key: 'then', group: [{ key: 'cancel' }, { key: 'refund' }] }]);
  });

  it('will give a step method its error, recorded durably', async () => {
    const seen = vi.fn();

    class Test extends Journal {
      async run() {
        this.pay().catch(this.note);
      }

      protected async pay() {
        throw new Error('boom', { cause: 'card' });
      }

      protected async note(error: unknown) {
        seen(error);
      }
    }

    const test = Test.new();

    await test.run();
    expect(seen).toHaveBeenCalledWith(new Error('boom'));
    expect(record(test)[0].next).toEqual([{ id: 'pay#1', key: 'pay', args: [], rescue: 'note' }]);
    expect(record(test).at(-1)).toMatchObject({ id: 'note#1', args: [{ name: 'Error', message: 'boom', cause: 'card' }] });
  });

  it('will run a function undo only on unwind, given the error', async () => {
    const undo = vi.fn();

    class Test extends Steps {
      async run(fail: boolean) {
        this.pay(fail);
      }

      protected async pay(fail: boolean) {
        this.then.undo(undo);

        if (fail) throw new Error('declined');
      }
    }

    const test = Test.new();

    await test.run(false);
    expect(undo).not.toHaveBeenCalled();

    await expect(test.run(true)).rejects.toThrow('declined');
    expect(undo).toHaveBeenCalledWith(new Error('declined'));
  });

  it('will record a thrown value that is not an Error as is', async () => {
    const seen = vi.fn();

    class Test extends Steps {
      async run() {
        this.scan().catch(this.skip);
      }

      protected async scan() {
        throw 'down';
      }

      protected async skip(error: unknown) {
        seen(error);
      }
    }

    await Test.new().run();
    expect(seen).toHaveBeenCalledWith('down');
  });

  it('will catch a plan with steps called for it, recorded on the token', async () => {
    const order: string[] = [];

    class Test extends Journal {
      async run() {
        this.then(this.scan('x')).catch(this.skip('x'));
        this.then(this.scan('y')).catch(this.notify('a'), this.notify('b'));
      }

      protected async scan(site: string) {
        throw new Error(`${site} is down`);
      }

      protected async notify(to: string) {
        order.push(`notify ${to}`);
      }

      protected async skip(site: string) {
        order.push(`skip ${site}`);
      }
    }

    const test = Test.new();

    await test.run();
    expect(order).toEqual(['skip x', 'notify a', 'notify b']);
    expect(record(test)[0].next).toMatchObject([
      { key: 'then', group: [{ key: 'scan', args: ['x'] }], rescue: [{ id: 'skip#1', key: 'skip', args: ['x'] }] },
      { key: 'then', group: [{ key: 'scan', args: ['y'] }], rescue: [{ key: 'then', group: [{ key: 'notify', args: ['a'] }, { key: 'notify', args: ['b'] }] }] }
    ]);
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'scan#1', 'skip#1', 'scan#2', 'notify#1', 'notify#2']);
  });

  it('will type steps called for a catch on a plan only', () => {
    class Test extends Steps {
      async run() {
        this.then(this.scan()).catch(this.skip());
        // @ts-expect-error - a step call's catch takes a function or a step method
        this.scan().catch(this.skip());
      }

      protected async scan() {}

      protected async skip() {}
    }

    void Test;
  });

  it('will keep a step scheduling after a handler claims its tokens', async () => {
    const order: string[] = [];

    class Test extends Steps {
      async run() {
        this.first();
      }

      protected async first() {
        this.second();
        this.then.undo(this.undo());
      }

      protected async second() {
        order.push('second');
      }

      protected async undo() {
        order.push('undo');
      }
    }

    await Test.new().run();
    expect(order).toEqual(['second']);
  });

  it('will count retries of steps a handler with parameters calls', async () => {
    const calls: unknown[][] = [];

    class Test extends Steps {
      async run() {
        this.visit('x');
      }

      protected async visit(site: string) {
        calls.push(['visit', this.then.retry]);

        if (this.then.retry < 2)
          this.scan(site).catch((error) => {
            calls.push([(error as Error).message]);
            this.visit(site);
          });
      }

      protected async scan(site: string) {
        throw new Error(`${site} is down`);
      }
    }

    await Test.new().run();
    expect(calls).toEqual([['visit', 0], ['x is down'], ['visit', 1], ['x is down'], ['visit', 2]]);
  });

  it('will throw for undo or catch steps not called for it', async () => {
    const errors: unknown[] = [];

    class Test extends Steps {
      async run() {
        this.first();
      }

      protected async first() {
        const tries = [
          () => this.then.undo(this.a(), (() => {}) as never),
          () => this.then.undo(this.then.slot() as never),
          () => this.then.undo(),
          () => this.then.undo({} as never),
          () => this.then.undo(this.a as never),
          () => this.then(this.a()).catch(this.a(), (() => {}) as never),
          () => this.then(this.a()).catch({} as never, {} as never)
        ];

        for (const attempt of tries)
          try {
            attempt();
          } catch (error) {
            errors.push((error as Error).message);
          }
      }

      protected async a() {}
    }

    await Test.new().run().catch(() => {});

    const usage = 'then.undo() takes steps called for it - this.release(id) - or one function.';

    expect(errors).toEqual([
      'then() takes called steps or step references, not both.',
      usage,
      usage,
      usage,
      usage,
      'then() takes called steps or step references, not both.',
      'catch() takes a step, a function, steps called for it or nothing.'
    ]);
  });
});

describe('recover', () => {
  class NoCourier extends Error {}

  it('will recover where a typed failure is caught', async () => {
    const refund = vi.fn();
    const release = vi.fn();

    class Test extends Journal {
      hold = '';
      charge = '';
      notice = '';

      async run() {
        this.reserve();
      }

      protected async reserve() {
        this.hold = 'h1';
        this.then.undo(release);
        this.pay().catch(this.recover);
      }

      protected async recover(error: unknown) {
        if (!(error instanceof NoCourier)) throw error;

        this.notice = 'backordered';
        this.backorder();
      }

      protected async pay() {
        this.charge = 'c1';
        this.then.undo(refund);
        this.ship();
      }

      protected async ship() {
        throw new NoCourier('no courier');
      }

      protected async backorder() {}
    }

    const test = Test.new();

    await test.run();
    expect(refund).toHaveBeenCalledWith(new NoCourier('no courier'));
    expect(release).not.toHaveBeenCalled();
    expect(test.get()).toMatchObject({ hold: 'h1', charge: '', notice: 'backordered' });
    expect(record(test).map((entry) => [entry.id, entry.unwound, (entry.error as Error)?.message])).toEqual([
      ['run#1', undefined, undefined],
      ['reserve#1', undefined, undefined],
      ['pay#1', true, undefined],
      ['ship#1', undefined, 'no courier'],
      ['recover#1', undefined, undefined],
      ['backorder#1', undefined, undefined]
    ]);
  });

  it('will run a handler on the failed state and restore before what it schedules', async () => {
    const seen: number[] = [];

    class Test extends Steps {
      value = 0;

      async run() {
        this.first().catch(this.handle);
      }

      protected async first() {
        this.value = 1;
        this.second();
      }

      protected async second() {
        throw new Error('boom');
      }

      protected async handle() {
        seen.push(this.value);
        this.next();
      }

      protected async next() {
        seen.push(this.value);
      }
    }

    await Test.new().run();
    expect(seen).toEqual([1, 0]);
  });

  it('will keep keys a handler writes', async () => {
    class Test extends Steps {
      value = 0;
      other = 0;

      async run() {
        this.first().catch(this.handle);
      }

      protected async first() {
        this.value = 1;
        this.other = 1;
        this.second();
      }

      protected async second() {
        throw new Error('boom');
      }

      protected async handle() {
        this.value = 5;
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.get()).toMatchObject({ value: 5, other: 0 });
  });

  it('will restore the branch on reset, keeping writes after it', async () => {
    const seen: number[] = [];

    class Test extends Steps {
      value = 0;
      other = 0;

      async run() {
        this.first().catch(this.handle);
      }

      protected async first() {
        this.value = 1;
        this.other = 1;
        this.second();
      }

      protected async second() {
        throw new Error('boom');
      }

      protected async handle() {
        this.value = 7;
        this.then.reset();
        seen.push(this.value, this.other);
        this.other = 9;
      }
    }

    const test = Test.new();

    await test.run();
    expect(seen).toEqual([0, 0]);
    expect(test.get()).toMatchObject({ value: 0, other: 9 });
  });

  it('will restore collections a handler leaves alone', async () => {
    class Test extends Steps {
      items = has<string>();
      kept = has<string>();

      async run() {
        this.first().catch(this.handle);
      }

      protected async first() {
        this.items.push('a');
        this.kept.push('b');
        this.second();
      }

      protected async second() {
        throw new Error('boom');
      }

      protected async handle() {
        this.kept.push('c');
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.items.get()).toEqual([]);
    expect(test.kept.get()).toEqual(['b', 'c']);
  });

  it('will reset collections too', async () => {
    class Test extends Steps {
      items = has<string>();

      async run() {
        this.first().catch(this.handle);
      }

      protected async first() {
        this.items.push('a');
        this.second();
      }

      protected async second() {
        throw new Error('boom');
      }

      protected async handle() {
        this.items.push('b');
        this.then.reset();
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.items.get()).toEqual(['b']);
  });

  it('will restore what a handler wrote to before the branch when unwound again', async () => {
    class Test extends Steps {
      value = 0;

      async run() {
        this.outer().catch();
      }

      protected async outer() {
        this.inner().catch(this.handle);
      }

      protected async inner() {
        this.value = 1;
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }

      protected async handle() {
        this.value = 2;
        this.later();
      }

      protected async later() {
        throw new Error('again');
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.value).toBe(0);
  });

  it('will restore the branch when a handler fails', async () => {
    class Test extends Steps {
      value = 0;

      async run() {
        this.first().catch(this.handle);
      }

      protected async first() {
        this.value = 1;
        this.second();
      }

      protected async second() {
        throw new Error('boom');
      }

      protected async handle(error: unknown) {
        this.value = 2;
        throw error;
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('boom');
    expect(test.value).toBe(0);
  });

  it('will throw for reset outside a handler', async () => {
    class Test extends Steps {
      async run() {
        this.first();
      }

      protected async first() {
        this.then.reset();
      }
    }

    await expect(Test.new().run()).rejects.toThrow('reset() must be called in a .catch handler.');
  });

  it('will abort and compensate parallel steps a caught failure discards', async () => {
    const mailed = mockPromise();
    const signals: AbortSignal[] = [];
    const recall = vi.fn();
    const unnotify = vi.fn();

    class Test extends Journal {
      async run() {
        this.pay().catch();
      }

      async pay() {
        this.then(this.ship(), this.receipt(), this.notify());
      }

      async ship() {
        await Promise.resolve();
        throw new Error('no courier');
      }

      async receipt() {
        this.then.undo(recall);
        signals.push(this.then.signal);
        await mailed;
      }

      async notify() {
        const { signal } = this.then;

        this.then.undo(unnotify);
        await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
      }
    }

    const test = Test.new();
    const result = test.run();

    await vi.waitFor(() => expect(signals[0]?.aborted).toBe(true));
    mailed.resolve();

    await result;
    expect(recall).toHaveBeenCalledWith(new Error('no courier'));
    expect(unnotify).toHaveBeenCalledWith(new Error('no courier'));
    expect(record(test).map((entry) => [entry.id, entry.unwound])).toEqual([
      ['run#1', undefined],
      ['pay#1', undefined],
      ['ship#1', undefined],
      ['receipt#1', true]
    ]);
  });

  it('will release a wait opened by a step a caught failure discards', async () => {
    class Test extends Journal {
      async run() {
        this.then(this.ask(), this.cancel()).catch();
      }

      ask() {
        this.then(this.answer);
      }

      async cancel() {
        await Promise.resolve();
        throw new Error('cancel');
      }

      answer() {}
    }

    const test = Test.new();

    await test.run();
    expect(test.answer).toBeUndefined();
    expect(record(test).map((entry) => entry.id)).toEqual(['run#1', 'ask#1', 'cancel#1']);
  });

  it('will halt at a committed step and continue the run', async () => {
    const refund = vi.fn();
    const recall = vi.fn();

    class Test extends Journal {
      async run() {
        this.pay().catch();
      }

      async pay() {
        this.then.undo(refund);
        this.then.commit();
        this.notify();
      }

      async notify() {
        this.then.undo(recall);
        this.ship();
      }

      async ship() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await test.run();
    expect(recall).toHaveBeenCalledTimes(1);
    expect(refund).not.toHaveBeenCalled();
    expect(record(test).map((entry) => [entry.id, entry.halted, entry.unwound])).toEqual([
      ['run#1', undefined, undefined],
      ['pay#1', true, undefined],
      ['notify#1', undefined, true],
      ['ship#1', undefined, undefined]
    ]);
  });

  it('will halt at an irreversible step and continue the run', async () => {
    const warn = mockWarn();

    class Item extends Model {}

    class Test extends Journal {
      items = has(Item);

      protected new() {
        this.items.add({});
      }

      async run() {
        this.drop().catch();
      }

      async drop() {
        this.items.clear();
        this.first();
      }

      async first() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await test.run();
    expect(test.then.status).toBe('idle');
    expect(warn).toHaveBeenCalledWith(`${test} stopped unwinding at drop#1: items cannot be restored.`);
    expect(record(test).map((entry) => [entry.id, entry.halted])).toEqual([
      ['run#1', undefined],
      ['drop#1', true],
      ['first#1', undefined]
    ]);
  });

  it('will wait for an outside call to retry', async () => {
    const refund = vi.fn();

    class Test extends Journal {
      card = '';
      tracking = '';

      async run() {
        this.pay('card1').catch(this.declined);
      }

      async pay(card: string) {
        this.card = card;
        this.then.undo(() => refund(card));
        this.ship();
      }

      async ship() {
        if (this.card == 'card1') throw new Error('declined');

        this.tracking = `trk_${this.card}`;
      }

      protected declined() {
        this.then(this.pay);
      }
    }

    const test = Test.new();
    const result = test.run();

    await vi.waitFor(() => expect(test.pay).toBeDefined());
    expect(refund).toHaveBeenCalledWith('card1');
    expect(test.card).toBe('');
    expect(test.then.waiting).toEqual([{ id: 'wait#1', step: 'declined', args: [{ name: 'Error', message: 'declined' }], answers: ['pay'] }]);

    await test.pay('card2');
    await result;

    expect(test.get()).toEqual({ card: 'card2', tracking: 'trk_card2' });
    expect(record(test).map((entry) => [entry.id, entry.wake, entry.unwound])).toEqual([
      ['run#1', undefined, undefined],
      ['pay#1', undefined, true],
      ['ship#1', undefined, undefined],
      ['declined#1', undefined, undefined],
      ['pay#2', 'wait#1', undefined],
      ['ship#2', undefined, undefined]
    ]);
  });

  it('will not compensate a step twice when a handler rethrows', async () => {
    const undo = vi.fn();

    class Test extends Steps {
      async run() {
        this.outer().catch(this.rethrow);
      }

      protected async outer() {
        this.then.undo(undo);
        this.inner();
      }

      protected async inner() {
        throw new Error('boom');
      }

      protected async rethrow(error: unknown) {
        throw error;
      }
    }

    await expect(Test.new().run()).rejects.toThrow('boom');
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('will unwind parallel caught branches one at a time', async () => {
    const order: string[] = [];

    class Test extends Steps {
      async run() {
        this.then(this.side('l').catch(), this.side('r').catch());
      }

      protected async side(name: string) {
        this.then.undo(async () => {
          order.push(`${name} start`);
          await Promise.resolve();
          await Promise.resolve();
          order.push(`${name} end`);
        });
        await Promise.resolve();
        throw new Error(name);
      }
    }

    await Test.new().run();
    expect(order).toEqual(['l start', 'l end', 'r start', 'r end']);
  });

  it('will fail when a caught branch\'s compensation throws and stop the run\'s unwind there', async () => {
    const undo = vi.fn();

    class Test extends Journal {
      async run() {
        this.first();
      }

      async first() {
        this.then.undo(undo);
        this.second().catch();
      }

      async second() {
        this.then.undo(() => {
          throw new Error('undo');
        });
        this.third();
      }

      async third() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('undo');
    expect(undo).not.toHaveBeenCalled();
    expect(record(test).map((entry) => [entry.id, entry.unwound])).toEqual([
      ['run#1', undefined],
      ['first#1', undefined],
      ['second#1', 'failed'],
      ['third#1', undefined]
    ]);
  });

  it('will stop unwinding between compensations when stopped', async () => {
    const refunded = mockPromise();
    const undo = vi.fn();

    class Test extends Journal {
      async run() {
        this.zero().catch();
      }

      async zero() {
        this.then.undo(undo);
        this.first();
      }

      async first() {
        this.then.undo(() => refunded);
        this.second();
      }

      async second() {
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = test.run();

    await vi.waitFor(() => expect(record(test).at(-1)?.id).toBe('second#1'));
    test.then.stop();
    refunded.resolve();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(undo).not.toHaveBeenCalled();
    expect(record(test).map((entry) => [entry.id, entry.unwound])).toEqual([
      ['run#1', undefined],
      ['zero#1', undefined],
      ['first#1', true],
      ['second#1', undefined]
    ]);
  });

  it('will stop unwinding when ended from outside', async () => {
    const work = mockPromise();
    const undo = vi.fn();

    class Test extends Journal {
      async run() {
        this.first().catch();
      }

      async first() {
        this.then.undo(undo);
        this.then(this.slow(), this.quick());
      }

      async slow() {
        await work;
      }

      async quick() {
        await Promise.resolve();
        throw new Error('boom');
      }
    }

    const test = Test.new();
    const result = test.run();

    await vi.waitFor(() => expect(record(test).at(-1)?.id).toBe('quick#1'));
    test.then.end();
    work.resolve();

    await result;
    expect(test.then.status).toBe('idle');
    expect(undo).not.toHaveBeenCalled();
  });

  it('will not leave an answer promise rejecting unhandled', async () => {
    const caught = mockUncaught();

    class Test extends Steps {
      async run() {
        this.then(this.abort);
      }

      abort() {
        throw new Error('abort');
      }
    }

    const test = Test.new();
    const result = test.run();

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

    class Test extends Journal {
      value = 0;

      async run() {
        attempt();
        this.value = 1;
        await aborted(this.then.signal);
        this.later();
      }

      later() {}
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.stop();

    await expect(result).rejects.toMatchObject({ name: 'Stopped' });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(test.value).toBe(0);
    expect(test.then.status).toBe('stopped');
    expect(test.then.error).toBeUndefined();
    expect(record(test)).toEqual([]);
  });

  it('will abort the signal of a step in flight on an outside end', async () => {
    class Test extends Journal {
      value = 0;

      async run() {
        this.slow();
      }

      async slow() {
        this.value = 1;
        await aborted(this.then.signal);
      }
    }

    const test = Test.new();
    const result = test.run();

    await flushMicrotasks();
    test.then.end();

    await result;
    expect(test.value).toBe(0);
    expect(record(test).map((entry) => entry.key)).toEqual(['run', 'end']);
  });

  it('will abort the signal of a step in flight when another fails', async () => {
    let signal!: AbortSignal;

    class Test extends Steps {
      async run() {
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

    await expect(test.run()).rejects.toThrow('boom');
    expect(signal.aborted).toBe(true);
    expect(test.then.error).toEqual(new Error('boom'));
  });

  it('will abort the signal once its step settles', async () => {
    const seen: boolean[] = [];
    let signal!: AbortSignal;

    class Test extends Steps {
      async run() {
        signal = this.then.signal;
        seen.push(signal.aborted);
        this.second();
      }

      async second() {
        seen.push(signal.aborted, this.then.signal === signal);
      }
    }

    await Test.new().run();
    expect(seen).toEqual([false, true, false]);
  });

  it('will throw if signal is read outside a step', () => {
    class Test extends Steps {
    }

    expect(() => Test.new().then.signal).toThrow('signal must be read inside a step.');
  });
});

describe('failures', () => {
  it('will reject when a step throws synchronously', async () => {
    class Test extends Steps {
      async run() {
        throw new Error('sync');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('sync');
    expect(test.then.status).toBe('failed');
    expect(test.then.error).toEqual(new Error('sync'));
  });

  it('will reject when a step rejects and discard what it scheduled', async () => {
    const called = vi.fn();

    class Test extends Steps {
      async run() {
        this.second();
        throw new Error('after scheduling');
      }

      second() {
        called();
      }
    }

    await expect(Test.new().run()).rejects.toThrow('after scheduling');
    expect(called).not.toHaveBeenCalled();
  });

  it('will reject when a step returns a value', async () => {
    class Test extends Steps {
      async run() {
        this.first();
      }

      async first() {
        return 1 as unknown as void;
      }
    }

    await expect(Test.new().run()).rejects.toThrow('first returned a value; a step returns nothing - its undo is this.then.undo(...).');
  });

  it('will reject when a step writes after scheduling', async () => {
    class Test extends Steps {
      value = 0;

      async run() {
        this.first();
        this.value = 1;
      }

      first() {}
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('run wrote value after scheduling first.');
    expect(test.value).toBe(0);
  });

  it('will not guard writes of a helper after scheduling', async () => {
    class Test extends Journal {
      value = 0;

      async run() {
        this.first();
        this._set();
      }

      _set() {
        this.value = 1;
      }

      first() {}
    }

    const test = Test.new();

    await test.run();

    expect(test.value).toBe(1);
    expect(record(test)[0].wrote).toEqual([]);
  });

  it('will reject when a step keeps working after scheduling', async () => {
    class Test extends Steps {
      async run() {
        this.second();
        await flushMicrotasks();
      }

      second() {}
    }

    await expect(Test.new().run()).rejects.toThrow('run kept working after scheduling second.');
  });

  it('will throw if a step is called after its caller settled', async () => {
    let late: () => unknown = () => {};

    class Test extends Steps {
      async run() {
        late = () => this.second();
      }

      second() {}
    }

    await Test.new().run();
    expect(late).toThrow('run has settled; second cannot run.');
  });

  it('will throw if a settled step schedules through then', async () => {
    let late: () => unknown = () => {};

    class Test extends Steps {
      async run() {
        late = () => this.then.end();
      }
    }

    await Test.new().run();
    expect(late).toThrow('run has settled; end cannot run.');
  });

  it('will throw uncaught when nobody awaits a failed run', async () => {
    const caught = mockUncaught();

    class Test extends Steps {
      protected new() {
        this.run();
      }

      async run() {
        throw new Error('nobody listening');
      }
    }

    Test.new();
    await flushMicrotasks();

    expect(caught).toEqual([new Error('nobody listening')]);
  });

  it('will not throw uncaught when awaited before the rethrow', async () => {
    const caught = mockUncaught();

    class Test extends Steps {
      async run() {
        throw new Error('late listener');
      }
    }

    const result = Test.new().run();

    await Promise.resolve();
    await expect(result).rejects.toThrow('late listener');
    await flushMicrotasks();

    expect(caught).toEqual([]);
  });

  it('will not throw uncaught when run() is awaited', async () => {
    const caught = mockUncaught();
    let error: unknown;

    class Test extends Steps {
      async run() {
        throw new Error('awaited');
      }
    }

    try {
      await Test.new().run();
    } catch (e) {
      error = e;
    }

    await flushMicrotasks();

    expect(error).toEqual(new Error('awaited'));
    expect(caught).toEqual([]);
  });

  it('will not throw uncaught when stopped', async () => {
    const caught = mockUncaught();

    class Test extends Steps {
      async run() {
        this.then.stop();
      }
    }

    Test.new().run();
    await flushMicrotasks();

    expect(caught).toEqual([]);
  });

  it('will keep a list field through a run', async () => {
    class Test extends Steps {
      items = has<string>();

      async run(item: string) {
        this.items.push(item);
      }
    }

    const test = Test.new();

    await test.run('a');
    await test.run('b');
    expect([...test.items]).toEqual(['a', 'b']);
  });
});

describe('Steps', () => {
  it('will run and type the result from run', async () => {
    class Test extends Journal {
      value = 0;

      async run(n: number) {
        this.value = n;

        await this;

        return { n: this.value };
      }
    }

    const test = Test.new();
    const result = await test.run(2);

    expectTypeOf(test.then).toEqualTypeOf<Steps.Runner<Test>>();
    expectTypeOf(test.then.status).toEqualTypeOf<Steps.Status>();
    expectTypeOf<Awaited<Test>>().toEqualTypeOf<{ n: number }>();
    expect(result).toEqual({ n: 2 });
    expect(test.then.on).toBe(test);
    expect(record(test).map((entry) => entry.key)).toEqual(['run']);
  });

  it('will type the result as void when run returns nothing', async () => {
    class Test extends Steps {
      value = 1;

      async run() {}
    }

    const result = await Test.new();

    expectTypeOf(result).toEqualTypeOf<void>();
    expect(result).toBeUndefined();
  });

  it('will allow run to narrow its parameters', async () => {
    class Test extends Steps {
      prompt = '';

      async run(prompt: string) {
        this.prompt = prompt;
      }
    }

    const test = Test.new();

    expectTypeOf(test.run).parameters.toEqualTypeOf<[prompt: string]>();
    await test.run('hi');
    expect(test.prompt).toBe('hi');
  });

  it('will collect steps through intermediate classes', async () => {
    class B extends Journal {
      async run() {
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

    await test.run();
    expect(record(test).map((entry) => entry.key)).toEqual(['run', 'first', 'second', 'third']);
  });

  it('will not define hooks on the prototype', () => {
    const own = Object.getOwnPropertyNames(Steps.prototype);

    expect(own).toEqual(['constructor']);
  });

  it('will call hooks declared by override', async () => {
    const order: unknown[] = [];

    class Test extends Steps {
      async run() {
        this.fail();
      }

      protected async fail() {
        throw new Error('boom');
      }

      protected override before(step: string) {
        order.push(['before', step]);
      }

      protected override after(step: string, entry: Steps.Entry) {
        order.push(['after', step, entry.id]);
      }
    }

    await expect(Test.new().run()).rejects.toThrow('boom');
    expect(order).toEqual([
      ['before', 'run'],
      ['after', 'run', 'run#1'],
      ['before', 'fail']
    ]);
  });

  it('will throw if end is given a value', async () => {
    class Test extends Steps {
      async run() {
        // @ts-expect-error - end takes no value
        this.then.end('x');
      }
    }

    const test = Test.new();

    await expect(test.run()).rejects.toThrow('end() takes no value; the result is what run returns.');
    // @ts-expect-error - end takes no value
    expect(() => test.then.end('x')).toThrow('end() takes no value; the result is what run returns.');
  });

  it('will require run to be async', () => {
    class Test extends Steps {
      // @ts-expect-error - run returns a Promise
      run() {
        return 1;
      }
    }

    void Test;
  });

  it('will check hooks by declaration', () => {
    class Test extends Steps {
      async run() {}

      // @ts-expect-error
      protected override before(step: number) {
        void step;
      }

      // @ts-expect-error
      protected override after(step: string, entry: Steps.Entry, more: number) {
        void step, entry, more;
      }

      // @ts-expect-error
      protected override bakc() {}
    }

    expect(Test.new().then.status).toBe('idle');
  });
});
