import { vi, expect, it, describe } from 'vitest';
import { flushMicrotasks, mockError, mockPromise, mockUncaught, mockWarn } from '../test.setup';
import { Context } from './context';
import { get } from './field/get';
import { ref } from './field/ref';
import { set } from './field/set';
import { State, update } from './state';
import { event, listener, watch } from './observable';

const DESTROYED = /but state is destroyed/;
import { has } from './field/has';
import { map } from './field/map';

it('will extend custom class', () => {
  class Subject extends State {
    value = 1;
  }

  const state = Subject.new();

  expect(state.value).toBe(1);
});

it('will not create base State', () => {
  // @ts-expect-error
  const create = () => State.new();

  expect(create).toThrow('Cannot create base State.');
});

it('will not create abstract State', () => {
  abstract class Subject extends State {}

  void function create() {
    // No runtime error but typescript should complain.
    // @ts-expect-error
    Subject.new();
  };
});

it('will update on assignment', async () => {
  class Subject extends State {
    value = 1;
  }

  const state = Subject.new();

  expect(state.value).toBe(1);

  state.value = 2;

  const update = await state.set();

  expect(update).toEqual(['value']);
  expect(state.value).toBe(2);
});

it('will ignore assignment with same value', async () => {
  class Subject extends State {
    value = 1;
  }

  const state = Subject.new();

  expect(state.value).toBe(1);

  state.value = 1;

  const update = await state.set();

  expect(update.length).toEqual(0);
});

it('will update from within a method', async () => {
  class Subject extends State {
    value = 1;

    setValue(to: number) {
      this.value = to;
    }
  }

  const state = Subject.new();

  state.setValue(3);

  const update = await state.set();

  expect(update).toEqual(['value']);
  expect(state.value).toBe(3);
});

it('will not ignore function properties', async () => {
  const mockFunction = vi.fn();
  const mockFunction2 = vi.fn();

  class Test extends State {
    fn = mockFunction;
  }

  const test = Test.new();

  test.get((state) => {
    state.fn();
  });

  expect(mockFunction).toBeCalled();

  test.fn = mockFunction2;

  await expect(test).toHaveUpdated();

  expect(mockFunction2).toBeCalled();
  expect(mockFunction).toBeCalledTimes(1);
});

it('will iterate over properties', () => {
  class Test extends State {
    foo = 1;
    bar = 2;
    baz = 3;
  }

  const test = Test.new();
  const cb = vi.fn<(key: string, value: unknown) => void>();

  for (const [key, value] of test) cb(key, value);

  expect(cb).toBeCalledWith('foo', 1);
  expect(cb).toBeCalledWith('bar', 2);
  expect(cb).toBeCalledWith('baz', 3);
});

it('will destroy children before self', () => {
  class Nested extends State {}
  class Test extends State {
    nested = new Nested();
  }

  const test = Test.new();
  const destroyed = vi.fn();

  test.nested.get(null, destroyed);
  test.set(null);

  expect(destroyed).toBeCalled();
});

it('will mark children as dead when parent is destroyed', () => {
  class Child extends State {}
  class Parent extends State {
    child = new Child();
  }

  const parent = Parent.new();
  const { child } = parent;

  expect(child.get(null)).toBe(false);

  parent.set(null);

  expect(child.get(null)).toBe(true);
});

it('will destroy owned child when replaced', () => {
  class Child extends State {
    value = 1;
  }

  class Parent extends State {
    child = new Child();
  }

  const parent = Parent.new();
  const first = parent.child;

  expect(first.get(null)).toBe(false);

  parent.child = new Child();

  expect(first.get(null)).toBe(true);
  expect(parent.child.get(null)).toBe(false);
});

it('will adopt child from set factory', () => {
  const created = vi.fn();

  class Child extends State {
    value = 1;
    protected new() {
      created();
    }
  }

  class Parent extends State {
    child = set(() => new Child());
  }

  const parent = Parent.new();
  const { child } = parent;

  expect(created).toBeCalledTimes(1);
  expect(child.get(null)).toBe(false);

  parent.set(null);

  expect(child.get(null)).toBe(true);
});

it('will adopt child assigned after undefined', () => {
  class Child extends State {
    value = 1;
  }

  class Parent extends State {
    child?: Child = undefined;
  }

  const parent = Parent.new();

  parent.child = new Child();

  const { child } = parent;

  expect(child!.get(null)).toBe(false);

  parent.set(null);

  expect(child!.get(null)).toBe(true);
});

it('will destroy owned child when replaced', () => {
  class Child extends State {}

  class Parent extends State {
    child?: Child = undefined;
  }

  const parent = Parent.new();
  const first = new Child();

  parent.child = first;

  const second = new Child();

  parent.child = second;

  expect(first.get(null)).toBe(true);
  expect(second.get(null)).toBe(false);
});

it('will not own active child from set factory', () => {
  class Child extends State {}

  const held = Child.new();

  class Parent extends State {
    child = set(() => held);
  }

  const parent = Parent.new();

  expect(parent.child).toBe(held);
  expect(Context.root.get(Child, false)).toBeUndefined();

  parent.set(null);

  expect(held.get(null)).toBe(false);
});

it('will not re-provide a guest already provided above', () => {
  class Foo extends State {}
  class Holder extends State {
    foo = set(() => this.get(Foo));
  }

  const outer = new Context({ Foo });
  const foo = outer.get(Foo);
  const release = vi.fn();
  const attach = vi.fn(() => release);

  outer.get(Foo, attach);

  const notified = attach.mock.calls.length;
  const inner = outer.push().push(Holder);

  expect(inner.get(Holder).foo).toBe(foo);
  expect(attach).toHaveBeenCalledTimes(notified);

  inner.pop();

  expect(release).not.toHaveBeenCalled();
  expect(outer.get(Foo)).toBe(foo);
});

it('will provide a guest when ancestors hold others of its type', () => {
  class Foo extends State {}

  const foo = Foo.new();

  class Holder extends State {
    foo = set(() => foo);
  }

  const outer = new Context({ a: Foo, b: Foo });
  const inner = outer.push(Holder);

  expect(() => inner.get(Holder).foo).not.toThrow();
  expect(inner.get(Foo)).toBe(foo);
});

it('will not adopt child derived by getter', () => {
  class Child extends State {
    value = 1;
  }

  const held = Child.new();

  class Parent extends State {
    get child() {
      return held;
    }
  }

  const parent = Parent.new();

  expect(parent.child).toBe(held);

  parent.set(null);

  expect(held.get(null)).toBe(false);
});

it('will not destroy non-owned child when replaced', () => {
  class Child extends State {
    value = 1;
  }

  class Parent extends State {
    child = new Child();
  }

  const parent = Parent.new();
  const external = Child.new();

  parent.child = external;

  const owned = parent.child;
  expect(owned).toBe(external);

  parent.child = new Child();

  // External child was not owned, so it survives replacement.
  expect(external.get(null)).toBe(false);
});

it('will destroy owned child when property set to non-state', () => {
  class Child extends State {}
  class Parent extends State {
    child: Child | null = new Child();
  }

  const parent = Parent.new();
  const child = parent.child!;

  expect(child.get(null)).toBe(false);

  parent.child = null;

  expect(child.get(null)).toBe(true);
});

it('will not update when assigning same child instance', () => {
  class Child extends State {}
  class Parent extends State {
    child: Child = new Child();
  }

  const parent = Parent.new();
  const child = parent.child;
  const cb = vi.fn();

  parent.set(cb);
  parent.child = child;

  expect(cb).not.toBeCalled();
});

it('will store a child read through a subscriber as itself', async () => {
  class Child extends State {
    value = 1;

    get double() {
      return this.value * 2;
    }
  }

  class Parent extends State {
    a = new Child();
    active?: Child = this.a;
  }

  const parent = Parent.new();
  const child = parent.a;

  let proxy!: Parent;

  parent.get((self) => {
    proxy = self;
    return null;
  });

  expect(child.double).toBe(2);

  proxy.active = undefined;
  proxy.active = proxy.a;

  expect(Object.is(parent.is.active, child)).toBe(true);

  proxy.active = undefined;
  child.value = 3;

  await expect(child).toHaveUpdated();

  expect(child.get(null)).toBe(false);
  expect(child.double).toBe(6);
});

it('will destroy parent after child property cleared', () => {
  class Child extends State {}
  class Parent extends State {
    child: Child | null = new Child();
  }

  const parent = Parent.new();

  parent.child = null;
  parent.set(null);

  expect(parent.get(null)).toBe(true);
});

describe('methods', () => {
  it('will auto bind', async () => {
    class FooBar extends State {
      method() {
        return String(this);
      }
    }

    const foo1 = String(FooBar.new().method());
    const foo2 = String(FooBar.new().method());

    expect(foo1).not.toBe(foo2);
  });

  it('will bind to the instance, not a proxy', () => {
    class Test extends State {
      value = 0;

      whoami() {
        return this;
      }
    }

    const test = Test.new();
    let proxy!: Test;
    let inside!: Test;

    test.get((current) => {
      proxy = current;
      inside = current.whoami();
    });

    expect(proxy).not.toBe(test.is);
    expect(inside).toBe(test.is);
  });

  it('will call new() with the instance', () => {
    let inside!: Test;

    class Test extends State {
      protected new() {
        inside = this;
      }
    }

    const test = Test.new();

    expect(inside).toBe(test.is);
  });

  it('will allow overwrite', () => {
    class Test extends State {
      foo = 'foo';

      method() {
        return this.foo;
      }
    }

    const test = Test.new();

    test.method = () => 'bar';

    expect(test.method()).toBe('bar');

    test.method = () => 'baz';

    expect(test.method()).toBe('baz');
  });

  it('will not break super calls', () => {
    class Test extends State {
      action() {
        return 'Foo ';
      }
    }

    class Test2 extends Test {
      action() {
        return super.action() + 'Bar ';
      }
    }

    class Test3 extends Test2 {
      action() {
        return super.action() + 'Baz';
      }
    }

    const { action } = Test3.new();

    expect(action()).toBe('Foo Bar Baz');
  });

  it('will not bind a super method', () => {
    class Test extends State {
      action() {
        return 'Foo';
      }
    }

    class Test2 extends Test {
      action() {
        return super.action() + ' Bar';
      }
    }

    const test = Test2.new();

    expect(test.action()).toBe('Foo Bar');
    expect(test.action()).toBe('Foo Bar');
  });

  it('will ignore setter-only accessors', () => {
    class Test extends State {
      values: number[] = [];

      set latest(value: number) {
        this.values.push(value);
      }
    }

    const test = Test.new();

    test.latest = 5;

    expect(test.values).toEqual([5]);
  });
});

describe('subscriber', () => {
  class Subject extends State {
    value = 1;
    value2 = 2;
  }

  it('will detect change to properties accessed', async () => {
    const state = Subject.new();
    const effect = vi.fn(($: Subject) => {
      void $.value;
      void $.value2;
    });

    state.get(effect);

    state.value = 2;
    await expect(state).toHaveUpdated();

    state.value2 = 3;
    await expect(state).toHaveUpdated();

    expect(effect).toBeCalledTimes(3);
  });

  it('will ignore change to property not accessed', async () => {
    const state = Subject.new();
    const effect = vi.fn(($: Subject) => {
      void $.value;
    });

    state.get(effect);

    state.value = 2;
    await expect(state).toHaveUpdated();

    state.value2 = 3;
    await expect(state).toHaveUpdated();

    /**
     * we did not access value2 in above accessor,
     * subscriber assumes we don't care about updates
     * to this property, so it'l drop relevant events
     */
    expect(effect).toBeCalledTimes(2);
  });

  it('will not obstruct set-behavior', () => {
    class Test extends State {
      didSet = vi.fn();
      value = set('foo', this.didSet);
    }

    const test = Test.new();

    expect(test.value).toBe('foo');

    test.get((effect) => {
      effect.value = 'bar';
    });

    expect(test.value).toBe('bar');
    expect(test.didSet).toBeCalledWith('bar', 'foo');
  });
});

describe('string coercion', () => {
  class Test extends State {}

  it('will output a unique ID', () => {
    const foo = String(Test.new());
    const bar = String(Test.new());

    expect(foo).not.toBe(bar);
  });

  it('will be class name and 6 random characters', () => {
    class FooBar extends State {}

    const foobar = String(FooBar.new());

    expect(foobar).toMatch(/^FooBar-\w{6}/);
  });

  it('will work inside subscriber', () => {
    class Test extends State {
      foo = 'foo';
    }

    const test = Test.new();
    const cb = vi.fn();

    test.get((state) => {
      cb(String(state));
    });

    expect(cb).toBeCalledWith(String(test));
  });
});

