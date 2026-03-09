import { find, include, apply, detach, link, PROVIDE } from '../context';
import { event } from '../observable';
import { vi, describe, it, expect, mockPromise } from '../../vitest';
import { State } from '../state';
import { get } from './get';
import { set } from './set';

/** Create a host state with PROVIDE initialized. */
function host() {
  class Host extends State {}
  const h = Host.new();
  PROVIDE.set(h, new Map());
  return h;
}

// is this desirable?
it.todo('will add pending compute to frame immediately');
it.todo('will suspend if necessary');

describe('fetch mode', () => {
  it('will fetch sibling', () => {
    class Sibling extends State {}
    class Test extends State {
      sibling = get(Sibling);
    }

    const h = host();
    apply(h, { Sibling, Test });

    const test = find(h, Test);
    const sibling = find(h, Sibling);

    expect(test.sibling).toBe(sibling);
  });

  it('will fetch multiple', () => {
    class Ambient extends State {}
    class Test extends State {
      ambient1 = get(Ambient);
      ambient2 = get(Ambient);
    }

    const h = host();
    const test = new Test();
    const ambient = new Ambient();

    include(h, ambient);
    event(ambient);
    include(h, test);
    event(test);

    expect(test.ambient1).toBe(ambient);
    expect(test.ambient2).toBe(ambient);
  });

  it('will allow overwrite', async () => {
    class Foo extends State {
      bar = new Bar();
      value = 'foo';
    }

    class Bar extends State {
      foo = get(Foo);
      value = 'foo';
    }

    const foo = Foo.new();
    const mockEffect = vi.fn();
    let promise = mockPromise();

    expect(foo.bar.foo).toBe(foo);

    foo.get((state) => {
      mockEffect(state.bar.foo.value);
      promise.resolve();
    });

    promise = mockPromise();
    foo.value = 'bar';
    await promise;

    expect(mockEffect).toBeCalledWith('bar');

    promise = mockPromise();
    foo.bar.foo = Foo.new();
    await promise;

    expect(mockEffect).toBeCalledWith('foo');
    expect(mockEffect).toBeCalledTimes(3);
  });

  it('creates parent-child relationship', () => {
    class Foo extends State {
      child = new Bar();
    }
    class Bar extends State {
      parent = get(Foo);
    }

    const foo = Foo.new();
    const bar = foo.child;

    expect(bar).toBeInstanceOf(Bar);
    expect(bar.parent).toBe(foo);
  });

  it('will throw if not found in context', () => {
    class Parent extends State {}
    class Child extends State {
      expects = get(Parent);
      constructor(...args: State.Args) {
        super(args, 'ID');
      }
    }

    const h = host();
    const attempt = () => apply(h, Child);

    // should this throw immediately, or only on access?
    expect(attempt).toThrow(`Required Parent not found in context for ID.`);
  });

  it('will return undefined if required is false', () => {
    class MaybeParent extends State {}
    class StandAlone extends State {
      maybe = get(MaybeParent, false);
    }

    const h = host();
    const instance = new StandAlone();

    include(h, instance);
    event(instance);

    expect(instance.maybe).toBeUndefined();
  });

  it('will not throw if has parent but not type-required', () => {
    class Expected extends State {}
    class Unexpected extends State {
      child = new Adopted('ID');
    }
    class Adopted extends State {
      expects = get(Expected, false);
    }

    const attempt = () => Unexpected.new('ID');

    expect(attempt).not.toThrow();
  });

  it('will track recursively', async () => {
    class Child extends State {
      value = 'foo';
      parent = get(Parent);
    }

    class Parent extends State {
      child = new Child();
      value = 'foo';
    }

    const { child } = Parent.new();
    const effect = vi.fn((it: Child) => {
      void it.value;
      void it.parent.value;
    });

    child.get(effect);

    child.value = 'bar';
    await expect(child).toHaveUpdated();
    expect(effect).toBeCalledTimes(2);

    child.parent.value = 'bar';
    await expect(child.parent).toHaveUpdated();
    expect(effect).toBeCalledTimes(3);
  });

  it('will inherit parent context', () => {
    class Foo extends State {}
    class Bar extends State {
      baz = new Baz();
    }

    class Baz extends State {
      foo = get(Foo);
    }

    const h = host();
    apply(h, { Foo, Bar });
    const bar = find(h, Bar);

    expect(bar.baz.foo).toBeInstanceOf(Foo);
  });

  it('will not be enumerable', () => {
    class Ambient extends State {}
    class Test extends State {
      ambient = get(Ambient);
      foo = 'bar';
    }

    const h = host();
    const test = new Test();
    const ambient = new Ambient();

    apply(h, { ambient, test });

    expect(test.ambient).toBe(ambient);
    expect(Object.keys(test)).toMatchObject(['foo']);
  });

  describe('subscription', () => {
    it('will update when implicit upstream is replaced', async () => {
      class Peer extends State {}
      class Parent extends State {
        peer = new Peer();
      }
      class Child extends State {
        peer = get(Peer);
      }

      const h = host();
      const parent = new Parent();
      const child = new Child();

      include(h, parent);
      event(parent);
      include(h, child);
      event(child);

      const effect = vi.fn();
      const first = parent.peer;

      expect(child.peer).toBe(first);

      child.get((it) => effect(it.peer));

      parent.peer = new Peer();
      await expect(child).toHaveUpdated();

      expect(effect).toBeCalledTimes(2);
      expect(effect).nthCalledWith(1, first);
      expect(effect).nthCalledWith(2, parent.peer);
    });

    it('will update when upstream is added to ancestor context', async () => {
      class Ambient extends State {}
      class Child extends State {
        ambient = get(Ambient, false);
      }

      const h = host();
      const child = new Child();
      const ambient = Ambient.new();

      include(h, child);
      event(child);

      const effect = vi.fn();

      expect(child.ambient).toBeUndefined();

      child.get((it) => effect(it.ambient));
      include(h, ambient);
      await expect(child).toHaveUpdated();

      expect(effect).toBeCalledTimes(2);
      expect(effect).nthCalledWith(1, undefined);
      expect(effect).nthCalledWith(2, ambient);
    });

    it('will run callback when upstream is replaced', async () => {
      class Remote extends State {
        value = 'initial';
      }

      const callback = vi.fn();

      class Owner extends State {
        remote = new Remote();
      }
      class Consumer extends State {
        remote = get(Remote, callback);
      }

      const h = host();
      const owner = new Owner();
      const consumer = new Consumer();

      include(h, owner);
      event(owner);
      include(h, consumer);
      event(consumer);

      const first = consumer.remote;
      const effect = vi.fn();

      expect(callback).toBeCalledTimes(1);
      expect(callback).toBeCalledWith(first, consumer);

      consumer.get((it) => {
        effect(it.remote.value);
      });

      owner.remote = new Remote({ value: 'updated' });
      await expect(consumer).toHaveUpdated();

      expect(effect).toBeCalledTimes(2);
      expect(effect).nthCalledWith(1, 'initial');
      expect(effect).nthCalledWith(2, 'updated');
      expect(callback).toBeCalledTimes(2);
      expect(callback).toBeCalledWith(consumer.remote, consumer);
    });
  });

  describe('downstream', () => {
    describe('multiple', () => {
      it('will collect children', () => {
        class Child extends State {}
        class Parent extends State {
          children = get(Child, true);
        }

        const h = host();
        const parent = new Parent();
        const child = new Child();

        include(h, parent);
        event(parent);

        const ch = host();
        link(h, ch);
        include(ch, child);
        event(child);

        expect(parent.children).toEqual([child]);
      });

      it('will collect multiple children', () => {
        class Child extends State {}
        class Parent extends State {
          children = get(Child, true);
        }

        const h = host();
        const parent = new Parent();
        const child1 = new Child();
        const child2 = new Child();

        include(h, parent);
        event(parent);

        const ch = host();
        link(h, ch);
        apply(ch, { child1, child2 });

        expect(parent.children).toEqual([child1, child2]);
      });

      it('will not be enumerable', () => {
        class Child extends State {}
        class Parent extends State {
          children = get(Child, true);
        }

        const h = host();
        const parent = new Parent();

        include(h, parent);
        event(parent);

        const ch = host();
        link(h, ch);
        apply(ch, Child);

        expect(Object.keys(parent)).not.toContain('children');
        expect(parent.children).toEqual([expect.any(Child)]);
      });

      it('will collect a subclass', () => {
        abstract class Child extends State {}

        class Child2 extends Child {}
        class Parent extends State {
          children = get(Child, true);
        }

        const h = host();
        const parent = new Parent();
        const child = new Child2();

        include(h, parent);
        event(parent);

        const ch = host();
        link(h, ch);
        include(ch, child);
        event(child);

        expect(parent.children).toEqual([child]);
      });

      it('will not register superclass', () => {
        class Child extends State {}
        class Child2 extends Child {}
        class Parent extends State {
          children = get(Child2, true);
        }

        const h = host();
        const parent = new Parent();

        include(h, parent);
        event(parent);

        const ch = host();
        link(h, ch);
        apply(ch, Child);

        expect(parent.children.length).toBe(0);
      });

      it('will regsiter for superclass', () => {
        class Child extends State {}
        class Parent extends State {
          children = get(Child, true);
        }
        class Parent2 extends Parent {}

        const h = host();
        const parent = new Parent2();

        include(h, parent);
        event(parent);

        const ch = host();
        link(h, ch);
        apply(ch, Child);

        expect(parent.children.length).toBe(1);
      });

      it('will remove children which unmount', async () => {
        class Child extends State {
          value = 0;
        }
        class Parent extends State {
          children = get(Child, true);
        }

        const h = host();
        const parent = new Parent();
        const child1 = new Child();
        const child2 = new Child();

        include(h, parent);
        event(parent);

        const ch = host();
        link(h, ch);
        apply(ch, { child1, child2 });

        expect(parent.children).toEqual([child1, child2]);

        detach(ch);

        await expect(parent).toHaveUpdated();
        expect(parent.children.length).toBe(0);
      });

      it('will collect own type', async () => {
        class Test extends State {
          tests = get(Test, true);
        }

        const h = host();
        const test = new Test();
        const test2 = new Test();
        const test3 = new Test();

        include(h, test);
        event(test);

        const ch = host();
        link(h, ch);
        include(ch, test2);
        event(test2);

        const ch2 = host();
        link(ch, ch2);
        include(ch2, test3);
        event(test3);

        expect(test.tests).toEqual([test2, test3]);
        expect(test2.tests).toEqual([test3]);
      });

      it('will ignore redundant child', async () => {
        class Child extends State {}
        class Parent extends State {
          children = get(Child, true, gotChild);
        }

        const gotChild = vi.fn();
        const h = host();
        const parent = new Parent();
        const child = new Child();

        include(h, parent);
        event(parent);

        const ch = host();
        link(h, ch);
        include(ch, child);
        event(child);

        const ch2 = host();
        link(ch, ch2);
        include(ch2, child);

        expect(gotChild).toBeCalledTimes(1);
      });

      it('will collect children added later', async () => {
        class Child extends State {}
        class Parent extends State {
          children = get(Child, true);
        }

        const h = host();
        const parent = new Parent();
        include(h, parent);
        event(parent);

        expect(parent.children).toEqual([]);

        const child1 = new Child();
        const ch = host();
        link(h, ch);
        include(ch, child1);
        event(child1);

        await expect(parent).toHaveUpdated();
        expect(parent.children).toEqual([child1]);

        const child2 = new Child();
        const ch2 = host();
        include(h, ch2);
        include(ch2, child2);
        event(child2);

        await expect(parent).toHaveUpdated();
        expect(parent.children).toEqual([child1, child2]);
      });

      it('will collect implicit child added later', async () => {
        class Child extends State {}
        class Wrapper extends State {
          child = new Child();
        }
        class Parent extends State {
          children = get(Child, true);
        }

        const h = host();
        const parent = new Parent();
        include(h, parent);
        event(parent);

        expect(parent.children).toEqual([]);

        const ch = host();
        link(h, ch);
        apply(ch, Wrapper);

        await expect(parent).toHaveUpdated();
        expect(parent.children.length).toBe(1);
        expect(parent.children[0]).toBeInstanceOf(Child);
      });

      it('will register implicit', () => {
        class Baz extends State {}
        class Foo extends State {
          bar = new Bar();
        }
        class Bar extends State {
          baz = get(Baz, true, gotBaz);
        }

        const gotBaz = vi.fn();
        const h = host();
        const foo = new Foo();
        const baz = new Baz();

        include(h, foo);
        event(foo);

        const ch = host();
        link(h, ch);
        include(ch, baz);
        event(baz);

        expect(gotBaz).toBeCalledWith(baz, foo.bar);
      });

      it('will register for implicit', () => {
        class Baz extends State {}
        class Foo extends State {
          baz = get(Baz, true);
        }
        class Bar extends State {
          baz = new Baz();
        }

        const h = host();
        const foo = new Foo();
        const bar = new Bar();

        include(h, foo);
        event(foo);

        const ch = host();
        link(h, ch);
        include(ch, bar);
        event(bar);

        expect(foo.baz).toEqual([bar.baz]);
      });
    });

    describe('single', () => {
      it('will get single downstream child', async () => {
        class Child extends State {}
        class Parent extends State {
          child = get(Child, true, false);
        }

        const h = host();
        const parent = new Parent();
        include(h, parent);
        event(parent);

        expect(parent.child).toBeUndefined();

        const ch = host();
        link(h, ch);
        const child = new Child();
        include(ch, child);
        event(child);

        expect(parent.child).toBe(child);
      });

      it('will clear when downstream child is destroyed', () => {
        class Child extends State {}
        class Parent extends State {
          child = get(Child, true, false);
        }

        const h = host();
        const parent = new Parent();
        const child = new Child();

        include(h, parent);
        event(parent);

        const ch = host();
        link(h, ch);
        include(ch, child);
        event(child);

        expect(parent.child).toBe(child);

        child.set(null);

        expect(parent.child).toBeUndefined();
      });

      it('will ignore upstream matches in single downstream get', () => {
        class Foo extends State {}
        class Bar extends State {
          child = get(Foo, true, false);
        }

        const h = host();
        const upstream = new Foo();
        const parent = new Bar();

        include(h, upstream);
        event(upstream);
        include(h, parent);
        event(parent);

        expect(parent.child).toBeUndefined();

        const ch = host();
        link(h, ch);
        const downstream = new Foo();
        include(ch, downstream);
        event(downstream);

        expect(parent.child).toBe(downstream);
      });

      it('will return undefined when not required and not found', () => {
        class Child extends State {}
        class Parent extends State {
          child = get(Child, true, false);
        }

        const h = host();
        const parent = Parent.new();
        include(h, parent);

        expect(parent.child).toBeUndefined();
      });
    });
  });
});

