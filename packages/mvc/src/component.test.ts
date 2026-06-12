import { expect, it, mock } from 'bun:test';
import { Component } from './component';
import { Context } from './context';
import { describe } from 'bun:test';

it('will default fallback to null', () => {
  const foo = Component.new({});

  expect(foo.fallback).toBe(null);
});

it('will accept fallback as prop', () => {
  const foo = Component.new({ fallback: 'Loading' });

  expect(foo.fallback).toBe('Loading');
});

it('will render children by default', () => {
  const foo = Component.new({ children: 'hello' });

  expect(foo.render()).toBe('hello');
});

it('will render null without children', () => {
  const foo = Component.new({});

  expect(foo.render()).toBe(null);
});

it('will call is callback once with instance', () => {
  const is = mock();
  const foo = Component.new({ is });

  expect(is).toBeCalledWith(foo);
  expect(is).toHaveBeenCalledTimes(1);

  // ressigning props from another render.
  (foo as any).props = { is };

  expect(is).toHaveBeenCalledTimes(1);
});

it('will merge state when props reassigned', async () => {
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
});

it('will reset omitted props on reassignment', async () => {
  class Foo extends Component {
    value?: number = 10;
    other?: number = 1;
  }

  const foo = Foo.new({ value: 5, other: 2 });

  (foo as any).props = { value: 7 };
  await foo.set();

  expect(foo.other).toBeUndefined();
});

// Seam: React may instantiate the class twice with the same props object
// (e.g. StrictMode / reconciliation) before init completes. The second
// construction must return the first instance, not a duplicate.
it('will dedupe construction by props object', () => {
  const props = { value: 1 };

  const a = new Component(props);
  const b = new Component(props);

  expect(b).toBe(a);
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
  // Render layering: a subclass authors content; each super render up the
  // prototype chain wraps it as `children`, base-outermost. Asserted directly
  // on the composed `render` - no host needed.
  it('will compose subclass render as children of super', () => {
    class Outer extends Component {
      render(props = {} as { children?: unknown }): Component.Node {
        return ['outer', props.children];
      }
    }

    class Inner extends Outer {
      render(): Component.Node {
        return 'content';
      }
    }

    expect(Inner.new({}).render()).toEqual(['outer', 'content']);
  });

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
    const inner = mock(() => 'never seen');

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
    const cleanup = mock();
    const test = Component.new(() => cleanup);

    expect(cleanup).not.toHaveBeenCalled();
    test.set(null);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
