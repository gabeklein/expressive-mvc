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
    const didAddChild = jest.fn(() => didRemove);
  
    class Child extends Model {
      value = 0;
    }
    class Parent extends Model {
      children = has(Child, didAddChild);
    }
  
    const parent = Parent.new();
    const context = new Context({ parent }).push();

    const child1 = Child.new();
    const child2 = Child.new();

    const remove1 = context.has(child1)!;
    const remove2 = context.has(child2)!;
  
    expect(didAddChild).toHaveBeenCalledTimes(2);
    expect(parent.children).toEqual([child1, child2]);

    remove1();
  
    await expect(parent).toHaveUpdated();
  
    const child3 = Child.new();
    const remove3 = context.has(child3)!;
  
    expect(didRemove).toHaveBeenCalledTimes(1);
    expect(parent.children).toEqual([
      child2,
      child3
    ]);

    remove2();
    remove3();
  
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

    context.has(new Child());
    context.has(new Child());
    
    expect(hasChild).toHaveBeenCalledTimes(2);
    expect(parent.children.length).toBe(0);

    context.has(new Child());
  
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

    const context = new Context({ parent });

    context.has(child);
    context.has(child);

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
      child = has(Child, true);
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
      child = has(Child, true);
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
})

it.todo("will require values as props if has-instruction");