describe('get method', () => {
  describe('export', () => {
    class Test extends State {
      foo = 'foo';
      bar = 'bar';
      baz = 'baz';
    }

    it('will export all values', () => {
      const test = Test.new();
      const values = test.get();

      expect(values).toEqual({
        foo: 'foo',
        bar: 'bar',
        baz: 'baz'
      });
    });

    it('will export frozen object', () => {
      const test = Test.new();
      const values = test.get();

      expect(Object.isFrozen(values)).toBe(true);
    });

    // FIXME(#97): vitest's .toContain silently iterates plain objects as empty,
    // so the original `.not.toContain('bar')` was a no-op. `test.get()` actually
    // includes 'bar' after access (verified under raw node 22). Skipped pending
    // a decision: is this a latent lib bug or is the test obsolete?
    it.skip('will ignore getters', () => {
      class Test extends State {
        foo = 'foo';

        get bar() {
          return 'bar';
        }

        set baz(value: string) {
          this.foo = value;
        }
      }

      const test = Test.new();

      expect(test.bar).toBe('bar');
      expect(Object.keys(test.get())).not.toContain('bar');
    });

    it('will export values recursively', () => {
      class Nested extends State {
        foo = 1;
        bar = 2;
        baz = 3;
      }

      class Test extends State {
        foo = 'foo';
        bar = 'bar';
        baz = 'baz';

        nested = new Nested();
      }

      const test = Test.new();
      const exported = test.get();

      // We want a copy, not the original.
      expect(exported.nested).not.toBeInstanceOf(Nested);

      const nested: State.Values<Nested> = exported.nested;

      expect(exported).toEqual({
        foo: 'foo',
        bar: 'bar',
        baz: 'baz',
        nested
      });

      expect(nested).toEqual({
        foo: 1,
        bar: 2,
        baz: 3
      });
    });

    it('will defer to get method exporting properties', () => {
      class Bar extends State {
        foo = 'foo';
      }

      class Test extends State {
        foo = { get: () => 3 };
        bar = ref<boolean>();
        baz = new Bar();
      }

      const test = Test.new();
      const exported = test.get();

      type Expected = {
        foo: number;
        bar: boolean | null;
        baz: { foo: string };
      };

      expect(exported as Expected).toEqual({
        foo: 3,
        bar: null,
        baz: { foo: 'foo' }
      });
    });

    it('will export infinite loop', () => {
      class Parent extends State {
        child = new Child();
        foo = 'foo';
      }

      class Child extends State {
        parent = get(Parent);
        bar = 'bar';
      }

      const parent = Parent.new();
      const exported = parent.get();

      expect(exported.child.parent as unknown).toBe(exported);
    });
  });

  describe('fetch', () => {
    it('will get value', () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = Test.new();

      expect(test.get('foo')).toBe('foo');
    });

    it('will get ref value', () => {
      class Test extends State {
        foo = ref<string>();
      }

      const test = Test.new();

      expect(test.get('foo')).toBe(null);

      test.foo.current = 'foobar';

      expect<string | null>(test.get('foo')).toBe('foobar');
    });

    it('will throw suspense if not yet available', async () => {
      class Test extends State {
        foo = set<string>();
      }

      const test = Test.new();
      let suspense;

      try {
        void test.get('foo');
      } catch (error) {
        expect(error).toBeInstanceOf(Promise);
        expect(String(error)).toMatch(/[\w-]+\.foo is not yet available\./);
        suspense = error;
      }

      test.foo = 'foobar';

      await expect(suspense).resolves.toBe('foobar');
    });

    it('will read undefined for pending value after destroyed', () => {
      class Test extends State {
        foo = set(() => new Promise<string>(() => {}), true);
      }

      const test = Test.new();

      test.set(null);

      expect(test.foo).toBeUndefined();
    });

    it('will suspend if undefined in strict mode', async () => {
      class Test extends State {
        foo?: string = undefined;
      }

      const test = Test.new();
      let suspense;

      try {
        void test.get('foo', true);
      } catch (error) {
        expect(error).toBeInstanceOf(Promise);
        expect(String(error)).toMatch(/[\w-]+\.foo is not yet available\./);
        suspense = error;
      }

      test.foo = 'foobar';

      await expect(suspense).resolves.toBe('foobar');
    });

    it('will get unbound method', () => {
      class Test extends State {
        value = 'foo';

        method() {
          return this.value;
        }
      }

      const { method, is: test } = Test.new();

      const test2 = Test.new({ value: 'bar' });

      expect(method.call(test2)).toBe('foo');
      expect(test.get('method').call(test2)).toBe('bar');
    });
  });

  describe('context', () => {
    class Foo extends State {}
    class Bar extends State {}

    it('will get from parent context', () => {
      const bar = new Bar();
      const foo = new Foo();

      new Context(bar).push(foo);

      expect(foo.get(Bar)).toBe(bar);
    });

    it('will get peer state', () => {
      const foo = Foo.new();
      const bar = Bar.new();

      new Context({ foo, bar });

      expect(foo.get(Bar)).toBe(bar);
    });

    it('will return undefined if not found', () => {
      const foo = new Foo();

      new Context(foo);

      expect(foo.get(Bar, false)).toBeUndefined();
    });

    it('will throw if required and not found', () => {
      const foo = new Foo();

      new Context(foo);

      expect(() => foo.get(Bar)).toThrow('Could not find Bar in context.');
    });

    it('will throw if upstream not found', () => {
      const context = new Context();
      const child = new Bar();

      context.push(child);

      expect(() => child.get(Foo)).toThrow();
    });

    it('will return undefined if upstream optional', () => {
      const context = new Context();
      const child = new Bar();

      context.push(child);

      expect(child.get(Foo, false)).toBeUndefined();
    });

    it('will skip self when looking up own type', () => {
      const outer = new Foo();
      const inner = new Foo();

      new Context(outer).push(inner);

      expect(inner.get(Foo)).toBe(outer);
      expect(inner.get(Foo, false)).toBe(outer);
    });

    it('will return undefined when no upstream of own type', () => {
      const foo = new Foo();

      new Context(foo);

      expect(foo.get(Foo, false)).toBeUndefined();
      expect(() => foo.get(Foo)).toThrow('Could not find Foo in context.');
    });

    it('will skip self in callback subscription for own type', () => {
      const outer = new Foo();
      const inner = new Foo();

      new Context(outer).push(inner);

      const callback = vi.fn();
      inner.get(Foo, callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(outer, false);
    });

    it('will subscribe with callback', () => {
      const parent = new Foo();
      const ctx = new Context(parent);

      const callback = vi.fn();
      const unsub = ctx.get(Bar, callback, true);

      const child = new Bar();
      const sub = ctx.push(child);

      expect(callback).toHaveBeenCalledWith(child, true);
      expect(typeof unsub).toBe('function');

      unsub();
      sub.pop();
    });
  });

  describe('owner', () => {
    class Child extends State {}

    it('will get owner of a field', () => {
      class Parent extends State {
        child = new Child();
      }

      const parent = Parent.new();

      expect(parent.child.get(State)).toBe(parent);
    });

    it('will get owner of a late assignment', () => {
      class Parent extends State {
        child?: Child = undefined;
      }

      const parent = Parent.new();

      parent.child = new Child();

      expect(parent.child.get(State)).toBe(parent);
    });

    it('will get owner of pool and map members', () => {
      class Parent extends State {
        pool = has(Child);
        keyed = map<string, Child>();
      }

      const parent = Parent.new();
      const member = parent.pool.add();

      parent.keyed.set('a', new Child());

      expect(member.get(State)).toBe(parent);
      expect(parent.keyed.get('a')!.get(State)).toBe(parent);
    });

    it('will not get holder of an active State', () => {
      class Parent extends State {
        child?: Child = undefined;
      }

      const parent = Parent.new();
      const child = Child.new();

      parent.child = child;

      expect(child.get(State, false)).toBeUndefined();
    });

    it('will get State a context was set up for', () => {
      const host = Child.new();
      const child = new Child();

      new Context(host).push(child);

      expect(child.get(State)).toBe(host);
    });

    it('will skip context set up for itself', () => {
      const host = Child.new();
      const child = new Child();

      new Context(host).push().push(child);

      expect(host.get(State, false)).toBeUndefined();
      expect(child.get(State)).toBe(host);
    });

    it('will not get from context of several States', () => {
      const a = Child.new();
      const b = Child.new();
      const child = new Child();

      new Context({ a, b }).push(child);

      expect(child.get(State, false)).toBeUndefined();
    });

    it('will throw if none', () => {
      const child = Child.new();

      expect(() => child.get(State)).toThrow(`${child} has no owner.`);
      expect(child.get(State, false)).toBeUndefined();
    });

    it('will report owned States', () => {
      class Parent extends State {
        child = new Child();
        guest?: Child = undefined;
        pool = has(Child);
        late?: Child = undefined;
      }

      const parent = Parent.new();
      const callback = vi.fn();

      parent.guest = Child.new();
      parent.get(State, callback, true);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(parent.child);

      const member = parent.pool.add();
      parent.late = new Child();

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenNthCalledWith(2, member);
      expect(callback).toHaveBeenNthCalledWith(3, parent.late);
    });

    it('will report States hosted by context', () => {
      const host = Child.new();
      const child = new Child();
      const callback = vi.fn();

      host.get(State, callback, true);
      new Context(host).push(child);

      expect(callback).toHaveBeenCalledWith(child);
    });

    it('will run cleanup when owned State is destroyed', () => {
      class Parent extends State {
        pool = has(Child);
      }

      const parent = Parent.new();
      const member = parent.pool.add();
      const cleanup = vi.fn();
      const callback = vi.fn();

      parent.get(State, () => cleanup, true);
      parent.pool.delete(member);

      expect(cleanup).toHaveBeenCalledTimes(1);

      parent.get(State, callback, true);

      expect(callback).not.toHaveBeenCalled();
    });

    it('will stop reporting when cancelled', () => {
      class Parent extends State {
        pool = has(Child);
      }

      const parent = Parent.new();
      const callback = vi.fn();
      const stop = parent.get(State, callback, true);

      stop();
      parent.pool.add();

      expect(callback).not.toHaveBeenCalled();
    });

    it('will report direct children only', () => {
      class Middle extends State {
        child = new Child();
      }
      class Root extends State {
        middle = new Middle();
      }

      const root = Root.new();
      const callback = vi.fn();

      root.get(State, callback, true);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(root.middle);
      expect(root.middle.child.get(State)).toBe(root.middle);
      expect(root.middle.child.get(State).get(State)).toBe(root);
    });

    it('will keep owner once activated', () => {
      class Parent extends State {
        child?: Child = undefined;
      }

      const a = Parent.new();
      const b = Parent.new();
      const child = new Child();

      a.child = child;
      b.child = child;

      new Context(b).push(child);

      expect(child.get(State)).toBe(a);
      expect(a.child).toBe(child);
      expect(b.child).toBe(child);
    });

    it('will not get holder of a pool guest', () => {
      class Parent extends State {
        pool = has(Child);
      }

      const owner = Parent.new();
      const holder = Parent.new();
      const member = owner.pool.add();

      const callback = vi.fn();

      holder.pool.add(member);
      holder.pool.add(Child.new());
      holder.get(State, callback, true);

      expect(member.get(State)).toBe(owner);
      expect(holder.pool.size).toBe(2);
      expect(callback).not.toHaveBeenCalled();
    });

    it('will run cleanup when owner is destroyed', () => {
      class Parent extends State {
        child = new Child();
        pool = has(Child);
      }

      const parent = Parent.new();
      const cleanup = vi.fn();

      parent.pool.add();
      parent.get(State, (child) => () => cleanup(child), true);
      parent.set(null);

      expect(cleanup).toHaveBeenCalledTimes(2);
      expect(cleanup).toHaveBeenCalledWith(parent.child);
    });
  });

  describe('null', () => {
    class Test extends State {}

    it('will return true if state is not destroyed', () => {
      const test = Test.new();

      expect(test.get(null)).toBe(false);

      test.set(null);

      expect(test.get(null)).toBe(true);
    });

    it('will callback when state is destroyed', () => {
      const test = Test.new();
      const cb = vi.fn();

      test.get(null, cb);

      expect(cb).not.toBeCalled();

      test.set(null);

      expect(cb).toBeCalled();
    });
  });

  describe('effect', () => {
    class Test extends State {
      value1 = 1;
      value2 = 2;
      value3 = 3;
      get value4() {
        return this.value3 + 1;
      }
    }

    it('will watch values', async () => {
      const test = Test.new();
      const anyTest = expect.any(Test);
      const effect = vi.fn((state: Test) => {
        void state.value1;
        void state.value2;
        void state.value3;
        void state.value4;
      });

      test.get(effect);

      expect(effect).toBeCalledWith(anyTest, []);

      test.value1 = 2;

      // wait for update event, thus queue flushed
      await expect(test).toHaveUpdated('value1');

      expect(effect).toBeCalledWith(anyTest, ['value1']);

      test.value2 = 3;
      test.value3 = 4;

      // wait for update event to flush queue
      await expect(test).toHaveUpdated('value2', 'value3', 'value4');

      expect(effect).toBeCalledWith(anyTest, ['value2', 'value3', 'value4']);

      // expect two syncronous groups of updates.
      expect(effect).toBeCalledTimes(3);
    });

    it('will not call twice if set up during init', () => {
      const didUpdate = vi.fn();

      class Control extends State {
        value = 'foo';

        protected new() {
          this.get(({ value }) => {
            didUpdate(value);
          });
        }
      }

      Control.new();

      expect(didUpdate).toBeCalledTimes(1);
      expect(didUpdate).toBeCalledWith('foo');
    });

    it('will squash simultaneous updates', async () => {
      const test = Test.new();
      const cb = vi.fn();

      test.get((state) => {
        void state.value1;
        void state.value2;
        cb();
      });

      test.value1 = 2;
      test.value2 = 3;

      await expect(test).toHaveUpdated();

      // expect two syncronous groups of updates.
      expect(cb).toBeCalledTimes(2);
    });

    it('will squash computed updates', async () => {
      const test = Test.new();
      const cb = vi.fn();

      test.get((state) => {
        void state.value3;
        void state.value4;
        cb();
      });

      test.value3 = 4;

      await expect(test).toHaveUpdated();

      // expect two syncronous groups of updates.
      expect(cb).toBeCalledTimes(2);
    });

    it('will update for nested values', async () => {
      class Child extends State {
        value = 'foo';
      }

      class Test extends State {
        child = new Child();
      }

      const test = Test.new();
      const effect = vi.fn((state: Test) => {
        void state.child.value;
      });

      test.get(effect);

      expect(effect).toBeCalled();
      test.child.value = 'bar';

      await expect(test.child).toHaveUpdated();

      expect(effect).toBeCalledTimes(2);
    });

    it('will update when assigned through proxy', async () => {
      class Test extends State {
        value = 'foo';
      }

      const test = Test.new();
      let proxy!: Test;

      const effect = vi.fn((state: Test) => {
        proxy = state;
        void state.value;
      });

      test.get(effect);

      expect(proxy).not.toBe(test);
      expect(Object.getPrototypeOf(proxy)).toBe(test);

      proxy.value = 'bar';

      await expect(test).toHaveUpdated('value');

      expect(test.value).toBe('bar');
      expect(effect).toBeCalledTimes(2);
    });

    it('will update when assigned through nested proxy', async () => {
      class Child extends State {
        value = 'foo';
      }

      class Test extends State {
        child = new Child();
      }

      const test = Test.new();
      let child!: Child;

      const effect = vi.fn((state: Test) => {
        child = state.child;
        void child.value;
      });

      test.get(effect);

      expect(child).not.toBe(test.child);
      expect(Object.getPrototypeOf(child)).toBe(test.child);

      child.value = 'bar';

      await expect(test.child).toHaveUpdated('value');

      expect(test.child.value).toBe('bar');
      expect(effect).toBeCalledTimes(2);
    });

    it('will subscribe deeply', async () => {
      class Parent extends State {
        value = 'foo';
        empty = undefined;
        child = new Child();
      }

      class Child extends State {
        value = 'foo';
        grandchild = new GrandChild();
      }

      class GrandChild extends State {
        value = 'bar';
      }

      const parent = Parent.new();
      const effect = vi.fn();
      let promise = mockPromise();

      parent.get((state) => {
        const { child } = state;
        const { grandchild } = child;

        effect(child.value, grandchild.value);
        promise.resolve();
      });

      expect(effect).toBeCalledWith('foo', 'bar');
      effect.mockClear();

      promise = mockPromise();
      parent.child.value = 'bar';
      await promise;

      expect(effect).toBeCalledWith('bar', 'bar');
      effect.mockClear();

      promise = mockPromise();
      parent.child = new Child();
      await promise;

      expect(effect).toBeCalledWith('foo', 'bar');
      effect.mockClear();

      promise = mockPromise();
      parent.child.value = 'bar';
      await promise;

      expect(effect).toBeCalledWith('bar', 'bar');
      effect.mockClear();

      promise = mockPromise();
      parent.child.grandchild.value = 'foo';
      await promise;

      expect(effect).toBeCalledWith('bar', 'foo');
      effect.mockClear();
    });

    it('will subscribe if value starts undefined', async () => {
      class Child extends State {
        value = 'foo';
      }

      class Parent extends State {
        value = 'foo';
        child?: Child = undefined;
      }

      const state = Parent.new();
      const cb = vi.fn((it: Parent) => {
        void it.value;

        if (it.child) void it.child.value;
      });

      state.get(cb);

      state.child = Child.new();
      await expect(state).toHaveUpdated();
      expect(cb).toBeCalledTimes(2);

      // Will refresh on sub-value change.
      state.child.value = 'bar';
      await expect(state.child).toHaveUpdated();
      expect(cb).toBeCalledTimes(3);

      // Will refresh on undefined.
      state.child = undefined;
      await expect(state).toHaveUpdated();
      expect(state.child).toBeUndefined();
      expect(cb).toBeCalledTimes(4);

      // Will refresh on repalcement.
      state.child = Child.new();
      await expect(state).toHaveUpdated();
      expect(cb).toBeCalledTimes(5);

      // New subscription still works.
      state.child.value = 'bar';
      await expect(state.child).toHaveUpdated();
      expect(cb).toBeCalledTimes(6);
    });

    it('will not update for removed children', async () => {
      class Nested extends State {
        value = 1;
      }

      class Test extends State {
        nested = new Nested();
      }

      const test = Test.new();
      const effect = vi.fn((state: Test) => {
        void state.nested.value;
      });

      test.get(effect);
      expect(effect).toBeCalled();

      test.nested.value++;
      await expect(test.nested).toHaveUpdated();
      expect(effect).toBeCalledTimes(2);

      const old = test.nested;

      test.nested = Nested.new();
      await expect(test).toHaveUpdated();

      // Updates because nested property is new.
      expect(effect).toBeCalledTimes(3);

      // Old child was owned, so it is destroyed on replacement.
      expect(old.get(null)).toBe(true);
    });

    it('will call immediately', async () => {
      const testEffect = vi.fn();
      const test = Test.new();

      test.get(testEffect);

      expect(testEffect).toBeCalled();
    });

    it('will call only when ready', async () => {
      class Test2 extends Test {
        constructor(...args: State.Args) {
          super(args);
          this.get((state) => {
            void state.value1;
            void state.value3;
            cb();
          });
        }
      }

      const cb = vi.fn();
      const state = Test2.new();

      state.value1++;
      await expect(state).toHaveUpdated();

      expect(cb).toBeCalled();

      state.value3++;
      await expect(state).toHaveUpdated();

      // expect pre-existing listener to hit
      expect(cb).toBeCalledTimes(3);
    });

    it('will bind to state called upon', () => {
      class Test extends State {}

      function testEffect(this: Test) {
        didCreate(this);
      }

      const didCreate = vi.fn();
      const test = Test.new();

      test.get(testEffect);

      expect(didCreate).toBeCalledWith(test);
    });

    it('will work without State.new', async () => {
      const test = new Test();
      const cb = vi.fn();

      test.get(cb);

      expect(cb).not.toBeCalled();

      test.set('EVENT');

      expect(cb).toBeCalled();
    });

    it('will not subscribe from method', async () => {
      class Test extends State {
        foo = 1;
        bar = 2;

        action() {
          void this.bar;
        }
      }

      const test = Test.new();
      const effect = vi.fn((self: Test) => {
        self.action();
        void self.foo;
      });

      test.get(effect);

      test.foo++;

      await expect(test).toHaveUpdated();
      expect(effect).toBeCalledTimes(2);

      test.bar++;

      await expect(test).toHaveUpdated();
      expect(effect).toBeCalledTimes(2);
    });

    it('will subscribe method passed directly', async () => {
      const didInvoke = vi.fn();

      class Test extends State {
        foo = 1;

        constructor(...args: State.Args) {
          super(args, () => {
            this.get(this.action);
          });
        }

        action() {
          didInvoke(this.foo);
        }
      }

      const test = Test.new();

      expect(didInvoke).toBeCalledWith(1);

      test.foo = 2;

      await expect(test).toHaveUpdated();
    });

    describe('return value', () => {
      it('will callback on next update', async () => {
        class Test extends State {
          value1 = 1;
        }

        const state = Test.new();
        const cb = vi.fn();

        state.get((state) => {
          void state.value1;
          return cb;
        });

        expect(cb).not.toBeCalled();

        state.value1 = 2;

        await expect(state).toHaveUpdated();

        expect(cb).toBeCalledWith(true);
      });

      it('will callback on null event', async () => {
        const willDestroy = vi.fn();
        const test = Test.new();

        test.get(() => willDestroy);
        test.set(null);

        expect(willDestroy).toBeCalledWith(null);
      });

      it('will cancel effect on callback', async () => {
        const test = Test.new();
        const cb = vi.fn();
        const didEffect = vi.fn((test: Test) => {
          void test.value1;
          return cb;
        });

        const done = test.get(didEffect);

        test.value1 += 1;

        await expect(test).toHaveUpdated();
        expect(didEffect).toBeCalledTimes(2);

        cb.mockReset();

        done();

        expect(cb).toBeCalledWith(false);

        test.value1 += 1;
        await expect(test).toHaveUpdated();

        expect(didEffect).toBeCalledTimes(2);
      });

      it('will cancel if null', async () => {
        const test = Test.new();
        const didEffect = vi.fn((test: Test) => {
          void test.value1;
          return null;
        });

        test.get(didEffect);

        test.value1 += 1;
        await expect(test).toHaveUpdated();

        expect(didEffect).toBeCalledTimes(1);
      });

      it('will cancel if null after callback', async () => {
        const test = Test.new();
        const cleanup = vi.fn();

        let callback: (() => void) | null = cleanup;

        const didEffect = vi.fn((test: Test) => {
          void test.value1;
          return callback;
        });

        test.get(didEffect);

        callback = null;
        test.value1 += 1;
        await expect(test).toHaveUpdated();

        expect(didEffect).toBeCalledTimes(2);

        test.value1 += 1;
        await expect(test).toHaveUpdated();

        expect(didEffect).toBeCalledTimes(2);
        expect(cleanup).toBeCalledTimes(1);
      });

      // TODO: should this complain?
      it('will void return value', () => {
        const state = Test.new();
        const attempt = () => {
          // @ts-expect-error
          state.get(() => 'foobar');
        };

        expect(attempt).not.toThrow();
      });

      it('will ignore returned promise', () => {
        const state = Test.new();
        const attempt = () => {
          state.get(async () => {});
        };

        expect(attempt).not.toThrow();
      });
    });

    describe('suspense', () => {
      class Test extends State {
        value = set<string>();
        other = 'foo';
      }

      it('will retry', async () => {
        const test = Test.new();
        const didTry = vi.fn();
        const didInvoke = vi.fn();

        test.get(($) => {
          didTry();
          didInvoke($.value);
        });

        expect(didTry).toBeCalled();
        expect(didInvoke).not.toBeCalled();

        test.value = 'foobar';

        await expect(test).toHaveUpdated();
        expect(didInvoke).toBeCalledWith('foobar');
      });

      it('will still subscribe', async () => {
        const test = Test.new();
        const didTry = vi.fn();
        const didInvoke = vi.fn();

        test.get(($) => {
          didTry();
          didInvoke($.value);
        });

        test.value = 'foo';

        await expect(test).toHaveUpdated();
        expect(didInvoke).toBeCalledWith('foo');

        test.value = 'bar';

        await expect(test).toHaveUpdated();
        expect(didInvoke).toBeCalledWith('bar');
        expect(didTry).toBeCalledTimes(3);
      });

      it('will not update while pending', async () => {
        const test = Test.new();
        const willUpdate = vi.fn();
        const didUpdate = vi.fn();

        test.get((state) => {
          willUpdate();
          void state.value;
          void state.other;
          didUpdate(state.value);
        });

        expect(willUpdate).toBeCalled();

        test.other = 'bar';

        await expect(test).toHaveUpdated();
        expect(willUpdate).toBeCalled();

        test.value = 'foo';

        await expect(test).toHaveUpdated();
        expect(didUpdate).toBeCalledWith('foo');
        expect(willUpdate).toBeCalledTimes(2);
      });
    });

    describe('before ready', () => {
      it('will watch value', async () => {
        class Test extends State {
          value1 = 1;

          constructor(...args: State.Args) {
            super(args);
            this.get((state) => cb(state.value1));
          }
        }

        const cb = vi.fn();
        const state = Test.new();

        state.value1++;
        await expect(state).toHaveUpdated();

        expect(cb).toBeCalledTimes(2);
      });

      it('will watch computed value', async () => {
        class Test extends State {
          value1 = 2;

          get value2() {
            return this.value1 + 1;
          }

          protected new() {
            this.get((state) => cb(state.value2));
          }
        }

        const cb = vi.fn();
        const state = Test.new();

        state.value1++;
        await expect(state).toHaveUpdated();

        expect(cb).toBeCalled();
      });

      it('will remove listener on callback', async () => {
        class Test extends State {
          value = 1;

          // assigned during constructor phase.
          done = this.get((state) => cb(state.value));
        }

        const cb = vi.fn();
        const test = Test.new();

        test.value++;
        await expect(test).toHaveUpdated();
        expect(cb).toBeCalledTimes(2);

        test.value++;
        await expect(test).toHaveUpdated();
        expect(cb).toBeCalledTimes(3);

        test.done();

        test.value++;
        await expect(test).toHaveUpdated();
        expect(cb).toBeCalledTimes(3);
      });
    });
  });
});

