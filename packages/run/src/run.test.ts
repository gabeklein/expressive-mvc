import { set, State } from '@expressive/mvc';
import { describe, expect, it, vi } from 'vitest';

import { flushMicrotasks, mockPromise, mockUncaught } from '../test.setup';
import { run } from './run';

describe('steps', () => {
  it('will schedule steps through to done', async () => {
    const order: string[] = [];

    class Test extends State {
      run = run(this);
      seed = 0;

      protected new() {
        order.push(`new:${this.seed}`);
        this.first(this.seed + 1);
      }

      async first(n: number) {
        order.push(`first:${n}`);
        this.second(n + 1);
      }

      second(n: number) {
        order.push(`second:${n}`);
        this.done(n);
      }

      done(n: number) {
        order.push(`done:${n}`);
        return n * 10;
      }
    }

    const test = Test.new({ seed: 1 });

    expect(test.run.on).toBe(test);
    expect(order).toEqual(['new:1']);
    expect(await test.run).toBe(30);
    expect(order).toEqual(['new:1', 'first:2', 'second:3', 'done:3']);
    expect(test.run.entries).toEqual([
      { id: 'new#1', key: 'new', args: [], prior: {}, patch: {}, next: [{ id: 'first#1', key: 'first', args: [2], after: [] }] },
      { id: 'first#1', key: 'first', args: [2], prior: {}, patch: {}, next: [{ id: 'second#1', key: 'second', args: [3], after: [] }] },
      { id: 'second#1', key: 'second', args: [3], prior: {}, patch: {}, next: [{ id: 'done#1', key: 'done', args: [3], after: [] }] },
      { id: 'done#1', key: 'done', args: [3], prior: {}, patch: {}, next: [] }
    ]);
  });

  it('will not touch the prototype', () => {
    class Test extends State {
      run = run(this);

      protected new() {
        this.run.done();
      }
    }

    Test.new();

    const before = Object.getOwnPropertyDescriptor(Test.prototype, 'new');
    const test = Test.new();
    const own = Object.getOwnPropertyDescriptor(test, 'new')!;

    expect(Object.getOwnPropertyDescriptor(Test.prototype, 'new')).toEqual(before);
    expect(own.enumerable).toBe(false);
    expect(Object.keys(test)).not.toContain('new');
  });

  it('will invoke the next step only after the current one settles', async () => {
    const work = mockPromise();
    const second = vi.fn();

    class Test extends State {
      run = run(this);

      protected new() {
        this.first();
      }

      async first() {
        await work;
        this.second();
      }

      second() {
        second();
        this.run.done();
      }
    }

    const test = Test.new();

    await flushMicrotasks();
    expect(second).not.toHaveBeenCalled();
    expect(test.run.step).toBe('first');

    work.resolve();
    await test.run;
    expect(second).toHaveBeenCalledTimes(1);
    expect(test.run.step).toBe('');
  });

  it('will fork steps scheduled together, in order', async () => {
    const order: string[] = [];

    class Test extends State {
      run = run(this);

      protected new() {
        this.a();
        this.b();
        this.c();
      }

      async a() {
        order.push('a');
        await flushMicrotasks();
        order.push('a!');
      }

      b() {
        order.push('b');
      }

      c() {
        order.push('c');
      }
    }

    const test = Test.new();

    await test.run;
    expect(order).toEqual(['a', 'a!', 'b', 'c']);
    expect(test.run.entries[0].next.map((node) => node.after)).toEqual([[], [], []]);
  });

  it('will sequence steps awaited one after another', async () => {
    const order: string[] = [];

    class Test extends State {
      run = run(this);

      protected async new() {
        await this.a();
        await this.b();
        this.c();
      }

      a() {
        order.push('a');
      }

      b() {
        order.push('b');
      }

      c() {
        order.push('c');
      }
    }

    const test = Test.new();

    await test.run;
    expect(order).toEqual(['a', 'b', 'c']);
    expect(test.run.entries[0].next.map((node) => node.after)).toEqual([[], ['a#1'], ['a#1', 'b#1']]);
  });

  it('will join forked steps with Promise.all', async () => {
    class Test extends State {
      run = run(this);

      protected async new() {
        await Promise.all([this.a(), this.b()]);
        this.c();
      }

      a() {}
      b() {}
      c() {}
    }

    const test = Test.new();

    await test.run;
    expect(test.run.entries[0].next.map((node) => node.after)).toEqual([[], [], ['a#1', 'b#1']]);
  });

  it('will run done after everything else scheduled', async () => {
    const order: string[] = [];

    class Test extends State {
      run = run(this);

      protected new() {
        this.done();
        this.a();
      }

      async a() {
        order.push('a');
        this.b();
      }

      b() {
        order.push('b');
      }

      done() {
        order.push('done');
      }
    }

    await Test.new().run;
    expect(order).toEqual(['a', 'b', 'done']);
  });

  it('will end when nothing is left to run', async () => {
    class Test extends State {
      run = run(this);
      count = 0;

      protected new() {
        this.a();
      }

      a() {
        this.count = 1;
      }
    }

    const test = Test.new();

    expect(await test.run).toEqual({ count: 1 });
    expect(test.run.status).toBe('done');
  });

  it('will record prior and patch of what each step wrote', async () => {
    class Test extends State {
      run = run(this);
      a = 0;
      b = '';

      protected new() {
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

    await test.run;
    expect(test.run.entries.map(({ prior, patch }) => [prior, patch])).toEqual([
      [{ a: 0 }, { a: 1 }],
      [{ b: '', a: 1 }, { b: 'x', a: 3 }]
    ]);
  });

  it('will bind State methods to the instance', async () => {
    let values: Record<string, unknown> | undefined;

    class Test extends State {
      run = run(this);
      value = 1;

      protected new() {
        values = this.get();
        this.done();
      }

      done() {
        return String(this);
      }
    }

    const test = Test.new();

    expect(await test.run).toBe(String(test));
    expect(values).toMatchObject({ value: 1 });
  });

  it('will resolve with the argument when done returns nothing', async () => {
    class Test extends State {
      run = run(this);

      protected new() {
        this.done('value');
      }

      done(value: string) {
        void value;
      }
    }

    expect(await Test.new().run).toBe('value');
  });

  it('will resolve with public values when done is not declared', async () => {
    class Test extends State {
      run = run(this);
      count = 0;

      protected new() {
        this.count = 1;
        this.run.done();
      }
    }

    expect(await Test.new().run).toEqual({ count: 1 });
  });

  it('will end from the controller with a value', async () => {
    class Test extends State {
      run = run(this);

      protected new() {
        this.first();
      }

      async first() {
        this.run.done('early');
      }

      done(value: string) {
        void value;
      }
    }

    expect(await Test.new().run).toBe('early');
  });

  it('will accept writes from outside', async () => {
    class Test extends State {
      run = run(this);
      mode = 'ask';

      protected new() {
        this.first();
      }

      async first() {
        await flushMicrotasks();
        this.done(this.mode);
      }

      done(mode: string) {
        void mode;
      }
    }

    const test = Test.new();

    test.mode = 'yolo';
    await expect(test).toHaveUpdated('mode');

    expect(await test.run).toBe('yolo');
    expect(test.run.entries.map((entry) => entry.patch)).toEqual([{}, {}, {}]);
  });

  it('will run helpers with the step as this', async () => {
    class Test extends State {
      run = run(this);
      value = 0;
      label = '';

      protected new() {
        this.first();
      }

      first() {
        this.value = this._double(2);
      }

      _double(n: number) {
        this.label = 'doubled';
        return n * 2;
      }
    }

    const test = Test.new();

    test._double(1);

    expect(await test.run).toEqual({ value: 4, label: 'doubled' });
    expect(test.run.entries[1].patch).toEqual({ label: 'doubled', value: 4 });
  });

  it('will pass function fields through', async () => {
    const fn = () => 1;
    let seen: unknown;

    class Test extends State {
      run = run(this);
      fn = fn;

      protected new() {
        seen = this.fn;
      }
    }

    await Test.new().run;
    expect(seen).toBe(fn);
  });

  it('will be observed through the instance', async () => {
    const seen: string[] = [];

    class Test extends State {
      run = run(this);

      protected new() {
        this.first();
      }

      async first() {
        await flushMicrotasks();
      }
    }

    const test = Test.new();

    test.get((self) => void seen.push(`${self.run.status}:${self.run.step}`));
    await test.run;
    await flushMicrotasks();

    expect(seen).toEqual(['running:new', 'running:first', 'done:']);
    expect(test.run.get()).toMatchObject({ status: 'done', step: '', error: undefined });
    expect(test.get().run).toBe(test.run);
    expect(test.get().run.status).toBe('done');
  });

  it('will type the result from done', async () => {
    class Test extends State {
      run = run(this);

      protected new() {
        this.done(1);
      }

      done(n: number) {
        return { n };
      }
    }

    const result: { n: number } = await Test.new().run;

    expect(result).toEqual({ n: 1 });
  });
});

describe('then', () => {
  it('will await the instance when the field is then', async () => {
    class Test extends State {
      then = run(this);

      protected new() {
        this.first();
      }

      first() {
        this.then.done('x');
      }
    }

    const test = Test.new();

    expect(test.then.on).toBe(test);
    expect(await test).toBe('x');
    expect(await Promise.resolve(test)).toBe('x');
    expect(test.then.status).toBe('done');
  });

  it('will type the result from done through the instance', async () => {
    class Test extends State {
      then = run(this);

      protected new() {
        this.done(1);
      }

      done(n: number) {
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

      protected new() {
        this.first();
      }

      async first() {
        await flushMicrotasks();
      }
    }

    const test = Test.new();

    test.get((self) => {
      view = self.then;
      seen.push(self.then.status);
    });

    expect(typeof view).toBe('object');
    expect(seen).toEqual(['running']);

    await test;
    await flushMicrotasks();

    expect(seen).toEqual(['running', 'done']);
  });

  it('will resolve a set factory to the result', async () => {
    class Test extends State {
      then = run(this);

      protected new() {
        this.then.done('x');
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

      protected new() {}
    }

    const test = Test.new();

    expect(Object.keys(test)).toContain('then');
    expect(test.get().then).toBe(test.then);
    expect(await test).toEqual({ count: 1 });
  });
});

describe('undo', () => {
  it('will unwind closures in reverse and restore fields', async () => {
    const order: string[] = [];

    class Test extends State {
      run = run(this);
      a = 0;
      b = 0;

      protected new() {
        this.first();
      }

      first() {
        this.a = 1;
        this.second();
        return () => void order.push(`undo first a=${this.a}`);
      }

      second() {
        this.b = 2;
        this.third();
        return () => void order.push(`undo second b=${this.b}`);
      }

      third() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run).rejects.toThrow('boom');
    expect(order).toEqual(['undo second b=2', 'undo first a=1']);
    expect(test.a).toBe(0);
    expect(test.b).toBe(0);
    expect(test.run.entries.map((entry) => [entry.key, entry.undo, entry.undone])).toEqual([
      ['new', undefined, undefined],
      ['first', 'closure', true],
      ['second', 'closure', true]
    ]);
  });

  it('will unwind through a returned step', async () => {
    const undo = vi.fn();

    class Test extends State {
      run = run(this);

      protected new() {
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

    await expect(test.run).rejects.toThrow('boom');
    expect(undo).toHaveBeenCalledWith('r1');
    expect(test.run.entries[1].undo).toEqual({ id: 'release#1', key: 'release', args: ['r1'], after: [] });
    expect(test.run.entries[1].next.map((node) => node.key)).toEqual(['second']);
  });

  it('will stop unwinding where an undo throws', async () => {
    const order: string[] = [];

    class Test extends State {
      run = run(this);

      protected new() {
        this.first();
      }

      first() {
        this.second();
        return () => void order.push('undo first');
      }

      second() {
        this.third();
        return () => {
          throw new Error('undo failed');
        };
      }

      third() {
        throw new Error('boom');
      }
    }

    const test = Test.new();

    await expect(test.run).rejects.toThrow('undo failed');
    expect(order).toEqual([]);
    expect(test.run.entries.map((entry) => entry.undone)).toEqual([undefined, undefined, 'failed']);
  });

  it('will throw if an undo schedules a step', async () => {
    class Test extends State {
      run = run(this);

      protected new() {
        this.first();
      }

      first() {
        this.second();
        return () => this.first();
      }

      second() {
        throw new Error('boom');
      }
    }

    await expect(Test.new().run).rejects.toThrow(/is failed; first cannot run/);
  });
});

describe('failures', () => {
  it('will reject when a step throws synchronously', async () => {
    class Test extends State {
      run = run(this);

      protected new() {
        throw new Error('sync');
      }
    }

    const test = Test.new();

    await expect(test.run).rejects.toThrow('sync');
    expect(test.run.status).toBe('failed');
    expect(test.run.error).toEqual(new Error('sync'));
  });

  it('will reject when a step rejects and discard what it scheduled', async () => {
    const next = vi.fn();

    class Test extends State {
      run = run(this);

      protected new() {
        this.first();
      }

      async first() {
        this.second();
        throw new Error('after scheduling');
      }

      second() {
        next();
      }
    }

    await expect(Test.new().run).rejects.toThrow('after scheduling');
    expect(next).not.toHaveBeenCalled();
  });

  it('will reject when a step returns a value', async () => {
    class Test extends State {
      run = run(this);

      protected new() {
        this.first();
      }

      async first() {
        return 1 as unknown as void;
      }
    }

    await expect(Test.new().run).rejects.toThrow('first returned a value; a step returns nothing, or its undo.');
  });

  it('will reject when a step writes after scheduling', async () => {
    class Test extends State {
      run = run(this);
      value = 0;

      protected new() {
        this.first();
        this.value = 1;
      }

      first() {}
    }

    await expect(Test.new().run).rejects.toThrow('new wrote value after scheduling first.');
  });

  it('will reject when a helper writes after scheduling', async () => {
    class Test extends State {
      run = run(this);
      value = 0;

      protected new() {
        this.first();
        this._set();
      }

      _set() {
        this.value = 1;
      }

      first() {}
    }

    await expect(Test.new().run).rejects.toThrow('new wrote value after scheduling first.');
  });

  it('will reject when a step keeps working after scheduling', async () => {
    class Test extends State {
      run = run(this);

      protected new() {
        this.first();
      }

      async first() {
        this.second();
        await flushMicrotasks();
      }

      second() {}
    }

    await expect(Test.new().run).rejects.toThrow('first kept working after scheduling second.');
  });

  it('will reject when a step waits on a returned undo', async () => {
    class Test extends State {
      run = run(this);

      protected async new() {
        const release = this.release();

        await release;
        this.second();

        return release;
      }

      release() {}
      second() {}
    }

    await expect(Test.new().run).rejects.toThrow('second waits on release#1, which was returned as an undo.');
  });

  it('will reject when done is scheduled twice', async () => {
    class Test extends State {
      run = run(this);

      protected new() {
        this.done();
        this.run.done();
      }

      done() {}
    }

    await expect(Test.new().run).rejects.toThrow('done was scheduled twice.');
  });

  it('will reject when done schedules a step', async () => {
    class Test extends State {
      run = run(this);

      protected new() {
        this.done();
      }

      done() {
        this.more();
      }

      more() {}
    }

    await expect(Test.new().run).rejects.toThrow('done cannot schedule more.');
  });

  it('will throw if a step is called from outside while one runs', async () => {
    const work = mockPromise();

    class Test extends State {
      run = run(this);

      protected new() {
        this.first();
      }

      async first() {
        await work;
      }

      second() {}
    }

    const test = Test.new();

    await flushMicrotasks();
    expect(() => test.second()).toThrow('first is running; second cannot be called from outside.');

    work.resolve();
    await test.run;
  });

  it('will throw if a step is called after the run is done', async () => {
    class Test extends State {
      run = run(this);

      protected new() {
        this.run.done();
      }

      again() {}
    }

    const test = Test.new();

    await test.run;
    expect(() => test.again()).toThrow(`${test} is done; again cannot run.`);
    expect(() => test.run.done()).toThrow(`${test} is done; done cannot run.`);

    test.set(null);
  });

  it('will throw uncaught when nobody awaits a failed run', async () => {
    const caught = mockUncaught();

    class Test extends State {
      run = run(this);

      protected new() {
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
      run = run(this);

      protected new() {
        throw new Error('late listener');
      }
    }

    const test = Test.new();

    await Promise.resolve();
    await expect(test.run).rejects.toThrow('late listener');
    await flushMicrotasks();

    expect(caught).toEqual([]);
  });
});
