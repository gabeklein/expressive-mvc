import { vi, describe, it, expect } from 'vitest';
import { Context } from './context';
import { Model } from './state';

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

describe('push', () => {
  it('will complain if multiple of same type', () => {
    const context = new Context(Example);

    context.add(Example.new(), true);

    expect(() => context.get(Example)).toThrow(
      `Did find Example in context, but multiple were defined.`
    );
  });

  it('will ignore if multiple of same instance', () => {
    const example = Example.new();
    const context = new Context(example);

    context.add(example, true);

    expect(context.get(Example)).toBe(example);
  });

  it('will prefer explicit over implicit', () => {
    class Foo extends Model {}
    class Bar extends Model {
      foo = new Foo();
    }

    const foo = new Foo();
    const foobar = Bar.new();
    const context = new Context(foo);

    context.add(foobar, true);

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

    const context = new Context(ParentA);
    const parentB = ParentB.new();

    context.add(parentB, true);

    expect(context.get(Foo)).toBe(shared);

    context.get(ParentA).child = undefined;

    expect(context.get(Foo)).toBe(shared);

    parentB.child = undefined;

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

    const context1 = new Context(Test1);
    const context2 = context1.push(test2);
    const context3 = context2.push(Test3);

    const test1 = context3.get(Test1)!;
    const test3 = context3.get(Test3)!;

    context2.pop();

    expect(test1.destroyed).not.toBeCalled();
    expect(test2.destroyed).not.toBeCalled();
    expect(test3.destroyed).toBeCalled();
  });

  it('will throw on bad input', () => {
    // @ts-expect-error
    expect(() => new Context({ toString: () => 'Thing' })).toThrow(
      'Context can only include an instance or class of Model but got Thing.'
    );
  });

  it('will not accept a map of inputs', () => {
    class A extends Model {}

    // @ts-expect-error
    expect(() => new Context().push({ A })).toThrow();
  });

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

describe('root global', () => {
  const { root } = Context;

  class Global extends Model {
    static readonly global: Model.Global = true;
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
    class Child extends Model {}
    class Parent extends Model {
      child = new Child();
    }

    const parent = Parent.new();

    expect(root.get(Parent, false)).toBeUndefined();
    expect(root.get(Child, false)).toBeUndefined();

    parent.set(null);
  });

  it('will register descendants of a global instance in root', () => {
    class Grandchild extends Model {}
    class Child extends Model {
      grandchild = new Grandchild();
    }
    class Parent extends Model {
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
    class Child extends Model {}
    class Parent extends Model {
      static readonly global = true;
      child?: Child = undefined;
    }

    const parent = Parent.new();

    parent.child = new Child();

    expect(root.get(Child)).toBe(parent.child);

    parent.set(null);
  });

  it('will not register a late child of a private sibling of a global', () => {
    class Child extends Model {}
    class Parent extends Model {
      static readonly global: Model.Global<Parent> = (self) => self.shared;
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
    class Grandchild extends Model {}
    class Child extends Model {
      grandchild = new Grandchild();
    }
    class Parent extends Model {
      child = new Child();
    }

    const parent = Parent.new();
    const context = root.push(parent);

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

    class Conditional extends Model {
      static readonly global: Model.Global = () => allow;
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
    class Instanced extends Model {
      persistent = true;
      static readonly global: Model.Global<Instanced> = (self) => self.persistent;
    }

    const instance = Instanced.new();

    expect(root.get(Instanced)).toBe(instance);

    instance.set(null);
  });

  it('will enforce global inheritance through static types', () => {
    void function () {
      class SealedGlobal extends Model {
        static readonly global = true;
      }
      class Floor extends Model {
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

      class Open extends Model {
        static readonly global: Model.Global = true;
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

  it.each<[string, Model.Global]>([
    ['will throw on duplicate global of same type', true],
    ['will throw on duplicate global from a resolver', () => true]
  ])('%s', (_, global) => {
    class Multi extends Model {
      static global = global;
    }

    const first = Multi.new();

    expect(() => Multi.new()).toThrow(/already exists in root/);
    expect(root.get(Multi)).toBe(first);

    first.set(null);
  });

  it('will throw if a subtype would hide a supertype global', () => {
    class Base extends Model {
      static readonly global: Model.Global = true;
    }
    class Sub extends Base {
      static readonly global = true;
    }

    const base = Base.new();

    expect(() => Sub.new()).toThrow(
      `as a global - ${base} already exists in root.`
    );
    expect(root.get(Base)).toBe(base);
    expect(root.get(Sub, false)).toBeUndefined();

    base.set(null);
  });

  it('will throw if a subtype global already resolves the type', () => {
    class Base extends Model {
      static readonly global: Model.Global = true;
    }
    class Sub extends Base {
      static readonly global = true;
    }

    const sub = Sub.new();

    expect(() => Base.new()).toThrow(
      `as a global - ${sub} already exists in root.`
    );
    expect(root.get(Base)).toBe(sub);

    sub.set(null);
  });

  it('will register a supertype after the subtype is destroyed', () => {
    class Base extends Model {
      static readonly global: Model.Global = true;
    }
    class Sub extends Base {
      static readonly global = true;
    }

    Sub.new().set(null);

    const base = Base.new();

    expect(root.get(Base)).toBe(base);

    base.set(null);
  });

  it('will preserve subtype entries on eviction', () => {
    class Base extends Model {}
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
    class Base extends Model {}
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
    class Scoped extends Model {}

    const ctx = new Context(Scoped);

    expect(ctx.get(Scoped)).toBeInstanceOf(Scoped);
    expect(root.get(Scoped, false)).toBeUndefined();

    ctx.pop();
  });

  it('will not apply global eviction to explicit add', () => {
    class Base extends Model {}
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
