import { Context } from '../context';
import { Model } from '../model';
import { has } from './has';

describe("single", () => {
  it("will register child", async () => {
    class Child extends Model {}
    class Parent extends Model {
      child = has(Child, true);
    }
  
    const parent = Parent.new();
    const context = new Context(parent).push(Child);

    expect(parent.child).toBeInstanceOf(Child);

    context.pop();
  })

  it("will suspend if not registered", async () => {
    class Child extends Model {}
    class Parent extends Model {
      child = has(Child, true);
    }
  
    const parent = Parent.new();
    const childEffect = jest.fn((current: Parent) => {
      expect<Child>(current.child).toBeInstanceOf(Child);
    });

    parent.get(childEffect);

    expect(childEffect).toHaveBeenCalled();
    expect(childEffect).not.toHaveReturned();

    new Context(parent).push(Child);

    await expect(parent).toHaveUpdated();

    expect(childEffect).toBeCalledTimes(2);
    expect(childEffect).toHaveReturned();
  });

  it("will not suspend if optional", async () => {
    class Child extends Model {}
    class Parent extends Model {
      child = has(Child, false);
    }
  
    const parent = Parent.new();
    const childEffect = jest.fn<void, [Child | undefined]>();

    parent.get(({ child }) => childEffect(child));

    expect(childEffect).toBeCalledTimes(1);
    expect(childEffect).toHaveBeenCalledWith(undefined);

    new Context(parent).push(Child);

    await expect(parent).toHaveUpdated();

    expect(childEffect).toBeCalledTimes(2);
    expect(childEffect).toHaveBeenCalledWith(expect.any(Child));
  });

  it("will replace child value", async () => {
    class Child extends Model {
      value = 0;
    }
    class Parent extends Model {
      child = has(Child, true);
    }

    const parent = Parent.new();
    const context = new Context(parent).push();

    context.include(Child.new({ value: 1 }));
    expect(parent.child.value).toBe(1);

    context.include(Child.new({ value: 2 }));
    expect(parent.child.value).toBe(2);
  })

  it("will register own type", async () => {
    class Test extends Model {
      child = has(Test, false);
    }

    const test = Test.new();
    const test2 = Test.new();
    const test3 = Test.new();

    new Context(test).push(test2).push(test3);

    expect(test.child).toBe(test2);
    expect(test2.child).toBe(test3);
  })

  it("will register implicit", () => {
    class Baz extends Model {}
    class Foo extends Model {
      bar = new Bar();
    }
    class Bar extends Model {
      baz = has(Baz, true);
    }
  
    const foo = Foo.new();
  
    new Context(foo).push(Baz);

    expect(foo.bar.baz).toBeInstanceOf(Baz);
  });

  it("will register for implicit", () => {
    class Baz extends Model {}
    class Foo extends Model {
      baz = has(Baz, false);
    }
    class Bar extends Model {
      baz = new Baz();
    }
  
    const foo = Foo.new();
  
    new Context(foo).push(Bar);

    expect(foo.baz).toBeInstanceOf(Baz);
  });
})

describe("collection", () => {
  it("will register child", () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child);
    }
  
    const parent = Parent.new();
  
    new Context(parent).push(Child);

    expect(Array.from(parent.children)).toEqual([
      expect.any(Child)
    ]);
  })
  
  it("will run callback on register", () => {
    class Child extends Model {}
    class Parent extends Model {
      child = has(Child, gotChild);
    }
  
    const gotChild = jest.fn();
    const parent = Parent.new();
  
    new Context(parent).push(Child);
    expect(gotChild).toHaveBeenCalledWith(expect.any(Child));
  })
  
  it("will register multiple children", () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child, hasChild);
    }
  
    const hasChild = jest.fn();
    const parent = Parent.new();

    new Context(parent).push({
      child1: new Child(),
      child2: new Child()
    });

    expect(hasChild).toHaveBeenCalledTimes(2);
    expect(Array.from(parent.children)).toEqual([
      expect.any(Child),
      expect.any(Child)
    ]);
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
    const context = new Context(parent).push();

    const remove1 = context.has(new Child())!;
    const remove2 = context.has(new Child())!;
  
    expect(didAddChild).toHaveBeenCalledTimes(2);
    expect(Array.from(parent.children)).toEqual([
      expect.any(Child),
      expect.any(Child)
    ]);

    remove1();
    remove2();
  
    await expect(parent).toHaveUpdated();
  
    const remove3 = context.has(new Child())!;
  
    expect(didRemove).toHaveBeenCalledTimes(2);
    expect(Array.from(parent.children)).toEqual([
      expect.any(Child)
    ]);
  
    await expect(parent).toHaveUpdated();
    expect(didRemove).toHaveBeenCalledTimes(2);

    remove3();
  })
  
  it("will not register if returns false", async () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child, hasChild);
    }
  
    const hasChild = jest.fn(() => false);
    const parent = Parent.new();
    const context = new Context(parent);

    context.has(new Child());
    context.has(new Child());
    
    expect(hasChild).toHaveBeenCalledTimes(2);
    expect(parent.children.size).toBe(0);

    context.has(new Child());
  
    await expect(parent).not.toUpdate();
    expect(hasChild).toHaveBeenCalledTimes(3);
    expect(parent.children.size).toBe(0);
  });

  it("will ignore redundant child", async () => {
    class Child extends Model {}
    class Parent extends Model {
      child = has(Child, gotChild);
    }
  
    const gotChild = jest.fn();
    const parent = Parent.new();
    const child = Child.new();

    const context = new Context(parent);

    context.has(child);
    context.has(child);

    expect(gotChild).toHaveBeenCalledTimes(1);
  })

  it.todo("will unwrap children on export")
})

it.todo("will require values as props if has-instruction");