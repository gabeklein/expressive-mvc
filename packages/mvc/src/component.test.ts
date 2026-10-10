import { describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, mockWarn } from '../test.setup';
import { Component, compose } from './component';
import { Context } from './context';
import { State, event } from './state';

it('will default fallback to null and accept it as prop', () => {
  expect(Component.new().fallback).toBe(null);
  expect(Component.new({}).fallback).toBe(null);
  expect(Component.new({ fallback: 'Loading' }).fallback).toBe('Loading');
});

it('will render children by default', () => {
  expect(Component.new({ children: 'hello' }).render()).toBe('hello');
  expect(Component.new({}).render()).toBe(null);
});

it('will derive key from instance identity', () => {
  const foo = Component.new({});

  expect(foo.key).toBe(String(foo));
  expect(foo.hasOwnProperty('key')).toBe(false);
  expect(Object.keys(foo.get())).not.toContain('key');
});

it('will allow key override', () => {
  class Foo extends Component {
    override readonly key = 'foo';
  }

  const foo = Foo.new({});

  expect(foo.key).toBe('foo');
  expect(Object.keys(foo)).not.toContain('key');
  expect(Object.keys(foo.get())).not.toContain('key');
  expect(() => ((foo as any).key = 'bar')).toThrow();
});

it('will lock key after imperative write', () => {
  const foo = Component.new({ });

  (foo as any).key = 'imperative';

  expect(foo.key).toBe('imperative');
  expect(Object.keys(foo.get())).not.toContain('key');
  expect(() => ((foo as any).key = 'again')).toThrow();
});

it('will call is callback once with instance', () => {
  const is = vi.fn();
  const foo = Component.new({ is });

  expect(is).toBeCalledWith(foo);
  expect(is).toBeCalled();

  // ressigning props from another render.
  (foo as any).props = { is };

  expect(is).toHaveBeenCalledTimes(1);
});

it('will merge state and reset omitted props when reassigned', async () => {
  class Foo extends Component {
    value?: number = 10;
    other?: number = 1;
  }

  const foo = Foo.new({ value: 5, other: 2 });

  expect(foo.value).toBe(5);
  expect(foo.other).toBe(2);

  (foo as any).props = { value: 7 };
  await foo.set();

  expect(foo.value).toBe(7);
  expect(foo.other).toBeUndefined();
});

it('will accept _ keys as props', async () => {
  class Foo extends Component {
    _config?: string = 'foo';
  }

  const foo = Foo.new({ _config: 'bar' });

  expect(foo._config).toBe('bar');

  (foo as any).props = { _config: 'baz' };
  await foo.set();

  expect(foo._config).toBe('baz');
});

// Seam: React may instantiate the class twice with the same props object
// (StrictMode) and keeps either the first (16-17) or the second (18+). Each
// construction is a full instance; whichever activates releases the other.
describe('twin construction', () => {
  class Child extends State {}

  class Foo extends Component {
    child = new Child();
    #secret = 'foo';

    reveal() {
      return this.#secret;
    }
  }

  for (const keep of ['first', 'second'] as const)
    it(`will release the twin when the ${keep} activates`, async () => {
      const warn = mockWarn();
      const props = { value: 1 };

      const a = new Foo(props);
      const b = new Foo(props);
      const [kept, other] = keep == 'first' ? [a, b] : [b, a];
      const released = vi.fn();

      expect(b).not.toBe(a);

      other.get(null, released);
      event(kept);

      await flushMicrotasks();

      expect(kept.reveal()).toBe('foo');
      expect(released).toBeCalledTimes(1);
      expect(warn).not.toBeCalled();
    });

  it('will warn for each twin never activated', async () => {
    const warn = mockWarn();
    const props = { value: 1 };

    new Component(props);
    new Component(props);

    await flushMicrotasks();

    expect(warn).toBeCalledTimes(2);
  });
});

// Seam: React passes context as a constructor argument alongside props.
// Context instances must be filtered so they never apply as state overlays.
it('will ignore Context passed as constructor argument', () => {
  class Foo extends Component {
    value?: number = 10;
  }

  const foo = Foo.new({ value: 5 }, new Context() as any);

  expect(foo.value).toBe(5);
  expect(Object.keys(foo.get())).not.toContain('0');
});

