import { Context } from '../context';
import { Model } from '../model';
import { has } from './has';
import { set } from './set';

describe('recipient', () => {
  it('will register child', () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child);
    }

    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent }).push({ child });

    expect(parent.children).toEqual([child]);
  });

  it('will not be enumerable', () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child);
    }

    const parent = Parent.new();

    new Context({ parent }).push({ Child });

    expect(Object.keys(parent)).not.toContain('children');
    expect(parent.children).toEqual([expect.any(Child)]);
  });

  it('will register a subclass', () => {
    abstract class Child extends Model {}

    class Child2 extends Child {}
    class Parent extends Model {
      children = has(Child);
    }

    const parent = Parent.new();
    const child = Child2.new();

    new Context({ parent }).push({ child });

    expect(parent.children).toEqual([child]);
  });

  it('will not register superclass', () => {
    class Child extends Model {}
    class Child2 extends Child {}
    class Parent extends Model {
      children = has(Child2);
    }

    const parent = Parent.new();

    new Context({ parent }).push({ Child });

    expect(parent.children.length).toBe(0);
  });

  it('will not register subclass', () => {
    class Child extends Model {}
    class Child2 extends Child {}
    class Parent extends Model {
      children = has(Child);
    }

    const parent = Parent.new();

    new Context({ parent }).push({ Child2 });

    expect(parent.children.length).toBe(1);
  });

  it('will regsiter for superclass', () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child);
    }
    class Parent2 extends Parent {}

    const parent = Parent2.new();

    new Context({ parent }).push({ Child });

    expect(parent.children.length).toBe(1);
  });

  it('will run callback on register', () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child, gotChild);
    }

    const gotChild = jest.fn();
    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent }).push({ child });

    expect(gotChild).toHaveBeenCalledWith(child, parent);
  });

  it('will register multiple children', () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child, hasChild);
    }

    const hasChild = jest.fn();
    const parent = Parent.new();
    const child1 = Child.new();
    const child2 = Child.new();

    new Context({ parent }).push({ child1, child2 });

    expect(hasChild).toHaveBeenCalledTimes(2);
    expect(parent.children).toEqual([child1, child2]);
  });

  it('will remove children which unmount', async () => {
    const didRemove = jest.fn();
    const didAdd = jest.fn(() => didRemove);

    class Child extends Model {
      value = 0;
    }
    class Parent extends Model {
      children = has(Child, didAdd);
    }

    const parent = Parent.new();

    const child1 = Child.new();
    const child2 = Child.new();

    const context = new Context({ parent });
    const context2 = context.push({ child1, child2 });

    expect(didAdd).toHaveBeenCalledTimes(2);
    expect(parent.children).toEqual([child1, child2]);

    context2.pop();

    await expect(parent).toHaveUpdated();
    expect(didRemove).toHaveBeenCalledTimes(2);

    const child3 = Child.new();
    const context2b = context.push({ child3 });

    expect(parent.children).toEqual([child3]);

    context2b.pop();

    await expect(parent).toHaveUpdated();
    expect(didRemove).toHaveBeenCalledTimes(3);
    expect(parent.children.length).toBe(0);
  });

  it('will not register if returns false', async () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child, hasChild);
    }

    const hasChild = jest.fn(() => false);
    const parent = Parent.new();
    const context = new Context({ parent });

    context.push({
      child: Child.new(),
      child2: Child.new()
    });

    expect(hasChild).toHaveBeenCalledTimes(2);
    expect(parent.children.length).toBe(0);

    context.push({ child: Child.new() });

    await expect(parent).not.toUpdate();
    expect(hasChild).toHaveBeenCalledTimes(3);
    expect(parent.children.length).toBe(0);
  });

  it('will ignore redundant child', async () => {
    class Child extends Model {}
    class Parent extends Model {
      child = has(Child, gotChild);
    }

    const gotChild = jest.fn();
    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent }).push({ child }).push({ child });

    expect(gotChild).toHaveBeenCalledTimes(1);
  });

  it('will register own type', async () => {
    class Test extends Model {
      tests = has(Test, (got, self) => {
        gotTest(got.toString(), self.toString());
      });
    }

    const gotTest = jest.fn();
    const test = Test.new('1');
    const test2 = Test.new('2');
    const test3 = Test.new('3');

    new Context({ test }).push({ test2 }).push({ test3 });

    expect(gotTest).toBeCalledWith('2', '1');
    expect(gotTest).toBeCalledWith('3', '2');
    expect(gotTest).toBeCalledTimes(2);
  });

  it('will register implicit', () => {
    class Baz extends Model {}
    class Foo extends Model {
      bar = new Bar();
    }
    class Bar extends Model {
      baz = has(Baz, gotBaz);
    }

    const gotBaz = jest.fn();
    const foo = Foo.new();
    const baz = Baz.new();

    new Context({ foo }).push({ baz });

    expect(gotBaz).toBeCalledWith(baz, foo.bar);
  });

  it('will register for implicit', () => {
    class Baz extends Model {}
    class Foo extends Model {
      baz = has(Baz);
    }
    class Bar extends Model {
      baz = new Baz();
    }

    const foo = Foo.new();
    const bar = Bar.new();

    new Context({ foo }).push({ bar });

    expect(foo.baz).toEqual([bar.baz]);
  });

  it('will recieve ready instance', async () => {
    const didSet = jest.fn();

    class Child extends Model {
      value = set(undefined, didSet);
    }

    class Parent extends Model {
      child = has(Child, (child) => {
        child.value = 'Hello';
      });
    }

    const context = new Context();

    context.push({ Parent }).push({ Child });

    expect(didSet).toHaveBeenCalledWith('Hello', undefined);
  });

  it('will cleanup before destroying', async () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child, (child) => {
        didNotify();
        return () => {
          // this should occure before both
          // target and recipient are destroyed.
          expect(this.get(null)).toBe(false);
          expect(child.get(null)).toBe(false);
          didRemove();
        };
      });
    }

    const didNotify = jest.fn();
    const didRemove = jest.fn();

    const context = new Context();

    context.push({ Parent }).push({ Child });

    expect(didNotify).toHaveBeenCalledTimes(1);
    expect(didRemove).not.toHaveBeenCalled();

    context.pop();

    expect(didRemove).toHaveBeenCalledTimes(1);
    expect(didNotify).toHaveBeenCalledTimes(1);
  });

  it('will cleanup effects before destroying', async () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child, () => {
        didNotify();
        this.get(() => {
          return didRemove;
        });
      });
    }

    const didNotify = jest.fn();
    const didRemove = jest.fn();

    const context = new Context({ Parent });
    const inner = context.push({ Child });

    expect(didNotify).toHaveBeenCalledTimes(1);
    expect(didRemove).not.toHaveBeenCalled();

    inner.pop();

    expect(didRemove).toHaveBeenCalledTimes(1);
    expect(didNotify).toHaveBeenCalledTimes(1);
  });

  it.skip('will not self conflict', () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child, didNotify);
    }

    const context = new Context();
    const didNotify = jest.fn();
    const parent = Parent.new();

    // when already pushed, creates edge-case.
    context.push({ parent });

    const c2 = context.push({ parent });

    c2.push({ child: Child.new() });

    expect(didNotify).toHaveBeenCalledTimes(1);
  });

  it.todo('will unwrap children on export');
});

