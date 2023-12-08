import React from 'react';
import { create } from 'react-test-renderer';

import Model, { has, Provider } from '.';
import { mockHook } from './mocks';

describe("single", () => {
  it("will register child", () => {
    class Child extends Model {}
    class Parent extends Model {
      child = has(Child, true);
    }
  
    const parent = Parent.new();
  
    mockHook(parent, () => Child.use());
    expect(parent.child).toBeInstanceOf(Child);
  })
  
  it.skip("will throw if already registered", () => {
    class Child extends Model {}
    class Parent extends Model {
      child = has(Child, true);
    }
  
    const parent = Parent.new("Parent-ID");
    let error!: string;
  
    mockHook(parent, () => {
      try {
        Child.use();
        Child.use();
      }
      catch(e: any){
        error = e.message;
      }
    });

    expect(error).toBe(`Tried to register new Child in Parent-ID.child but one already exists.`);
  });

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

    mockHook(parent, () => Child.use());

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

    mockHook(parent, () => Child.use());

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

    const Element = Child.as(() => null);
    const parent = Parent.new();

    const render = create(
      <Provider for={parent}>
        <Element key={1} value={1} />
      </Provider>
    )

    expect(parent.child.value).toBe(1);

    render.update(
      <Provider for={parent}>
        <Element key={2} value={2} />
      </Provider>
    )
  })
})

describe("collection", () => {
  it("will register child", () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child);
    }
  
    const parent = Parent.new();
  
    mockHook(parent, () => Child.use());
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
  
    mockHook(parent, () => Child.use());
    expect(gotChild).toHaveBeenCalledWith(expect.any(Child));
  })
  
  it("will register multiple children", () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child, hasChild);
    }
  
    const Element = Child.as(() => null);
    const hasChild = jest.fn();
    const parent = Parent.new();
    
    create(
      <Provider for={parent}>
        <Element />
        <Element />
      </Provider>
    )
  
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
  
    const Element = Child.as(() => null);
    const parent = Parent.new();
    
    const render = create(
      <Provider for={parent}>
        <Element value={1} />
        <Element value={2} />
      </Provider>
    )
  
    expect(didAddChild).toHaveBeenCalledTimes(2);
    expect(Array.from(parent.children)).toEqual([
      expect.any(Child),
      expect.any(Child)
    ]);
  
    render.update(
      <Provider for={parent}>
        <Element value={1} />
      </Provider>
    )
  
    await expect(parent).toUpdate();
  
    expect(didRemove).toHaveBeenCalledTimes(1);
    expect(Array.from(parent.children)).toEqual([
      expect.any(Child)
    ]);
  
    render.unmount();
  
    await expect(parent).toUpdate();
    expect(didRemove).toHaveBeenCalledTimes(2);
  })
  
  it("will not register if returns false", async () => {
    class Child extends Model {}
    class Parent extends Model {
      children = has(Child, hasChild);
    }
  
    const Element = Child.as(() => null);
    const hasChild = jest.fn(() => false);
    const parent = Parent.new();
    
    const render = create(
      <Provider for={parent}>
        <Element key={1} />
        <Element key={2} />
      </Provider>
    )
  
    expect(hasChild).toHaveBeenCalledTimes(2);
    expect(parent.children.size).toBe(0);
  
    render.update(
      <Provider for={parent}>
        <Element key={3} />
      </Provider>
    )
  
    await expect(parent).not.toUpdate();
    expect(hasChild).toHaveBeenCalledTimes(3);
    expect(parent.children.size).toBe(0);
  });

  it.todo("will unwrap children on export")
})

it.todo("will require values as props if has-instruction")