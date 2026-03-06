import { vi, describe, it, expect } from 'vitest';
import { context, get, has, register, push, pop } from './context';
import { State } from './state';

class Root extends State {}
class Example extends State {}
class Example2 extends Example {}

it('will add instance to context', () => {
  const scope = push(Root.new());
  const example = Example.new();

  register(example, scope);

  expect(get(scope, Example)).toBe(example);
});

it('will create instance in context', () => {
  const scope = push(Root.new());

  register(Example, scope);

  expect(get(scope, Example)).toBeInstanceOf(Example);
});

it("will throw if type doesn't exist", () => {
  const scope = push(Root.new());

  expect(() => get(scope, Example)).toThrow(
    'Could not find Example in context.'
  );
});

it('will not create base State', () => {
  const scope = push(Root.new());

  // @ts-expect-error
  expect(() => register(State, scope)).toThrow('Cannot create base State.');
});

it('will include children of State', () => {
  class Test extends State {
    example = new Example();
  }

  const scope = push(Root.new());
  register(Test, scope);

  expect(get(scope, Example)).toBeInstanceOf(Example);
});

it('will access upstream from child scope', () => {
  const parent = push(Root.new());
  const example = Example.new();

  register(example, parent);

  const child = push(parent);

  expect(get(child, Example)).toBe(example);
});

it('will register all subtypes', () => {
  const scope = push(Root.new());
  const example2 = new Example2();

  register(example2, scope);

  expect(get(scope, Example2)).toBe(example2);
  expect(get(scope, Example)).toBe(example2);
});

it('will return undefined if not required', () => {
  const scope = push(Root.new());

  expect(get(scope, Example, false)).toBeUndefined();
});

it('will remove implicit children on pop', () => {
  class Parent extends State {
    child = new Example();
  }

  const scope = push(Root.new());
  register(Parent, scope);
  const parent = get(scope, Parent);

  // child's PARENT is Parent (set in update), not scope
  expect(context(parent.child)).toBe(parent);

  pop(scope);

  // after pop, child state is destroyed so context lookup fails
  expect(get(scope, Example, false)).toBeUndefined();
});

it('child pop is safe to call before parent pop', () => {
  const destroyed = vi.fn();

  class Test extends State {
    protected new() {
      return destroyed;
    }
  }

  const parent = push(Root.new());
  const child = push(parent, Test);

  pop(child);

  expect(destroyed).toBeCalledTimes(1);

  parent && pop(parent);

  expect(destroyed).toBeCalledTimes(1);
});

it('will register children implicitly', () => {
  class Foo extends State {}
  class Bar extends State {
    foo = new Foo();
  }

  const bar = new Bar();
  const scope = push(Root.new());
  register(bar, scope);

  expect(get(scope, Bar)).toBe(bar);
  expect(get(scope, Foo)).toBe(bar.foo);
});

