import { add, Control, Oops } from './control';
import { mockPromise } from './helper/testing';
import { Model } from './model';

describe("child models", () => {
  it('will subscribe', async () => {
    class Parent extends Model {
      value = "foo";
      empty = undefined;
      child = new Child();
    }
  
    class Child extends Model {
      value = "foo"
      grandchild = new GrandChild();
    }
  
    class GrandChild extends Model {
      value = "bar"
    }
  
    const parent = Parent.new();
    const effect = jest.fn();
    let promise = mockPromise();
  
    parent.get(state => {
      const { child } = state;
      const { grandchild } = child;
  
      effect(child.value, grandchild.value);
      promise.resolve();
    })
  
    expect(effect).toBeCalledWith("foo", "bar");
    effect.mockClear();
  
    promise = mockPromise();
    parent.child.value = "bar";
    await promise;
    
    expect(effect).toBeCalledWith("bar", "bar");
    effect.mockClear();
  
    promise = mockPromise();
    parent.child = new Child();
    await promise;
    
    expect(effect).toBeCalledWith("foo", "bar");
    effect.mockClear();
  
    promise = mockPromise();
    parent.child.value = "bar";
    await promise;
    
    expect(effect).toBeCalledWith("bar", "bar");
    effect.mockClear();
  
    promise = mockPromise();
    parent.child.grandchild.value = "foo";
    await promise;
    
    expect(effect).toBeCalledWith("bar", "foo");
    effect.mockClear();
  });
  
  it('will only assign matching model', () => {
    class Child extends Model {}
    class Unrelated extends Model {};
    class Parent extends Model {
      child = new Child();
    }
  
    const parent = Parent.new("ID");
  
    expect(() => {
      parent.child = Unrelated.new("ID");
    }).toThrowError(
      Oops.BadAssignment(`Parent-ID.child`, `Child`, "Unrelated-ID")
    );
  
    expect(() => {
      // @ts-expect-error
      parent.child = undefined;
    }).toThrowError(
      Oops.BadAssignment(`Parent-ID.child`, `Child`, `undefined`)
    );
  })
});

describe("instruction", () => {
  class Test extends Model {
    didRunInstruction = jest.fn();
    didRunGetter = jest.fn();

    property = add((key) => {
      this.didRunInstruction(key);

      return () => {
        this.didRunGetter(key);
      }
    })
  }

  it("will use symbol as placeholder", () => {
    const { property } = new Test();
    const { description } = property as any;

    expect(typeof property).toBe("symbol");
    expect(description).toBe("instruction");
  })

  it("will run instruction on create", () => {
    const { didRunInstruction: ran } = Test.new();

    expect(ran).toBeCalledWith("property");
  })

  it("will run instruction getter upon access", async () => {
    const instance = Test.new();
    const ran = instance.didRunGetter;

    instance.get($ => void $.property);

    expect(ran).toBeCalledWith("property");

    void instance.property;

    expect(ran).toBeCalledTimes(2);
  })

  it("will ignore normal symbol", () => {
    class Test extends Model {
      value = Symbol("hello");
    }
    
    const test = Test.new();

    expect(typeof test.value).toBe("symbol");
  })

  it("will prevent update if instruction returns false", async () => {
    const didSetValue = jest.fn((newValue) => {
      if(newValue == "ignore")
        return false;
    });

    class Test extends Model {
      property = add(() => {
        return {
          value: "foobar",
          set: didSetValue
        }
      })
    }

    const test = Test.new();

    expect(test.property).toBe("foobar");

    test.property = "test";
    expect(didSetValue).toBeCalledWith("test");
    expect(test.property).toBe("test");
    await expect(test).toUpdate();

    test.property = "ignore";
    expect(didSetValue).toBeCalledWith("ignore");
    expect(test.property).toBe("test");
    await expect(test).not.toUpdate();
  })

  it("will delegate value if returns boolean", async () => {
    let shouldUpdate = true;

    class Test extends Model {
      property = add((key, control) => {
        return {
          value: 0,
          set: (value: any) => {
            control.state[key] = value + 10;
            return shouldUpdate;
          }
        }
      })
    }

    const instance = Test.new();

    expect(instance.property).toBe(0);

    instance.property = 10;
    expect(instance.property).toBe(20);
    await expect(instance).toUpdate();

    shouldUpdate = false;
    instance.property = 0;
    expect(instance.property).toBe(10);
    await expect(instance).not.toUpdate();
  })

  it("will run getter upon access", () => {
    const mockAccess = jest.fn((_subscriber) => "foobar");
    const mockApply = jest.fn((_key) => mockAccess);

    class Test extends Model {
      property = add(mockApply);
    }

    const instance = Test.new();

    expect(mockApply).toBeCalledWith(
      "property", expect.any(Control)
    );
    expect(mockAccess).not.toBeCalled();
    expect(instance.property).toBe("foobar");
    expect(mockAccess).toBeCalledWith(instance);
  })

  it("will pass subscriber if within one", () => {
    const didGetValue = jest.fn();

    class Test extends Model {
      property = add(() => didGetValue)
    }

    const state = Test.new();

    state.get(own => {
      void own.property;
    });

    expect(didGetValue).toBeCalledWith(state);
  });
})

it("will call dispatch callbacks", async () => {
  const didUpdate = jest.fn();
  const willUpdate = jest.fn();
  
  const remove = Control.on("update", willUpdate);
  const removeDid = Control.on("didUpdate", didUpdate);

  class Test extends Model {
    value = 1;
  }

  const test = Test.new();

  test.value += 1;
  await expect(test).toUpdate();

  expect(willUpdate).toBeCalledTimes(1);
  expect(didUpdate).toBeCalledTimes(1);

  remove();
  removeDid();
})

it("will call create callbacks", () => {
  class Test extends Model {}

  const didCreate = jest.fn((control: Control) => {
    expect(control.subject).toBeInstanceOf(Test);
  });

  const remove = Control.on("ready", didCreate);

  Test.new();
  
  expect(didCreate).toBeCalled();

  remove();
})

it("will run effect after properties", () => {
  const mock = jest.fn();

  class Test extends Model {
    property = add((_key, control) => {
      this.get(() => {
        mock(control.state);
      })
    })

    foo = 1;
    bar = 2;
  }

  Test.new();

  expect(mock).toBeCalledWith({
    foo: 1,
    bar: 2
  });
})