describe('target', () => {
  it('will register recipients', () => {
    class Child extends Model {
      parents = has();
    }
    class Parent extends Model {
      child = has(Child);
    }

    const parent = Parent.new();
    const child = Child.new();
    const context = new Context({ parent }).push({ child });

    expect(child.parents).toEqual([parent]);

    context.pop();
  });

  it('will register multiple', () => {
    class Child extends Model {
      parents = has();
    }
    class Parent extends Model {
      child = has(Child);
    }

    const child = Child.new();
    const parent = Parent.new();
    const parent2 = Parent.new();

    const context = new Context({ parent }).push({ child });
    const context2 = new Context({ parent2 }).push({ child });

    expect(child.parents).toEqual([parent, parent2]);

    context.pop();
    context2.pop();
  });

  it('will callback on register', () => {
    class Child extends Model {
      parents = has(gotParent);
    }
    class Parent extends Model {
      child = has(Child);
    }

    const gotParent = jest.fn();

    new Context({ Parent }).push({ Child });

    expect(gotParent).toHaveBeenCalledWith(
      expect.any(Parent),
      expect.any(Child)
    );
  });

  it('will callback before recipient does', () => {
    class Child extends Model {
      parents = has(gotParent);
    }
    class Parent extends Model {
      children = has(Child, gotChild);
    }

    const gotChild = jest.fn();
    const gotParent = jest.fn(() => {
      expect(gotChild).not.toHaveBeenCalled();
    });

    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent }).push({ child });

    expect(gotChild).toHaveBeenCalled();
    expect(gotParent).toHaveBeenCalled();
  });

  it('will prevent register', () => {
    class Child extends Model {
      parents = has(gotParent);
    }
    class Parent extends Model {
      children = has(Child, gotChild);
    }

    const gotChild = jest.fn();
    const gotParent = jest.fn(() => false);

    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent }).push({ child });

    expect(gotParent).toHaveBeenCalled();
    expect(gotChild).not.toHaveBeenCalled();
  });

  it('will callback on removal', async () => {
    class Child extends Model {
      parents = has(() => {
        return removedParent;
      });
    }
    class Parent extends Model {
      children = has(Child);
    }

    const removedParent = jest.fn();

    const parent = Parent.new();
    const child = Child.new();

    const context = new Context({ parent }).push({ child });

    context.pop();

    expect(removedParent).toHaveBeenCalledTimes(1);
  });

  it('will complain if used more than once', () => {
    class Child extends Model {
      parents = has();
      parents2 = has();
    }

    expect(() => Child.new()).toThrowError(
      `'has' callback can only be used once per model.`
    );
  });
});

it.todo('will require values as props if has-instruction');