it('will drop implicit child when property is overwritten', () => {
  class Foo extends State {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends State {
    child: Foo = foo1;
  }

  const scope = push(Root.new());
  register(Parent, scope);
  const parent = get(scope, Parent);

  expect(get(scope, Foo)).toBe(foo1);

  parent.child = foo2;

  expect(get(scope, Foo)).toBe(foo2);
});

it('will notify downstream subscriber when implicit child is replaced', () => {
  class Foo extends State {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends State {
    child: Foo = foo1;
  }

  const parent = new Parent();
  const scope = push(Root.new());
  register(parent, scope);
  const cb = vi.fn();

  get(scope, Foo, cb);

  expect(cb).toBeCalledTimes(1);
  expect(cb).toBeCalledWith(foo1, true);

  parent.child = foo2;

  expect(cb).toBeCalledTimes(2);
  expect(cb.mock.calls[1][0]).toBe(foo2);
});

it('will not add stale implicit if property changes before context attaches', () => {
  class Foo extends State {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends State {
    child: Foo = foo1;
  }

  const parent = new Parent();
  parent.child = foo2;

  const scope = push(Root.new());
  register(parent, scope);

  expect(get(scope, Foo)).toBe(foo2);
});

it('will collide implicit children with shared ancestor', () => {
  class Foo extends State {}
  class Bar extends Foo {}

  class Parent extends State {
    foo = new Foo();
    bar = new Bar();
  }

  const scope = push(Root.new());
  register(Parent, scope);

  expect(get(scope, Bar)).toBeInstanceOf(Bar);
  expect(get(scope, Foo)).toBeNull();
});

it('will uncollide when one implicit child is removed', () => {
  class Foo extends State {}
  class Bar extends Foo {}

  class Parent extends State {
    foo: Foo | undefined = new Foo();
    bar = new Bar();
  }

  const scope = push(Root.new());
  register(Parent, scope);
  const parent = get(scope, Parent);

  expect(get(scope, Foo)).toBeNull();

  parent.foo = undefined;

  expect(get(scope, Foo)).toBeInstanceOf(Bar);
});

it('will pop child context', () => {
  let order = 0;

  class Test extends State {
    constructor(...args: State.Args) {
      super(args);
      this.set(() => {
        didDestroy(++order, this.constructor.name);
      }, null);
    }
  }

  class Test2 extends Test {}
  class Test3 extends Test {}

  const didDestroy = vi.fn();
  const root = push(Root.new());

  register(Test, root);
  const child = push(root, Test2);
  push(child, Test3);

  pop(root);

  expect(didDestroy).toBeCalledWith(1, 'Test3');
  expect(didDestroy).toBeCalledWith(2, 'Test2');
  expect(didDestroy).toBeCalledWith(3, 'Test');
});

describe('has method', () => {
  class DownstreamState extends State {}

  it('will call callback when type is added downstream', () => {
    const root = push(Root.new());
    const cb = vi.fn();

    has(root, DownstreamState, cb);
    push(root, DownstreamState);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(DownstreamState);
  });

  it('will clean up callback on cancel', () => {
    const root = push(Root.new());
    const cb = vi.fn();

    const cancel = has(root, DownstreamState, cb);
    push(root, DownstreamState);

    expect(cb).toBeCalledTimes(1);

    cancel();
    push(root, DownstreamState);

    expect(cb).toBeCalledTimes(1);
    pop(root);
  });

  it('will call cleanup when state is removed', () => {
    const root = push(Root.new());
    const cleanup = vi.fn();
    const cb = vi.fn(() => cleanup);

    has(root, DownstreamState, cb);

    const child = push(root, DownstreamState);

    expect(cb).toBeCalledTimes(1);

    pop(child);

    expect(cleanup).toBeCalledTimes(1);
    expect(cb).toBeCalledTimes(1);
  });

  it('will not call callback for new additions after cancel', () => {
    const root = push(Root.new());
    const cb = vi.fn();

    const cancel = has(root, DownstreamState, cb);
    push(root, DownstreamState);

    expect(cb).toBeCalledTimes(1);
    cancel();

    push(root, DownstreamState);

    expect(cb).toBeCalledTimes(1);
    pop(root);
  });

  it('will return entries registered downstream', () => {
    const root = push(Root.new());
    push(root, DownstreamState);

    const entries = has(root, DownstreamState);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toBeInstanceOf(DownstreamState);
  });

  it('will return entries from deeply nested children', () => {
    const root = push(Root.new());

    push(push(root), DownstreamState);

    const entries = has(root, DownstreamState);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toBeInstanceOf(DownstreamState);
  });

  it('will skip scopes without matching type', () => {
    class Unrelated extends State {}
    const root = push(Root.new());

    push(root, Unrelated);

    expect(has(root, DownstreamState)).toHaveLength(0);
  });

  it('will call callback for already-registered downstream states', () => {
    const root = push(Root.new());
    const child = push(root, DownstreamState);
    const existing = get(child, DownstreamState);
    const cb = vi.fn();

    has(root, DownstreamState, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(existing, true);
  });

  it('will flag existing vs new in callback', () => {
    const root = push(Root.new());
    push(root, DownstreamState);
    const cb = vi.fn();

    has(root, DownstreamState, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][1]).toBe(true);

    push(root, DownstreamState);

    expect(cb).toBeCalledTimes(2);
    expect(cb.mock.calls[1][1]).toBeUndefined();
  });

  it('will call callback for multiple existing downstream states', () => {
    const root = push(Root.new());
    push(root, DownstreamState);
    push(root, DownstreamState);
    const cb = vi.fn();

    has(root, DownstreamState, cb);

    expect(cb).toBeCalledTimes(2);
    expect(cb.mock.calls[0][1]).toBe(true);
    expect(cb.mock.calls[1][1]).toBe(true);
  });

  it('will notify has-subscriber for state created before context', () => {
    const root = push(Root.new());
    const cb = vi.fn();

    has(root, DownstreamState, cb);

    const child = push(root);
    const state = DownstreamState.new();

    register(state, child);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBe(state);
  });
});

describe('get callback (upstream subscription)', () => {
  class Upstream extends State {}

  it('will call callback when type is added to parent', () => {
    const parent = push(Root.new());
    const child = push(parent);
    const cb = vi.fn();

    get(child, Upstream, cb);
    register(Upstream, parent);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(Upstream);
  });

  it('will cancel subscription', () => {
    const parent = push(Root.new());
    const child = push(parent);
    const cb = vi.fn();

    const cancel = get(child, Upstream, cb);
    cancel();
    register(Upstream, parent);

    expect(cb).not.toBeCalled();
  });

  it('will call cleanup returned from callback', () => {
    const parent = push(Root.new());
    const child = push(parent);
    const cleanup = vi.fn();
    const cb = vi.fn(() => cleanup);

    get(child, Upstream, cb);
    register(Upstream, parent);

    expect(cb).toBeCalledTimes(1);

    pop(parent);

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will notify get-subscriber when state already has a parent', () => {
    const original = push(Root.new());
    const shared = Upstream.new();

    register(shared, original);

    const parent = push(Root.new());
    const child = push(parent);
    const cb = vi.fn();

    get(child, Upstream, cb);
    register(shared, parent);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBe(shared);
  });

  it('will call callback for already-registered upstream state', () => {
    const parent = push(Root.new());
    register(Upstream, parent);
    const child = push(parent);
    const cb = vi.fn();

    get(child, Upstream, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][1]).toBe(true);
  });

  it('will flag existing vs new upstream in callback', () => {
    const parent = push(Root.new());
    const child = push(parent);
    const cb = vi.fn();

    get(child, Upstream, cb);

    expect(cb).not.toBeCalled();

    register(Upstream, parent);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][1]).toBeUndefined();
  });
});

