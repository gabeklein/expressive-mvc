import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockError } from '../test.setup';
import { Component, State } from '.';
import { accept, replaced } from './hot';

const SYMBOL = Symbol('static');

let count = 0;
const module = () => `module-${count++}`;

afterEach(() => void vi.unstubAllGlobals());

function hmr<T>(Test: T) {
  const id = module();

  accept(id, { Test });

  return <N>(Next: N) => accept(id, { Test: Next }).Test;
}

function counter(step: number, handler?: State.On) {
  class Test extends State {
    value = 0;
    bump() {
      this.value += step;
    }
  }

  if (handler) Test.on(handler);

  return Test;
}

function render(text: string) {
  return class Test extends Component {
    render() {
      return text;
    }
  };
}

function collected() {
  vi.stubGlobal('WeakRef', class {
    deref() {}
  });
}

describe('accept', () => {
  it('will return classes on first run', () => {
    class Test extends State {}

    expect(accept(module(), { Test }).Test).toBe(Test);
  });

  it('will ignore other values', () => {
    const id = module();
    class Plain {}

    accept(id, { Plain, value: 1 });

    const next = accept(id, { Plain: class Plain {}, value: 2 });

    expect(next.value).toBe(2);
    expect(next.Plain).not.toBe(Plain);
  });

  it('will ignore the same class twice', () => {
    const id = module();
    class Test extends State {}

    accept(id, { Test });

    expect(accept(id, { Test }).Test).toBe(Test);
  });

  it('will patch a method onto the original class', () => {
    const id = module();

    const Before = class Test extends State {
      value = 1;
      bump() {
        this.value += 1;
      }
    };

    const After = class Test extends State {
      value = 1;
      bump() {
        this.value += 10;
      }
    };

    accept(id, { Test: Before });

    const test = Before.new();

    test.bump();

    expect(accept(id, { Test: After }).Test).toBe(Before);

    test.bump();

    expect(test.value).toBe(12);
  });

  it('will keep a method assigned to an instance', () => {
    const Test = counter(1);
    const next = hmr(Test);
    const test = Test.new();

    test.set({
      bump() {
        this.value = 100;
      }
    });

    next(counter(10));
    test.bump();

    expect(test.value).toBe(100);
  });

  it('will add a new method', () => {
    const Before = class Test extends State {
      value = 1;
    };

    const next = hmr(Before);
    const test = Before.new();

    next(class Test extends State {
      value = 1;
      double() {
        this.value *= 2;
      }
    });

    (test as any).double();

    expect(test.value).toBe(2);
  });

  it('will patch a class not yet created', () => {
    const version = (step: number, extra?: boolean) => {
      class Test extends State {
        value = 0;
        bump() {
          this.value += step;
        }
      }

      if (extra)
        Object.defineProperty(Test.prototype, 'extra', { configurable: true, get: () => step });

      return Test;
    };

    const Test = version(1, true);

    hmr(Test)(version(10));

    const test = Test.new();

    test.bump();

    expect(test.value).toBe(10);
    expect('extra' in Test.prototype).toBe(false);
  });

  it('will recompute a getter and refresh', async () => {
    const version = (factor: number) =>
      class Test extends State {
        value = 2;
        get scaled() {
          return this.value * factor;
        }
      };

    const Test = version(2);
    const next = hmr(Test);
    const test = Test.new();
    const effect = vi.fn((self: InstanceType<typeof Test>) => void self.scaled);

    test.get(effect);

    next(version(3));
    await expect(test).toHaveUpdated();

    expect(test.scaled).toBe(6);
    expect(effect).toHaveBeenCalledTimes(2);

    next(version(4));
    await expect(test).toHaveUpdated();

    expect(test.scaled).toBe(8);
  });

  it('will remove a getter', () => {
    const Before = class Test extends State {
      get extra() {
        return 1;
      }
    };

    const next = hmr(Before);

    Before.new();
    next(class Test extends State {});

    expect('extra' in Before.prototype).toBe(false);
  });

  it('will patch render of a Component', () => {
    const Test = render('before');
    const next = hmr(Test);
    const test = Test.new();

    expect(test.render()).toBe('before');

    next(render('after'));

    expect(test.render()).toBe('after');
  });

  it('will copy statics', () => {
    const version = (label: string) => {
      class Test extends State {
        static label = label;
        static describe() {
          return label;
        }
      }
      Object.defineProperty(Test, 'fixed', { value: label });
      Object.defineProperty(Test, SYMBOL, { value: label, configurable: true });
      return Test;
    };

    const Test = version('before') as any;

    hmr(Test)(version('after'));

    expect(Test.label).toBe('after');
    expect(Test.describe()).toBe('after');
    expect(Test.fixed).toBe('before');
    expect(Test[SYMBOL]).toBe('after');
  });

  it('will run type handlers again', () => {
    const type = vi.fn();

    const version = (label: string) => {
      class Test extends State {
        Sealed() {
          return label;
        }
      }

      Test.on({ setup: () => {} });
      Test.on({ ready() {} });
      Test.on({
        type(type) {
          if (Object.getOwnPropertyDescriptor(type.prototype, 'Sealed')!.configurable)
            Object.defineProperty(type.prototype, 'Sealed', {
              configurable: false,
              get: () => label
            });
        }
      });
      Test.on({ type });

      return Test;
    };

    const Test = version('before');
    const next = hmr(Test);
    const test = Test.new() as any;

    next(version('after'));

    expect(type).toHaveBeenCalledTimes(2);
    expect(test.Sealed).toBe('before');
  });

  it('will patch a method the host sealed', () => {
    const version = (label: string) => {
      class Test extends State {
        sealed() {
          return label;
        }
      }

      Test.on({
        type({ prototype }) {
          const desc = Object.getOwnPropertyDescriptor(prototype, 'sealed')!;

          if (desc.configurable)
            Object.defineProperty(prototype, 'sealed', { ...desc, configurable: false });
        }
      });

      return Test;
    };

    const Test = version('before');
    const next = hmr(Test);
    const test = Test.new() as any;

    expect(test.sealed()).toBe('before');

    next(version('after'));

    expect(test.sealed()).toBe('after');
  });

  it('will pass a method to an instance setter', () => {
    const received = vi.fn();
    const Test = counter(1);

    Test.on({
      setup(self) {
        Object.defineProperty(self, 'bump', {
          configurable: true,
          get: () => () => 'own',
          set: received
        });
      }
    });

    const next = hmr(Test);

    Test.new();
    next(counter(10));

    expect(received).toHaveBeenCalledWith(expect.any(Function));
  });

  describe('setup handlers', () => {
    const version = (handler?: () => void) => {
      class Test extends State {}
      if (handler) Test.on({ setup: handler });
      return Test;
    };

    it('will replace handlers the module registered', () => {
      const before = vi.fn();
      const after = vi.fn();
      const outside = vi.fn();
      const Test = version(before);
      const next = hmr(Test);

      Test.on({ setup: outside });
      next(version(after));
      Test.new();

      expect(before).not.toHaveBeenCalled();
      expect(after).toHaveBeenCalledTimes(1);
      expect(outside).toHaveBeenCalledTimes(1);
    });

    it('will add handlers to a class without', () => {
      const handler = vi.fn();
      const Test = version();

      hmr(Test)(version(handler));
      Test.new();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('bind handlers', () => {
    it('will run again for a patched method', () => {
      const handler = vi.fn();
      const Test = counter(1, { method: handler });
      const next = hmr(Test);
      const test = Test.new();

      test.bump();
      next(counter(10, { method: handler }));
      test.bump();

      expect(test.value).toBe(11);
      expect(handler).toBeCalledTimes(2);
      expect(handler).toHaveBeenLastCalledWith('bump', test.bump, test);
    });

    it('will keep an observed method assigned to an instance', () => {
      const handler = vi.fn();
      const Test = counter(1, { method: handler });
      const next = hmr(Test);
      const test = Test.new();

      test.set({
        bump() {
          this.value = 100;
        }
      });

      next(counter(10, { method: handler }));
      test.bump();

      expect(test.value).toBe(100);
      expect(handler).toBeCalledTimes(1);
    });
  });

  it('will extend live subclasses', async () => {
    const Before = class Test extends State {
      value = 1;
    };

    const next = hmr(Before);

    class Sub extends Before {
      own() {
        return 'sub';
      }
      get shadowed() {
        return 'sub';
      }
    }

    const base = Before.new() as any;
    const sub = Sub.new() as any;

    next(class Test extends State {
      value = 1;
      added() {
        return 'added';
      }
      own() {
        return 'parent';
      }
      get double() {
        return this.value * 2;
      }
      get shadowed() {
        return 'parent';
      }
    });

    expect(sub.get('added')()).toBe('added');
    expect(sub.own()).toBe('sub');
    expect(sub.shadowed).toBe('sub');

    const effect = vi.fn((self: any) => void self.double);

    base.get(effect);
    expect(base.double).toBe(2);

    base.value = 5;
    await expect(base).toHaveUpdated();

    expect(base.double).toBe(10);
    expect(sub.double).toBe(2);
    expect(effect).toHaveBeenCalledTimes(2);
  });

  it('will drop instances collected', () => {
    collected();

    const Test = counter(1);
    const next = hmr(Test);
    const test = Test.new();

    next(counter(10));
    test.bump();

    expect(test.value).toBe(10);
  });

  it('will not patch a destroyed instance', () => {
    const Test = counter(1);
    const next = hmr(Test);
    const test = Test.new();
    const { bump } = test;

    test.set(null);
    next(counter(10));

    expect(test.bump).toBe(bump);
  });

  it('will not patch a class which changed shape', () => {
    const Before = class Test extends State {
      value = 1;
    };

    const After = class Test extends State {
      value = 1;
      other = 2;
    };

    expect(hmr(Before)(After)).toBe(After);
  });

  it('will not patch a class with private members', () => {
    const Before = class Test extends State {
      #hidden = 'x';
      show() {
        return 'a' + this.#hidden;
      }
    };

    const After = class Test extends State {
      #hidden = 'x';
      show() {
        return 'b' + this.#hidden;
      }
    };

    expect(hmr(Before)(After)).toBe(After);
  });

  it('will not patch a member which changed kind', () => {
    const Before = class Test extends State {
      get value() {
        return 1;
      }
    };

    const After = class Test extends State {
      value() {
        return 1;
      }
    };

    expect(hmr(Before)(After)).toBe(After);
  });

  it('will not patch a getter which gained a setter', () => {
    const Before = class Test extends State {
      get value() {
        return 1;
      }
    };

    const After = class Test extends State {
      get value() {
        return 1;
      }
      set value(_: number) {}
    };

    expect(hmr(Before)(After)).toBe(After);
  });

  it('will patch a subclass of a class with private members', () => {
    class Base extends State {
      #hidden = 'x';

      reveal() {
        return this.#hidden;
      }
    }

    const make = (label: string) =>
      class Test extends Base {
        show() {
          return label + this.reveal();
        }
      };

    const Before = make('a');
    const next = hmr(Before);
    const test = Before.new();

    expect(next(make('b'))).toBe(Before);
    expect(test.show()).toBe('bx');
  });

  it('will patch a class with a hash in a field value', () => {
    const make = (label: string) =>
      class Test extends State {
        color = '#fff';

        show() {
          return label;
        }
      };

    const Before = make('a');

    expect(hmr(Before)(make('b'))).toBe(Before);
  });

  it('will patch a class whose import binding was renumbered', () => {
    const id = module();
    const make = (binding: string) =>
      new Function('State', binding, `return class Test extends State { value = ${binding}.A; }`)(State, { A: 1 });

    const Before = make('__vite_ssr_import_0__');

    accept(id, { Test: Before });

    expect(accept(id, { Test: make('__vite_ssr_import_1__') }).Test).toBe(Before);
  });

  it('will replace a class whose imported member changed', () => {
    const id = module();
    const make = (key: string) =>
      new Function('State', '__vite_ssr_import_0__', `return class Test extends State { value = __vite_ssr_import_0__.${key}; }`)(
        State,
        { A: 1, B: 2 }
      );

    accept(id, { Test: make('A') });

    const After = make('B');

    expect(accept(id, { Test: After }).Test).toBe(After);
  });

  it('will replace a subclass whose parent was replaced', () => {
    const base = module();
    const sub = module();
    const extend = (Parent: typeof State) =>
      class Sub extends Parent {
        name() {
          return 'sub';
        }
      };

    class Base extends State {
      a = 1;
    }

    class Wider extends State {
      a = 1;
      b = 2;
    }

    const Sub = accept(sub, { Sub: extend(accept(base, { Base }).Base) }).Sub;
    const Next = extend(accept(base, { Base: Wider }).Base);

    expect(accept(sub, { Sub: Next }).Sub).toBe(Next);
    expect(Next).not.toBe(Sub);
    expect((Next.new() as unknown as Wider).b).toBe(2);
  });

  it('will patch a subclass whose parent was patched', () => {
    const base = module();
    const sub = module();
    const make = (label: string) =>
      class Base extends State {
        hello() {
          return label;
        }
      };
    const extend = (Parent: typeof State) => class Sub extends Parent {};

    const Base = accept(base, { Base: make('a') }).Base;
    const Sub = accept(sub, { Sub: extend(Base) }).Sub;

    expect(accept(sub, { Sub: extend(accept(base, { Base: make('b') }).Base) }).Sub).toBe(Sub);
    expect((Sub.new() as unknown as InstanceType<ReturnType<typeof make>>).hello()).toBe('b');
  });

  it('will not patch if patching throws', () => {
    const error = mockError();
    let runs = 0;

    const version = () => {
      class Test extends State {}

      Test.on({
        type() {
          if (runs++) throw new Error('refused');
        }
      });

      return Test;
    };

    const Test = version();
    const next = hmr(Test);

    Test.new();

    const Next = version();

    expect(next(Next)).toBe(Next);
    expect(error).toHaveBeenCalledWith(new Error('refused'));
  });

  it('will rebuild render for a Component with no live instance', () => {
    collected();

    const Test = render('before');
    const next = hmr(Test);

    Test.new().render();
    next(render('after'));

    expect(Test.new().render()).toBe('after');
  });

  it('will extend a subclass with no live instance', () => {
    collected();

    const Before = class Test extends State {
      value = 2;
      gone() {}
      kept() {}
    };

    const next = hmr(Before);

    class Sub extends Before {}
    class Deep extends Sub {
      kept() {}
    }

    Deep.new();
    next(class Test extends State {
      value = 2;
      get double() {
        return this.value * 2;
      }
    });

    const sub = Sub.new() as any;
    const deep = Deep.new() as any;

    expect(Object.getOwnPropertyDescriptor(sub, 'double')?.get).toBeTypeOf('function');
    expect(Object.getOwnPropertyDescriptor(deep, 'double')?.get).toBeTypeOf('function');
    expect(sub.double).toBe(4);
    expect('gone' in sub).toBe(false);
    expect(deep.kept).toBeTypeOf('function');
  });

  it('will drop a removed method from live instances', () => {
    const Before = class Test extends State {
      gone() {}
    };

    const next = hmr(Before);
    const test = Before.new() as any;
    const untouched = Before.new() as any;

    test.gone();
    next(class Test extends State {});

    expect(test.gone).toBeUndefined();
    expect(untouched.gone).toBeUndefined();
  });

  it('will not activate an instance a patch reaches', async () => {
    const Test = counter(1);
    const next = hmr(Test);
    const test = new Test();

    next(counter(10));
    await Promise.resolve();

    expect(Object.getOwnPropertyDescriptor(test, 'value')?.get).toBeUndefined();
  });

  it('will not pass the refresh to update listeners', async () => {
    const listener = vi.fn();
    const Test = counter(1);
    const next = hmr(Test);
    const test = Test.new();

    test.set(listener);
    next(counter(10));
    await expect(test).toHaveUpdated();

    expect(listener).not.toHaveBeenCalled();
  });

  it('will prune a removed method from subclasses after an earlier patch', () => {
    const version = (step?: number) => {
      class Test extends State {
        value = 0;
      }

      if (step)
        Object.defineProperty(Test.prototype, 'gone', {
          configurable: true,
          writable: true,
          value(this: Test) {
            this.value += step;
          }
        });

      return Test;
    };

    const Test = version(1);
    const next = hmr(Test);

    class Sub extends Test {}

    const sub = Sub.new() as any;

    next(version(2));
    next(version());

    expect(() => sub.set({ gone: 5 })).not.toThrow();
    expect(sub.gone).toBeUndefined();
  });

  it('will prune a removed getter from subclasses', () => {
    const Before = class Test extends State {
      value = 2;
      get double() {
        return this.value * 2;
      }
    };

    const next = hmr(Before);

    class Sub extends Before {}

    Sub.new();
    next(class Test extends State {
      value = 2;
    });

    expect(Object.getOwnPropertyDescriptor(Sub.new(), 'double')).toBeUndefined();
  });

  it('will patch an unmanaged accessor', () => {
    const version = (label: string) =>
      class Test extends State {
        value = 1;
        get _label() {
          return `${label} ${this.value}`;
        }
      };

    const Test = version('before');
    const next = hmr(Test);
    const test = Test.new() as any;

    expect(test._label).toBe('before 1');

    next(version('after'));

    expect(test._label).toBe('after 1');
  });
});

describe('replaced', () => {
  const version = (extra: boolean) =>
    extra
      ? class Test extends State {
          value = 1;
          other = 2;
        }
      : class Test extends State {
          value = 1;
        };

  it('will report a replaced class before accept returns', () => {
    const id = module();
    const listener = vi.fn();
    const release = replaced(listener);
    const Test = version(false);
    const Next = version(true);

    accept(id, { Test });
    expect(listener).not.toHaveBeenCalled();

    accept(id, { Test: Next });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ id, name: 'Test', prev: Test, next: Next });

    release();
  });

  it('will not report a patched class', () => {
    const listener = vi.fn();
    const release = replaced(listener);

    hmr(version(false))(version(false));

    expect(listener).not.toHaveBeenCalled();
    release();
  });

  it('will report a class whose patch threw', () => {
    mockError();

    const id = module();
    const listener = vi.fn();
    const release = replaced(listener);
    let runs = 0;

    const make = () => {
      class Test extends State {}

      Test.on({
        type() {
          if (runs++) throw new Error('refused');
        }
      });

      return Test;
    };

    const Test = make();

    accept(id, { Test });
    Test.new();

    const Next = make();

    accept(id, { Test: Next });

    expect(listener).toHaveBeenCalledWith({ id, name: 'Test', prev: Test, next: Next });

    release();
  });

  it('will stop reporting once released', () => {
    const listener = vi.fn();

    replaced(listener)();
    hmr(version(false))(version(true));

    expect(listener).not.toHaveBeenCalled();
  });

  it('will report to every listener if one throws', () => {
    const error = mockError();
    const failure = new Error('listener');
    const release = replaced(() => {
      throw failure;
    });
    const listener = vi.fn();
    const also = replaced(listener);

    hmr(version(false))(version(true));

    expect(error).toHaveBeenCalledWith(failure);
    expect(listener).toHaveBeenCalledOnce();

    release();
    also();
  });
});
