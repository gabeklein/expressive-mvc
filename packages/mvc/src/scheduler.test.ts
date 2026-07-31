import { describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, mockError } from '../test.setup';
import { State } from './state';
import { watch } from './observable';
import { enqueue, schedule } from './scheduler';

describe('scheduler', () => {
  const error = mockError();

  function transition(log: string[]) {
    return (work: () => void) => {
      log.push('transition:start');
      work();
      log.push('transition:end');
    };
  }

  it('will run work inline without a host transition', () => {
    const work = vi.fn();

    schedule(work);

    expect(work).toHaveBeenCalledOnce();
  });

  it('will flush dispatch inline without a host transition', async () => {
    const work = vi.fn();

    schedule(() => enqueue(work));
    await flushMicrotasks();

    expect(work).toHaveBeenCalledOnce();
  });

  it('will replay transitional dispatch through the host', async () => {
    const log: string[] = [];
    const host = transition(log);

    schedule(() => {
      log.push('work');
      enqueue(() => log.push('dispatch'));
    }, host);

    expect(log).toEqual(['transition:start', 'work', 'transition:end']);

    await flushMicrotasks();

    expect(log).toEqual([
      'transition:start',
      'work',
      'transition:end',
      'transition:start',
      'dispatch',
      'transition:end'
    ]);
  });

  it('will squash stacked transitional dispatch', async () => {
    const log: string[] = [];
    const host = transition(log);
    const dispatch = vi.fn();

    schedule(() => {
      enqueue(dispatch);
      enqueue(dispatch);
    }, host);

    await flushMicrotasks();

    expect(dispatch).toHaveBeenCalledOnce();
  });

  it('will carry transition priority through cascading dispatch', async () => {
    const log: string[] = [];
    const host = transition(log);
    const second = () => log.push('second');
    const first = () => {
      log.push('first');
      enqueue(second);
    };

    schedule(() => enqueue(first), host);

    await flushMicrotasks();

    expect(log.slice(2)).toEqual([
      'transition:start',
      'first',
      'transition:end',
      'transition:start',
      'second',
      'transition:end'
    ]);
  });

  it('will preserve transition priority through nesting', async () => {
    const log: string[] = [];
    const host = transition(log);
    const dispatch = () => log.push('dispatch');

    schedule(() => {
      schedule(() => enqueue(dispatch), host);
    }, host);

    await flushMicrotasks();

    expect(log).toEqual([
      'transition:start',
      'transition:start',
      'transition:end',
      'transition:end',
      'transition:start',
      'dispatch',
      'transition:end'
    ]);
  });

  it('will let urgent priority win for one handler', async () => {
    const log: string[] = [];
    const host = transition(log);
    const mixed = () => log.push('mixed');
    const deferred = () => log.push('deferred');

    schedule(() => {
      enqueue(mixed);
      enqueue(deferred);
    }, host);
    enqueue(mixed);

    await flushMicrotasks();

    expect(log).toEqual([
      'transition:start',
      'transition:end',
      'mixed',
      'transition:start',
      'deferred',
      'transition:end'
    ]);
  });

  it('will report dispatch errors and continue', async () => {
    const after = vi.fn();
    const expected = new Error('failed');

    enqueue(() => {
      throw expected;
    });
    enqueue(after);

    await flushMicrotasks();

    expect(error).toHaveBeenCalledWith(expected);
    expect(after).toHaveBeenCalledOnce();
  });

  it('will squash stacked model writes under one priority', async () => {
    class Model extends State {
      value = 0;
    }

    const model = Model.new();
    const values: number[] = [];
    const host = vi.fn((work: () => void) => work());

    watch(model, ({ value }) => {
      values.push(value);
    });

    schedule(() => {
      model.value = 1;
      model.value = 2;
    }, host);

    expect(model.value).toBe(2);

    await flushMicrotasks();

    expect(values).toEqual([0, 2]);
    expect(host).toHaveBeenCalledTimes(3);
  });

  it('will carry priority through cascading model writes', async () => {
    class Model extends State {
      source = 0;
      derived = 0;
    }

    const model = Model.new();
    const values: number[] = [];
    const host = vi.fn((work: () => void) => work());

    watch(model, ({ source }) => {
      model.derived = source * 2;
    });
    watch(model, ({ derived }) => {
      values.push(derived);
    });

    schedule(() => {
      model.source = 2;
    }, host);

    await flushMicrotasks();

    expect(values).toEqual([0, 4]);
    expect(host).toHaveBeenCalledTimes(5);
  });

  it('will only upgrade inseparable model watchers to urgent', async () => {
    class Model extends State {
      deferred = 0;
      urgent = 0;
    }

    const model = Model.new();
    const priority: string[] = [];
    let transitioning = false;
    const host = (work: () => void) => {
      transitioning = true;
      work();
      transitioning = false;
    };

    watch(model, ({ deferred }) => {
      if (deferred) priority.push(`deferred:${transitioning}`);
    });
    watch(model, ({ deferred, urgent }) => {
      if (deferred || urgent) priority.push(`mixed:${transitioning}`);
    });

    schedule(() => {
      model.deferred = 1;
    }, host);
    model.urgent = 1;

    await flushMicrotasks();

    expect(priority).toEqual(['deferred:true', 'mixed:false']);
  });
});