describe('set method', () => {
  describe('event', () => {
    class Test extends State {
      foo = 'foo';
    }

    it('will force update', async () => {
      const test = Test.new();

      expect(test.foo).toBe('foo');

      test.set('foo');

      await expect(test).toHaveUpdated('foo');

      expect(test.foo).toBe('foo');
    });

    it('will update for untracked key', async () => {
      const test = Test.new();

      test.set('bar');

      await expect(test).toHaveUpdated('bar');
    });

    it('will update for symbol', async () => {
      const test = Test.new();
      const event = Symbol('event');

      test.set(event);

      await expect(test).toHaveUpdated(event);
    });

    it('will update for number', async () => {
      const test = Test.new();

      test.set(42);

      await expect(test).toHaveUpdated(42);
    });
  });

  describe('config', () => {
    it('will assign a value', async () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = Test.new();

      test.set('foo', { value: 'bar' });

      await expect(test).toHaveUpdated('foo');

      expect(test.foo).toBe('bar');
    });

    it('will assign a value to ref', async () => {
      class Test extends State {
        foo = ref<string>();
      }

      const test = Test.new();

      test.set('foo', { value: 'bar' });

      await expect(test).toHaveUpdated('foo');

      expect(test.foo.current).toBe('bar');
    });

    it('will bypass setter when updating value', async () => {
      class Test extends State {
        foo = set(1, () => {
          throw Error('setter should not run');
        });
      }

      const test = Test.new();

      test.set('foo', { value: 2 });

      await expect(test).toHaveUpdated('foo');
      expect(test.foo).toBe(2);
    });

    it('will throw if redefining managed property', () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = Test.new();

      expect(() => {
        test.set('foo', { value: 'bar', set: false });
      }).toThrow('already defined');
    });

    it('will define a read-only property', () => {
      class Test extends State {
        foo = 'foo';
      }

      interface Test {
        bar: string;
      }

      const test = Test.new();

      test.set('bar', { value: 'hello', set: false });

      expect(test.bar).toBe('hello');
      expect(() => {
        test.bar = 'nope';
      }).toThrow('read-only');
    });

    it('will define a non-enumerable property', () => {
      class Test extends State {
        foo = 'foo';
      }

      interface Test {
        bar: string;
      }

      const test = Test.new();

      test.set('bar', { value: 'hidden', enumerable: false });

      expect(test.bar).toBe('hidden');
      expect(Object.keys(test)).not.toContain('bar');
    });

    it('will register child state via descriptor', async () => {
      class Child extends State {
        value = 'hello';
      }

      class Parent extends State {
        foo = 'foo';
      }

      interface Parent {
        child: Child;
      }

      const parent = Parent.new();
      const child = new Child();

      parent.set('child', { value: child });

      await expect(parent).toHaveUpdated('child');
      expect(parent.child).toBe(child);

      // child was not yet activated, parent wires it up
      expect(child.get(null)).toBe(false);

      parent.set(null);

      // destroying parent cascades to unactivated child
      expect(child.get(null)).toBe(true);
    });

    it('will replace child state via descriptor', async () => {
      class Child extends State {
        value = 'hello';
      }

      class Parent extends State {
        foo = 'foo';
      }

      interface Parent {
        child: Child;
      }

      const parent = Parent.new();
      const first = new Child();
      const second = new Child();

      parent.set('child', { value: first });

      await expect(parent).toHaveUpdated('child');
      expect(parent.child).toBe(first);

      // reassign child
      parent.child = second as any;

      await expect(parent).toHaveUpdated('child');
      expect(parent.child).toBe(second);
    });

    it('will add property to tracking', async () => {
      class Test extends State {
        foo = 'foo';
      }

      interface Test {
        bar: string;
      }

      const test = Test.new();
      const cb = vi.fn();

      test.get(({ foo, bar }) => {
        cb(foo, bar);
      });

      test.foo = 'bar';

      await expect(test).toHaveUpdated('foo');
      expect(cb).toBeCalledWith('bar', undefined);

      test.bar = 'bob';

      expect(test.bar).toBe('bob');

      // bar assignment is ignored because it's not formally defined
      await expect(test).not.toHaveUpdated('bar');
      expect(cb).not.toBeCalledWith('bar', 'bob');

      // assign bar formally adding to state
      test.set('bar', { value: 'baz' });

      // bar is redefined
      expect(test.bar).toBe('baz');
      expect(test).toHaveUpdated('bar');

      // The effect isn't observing bar yet
      expect(cb).not.toBeCalledWith('bar', 'baz');

      // force refresh using foo instead
      test.set('foo');
      await expect(test).toHaveUpdated('foo');
      expect(cb).toBeCalledWith('bar', 'baz');

      test.bar = 'qux';

      // updates no longer ignored
      await expect(test).toHaveUpdated('bar');
      expect(test.bar).toBe('qux');
      expect(cb).toBeCalledWith('bar', 'qux');
    });

    it('will apply config to a key', async () => {
      class Subject extends State {
        value = 1;
      }

      const state = Subject.new();

      state.set('value', { value: 42 });

      await expect(state).toHaveUpdated();
      expect(state.value).toBe(42);
    });

    it('will no-op when applying empty config to already-defined property', async () => {
      class Subject extends State {
        foo = 'bar';
      }

      const state = Subject.new();

      state.set('foo', { value: 'baz' });
      await expect(state).toHaveUpdated();

      state.set('foo', {});

      expect(state.foo).toBe('baz');
    });
  });

  describe('promise-like', () => {
    it('will resolve update frame', async () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = Test.new();

      test.foo = 'bar';

      expect(await test.set()).toEqual(['foo']);
    });

    it('will resolve with symbols', async () => {
      class Test extends State {}

      const test = Test.new();
      const event = Symbol('event');

      test.set(event);

      const update = await test.set();

      expect(update).toEqual([event]);
    });

    it('will resolve empty array if no update', async () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = Test.new();

      expect(await test.set()).toEqual([]);
    });

    it('will force initial update', async () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = new Test();
      const effect = vi.fn();

      test.get(effect);
      expect(effect).not.toBeCalled();

      test.set();
      expect(effect).toBeCalled();
    });

    it('will initialize from set({}) when created with new', () => {
      const didSetFoo = vi.fn();

      class Test extends State {
        foo = set<string>(undefined, didSetFoo);
      }

      const test = new Test();

      test.set({ foo: 'foo' });

      expect(didSetFoo).toBeCalled();
      expect(test.foo).toBe('foo');
    });
  });

  describe('callback', () => {
    it('will call callback on update', async () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = Test.new();
      const cb = vi.fn();

      test.set(cb);

      test.foo = 'bar';
      test.foo = 'baz';

      expect(cb).toBeCalledWith('foo', test);
      expect(cb).toBeCalledTimes(2);
    });

    it('will not self-update', () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = Test.new();
      const cb = vi.fn(() => {
        test.foo = 'baz';
      });

      test.set(cb);
      test.foo = 'bar';

      expect(cb).toBeCalledTimes(1);
      expect(test.foo).toBe('baz');
    });
  });

  describe('listener', () => {
    it('will call listener on update', async () => {
      class Test extends State {
        foo = 'foo';
        bar = 'bar';
      }

      const test = Test.new();
      const didUpdateFoo = vi.fn();

      test.set('foo', didUpdateFoo);

      test.foo = 'bar';
      test.foo = 'baz';
      expect(didUpdateFoo).toBeCalledWith('foo', test);
      expect(didUpdateFoo).toBeCalledTimes(2);

      test.bar = 'baz';
      expect(didUpdateFoo).toBeCalledTimes(2);
    });

    it('will run returned function once on settle', async () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = Test.new();
      const done = vi.fn();
      const cb = vi.fn(() => done);

      test.set('foo', cb);

      expect(cb).toBeCalledTimes(0);

      test.foo = 'bar';
      test.foo = 'baz';

      expect(cb).toBeCalledTimes(2);
      expect(cb).toBeCalledWith('foo', test);

      await expect(test).toHaveUpdated('foo');

      expect(done).toBeCalledTimes(1);
    });

    it('will call on explicit event', async () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = Test.new();
      const cb = vi.fn();

      test.set('baz', cb);

      expect(cb).not.toBeCalled();

      // dispatch explicit event
      test.set('baz');

      expect(cb).toBeCalledWith('baz', test);
    });

    it('will unsubscribe if returns null', async () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = Test.new();
      const didUpdateFoo = vi.fn(() => null);

      test.set('foo', didUpdateFoo);

      test.foo = 'bar';
      test.foo = 'baz';

      expect(didUpdateFoo).toBeCalledTimes(1);
    });

    it('will call synconously on destroy', async () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = Test.new();
      const didDestroy = vi.fn();

      test.set(null, didDestroy);
      test.set(null);

      expect(didDestroy).toBeCalledWith(null, test);
    });
  });

  describe('effect', () => {
    mockError();

    class Test extends State {
      foo = 0;
      bar = 1;
      baz = 2;
    }

    it('will call every update', async () => {
      const test = Test.new();
      const cb = vi.fn();

      const done = test.set((a, b) => {
        cb(a, Object.assign({}, b));
      });

      test.foo = 1;
      test.foo = 2;
      test.bar = 2;

      expect(cb).toBeCalledWith('foo', { foo: 1, bar: 1, baz: 2 });
      expect(cb).toBeCalledWith('foo', { foo: 2, bar: 1, baz: 2 });
      expect(cb).toBeCalledWith('bar', { foo: 2, bar: 2, baz: 2 });

      done();
    });

    it('will callback after frame', async () => {
      const test = Test.new();
      const didUpdate = vi.fn(() => didUpdateAsync);
      const didUpdateAsync = vi.fn();

      const done = test.set(didUpdate);

      test.foo = 1;
      test.bar = 2;

      expect(didUpdate).toBeCalledTimes(2);
      expect(didUpdateAsync).not.toBeCalled();

      await expect(test).toHaveUpdated();

      expect(didUpdateAsync).toBeCalledTimes(1);

      done();
    });

    // mockError doesn't work in vitest env
    it('will let an error thrown by async callback escape', async () => {
      const caught = mockUncaught();
      const test = Test.new();
      const oops = new Error('oops');

      const done = test.set(() => () => {
        throw oops;
      });

      test.foo = 1;

      await expect(test).toHaveUpdated();
      expect(caught).toEqual([oops]);

      done();
    });

    it('will not activate State prematurely', () => {
      class Test extends State {
        foo = 0;

        constructor() {
          super();
          this.set(callback);
        }
      }

      class Subject extends Test {
        bar = 1;
      }

      const callback = vi.fn();
      const test = Subject.new();

      test.bar = 2;

      expect(callback).toBeCalledWith('bar', test);
    });

    describe('destroyed', () => {
      const warn = mockWarn();

      it('will store an update without dispatch and report it to catch', () => {
        class Test extends State {
          foo = 0;
        }

        const callback = vi.fn();
        const handler = vi.fn();
        const test = Test.new();

        Test.on({ catch: handler });
        test.set(callback);
        test.foo++;
        test.set(null);

        expect(() => test.foo++).not.toThrow();
        expect(test.foo).toBe(2);
        expect(callback).toBeCalledTimes(1);
        expect(handler).toBeCalledTimes(1);
        expect(handler).toBeCalledWith(
          expect.objectContaining({ message: expect.stringMatching(/Tried to update [\w-]+\.foo but state is destroyed\./) }),
          'dead',
          'foo'
        );
        expect(handler.mock.contexts[0]).toBe(test);
      });

      it('will report set with config', () => {
        class Test extends State {
          foo = 0;
        }

        const handler = vi.fn();
        const test = Test.new();

        Test.on({ catch: handler });
        test.set(null);
        test.set('foo', { value: 1 });

        expect(handler).toBeCalledWith(expect.any(Error), 'dead', 'foo');
      });

      it('will store and report assign', () => {
        class Test extends State {
          foo = 0;
        }

        const handler = vi.fn();
        const test = Test.new();

        Test.on({ catch: handler });
        test.set(null);
        test.set({ foo: 1 });

        expect(test.foo).toBe(1);
        expect(handler).toBeCalledWith(expect.any(Error), 'dead', 'foo');
      });

      it('will let a continuation that writes after teardown run to completion', async () => {
        class Loop extends State {
          again = true;
        }

        const caught = mockUncaught();
        const loop = Loop.new();
        let runs = 0;

        const work = (async () => {
          do {
            if (++runs > 10) throw new Error('spun');
            loop.again = false;
            await Promise.resolve();
          } while (loop.again);
        })();

        loop.again = true;
        loop.set(null);

        await expect(work).resolves.toBeUndefined();
        await flushMicrotasks();

        expect(runs).toBe(2);
        expect(caught).toEqual([]);
        expect(warn).not.toBeCalled();
      });

      it('will store a write a catch handler takes', async () => {
        class Test extends State {
          foo = 0;
        }

        const caught = mockUncaught();
        const stop = Test.on({ catch: (error, kind) => (kind == 'dead' ? undefined : error) });
        const test = Test.new();

        test.set(null);
        test.foo = 1;
        test.set({ foo: 2 });
        stop();
        await flushMicrotasks();

        expect(test.foo).toBe(2);
        expect(caught).toEqual([]);
        expect(warn).not.toBeCalled();
      });

      it('will store a silent assign without a report', () => {
        class Test extends State {
          foo = 0;
        }

        const handler = vi.fn();
        const test = Test.new();

        Test.on({ catch: handler });
        test.set(null);
        test.set({ foo: 1 }, true);

        expect(test.foo).toBe(1);
        expect(handler).not.toBeCalled();
      });

      it('will output nothing for a destroyed write left unhandled', async () => {
        class Test extends State {
          foo = 0;
        }

        const caught = mockUncaught();
        const test = Test.new();

        test.set(null);
        test.foo = 1;
        await flushMicrotasks();

        expect(caught).toEqual([]);
        expect(warn).not.toBeCalled();
      });
    });

    it('will still read values after destroyed', () => {
      class Test extends State {
        foo = 1;
      }

      const test = Test.new();

      test.foo = 2;
      test.set(null);

      expect(test.foo).toBe(2);
    });

    it('will silently store update after destroyed', () => {
      class Test extends State {
        foo = 0;
      }

      const test = Test.new();
      test.set(null);

      expect(update(test, 'foo', 1, true)).toBe(false);
      expect(test.foo).toBe(1);
    });

    it('will silently store set after destroyed', () => {
      class Test extends State {
        foo = 0;
      }

      const callback = vi.fn();
      const test = Test.new();

      test.set(callback);
      test.set(null);

      test.set({ foo: 1 }, true);

      expect(callback).not.toBeCalled();
      expect(test.foo).toBe(1);
    });

    it.todo('will throw clear error on bad update', () => {});
  });

  describe('assign', () => {
    it('will merge object into state', async () => {
      class Test extends State {
        foo = 'foo';
        bar = 'bar';
      }

      const test = Test.new();

      test.set({ foo: 'bar' });

      await expect(test).toHaveUpdated('foo');

      expect(test.foo).toBe('bar');
      expect(test.bar).toBe('bar');
    });

    it('will merge object silently', async () => {
      class Test extends State {
        foo = 'foo';
        bar = 'bar';
      }

      const test = Test.new();

      test.set({ foo: 'bar' }, true);

      await expect(test).not.toHaveUpdated('foo');

      expect(test.foo).toBe('bar');
      expect(test.bar).toBe('bar');
    });

    it('will merge methods into state', async () => {
      class Test extends State {
        foo = 'foo';

        method() {
          return this.foo;
        }
      }

      const test = Test.new();

      test.set({
        foo: 'bar',
        method() {
          return this.foo;
        }
      });

      await Promise.all([
        expect(test).toHaveUpdated('foo'),
        // method is not a managed property so will ignore update
        // TODO: investigate if this behavior should change.
        expect(test).not.toHaveUpdated('method')
      ]);

      expect(test.foo).toBe('bar');
    });

    it('will ignore properties not on state', async () => {
      class Test extends State {
        foo = 'foo';
      }

      const test = Test.new();

      test.set({ bar: 'bar' });

      await expect(test).not.toHaveUpdated();

      expect(test).not.toHaveProperty('bar');
    });

    it('will ignore built-in properties', async () => {
      class Test extends State {
        foo = 'foo';
      }
      const test = Test.new();

      test.set({ is: 'bar' });

      await expect(test).not.toHaveUpdated();
    });

    it('will assign from inside method', () => {
      class Test extends State {
        foo = 'foo';

        method() {
          // TODO: Can this be fixed?
          // @ts-expect-error
          this.set({ foo: 'bar' });
        }
      }

      const test = Test.new();

      test.method();

      expect(test.foo).toBe('bar');
    });

    it('will ignore a key matching a read-only computed', async () => {
      class Test extends State {
        source = 'foo';
        get value() {
          return this.source;
        }
      }

      const test = Test.new();

      expect(() => {
        test.set({ value: 'bar' });
      }).not.toThrow();

      await expect(test).not.toHaveUpdated();

      expect(test.value).toBe('foo');
    });

    it('will leave a computed to derive when its name also arrives as data', async () => {
      class Test extends State {
        source = 'foo';
        get value() {
          return this.source.toUpperCase();
        }
      }

      const test = Test.new();

      test.set({ value: 'ignored', source: 'bar' });

      await expect(test).toHaveUpdated('source');

      expect(test.value).toBe('BAR');
    });
  });

  it('will trigger normal setters', async () => {
    let observed: string | null = null;

    class Test extends State {
      value = 'foo';

      get foo() {
        return this.value;
      }

      set foo(value: string) {
        observed = value;
        this.value = value;
      }
    }

    const test = Test.new();

    test.set({ foo: 'bar' });

    await expect(test).toHaveUpdated('value');

    expect(test.foo).toBe('bar');
    expect(observed as string | null).toBe('bar');
  });
});

