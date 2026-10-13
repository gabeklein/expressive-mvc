import { State } from '@expressive/mvc';
import { describe, expect, it, vi } from 'vitest';

import { flushMicrotasks, mockPromise, mockUncaught } from '../test.setup';
import { run, Runner } from './run';

describe('steps', () => {
  it('will hand off through steps to done', async () => {
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

    expect(test.run).toBeInstanceOf(Runner);
    expect(order).toEqual(['new:1']);
    expect(await test.run).toBe(30);
    expect(order).toEqual(['new:1', 'first:2', 'second:3', 'done:3']);
    expect(test.run.entries).toEqual([
      { key: 'new', args: [], patch: {}, next: 'first' },
      { key: 'first', args: [2], patch: {}, next: 'second' },
      { key: 'second', args: [3], patch: {}, next: 'done' },
      { key: 'done', args: [3], patch: {}, next: undefined }
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
        this.second();
        await work;
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

  it('will record a patch of what each step wrote', async () => {
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
        this.run.done();
      }
    }

    const test = Test.new();

    await test.run;
    expect(test.run.entries.map((entry) => entry.patch)).toEqual([{ a: 1 }, { b: 'x', a: 2 }, {}]);
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

  it('will run helpers inline and blame their writes on the step', async () => {
    class Test extends State {
      run = run(this);
      value = 0;

      protected new() {
        this.first();
      }

      first() {
        this.value = this._double(2);
        this.run.done();
      }

      _double(n: number) {
        return n * 2;
      }
    }

    const test = Test.new();

    expect(await test.run).toEqual({ value: 4 });
    expect(test.run.entries[1].patch).toEqual({ value: 4 });
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

  it('will reject when a step rejects', async () => {
    const next = vi.fn();

    class Test extends State {
      run = run(this);

      protected new() {
        this.first();
      }

      async first() {
        this.second();
        throw new Error('after handoff');
      }

      second() {
        next();
      }
    }

    await expect(Test.new().run).rejects.toThrow('after handoff');
    expect(next).not.toHaveBeenCalled();
  });

  it('will reject when a step settles without handing off', async () => {
    class Test extends State {
      run = run(this);

      protected new() {
        this.first();
      }

      async first() {}
    }

    await expect(Test.new().run).rejects.toThrow('first settled without handing off.');
  });

  it('will reject when a step writes after handing off', async () => {
    class Test extends State {
      run = run(this);
      value = 0;

      protected new() {
        this.run.done();
        this.value = 1;
      }
    }

    await expect(Test.new().run).rejects.toThrow('new wrote value after handing off to done.');
  });

  it('will reject if a step hands off twice', async () => {
    class Test extends State {
      run = run(this);

      protected new() {
        this.first();
        this.second();
      }

      first() {}
      second() {}
    }

    await expect(Test.new().run).rejects.toThrow('new already handed off to first; cannot call second.');
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
        this.run.done();
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
});
