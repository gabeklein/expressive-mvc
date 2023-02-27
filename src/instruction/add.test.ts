import { add, Model } from '..';
import { Control } from '../control';
import { Subscriber } from '../subscriber';

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

    keyedInstruction = add(function foo(){});
    namedInstruction = add(() => {}, "foo");
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
    const { didRunInstruction: ran } = Test.new();

    expect(ran).toBeCalledWith("property");
  })

  it("will run instruction getter upon access", async () => {
    const instance = Test.new();
    const ran = instance.didRunGetter;

    instance.on(x => void x.property);

    expect(ran).toBeCalledWith("property");

    void instance.property;

    expect(ran).toBeCalledTimes(2);
  })
})

describe("getter", () => {
  it("will run instruction on access", () => {
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
    expect(mockAccess).toBeCalledWith(undefined);
  })

  it("will pass subscriber if within one", () => {
    const didGetValue = jest.fn();

    class Test extends Model {
      property = add(() => didGetValue)
    }

    const state = Test.new();

    state.on(own => {
      void own.property;
    });

    expect(didGetValue).toBeCalledWith(expect.any(Subscriber));
  });
})

describe("custom", () => {
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
    await test.on(true);

    test.property = "ignore";
    expect(didSetValue).toBeCalledWith("ignore");
    expect(test.property).toBe("test");
    await test.on(null);
  })

  it("will delegate value if returns boolean", async () => {
    let shouldUpdate = true;

    class Test extends Model {
      property = add((key, control) => {
        return {
          value: 0,
          set: (value: any) => {
            control.state.set(key, value + 10);
            return shouldUpdate;
          }
        }
      })
    }

    const instance = Test.new();

    expect(instance.property).toBe(0);

    instance.property = 10;
    expect(instance.property).toBe(20);
    await instance.on(true);

    shouldUpdate = false;
    instance.property = 0;
    expect(instance.property).toBe(10);
    await instance.on(null);
  })
})