describe('register and cleanup', () => {
  it('will register multiple via array', () => {
    class A extends State {}
    class B extends State {}

    const scope = push(Root.new());
    const cleanup = register([A, B], scope);

    expect(get(scope, A)).toBeInstanceOf(A);
    expect(get(scope, B)).toBeInstanceOf(B);

    cleanup();

    expect(get(scope, A, false)).toBeUndefined();
    expect(get(scope, B, false)).toBeUndefined();
  });

  it('will remove state from registry when cleanup is called', () => {
    class Foo extends State {}

    const scope = push(Root.new());
    const remove = register(Foo, scope);

    expect(get(scope, Foo)).toBeInstanceOf(Foo);

    remove();

    expect(get(scope, Foo, false)).toBeUndefined();
  });

  it('will clean up subtype keys on delete', () => {
    class Base extends State {}
    class Child extends Base {}

    const scope = push(Root.new());
    register(Child, scope);

    expect(get(scope, Child)).toBeInstanceOf(Child);
    expect(get(scope, Base)).toBeInstanceOf(Child);

    pop(scope);

    expect(get(scope, Child, false)).toBeUndefined();
    expect(get(scope, Base, false)).toBeUndefined();
  });

  it('will prefer explicit over implicit', () => {
    class Foo extends State {}
    class Bar extends State {
      foo = new Foo();
    }

    const foo = new Foo();
    const foobar = new Bar();
    const scope = push(Root.new());

    register(foo, scope);
    register(foobar, scope);

    expect(get(scope, Bar)).toBe(foobar);
    expect(get(scope, Foo)).not.toBe(foobar.foo);
    expect(get(scope, Foo)).toBe(foo);
  });

  it('will collide when two explicit of same type', () => {
    const scope = push(Root.new());

    register(Example, scope);
    register(Example, scope);

    expect(() => get(scope, Example)).toThrow(
      'Did find Example in context, but multiple were defined.'
    );
  });

  it('will ignore if multiple of same instance', () => {
    const example = Example.new();
    const scope = push(Root.new());

    register(example, scope);
    register(example, scope);

    expect(get(scope, Example)).toBe(example);
  });

  it('will remove implicit children when parent is removed', () => {
    class Parent extends State {
      child = new Example();
    }

    const scope = push(Root.new());
    const remove = register(Parent, scope);
    const parent = get(scope, Parent);
    expect(get(scope, Example)).toBe(parent.child);

    remove();

    expect(get(scope, Example, false)).toBeUndefined();
  });
});

describe('context helper', () => {
  class Test extends State {}

  it('will get context parent', () => {
    const scope = push(Root.new());

    const test = new Test();
    register(test, scope);

    expect(context(test)).toBe(scope);
  });

  it('will throw if context not found by default', () => {
    const test = Test.new();

    // test was activated via .new() so PARENT is null (root)
    // context() checks for truthy PARENT, null is falsy
    expect(() => context(test)).toThrow();
  });

  it('will return undefined if required is false', () => {
    const test = Test.new();

    expect(context(test, false)).toBeUndefined();
  });
});
