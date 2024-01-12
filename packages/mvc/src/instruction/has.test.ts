import { Context } from '../context';
import { Model } from '../model';
import { has } from './has';

describe("recipient", () => {
  it("will register child", () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child);
    }
  
    const parent = Parent.new();
    const child = Child.new();
  
    new Context({ parent }).push({ child });

    expect(parent.children).toEqual([child]);
  })

  it("will register a subclass", () => {
    class Child extends Model {}
    class Child2 extends Child {}
    class Parent extends Model {
      children = has(Child);
    }
  
    const parent = Parent.new();
    const child = Child2.new();
  
    new Context({ parent }).push({ child });

    expect(parent.children).toEqual([child]);
  })
  
  it("will run callback on register", () => {
    class Child extends Model {}
    class Parent extends Model {
      child = has(Child, gotChild);
    }
  
    const gotChild = jest.fn();
    const parent = Parent.new();
    const child = Child.new();
  
    new Context({ parent }).push({ child });

    expect(gotChild).toHaveBeenCalledWith(child, parent);
  })
  
  it("will register multiple children", () => {
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
  })
  
  it("will remove children which unmount", async () => {
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
  })
  
  it("will not register if returns false", async () => {
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

  it("will ignore redundant child", async () => {
    class Child extends Model {}
    class Parent extends Model {
      child = has(Child, gotChild);
    }
  
    const gotChild = jest.fn();
    const parent = Parent.new();
    const child = Child.new();

    new Context({ parent })
      .push({ child })
      .push({ child});

    expect(gotChild).toHaveBeenCalledTimes(1);
  })

  it("will register own type", async () => {
    class Test extends Model {
      tests = has(Test, gotTest);
    }

    const gotTest = jest.fn();
    const test = Test.new();
    const test2 = Test.new();
    const test3 = Test.new();

    new Context({ test }).push({ test2 }).push({ test3 });

    expect(gotTest).toBeCalledTimes(2);
    expect(gotTest).toBeCalledWith(test2, test);
    expect(gotTest).toBeCalledWith(test3, test2);
  })

  it("will register implicit", () => {
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

  it("will register for implicit", () => {
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

    expect(foo.baz).toEqual([ bar.baz ]);
  });

  it.todo("will unwrap children on export")
})

describe("target", () => {
  it("will register recipients", () => {
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
  })

  it("will register multiple", () => {
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
  })

  it("will callback on register", () => {
    class Child extends Model {
      parents = has(gotParent);
    }
    class Parent extends Model {
      child = has(Child);
    }
  
    const gotParent = jest.fn();
    const parent = Parent.new();
    const child = Child.new();
  
    new Context({ parent }).push({ child });

    expect(gotParent).toHaveBeenCalledWith(parent, child);
  })

  it("will callback before recipient does", () => {
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
  })

  it("will complain if used more than once", () => {
    class Child extends Model {
      parents = has();
      parents2 = has();
    }

    expect(() => Child.new()).toThrowError(
      `'has' callback can only be used once per model.`
    );
  })
})

it.todo("will require values as props if has-instruction");