describe('render chain', () => {
  it('will nest three levels inner to outer', () => {
    class A extends Component {
      render(props = {} as { children?: unknown }): Component.Node {
        return { a: props.children };
      }
    }

    class B extends A {
      render(props = {} as { children?: unknown }): Component.Node {
        return { b: props.children };
      }
    }

    class C extends B {
      render(): Component.Node {
        return 'leaf';
      }
    }

    // A (outermost) wraps B wraps C (innermost content).
    expect(C.new({}).render()).toEqual({ a: { b: 'leaf' } });
  });

  it('will bind each composed layer to live instance state', () => {
    class Frame extends Component {
      title = 'Base';

      render(props = {} as { children?: unknown }): Component.Node {
        return [this.title, props.children];
      }
    }

    class Page extends Frame {
      body = 'Hello';

      render(): Component.Node {
        return this.body;
      }
    }

    const page = Page.new({});

    expect(page.render()).toEqual(['Base', 'Hello']);

    // Both layers read `this` off the same instance - render reflects updates.
    page.title = 'Updated';
    page.body = 'World';

    expect(page.render()).toEqual(['Updated', 'World']);
  });

  // Documented footgun: a wrapper that never reads `props.children` drops the
  // derived content. The children getter is lazy, so inner never even runs.
  it('will drop derived content if wrapper omits children', () => {
    const inner = vi.fn(() => 'never seen');

    class Shell extends Component {
      render(): Component.Node {
        return 'shell only';
      }
    }

    class Lost extends Shell {
      render(): Component.Node {
        return inner();
      }
    }

    expect(Lost.new({}).render()).toBe('shell only');
    expect(inner).not.toHaveBeenCalled();
  });

  it('will preserve identity for single-level override', () => {
    class Solo extends Component {
      render(): Component.Node {
        return 'just me';
      }
    }

    // One override composes with the pass-through default to exactly itself.
    expect(Solo.new({}).render()).toBe('just me');
  });

  // Intentional inverse of the footgun: a base may opt out of wrapping by
  // detecting that a subclass supplied content. Composition synthesizes a fresh
  // `children`, so it is not identical to the original `this.props.children`.
  it('lets a base defer to a subclass render via children identity', () => {
    class Base extends Component {
      render(props = {} as { children?: unknown }): Component.Node {
        if (props.children !== this.props.children)
          return props.children;

        return ['base', props.children];
      }
    }

    class Override extends Base {
      render(): Component.Node {
        return 'replaced';
      }
    }

    class Passthrough extends Base {}

    // Subclass authored a render -> base defers, no wrapping.
    expect(Override.new({}).render()).toBe('replaced');

    // Plain base and render-less subclass keep the base output (no composition
    // layer, so `children` is the original props.children). The framework
    // invokes render with the instance's own props - mirror that here.
    const base = Base.new({ children: 'x' });
    const pass = Passthrough.new({ children: 'y' });
    expect(base.render(base.props)).toEqual(['base', 'x']);
    expect(pass.render(pass.props)).toEqual(['base', 'y']);
  });
});

