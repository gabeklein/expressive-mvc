import { describe, expect, it, vi } from 'vitest';

import { flushMicrotasks, mockError, mockPromise } from '../test.setup';
import { watch } from './observable';
import { enqueue, hold, pending } from './dispatch';
import { State } from './state';

describe('dispatch', () => {
  const error = mockError();

  function scheduler(log: string[], name = 'transition') {
    return (work: () => void) => {
      log.push(`${name}:start`);
      work();
      log.push(`${name}:end`);
    };
  }

  it('will replay queued work through the subscriber own scheduler', async () => {
    const log: string[] = [];

    pending(() => {
      log.push('work');
      enqueue(() => log.push('dispatch'), scheduler(log));
    });

    expect(log).toEqual(['work']);

    await flushMicrotasks();

    expect(log).toEqual([
      'work',
      'transition:start',
      'dispatch',
      'transition:end'
    ]);
  });

  it('will replay each subscriber through its own', async () => {
    const log: string[] = [];

    pending(() => {
      enqueue(() => log.push('a'), scheduler(log, 'a'));
      enqueue(() => log.push('b'), scheduler(log, 'b'));
    });

    await flushMicrotasks();

    expect(log).toEqual([
      'a:start', 'a', 'a:end',
      'b:start', 'b', 'b:end'
    ]);
  });

  it('will not bracket a subscriber with no scheduler', async () => {
    const log: string[] = [];

    pending(() => enqueue(() => log.push('dispatch')));

    await flushMicrotasks();

    expect(log).toEqual(['dispatch']);
  });

  it('will not bracket work queued on its own', async () => {
    const log: string[] = [];

    enqueue(() => log.push('dispatch'), scheduler(log));

    await flushMicrotasks();

    expect(log).toEqual(['dispatch']);
  });

  it('will preserve priority through cascading work', async () => {
    const log: string[] = [];
    const host = scheduler(log);

    pending(() => enqueue(() => {
      log.push('first');
      enqueue(() => log.push('second'), host);
    }, host));

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

  it('will settle nested work independently inside the outer call', async () => {
    const done: string[] = [];
    let releaseOuter!: () => void;
    let releaseInner!: () => void;

    pending(() => {
      enqueue(() => {
        releaseOuter = pending()!;
      });
      pending(() => {
        enqueue(() => {
          releaseInner = pending()!;
        });
      }).then(() => done.push('inner'));
    }).then(() => done.push('outer'));

    await flushMicrotasks();
    expect(done).toEqual([]);

    releaseInner();
    await flushMicrotasks();
    expect(done).toEqual(['inner']);

    releaseOuter();
    await flushMicrotasks();
    expect(done).toEqual(['inner', 'outer']);
  });

  it('will include nested consequences in the outer settlement', async () => {
    const done: string[] = [];
    let release!: () => void;

    pending(() => {
      pending(() => enqueue(() => {
        release = pending()!;
      })).then(() => done.push('inner'));
    }).then(() => done.push('outer'));

    await flushMicrotasks();
    expect(done).toEqual([]);

    release();
    await flushMicrotasks();

    expect(done).toEqual(['outer', 'inner']);
  });

  it('will let nested work settle the replay holding its outer call', async () => {
    let settled = false;

    pending(() => enqueue(() => {
      const release = pending()!;
      pending(() => {}).then(release);
    })).then(() => (settled = true));

    await flushMicrotasks();

    expect(settled).toBe(true);
  });

  it('will restore dispatch after pending work throws', async () => {
    const expected = new Error('failed');
    const transition = vi.fn((work: () => void) => work());
    let held: (() => void) | undefined;

    expect(() => pending(() => {
      throw expected;
    })).toThrow(expected);

    enqueue(() => {
      held = pending();
    }, transition);
    await flushMicrotasks();

    expect(transition).not.toHaveBeenCalled();
    expect(held).toBeUndefined();
  });

  it('will let urgent priority win for one handler', async () => {
    const log: string[] = [];
    const host = scheduler(log);
    const mixed = () => log.push('mixed');

    pending(() => {
      enqueue(mixed, host);
      enqueue(() => log.push('deferred'), host);
    });
    enqueue(mixed, host);

    await flushMicrotasks();

    expect(log).toEqual([
      'mixed',
      'transition:start',
      'deferred',
      'transition:end'
    ]);
  });

  it('will keep a handler urgent when pending work reaches it later', async () => {
    const transition = vi.fn((work: () => void) => work());
    const handler = vi.fn();
    let settled = false;

    enqueue(handler, transition);
    pending(() => enqueue(handler, transition)).then(() => (settled = true));

    await flushMicrotasks();

    expect(handler).toHaveBeenCalledOnce();
    expect(transition).not.toHaveBeenCalled();
    expect(settled).toBe(true);
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
    }, undefined, host);

    watch(model, ({ deferred, urgent }) => {
      if (deferred || urgent) priorities.push(`mixed:${transitioning}`);
    }, undefined, host);

    pending(() => void (model.deferred = 1));
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

    watch(model, ({ source }) => void (model.derived = source * 2), undefined, host);
    watch(model, ({ derived }) => {
      if (derived) values.push(`${derived}:${transitioning}`);
    }, undefined, host);

    pending(() => {
      model.source = 1;
      model.source = 2;
    });

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

  it('will settle when a subscriber absorbs its replay', async () => {
    const log: string[] = [];

    let release!: () => void;

    pending(() => {
      enqueue(() => {
        log.push('dispatch');
        release = pending()!;
      });
    }).then(() => log.push('settled'));

    await flushMicrotasks();

    expect(log).toEqual(['dispatch']);

    release();
    await flushMicrotasks();

    expect(log).toEqual(['dispatch', 'settled']);
  });

  it('will settle on replay where no subscriber claims absorption', async () => {
    let settled = false;

    pending(() => enqueue(() => {})).then(() => (settled = true));

    await flushMicrotasks();

    expect(settled).toBe(true);
  });

  it('will ignore a claim released more than once', async () => {
    let release!: () => void;
    let settled = 0;

    pending(() => enqueue(() => {
      release = pending()!;
    })).then(() => settled++);

    await flushMicrotasks();

    release();
    release();
    await flushMicrotasks();

    expect(settled).toBe(1);
  });

  it('will ignore a retry after its claim was released', async () => {
    const replay = vi.fn();
    let release!: NonNullable<ReturnType<typeof hold>>;

    pending(() => enqueue(() => {
      release = hold()!;
    }));

    await flushMicrotasks();

    release();
    release(replay);
    await flushMicrotasks();

    expect(replay).not.toHaveBeenCalled();
  });

  it('will wait on every claim a single replay makes', async () => {
    const held: (() => void)[] = [];
    let settled = false;

    pending(() => enqueue(() => {
      held.push(pending()!, pending()!);
    })).then(() => (settled = true));

    await flushMicrotasks();

    held[0]();
    await flushMicrotasks();

    expect(settled).toBe(false);

    held[1]();
    await flushMicrotasks();

    expect(settled).toBe(true);
  });

  it('will settle a second call when its own replay is absorbed', async () => {
    const handler = () => {
      release = pending()!;
    };

    let release!: () => void;
    const done: string[] = [];

    pending(() => enqueue(handler)).then(() => done.push('first'));
    pending(() => enqueue(handler)).then(() => done.push('second'));

    await flushMicrotasks();

    expect(done).toEqual([]);

    release();
    await flushMicrotasks();

    expect(done).toEqual(['first', 'second']);
  });

  it('will await updates cascading from a replay', async () => {
    const log: string[] = [];
    const held: (() => void)[] = [];

    pending(() => enqueue(() => {
      log.push('source');
      held.push(pending()!);
      enqueue(() => {
        log.push('derived');
        held.push(pending()!);
      });
    })).then(() => log.push('settled'));

    await flushMicrotasks();

    expect(log).toEqual(['source', 'derived']);

    held[0]();
    await flushMicrotasks();

    expect(log).toEqual(['source', 'derived']);

    held[1]();
    await flushMicrotasks();

    expect(log).toEqual(['source', 'derived', 'settled']);
  });

  it('will hold a call while an effect it updated suspends', async () => {
    class Test extends State {
      value = 1;
    }

    const test = Test.new();
    const gate = mockPromise();
    const seen: number[] = [];
    let open = false;
    let settled = false;

    watch(test, ({ value }) => {
      if (value === 2 && !open) throw gate;
      seen.push(value);
    });

    expect(seen).toEqual([1]);

    pending(() => {
      test.value = 2;
    }).then(() => (settled = true));

    await flushMicrotasks();

    expect(seen).toEqual([1]);
    expect(settled).toBe(false);

    open = true;
    gate.resolve();
    await flushMicrotasks();

    expect(seen).toEqual([1, 2]);
    expect(settled).toBe(true);
  });

  it('will hold once across repeated suspension', async () => {
    class Test extends State {
      value = 1;
    }

    const test = Test.new();
    const gates = [mockPromise(), mockPromise()];
    let settled = false;

    watch(test, ({ value }) => {
      if (value === 2 && gates.length) throw gates[0];
    });

    pending(() => {
      test.value = 2;
    }).then(() => (settled = true));

    await flushMicrotasks();

    gates.shift()!.resolve();
    await flushMicrotasks();

    expect(settled).toBe(false);

    gates.shift()!.resolve();
    await flushMicrotasks();

    expect(settled).toBe(true);
  });

  it('will retry a suspended effect after rejection', async () => {
    class Test extends State {
      value = 1;
    }

    const test = Test.new();
    const gate = mockPromise();
    const effect = vi.fn(({ value }: Test) => {
      if (value === 2 && effect.mock.calls.length === 2) throw gate;
    });
    let settled = false;

    watch(test, effect);

    pending(() => {
      test.value = 2;
    }).then(() => (settled = true));

    await flushMicrotasks();

    expect(effect).toHaveBeenCalledTimes(2);
    expect(settled).toBe(false);

    gate.reject(new Error('failed'));
    await flushMicrotasks();

    expect(effect).toHaveBeenCalledTimes(3);
    expect(settled).toBe(true);
  });

  it('will preserve pending causality through a suspended retry', async () => {
    class Source extends State {
      value = 1;
    }

    class Derived extends State {
      value = 1;
    }

    const source = Source.new();
    const derived = Derived.new();
    const gate = mockPromise();
    let open = false;
    let release!: () => void;
    let settled = false;

    watch(source, ({ value }) => {
      if (value === 2 && !open) throw gate;
      derived.value = value;
    });

    watch(derived, ({ value }) => {
      if (value === 2) release = pending()!;
    });

    pending(() => {
      source.value = 2;
    }).then(() => (settled = true));

    await flushMicrotasks();

    open = true;
    gate.resolve();
    await flushMicrotasks();

    expect(derived.value).toBe(2);
    expect(settled).toBe(false);

    release();
    await flushMicrotasks();

    expect(settled).toBe(true);
  });

  it('will join pending work arriving while an effect is suspended', async () => {
    class Test extends State {
      value = 1;
    }

    const test = Test.new();
    const gate = mockPromise();
    const seen: number[] = [];
    const settled: string[] = [];
    let open = false;

    watch(test, ({ value }) => {
      if (value > 1 && !open) throw gate;
      seen.push(value);
    });

    pending(() => {
      test.value = 2;
    }).then(() => settled.push('first'));

    await flushMicrotasks();

    pending(() => {
      test.value = 3;
    }).then(() => settled.push('second'));

    await flushMicrotasks();

    expect(seen).toEqual([1]);
    expect(settled).toEqual([]);

    open = true;
    gate.resolve();
    await flushMicrotasks();

    expect(seen).toEqual([1, 3]);
    expect(settled).toEqual(['first', 'second']);
  });

  it('will claim pending work after an urgent suspension', async () => {
    class Test extends State {
      value = 1;
    }

    const test = Test.new();
    const gate = mockPromise();
    const seen: number[] = [];
    const transition = vi.fn((work: () => void) => work());
    let settled = false;

    watch(test, ({ value }) => {
      if (value === 2) throw gate;
      seen.push(value);
    }, undefined, transition);

    test.value = 2;
    await flushMicrotasks();

    pending(() => {
      test.value = 3;
    }).then(() => (settled = true));

    await flushMicrotasks();

    expect(seen).toEqual([1]);
    expect(settled).toBe(false);

    gate.resolve();
    await flushMicrotasks();

    expect(seen).toEqual([1, 3]);
    expect(settled).toBe(true);
    expect(transition).toHaveBeenCalledOnce();
  });

  it('will release a suspended effect claim if it is destroyed', async () => {
    class Test extends State {
      value = 1;
    }

    const test = Test.new();
    const gate = mockPromise();
    const effect = vi.fn(({ value }: Test) => {
      if (value === 2) throw gate;
    });
    let settled = false;

    watch(test, effect);

    pending(() => {
      test.value = 2;
    }).then(() => (settled = true));

    await flushMicrotasks();

    expect(settled).toBe(false);

    test.set(null);
    await flushMicrotasks();

    expect(settled).toBe(true);
    expect(effect).toHaveBeenCalledTimes(2);

    gate.resolve();
    await flushMicrotasks();

    expect(effect).toHaveBeenCalledTimes(2);
  });

  it('will release a suspended effect claim if it is cancelled', async () => {
    class Test extends State {
      value = 1;
    }

    const test = Test.new();
    const gate = mockPromise();
    const effect = vi.fn(({ value }: Test) => {
      if (value === 2) throw gate;
    });
    let settled = false;

    const done = watch(test, effect);

    pending(() => {
      test.value = 2;
    }).then(() => (settled = true));

    await flushMicrotasks();

    expect(settled).toBe(false);

    done();
    gate.resolve();
    await flushMicrotasks();

    expect(settled).toBe(true);
    expect(effect).toHaveBeenCalledTimes(2);
  });

  it('will cancel a suspended retry already queued for replay', async () => {
    class Test extends State {
      value = 1;
    }

    const test = Test.new();
    const gate = mockPromise();
    const effect = vi.fn(({ value }: Test) => {
      if (value === 2) throw gate;
    });
    const done = watch(test, effect);
    let settled = false;

    pending(() => {
      test.value = 2;
    }).then(() => (settled = true));

    await flushMicrotasks();

    gate.resolve();
    await gate;
    done();
    await flushMicrotasks();

    expect(effect).toHaveBeenCalledTimes(2);
    expect(settled).toBe(true);
  });

  it('will carry every claim through a replay urgency strips', async () => {
    const transition = vi.fn((work: () => void) => work());
    const settled: string[] = [];
    let release: (() => void) | undefined;
    const handler = () => {
      release = pending();
    };

    pending(() => enqueue(handler, transition)).then(() => settled.push('first'));
    pending(() => enqueue(handler, transition)).then(() => settled.push('second'));
    enqueue(handler, transition);

    await flushMicrotasks();

    expect(transition).not.toHaveBeenCalled();
    expect(settled).toEqual([]);

    release!();
    await flushMicrotasks();

    expect(settled).toEqual(['first', 'second']);
  });
});
