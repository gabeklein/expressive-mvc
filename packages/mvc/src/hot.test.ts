import { afterEach, describe, expect, it, vi } from 'vitest';

import { Component, State } from '.';
import { parseAst } from 'vite';

import { accept, inject as hot, verify } from './hot';

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

      Test.on(() => {});
      Test.on({ after() {} });
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

    Test.on((self) => {
      Object.defineProperty(self, 'label', {
        configurable: true,
        get: () => () => 'own',
        set: received
      });
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
      if (handler) Test.on(handler);
      return Test;
    };

    const Test = version(before);

    accept(id, { Test });
    Test.on(outside);
    accept(id, { Test: version(after) });
    Test.new();

    expect(before).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledTimes(1);
    expect(outside).toHaveBeenCalledTimes(1);
  });

  it('will add handlers to a class without', () => {
    const id = module();
    const handler = vi.fn();

    const version = (handler?: () => void) => {
      class Test extends State {}
      if (handler) Test.on(handler);
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
});

describe('verify', () => {
  class Test extends State {}

  it('will pass without next exports', () => {
    expect(verify({ Test }, undefined, true)).toBeUndefined();
  });

  it('will pass unchanged exports', () => {
    expect(verify({ Test, value: 1 }, { Test, value: 1 }, true)).toBeUndefined();
  });

  it('will pass a changed component', () => {
    const App = () => null;

    expect(verify({ App }, { App: () => null }, true)).toBeUndefined();
  });

  it('will reload for a changed State class', () => {
    expect(verify({ Test }, { Test: class Test extends State {} }, true)).toBe('reload');
  });

  it('will reject another changed export', () => {
    expect(verify({ value: 1 }, { value: 2 }, true)).toBe('"value" export cannot be hot-patched.');
  });

  it('will reject a changed component the host does not refresh', () => {
    const App = () => null;

    expect(verify({ App }, { App: () => null }, false)).toBe('"App" export cannot be hot-patched.');
  });

  it('will reject a removed export', () => {
    expect(verify({ App: () => null }, {}, true)).toBe('"App" export cannot be hot-patched.');
  });
});

describe('inject', () => {
  const inject = (code: string, id = '/src/app.js') => hot(id, parseAst(code));

  const exports = (code: string) =>
    inject(`class Store {}\n${code}`).match(/const __exports = \{ (.*) \};/)![1];

  it('will return nothing without classes', () => {
    expect(inject('export const title = "no class";')).toBe('');
  });

  it('will bind top-level classes', () => {
    const code = inject('class A {}\nlet B = class {};\nvar C = class {};');

    expect(code).toContain(`import { hot as __expressive } from '@expressive/mvc/runtime';`);
    expect(code).toContain('__expressive.accept("/src/app.js", { A, B, C })');
    expect(code).toContain('A = __hot.A;');
    expect(code).toContain('B = __hot.B;');
    expect(code).toContain('import.meta.hot.accept(');
  });

  it('will verify for a host which refreshes components', () => {
    expect(inject('class A {}')).toContain('__expressive.verify(__exports, next, true)');
  });

  it('will verify for a host which does not refresh components', () => {
    expect(hot('/src/app.js', parseAst('class A {}'), { refresh: false }))
      .toContain('__expressive.verify(__exports, next, false)');
  });

  it('will not bind a class it cannot reassign', () => {
    expect(inject('class A {}\nconst B = class {};\nlet c = 1, [d] = [2];')).toContain('{ A }');
  });

  it('will bind exported classes', () => {
    const code = inject('export class A {}\nexport default class B {}');

    expect(code).toContain('{ A, B }');
    expect(code).toContain('const __exports = { "A": A, "default": B };');
  });

  it('will record declarations', () => {
    expect(exports('export function helper() {}\nexport let a = 1, [b] = [2];'))
      .toBe('"helper": helper, "a": a');
  });

  it('will record specifiers by local name', () => {
    expect(exports('export { Store as Model, Store as "with-dash" };'))
      .toBe('"Model": Store, "with-dash": Store');
  });

  it('will ignore re-exports', () => {
    expect(exports("export { other } from './other';\nexport { Store };")).toBe('"Store": Store');
  });

  it('will record a default binding', () => {
    expect(exports('export default Store;')).toBe('"default": Store');
    expect(exports('export default function App() {}')).toBe('"default": App');
  });

  it('will not record an anonymous default', () => {
    expect(exports('export default function () {}')).toBe('');
  });
});
