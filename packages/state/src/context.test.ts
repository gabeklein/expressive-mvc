import { vi, describe, it, expect } from 'vitest';
import { find, include, apply, detach, parent, link, PARENT, PROVIDE } from './context';
import type { Expect } from './context';
import { State } from './state';
import { event } from './observable';

class Example extends State {}
class Example2 extends Example {}

/** Create a host state with PROVIDE initialized. */
function host() {
  const h = Example.new();
  PROVIDE.set(h, new Map());
  return h;
}

it('will add instance to context', () => {
  const h = host();
  const example = Example.new();

  include(h, example);
  event(example);

  expect(find(h, Example)).toBe(example);
});

it('will create instance in context', () => {
  const h = host();

  apply(h, Example);

  expect(find(h, Example)).toBeInstanceOf(Example);
});

it("will throw if context doesn't exist", () => {
  const h = host();

  const attempt = () => find(h, Example);

  expect(attempt).toThrow('Could not find Example in context.');
});

it('will not create base State', () => {
  const h = host();

  // @ts-expect-error
  expect(() => apply(h, State)).toThrow('Cannot create base State.');
});

it('will include children of State', () => {
  class Test extends State {
    example = new Example();
  }

  const h = host();

  apply(h, Test);

  expect(find(h, Example)).toBeInstanceOf(Example);
});

it('will access upstream controller', () => {
  const h = host();
  const example = Example.new();

  include(h, example);
  event(example);

  const child = host();
  link(h, child);

  expect(find(child, Example)).toBe(example);
});

it('will register all subtypes', () => {
  const h = host();
  const example2 = new Example2();

  include(h, example2);
  event(example2);

  expect(find(h, Example2)).toBe(example2);
  expect(find(h, Example)).toBe(example2);
});

it('will return undefined if not required', () => {
  const h = host();
  const got = find(h, Example, false);

  expect(got).toBeUndefined();
});

it('will register children implicitly', () => {
  class Foo extends State {}
  class Bar extends State {
    foo = new Foo();
  }

  const h = host();
  const bar = new Bar();

  include(h, bar);
  event(bar);

  expect(find(h, Bar)).toBe(bar);
  expect(find(h, Foo)).toBe(bar.foo);
});

