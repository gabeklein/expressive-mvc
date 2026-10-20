import { vi, describe, it, expect } from 'vitest';
import { Context } from '../context';
import { event, Model } from '../state';
import { get } from './get';
import { has } from './has';
import { set } from './set';

// is this desirable?
it.todo('will add pending compute to frame immediately', () => {});
it.todo('will suspend if necessary', () => {});

describe('fetch mode', () => {
  it('will fetch sibling', () => {
    class Sibling extends Model {}
    class Test extends Model {
      sibling = get(Sibling);
    }

    const context = new Context(Sibling);
    const test = new Test();

    context.add(test, true);
    event(test);

    const sibling = context.get(Sibling);

    expect(test.sibling).toBe(sibling);
  });

  it('will fetch multiple', () => {
    class Ambient extends Model {}
    class Test extends Model {
      ambient1 = get(Ambient);
      ambient2 = get(Ambient);
    }

    const test = new Test();
    const ambient = new Ambient();

    new Context(ambient).push(test);

    expect(test.ambient1).toBe(ambient);
    expect(test.ambient2).toBe(ambient);
  });

  it('will allow overwrite', async () => {
    class Foo extends Model {
      bar = new Bar();
      value = 'foo';
    }

    class Bar extends Model {
      foo = get(Foo);
      value = 'foo';
    }

    const foo = Foo.new();
    const mockEffect = vi.fn();

    expect(foo.bar.foo).toBe(foo);

    foo.get((state) => mockEffect(state.bar.foo.value));

    foo.value = 'bar';
    await expect(foo).toHaveUpdated();

    expect(mockEffect).toBeCalledWith('bar');

    foo.bar.foo = Foo.new();
    await expect(foo.bar).toHaveUpdated();

    expect(mockEffect).toBeCalledWith('foo');
    expect(mockEffect).toBeCalledTimes(3);
  });

  it('will create parent-child relationship', () => {
    class Foo extends Model {
      child = new Bar();
    }
    class Bar extends Model {
      parent = get(Foo);
    }

    const foo = Foo.new();
    const bar = foo.child;

    expect(bar).toBeInstanceOf(Bar);
    expect(bar.parent).toBe(foo);
  });

  it('will throw if not found in context', () => {
    class Parent extends Model {}
    class Child extends Model {
      expects = get(Parent);
    }

    // should this throw immediately, or only on access?
    expect(() => new Context(Child)).toThrow(
      /Required Parent not found in context for [\w-]+\./
    );
  });

  it('will skip self and descendants when looking up own type', () => {
    class Node extends Model {
      parent = get(Node, false);
    }

    const root = new Node();
    const ctx = new Context(root);
    const child = new Node();
    ctx.push(child);

    expect(child.parent).toBe(root);
    expect(root.parent).toBeUndefined();

    const grandchild = new Node();
    new Context(ctx).push(grandchild);

    expect(grandchild.parent).toBe(root);
    expect(child.parent).toBe(root);
    expect(root.parent).toBeUndefined();
  });

  it('will throw on own type when required and no upstream', () => {
    class Node extends Model {
      parent = get(Node);
    }

    expect(() => new Context(new Node())).toThrow(/Required Node not found in context for [\w-]+\./);
  });

  it('will return undefined if required is false', () => {
    class MaybeParent extends Model {}
    class StandAlone extends Model {
      maybe = get(MaybeParent, false);
      self = get(StandAlone, false);
    }

    const instance = new StandAlone();

    new Context(instance);

    expect(instance.maybe).toBeUndefined();
    expect(instance.self).toBeUndefined();
  });

  it('will not throw if has parent but not type-required', () => {
    class Expected extends Model {}
    class Unexpected extends Model {
      child = new Adopted();
    }
    class Adopted extends Model {
      expects = get(Expected, false);
    }

    expect(() => Unexpected.new()).not.toThrow();
  });

  it('will track recursively', async () => {
    class Child extends Model {
      value = 'foo';
      parent = get(Parent);
    }

    class Parent extends Model {
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
    class Foo extends Model {}
    class Bar extends Model {
      baz = new Baz();
    }

    class Baz extends Model {
      foo = get(Foo);
    }

    const context = new Context(Foo).push(Bar);
    const bar = context.get(Bar);

    expect(bar.baz.foo).toBeInstanceOf(Foo);
  });

  it('will not be enumerable', () => {
    class Ambient extends Model {}
    class Test extends Model {
      ambient = get(Ambient);
      foo = 'bar';
    }
    const test = new Test();
    const ambient = new Ambient();

    const context = new Context();

    context.add(ambient, true);
    context.add(test, true);
    event(ambient);
    event(test);

    expect(test.ambient).toBe(ambient);
    expect(Object.keys(test)).toMatchObject(['foo']);
  });

  describe('siblings', () => {
    class Peer extends Model {}
    class Required extends Model {
      peer = get(Peer);
    }
    class Optional extends Model {
      peer = get(Peer, false);
    }

    it.each([
      ['will resolve optional sibling declared earlier', Optional, true],
      ['will resolve optional sibling declared later', Optional, false],
      ['will resolve required sibling declared earlier', Required, true],
      ['will resolve required sibling declared later', Required, false]
    ])('%s within own parent', (_, Child, earlier) => {
      class Earlier extends Model {
        peer = new Peer();
        child = new Child();
      }
      class Later extends Model {
        child = new Child();
        peer = new Peer();
      }

      for (const parent of [1, 2, 3].map(() => (earlier ? Earlier : Later).new()))
        expect(parent.child.peer).toBe(parent.peer);
    });

    it('will keep own sibling when another arrives in context', () => {
      class Parent extends Model {
        child = new Required();
        peer = new Peer();
      }
      class A extends Parent {}
      class B extends Parent {}

      const context = new Context(A);
      const a = context.get(A);
      const b = B.new();

      context.add(b, true);

      expect(a.child.peer).toBe(a.peer);
      expect(b.child.peer).toBe(b.peer);

      context.pop();
      b.set(null);
    });

    it('will run callback for sibling declared later', () => {
      const callback = vi.fn();

      class Child extends Model {
        peer = get(Peer, callback);
      }
      class Parent extends Model {
        child = new Child();
        peer = new Peer();
      }

      const parent = Parent.new();

      expect(callback).toBeCalledTimes(1);
      expect(callback).toBeCalledWith(parent.peer, parent.child);
      expect(parent.child.peer).toBe(parent.peer);
    });

    it('will resolve siblings within explicit context', () => {
      class Parent extends Model {
        child = new Required();
        peer = new Peer();
      }

      const context = new Context(Parent);
      const parent = context.get(Parent);

      expect(parent.child.peer).toBe(parent.peer);
      expect(context.get(Peer)).toBe(parent.peer);
    });

    it('will resolve through an activating grandparent', () => {
      class Middle extends Model {
        child = new Required();
      }
      class Parent extends Model {
        middle = new Middle();
        peer = new Peer();
      }

      const parent = Parent.new();

      expect(parent.middle.child.peer).toBe(parent.peer);
    });

    it('will throw if sibling never arrives', () => {
      class Parent extends Model {
        child = new Required();
        other = new Optional();
      }

      expect(() => Parent.new()).toThrow(
        /Required Peer not found in context for Required-[\w-]+\./
      );
    });

    it('will not notify a destroyed child when a later parent activates', () => {
      class Parent extends Model {
        child = new Required();
        peer = new Peer();
      }

      const p1 = Parent.new();
      p1.set(null);

      const p2 = Parent.new();

      expect(p2.child.peer).toBe(p2.peer);
    });

    it('will not notify a replaced child when sibling is reassigned', () => {
      class Parent extends Model {
        child = new Optional();
        peer = new Peer();
      }

      const parent = Parent.new();
      const { child, peer } = parent;

      parent.child = new Optional();
      parent.peer = new Peer();

      expect(child.peer).toBe(peer);
      expect(parent.child.peer).toBe(parent.peer);
    });

    it('will prefer sibling over grandparent sibling', () => {
      class Middle extends Model {
        child = new Required();
        peer = new Peer();
      }
      class Parent extends Model {
        middle = new Middle();
        peer = new Peer();
      }

      const parent = Parent.new();

      expect(parent.middle.child.peer).toBe(parent.middle.peer);
    });

    it('will not resolve a sibling that was cleared', () => {
      class Parent extends Model {
        peer: Peer | null = new Peer();
        child?: Optional = undefined;
      }

      const parent = Parent.new();

      parent.peer = null;
      parent.child = new Optional();

      expect(parent.child.peer).toBeUndefined();
    });

    it('will resolve through context for a pool member', () => {
      class Theme extends Model {}
      class Item extends Model {
        theme = get(Theme);
      }
      class Store extends Model {
        items = has(Item);
      }

      const context = new Context(Theme).push(Store);
      const item = context.get(Store).items.add();

      expect(item.theme).toBe(context.get(Theme));
    });

    it('will not resolve to itself', () => {
      class Node extends Model {
        peer = get(Node, false);
      }
      class Parent extends Model {
        a = new Node();
        b = new Node();
      }

      const parent = Parent.new();

      expect(parent.a.peer).toBe(parent.b);
      expect(parent.b.peer).toBe(parent.a);
    });

    it('will resolve a sibling a subclass initializer replaced', () => {
      class Workspace extends Model {
        git = 'host';
      }
      class HarnessWorkspace extends Workspace {
        git = 'harness';
      }
      class Session extends Model {
        workspace = get(Workspace);
      }
      class HarnessSession extends Session {}
      class Pairing extends Model {
        session = new Session();
        workspace = new Workspace();
      }
      class HarnessPairing extends Pairing {
        session = new HarnessSession();
        workspace = new HarnessWorkspace();
      }

      const p1 = HarnessPairing.new();
      const p2 = HarnessPairing.new();

      p1.set(null);

      const p3 = HarnessPairing.new();

      for (const p of [p2, p3]) {
        expect(p.session.workspace).toBe(p.workspace);
        expect(p.session.workspace.git).toBe('harness');
      }
    });
  });

  describe('ancestors', () => {
    it('will resolve grandparent without context', () => {
      class Leaf extends Model {
        top = get(Top);
        mid = get(Mid);
      }
      class Mid extends Model {
        leaf = new Leaf();
      }
      class Top extends Model {
        mid = new Mid();
      }

      const top = Top.new();

      expect(top.mid.leaf.mid).toBe(top.mid);
      expect(top.mid.leaf.top).toBe(top);
    });

    it('will resolve owner of owner for a pool member', () => {
      class Item extends Model {
        app = get(App);
      }
      class Store extends Model {
        items = has(Item);
      }
      class App extends Model {
        store = new Store();
      }

      const app = App.new();
      const item = app.store.items.add();

      expect(item.app).toBe(app);
    });

    it('will prefer ancestor over context', () => {
      class Leaf extends Model {
        top = get(Top);
      }
      class Mid extends Model {
        leaf = new Leaf();
      }
      class Top extends Model {
        mid = new Mid();
      }

      class Root extends Model {
        top = new Top();
      }

      const outer = new Context(Top);
      const context = outer.push(Root);
      const provided = outer.get(Top);
      const { top } = context.get(Root);

      expect(provided).not.toBe(top);
      expect(provided.mid.leaf.top).toBe(provided);
      expect(top.mid.leaf.top).toBe(top);
    });

    it('will prefer ancestor over its sibling', () => {
      class Leaf extends Model {
        top = get(Top);
      }
      class Mid extends Model {
        leaf = new Leaf();
      }
      class Top extends Model {
        mid = new Mid();
        peer?: Top = undefined;
      }

      const top = Top.new();
      top.peer = new Top();

      expect(top.mid.leaf.top).toBe(top);
    });

    it('will prefer nearer sibling over ancestor', () => {
      class Leaf extends Model {
        top = get(Top);
      }
      class Mid extends Model {
        leaf = new Leaf();
        top?: Top = undefined;
      }
      class Top extends Model {
        mid?: Mid = undefined;
      }

      const outer = Top.new();
      const mid = new Mid();

      outer.mid = mid;

      expect(mid.leaf.top).toBe(outer);

      mid.top = new Top();

      expect(mid.leaf.top).toBe(mid.top);
    });

    it('will prefer existing sibling over ancestor', () => {
      class Leaf extends Model {
        top = get(Top);
      }
      class Mid extends Model {
        top = new Top();
        leaf = new Leaf();
      }
      class Top extends Model {
        mid?: Mid = undefined;
      }

      const outer = Top.new();

      outer.mid = new Mid();

      expect(outer.mid.leaf.top).toBe(outer.mid.top);
    });

    it('will throw if no ancestor matches', () => {
      class Other extends Model {}
      class Leaf extends Model {
        other = get(Other);
      }
      class Mid extends Model {
        leaf = new Leaf();
      }
      class Top extends Model {
        mid = new Mid();
      }

      expect(() => Top.new()).toThrow(
        /Required Other not found in context for Leaf-[\w-]+\./
      );
    });
  });

  it('will not register upstream into own context', () => {
    class Parent extends Model {
      child = new Child();
    }
    class Child extends Model {
      parent = get(Parent);
    }
    class Stranger extends Model {
      parent = get(Parent, false);
    }

    const parent = Parent.new();

    expect(parent.child.parent).toBe(parent);
    expect(Stranger.new().parent).toBeUndefined();
  });

  describe('subscription', () => {
    it('will update when implicit upstream is replaced', async () => {
      class Peer extends Model {}
      class Parent extends Model {
        peer = new Peer();
      }
      class Child extends Model {
        peer = get(Peer);
      }

      const parent = new Parent();
      const child = new Child();

      new Context(parent).push(child);

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
      class Ambient extends Model {}
      class Child extends Model {
        ambient = get(Ambient, false);
      }

      const child = new Child();
      const ambient = Ambient.new();
      const context = new Context();
      const effect = vi.fn();

      context.push(child);

      expect(child.ambient).toBeUndefined();

      child.get((it) => effect(it.ambient));
      context.add(ambient);
      await expect(child).toHaveUpdated();

      expect(effect).toBeCalledTimes(2);
      expect(effect).nthCalledWith(1, undefined);
      expect(effect).nthCalledWith(2, ambient);
    });

    it('will run callback when upstream is replaced', async () => {
      class Remote extends Model {
        value = 'initial';
      }

      const callback = vi.fn();

      class Owner extends Model {
        remote = new Remote();
      }
      class Consumer extends Model {
        remote = get(Remote, callback);
      }

      const owner = new Owner();
      const consumer = new Consumer();

      new Context(owner).push(consumer);

      const first = consumer.remote;
      const effect = vi.fn();

      expect(callback).toBeCalled();
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
      class Child extends Model {}
      class Parent extends Model {
        children = get(Child, true);
      }

      it('will collect multiple children', () => {
        const parent = new Parent();
        const child1 = new Child();
        const child2 = new Child();

        const context = new Context(parent);

        context.push(child1);
        context.push(child2);

        expect(parent.children).toEqual([child1, child2]);
      });

      it('will not collect self through a consumer', () => {
        class Node extends Model {
          peers = get(Node, true);
          up = get(Node, false);
        }

        const parent = new Node();
        const child = new Node();

        new Context(parent).push(child);

        expect(child.up).toBe(parent);
        expect(parent.peers).toEqual([child]);
      });

      it('will not be enumerable', () => {
        const parent = new Parent();

        new Context(parent).push(Child);

        expect(Object.keys(parent)).not.toContain('children');
        expect(parent.children).toEqual([expect.any(Child)]);
      });

      it('will collect a subclass', () => {
        class Child2 extends Child {}

        const parent = new Parent();
        const child = new Child2();

        new Context(parent).push(child);

        expect(parent.children).toEqual([child]);
      });

      it('will not register superclass', () => {
        class Child2 extends Child {}
        class Parent extends Model {
          children = get(Child2, true);
        }

        const parent = new Parent();

        new Context(parent).push(Child);

        expect(parent.children.length).toBe(0);
      });

      it('will register for superclass', () => {
        class Parent2 extends Parent {}

        const parent = new Parent2();

        new Context(parent).push(Child);

        expect(parent.children.length).toBe(1);
      });

      it('will collect own type', async () => {
        class Test extends Model {
          tests = get(Test, true);
        }

        const test = new Test();
        const test2 = new Test();
        const test3 = new Test();

        new Context(test).push(test2).push(test3);

        expect(test.tests).toEqual([test2, test3]);
        expect(test2.tests).toEqual([test3]);
      });

      it('will ignore redundant child', async () => {
        class Parent extends Model {
          children = get(Child, true, gotChild);
        }

        const gotChild = vi.fn();
        const parent = new Parent();
        const child = new Child();

        new Context(parent).push(child).push(child);

        expect(gotChild).toBeCalledTimes(1);
      });

      it('will collect children added later', async () => {
        const parent = new Parent();
        const context = new Context(parent);

        expect(parent.children).toEqual([]);

        const child1 = new Child();
        context.push(child1);

        await expect(parent).toHaveUpdated();
        expect(parent.children).toEqual([child1]);

        const child2 = new Child();
        context.push(child2);

        await expect(parent).toHaveUpdated();
        expect(parent.children).toEqual([child1, child2]);
      });

      it('will collect implicit child added later', async () => {
        class Wrapper extends Model {
          child = new Child();
        }

        const parent = new Parent();

        new Context(parent).push(Wrapper);

        await expect(parent).toHaveUpdated();
        expect(parent.children.length).toBe(1);
        expect(parent.children[0]).toBeInstanceOf(Child);
      });

      it('will register implicit', () => {
        class Baz extends Model {}
        class Foo extends Model {
          bar = new Bar();
        }
        class Bar extends Model {
          baz = get(Baz, true, gotBaz);
        }

        const gotBaz = vi.fn();
        const foo = new Foo();
        const baz = new Baz();

        new Context(foo).push(baz);

        expect(gotBaz).toBeCalledWith(baz, foo.bar);
      });

      it('will register for implicit', () => {
        class Baz extends Model {}
        class Foo extends Model {
          baz = get(Baz, true);
        }
        class Bar extends Model {
          baz = new Baz();
        }

        const foo = new Foo();
        const bar = new Bar();

        new Context(foo).push(bar);

        expect(foo.baz).toEqual([bar.baz]);
      });
    });

    describe('single', () => {
      it('will get single downstream child until destroyed', () => {
        class Child extends Model {}
        class Parent extends Model {
          child = get(Child, true, false);
        }

        const parent = new Parent();
        const child = new Child();
        const ctx = new Context(parent);

        expect(parent.child).toBeUndefined();

        ctx.push(child);

        expect(parent.child).toBe(child);

        child.set(null);

        expect(parent.child).toBeUndefined();
      });

      it('will ignore upstream matches in single downstream get', () => {
        class Foo extends Model {}
        class Bar extends Model {
          child = get(Foo, true, false);
        }

        const parent = new Bar();
        const upstream = new Foo();
        const ctx = new Context(upstream).push(parent);

        expect(parent.child).toBeUndefined();

        const downstream = new Foo();
        ctx.push(downstream);

        expect(parent.child).toBe(downstream);
      });

    });
  });

  describe('owner', () => {
    it('will get owner and run callback with it', () => {
      const callback = vi.fn();

      class Child extends Model {
        owner = get(Model, callback);
      }
      class Parent extends Model {
        child = new Child();
      }

      const parent = Parent.new();

      expect(parent.child.owner).toBe(parent);
      expect(callback).toHaveBeenCalledWith(parent, parent.child);
    });

    it('will get Model a context was set up for', () => {
      class Host extends Model {}
      class Child extends Model {
        owner = get(Model);
      }

      const host = Host.new();
      const child = new Child();

      new Context(host).push(child);

      expect(child.owner).toBe(host);
    });

    it('will be undefined if optional and none', () => {
      class Child extends Model {
        owner = get(Model, false);
      }

      expect(Child.new().owner).toBeUndefined();
    });

    it('will throw if none', () => {
      class Child extends Model {
        owner = get(Model);
      }

      expect(() => Child.new()).toThrow(/^Child-\w+ has no owner\.$/);
    });

    it('will collect owned Models', async () => {
      class Child extends Model {}
      class Parent extends Model {
        child = new Child();
        guest?: Child = undefined;
        pool = has(Child);
        owned = get(Model, true);
      }

      const parent = Parent.new();

      parent.guest = Child.new();

      expect(parent.owned).toEqual([parent.child]);

      const member = parent.pool.add();

      await expect(parent).toHaveUpdated('owned');
      expect(parent.owned).toEqual([parent.child, member]);

      parent.pool.delete(member);

      await expect(parent).toHaveUpdated('owned');
      expect(parent.owned).toEqual([parent.child]);
    });

    it('will get single owned Model', async () => {
      class Child extends Model {}
      class Parent extends Model {
        child?: Child = undefined;
        owned = get(Model, true, false);
      }

      const parent = Parent.new();

      expect(parent.owned).toBeUndefined();

      parent.child = new Child();

      await expect(parent).toHaveUpdated('owned');
      expect(parent.owned).toBe(parent.child);

      parent.child = undefined;

      await expect(parent).toHaveUpdated('owned');
      expect(parent.owned).toBeUndefined();
    });

    it('will suspend until an owned Model exists', async () => {
      class Child extends Model {}
      class Parent extends Model {
        child?: Child = undefined;
        owned = get(Model, true, true);
      }

      const parent = Parent.new();

      expect(() => parent.owned).toThrow(expect.any(Promise));

      parent.child = new Child();

      await expect(parent).toHaveUpdated('owned');
      expect(parent.owned).toBe(parent.child);
    });
  });
});

describe('lifecycle callbacks', () => {
  it('will run callback on upstream mount', () => {
    class Remote extends Model {
      value = 'foo';
    }

    const remoteCallback = vi.fn();

    class Test extends Model {
      remote = get(Remote, remoteCallback);
    }

    const remote = new Remote();
    const test = new Test();

    new Context(remote).push(test);

    expect(remoteCallback).toBeCalledTimes(1);
    expect(remoteCallback).toBeCalledWith(remote, test);
  });

  it('will run callback on downstream mount', () => {
    class Child extends Model {}
    class Parent extends Model {
      children = get(Child, true, gotChild);
    }

    const gotChild = vi.fn();
    const parent = new Parent();
    const child = new Child();

    new Context(parent).push(child);

    expect(gotChild).toBeCalledWith(child, parent);
  });

  it('will run cleanup on downstream unmount', async () => {
    const didRemove = vi.fn();
    const didAdd = vi.fn(() => didRemove);

    class Child extends Model {
      value = 0;
    }
    class Parent extends Model {
      children = get(Child, true, didAdd);
    }

    const parent = new Parent();
    const child1 = new Child();
    const child2 = new Child();

    const context = new Context(parent);
    const context2 = context.push();

    context2.push(child1);
    context2.push(child2);

    expect(didAdd).toBeCalledTimes(2);
    expect(parent.children).toEqual([child1, child2]);

    context2.pop();

    await expect(parent).toHaveUpdated();
    expect(didRemove).toBeCalledTimes(2);
    expect(parent.children.length).toBe(0);
  });

  it('will not register if callback returns false', async () => {
    class Child extends Model {}
    class Parent extends Model {
      children = get(Child, true, hasChild);
    }

    const hasChild = vi.fn(() => false);
    const parent = new Parent();
    const context = new Context(parent);

    context.push(Child);
    context.push(Child);

    expect(hasChild).toBeCalledTimes(2);
    expect(parent.children.length).toBe(0);

    context.push(Child);

    await expect(parent).not.toHaveUpdated();
    expect(hasChild).toBeCalledTimes(3);
    expect(parent.children.length).toBe(0);
  });

  it('will not rerun upstream callback reactively', async () => {
    class Remote extends Model {
      value = 'foo';
    }

    const remoteCallback = vi.fn((remote: Remote) => void remote.value);

    class Test extends Model {
      remote = get(Remote, remoteCallback);
    }

    const remote = new Remote();
    const test = new Test();

    new Context(remote).push(test);

    remote.value = 'bar';
    await remote.set();

    expect(remoteCallback).toBeCalledTimes(1);
  });

  it('will run cleanup on state destruction', async () => {
    class Remote extends Model {}

    const cleanup = vi.fn();
    const remoteCallback = vi.fn(() => cleanup);

    class Test extends Model {
      remote = get(Remote, remoteCallback);
    }

    const remote = new Remote();
    const test = new Test();

    new Context(remote).push(test);

    expect(cleanup).not.toBeCalled();

    test.set(null);

    expect(cleanup).toBeCalledTimes(1);
  });

  it('will receive ready instance', async () => {
    const didSet = vi.fn();

    class Child extends Model {
      value = set(undefined, didSet);
    }

    class Parent extends Model {
      children = get(Child, true, (child) => {
        child.value = 'Hello';
      });
    }

    const context = new Context();

    context.push(Parent).push(Child);

    expect(didSet).toBeCalledWith('Hello', undefined);
  });

  it('will cleanup before destroying', async () => {
    class Child extends Model {}
    class Parent extends Model {
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

    const context = new Context();

    context.push(Parent).push(Child);

    expect(didNotify).toBeCalled();
    expect(didRemove).not.toBeCalled();

    context.pop();

    expect(didRemove).toBeCalledTimes(1);
    expect(didNotify).toBeCalledTimes(1);
  });

  it('will cleanup effects before destroying', async () => {
    class Child extends Model {}
    class Parent extends Model {
      children = get(Child, true, () => {
        didNotify();
        this.get(() => {
          return didRemove;
        });
      });
    }

    const didNotify = vi.fn();
    const didRemove = vi.fn();

    const context = new Context(Parent);
    const inner = context.push(Child);

    expect(didNotify).toBeCalled();
    expect(didRemove).not.toBeCalled();

    inner.pop();

    expect(didRemove).toBeCalledTimes(1);
    expect(didNotify).toBeCalledTimes(1);
  });
});
