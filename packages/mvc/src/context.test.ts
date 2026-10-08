import { vi, describe, it, expect } from 'vitest';
import { Context } from './context';
import { State } from './state';

class Example extends State {}
class Example2 extends Example {}

it('will add or create instance in context', () => {
  const example = Example.new();

  expect(new Context(example).get(Example)).toBe(example);
  expect(new Context(Example).get(Example)).toBeInstanceOf(Example);
});

it('will lazily initialize root and UID contexts', () => {
  const contextA = new Context();
  const contextB = new Context();

  expect(Context.root).toBeInstanceOf(Context);
  expect(typeof Context.root.id).toBe('string');
  expect(String(contextA)).toBe('Context-' + contextA.id);
  expect(String(contextA)).not.toBe(String(contextB));
});

it("will throw if context doesn't exist", () => {
  expect(() => new Context().get(Example)).toThrow('Could not find Example in context.');
});

it('will not create base State', () => {
  // @ts-expect-error
  expect(() => new Context(State)).toThrow('Cannot create base State.');
});

it('will access upstream controller', () => {
  const example = Example.new();
  const context = new Context(example);

  expect(context.push().get(Example)).toBe(example);
});

it('will register all subtypes', () => {
  const example2 = new Example2();
  const context = new Context(example2);

  expect(context.get(Example2)).toBe(example2);
  expect(context.get(Example)).toBe(example2);
});

it('will return undefined if not required', () => {
  expect(new Context().get(Example, false)).toBeUndefined();
});

it('will remove implicit children on pop', () => {
  class Parent extends State {
    child = new Example();
  }

  const context = new Context(Parent);
  const { child } = context.get(Parent);

  expect(Context.get(child)).toBe(context);

  context.pop();

  expect(Context.get(child)).toBe(context);
});

it('will not double-destroy when child pops before parent', () => {
  const destroyed = vi.fn();

  class Test extends State {
    protected new() {
      return destroyed;
    }
  }

  const parent = new Context();
  const child = parent.push(Test);

  child.pop();

  expect(destroyed).toBeCalled();

  parent.pop();

  expect(destroyed).toBeCalledTimes(1);
});

it('will register children implicitly', () => {
  class Foo extends State {}
  class Bar extends State {
    foo = new Foo();
  }

  const bar = new Bar();
  const context = new Context(bar);

  expect(context.get(Bar)).toBe(bar);
  expect(context.get(Foo)).toBe(bar.foo);
});