it('will drop implicit child when property is overwritten', () => {
  class Foo extends State {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends State {
    child: Foo = foo1;
  }

  const h = host();
  apply(h, Parent);
  const p = find(h, Parent);

  expect(find(h, Foo)).toBe(foo1);

  p.child = foo2;

  expect(find(h, Foo)).toBe(foo2);
});

it('will notify downstream subscriber when implicit child is replaced', () => {
  class Foo extends State {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends State {
    child: Foo = foo1;
  }

  const h = host();
  const p = new Parent();
  include(h, p);
  event(p);

  const cb = vi.fn();
  find(h, Foo, cb);

  expect(cb).toBeCalledTimes(1);
  expect(cb).toBeCalledWith(foo1, false, true);

  p.child = foo2;

  expect(cb).toBeCalledTimes(2);
  expect(cb.mock.calls[1][0]).toBe(foo2);
});

it('will collide implicit children with shared ancestor', () => {
  class Foo extends State {}
  class Bar extends Foo {}

  class Parent extends State {
    foo = new Foo();
    bar = new Bar();
  }

  const h = host();
  apply(h, Parent);

  expect(find(h, Bar)).toBeInstanceOf(Bar);
  expect(find(h, Foo)).toBeNull();
});

it('will uncollide when one implicit child is removed', () => {
  class Foo extends State {}
  class Bar extends Foo {}

  class Parent extends State {
    foo: Foo | undefined = new Foo();
    bar = new Bar();
  }

  const h = host();
  apply(h, Parent);
  const p = find(h, Parent);

  expect(find(h, Foo)).toBeNull();

  p.foo = undefined;

  expect(find(h, Foo)).toBeInstanceOf(Bar);
});

it('will detach children recursively', () => {
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
  const h = host();

  apply(h, Test);

  const mid = host();
  link(h, mid);
  apply(mid, Test2);

  const leaf = host();
  link(mid, leaf);
  apply(leaf, Test3);

  detach(h);

  expect(didDestroy).toBeCalledWith(1, 'Test3');
  expect(didDestroy).toBeCalledWith(2, 'Test2');
  expect(didDestroy).toBeCalledWith(3, 'Test');
});

describe('has method', () => {
  class DownstreamState extends State {}

  it('will call callback when type is added downstream', () => {
    const h = host();
    const cb = vi.fn();

    find(h, DownstreamState, cb);

    const child = host();
    link(h, child);
    apply(child, DownstreamState);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(DownstreamState);
  });

  it('will clean up callback on cancel', () => {
    const h = host();
    const cb = vi.fn();

    const cancel = find(h, DownstreamState, cb);

    const child = host();
    link(h, child);
    apply(child, DownstreamState);

    expect(cb).toBeCalledTimes(1);

    cancel();

    const child2 = host();
    link(h, child2);
    apply(child2, DownstreamState);

    expect(cb).toBeCalledTimes(1);

    detach(h);
  });

  it('will call cleanup when state is removed', () => {
    const h = host();
    const cleanup = vi.fn();
    const cb = vi.fn(() => cleanup);

    find(h, DownstreamState, cb);

    const child = host();
    link(h, child);
    apply(child, DownstreamState);

    expect(cb).toBeCalledTimes(1);

    detach(child);

    expect(cleanup).toBeCalledTimes(1);
    expect(cb).toBeCalledTimes(1);
  });

  it('will return entries registered downstream', () => {
    const h = host();
    const child = host();
    link(h, child);
    apply(child, DownstreamState);

    const entries = find(h, DownstreamState, true);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toBeInstanceOf(DownstreamState);
  });

  it('will return entries from deeply nested children', () => {
    const root = host();
    const mid = host();
    link(root, mid);
    const leaf = host();
    link(mid, leaf);
    apply(leaf, DownstreamState);

    const entries = find(root, DownstreamState, true);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toBeInstanceOf(DownstreamState);
  });

  it('will skip nodes without matching type', () => {
    class Unrelated extends State {}

    const root = host();
    const child = host();
    link(root, child);
    apply(child, Unrelated);

    expect(find(root, DownstreamState, true)).toHaveLength(0);
  });

  it('will call callback for already-registered downstream states', () => {
    const h = host();
    const child = host();
    link(h, child);
    apply(child, DownstreamState);

    const existing = find(child, DownstreamState);
    const cb = vi.fn();

    find(h, DownstreamState, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(existing, true, true);
  });

  it('will flag existing vs new in callback', () => {
    const h = host();
    const child = host();
    link(h, child);
    apply(child, DownstreamState);

    const cb = vi.fn();
    find(h, DownstreamState, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(expect.any(DownstreamState), true, true);

    const child2 = host();
    link(h, child2);
    apply(child2, DownstreamState);

    expect(cb).toBeCalledTimes(2);
    expect(cb).toBeCalledWith(expect.any(DownstreamState), true, false);
  });

  it('will notify has-subscriber for state created before context', () => {
    const h = host();
    const child = host();
    link(h, child);

    const cb = vi.fn();
    find(h, DownstreamState, cb);

    const state = DownstreamState.new();
    apply(child, state);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(state, true, false);
  });
});

describe('get callback (upstream subscription)', () => {
  class Upstream extends State {}

  it('will call callback when type is added to parent', () => {
    const h = host();
    const child = host();
    link(h, child);

    const cb = vi.fn();
    find(child, Upstream, cb);

    apply(h, Upstream);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(Upstream);
  });

  it('will cancel subscription', () => {
    const h = host();
    const child = host();
    link(h, child);

    const cb = vi.fn();
    const cancel = find(child, Upstream, cb);
    cancel();

    apply(h, Upstream);

    expect(cb).not.toBeCalled();
  });

  it('will call cleanup returned from callback', () => {
    const h = host();
    const child = host();
    link(h, child);

    const cleanup = vi.fn();
    const cb = vi.fn(() => cleanup);

    find(child, Upstream, cb);
    apply(h, Upstream);

    expect(cb).toBeCalledTimes(1);

    detach(h);

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will call callback for already-registered upstream state', () => {
    const h = host();
    apply(h, Upstream);

    const child = host();
    link(h, child);

    const cb = vi.fn();
    find(child, Upstream, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(expect.any(Upstream), false, true);
  });

  it('will flag existing vs new upstream in callback', () => {
    const h = host();
    const child = host();
    link(h, child);

    const cb = vi.fn();
    find(child, Upstream, cb);

    expect(cb).not.toBeCalled();

    apply(h, Upstream);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(expect.any(Upstream), false, false);
  });
});

describe('apply method', () => {
  it('will register multiple', () => {
    class Foo extends State {}
    class Bar extends State {}

    const foo = Foo.new();
    const bar = Bar.new();

    const h = host();
    apply(h, { foo, bar });

    expect(find(h, Foo)).toBe(foo);
    expect(find(h, Bar)).toBe(bar);
  });

  it('will complain if multiple of same type', () => {
    const h = host();
    apply(h, { e1: Example, e2: Example });

    const fetch = () => find(h, Example);

    expect(fetch).toThrow(
      `Did find Example in context, but multiple were defined.`
    );
  });

  it('will ignore if multiple of same instance', () => {
    const example = Example.new();
    const h = host();
    apply(h, { e1: example, e2: example });

    const got = find(h, Example);

    expect(got).toBe(example);
  });

  it('will prefer explicit over implicit', () => {
    class Foo extends State {}
    class Bar extends State {
      foo = new Foo();
    }

    const foo = new Foo();
    const foobar = new Bar();
    const h = host();

    apply(h, { foo, Bar: foobar });

    expect(find(h, Bar)).toBe(foobar);
    expect(find(h, Foo)).not.toBe(foobar.foo);
    expect(find(h, Foo)).toBe(foo);
  });

  it('will destroy state created by layer', () => {
    class Test extends State {
      destroyed = vi.fn();

      new() {
        return this.destroyed;
      }
    }

    class Test1 extends Test {}
    class Test2 extends Test {}
    class Test3 extends Test {}

    const test2 = Test2.new();

    const h = host();
    apply(h, { Test1 });

    const child = host();
    link(h, child);
    apply(child, { test2, Test3 });

    const test1 = find(h, Test1)!;
    const test3 = find(child, Test3)!;

    detach(child);

    expect(test1.destroyed).not.toBeCalled();
    expect(test2.destroyed).not.toBeCalled();
    expect(test3.destroyed).toBeCalled();
  });

  it('will throw on bad include', () => {
    const Thing = { toString: () => 'Foobar' };
    const h = host();

    // @ts-ignore
    expect(() => apply(h, { Thing })).toThrow(
      'Context can only include an instance or class of State but got'
    );
  });

  it('will throw on base State include', () => {
    const h = host();

    // @ts-ignore
    expect(() => apply(h, { State })).toThrow('Cannot create base State.');
  });

  it('will throw on bad include property', () => {
    const Thing = { toString: () => 'Foobar' };
    const h = host();

    // @ts-ignore
    expect(() => apply(h, { Thing })).toThrow(
      "Context can only include an instance or class of State but got Foobar (as 'Thing')."
    );
  });

  it('will throw on bad include property (no alias)', () => {
    const Thing = { toString: () => 'Thing' };
    const h = host();

    // @ts-ignore
    expect(() => apply(h, { [0]: Thing })).toThrow(
      'Context can only include an instance or class of State but got Thing.'
    );
  });

  it('will callback once per unique added', () => {
    class Foo extends State {}
    class Bar extends State {}

    const foo = Foo.new();
    const bar = Bar.new();
    const cb = vi.fn();

    const h = host();

    apply(h, { foo, bar }, cb);

    expect(cb).toBeCalledWith(foo, false, false);
    expect(cb).toBeCalledWith(bar, false, false);
    expect(cb).toBeCalledTimes(2);

    apply(h, { foo, bar }, cb);

    expect(cb).toBeCalledTimes(2);

    const foo2 = Foo.new();

    apply(h, { foo, bar, foo2 }, cb);

    expect(cb).toBeCalledWith(foo2, false, false);
    expect(cb).toBeCalledTimes(3);
  });

  it('will ignore subsequent if callback', () => {
    class Foo extends State {}

    const cb = vi.fn();
    const h = host();

    apply(h, Foo, cb);
    apply(h, Foo, cb);

    expect(find(h, Foo)).toBeInstanceOf(Foo);

    expect(cb).toBeCalledTimes(1);
  });

  it('will remove and delete state of type absent', () => {
    class Bar extends State {
      didDie = vi.fn();

      protected new() {
        return this.didDie;
      }
    }

    const h = host();
    apply(h, { Bar });
    const bar = find(h, Bar);

    apply(h, {});

    expect(bar.didDie).toBeCalled();
    expect(find(h, Bar, false)).toBeUndefined();
  });

  it('will replace owned instance when key changes', () => {
    class Baz extends State {
      didDie = vi.fn();

      protected new() {
        return this.didDie;
      }
    }

    class Baz2 extends State {}

    const h = host();
    apply(h, { Baz });
    const baz = find(h, Baz);

    apply(h, { Baz: Baz2 });

    expect(baz.didDie).toBeCalled();
    expect(find(h, Baz, false)).toBeUndefined();
    expect(find(h, Baz2)).toBeInstanceOf(Baz2);
  });

  it('will remove non-owned instance without destroying it', () => {
    class Bar extends State {}

    const bar = Bar.new();
    const h = host();
    apply(h, { bar });

    expect(find(h, Bar)).toBe(bar);

    apply(h, {});

    expect(find(h, Bar, false)).toBeUndefined();
    expect(bar.is).not.toBeNull();
  });

  it('will set multiple types and cleanup all', () => {
    class A extends State {}
    class B extends State {}

    const h = host();
    apply(h, { A, B });

    expect(find(h, A)).toBeInstanceOf(A);
    expect(find(h, B)).toBeInstanceOf(B);

    detach(h);

    expect(find(h, A, false)).toBeUndefined();
    expect(find(h, B, false)).toBeUndefined();
  });

  it('will remove state from registry on cleanup', () => {
    class Foo extends State {}

    const h = host();
    apply(h, Foo);

    expect(find(h, Foo)).toBeInstanceOf(Foo);

    detach(h);

    expect(find(h, Foo, false)).toBeUndefined();
  });

  it('will clean up subtype keys on delete', () => {
    class Base extends State {}
    class Child extends Base {}

    const h = host();
    apply(h, { Child });

    expect(find(h, Child)).toBeInstanceOf(Child);
    expect(find(h, Base)).toBeInstanceOf(Child);

    apply(h, {});

    expect(find(h, Child, false)).toBeUndefined();
    expect(find(h, Base, false)).toBeUndefined();
  });
});

describe('ambiguous implicit entries', () => {
  it('will not call callback when two implicit entries of same type exist', () => {
    class Base extends State {}
    class ChildA extends Base {}
    class ChildB extends Base {}

    const h = host();

    include(h, ChildA.new(), true);
    include(h, ChildB.new(), true);

    const cb = vi.fn();
    const child = host();
    link(h, child);

    find(child, Base, cb);

    expect(cb).not.toBeCalled();
  });

  it('will throw on multiple explicit entries of same type in callback get', () => {
    class Base extends State {}

    const h = host();
    const a = Base.new();
    const b = Base.new();

    include(h, a);
    include(h, b);

    const cb = vi.fn();

    expect(() => find(h, Base, cb)).toThrow(
      'Did find Base in context, but multiple were defined.'
    );
  });

  it('will ignore implicit when explicit already found in callback get', () => {
    class Base extends State {}

    const h = host();
    const explicit = Base.new();
    const implicit = Base.new();

    include(h, explicit);
    include(h, implicit, true);

    const cb = vi.fn();
    find(h, Base, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(explicit, false, true);
  });

  it('will deduplicate same state in callback get entries', () => {
    class Base extends State {}

    const h = host();
    const a = Base.new();

    include(h, a);
    include(h, a);

    const cb = vi.fn();
    find(h, Base, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(a, false, true);
  });
});

describe('include listener lookup', () => {
  it('will notify listeners on child when state added to parent', () => {
    class Foo extends State {}

    const h = host();
    const child = host();
    link(h, child);

    const cb = vi.fn();
    find(child, Foo, cb);

    apply(h, Foo);

    expect(cb).toBeCalledTimes(1);
  });

  it('will notify listeners on parent when state added to child', () => {
    class Foo extends State {}

    const h = host();
    const cb = vi.fn();

    find(h, Foo, cb);

    const child = host();
    link(h, child);
    apply(child, Foo);

    expect(cb).toBeCalledTimes(1);
  });

  it('will deduplicate callbacks across hierarchy in include', () => {
    class Foo extends State {}
    class Bar extends Foo {}

    const h = host();
    const cb = vi.fn();

    find(h, Foo, cb);

    const child = host();
    link(h, child);
    apply(child, Bar);

    expect(cb).toBeCalledTimes(1);
  });

  it('will deduplicate callback in above path during include', () => {
    class Foo extends State {}

    const grandparent = host();
    const p = host();
    link(grandparent, p);
    const child = host();
    link(p, child);

    const cb = vi.fn();
    find(grandparent, Foo, cb);
    find(p, Foo, cb);

    apply(child, Foo);

    expect(cb).toBeCalledTimes(1);
  });

  it('will skip child without matching listener type in below path', () => {
    class Foo extends State {}
    class Bar extends State {}

    const h = host();
    const child = host();
    link(h, child);

    find(child, Bar, vi.fn());

    apply(h, Foo);

    expect(find(h, Foo)).toBeInstanceOf(Foo);
  });

  it('will deduplicate callback found in both above and below during include', () => {
    class Foo extends State {}

    const h = host();
    const middle = host();
    link(h, middle);
    const child = host();
    link(middle, child);

    const cb = vi.fn();
    find(h, Foo, cb);
    find(child, Foo, cb);

    apply(middle, Foo);

    expect(cb).toBeCalledTimes(1);
  });
});

describe('parent function', () => {
  it('will return parent state', () => {
    const h = host();
    const child = Example.new();
    include(h, child);

    expect(parent(child)).toBe(h);
  });

  it('will return undefined if no parent', () => {
    const h = host();

    expect(parent(h)).toBeUndefined();
  });
});