describe('lifecycle callbacks', () => {
  it('will run callback on upstream mount', () => {
    class Remote extends State {
      value = 'foo';
    }

    const remoteCallback = vi.fn();

    class Test extends State {
      remote = get(Remote, remoteCallback);
    }

    const h = host();
    const remote = new Remote();
    const test = new Test();

    apply(h, { remote, test });

    expect(remoteCallback).toBeCalledTimes(1);
    expect(remoteCallback).toBeCalledWith(remote, test);
  });

  it('will run callback on downstream mount', () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true, gotChild);
    }

    const gotChild = vi.fn();
    const h = host();
    const parent = new Parent();
    const child = new Child();

    include(h, parent);
    event(parent);

    const ch = host();
    link(h, ch);
    include(ch, child);
    event(child);

    expect(gotChild).toBeCalledWith(child, parent);
  });

  it('will run cleanup on downstream unmount', async () => {
    const didRemove = vi.fn();
    const didAdd = vi.fn(() => didRemove);

    class Child extends State {
      value = 0;
    }
    class Parent extends State {
      children = get(Child, true, didAdd);
    }

    const h = host();
    const parent = new Parent();
    const child1 = new Child();
    const child2 = new Child();

    include(h, parent);
    event(parent);

    const ch = host();
    link(h, ch);
    apply(ch, { child1, child2 });

    expect(didAdd).toBeCalledTimes(2);
    expect(parent.children).toEqual([child1, child2]);

    detach(ch);

    await expect(parent).toHaveUpdated();
    expect(didRemove).toBeCalledTimes(2);
    expect(parent.children.length).toBe(0);
  });

  it('will not register if callback returns false', async () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true, hasChild);
    }

    const hasChild = vi.fn(() => false);
    const h = host();
    const parent = new Parent();
    include(h, parent);
    event(parent);

    const ch = host();
    link(h, ch);
    apply(ch, { 1: Child, 2: Child });

    expect(hasChild).toBeCalledTimes(2);
    expect(parent.children.length).toBe(0);

    const ch2 = host();
    include(h, ch2);
    apply(ch2, { Child });

    await expect(parent).not.toHaveUpdated();
    expect(hasChild).toBeCalledTimes(3);
    expect(parent.children.length).toBe(0);
  });

  it('upstream callback is not reactive', async () => {
    class Remote extends State {
      value = 'foo';
    }

    const remoteCallback = vi.fn((remote: Remote) => {
      void remote.value;
    });

    class Test extends State {
      remote = get(Remote, remoteCallback);
    }

    const h = host();
    const remote = new Remote();
    const test = new Test();

    apply(h, { remote, test });

    expect(remoteCallback).toBeCalledTimes(1);

    remote.value = 'bar';
    await remote.set();

    expect(remoteCallback).toBeCalledTimes(1);
  });

  it('will run cleanup on state destruction', async () => {
    class Remote extends State {}

    const cleanup = vi.fn();
    const remoteCallback = vi.fn(() => cleanup);

    class Test extends State {
      remote = get(Remote, remoteCallback);
    }

    const h = host();
    const remote = new Remote();
    const test = new Test();

    apply(h, { remote, test });

    expect(remoteCallback).toBeCalledTimes(1);
    expect(cleanup).not.toBeCalled();

    test.set(null);

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will receive ready instance', async () => {
    const didSet = vi.fn();

    class Child extends State {
      value = set(undefined, didSet);
    }

    class Parent extends State {
      children = get(Child, true, (child) => {
        child.value = 'Hello';
      });
    }

    const h = host();
    const ch = host();

    link(h, ch);
    apply(ch, Parent);

    const ch2 = host();
    link(ch, ch2);
    apply(ch2, Child);

    expect(didSet).toBeCalledWith('Hello', undefined);
  });

  it('will cleanup before destroying', async () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true, (child) => {
        didNotify();
        return () => {
          expect(this.get(null)).toBe(false);
          expect(child.get(null)).toBe(false);
          didRemove();
        };
      });
    }

    const didNotify = vi.fn();
    const didRemove = vi.fn();

    const h = host();
    const ch = host();
    link(h, ch);
    apply(ch, Parent);

    const ch2 = host();
    link(ch, ch2);
    apply(ch2, Child);

    expect(didNotify).toBeCalledTimes(1);
    expect(didRemove).not.toBeCalled();

    detach(h);

    expect(didRemove).toBeCalledTimes(1);
    expect(didNotify).toBeCalledTimes(1);
  });

  it('will cleanup effects before destroying', async () => {
    class Child extends State {}
    class Parent extends State {
      children = get(Child, true, () => {
        didNotify();
        this.get(() => {
          return didRemove;
        });
      });
    }

    const didNotify = vi.fn();
    const didRemove = vi.fn();

    const h = host();
    apply(h, Parent);

    const ch = host();
    link(h, ch);
    apply(ch, Child);

    expect(didNotify).toBeCalledTimes(1);
    expect(didRemove).not.toBeCalled();

    detach(ch);

    expect(didRemove).toBeCalledTimes(1);
    expect(didNotify).toBeCalledTimes(1);
  });
});
