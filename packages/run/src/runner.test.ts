import { State } from '@expressive/mvc';
import { describe, expect, it, vi } from 'vitest';

import { flushMicrotasks, mockPromise, mockUncaught } from '../test.setup';
import { Runner } from './runner';

describe('steps', () => {
  it('will hand off through steps to done', async () => {
    const order: string[] = [];

    class Test extends Runner {
      new(seed: number) {
        order.push(`new:${seed}`);
        this.first(seed + 1);
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

    const run = Test.new(1);

    expect(run).toBeInstanceOf(State);
    expect(order).toEqual(['new:1']);
    expect(await run).toBe(30);
    expect(order).toEqual(['new:1', 'first:2', 'second:3', 'done:3']);
  });

  it('will invoke the next step only after the current one settles', async () => {
    const work = mockPromise();
    const second = vi.fn();

    class Test extends Runner {
      new() {
        this.first();
      }

      async first() {
        this.second();
        await work;
      }

      second() {
        second();
        this.done();
      }
    }

    const run = Test.new();

    await flushMicrotasks();
    expect(second).not.toHaveBeenCalled();

    work.resolve();
    await run;
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('will resolve with the argument when done returns nothing', async () => {
    class Test extends Runner {
      new() {
        this.done('value');
      }

      done(value: string) {
        void value;
      }
    }

    expect(await Test.new()).toBe('value');
  });

  it('will resolve with public values when done is not declared', async () => {
    class Test extends Runner {
      count = 0;

      new() {
        this.count = 1;
        this.done();
      }
    }

    expect(await Test.new()).toEqual({ count: 1 });
  });

  it('will accept writes from outside', async () => {
    class Test extends Runner {
      mode = 'ask';

      new() {
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

    const run = Test.new();

    run.mode = 'yolo';
    await expect(run).toHaveUpdated('mode');

    expect(await run).toBe('yolo');

    run.mode = 'ask';
    await expect(run).toHaveUpdated('mode');
  });

  it('will type run arguments from new', () => {
    class Test extends Runner {
      new(a: number, b: string) {
        void [a, b];
        this.done();
      }
    }

    // @ts-expect-error
    Test.new('a', 1);
    Test.new(1, 'b');
  });

  it('will type the result from done', async () => {
    class Test extends Runner {
      new() {
        this.done(1);
      }

      done(n: number) {
        return { n };
      }
    }

    const result: { n: number } = await Test.new();

    expect(result).toEqual({ n: 1 });
  });
});

describe('failures', () => {
  it('will reject when a step throws synchronously', async () => {
    class Test extends Runner {
      new() {
        throw new Error('sync');
      }
    }

    await expect(Test.new()).rejects.toThrow('sync');
  });

  it('will reject when a step rejects', async () => {
    const next = vi.fn();

    class Test extends Runner {
      new() {
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

    await expect(Test.new()).rejects.toThrow('after handoff');
    expect(next).not.toHaveBeenCalled();
  });

  it('will reject when a step settles without handing off', async () => {
    class Test extends Runner {
      new() {
        this.first();
      }

      async first() {}
    }

    await expect(Test.new()).rejects.toThrow('first settled without handing off.');
  });

  it('will reject when a step writes after handing off', async () => {
    class Test extends Runner {
      value = 0;

      new() {
        this.first();
      }

      async first() {
        this.done();
        this.value = 1;
      }
    }

    await expect(Test.new()).rejects.toThrow('first wrote value after handing off to done.');
  });

  it('will throw if a step hands off twice', async () => {
    class Test extends Runner {
      new() {
        this.first();
        this.second();
      }

      first() {}
      second() {}
    }

    await expect(Test.new()).rejects.toThrow('new already handed off to first; cannot call second.');
  });

  it('will throw if a step is called after the run is done', async () => {
    class Test extends Runner {
      new() {
        this.done();
      }

      again() {}
    }

    const run = Test.new();

    await run;
    expect(() => run.again()).toThrow(`${run} is done; again cannot run.`);
    expect(() => run.done()).toThrow(`${run} is done; done cannot run.`);

    run.set(null);
  });

  it('will throw if a class declares then', () => {
    class Test extends Runner {
      then() {}
    }

    expect(() => Test.new()).toThrow('Test declares then, which belongs to Runner.');
  });

  it('will throw uncaught when nobody awaits a failed run', async () => {
    const caught = mockUncaught();

    class Test extends Runner {
      new() {
        throw new Error('nobody listening');
      }
    }

    Test.new();
    await flushMicrotasks();

    expect(caught).toEqual([new Error('nobody listening')]);
  });
});
