import { vi, describe, it, expect, expectTypeOf, onTestFinished } from 'vitest';
import { Context, resolver, within } from './context';
import { Model } from './state';
import { get } from './field/get';
import { has } from './field/has';
import { map } from './field/map';
import { Observer, watch } from './observable';
import { flushMicrotasks, mockUncaught } from '../test.setup';

class Example extends Model {}
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

it('will not create base Model', () => {
  // @ts-expect-error
  expect(() => new Context(Model)).toThrow('Cannot create base Model.');
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
  class Parent extends Model {
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

  class Test extends Model {
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
  class Foo extends Model {}
  class Bar extends Model {
    foo = new Foo();
  }

  const bar = new Bar();
  const context = new Context(bar);

  expect(context.get(Bar)).toBe(bar);
  expect(context.get(Foo)).toBe(bar.foo);
});

it('will drop implicit child when property is overwritten', () => {
  class Foo extends Model {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends Model {
    child: Foo = foo1;
  }

  const context = new Context(Parent);
  const parent = context.get(Parent);

  expect(context.get(Foo)).toBe(foo1);

  parent.child = foo2;

  expect(context.get(Foo)).toBe(foo2);
});

it('will drop a child held before the parent joined context', async () => {
  class Foo extends Model {}

  class Parent extends Model {
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
  class Foo extends Model {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends Model {
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
  class Foo extends Model {}

  const foo1 = new Foo();
  const foo2 = new Foo();

  class Parent extends Model {
    child: Foo = foo1;
  }

  const parent = new Parent();

  parent.child = foo2;

  const context = new Context(parent);

  expect(context.get(Foo)).toBe(foo2);
});

it('will collide implicit children with shared ancestor', () => {
  class Foo extends Model {}
  class Bar extends Foo {}

  class Parent extends Model {
    foo = new Foo();
    bar = new Bar();
  }

  const context = new Context(Parent);

  expect(context.get(Bar)).toBeInstanceOf(Bar);
  expect(context.get(Foo)).toBeNull();
});

it('will uncollide when one implicit child is removed', () => {
  class Foo extends Model {}
  class Bar extends Foo {}

  class Parent extends Model {
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
  class Foo extends Model {}

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

  class Test extends Model {
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
  class DownstreamModel extends Model {}

  it('will call callback when type is added downstream', () => {
    const context = new Context();
    const cb = vi.fn();

    context.get(DownstreamModel, cb, true);
    context.push(DownstreamModel);

    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(DownstreamModel);
  });

  it('will clean up callback on cancel', () => {
    const context = new Context();
    const cb = vi.fn();

    const cancel = context.get(DownstreamModel, cb, true);
    context.push(DownstreamModel);
    cancel();
    context.push(DownstreamModel);

    expect(cb).toBeCalledTimes(1);
  });

  it('will call cleanup when state is removed', () => {
    const context = new Context();
    const cleanup = vi.fn();
    const cb = vi.fn(() => cleanup);

    context.get(DownstreamModel, cb, true);

    const child = context.push(DownstreamModel);

    child.pop();

    expect(cleanup).toBeCalledTimes(1);
    expect(cb).toBeCalledTimes(1);
  });

  it('will call callback for existing and new downstream states, flagged downstream', () => {
    const context = new Context();
    const existing = [context.push(DownstreamModel), context.push(DownstreamModel)].map((child) => child.get(DownstreamModel));
    const cb = vi.fn();

    context.get(DownstreamModel, cb, true);

    expect(cb).toBeCalledTimes(2);
    existing.forEach((state, i) => {
      expect(cb.mock.calls[i][0]).toBe(state);
      expect(cb.mock.calls[i][1]).toBe(true);
    });

    context.push(DownstreamModel);

    expect(cb).toBeCalledTimes(3);
    expect(cb).toHaveBeenLastCalledWith(expect.any(DownstreamModel), true);
  });

  it('will notify has-subscriber for state created before context', () => {
    const parent = new Context();
    const cb = vi.fn();

    parent.get(DownstreamModel, cb, true);

    const state = DownstreamModel.new();

    parent.push(state);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(state, true);
  });
});

describe('get callback (upstream subscription)', () => {
  class Upstream extends Model {}

  it('will call callback when type is added to parent, flagged upstream', () => {
    const parent = new Context();
    const child = parent.push();
    const cb = vi.fn();

    child.get(Upstream, cb);

    expect(cb).not.toBeCalled();

    parent.add(Upstream.new(), true);

    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith(expect.any(Upstream), false);
  });

  it('will cancel subscription', () => {
    const parent = new Context();
    const child = parent.push();
    const cb = vi.fn();

    const cancel = child.get(Upstream, cb);
    cancel();
    parent.add(Upstream.new(), true);

    expect(cb).not.toBeCalled();
  });

  it('will call cleanup returned from callback', () => {
    const parent = new Context();
    const child = parent.push();
    const cleanup = vi.fn();
    const cb = vi.fn(() => cleanup);

    child.get(Upstream, cb);
    parent.add(Upstream.new(), true);

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
    parent.add(shared, true);

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
  class Test extends Model {}

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

describe('static get', () => {
  class Test extends Model {
    value = 1;
  }

  it('will return root outside set', () => {
    const context = Context.get();

    expectTypeOf(context).toEqualTypeOf<Context>();

    expect(context).toBe(Context.root);
  });

  it('will compute against root', () => {
    const compute = vi.fn((context: Context) => context.id);
    const id = Context.get(Test, compute);

    expectTypeOf(id).toEqualTypeOf<string>();

    expect(id).toBe(Context.root.id);
    expect(compute).toBeCalledWith(Context.root);
  });

  it('will not accept a third argument', () => {
    const compute = vi.fn(() => 'value');

    // @ts-expect-error
    expect(Context.get(Test, compute, true)).toBe('value');
  });

  it('will compute with a Model as origin', () => {
    const test = Test.new();
    const context = new Context(test);
    const compute = vi.fn((_context: Context, from?: Model) => from);

    expect(within(test, () => Context.get(Test, compute))).toBe(test);
    expect(compute).toBeCalledWith(context, test);
  });

  it('will pass the real instance from a tracking proxy', () => {
    const test = Test.new();
    const compute = vi.fn((_context: Context, from?: Model) => from);

    test.get((proxy) => {
      within(proxy, () => Context.get(Test, compute));
    });

    expect(compute.mock.calls[0][1]).toBe(test);
  });

  it('will pass a tracked context from a tracking proxy', async () => {
    class Other extends Model {}

    const test = Test.new();
    const context = new Context(test);
    const didFind = vi.fn();

    test.get((proxy) => {
      didFind(within(proxy, () => Context.get(Other, (ctx) => ctx.get(Other, false))));
    });

    expect(didFind).toBeCalledWith(undefined);

    const other = Other.new();

    context.add(other);
    await flushMicrotasks();

    expect(didFind).toHaveBeenLastCalledWith(other);
  });

  it('will subscribe a tracking origin to its result', async () => {
    const test = Test.new();
    const other = Test.new();
    const effect = vi.fn();

    test.get((proxy) => {
      effect(within(proxy, () => Context.get(Test, () => other)).value);
    });

    other.value = 2;
    await expect(other).toHaveUpdated();

    expect(effect).toBeCalledTimes(2);
    expect(effect).toHaveBeenLastCalledWith(2);
  });
});

describe('within', () => {
  class Test extends Model {}

  it('will return result of function', () => {
    const result = within(Test.new(), () => 1);

    expectTypeOf(result).toEqualTypeOf<number>();

    expect(result).toBe(1);
  });

  it('will set home context of a Model', () => {
    const test = Test.new();
    const context = new Context(test);

    expect(within(test, () => Context.get())).toBe(context);
  });

  it('will set root for a Model without context', () => {
    const test = Test.new();

    expect(within(test, () => Context.get())).toBe(Context.root);
  });

  it('will nest', () => {
    const outer = Test.new();
    const inner = Test.new();
    const outerContext = new Context(outer);
    const innerContext = new Context(inner);
    const seen: Context[] = [];

    within(outer, () => {
      seen.push(Context.get());
      within(inner, () => seen.push(Context.get()));
      seen.push(Context.get());
    });

    expect(seen).toEqual([outerContext, innerContext, outerContext]);
    expect(Context.get()).toBe(Context.root);
  });

  it('will restore on throw', () => {
    expect(() =>
      within(Test.new(), () => {
        throw new Error('oops');
      })
    ).toThrow('oops');

    expect(Context.get()).toBe(Context.root);
  });
});

describe('resolver', () => {
  class Test extends Model {}

  function assign(next: Parameters<typeof resolver>[0]) {
    const previous = resolver(next);

    onTestFinished(() => {
      resolver(previous);
    });
  }

  it('will resolve a static get outside within', () => {
    const context = new Context();
    const resolve = vi.fn((_Type: unknown, compute: (context: Context) => unknown) => compute(context));

    assign(resolve);

    expect(Context.get(Test, (context) => context)).toBe(context);
    expect(resolve).toBeCalledWith(Test, expect.any(Function));
  });

  it('will resolve bare get without a type', () => {
    const context = new Context();
    const resolve = vi.fn((_Type: unknown, compute: (context: Context) => unknown) => compute(context));

    assign(resolve);

    expect(Context.get()).toBe(context);
    expect(resolve).toBeCalledWith(undefined, expect.any(Function));
  });

  it('will return what resolve returns', () => {
    assign(() => 'wrapped');

    expect(Context.get(Test, () => 'value')).toBe('wrapped');
  });

  it('will not be called within', () => {
    const resolve = vi.fn();

    assign(resolve);
    within(Test.new(), () => Context.get(Test, () => 'value'));

    expect(resolve).not.toBeCalled();
  });

  it('will not be called for a Model', () => {
    const resolve = vi.fn();

    assign(resolve);
    Context.get(Test.new());

    expect(resolve).not.toBeCalled();
  });
});

describe('inputs', () => {
  it('will register multiple', () => {
    class Foo extends Model {}
    class Bar extends Model {}

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
    class Foo extends Model {}
    class Bar extends Model {
      foo = new Foo();
    }

    const foo = new Foo();
    const foobar = new Bar();
    const context = new Context({ foo, Bar: foobar });

    expect(context.get(Bar)).toBe(foobar);
    expect(context.get(Foo)).not.toBe(foobar.foo);
    expect(context.get(Foo)).toBe(foo);
  });

  it('will keep child in context if still referenced by another parent', () => {
    class Foo extends Model {}

    const shared = new Foo();

    class ParentA extends Model {
      child: Foo | undefined = shared;
    }

    class ParentB extends Model {
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
    class Test extends Model {
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

  it('will throw on base Model include', () => {
    // @ts-ignore
    expect(() => new Context({ Model })).toThrow('Cannot create base Model.');
  });

  it.each([
    ["will throw on bad include property", { Thing: { toString: () => 'Foobar' } }, " but got Foobar (as 'Thing')."],
    ['will throw on bad single include (no alias)', Object.assign(function Thing() {}, { toString: () => 'Thing' }), ' but got Thing.']
  ])('%s', (_, include, message) => {
    // @ts-ignore
    expect(() => new Context(include)).toThrow('Context can only include an instance or class of Model' + message);
  });

  it('will set multiple types and cleanup all', () => {
    class A extends Model {}
    class B extends Model {}

    const ctx = new Context({ A, B });

    expect(ctx.get(A)).toBeInstanceOf(A);
    expect(ctx.get(B)).toBeInstanceOf(B);

    ctx.pop();

    expect(ctx.get(A, false)).toBeUndefined();
    expect(ctx.get(B, false)).toBeUndefined();
  });
});

describe('push', () => {
  it('will run cleanup on pop', () => {
    const cleanup = vi.fn();
    const context = new Context().push(undefined, cleanup);

    expect(cleanup).not.toBeCalled();

    context.pop();

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will run cleanup when parent pops', () => {
    const cleanup = vi.fn();
    const parent = new Context();

    parent.push().push(Example, cleanup);
    parent.pop();

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will run cleanup once', () => {
    const cleanup = vi.fn();
    const parent = new Context();
    const context = parent.push(Example, cleanup);

    context.pop();
    context.pop();
    parent.pop();

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will run cleanup once for multiple inputs', () => {
    class A extends Model {}
    class B extends Model {}

    const cleanup = vi.fn();
    const context = new Context().push({ A, B }, cleanup);

    context.pop();
    context.pop();

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will run cleanup before removing input', () => {
    class Test extends Model {
      destroyed = vi.fn();

      new() {
        return this.destroyed;
      }
    }

    const found = vi.fn();
    const context = new Context().push(Test, () => {
      const test = context.get(Test);

      expect(test.destroyed).not.toBeCalled();
      found(test);
    });

    const test = context.get(Test);

    context.pop();

    expect(found).toBeCalledWith(test);
    expect(test.destroyed).toBeCalledTimes(1);
    expect(context.get(Test, false)).toBeUndefined();
  });

  it('will not destroy adopted instance on cleanup', () => {
    const example = Example.new();
    const cleanup = vi.fn();
    const context = new Context().push(example, cleanup);

    context.pop();

    expect(cleanup).toBeCalledTimes(1);
    expect(context.get(Example, false)).toBeUndefined();
    expect(example.get(null)).toBe(false);
  });

  it('will destroy adopted instance from cleanup', () => {
    const example = Example.new();
    const context = new Context().push(example, () => example.set(null));

    context.pop();

    expect(example.get(null)).toBe(true);
  });

  it('will destroy owned but not adopted inputs', () => {
    class Owned extends Model {}

    const example = Example.new();
    const context = new Context().push({ Owned, example });
    const owned = context.get(Owned);

    context.pop();

    expect(owned.get(null)).toBe(true);
    expect(example.get(null)).toBe(false);
  });

  it('will register all inputs before any activates', () => {
    class Sibling extends Model {}
    class Test extends Model {
      sibling = get(Sibling);
    }

    const context = new Context().push({ Test, Sibling });

    expect(context.get(Test).sibling).toBe(context.get(Sibling));
  });
});

describe('ambiguous implicit entries', () => {
  it('will not call callback when two implicit entries of same type exist', () => {
    class Base extends Model {}
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
    class Base extends Model {}

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
    class Base extends Model {}

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
    class Base extends Model {}

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
    class Foo extends Model {}
    class Bar extends Foo {}

    const parent = new Context();
    const cb = vi.fn();

    parent.get(Foo, cb, true);

    parent.push(Bar);

    expect(cb).toBeCalledTimes(1);
  });

  it('will deduplicate callback in above path during add', () => {
    class Foo extends Model {}

    const grandparent = new Context();
    const parent = grandparent.push();
    const cb = vi.fn();

    grandparent.get(Foo, cb, true);
    parent.get(Foo, cb, true);

    parent.push(Foo);

    expect(cb).toBeCalledTimes(1);
  });

  it('will skip child context without matching listener type in below path', () => {
    class Foo extends Model {}
    class Bar extends Model {}

    const parent = new Context();
    const child = parent.push();

    child.get(Bar, vi.fn());

    parent.add(Foo.new(), true);

    expect(parent.get(Foo)).toBeInstanceOf(Foo);
  });

  it('will deduplicate callback found in both above and below during add', () => {
    class Foo extends Model {}

    const parent = new Context();
    const middle = parent.push();
    const child = middle.push();
    const cb = vi.fn();

    parent.get(Foo, cb);
    child.get(Foo, cb);

    middle.add(Foo.new(), true);

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

describe('root', () => {
  const { root } = Context;

  it('will throw for a class still declaring static global', () => {
    class Legacy extends Model {
      static global = true;
    }
    class Sub extends Legacy {}

    const message = 'Legacy declares `static global`, which was removed - provide it with <Component for>, or add it to Context.root explicitly.';

    expect(() => Legacy.new()).toThrow(message);
    expect(() => Sub.new()).toThrow(message);
  });

  it('will not register children of a private instance in root', () => {
    class Child extends Model {}
    class Parent extends Model {
      child = new Child();
    }

    const parent = Parent.new();

    expect(root.get(Parent, false)).toBeUndefined();
    expect(root.get(Child, false)).toBeUndefined();

    parent.set(null);
  });

  it('will provide children of a private instance where it is provided', () => {
    class Grandchild extends Model {}
    class Child extends Model {
      grandchild = new Grandchild();
    }
    class Parent extends Model {
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
    class Thing extends Model {}

    const instance = Thing.new();

    root.add(instance);

    expect(root.get(Thing)).toBe(instance);

    instance.set(null);
  });

  it('will not auto-register state created under an explicit context', () => {
    class Scoped extends Model {}

    const ctx = new Context(Scoped);

    expect(ctx.get(Scoped)).toBeInstanceOf(Scoped);
    expect(root.get(Scoped, false)).toBeUndefined();

    ctx.pop();
  });

  it('will prefer an explicit entry in root', () => {
    class Base extends Model {}
    class SubA extends Base {}
    class SubB extends Base {}

    const a = SubA.new();

    root.add(a);

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
    class Base extends Model {}
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

describe('lookup origin', () => {
  class Peer extends Model {}
  class Child extends Model {}
  class Parent extends Model {
    child = new Child();
    rows = has(Child);
    values = map<string, Child>();
  }

  it('will look up from owner for an owned child', () => {
    const parent = Parent.new();
    const context = Context.root.push(new Peer()).push(parent);

    expect(Context.get(parent.child)).toBe(context);
    expect(parent.child.get(Peer)).toBe(context.get(Peer));
  });

  it('will look up from owner for a has row', () => {
    const parent = Parent.new();
    const row = parent.rows.add();
    const context = Context.root.push(new Peer()).push(parent);

    expect(Context.get(row)).toBe(context);
    expect(row.get(Peer)).toBe(context.get(Peer));

    parent.set(null);
  });

  it('will look up from owner for a map value', () => {
    const parent = Parent.new();
    const value = new Child();

    parent.values.set('a', value);

    const context = Context.root.push(new Peer()).push(parent);

    expect(Context.get(value)).toBe(context);
    expect(value.get(Peer)).toBe(context.get(Peer));

    parent.set(null);
  });

  it('will look up from owner for an assigned reference', () => {
    class Holder extends Model {
      ref?: Child = undefined;
    }

    const parent = Parent.new();
    const holder = new Holder();

    Context.root.push(holder);
    holder.ref = parent.child;

    expect(Context.get(parent.child)).toBe(Context.root);

    const context = Context.root.push(new Peer()).push(parent);

    expect(Context.get(parent.child)).toBe(context);
  });

  it('will look up from where an owned child is placed if owner has no context', () => {
    const parent = Parent.new();
    const context = Context.root.push(new Peer()).push(parent.child);

    expect(Context.get(parent.child)).toBe(context);
    expect(parent.child.get(Peer)).toBe(context.get(Peer));
  });

  it('will look up from root for an unplaced instance and its child', () => {
    class Loose extends Model {
      child = new Child();
    }

    const loose = Loose.new();

    expect(Context.get(loose)).toBe(Context.root);
    expect(Context.get(loose.child)).toBe(Context.root);

    loose.set(null);
  });
});

describe('placed instance', () => {
  it('will not move an instance from its home', () => {
    class Other extends Model {}

    const example = Example.new();
    const home = Context.root.push(example);
    const level = Context.root.push(new Other()).push(example);

    expect(Context.get(example)).toBe(home);
    expect(level.get(Other)).toBeInstanceOf(Other);
    expect(home.get(Other, false)).toBeUndefined();
  });
});

describe('tracked lookup', () => {
  class Test extends Model {}

  function follow(context: Context, Type: Model.Extends = Test) {
    const found: unknown[] = [];
    const release = watch(context, (ctx) => {
      found.push(ctx.get(Type, false));
    });

    return { found, release };
  }

  it('will refresh for a provider arriving upstream', async () => {
    const root = new Context();
    const leaf = root.push().push();
    const { found } = follow(leaf);
    const test = Test.new();

    root.add(test);
    await flushMicrotasks();

    expect(found).toEqual([undefined, test]);
  });

  it('will refresh for a closer provider', async () => {
    const outer = Test.new();
    const root = new Context({ outer });
    const middle = root.push();
    const { found } = follow(middle.push());
    const inner = Test.new();

    middle.add(inner);
    await flushMicrotasks();

    expect(found).toEqual([outer, inner]);
  });

  it('will refresh when the provider is removed', async () => {
    const test = Test.new();
    const root = new Context();
    const remove = root.add(test);
    const { found } = follow(root.push());

    remove();
    await flushMicrotasks();

    expect(found).toEqual([test, undefined]);
  });

  it('will not refresh for a provider above the one found', async () => {
    const root = new Context();
    const middle = root.push({ test: Test.new() });
    const { found } = follow(middle.push());

    root.add(Test.new());
    await flushMicrotasks();

    expect(found).toHaveLength(1);
  });

  it('will not refresh for another type', async () => {
    class Other extends Model {}

    const root = new Context();
    const { found } = follow(root.push());

    root.add(Other.new());
    await flushMicrotasks();

    expect(found).toHaveLength(1);
  });

  it('will not refresh for a sibling provider', async () => {
    const root = new Context();
    const { found } = follow(root.push());

    root.push(Test.new());
    await flushMicrotasks();

    expect(found).toHaveLength(1);
  });

  it('will not observe an untracked context', () => {
    const root = new Context();
    const child = root.push();
    const remove = root.add(Test.new());

    expect(child.get(Test)).toBeInstanceOf(Test);
    remove();

    expect(Object.getOwnPropertyDescriptor(root, Observer)).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(child, Observer)).toBeUndefined();
  });

  it('will observe a context once tracked', async () => {
    const root = new Context();
    const middle = root.push();
    const outer = Test.new();

    root.add(outer);

    const { found } = follow(middle.push());
    const inner = Test.new();

    middle.add(inner);
    await flushMicrotasks();

    expect(found).toEqual([outer, inner]);
    expect(Object.getOwnPropertyDescriptor(root, Observer)).toBeDefined();
  });

  it('will refresh an effect using this.get', async () => {
    class Host extends Model {}

    const host = Host.new();
    const root = new Context({ host });
    const found: unknown[] = [];

    host.get(($) => {
      found.push($.get(Test, false));
    });

    const test = Test.new();
    root.add(test);
    await flushMicrotasks();

    expect(found).toEqual([undefined, test]);
  });

  it('will refresh across a popped provider', async () => {
    const test = Test.new();
    const root = new Context();
    const provider = root.push(test);
    const { found } = follow(provider.push());

    provider.pop();
    await flushMicrotasks();

    const next = Test.new();
    root.add(next);
    await flushMicrotasks();

    expect(found).toEqual([test, undefined, next]);
  });

  it('will throw from an effect using this.get when the provider is removed', async () => {
    class Host extends Model {}

    const caught = mockUncaught();
    const host = Host.new();
    const root = new Context({ host });
    const test = Test.new();
    const remove = root.add(test);
    const found: unknown[] = [];

    host.get(($) => {
      found.push($.get(Test));
    });

    remove();
    await flushMicrotasks();

    expect(found).toEqual([test]);
    expect(caught).toEqual([new Error(`Could not find ${Test} in context.`)]);
  });
});
