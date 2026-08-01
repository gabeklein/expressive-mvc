import { describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, mockError } from '../test.setup';
import { watch } from './observable';
import { enqueue, schedule } from './dispatch';
import { State } from './state';

describe('dispatch', () => {
  const error = mockError();

  function transition(log: string[]) {
    return (work: () => void) => {
      log.push('transition:start');
      work();
      log.push('transition:end');
    };
  }

  it('will only transition queued work', async () => {
    const log: string[] = [];

    schedule(() => {
      log.push('work');
      enqueue(() => log.push('dispatch'));
    }, transition(log));

    expect(log).toEqual(['work']);

    await flushMicrotasks();

    expect(log).toEqual([
      'work',
      'transition:start',
      'dispatch',
      'transition:end'
    ]);
  });

  it('will preserve priority through nested and cascading work', async () => {
    const log: string[] = [];
    const host = transition(log);

    schedule(() => {
      schedule(() => enqueue(() => {
        log.push('first');
        enqueue(() => log.push('second'));
      }), host);
    }, host);

    expect(log).toEqual([]);

    await flushMicrotasks();

    expect(log).toEqual([
      'transition:start',
      'first',
      'transition:end',
      'transition:start',
      'second',
      'transition:end'
    ]);
  });

  it('will let urgent priority win for one handler', async () => {
    const log: string[] = [];
    const mixed = () => log.push('mixed');

    schedule(() => {
      enqueue(mixed);
      enqueue(() => log.push('deferred'));
    }, transition(log));
    enqueue(mixed);

    await flushMicrotasks();

    expect(log).toEqual([
      'mixed',
      'transition:start',
      'deferred',
      'transition:end'
    ]);
  });

  it('will only upgrade inseparable watchers to urgent', async () => {
    class Model extends State {
      deferred = 0;
      urgent = 0;
    }

    const model = Model.new();
    const priorities: string[] = [];
    let transitioning = false;
    const host = (work: () => void) => {
      transitioning = true;
      work();
      transitioning = false;
    };

    watch(model, ({ deferred }) => {
      if (deferred) priorities.push(`deferred:${transitioning}`);
    });
    watch(model, ({ deferred, urgent }) => {
      if (deferred || urgent) priorities.push(`mixed:${transitioning}`);
    });

    schedule(() => void (model.deferred = 1), host);
    model.urgent = 1;

    await flushMicrotasks();

    expect(priorities).toEqual(['deferred:true', 'mixed:false']);
  });

  it('will squash final state and transition cascading watchers', async () => {
    class Model extends State {
      source = 0;
      derived = 0;
    }

    const model = Model.new();
    const values: string[] = [];
    let transitioning = false;
    const host = (work: () => void) => {
      transitioning = true;
      work();
      transitioning = false;
    };

    watch(model, ({ source }) => void (model.derived = source * 2));
    watch(model, ({ derived }) => {
      if (derived) values.push(`${derived}:${transitioning}`);
    });

    schedule(() => {
      model.source = 1;
      model.source = 2;
    }, host);

    await flushMicrotasks();

    expect(values).toEqual(['4:true']);
  });

  it('will squash stacked handlers and continue after errors', async () => {
    const after = vi.fn();
    const expected = new Error('failed');
    const fail = () => {
      throw expected;
    };

    enqueue(fail);
    enqueue(fail);
    enqueue(after);

    await flushMicrotasks();

    expect(error).toHaveBeenCalledWith(expected);
    expect(after).toHaveBeenCalledOnce();
  });
});