describe('unmanaged keys', () => {
  it('will not manage _ keys', async () => {
    class Test extends State {
      value = 1;
      _handle = 'foo';
    }

    const test = Test.new();

    test._handle = 'bar';

    await expect(test).not.toHaveUpdated();
    expect(test._handle).toBe('bar');
    expect(test.get()).toEqual({ value: 1 });
  });

  it('will define _ keys as non-enumerable', () => {
    class Test extends State {
      value = 1;
      _handle = 'foo';
    }

    const test = Test.new();

    expect(Object.keys(test)).toEqual(['value']);
    expect(Object.getOwnPropertyDescriptor(test, '_handle')).toMatchObject({
      enumerable: false,
      configurable: true
    });
  });

  it('will write _ keys thru a subscriber', async () => {
    class Test extends State {
      value = 1;
      _effect = 'foo';
      _computed = 0;

      get doubled() {
        return (this._computed = this.value * 2);
      }
    }

    const test = Test.new();

    test.get((self) => {
      self._effect = `bar-${self.value}`;
    });

    expect(test._effect).toBe('bar-1');
    expect(test.doubled).toBe(2);
    expect(test._computed).toBe(2);

    test.value = 2;
    await expect(test).toHaveUpdated();

    expect(test._effect).toBe('bar-2');
  });

  it('will ignore overlay onto a getter-only _ accessor', () => {
    class Test extends State {
      get _fixed() {
        return 'foo';
      }
    }

    const test = Test.new({ _fixed: 'bar' } as {});

    expect(() => test.set({ _fixed: 'baz' })).not.toThrow();
    expect(test._fixed).toBe('foo');
  });

  it('will run _ accessors against a non-State receiver', () => {
    class Test extends State {
      get _self(): unknown {
        return this;
      }

      set _self(value: unknown) {
        (this as any).written = value;
      }
    }

    const receiver = {} as { written?: unknown };

    Test.new();

    expect(Reflect.get(Test.prototype, '_self', receiver)).toBe(receiver);

    Reflect.set(Test.prototype, '_self', 1, receiver);

    expect(receiver.written).toBe(1);
  });

  it('will accept _ keys from overlay', async () => {
    class Test extends State {
      _config = 'foo';
    }

    const test = Test.new({ _config: 'bar' });

    expect(test._config).toBe('bar');

    test.set({ _config: 'baz' });

    expect(test._config).toBe('baz');
  });

  it('will write _ keys after destroy', () => {
    class Test extends State {
      value = 1;
      _handle: string | null = 'foo';
    }

    const test = Test.new();

    test.set(null);

    expect(() => { test._handle = null }).not.toThrow();
    expect(test._handle).toBeNull();
  });

  it('will not compute _ getters', () => {
    const getter = vi.fn(() => 'foo');

    class Test extends State {
      get _derived() {
        return getter();
      }
    }

    const test = Test.new();

    expect(test._derived).toBe('foo');
    expect(test._derived).toBe('foo');
    expect(getter).toBeCalledTimes(2);
    expect(Object.getOwnPropertyDescriptor(test, '_derived')).toBeUndefined();
  });

  it('will bind _ accessors to the instance', async () => {
    class Test extends State {
      value = 1;
      #secret = 10;

      get _secret() {
        return this.#secret;
      }

      set _secret(next: number) {
        this.#secret = next;
      }

      get total() {
        return this.value + this._secret;
      }
    }

    const test = Test.new();
    const effect = vi.fn((self: Test) => void self._secret);

    test.get(effect);

    expect(test.total).toBe(11);

    test.is._secret = 20;
    test.value = 2;

    await expect(test).toHaveUpdated();
    expect(test.total).toBe(22);
    expect(effect).toBeCalledTimes(1);
  });

  it('will not subscribe thru _ accessors', async () => {
    class Test extends State {
      value = 1;

      get _value() {
        return this.value;
      }

      get total() {
        return this._value;
      }
    }

    const test = Test.new();

    expect(test.total).toBe(1);

    test.value = 2;

    await expect(test).toHaveUpdated('value');
    expect(test.total).toBe(1);
  });

  it('will bind setter-only _ accessors', () => {
    let written: unknown;

    class Test extends State {
      set _sink(value: number) {
        written = this;
      }
    }

    const test = Test.new();

    test.get((self) => { self._sink = 1 });

    expect(written).toBe(test);
  });

  it('will exclude _ keys from field types', () => {
    class Test extends State {
      value = 1;
      _handle = 'foo';
    }

    const values: State.Values<Test> = { value: 1 };
    const assign: State.Assign<Test> = { _handle: 'bar' };

    const property: State.Property<Test> = '_handle';

    // @ts-expect-error - _ keys are not fields
    const field: State.Field<Test> = '_handle';

    expect([values, assign, property, field]).toBeDefined();
  });
});