describe('leading function argument', () => {
  it('will run as init callback (State semantics)', () => {
    class Test extends Component {
      value = '';
    }

    const test = Test.new(function (this: Test) {
      this.value = 'initialized';
    });

    expect(test.value).toBe('initialized');
  });

  it('will register returned function as cleanup', () => {
    const cleanup = vi.fn();
    const test = Component.new(() => cleanup);

    expect(cleanup).not.toHaveBeenCalled();
    test.set(null);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('props (static types)', () => {
  class Test extends Component {
    value = 0;
    onClick = () => {};
    readonly id = 1;
    get computed() { return this.value * 2 }
    get pair() { return this.value }
    set pair(next: number) { this.value = next }
    method() {}
  }

  it('will accept a subclass where its parent is expected', () => {
    class Mesh extends Component {
      label = 'x';
    }

    class Ball extends Mesh {
      radius = 1;
    }

    const take = (mesh: Mesh): Component => mesh;
    const Type: typeof Mesh = Ball;

    expect(take(Ball.new())).toBeInstanceOf(Mesh);
    expect(Type).toBe(Ball);
  });

  it('will accept writable fields and callbacks only', () => {
    const props: Component.StateProps<Test>[] = [
      { value: 1, onClick: () => {}, pair: 2, method() {} },
      // @ts-expect-error - get-only accessor is not a settable prop
      { computed: 4 },
      // @ts-expect-error - readonly field is not a settable prop
      { id: 2 }
    ];

    expect(props).toHaveLength(3);
  });
});

describe('composed', () => {
  it('will compose render layers of a State', () => {
    class Frame extends State {
      render(props?: { children?: unknown }) {
        return `[${props?.children}]`;
      }
    }

    class Page extends Frame {
      render() {
        return 'page';
      }
    }

    const page = Page.new();

    expect(compose.call(page, {})).toBe('[page]');
  });

  it('will compose a render sealed by the host', () => {
    class Frame extends State {
      render(props?: { children?: unknown }) {
        return `[${props?.children}]`;
      }
    }

    Frame.on({
      type({ prototype }) {
        const desc = Object.getOwnPropertyDescriptor(prototype, 'render')!;
        Object.defineProperty(prototype, 'render', { ...desc, configurable: false });
      }
    });

    class Page extends Frame {
      render() {
        return 'page';
      }
    }

    const page = Page.new();

    expect(compose.call(page, {})).toBe('[page]');
  });

  it('will pass children through for a State without render', () => {
    class Bare extends State {}

    const bare = Bare.new();

    expect(compose.call(bare, { children: 'c' })).toBe('c');
  });
});

describe('for', () => {
  class Session extends State {
    name = 'none';
  }

  it('will construct and provide a class', () => {
    const is = vi.fn();
    const provider = Component.new({ for: Session, name: 'Ada', is } as any);
    const context = new Context().push(provider);
    const session = context.get(Session);

    expect(session.name).toBe('Ada');
    expect(is).toBeCalledWith(session);
    expect(is).not.toBeCalledWith(provider);
  });

  it('will destroy a provided class with the provider', () => {
    const provider = Component.new({ for: Session } as any);
    const context = new Context().push(provider);
    const session = context.get(Session);

    provider.set(null);

    expect(session.get(null)).toBe(true);
  });

  it('will provide an instance without owning it', () => {
    const session = Session.new();
    const provider = Component.new({ for: session, name: 'Ada' } as any);
    const context = new Context().push(provider);

    expect(context.get(Session)).toBe(session);
    expect(session.name).toBe('Ada');

    provider.set(null);

    expect(session.get(null)).toBe(false);
  });

  it('will adopt an instance not yet active', () => {
    const session = new Session();
    const provider = Component.new({ for: session } as any);

    expect(new Context().push(provider).get(Session)).toBe(session);

    provider.set(null);

    expect(session.get(null)).toBe(true);
  });

  it('will forward props on update', async () => {
    const provider = Component.new({ for: Session, name: 'Ada' } as any);
    const context = new Context().push(provider);
    const session = context.get(Session);

    (provider as any).props = { for: Session, name: 'Grace' };
    await expect(session).toHaveUpdated('name');

    expect(session.name).toBe('Grace');
    expect(context.get(Session)).toBe(session);
  });

  it('will release the previous item when for changes', async () => {
    const provider = Component.new({ for: Session } as any);
    const context = new Context().push(provider);
    const first = context.get(Session);
    const next = Session.new();

    (provider as any).props = { for: next };
    await flushMicrotasks();

    expect(first.get(null)).toBe(true);
    expect(context.get(Session)).toBe(next);

    (provider as any).props = {};
    await flushMicrotasks();

    expect(next.get(null)).toBe(false);
    expect(context.get(Session, false)).toBeUndefined();
  });

  it('will mount only a class it constructed', () => {
    const cleanup = vi.fn();

    class Owned extends State {
      mount() {
        return cleanup;
      }
    }

    const owned = Component.new({ for: Owned } as any) as any;
    const placed = Component.new({ for: Owned.new() } as any) as any;
    const plain = Component.new({ for: Session } as any) as any;

    owned.mount()();
    placed.mount()();
    plain.mount()();

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will hand mount to the next class when for changes', async () => {
    const log: string[] = [];

    const tracked = (name: string) => class extends State {
      mount() {
        log.push(name + ':mount');
        return () => log.push(name + ':unmount');
      }

      protected new() {
        return () => log.push(name + ':destroy');
      }
    };

    const First = tracked('first');
    const Second = tracked('second');
    const provider = Component.new({ for: First } as any) as any;
    const release = provider.mount();

    provider.props = { for: Second };
    await flushMicrotasks();

    provider.props = { for: Session };
    await flushMicrotasks();

    release();

    expect(log).toEqual([
      'first:mount',
      'first:unmount',
      'first:destroy',
      'second:mount',
      'second:unmount',
      'second:destroy'
    ]);
  });

  it('will keep a mount defined before it provides', () => {
    const order: string[] = [];

    class Owned extends State {
      mount() {
        order.push('owned');
        return () => order.push('owned:done');
      }
    }

    const stop = Component.on({
      setup(self) {
        Object.defineProperty(self, 'mount', {
          configurable: true,
          value: () => {
            order.push('inherited');
            return () => order.push('inherited:done');
          }
        });
      }
    });

    const provider = Component.new({ for: Owned } as any) as any;

    stop();
    provider.mount()();

    expect(order).toEqual(['inherited', 'owned', 'owned:done', 'inherited:done']);
  });

  it('will not default a boundary', () => {
    const provider = Component.new({ for: Session } as any);
    const bounded = Component.new({ for: Session, fallback: 'wait' } as any);

    expect(provider.fallback).toBe(false);
    expect(bounded.fallback).toBe('wait');
  });

  it('will not provide from a subclass', () => {
    class Sub extends Component {}

    const sub = Sub.new({ for: Session } as any);
    const context = new Context().push(sub);

    expect(sub.fallback).toBe(null);
    expect(context.get(Session, false)).toBeUndefined();
  });
});