it('will drop implicit child when property is overwritten', () => {
  class Foo extends State {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends State {
    child: Foo = foo1;
  }

  const context = new Context(Parent);
  const parent = context.get(Parent);

  expect(context.get(Foo)).toBe(foo1);

  parent.child = foo2;

  expect(context.get(Foo)).toBe(foo2);
});

it('will drop a child held before the parent joined context', async () => {
  class Foo extends State {}

  class Parent extends State {
    child?: Foo = undefined;
  }

  const foo = Foo.new();
  const parent = Parent.new();

  parent.child = foo;
  await expect(parent).toHaveUpdated();

  const context = new Context().push(parent);

  expect(context.get(Foo)).toBe(foo);

  parent.child = undefined;
  await expect(parent).toHaveUpdated();

  expect(context.get(Foo, false)).toBeUndefined();
});

it('will notify downstream subscriber when implicit child is replaced', () => {
  class Foo extends State {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends State {
    child: Foo = foo1;
  }

  const parent = new Parent();
  const context = new Context(parent);
  const cb = vi.fn();

  context.get(Foo, cb);

  expect(cb).toBeCalledWith(foo1, false);

  parent.child = foo2;

  expect(cb).toBeCalledTimes(2);
  expect(cb).toBeCalledWith(foo2, false);
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

  const context = new Context(parent);

  expect(context.get(Foo)).toBe(foo2);
});

it('will collide implicit children with shared ancestor', () => {
  class Foo extends State {}
  class Bar extends Foo {}

  class Parent extends State {
    foo = new Foo();
    bar = new Bar();
  }

  const context = new Context(Parent);

  expect(context.get(Bar)).toBeInstanceOf(Bar);
  expect(context.get(Foo)).toBeNull();
});

it('will uncollide when one implicit child is removed', () => {
  class Foo extends State {}
  class Bar extends Foo {}

  class Parent extends State {
    foo: Foo | undefined = new Foo();
    bar = new Bar();
  }

  const context = new Context(Parent);
  const parent = context.get(Parent);

  expect(context.get(Foo)).toBeNull();

  parent.foo = undefined;

  expect(context.get(Foo)).toBeInstanceOf(Bar);
});

it('will clear consume and provide on pop', () => {
  class Foo extends State {}

  const parent = new Context();
  const child = parent.push();

  child.get(Foo, vi.fn());
  child.add(Foo.new());

  expect(parent.consume.has(Foo)).toBe(true);
  expect(parent.provide.has(Foo)).toBe(true);

  parent.pop();

  expect(parent.consume.size).toBe(0);
  expect(parent.provide.size).toBe(0);
});

it('will pop child context', () => {
  let order = 0;

  class Test extends State {
    protected new() {
      return () => didDestroy(++order, this.constructor.name);
    }
  }

  class Test2 extends Test {}
  class Test3 extends Test {}

  const didDestroy = vi.fn();
  const context = new Context(Test);

  context.push(Test2).push(Test3);
  context.pop();

  expect(didDestroy).toBeCalledWith(1, 'Test3');
  expect(didDestroy).toBeCalledWith(2, 'Test2');
  expect(didDestroy).toBeCalledWith(3, 'Test');
});

describe('has method', () => {
  class DownstreamState extends State {}

  it('will call callback when type is added downstream', () => {
    const context = new Context();
    const cb = vi.fn();

    context.get(DownstreamState, cb, true);
    context.push(DownstreamState);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(DownstreamState);
  });

  it('will clean up callback on cancel', () => {
    const context = new Context();
    const cb = vi.fn();

    const cancel = context.get(DownstreamState, cb, true);
    context.push(DownstreamState);
    cancel();
    context.push(DownstreamState);

    expect(cb).toBeCalledTimes(1);
  });

  it('will call cleanup when state is removed', () => {
    const context = new Context();
    const cleanup = vi.fn();
    const cb = vi.fn(() => cleanup);

    context.get(DownstreamState, cb, true);

    const child = context.push(DownstreamState);

    child.pop();

    expect(cleanup).toBeCalledTimes(1);
    expect(cb).toBeCalledTimes(1);
  });

  it('will call callback for existing and new downstream states, flagged downstream', () => {
    const context = new Context();
    const existing = [context.push(DownstreamState), context.push(DownstreamState)].map((child) => child.get(DownstreamState));
    const cb = vi.fn();

    context.get(DownstreamState, cb, true);

    expect(cb.mock.calls).toEqual(existing.map((state) => [state, true]));

    context.push(DownstreamState);

    expect(cb).toBeCalledTimes(3);
    expect(cb).toHaveBeenLastCalledWith(expect.any(DownstreamState), true);
  });

  it('will notify has-subscriber for state created before context', () => {
    const parent = new Context();
    const child = parent.push();
    const cb = vi.fn();

    parent.get(DownstreamState, cb, true);

    const state = DownstreamState.new();

    child.set(state);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(state, true);
  });
});

describe('get callback (upstream subscription)', () => {
  class Upstream extends State {}

  it('will call callback when type is added to parent, flagged upstream', () => {
    const parent = new Context();
    const child = parent.push();
    const cb = vi.fn();

    child.get(Upstream, cb);

    expect(cb).not.toBeCalled();

    parent.set(Upstream);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(expect.any(Upstream), false);
  });

  it('will cancel subscription', () => {
    const parent = new Context();
    const child = parent.push();
    const cb = vi.fn();

    const cancel = child.get(Upstream, cb);
    cancel();
    parent.set(Upstream);

    expect(cb).not.toBeCalled();
  });

  it('will call cleanup returned from callback', () => {
    const parent = new Context();
    const child = parent.push();
    const cleanup = vi.fn();
    const cb = vi.fn(() => cleanup);

    child.get(Upstream, cb);
    parent.set(Upstream);

    expect(cb).toBeCalledTimes(1);

    parent.pop();

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will notify get-subscriber when state already has a context', () => {
    const shared = Upstream.new();
    new Context(shared);

    const parent = new Context();
    const child = parent.push();
    const cb = vi.fn();

    child.get(Upstream, cb);
    parent.set(shared);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(shared, false);
  });

  it('will call callback for already-registered upstream state', () => {
    const parent = new Context(Upstream);
    const child = parent.push();
    const cb = vi.fn();

    child.get(Upstream, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(expect.any(Upstream), false);
  });
});

describe('context helper', () => {
  class Test extends State {}

  it('will get context', () => {
    const test = new Test();
    const context = new Context(test);

    expect(Context.get(test)).toBe(context);
  });

  it('will fallback to root context if none assigned', () => {
    const test = new Test();

    expect(Context.get(test)).toBe(Context.root);
  });

  it('will keep first context assigned', () => {
    const test = new Test();
    const first = new Context(test);

    new Context(test);

    expect(Context.get(test)).toBe(first);
  });
});

describe('set method', () => {
  it('will register multiple', () => {
    class Foo extends State {}
    class Bar extends State {}

    const foo = Foo.new();
    const bar = Bar.new();

    const context = new Context({ foo, bar });

    expect(context.get(Foo)).toBe(foo);
    expect(context.get(Bar)).toBe(bar);
  });

  it('will complain if multiple of same type', () => {
    const context = new Context({
      e1: Example,
      e2: Example
    });

    expect(() => context.get(Example)).toThrow(
      `Did find Example in context, but multiple were defined.`
    );
  });

  it('will ignore if multiple of same instance', () => {
    const example = Example.new();
    const context = new Context({
      e1: example,
      e2: example
    });

    expect(context.get(Example)).toBe(example);
  });

  it('will prefer explicit over implicit', () => {
    class Foo extends State {}
    class Bar extends State {
      foo = new Foo();
    }

    const foo = new Foo();
    const foobar = new Bar();
    const context = new Context();

    context.set({ foo, Bar: foobar });

    expect(context.get(Bar)).toBe(foobar);
    expect(context.get(Foo)).not.toBe(foobar.foo);
    expect(context.get(Foo)).toBe(foo);
  });

  it('will keep child in context if still referenced by another parent', () => {
    class Foo extends State {}

    const shared = new Foo();

    class ParentA extends State {
      child: Foo | undefined = shared;
    }

    class ParentB extends State {
      child: Foo | undefined = shared;
    }

    const context = new Context({ ParentA, ParentB });

    expect(context.get(Foo)).toBe(shared);

    context.get(ParentA).child = undefined;

    expect(context.get(Foo)).toBe(shared);

    context.get(ParentB).child = undefined;

    expect(context.get(Foo, false)).toBeUndefined();
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

    const context1 = new Context({ Test1 });
    const context2 = context1.push({ test2, Test3 });

    const test1 = context2.get(Test1)!;
    const test3 = context2.get(Test3)!;

    context2.pop();

    expect(test1.destroyed).not.toBeCalled();
    expect(test2.destroyed).not.toBeCalled();
    expect(test3.destroyed).toBeCalled();
  });

  it('will throw on base State include', () => {
    const context = new Context();

    // @ts-ignore
    expect(() => context.set({ State })).toThrow('Cannot create base State.');
  });

  it.each([
    ["will throw on bad include property", { Thing: { toString: () => 'Foobar' } }, " but got Foobar (as 'Thing')."],
    ['will throw on bad include property (no alias)', { [0]: { toString: () => 'Thing' } }, ' but got Thing.']
  ])('%s', (_, include, message) => {
    // @ts-ignore
    expect(() => new Context().set(include)).toThrow('Context can only include an instance or class of State' + message);
  });

  it('will remove implicit children when parent removed via set', () => {
    class Parent extends State {
      child = new Example();
    }

    const context = new Context({ Parent });
    const { child } = context.get(Parent);

    expect(Context.get(child)).toBe(context);

    context.set({});

    expect(Context.get(child)).toBe(context);
    expect(context.get(Example, false)).toBeUndefined();
  });

  it('will remove multiple implicit children when parent is removed', () => {
    class Parent extends State {
      a = new Example();
      b = new Example2();
    }

    const context = new Context({ Parent });

    expect(context.get(Example)).toBeNull();
    expect(context.get(Example2)).toBeInstanceOf(Example2);

    context.set({});

    expect(context.get(Example, false)).toBeUndefined();
    expect(context.get(Example2, false)).toBeUndefined();
  });

  it('will callback once per unique added', () => {
    class Foo extends State {}
    class Bar extends State {}

    const foo = Foo.new();
    const bar = Bar.new();
    const cb = vi.fn();

    const context = new Context();

    context.set({ foo, bar }, cb);

    expect(cb).toBeCalledWith(foo, false);
    expect(cb).toBeCalledWith(bar, false);
    expect(cb).toBeCalledTimes(2);

    context.set({ foo, bar }, cb);

    expect(cb).toBeCalledTimes(2);

    const foo2 = Foo.new();

    context.set({ foo, bar, foo2 }, cb);

    expect(cb).toBeCalledWith(foo2, false);
    expect(cb).toBeCalledTimes(3);
  });

  it('will ignore subsequent if callback', () => {
    class Foo extends State {}

    const cb = vi.fn();
    const context = new Context();

    context.set(Foo, cb);
    context.set(Foo, cb);

    expect(context.get(Foo)).toBeInstanceOf(Foo);
    expect(cb).toBeCalledTimes(1);
  });

  it('will remove and delete state of type absent', () => {
    class Bar extends State {
      didDie = vi.fn();

      protected new() {
        return this.didDie;
      }
    }

    const context = new Context({ Bar });
    const bar = context.get(Bar);

    context.set({});

    expect(bar.didDie).toBeCalled();
    expect(context.get(Bar, false)).toBeUndefined();
  });

  it('will replace owned instance when key changes', () => {
    class Baz extends State {
      didDie = vi.fn();

      protected new() {
        return this.didDie;
      }
    }

    class Baz2 extends State {}

    const context = new Context({ Baz });
    const baz = context.get(Baz);

    context.set({ Baz: Baz2 });

    expect(baz.didDie).toBeCalled();
    expect(context.get(Baz, false)).toBeUndefined();
    expect(context.get(Baz2)).toBeInstanceOf(Baz2);
  });

  it('will remove non-owned instance without destroying it', () => {
    class Bar extends State {}

    const bar = Bar.new();
    const context = new Context({ bar });

    expect(context.get(Bar)).toBe(bar);

    context.set({});

    expect(context.get(Bar, false)).toBeUndefined();
    expect(bar.get(null)).toBe(false);
  });

  it('will set multiple types and cleanup all', () => {
    class A extends State {}
    class B extends State {}

    const ctx = new Context({ A, B });

    expect(ctx.get(A)).toBeInstanceOf(A);
    expect(ctx.get(B)).toBeInstanceOf(B);

    ctx.pop();

    expect(ctx.get(A, false)).toBeUndefined();
    expect(ctx.get(B, false)).toBeUndefined();
  });

  it('will call forEach cleanup for each state removed or replaced', () => {
    class Foo extends State {}
    class Bar extends State {}
    class Foo2 extends State {}

    const didCleanup = vi.fn();
    const context = new Context();

    context.set({ x: Foo, Bar }, (state) => () => didCleanup(state.constructor.name));

    expect(didCleanup).not.toBeCalled();

    context.set({ x: Foo2 });

    expect(didCleanup.mock.calls).toEqual([['Foo'], ['Bar']]);
    expect(context.get(Foo, false)).toBeUndefined();
    expect(context.get(Foo2)).toBeInstanceOf(Foo2);
  });

  it('will ignore a non-function returned by forEach', () => {
    class Foo extends State {}

    const context = new Context();

    context.set(Foo, (state) => (state as any));

    expect(() => context.set({})).not.toThrow();
  });

  it('will tell forEach whether context owns the state', () => {
    class Foo extends State {}
    class Bar extends State {}

    const bar = Bar.new();
    const didCall = vi.fn();
    const context = new Context();

    context.set({ Foo, bar }, (state, owned) => {
      didCall(state.constructor.name, owned);
    });

    expect(didCall).toBeCalledWith('Foo', true);
    expect(didCall).toBeCalledWith('Bar', false);

    context.pop();

    expect(context.get(Foo, false)).toBeUndefined();
    expect(bar.get(null)).toBe(false);
  });

  it('will call forEach cleanup on pop', () => {
    class Foo extends State {}

    const cleanup = vi.fn();
    const parent = new Context();
    const child = parent.push();

    child.set(Foo, () => cleanup);
    child.pop();

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will clean up subtype keys on delete', () => {
    class Base extends State {}
    class Child extends Base {}

    const context = new Context({ Child });

    expect(context.get(Child)).toBeInstanceOf(Child);
    expect(context.get(Base)).toBeInstanceOf(Child);

    context.set({});

    expect(context.get(Child, false)).toBeUndefined();
    expect(context.get(Base, false)).toBeUndefined();
  });
});

describe('ambiguous implicit entries', () => {
  it('will not call callback when two implicit entries of same type exist', () => {
    class Base extends State {}
    class ChildA extends Base {}
    class ChildB extends Base {}

    const parent = new Context();
    const ctx = parent.push();

    ctx.add(ChildA.new());
    ctx.add(ChildB.new());

    const cb = vi.fn();

    const child = ctx.push();
    child.get(Base, cb);

    expect(cb).not.toBeCalled();
  });

  it('will throw on multiple explicit entries of same type in callback get', () => {
    class Base extends State {}

    const ctx = new Context();
    const a = Base.new();
    const b = Base.new();

    ctx.add(a, true);
    ctx.add(b, true);

    const cb = vi.fn();

    expect(() => ctx.get(Base, cb)).toThrow(
      'Did find Base in context, but multiple were defined.'
    );
  });

  it('will ignore implicit when explicit already found in callback get', () => {
    class Base extends State {}

    const ctx = new Context();
    const explicit = Base.new();
    const implicit = Base.new();

    ctx.add(explicit, true);
    ctx.add(implicit);

    const cb = vi.fn();
    ctx.get(Base, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(explicit, false);
  });

  it('will deduplicate same state in callback get entries', () => {
    class Base extends State {}

    const ctx = new Context();
    const a = Base.new();

    ctx.add(a, true);
    ctx.add(a, true);

    const cb = vi.fn();
    ctx.get(Base, cb);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(a, false);
  });
});

describe('add method listener lookup', () => {
  it('will deduplicate callbacks across context hierarchy in add', () => {
    class Foo extends State {}
    class Bar extends Foo {}

    const parent = new Context();
    const cb = vi.fn();

    parent.get(Foo, cb, true);

    parent.push(Bar);

    expect(cb).toBeCalledTimes(1);
  });

  it('will deduplicate callback in above path during add', () => {
    class Foo extends State {}

    const grandparent = new Context();
    const parent = grandparent.push();
    const child = parent.push();
    const cb = vi.fn();

    grandparent.get(Foo, cb, true);
    parent.get(Foo, cb, true);

    child.set(Foo);

    expect(cb).toBeCalledTimes(1);
  });

  it('will skip child context without matching listener type in below path', () => {
    class Foo extends State {}
    class Bar extends State {}

    const parent = new Context();
    const child = parent.push();

    child.get(Bar, vi.fn());

    parent.set(Foo);

    expect(parent.get(Foo)).toBeInstanceOf(Foo);
  });

  it('will deduplicate callback found in both above and below during add', () => {
    class Foo extends State {}

    const parent = new Context();
    const middle = parent.push();
    const child = middle.push();
    const cb = vi.fn();

    parent.get(Foo, cb);
    child.get(Foo, cb);

    middle.set(Foo);

    expect(cb).toBeCalledTimes(1);
  });
});

it('will skip self when traversing downstream', () => {
  const parent = new Context();
  const child = parent.push();

  const example = Example.new();
  parent.add(example);
  child.add(example);

  const cb = vi.fn();
  example.get(Example, cb);

  expect(cb).not.toBeCalled();
});

it('will not traverse downstream when downstream is false', () => {
  const parent = new Context();
  const child = parent.push();

  const foo = Example.new();
  child.add(foo);

  const cb = vi.fn();
  parent.get(Example, cb, false);

  expect(cb).not.toBeCalled();
});

it('will traverse deeply nested contexts', () => {
  const root = new Context();
  const child = root.push();
  const grandchild = child.push();

  const foo = Example.new();
  grandchild.add(foo);

  const cb = vi.fn();
  root.get(Example, cb);

  expect(cb).toBeCalledWith(foo, true);
});

it('will notify upstream consumer when type is added to same context', () => {
  const context = new Context();
  const cb = vi.fn();

  context.get(Example, cb, false);

  const foo = Example.new();
  context.add(foo);

  expect(cb).toBeCalledWith(foo, false);
});

it('will skip consumer if filter does not match downstream', () => {
  const parent = new Context();
  const child = parent.push();
  const grandchild = child.push();

  const cb = vi.fn();
  child.get(Example, cb, true);

  const foo = Example.new();
  parent.add(foo);

  expect(cb).not.toBeCalled();

  const bar = Example.new();
  grandchild.add(bar);

  expect(cb).toBeCalledWith(bar, true);
});

describe('root global', () => {
  const { root } = Context;

  class Global extends State {
    static readonly global: State.Global = true;
  }

  it('will register a global .new() instance in root, again once destroyed', () => {
    const first = Global.new();

    expect(root.get(Global)).toBe(first);

    first.set(null);

    expect(root.get(Global, false)).toBeUndefined();

    const second = Global.new();

    expect(root.get(Global)).toBe(second);

    second.set(null);
  });

  it('will not register children of a private instance in root', () => {
    class Child extends State {}
    class Parent extends State {
      child = new Child();
    }

    const parent = Parent.new();

    expect(root.get(Parent, false)).toBeUndefined();
    expect(root.get(Child, false)).toBeUndefined();

    parent.set(null);
  });

  it('will register descendants of a global instance in root', () => {
    class Grandchild extends State {}
    class Child extends State {
      grandchild = new Grandchild();
    }
    class Parent extends State {
      static readonly global = true;
      child = new Child();
    }

    const parent = Parent.new();

    expect(root.get(Child)).toBe(parent.child);
    expect(root.get(Grandchild)).toBe(parent.child.grandchild);

    parent.set(null);

    expect(root.get(Child, false)).toBeUndefined();
  });

  it('will register a child assigned after a global joins root', () => {
    class Child extends State {}
    class Parent extends State {
      static readonly global = true;
      child?: Child = undefined;
    }

    const parent = Parent.new();

    parent.child = new Child();

    expect(root.get(Child)).toBe(parent.child);

    parent.set(null);
  });

  it('will not register a late child of a private sibling of a global', () => {
    class Child extends State {}
    class Parent extends State {
      static readonly global: State.Global<Parent> = (self) => self.shared;
      shared = false;
      child?: Child = undefined;
    }

    const shared = Parent.new({ shared: true });
    const alone = Parent.new();

    alone.child = new Child();

    expect(root.get(Parent)).toBe(shared);
    expect(root.get(Child, false)).toBeUndefined();

    shared.set(null);
    alone.set(null);
  });

  it('will provide children of a private instance where it is provided', () => {
    class Grandchild extends State {}
    class Child extends State {
      grandchild = new Grandchild();
    }
    class Parent extends State {
      child = new Child();
    }

    const parent = Parent.new();
    const context = root.push({ parent });

    expect(context.get(Child)).toBe(parent.child);
    expect(context.get(Grandchild)).toBe(parent.child.grandchild);
    expect(root.get(Child, false)).toBeUndefined();

    context.pop();

    expect(context.get(Child, false)).toBeUndefined();

    parent.set(null);
  });

  it('will keep instance when re-added implicitly', () => {
    const instance = Global.new();

    root.add(instance);

    expect(root.get(Global)).toBe(instance);

    instance.set(null);
  });

  it('will throw when a subclass inherits global without re-declaring', () => {
    class Sub extends Global {}

    expect(() => Sub.new()).toThrow(
      /would register as a global by inheritance alone/
    );
  });

  it.each([
    ['will register when a subclass re-declares global', true],
    ['will allow a subclass to opt out of a global', false]
  ])('%s', (_, global) => {
    class Sub extends Global {
      static readonly global = global;
    }

    const instance = Sub.new();

    expect(root.get(Sub, false)).toBe(global ? instance : undefined);

    instance.set(null);
  });

  it('will resolve global from a function at activation', () => {
    let allow = false;

    class Conditional extends State {
      static readonly global: State.Global = () => allow;
    }

    const off = Conditional.new();
    expect(root.get(Conditional, false)).toBeUndefined();
    off.set(null);

    allow = true;

    const on = Conditional.new();
    expect(root.get(Conditional)).toBe(on);
    on.set(null);
  });

  it('will pass the instance to a global resolver', () => {
    class Instanced extends State {
      persistent = true;
      static readonly global: State.Global<Instanced> = (self) => self.persistent;
    }

    const instance = Instanced.new();

    expect(root.get(Instanced)).toBe(instance);

    instance.set(null);
  });

  it('will enforce global inheritance through static types', () => {
    void function () {
      class SealedGlobal extends State {
        static readonly global = true;
      }
      class Floor extends State {
        static readonly global = false;
      }

      // @ts-expect-error - cannot opt out of a sealed (literal true) global
      class OptOut extends SealedGlobal {
        static readonly global = false;
      }

      // @ts-expect-error - cannot opt in against a literal-false floor
      class OptIn extends Floor {
        static readonly global = true;
      }

      class Open extends State {
        static readonly global: State.Global = true;
      }
      class Scoped extends Open {
        static readonly global = false;
      }

      return [OptOut, OptIn, Scoped];
    };
  });

  it('will lock state ownership to root after init', () => {
    const instance = Global.new();

    expect(Context.get(instance)).toBe(root);

    const ctx = new Context(instance);

    expect(ctx.get(Global)).toBe(instance);
    expect(Context.get(instance)).toBe(root);

    instance.set(null);
  });

  it.each<[string, State.Global]>([
    ['will throw on duplicate global of same type', true],
    ['will throw on duplicate global from a resolver', () => true]
  ])('%s', (_, global) => {
    class Multi extends State {
      static global = global;
    }

    const first = Multi.new();

    expect(() => Multi.new()).toThrow(/already exists in root/);
    expect(root.get(Multi)).toBe(first);

    first.set(null);
  });

  it('will preserve subtype entries on eviction', () => {
    class Base extends State {}
    class SubA extends Base {
      static global = true;
    }
    class SubB extends Base {
      static global = true;
    }

    const a = SubA.new();

    expect(root.get(Base)).toBe(a);
    expect(root.get(SubA)).toBe(a);

    const b = SubB.new();

    expect(root.get(Base, false)).toBeUndefined();
    expect(root.get(SubA)).toBe(a);
    expect(root.get(SubB)).toBe(b);

    a.set(null);
    b.set(null);
  });

  it('will register fresh sibling cleanly after ancestor eviction', () => {
    class Base extends State {}
    class SubA extends Base {
      static global = true;
    }
    class SubB extends Base {
      static global = true;
    }
    class SubC extends Base {
      static global = true;
    }

    const a = SubA.new();
    const b = SubB.new();

    expect(root.get(Base, false)).toBeUndefined();

    const c = SubC.new();

    expect(root.get(Base)).toBe(c);
    expect(root.get(SubA)).toBe(a);
    expect(root.get(SubB)).toBe(b);
    expect(root.get(SubC)).toBe(c);

    a.set(null);
    b.set(null);
    c.set(null);
  });

  it('will not auto-register state created under an explicit context', () => {
    class Scoped extends State {}

    const ctx = new Context(Scoped);

    expect(ctx.get(Scoped)).toBeInstanceOf(Scoped);
    expect(root.get(Scoped, false)).toBeUndefined();

    ctx.pop();
  });

  it('will not apply global eviction to explicit add', () => {
    class Base extends State {}
    class SubA extends Base {
      static global = true;
    }
    class SubB extends Base {}

    const a = SubA.new();

    expect(root.get(Base)).toBe(a);

    const b = new SubB();
    const removeB = root.add(b, true);

    expect(root.get(SubA)).toBe(a);
    expect(root.get(SubB)).toBe(b);
    expect(root.get(Base)).toBe(b);

    removeB();

    expect(root.get(Base)).toBe(a);

    a.set(null);
  });

  it('will not evict explicit entries on implicit add', () => {
    class Base extends State {}
    class Sub extends Base {}

    const a = new Sub();
    const removeA = root.add(a, true);

    const b = Sub.new();

    expect(root.get(Sub)).toBe(a);
    expect(root.get(Base)).toBe(a);

    removeA();
    b.set(null);
  });
});
