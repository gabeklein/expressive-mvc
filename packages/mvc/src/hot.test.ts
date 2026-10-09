import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockWarn } from '../test.setup';
import { Component, Context, State } from '.';
import { accept, replaced } from './hot';

const SYMBOL = Symbol('static');

let count = 0;
const module = () => `module-${count++}`;

afterEach(() => void vi.unstubAllGlobals());

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

    const Before = (() => {
      class Test extends State {
        value = 1;
        bump() {
          this.value += 1;
        }
      }
      return Test;
    })();

    const After = (() => {
      class Test extends State {
        value = 1;
        bump() {
          this.value += 10;
        }
      }
      return Test;
    })();

    accept(id, { Test: Before });

    const test = Before.new();

    test.bump();

    expect(accept(id, { Test: After }).Test).toBe(Before);

    test.bump();

    expect(test.value).toBe(12);
  });

  it('will keep a method assigned to an instance', () => {
    const id = module();

    const version = (step: number) => {
      class Test extends State {
        value = 0;
        bump() {
          this.value += step;
        }
      }
      return Test;
    };

    const Test = version(1);

    accept(id, { Test });

    const test = Test.new();

    test.set({
      bump() {
        this.value = 100;
      }
    });

    accept(id, { Test: version(10) });

    test.bump();

    expect(test.value).toBe(100);
  });

  it('will add a new method', () => {
    const id = module();

    const Before = (() => {
      class Test extends State {
        value = 1;
      }
      return Test;
    })();

    const After = (() => {
      class Test extends State {
        value = 1;
        double() {
          this.value *= 2;
        }
      }
      return Test;
    })();

    accept(id, { Test: Before });

    const test = Before.new();

    accept(id, { Test: After });

    (test as any).double();

    expect(test.value).toBe(2);
  });

  it('will patch a class not yet created', () => {
    const id = module();

    const version = (step: number) => {
      class Test extends State {
        value = 0;
        bump() {
          this.value += step;
        }
        get extra() {
          return step;
        }
      }
      return Test;
    };

    const Test = version(1);

    accept(id, { Test });

    const Next = (() => {
      class Test extends State {
        value = 0;
        bump() {
          this.value += 10;
        }
      }
      return Test;
    })();

    accept(id, { Test: Next });

    const test = Test.new();

    test.bump();

    expect(test.value).toBe(10);
    expect('extra' in Test.prototype).toBe(false);
  });

  it('will recompute a getter and refresh', async () => {
    const id = module();

    const version = (factor: number) => {
      class Test extends State {
        value = 2;
        get scaled() {
          return this.value * factor;
        }
      }
      return Test;
    };

    const Test = version(2);

    accept(id, { Test });

    const test = Test.new();
    const effect = vi.fn((self: InstanceType<typeof Test>) => void self.scaled);

    test.get(effect);

    expect(test.scaled).toBe(4);

    accept(id, { Test: version(3) });
    await expect(test).toHaveUpdated();

    expect(test.scaled).toBe(6);
    expect(effect).toHaveBeenCalledTimes(2);

    accept(id, { Test: version(4) });
    await expect(test).toHaveUpdated();

    expect(test.scaled).toBe(8);
  });

  it('will remove a getter', () => {
    const id = module();

    const Before = (() => {
      class Test extends State {
        get extra() {
          return 1;
        }
      }
      return Test;
    })();

    const After = (() => {
      class Test extends State {}
      return Test;
    })();

    accept(id, { Test: Before });
    Before.new();
    accept(id, { Test: After });

    expect('extra' in Before.prototype).toBe(false);
  });

  it('will patch render of a Component', () => {
    const id = module();

    const version = (text: string) => {
      class Test extends Component {
        render() {
          return text;
        }
      }
      return Test;
    };

    const Test = version('before');

    accept(id, { Test });

    const test = Test.new();

    expect(test.render()).toBe('before');

    accept(id, { Test: version('after') });

    expect(test.render()).toBe('after');
  });

  it('will copy statics', () => {
    const id = module();

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

    accept(id, { Test });
    accept(id, { Test: version('after') });

    expect(Test.label).toBe('after');
    expect(Test.describe()).toBe('after');
    expect(Test.fixed).toBe('before');
    expect(Test[SYMBOL]).toBe('after');
  });

  it('will run type handlers again', () => {
    const id = module();
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

    accept(id, { Test });

    const test = Test.new() as any;

    accept(id, { Test: version('after') });

    expect(type).toHaveBeenCalledTimes(2);
    expect(test.Sealed).toBe('before');
  });

  it('will patch a method the host sealed', () => {
    const id = module();

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

    accept(id, { Test });

    const test = Test.new() as any;

    expect(test.sealed()).toBe('before');

    accept(id, { Test: version('after') });

    expect(test.sealed()).toBe('after');
  });

  it('will pass a method to an instance setter', () => {
    const id = module();
    const received = vi.fn();

    const version = (label: string) => {
      class Test extends State {
        label() {
          return label;
        }
      }
      return Test;
    };

    const Test = version('before');

    Test.on({
      setup(self) {
        Object.defineProperty(self, 'label', {
          configurable: true,
          get: () => () => 'own',
          set: received
        });
      }
    });

    accept(id, { Test });
    Test.new();
    accept(id, { Test: version('after') });

    expect(received).toHaveBeenCalledWith(expect.any(Function));
  });

  it('will replace handlers the module registered', () => {
    const id = module();
    const before = vi.fn();
    const after = vi.fn();
    const outside = vi.fn();

    const version = (handler?: () => void) => {
      class Test extends State {}
      if (handler) Test.on({ setup: handler });
      return Test;
    };

    const Test = version(before);

    accept(id, { Test });
    Test.on({ setup: outside });
    accept(id, { Test: version(after) });
    Test.new();

    expect(before).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledTimes(1);
    expect(outside).toHaveBeenCalledTimes(1);
  });

  describe('bind handlers', () => {
    const version = (step: number, handler?: State.On) => {
      class Test extends State {
        value = 0;
        bump() {
          this.value += step;
        }
      }
      if (handler) Test.on(handler);
      return Test;
    };

    it('will run again for a patched method', () => {
      const id = module();
      const handler = vi.fn();
      const Test = version(1, { method: handler });

      accept(id, { Test });

      const test = Test.new();

      test.bump();
      accept(id, { Test: version(10, { method: handler }) });
      test.bump();

      expect(test.value).toBe(11);
      expect(handler).toBeCalledTimes(2);
      expect(handler).toHaveBeenLastCalledWith('bump', test.bump, test);
    });

    it('will keep an observed method assigned to an instance', () => {
      const id = module();
      const handler = vi.fn();
      const Test = version(1, { method: handler });

      accept(id, { Test });

      const test = Test.new();

      test.set({
        bump() {
          this.value = 100;
        }
      });

      accept(id, { Test: version(10, { method: handler }) });
      test.bump();

      expect(test.value).toBe(100);
      expect(handler).toBeCalledTimes(1);
    });
  });

  it('will add handlers to a class without', () => {
    const id = module();
    const handler = vi.fn();

    const version = (handler?: () => void) => {
      class Test extends State {}
      if (handler) Test.on({ setup: handler });
      return Test;
    };

    const Test = version();

    accept(id, { Test });
    accept(id, { Test: version(handler) });
    Test.new();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('will extend live subclasses', async () => {
    const id = module();

    const Before = (() => {
      class Test extends State {
        value = 1;
      }
      return Test;
    })();

    const After = (() => {
      class Test extends State {
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
      }
      return Test;
    })();

    accept(id, { Test: Before });

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

    accept(id, { Test: After });

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
    const id = module();

    vi.stubGlobal('WeakRef', class {
      deref() {}
    });

    const version = (step: number) => {
      class Test extends State {
        value = 0;
        bump() {
          this.value += step;
        }
      }
      return Test;
    };

    const Test = version(1);

    accept(id, { Test });

    const test = Test.new();

    accept(id, { Test: version(10) });

    test.bump();

    expect(test.value).toBe(10);
  });

  it('will not patch a destroyed instance', () => {
    const id = module();

    const version = (step: number) => {
      class Test extends State {
        value = 0;
        bump() {
          this.value += step;
        }
      }
      return Test;
    };

    const Test = version(1);

    accept(id, { Test });

    const test = Test.new();
    const { bump } = test;

    test.set(null);
    accept(id, { Test: version(10) });

    expect(test.bump).toBe(bump);
  });

  it('will not patch a class which changed shape', () => {
    const id = module();

    const Before = (() => {
      class Test extends State {
        value = 1;
      }
      return Test;
    })();

    const After = (() => {
      class Test extends State {
        value = 1;
        other = 2;
      }
      return Test;
    })();

    accept(id, { Test: Before });

    expect(accept(id, { Test: After }).Test).toBe(After);
  });

  it('will not patch a class with private members', () => {
    const id = module();
    const make = (label: string) =>
      class Test extends State {
        #hidden = 'x';

        show() {
          return label + this.#hidden;
        }
      };

    const Before = make('a');
    const After = make('b');

    accept(id, { Test: Before });

    expect(accept(id, { Test: After }).Test).toBe(After);
  });

  it('will patch a subclass of a class with private members', () => {
    const id = module();

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

    accept(id, { Test: Before });

    const test = Before.new();

    expect(accept(id, { Test: make('b') }).Test).toBe(Before);
    expect(test.show()).toBe('bx');
  });

  it('will patch a class with a hash in a field value', () => {
    const id = module();
    const make = (label: string) =>
      class Test extends State {
        color = '#fff';

        show() {
          return label;
        }
      };

    const Before = make('a');

    accept(id, { Test: Before });

    expect(accept(id, { Test: make('b') }).Test).toBe(Before);
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

  it('will not patch a member which changed kind', () => {
    const id = module();

    const Before = (() => {
      class Test extends State {
        get value() {
          return 1;
        }
      }
      return Test;
    })();

    const After = (() => {
      class Test extends State {
        value() {
          return 1;
        }
      }
      return Test;
    })();

    accept(id, { Test: Before });

    expect(accept(id, { Test: After }).Test).toBe(After);
  });

  it('will not patch if patching throws', () => {
    const id = module();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
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

    accept(id, { Test });
    Test.new();

    const Next = version();

    expect(accept(id, { Test: Next }).Test).toBe(Next);
    expect(error).toHaveBeenCalledWith(new Error('refused'));

    error.mockRestore();
  });

  it('will rebuild render for a Component with no live instance', () => {
    const id = module();

    vi.stubGlobal('WeakRef', class {
      deref() {}
    });

    const version = (text: string) => {
      class Test extends Component {
        render() {
          return text;
        }
      }
      return Test;
    };

    const Test = version('before');

    accept(id, { Test });
    Test.new().render();
    accept(id, { Test: version('after') });

    expect(Test.new().render()).toBe('after');
  });

  it('will extend a subclass with no live instance', () => {
    const id = module();

    vi.stubGlobal('WeakRef', class {
      deref() {}
    });

    const Before = (() => {
      class Test extends State {
        value = 2;
        gone() {}
        kept() {}
      }
      return Test;
    })();

    const After = (() => {
      class Test extends State {
        value = 2;
        get double() {
          return this.value * 2;
        }
      }
      return Test;
    })();

    accept(id, { Test: Before });

    class Sub extends Before {}
    class Deep extends Sub {
      kept() {}
    }

    Deep.new();
    accept(id, { Test: After });

    const sub = Sub.new() as any;
    const deep = Deep.new() as any;

    expect(Object.getOwnPropertyDescriptor(sub, 'double')?.get).toBeTypeOf('function');
    expect(Object.getOwnPropertyDescriptor(deep, 'double')?.get).toBeTypeOf('function');
    expect(sub.double).toBe(4);
    expect('gone' in sub).toBe(false);
    expect(deep.kept).toBeTypeOf('function');
  });

  it('will drop a removed method from live instances', () => {
    const id = module();

    const Before = (() => {
      class Test extends State {
        gone() {}
      }
      return Test;
    })();

    const After = (() => {
      class Test extends State {}
      return Test;
    })();

    accept(id, { Test: Before });

    const test = Before.new() as any;
    const untouched = Before.new() as any;

    test.gone();
    accept(id, { Test: After });

    expect(test.gone).toBeUndefined();
    expect(untouched.gone).toBeUndefined();
  });

  it('will not activate an instance a patch reaches', async () => {
    const id = module();

    const version = (step: number) => {
      class Test extends State {
        value = 1;
        bump() {
          this.value += step;
        }
      }
      return Test;
    };

    const Test = version(1);

    accept(id, { Test });

    const test = new Test();

    accept(id, { Test: version(10) });
    await Promise.resolve();

    expect(Object.getOwnPropertyDescriptor(test, 'value')?.get).toBeUndefined();
  });

  it('will not pass the refresh to update listeners', async () => {
    const id = module();
    const listener = vi.fn();

    const version = (step: number) => {
      class Test extends State {
        value = 1;
        bump() {
          this.value += step;
        }
      }
      return Test;
    };

    const Test = version(1);

    accept(id, { Test });

    const test = Test.new();

    test.set(listener);
    accept(id, { Test: version(10) });
    await expect(test).toHaveUpdated();

    expect(listener).not.toHaveBeenCalled();
  });

  it('will not patch a getter which gained a setter', () => {
    const id = module();

    const Before = (() => {
      class Test extends State {
        get value() {
          return 1;
        }
      }
      return Test;
    })();

    const After = (() => {
      class Test extends State {
        get value() {
          return 1;
        }
        set value(_: number) {}
      }
      return Test;
    })();

    accept(id, { Test: Before });

    expect(accept(id, { Test: After }).Test).toBe(After);
  });

  it('will prune a removed method from subclasses after an earlier patch', () => {
    const id = module();

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

    accept(id, { Test });

    class Sub extends Test {}

    const sub = Sub.new() as any;

    accept(id, { Test: version(2) });
    accept(id, { Test: version() });

    expect(() => sub.set({ gone: 5 })).not.toThrow();
    expect(sub.gone).toBeUndefined();
  });

  it('will prune a removed getter from subclasses', () => {
    const id = module();

    const Before = (() => {
      class Test extends State {
        value = 2;
        get double() {
          return this.value * 2;
        }
      }
      return Test;
    })();

    const After = (() => {
      class Test extends State {
        value = 2;
      }
      return Test;
    })();

    accept(id, { Test: Before });

    class Sub extends Before {}

    Sub.new();
    accept(id, { Test: After });

    expect(Object.getOwnPropertyDescriptor(Sub.new(), 'double')).toBeUndefined();
  });

  it('will patch an unmanaged accessor', () => {
    const id = module();

    const version = (label: string) => {
      class Test extends State {
        value = 1;
        get _label() {
          return `${label} ${this.value}`;
        }
      }
      return Test;
    };

    const Test = version('before');

    accept(id, { Test });

    const test = Test.new() as any;

    expect(test._label).toBe('before 1');

    accept(id, { Test: version('after') });

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
    const id = module();
    const listener = vi.fn();
    const release = replaced(listener);

    accept(id, { Test: version(false) });
    accept(id, { Test: version(false) });

    expect(listener).not.toHaveBeenCalled();
    release();
  });

  it('will report a class whose patch threw', () => {
    const id = module();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    error.mockRestore();
  });

  it('will stop reporting once released', () => {
    const id = module();
    const listener = vi.fn();

    replaced(listener)();
    accept(id, { Test: version(false) });
    accept(id, { Test: version(true) });

    expect(listener).not.toHaveBeenCalled();
  });

  it('will report to every listener if one throws', () => {
    const id = module();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('listener');
    const release = replaced(() => {
      throw failure;
    });
    const listener = vi.fn();
    const also = replaced(listener);

    accept(id, { Test: version(false) });
    accept(id, { Test: version(true) });

    expect(error).toHaveBeenCalledWith(failure);
    expect(listener).toHaveBeenCalledOnce();

    release();
    also();
    error.mockRestore();
  });
});

describe('global', () => {
  it('will replace a global created again by a re-run module', () => {
    const warn = mockWarn();

    class Auth extends State {
      static readonly global = true;
    }

    accept(module(), { Auth });

    const before = Auth.new();
    const after = Auth.new();

    expect(Context.root.get(Auth)).toBe(after);
    expect(before.get(null)).toBe(true);
    expect(warn).toHaveBeenCalledOnce();

    Auth.new();

    expect(warn).toHaveBeenCalledOnce();
  });
});
