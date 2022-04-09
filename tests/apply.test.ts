import { Subscriber } from '../src/subscriber';
import { Controller } from '../src/Controller';
import { apply, Model } from './adapter';

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
    expect(mockAccess).toBeCalledWith(undefined, undefined);
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
})

describe("custom", () => {
  function managed<T>(
    value: T, update: (next: T, state: any) => boolean | void){

    return apply<T>(
      function manage(key){
        this.manage(key, value, (next) => update(next, this.state));
      }
    )
  }

  it("will prevent update if instruction returns false", async () => {
    class Test extends Model {
      property = managed(false, (value, state) => {
        // register instruction did run
        instruction(value);
        // set value to state manually
        state.property = value;
        // block update if value is set to false
        return value === true;
      });
    }

    const instance = Test.create();
    const instruction = jest.fn();

    expect(instance.property).toBe(false);
    
    instance.property = true;
    expect(instruction).toBeCalledWith(true);

    // expect update event
    await instance.update(true);
    expect(instance.property).toBe(true);

    instance.property = false;
    expect(instruction).toBeCalledWith(false);
    
    // update should be prevented
    await instance.update(false);
    expect(instance.property).toBe(false);
  })

  it("will delegate set-value if returns boolean", async () => {
    class Test extends Model {
      property = managed<boolean | number>(false, (value, state) => {
        // register instruction did run
        instruction(value);
        // set the value manually to some number
        state.property = Math.random();
        // block update if value was set to false
        return value === true;
      });
    }

    const instance = Test.create();
    const instruction = jest.fn();

    expect(instance.property).toBe(false);
    
    instance.property = true;
    expect(instruction).toBeCalledWith(true);
    await instance.update(true);
    // instruction overrode incoming value 
    expect(typeof instance.property).toBe("number");

    instance.property = false;
    expect(instruction).toBeCalledWith(false);
    await instance.update(false);
    expect(typeof instance.property).toBe("number");
  })
})