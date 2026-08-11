import { describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, mockError } from '../test.setup';
import { watch } from './observable';
import { enqueue, presenting, schedule } from './dispatch';
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

  it('will transition immediate and queued work', async () => {
    const log: string[] = [];

    schedule(() => {
      log.push('work');
      enqueue(() => log.push('dispatch'));
    }, transition(log));

    expect(log).toEqual([
      'transition:start',
      'work',
      'transition:end'
    ]);

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

  it('will preserve priority through nested and cascading work', async () => {
    const log: string[] = [];
    const host = transition(log);

    schedule(() => {
      schedule(() => enqueue(() => {
        log.push('first');
        enqueue(() => log.push('second'));
      }), host);
    }, host);

    expect(log).toEqual(['transition:start', 'transition:end']);

    await flushMicrotasks();

    expect(log).toEqual([
      'transition:start',
      'transition:end',
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
      'transition:start',
      'transition:end',
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

  it('will settle when a subscriber presents its replay', async () => {
    const bracket = (work: () => void) => work();
    const log: string[] = [];

    let present!: () => void;

    schedule(() => {
      enqueue(() => {
        log.push('dispatch');
        present = presenting()!;
      });
    }, bracket).then(() => log.push('settled'));

    await flushMicrotasks();

    expect(log).toEqual(['dispatch']);

    present();
    await flushMicrotasks();

    expect(log).toEqual(['dispatch', 'settled']);
  });

  it('will settle on replay where no subscriber claims presentation', async () => {
    const bracket = (work: () => void) => work();
    let settled = false;

    schedule(() => enqueue(() => {}), bracket).then(() => (settled = true));

    await flushMicrotasks();

    expect(settled).toBe(true);
  });

  it('will ignore a claim released more than once', async () => {
    const bracket = (work: () => void) => work();
    let present!: () => void;
    let settled = 0;

    schedule(() => enqueue(() => {
      present = presenting()!;
    }), bracket).then(() => settled++);

    await flushMicrotasks();

    present();
    present();
    await flushMicrotasks();

    expect(settled).toBe(1);
  });

  it('will wait on every claim a single replay makes', async () => {
    const bracket = (work: () => void) => work();
    const held: (() => void)[] = [];
    let settled = false;

    schedule(() => enqueue(() => {
      held.push(presenting()!, presenting()!);
    }), bracket).then(() => (settled = true));

    await flushMicrotasks();

    held[0]();
    await flushMicrotasks();

    expect(settled).toBe(false);

    held[1]();
    await flushMicrotasks();

    expect(settled).toBe(true);
  });

  it('will settle a second transition when its own replay is presented', async () => {
    const bracket = (work: () => void) => work();
    const handler = () => {
      present = presenting()!;
    };

    let present!: () => void;
    const done: string[] = [];

    schedule(() => enqueue(handler), bracket).then(() => done.push('first'));
    schedule(() => enqueue(handler), bracket).then(() => done.push('second'));

    await flushMicrotasks();

    expect(done).toEqual([]);

    present();
    await flushMicrotasks();

    expect(done).toEqual(['first', 'second']);
  });

  it('will await updates cascading from a replay', async () => {
    const bracket = (work: () => void) => work();
    const log: string[] = [];
    const held: (() => void)[] = [];

    schedule(() => enqueue(() => {
      log.push('source');
      held.push(presenting()!);
      enqueue(() => {
        log.push('derived');
        held.push(presenting()!);
      });
    }), bracket).then(() => log.push('settled'));

    await flushMicrotasks();

    expect(log).toEqual(['source', 'derived']);
    expect(held.length).toBe(2);

    held[0]();
    await flushMicrotasks();

    expect(log).toEqual(['source', 'derived']);

    held[1]();
    await flushMicrotasks();

    expect(log).toEqual(['source', 'derived', 'settled']);
  });

  it('will release every claim on a handler urgency strips', async () => {
    const bracket = (work: () => void) => work();
    const handler = () => {};
    const settled: string[] = [];

    schedule(() => enqueue(handler), bracket).then(() => settled.push('first'));
    schedule(() => enqueue(handler), bracket).then(() => settled.push('second'));
    enqueue(handler);

    await flushMicrotasks();

    expect(settled).toEqual(['first', 'second']);
  });
});
