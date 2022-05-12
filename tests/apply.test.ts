import { apply, Model } from '../src';
import { Controller } from '../src/Controller';
import { STATE } from '../src/model';
import { Subscriber } from '../src/subscriber';

describe("apply", () => {
  class Test extends Model {
    didRunInstruction = jest.fn();
    didRunGetter = jest.fn();

    property = apply((key) => {
      this.didRunInstruction(key);

      return () => {
        this.didRunGetter(key);
      }
    })

    keyedInstruction = apply(function foo(){});
    namedInstruction = apply(() => {}, "foo");
  }

  it("will use symbol as placeholder", () => {
    const { property } = new Test();
    const { description } = property as any;

    expect(typeof property).toBe("symbol");
    expect(description).toBe("pending instruction");
  })

  it("will give placeholder custom name", () => {
    const { keyedInstruction } = new Test();
    const { description } = keyedInstruction as any;

    expect(description).toBe("foo instruction");
  })

  it("will give placeholder custom name", () => {
    const { namedInstruction } = new Test();
    const { description } = namedInstruction as any;

    expect(description).toBe("foo instruction");
  })

  it("will run instruction on create", () => {
    const { didRunInstruction: ran } = Test.create();

    expect(ran).toBeCalledWith("property");
  })

  it("will run instruction getter upon access", async () => {
    const instance = Test.create();
    const ran = instance.didRunGetter;

    instance.effect(x => void x.property);
    
    expect(ran).toBeCalledWith("property");
    
    void instance.property;

    expect(ran).toBeCalledTimes(2);
  })
})

describe("getter", () => {
  it("will run instruction on access", () => {
    const mockAccess = jest.fn((_value, _subscriber) => "foobar");
    const mockApply = jest.fn((_key) => mockAccess);

    class Test extends Model {
      property = apply(mockApply);
    }

    const instance = Test.create();
    
    expect(mockApply).toBeCalledWith(
      "property", expect.any(Controller)
    );
    expect(mockAccess).not.toBeCalled();
    expect(instance.property).toBe("foobar");
    expect(mockAccess).toBeCalledWith(undefined);
  })

  it("will pass subscriber if within one", () => {
    const didGetValue = jest.fn();

    class Test extends Model {
      property = apply(() => didGetValue)
    }

    const state = Test.create();

    state.effect(own => {
      void own.property;
    });

    expect(didGetValue).toBeCalledWith(
      undefined, expect.any(Subscriber)
    );
  });

  it("will implement setter by default", async () => {
    const mockAccess = jest.fn(value => value);

    class Test extends Model {
      property = apply(() => mockAccess);
    }

    const state = Test.create();

    expect(state.property).toBe(undefined);
    expect(mockAccess).toBeCalledWith(undefined);

    state.property = "foo";

    expect(state.property).toBe("foo");
    expect(mockAccess).toBeCalledTimes(2);
    expect(mockAccess).toBeCalledWith("foo");
  });
})

describe("custom", () => {
  it("will prevent update if instruction returns false", async () => {
    const didSetValue = jest.fn((newValue) => {
      if(newValue == "ignore")
        return false;
    });

    class Test extends Model {
      property = apply(() => {
        return {
          value: "foobar",
          set: didSetValue
        }
      })
    }

    const instance = Test.create();
    const state = instance[STATE];

    expect(instance.property).toBe("foobar");
    
    instance.property = "test";
    expect(didSetValue).toBeCalledWith("test", state);
    expect(instance.property).toBe("test");
    await instance.update(true);

    instance.property = "ignore";
    expect(didSetValue).toBeCalledWith("ignore", state);
    expect(instance.property).toBe("test");
    await instance.update(false);
  })

  it("will delegate value if returns boolean", async () => {
    let shouldUpdate = true;
  
    class Test extends Model {
      property = apply(key => {
        return {
          value: 0,
          set: (value, state) => {
            state[key] = value + 10;
            return shouldUpdate;
          }
        }
      })
    }

    const instance = Test.create();

    expect(instance.property).toBe(0);
    
    instance.property = 10;
    expect(instance.property).toBe(20);
    await instance.update(true);

    shouldUpdate = false;
    instance.property = 0;
    expect(instance.property).toBe(10);
    await instance.update(false);
  })
})