describe('new method', () => {
  it('will ignore instance-property new', () => {
    const didCreate = vi.fn();

    class Test extends State {
      new = didCreate;
    }

    Test.new();

    expect(didCreate).not.toBeCalled();
  });

  it('will call if exists', () => {
    const didCreate = vi.fn();

    class Test extends State {
      protected new() {
        didCreate();
      }
    }

    Test.new();

    expect(didCreate).toBeCalledTimes(1);
  });

  it('will cleanup if returns function', () => {
    const didDestroy = vi.fn();
    const didCreate = vi.fn(() => didDestroy);

    class Test extends State {
      protected new() {
        return didCreate();
      }
    }

    const state = Test.new();

    expect(didCreate).toBeCalledTimes(1);
    expect(didDestroy).not.toBeCalled();

    state.set(null);

    expect(didDestroy).toBeCalledTimes(1);
  });
});

describe('new method (static)', () => {
  class Test extends State {}

  it('will call argument as lifecycle', () => {
    const didDestroy = vi.fn();
    const didCreate = vi.fn(() => didDestroy);

    const state = Test.new(didCreate);

    expect(didCreate).toBeCalledTimes(1);
    expect(didDestroy).not.toBeCalled();

    state.set(null);

    expect(didDestroy).toBeCalledTimes(1);
  });

  it('will apply object returned by callback', () => {
    class Test extends State {
      foo = 'foo';
    }

    const willCreate = vi.fn(() => ({
      foo: 'bar'
    }));

    const state = Test.new(willCreate);

    expect(state.foo).toBe('bar');
  });

  it('will apply arguments returned by callback', () => {
    class Test extends State {
      foo = 0;
      bar = 1;
    }

    const willCreate = vi.fn(() => [{ foo: 2 }, { bar: 3 }]);

    const test = Test.new(willCreate);

    expect(test.foo).toBe(2);
    expect(test.bar).toBe(3);
  });

  it('will apply all arguments', () => {
    class Test extends State {
      foo = 0;
      bar = 1;
    }

    const willCreate = vi.fn(() => ({ foo: 2 }));
    const willDestroy = vi.fn();

    const test = Test.new(willCreate, () => willDestroy, { bar: 3 });

    expect(test.foo).toBe(2);
    expect(test.bar).toBe(3);
    expect(willCreate).toBeCalledTimes(1);
    expect(willDestroy).not.toBeCalled();

    test.set(null);

    expect(willDestroy).toBeCalledTimes(1);
  });

  it('will flatten inherited arguments', () => {
    class Test extends State {
      foo = 0;
      bar = 1;
      baz = 2;
    }

    class Test2 extends Test {
      constructor(...args: State.Args) {
        super(args, { baz: 3 });
      }
    }

    const test = Test2.new({ foo: 1 }, { bar: 2 });

    expect(test.foo).toBe(1);
    expect(test.bar).toBe(2);
    expect(test.baz).toBe(3);
  });

  it('will flatten deeply nested arguments', () => {
    class Test extends State {
      foo = 0;
      bar = 0;
      baz = 0;
    }

    const test = Test.new([{ foo: 1 }], [[{ bar: 2 }, [{ baz: 3 }]]]);

    expect(test.foo).toBe(1);
    expect(test.bar).toBe(2);
    expect(test.baz).toBe(3);
  });

  it('will process init-returned arrays in order', () => {
    const order: number[] = [];
    const invoke = (n: number) => () => void order.push(n);

    class Test extends State {
      value = 0;
    }

    Test.new(
      () => [invoke(1), [invoke(2)]],
      invoke(3),
      () => [invoke(4)]
    );

    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('will process nested arrays from init before later args', () => {
    class Test extends State {
      foo = 0;
    }

    const test = Test.new(() => [{ foo: 1 }], { foo: 2 });

    expect(test.foo).toBe(2);
  });

  it('will prefer later assignments', () => {
    class Test extends State {
      foo = 1;
      bar = 2;
    }

    const test = Test.new({ foo: 3 }, { foo: 4, bar: 5 }, () => ({ bar: 6 }));

    expect(test.foo).toBe(4);
    expect(test.bar).toBe(6);
  });

  it('will run callbacks in order', () => {
    const willDestroy2 = vi.fn();
    const willDestroy1 = vi.fn(() => {
      expect(willDestroy2).not.toBeCalled();
    });

    const willCreate2 = vi.fn(() => willDestroy2);
    const willCreate1 = vi.fn(() => {
      expect(willCreate2).not.toBeCalled();
      return willDestroy1;
    });

    const test = Test.new(willCreate1, willCreate2);

    expect(willCreate1).toBeCalledTimes(1);
    expect(willCreate2).toBeCalledTimes(1);

    test.set(null);

    expect(willDestroy1).toBeCalledTimes(1);
    expect(willDestroy2).toBeCalledTimes(1);
  });

  it('will ingore promise from callback', () => {
    const didCreate = vi.fn(() => Promise.resolve());

    Test.new(didCreate);

    expect(didCreate).toBeCalledTimes(1);
  });

  // TODO: fix. This fails despite error intercept.
  it('will let a rejected initializer escape', async () => {
    const caught = mockUncaught();
    const expects = new Error('State callback rejected.');

    const init = vi.fn(() => Promise.reject(expects));
    const test = Test.new(init);

    expect(init).toBeCalledTimes(1);

    await expect(test).not.toHaveUpdated();

    expect(caught).toEqual([expects]);
  });

  it('will inject both properties and methods', () => {
    class Test extends State {
      value = 1;

      method() {
        return this.value;
      }
    }

    class Test2 extends Test {
      method2() {
        return this.value + 1;
      }
    }

    const test = Test2.new({
      value: 2,
      method() {
        expect<Test2>(this);
        return this.value + 1;
      },
      method2() {
        expect<Test2>(this);
        return this.value - 1;
      }
    });

    // expect are bound to instance
    const { method, method2 } = test;

    expect(test.value).toBe(2);
    expect(method()).toBe(3);
    expect(method2()).toBe(1);
  });

  it('will ignore non-applicable properties', () => {
    class Test extends State {
      value = 1;

      method() {
        return this.value;
      }
    }

    const test = Test.new({
      value: 2,
      method() {
        expect<Test>(this);
        return this.value + 1;
      },
      notManaged: 3,
      notMethod: () => 4
    });

    expect(test.value).toBe(2);
    expect(test.method()).toBe(3);

    expect(test).not.toHaveProperty('notManaged');
    expect(test).not.toHaveProperty('notMethod');
  });
});

describe('activation', () => {
  // A foreign non-configurable own property (e.g. React element internals
  // like `_owner`, installed on the instance by the render facade before a
  // bare-constructed Component activates) must not crash activation: the
  // field sweep can only convert configurable value properties, and should
  // leave anything else untouched rather than throw on defineProperty.
  it('will ignore non-configurable own value properties', () => {
    class Test extends State {
      value = 1;
    }

    const test = new Test();

    Object.defineProperty(test, '_foreign', {
      value: {},
      enumerable: true,
      configurable: false,
      writable: false
    });

    expect(() => event(test)).not.toThrow();
    expect(test.value).toBe(1);
  });

  it('will not release effects when an enclosing effect reruns', async () => {
    const didUpdate = vi.fn();

    class Child extends State {
      value = 0;

      new() {
        this.get((self) => void didUpdate(self.value));
      }
    }

    class Parent extends State {
      tick = 0;
    }

    const parent = Parent.new();

    let child!: Child;

    parent.get((self) => {
      void self.tick;
      if (!child) child = Child.new();
    });

    child.value = 1;
    await expect(child).toHaveUpdated();
    expect(didUpdate).toBeCalledWith(1);

    parent.tick = 1;
    await expect(parent).toHaveUpdated();

    child.value = 2;
    await expect(child).toHaveUpdated();
    expect(didUpdate).toBeCalledWith(2);
  });

  it('will release effects on a foreign state when destroyed', async () => {
    const didUpdate = vi.fn();

    class Foreign extends State {
      value = 0;
    }

    const foreign = Foreign.new();

    class Test extends State {
      new() {
        foreign.get((self) => void didUpdate(self.value));
      }
    }

    const test = Test.new();

    foreign.value = 1;
    await expect(foreign).toHaveUpdated();
    expect(didUpdate).toBeCalledTimes(2);

    test.set(null);

    foreign.value = 2;
    await expect(foreign).toHaveUpdated();
    expect(didUpdate).toBeCalledTimes(2);
  });
});

describe('is method (static)', () => {
  class Test extends State {}

  it('will assert if State extends another', () => {
    class Test2 extends Test {}

    expect(Test.is(Test2)).toBe(true);
  });

  it('will be falsy if not super', () => {
    class NotATest extends State {}

    expect(State.is(NotATest)).toBe(true);
    expect(Test.is(NotATest)).toBe(false);
  });

  it('will be true if same', () => {
    expect(Test.is(Test)).toBe(true);
  });
});

describe('on method (static)', () => {
  it('will run a bare function at setup', () => {
    const order: string[] = [];

    class Test extends State {
      value = 1;
      new() { order.push('new'); }
    }

    const stop = Test.on((self) => {
      order.push(`setup ${self instanceof Test}`);
    });

    Test.new();
    stop();
    Test.new();

    expect(order).toEqual(['setup true', 'new', 'new']);
  });

  it('will type a method handler beside the bare function overload', () => {
    class Test extends State {
      foo() {}
    }

    const keys: string[] = [];

    Test.on({
      method(key, fn, self) {
        keys.push(key.toUpperCase(), typeof fn, String(self instanceof Test));
      }
    });

    void Test.new().foo;

    expect(keys).toEqual(['FOO', 'function', 'true']);
  });

  it('will run callback on create', () => {
    class Test extends State {}

    const cb = vi.fn();
    const done = Test.on({ setup: cb });
    const test = Test.new();

    expect(cb).toBeCalledWith(test);

    done();
  });

  it('will run cleanup on destroy', () => {
    class Test extends State {}

    const cleanup = vi.fn();
    const done = Test.on({ setup: () => cleanup });
    const test = Test.new();

    expect(cleanup).not.toBeCalled();

    test.set(null);
    expect(cleanup).toBeCalled();

    done();
  });

  it('will run callback for inherited classes', () => {
    class Test extends State {}
    class Test2 extends Test {}

    const createTest = vi.fn();
    const createTest2 = vi.fn();

    Test.on({ setup: createTest });
    Test2.on({ setup: createTest2 });

    const test = Test2.new();

    expect(createTest).toBeCalledWith(test);
    expect(createTest2).toBeCalledWith(test);
  });

  it('will run callbacks in ancestor-first order', () => {
    class A extends State {
      value = 1;
    }
    class B extends A {}
    class C extends B {}

    const order: string[] = [];

    A.on({ setup: () => void order.push('A') });
    B.on({ setup: () => void order.push('B') });
    C.on({ setup: () => void order.push('C') });

    C.new();

    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('will run handlers above an anonymous class', () => {
    const order: string[] = [];

    class A extends State {}

    A.on({ setup: () => void order.push('A') });

    const attach = <T extends typeof A>(type: T) => {
      type.on({ setup: () => void order.push('anonymous') });
      return type;
    };

    class C extends attach(class extends A {}) {}

    C.on({ setup: () => void order.push('C') });

    expect(Object.getPrototypeOf(C).name).toBe('');

    C.new();

    expect(order).toEqual(['A', 'anonymous', 'C']);
  });

  it('will squash same callback for multiple classes', () => {
    class Test extends State {}
    class Test2 extends Test {}

    const didCreate = vi.fn();

    Test.on({ setup: didCreate });
    Test2.on({ setup: didCreate });

    Test2.new();

    expect(didCreate).toBeCalledTimes(1);
  });

  it('will remove callback', () => {
    class Test extends State {}

    const cb = vi.fn();
    const done = Test.on({ setup: cb });

    Test.new();
    expect(cb).toBeCalled();

    done();

    Test.new();
    expect(cb).toBeCalledTimes(1);
  });

  it('will register multiple callbacks', () => {
    class Fresh extends State {}

    const cb1 = vi.fn();
    const cb2 = vi.fn();

    // First .on() creates the setup Set (line 455)
    Fresh.on({ setup: cb1 });
    // Second .on() reuses existing Set
    Fresh.on({ setup: cb2 });

    Fresh.new();
    expect(cb1).toBeCalledTimes(1);
    expect(cb2).toBeCalledTimes(1);
  });
});

describe('on type stage (static)', () => {
  it('will run once per class, reaching subclasses', () => {
    const seen: string[] = [];

    class Base extends State {}
    class Sub extends Base {}

    Base.on({ type: (type) => void seen.push(type.name) });

    Base.new();
    Base.new();
    Sub.new();

    expect(seen).toEqual(['Base', 'Sub']);
  });

  it('will let a handler reshape members before binding', () => {
    class Test extends State {
      foo() { return 'method'; }
    }

    // Redefine foo as a get/set before bootstrap classifies it; bootstrap skips
    // getters that carry a setter, so the redefinition is left untouched rather
    // than reactively bound.
    Test.on({
      type: (type) => {
        Object.defineProperty(type.prototype, 'foo', {
          configurable: true,
          get: () => 'claimed',
          set: () => {}
        });
      }
    });

    const test = Test.new();
    const foo = Object.getOwnPropertyDescriptor(Test.prototype, 'foo')!;

    expect(test.foo as unknown).toBe('claimed');
    expect(typeof foo.set).toBe('function');
  });
});

describe('on combined stages (static)', () => {
  it('will run a function once per stage however often it is registered', () => {
    class Base extends State {
      foo = 0;

      method() {}
    }

    class Test extends Base {}

    const type = vi.fn();
    const setup = vi.fn();
    const method = vi.fn();
    const handle = vi.fn();

    for (const T of [Base, Test, Test]) T.on({ type, setup, method, catch: handle });

    const test = Test.new();

    void test.method;
    test.set(null);
    test.foo = 1;

    expect(type).toBeCalledTimes(2);
    expect(setup).toBeCalledTimes(1);
    expect(method).toBeCalledTimes(1);
    expect(handle).toBeCalledTimes(1);
  });

  it('will hook multiple stages from one handler object', () => {
    const order: string[] = [];

    class Test extends State {}

    Test.on({
      type: () => void order.push('type'),
      setup: () => void order.push('setup'),
      ready: () => void order.push('ready')
    });

    Test.new();

    expect(order).toEqual(['type', 'setup', 'ready']);
  });

  it('will run a shared handler once across base and subclass', () => {
    const fn = vi.fn();

    class Base extends State {}
    class Sub extends Base {}

    const handler = { setup: fn };

    Base.on(handler);
    Sub.on(handler);

    // handlers accumulate into a Set, so registering the same one along the
    // chain is idempotent - it runs once per instance, not once per level.
    Sub.new();

    expect(fn).toBeCalledTimes(1);
  });
});

describe('non-configurable members (bootstrap)', () => {
  it('will leave a non-configurable method unbound', () => {
    class Test extends State {
      foo() { return 'content'; }
    }

    // sealing a member is how an adapter claims it (e.g. Component's render)
    Object.defineProperty(Test.prototype, 'foo', {
      ...Object.getOwnPropertyDescriptor(Test.prototype, 'foo'),
      configurable: false
    });

    Test.new();

    const desc = Object.getOwnPropertyDescriptor(Test.prototype, 'foo')!;

    expect(typeof desc.value).toBe('function');
    expect(desc.get).toBeUndefined();
  });

  it('will reactively bind a configurable method', () => {
    class Test extends State {
      method() {}
    }

    Test.new();

    const desc = Object.getOwnPropertyDescriptor(Test.prototype, 'method')!;

    expect(typeof desc.get).toBe('function');
    expect(desc.value).toBeUndefined();
  });
});

describe('enumerable prototype members', () => {
  class Test extends State {
    foo = 1;
  }

  Object.defineProperty(Test.prototype, 'legacy', {
    value: 'world',
    enumerable: true,
    writable: true,
    configurable: true
  });

  it('will activate without managing the property', async () => {
    const test = Test.new();

    expect((test as any).legacy).toBe('world');
    expect(test.get()).toEqual({ foo: 1 });

    (test as any).legacy = 'moon';

    await expect(test).not.toHaveUpdated();
    expect((test as any).legacy).toBe('moon');
  });

  it('will assign to the property without dispatch', async () => {
    const test = Test.new();

    test.set({ legacy: 'moon' } as any);

    await expect(test).not.toHaveUpdated();
    expect((test as any).legacy).toBe('moon');
  });
});

describe('on setup / ready stages (static)', () => {
  it('will run setup before own values and ready after the instance new()', () => {
    const order: string[] = [];

    class Test extends State {
      value = 1;
      new() { order.push('new'); }
    }

    Test.on({ setup: () => void order.push('setup') });
    Test.on({ ready: () => void order.push('ready') });

    Test.new();

    expect(order).toEqual(['setup', 'new', 'ready']);
  });

  it('will run ready cleanup on destroy', () => {
    const cleanup = vi.fn();

    class Test extends State {}

    Test.on({ ready: () => cleanup });

    const test = Test.new();
    expect(cleanup).not.toBeCalled();

    test.set(null);
    expect(cleanup).toBeCalled();
  });
});

describe('on method stage (static)', () => {
  it('will run on first access with key and bound function', () => {
    class Test extends State {
      foo() {
        return this;
      }
    }

    const handler = vi.fn();

    Test.on({ method: handler });

    const test = Test.new();

    expect(handler).not.toBeCalled();

    const { foo } = test;

    expect(handler).toBeCalledTimes(1);
    expect(handler).toBeCalledWith('foo', foo, test);
    expect(handler.mock.contexts[0]).toBe(test);
    expect(foo()).toBe(test);
    expect(test.foo).toBe(foo);
    expect(handler).toBeCalledTimes(1);
  });

  it('will run on replacement by assignment before first read, or through set', () => {
    class Test extends State {
      foo() {
        return 'before';
      }
    }

    const handler = vi.fn();

    Test.on({ method: handler });

    const test = Test.new();

    test.foo = () => 'assigned';
    expect(handler).toHaveBeenLastCalledWith('foo', test.foo, test);
    expect(test.foo()).toBe('assigned');

    test.set({ foo: () => 'set' });
    expect(handler).toHaveBeenLastCalledWith('foo', test.foo, test);
    expect(test.foo()).toBe('set');

    expect(handler).toBeCalledTimes(2);
  });

  it.fails('will bind and observe a replacement assigned after first read', () => {
    class Test extends State {
      foo(): unknown {
        return 'before';
      }
    }

    const method = vi.fn();

    Test.on({ method });

    const test = Test.new();

    test.foo();
    test.foo = function (this: unknown) {
      return this;
    };

    const { foo } = test;

    expect(foo()).toBe(test);
    expect(method).toBeCalledTimes(2);
  });

  it('will run base then subclass handlers, once each', () => {
    class Base extends State {
      foo() {}
    }

    class Sub extends Base {}

    const order: string[] = [];
    const tag = (name: string) => ({ method: () => void order.push(name) });
    const shared = tag('shared');

    Base.on(tag('base'));
    Base.on(shared);
    Sub.on(tag('sub'));
    Sub.on(shared);

    Base.new().foo;
    expect(order).toEqual(['base', 'shared']);

    order.length = 0;
    Sub.new().foo;
    expect(order).toEqual(['base', 'shared', 'sub']);
  });

  it('will run for a handler registered after bootstrap', () => {
    class Test extends State {
      foo() {}
    }

    Test.new().foo;

    const handler = vi.fn();
    const stop = Test.on({ method: handler });

    Test.new().foo;
    expect(handler).toBeCalledTimes(1);

    stop();
    Test.new().foo;
    expect(handler).toBeCalledTimes(1);
  });

  it('will let a handler read the method', () => {
    class Test extends State {
      foo() {}
    }

    const read = vi.fn();

    Test.on({
      method(key) {
        read((this as any)[key]);
      }
    });

    const test = Test.new();

    expect(read).toBeCalledWith(test.foo);
  });
});

describe('on catch stage (static)', () => {
  const warn = mockWarn();
  const error = mockError();

  it('will hand a destroyed write to catch with its kind and key', () => {
    class Test extends State {
      foo = 0;
    }

    const handler = vi.fn();

    Test.on({ catch: handler });
    Test.on({
      catch(error, kind) {
        // @ts-expect-error - not a kind
        if (kind == 'Unknown') return;
        return error;
      }
    });

    const test = Test.new();

    test.set(null);
    test.foo = 1;

    expect(handler).toBeCalledWith(expect.objectContaining({ message: expect.stringMatching(DESTROYED) }), 'dead', 'foo');
    expect(handler.mock.contexts[0]).toBe(test);
    expect(warn).not.toBeCalled();
  });

  it('will pass along subclass then base, last registered first, once each at the outermost', async () => {
    class Base extends State {
      foo = 0;
    }

    class Sub extends Base {}

    const order: string[] = [];
    const pass = (name: string) => ({
      catch: (issue: unknown) => {
        order.push(name);
        return issue;
      }
    });
    const shared = pass('shared');

    Base.on(pass('base'));
    Base.on(shared);
    Sub.on(pass('sub'));
    Sub.on(shared);

    const caught = mockUncaught();
    const sub = Sub.new();

    sub.set(null);
    sub.foo = 1;
    await flushMicrotasks();

    expect(caught).toEqual([]);
    expect(warn).not.toBeCalled();
    expect(order).toEqual(['sub', 'shared', 'base']);
  });

  it('will stop at the first handler returning nothing', () => {
    class Base extends State {
      foo = 0;
    }

    class Sub extends Base {}

    const base = vi.fn();

    Base.on({ catch: base });
    Sub.on({ catch: () => {} });

    const sub = Sub.new();

    sub.set(null);
    sub.foo = 1;

    expect(base).not.toBeCalled();
    expect(warn).not.toBeCalled();
  });

  it('will pass a replacement forward', async () => {
    class Test extends State {
      foo = 0;
    }

    const base = vi.fn((issue: unknown) => issue);
    const replaced = new Error('replaced');
    const stopBase = State.on({ catch: base });
    const stop = Test.on({ catch: () => replaced });
    const caught = mockUncaught();
    const test = Test.new();

    test.set(null);
    test.foo = 1;
    stop();
    stopBase();
    await flushMicrotasks();

    expect(base).toBeCalledWith(replaced, 'dead', 'foo');
    expect(caught).toEqual([]);
    expect(warn).not.toBeCalled();
  });

  it('will reach a handler registered on State itself', () => {
    class Test extends State {
      foo = 0;
    }

    const handler = vi.fn();
    const stop = State.on({ catch: handler });
    const test = Test.new();

    test.set(null);
    test.foo = 1;
    stop();

    expect(handler).toBeCalledWith(expect.any(Error), 'dead', 'foo');
  });

  it('will not reach handlers of an unrelated class', async () => {
    class Test extends State {
      foo = 0;
    }

    class Other extends State {}

    const handler = vi.fn();

    Other.on({ catch: handler });

    const test = Test.new();

    const caught = mockUncaught();

    test.set(null);
    test.foo = 1;
    await flushMicrotasks();

    expect(caught).toEqual([]);
    expect(warn).not.toBeCalled();
    expect(handler).not.toBeCalled();
  });

  it('will warn of a state never activated', async () => {
    class Test extends State {}

    const test = new Test();

    await flushMicrotasks();

    expect(warn).toBeCalledWith(expect.objectContaining({ message: `${test} was constructed but never activated.` }));
  });

  it('will escape uncaught when rethrown at an async site', async () => {
    class Test extends State {}

    Test.on({
      catch(issue) {
        throw issue;
      }
    });

    const caught = mockUncaught();

    new Test();
    await flushMicrotasks();

    expect(caught).toEqual([expect.objectContaining({ message: expect.stringMatching(/never activated/) })]);
  });

  it('will hand over what a refreshing getter threw', async () => {
    const oops = new Error('oops');

    class Test extends State {
      foo = 0;
      fail = false;

      get value() {
        if (this.fail) throw oops;
        return this.foo;
      }
    }

    const handler = vi.fn();

    Test.on({ catch: handler });

    const test = Test.new();

    void test.value;
    test.fail = true;
    await expect(test).toHaveUpdated();

    expect(handler).toBeCalledWith(oops, 'getter', 'value');
  });

  it('will pass on a falsy value thrown', async () => {
    class Test extends State {
      foo = 0;
    }

    const handler = vi.fn((issue: unknown) => issue);
    const caught = mockUncaught();
    const test = Test.new();

    Test.on({ catch: handler });

    test.get(($) => {
      if ($.foo) throw 0;
    });

    test.foo = 1;
    await flushMicrotasks();

    expect(handler).toBeCalledWith(0, 'effect', undefined);
    expect(caught).toEqual([0]);
  });

  it('will attribute an effect error to the owner of a collection', async () => {
    class Test extends State {
      list = has<number>();
    }

    const handler = vi.fn();
    const oops = new Error('oops');

    Test.on({ catch: handler });

    const test = Test.new();

    watch(test.list, ($) => {
      if ($.size) throw oops;
    });

    test.list.push(1);
    await flushMicrotasks();

    expect(handler).toBeCalledWith(oops, 'effect', undefined);
    expect(handler.mock.contexts[0]).toBe(test);
  });

  it('will escape a report a handler rethrew without reaching the writer', async () => {
    class Target extends State {
      foo = 0;
    }

    class Source extends State {
      value = 0;
    }

    Target.on({
      catch(issue) {
        throw issue;
      }
    });

    const handler = vi.fn();

    Source.on({ catch: handler });

    const target = Target.new();
    const source = Source.new();

    target.set(null);
    source.get(($) => {
      if ($.value) target.foo = 1;
    });

    const caught = mockUncaught();

    source.value = 1;
    await flushMicrotasks();

    expect(handler).not.toBeCalled();
    expect(caught).toEqual([expect.objectContaining({ message: expect.stringMatching(DESTROYED) })]);
  });

  it('will ignore a non-function returned by a listener', async () => {
    class Test extends State {
      foo = 0;
    }

    const caught = mockUncaught();
    const test = Test.new();
    const seen: unknown[] = [];

    test.set((key) => seen.push(key) as unknown as void);
    test.foo = 1;
    await flushMicrotasks();

    expect(seen).toEqual(['foo']);
    expect(caught).toEqual([]);
  });

  it('will let an effect error with no owning State escape', async () => {
    const caught = mockUncaught();
    const subject = {};
    const oops = new Error('oops');

    event(subject);
    listener(
      subject,
      () => () => {
        throw oops;
      },
      'value'
    );

    event(subject, 'value');
    await flushMicrotasks();

    expect(caught).toEqual([oops]);
    expect(error).not.toBeCalled();
  });
});

describe('computed (getters)', () => {
  describe('destroyed', () => {
    it('will read last value after destroy', () => {
      class Test extends State {
        source = 2;
        get value() {
          return this.source * 2;
        }
      }

      const test = Test.new();

      expect(test.value).toBe(4);

      test.set(null);

      expect(test.value).toBe(4);
    });

    it('will read undefined if never evaluated before destroy', () => {
      class Test extends State {
        source = 2;
        get value() {
          return this.source * 2;
        }
      }

      const test = Test.new();

      test.set(null);

      expect(test.value).toBeUndefined();
    });
  });

  describe('property descriptors', () => {
    it('will be enumerable', () => {
      class Test extends State {
        source = 'hello';
        get value() {
          return this.source;
        }
      }

      const test = Test.new();

      expect(Object.keys(test)).toContain('value');
    });

    it('will be read-only', () => {
      class Test extends State {
        source = 'foo';
        get value() {
          return this.source;
        }
      }

      const test = Test.new();

      expect(() => {
        (test as any).value = 'bar';
      }).toThrow(/read-only/);
    });
  });

  it('will cleanup source subscription when source is destroyed', async () => {
    class Subject extends State {
      value = 1;

      get computed() {
        return this.value;
      }
    }

    const subject = Subject.new();

    expect(subject.computed).toBe(1);

    expect(() => subject.set(null)).not.toThrow();
    expect(subject.computed).toBe(1);
  });

  it('will reevaluate when inputs change', async () => {
    class Subject extends State {
      seconds = 0;

      get minutes() {
        return Math.floor(this.seconds / 60);
      }
    }

    const subject = Subject.new();

    subject.seconds = 30;

    await expect(subject).toHaveUpdated();

    expect(subject.seconds).toEqual(30);
    expect(subject.minutes).toEqual(0);

    subject.seconds = 60;

    await expect(subject).toHaveUpdated();

    expect(subject.seconds).toEqual(60);
    expect(subject.minutes).toEqual(1);
  });

  it.todo("will not update if output doesn't change", async () => {
    const didCompute = vi.fn();

    class Subject extends State {
      value = 1;

      get computed() {
        didCompute();
        return this.value > 0;
      }
    }

    const subject = Subject.new();

    expect(subject.computed).toBe(true);
    expect(didCompute).toBeCalledTimes(1);

    subject.value = 2;

    await expect(subject).not.toHaveUpdated('computed');
    expect(didCompute).toBeCalledTimes(1);

    subject.value = -1;

    await expect(subject).toHaveUpdated('computed');
    expect(subject.computed).toBe(false);
    expect(didCompute).toBeCalledTimes(2);
  });

  it('will trigger when nested inputs change', async () => {
    class Child extends State {
      value = 'foo';
    }

    class Subject extends State {
      child = new Child();
      get nested() {
        return this.child.value;
      }
    }

    const subject = Subject.new();

    expect(subject.nested).toBe('foo');

    subject.child.value = 'bar';

    await expect(subject).toHaveUpdated();
    expect(subject.nested).toBe('bar');

    subject.child = new Child();

    await expect(subject).toHaveUpdated();
    expect(subject.child.value).toBe('foo');
    expect(subject.nested).toBe('foo');
  });

  it('will compute early if value is accessed', async () => {
    const didCompute = vi.fn();

    class Test extends State {
      number = 0;
      get plusOne() {
        const value = this.number + 1;
        didCompute(value);
        return value;
      }
    }

    const test = Test.new();

    expect(test.plusOne).toBe(1);

    test.number++;

    expect(didCompute).not.toBeCalledWith(2);

    await expect(test).toHaveUpdated();
    expect(didCompute).toBeCalledWith(2);
    expect(test.plusOne).toBe(2);

    test.number++;

    expect(didCompute).not.toBeCalledWith(3);

    expect(test.plusOne).toBe(3);
    expect(didCompute).toBeCalledWith(3);

    await expect(test).toHaveUpdated();
  });

  // FIXME(#98): passes in the full suite but fails in isolation under both
  // vitest+node and bun (verified). Relies on test pollution to drain microtasks
  // between sync assertions; getter re-evaluation actually happens via
  // queueMicrotask. Skipped pending a rewrite against the real reactive contract.
  it.skip('will be squashed with regular updates', async () => {
    const exec = vi.fn();
    const emit = vi.fn();

    class Inner extends State {
      value = 1;
    }

    class Test extends State {
      a = 1;
      b = 1;

      get c() {
        exec();
        return this.a + this.b + this.x.value;
      }

      x = new Inner();
    }

    const test = Test.new();

    expect(test.c).toBe(3);
    expect(exec).toBeCalledTimes(1);

    test.set(emit);

    test.a++;
    expect(emit).toBeCalledTimes(1);
    expect(emit).toBeCalledWith('a', test);

    test.b++;

    expect(exec).toBeCalledTimes(2);
    expect(emit).toBeCalledTimes(3);
    expect(emit).toBeCalledWith('b', test);
    expect(emit).toBeCalledWith('c', test);

    test.x.value++;

    await expect(test).toHaveUpdated();

    expect(exec).toBeCalledTimes(2);
    expect(emit).toBeCalledTimes(3);
    expect(emit).toBeCalledWith('c', test);
  });

  it('will be evaluated in order', async () => {
    let didCompute: string[] = [];

    class Ordered extends State {
      X = 1;

      get A() {
        const value = this.X;
        didCompute.push('A');
        return value;
      }

      get B() {
        const value = this.A + 1;
        didCompute.push('B');
        return value;
      }

      get C() {
        const value = this.X + this.B + 1;
        didCompute.push('C');
        return value;
      }

      get D() {
        const value = this.A + this.C + 1;
        didCompute.push('D');
        return value;
      }
    }

    const test = Ordered.new();

    expect(test.D).toBe(6);

    expect(didCompute).toMatchObject(['A', 'B', 'C', 'D']);

    didCompute = [];

    test.X = 2;

    await expect(test).toHaveUpdated();

    expect(didCompute).toMatchObject(['A', 'B', 'C', 'D']);
  });

  it('will provide tracking proxy via this', async () => {
    class Test extends State {
      foo = 'foo';

      get fooBar() {
        return this.foo;
      }
    }

    const test = Test.new();

    expect(test.fooBar).toBe('foo');

    test.foo = 'bar';
    await expect(test).toHaveUpdated();

    expect(test.fooBar).toBe('bar');
  });

  it('will keep nested dependencies when read before refresh', async () => {
    class Inner extends State {
      value = 1;
    }

    class Test extends State {
      inner = new Inner();

      get double() {
        return this.inner.value * 2;
      }
    }

    const test = Test.new();
    const effect = vi.fn((state: Test) => void state.double);

    test.get(effect);

    test.inner.value = 2;
    expect(test.double).toBe(4);
    await flushMicrotasks();

    test.inner.value = 3;
    await flushMicrotasks();

    expect(test.double).toBe(6);
    expect(effect).toHaveBeenCalledTimes(3);
  });

  describe('inheritance', () => {
    it('will use overridden getter from subclass', () => {
      class Test extends State {
        foo = 1;
        get bar() {
          return 1 + this.foo;
        }
      }

      class Test2 extends Test {
        get bar() {
          return 2 + this.foo;
        }
      }

      const test = Test2.new();

      expect(test.bar).toBe(3);
    });

    it('will compose with super', async () => {
      class Test extends State {
        foo = 1;
        get bar() {
          return 1 + this.foo;
        }
      }

      class Test2 extends Test {
        get bar() {
          return super.bar + 10;
        }
      }

      const test = Test2.new();

      expect(test.bar).toBe(12);

      test.foo = 5;
      await expect(test).toHaveUpdated();

      expect(test.bar).toBe(16);
    });
  });

  describe('opt-out tracking', () => {
    it('will not subscribe to values accessed via this.is', async () => {
      const didCompute = vi.fn();

      class Test extends State {
        tracked = 'A';
        untracked = 'X';

        get value() {
          didCompute();
          return this.tracked + this.is.untracked;
        }
      }

      const test = Test.new();

      expect(test.value).toBe('AX');
      expect(didCompute).toBeCalled();

      test.tracked = 'B';
      await expect(test).toHaveUpdated();

      expect(test.value).toBe('BX');
      expect(didCompute).toBeCalledTimes(2);

      test.untracked = 'Y';
      await expect(test).toHaveUpdated();

      expect(didCompute).toBeCalledTimes(2);
      expect(test.value).toBe('BX');
    });
  });

  describe('failures', () => {
    const error = mockError();
    const warn = mockWarn();

    it('will warn if throws', () => {
      class Subject extends State {
        get never() {
          throw new Error();
        }
      }

      const state = Subject.new();
      const attempt = () => state.never;

      expect(attempt).toThrow();
      expect(warn).toBeCalledWith(
        `An exception was thrown while initializing ${state}.never.`
      );
    });

    it('will not report a suspense thrown while refreshing', async () => {
      class Test extends State {
        mode = 0;
        later = set<string>();

        get value() {
          return this.mode ? this.later : 'ready';
        }
      }

      const caught = mockUncaught();
      const state = Test.new();

      void state.value;
      state.mode = 1;

      await expect(state).toHaveUpdated();

      expect(caught).toEqual([]);
      expect(error).not.toBeCalled();
    });

    it('will escape if throws on update', async () => {
      class Test extends State {
        shouldFail = false;

        get value(): undefined {
          if (this.shouldFail) throw new Error();
          return undefined;
        }
      }

      const caught = mockUncaught();
      const state = Test.new();

      void state.value;
      state.shouldFail = true;

      await expect(state).toHaveUpdated();

      expect(warn).not.toBeCalled();
      expect(error).not.toBeCalled();
      expect(caught).toEqual([expect.any(Error)]);
    });
  });

  it('will stay subscribed after read during update', async () => {
    // A dependency mutated while an update is pending, then read
    // synchronously, recomputes against a proxy whose listener is already spent.
    // The deferred re-invoke must re-arm the live proxy or all later updates stall.
    class Test extends State {
      input = 1;
      get value() {
        return this.input + 1;
      }
    }

    const test = Test.new();
    const seen: number[] = [];

    test.get(({ value }) => {
      seen.push(value)
    });

    expect(seen).toEqual([2]);

    // mutate, then read synchronously before the update flushes
    test.input = 2;
    expect(test.value).toBe(3);

    await expect(test).toHaveUpdated();
    expect(seen).toEqual([2, 3]);

    test.input = 3;

    await expect(test).toHaveUpdated();
    expect(test.value).toBe(4);
    expect(seen).toEqual([2, 3, 4]);
  });

  describe('circular', () => {
    it('will access own previous value', async () => {
      class Test extends State {
        multiplier = 0;
        previous: number | undefined | null = null;

        get value(): number {
          const { value, multiplier } = this;

          this.previous = value;

          return Math.ceil(Math.random() * 10) * multiplier;
        }
      }

      const test = Test.new();

      expect(test.previous).toBe(null);

      const initial = test.value;

      expect(initial).toBe(0);

      expect('previous' in test).toBe(true);
      expect(test.previous).toBe(undefined);

      test.multiplier = 1;
      await expect(test).toHaveUpdated();

      expect(test.previous).toBe(initial);
      expect(test.value).not.toBe(initial);
    });

    it('will not trigger itself', async () => {
      const didGetOldValue = vi.fn();
      const didGetNewValue = vi.fn();

      class Test extends State {
        input = 1;
        get value(): number {
          const { input, value } = this;

          didGetOldValue(value);

          return input + 1;
        }
      }

      const test = Test.new();

      test.get((state) => {
        didGetNewValue(state.value);
      });

      expect(test.value).toBe(2);
      expect(didGetNewValue).toBeCalledWith(2);
      expect(didGetOldValue).toBeCalledWith(undefined);

      test.input = 2;

      expect(test.value).toBe(3);
      expect(didGetOldValue).toBeCalledWith(2);

      await expect(test).toHaveUpdated();
      expect(didGetNewValue).toBeCalledWith(3);
      expect(didGetOldValue).toBeCalledTimes(2);
    });

    it('will export cycle not involving root', () => {
      class Node extends State {
        name = 'x';
        link?: Node = undefined;
      }

      const a = Node.new();
      const b = Node.new();

      a.link = b;
      b.link = a;

      class Root extends State {
        child = a;
      }

      const root = Root.new();
      const exported = root.get();

      expect(exported.child.link).toBe(exported.child.link!.link!.link);
    });
  });
});

it('will release a state which never activated', () => {
  const didInit = vi.fn();

  class Test extends State {
    value = 1;

    protected new() {
      didInit();
    }
  }

  const state = new Test();

  expect(() => state.set(null)).not.toThrow();
  expect(didInit).not.toBeCalled();
});

describe('activation', () => {
  const warn = mockWarn();

  it('will warn if never activated', async () => {
    class Test extends State {
      value = 1;
    }

    const state = new Test();

    await flushMicrotasks();

    expect(warn).toBeCalledWith(
      expect.objectContaining({ message: `${state} was constructed but never activated.` })
    );
  });

  it('will not warn if activated', async () => {
    class Test extends State {
      value = 1;
    }

    Test.new();

    await flushMicrotasks();

    expect(warn).not.toBeCalled();
  });

  it('will not warn if adopted by an owner', async () => {
    class Child extends State {
      value = 1;
    }

    class Parent extends State {
      child = new Child();
    }

    Parent.new();

    await flushMicrotasks();

    expect(warn).not.toBeCalled();
  });

  it('will not warn for base child a subclass overwrote', async () => {
    class Child extends State {
      value = 1;
    }

    class Base extends State {
      child = new Child();
    }

    class Sub extends Base {
      child = new Child();
    }

    const sub = Sub.new();

    await flushMicrotasks();

    expect(sub.child).toBeInstanceOf(Child);
    expect(warn).not.toBeCalled();
  });

  it('will not warn for a child a subclass instruction replaced', async () => {
    class Child extends State {}

    class Base extends State {
      child = new Child();
    }

    class Sub extends Base {
      child = get(Child) as any;
    }

    class Root extends State {
      child = new Child();
      sub = new Sub();
    }

    const root = Root.new();

    await flushMicrotasks();

    expect(root.sub.child).toBe(root.child);
    expect(warn).not.toBeCalled();
  });

  it('will not warn for a child replaced by ref or set', async () => {
    class Child extends State {}

    class Base extends State {
      a = new Child();
      b = new Child();
    }

    class Sub extends Base {
      a = ref<Child>() as any;
      b = set(() => new Child());
    }

    const sub = Sub.new();

    await flushMicrotasks();

    expect(sub.b).toBeInstanceOf(Child);
    expect(warn).not.toBeCalled();
  });

  it('will not warn for overwritten child of an adopted child', async () => {
    class Leaf extends State {}

    class Base extends State {
      leaf = new Leaf();
    }

    class Sub extends Base {
      leaf = new Leaf();
    }

    class Parent extends State {
      child = new Sub();
    }

    Parent.new();

    await flushMicrotasks();

    expect(warn).not.toBeCalled();
  });

  it('will still warn for unrelated state constructed alongside', async () => {
    class Child extends State {}
    class Other extends State {}

    class Parent extends State {
      child = new Child();
    }

    const parent = new Parent();
    const other = new Other();

    event(parent);

    await flushMicrotasks();

    expect(warn).toBeCalledTimes(1);
    expect(warn).toBeCalledWith(expect.objectContaining({ message: `${other} was constructed but never activated.` }));
  });

  it('will not warn if placed in a context', async () => {
    class Test extends State {
      value = 1;
    }

    const state = new Test();

    new Context(state);

    await flushMicrotasks();

    expect(warn).not.toBeCalled();
  });

  it('will not warn if released', async () => {
    class Test extends State {
      value = 1;
    }

    const state = new Test();

    state.set(null);

    await flushMicrotasks();

    expect(warn).not.toBeCalled();
  });
});
