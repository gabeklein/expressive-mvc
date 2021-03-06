import { Oops } from "../src/compute";
import { Model, use } from "./adapter";

const { error, warn } = console;

afterAll(() => {
  console.warn = warn;
  console.error = error;
});

describe("computed", () => {
  class Child extends Model {
    value = "foo";
  }

  class Subject extends Model {
    child = use(Child);
    seconds = 0;
  
    get minutes(){
      return Math.floor(this.seconds / 60)
    }

    get nested(){
      return this.child.value;
    }
  }
  
  it('will trigger when input changes', async () => {
    const state = Subject.create();
  
    state.seconds = 30;
  
    await state.requestUpdate(true);
  
    expect(state.seconds).toEqual(30);
    expect(state.minutes).toEqual(0);
  
    await state.requestUpdate(false);
    
    state.seconds = 60;
  
    await state.requestUpdate(true);
  
    expect(state.seconds).toEqual(60);
    expect(state.minutes).toEqual(1);
  })

  it('will trigger when nested input changes', async () => {
    const state = Subject.create();

    expect(state.nested).toBe("foo");
  
    state.child.value = "bar";
    await state.requestUpdate(true);

    expect(state.nested).toBe("bar");

    state.child = new Child();
    await state.requestUpdate(true);

    expect(state.nested).toBe("foo");
  })

  it('will compute immediately if expected', () => {
    const mock = jest.fn();

    class Test extends Subject {
      constructor(){
        super();
        this.on("minutes", mock);
      }
    }

    Test.create();
  })

  it('will squash multiple-input updates', async () => {
    const exec = jest.fn();
    const emit = jest.fn();

    class Inner extends Model {
      value = 1;
    }

    class Test extends Model {
      a = 1;
      b = 1;

      // make sure multi-source updates work
      x = use(Inner);

      get c(){
        exec();
        return this.a + this.b + this.x.value;
      }
    }

    const state = Test.create();

    expect(state.c).toBe(3);
    expect(exec).toBeCalledTimes(1);

    state.on("c", emit);

    state.a++;
    state.b++;
    state.x.value++;

    await state.requestUpdate(true);

    expect(exec).toBeCalledTimes(2);
    expect(emit).toBeCalledTimes(1);
  })

  it("will be evaluated in order", async () => {
    let didCompute: string[] = [];

    class Ordered extends Model {
      X = 1;
  
      get A(){
        const value = this.X
        didCompute.push("A")
        return value;
      };
      get B(){
        const value = this.A + 1
        didCompute.push("B")
        return value;
      };
      get C(){
        const value = this.X + this.B + 1
        didCompute.push("C")
        return value;
      };
      get D(){
        const value = this.A + this.C + 1
        didCompute.push("D")
        return value;
      };
    }

    const test = Ordered.create();

    // initialize D, should cascade to dependancies
    expect(test.D).toBe(6);
    await test.requestUpdate();

    // should evaluate in order, by use
    expect(didCompute).toMatchObject(["A", "B", "C", "D"]);

    // empty computed
    didCompute = [];

    // change value of X, will trigger A & C;
    test.X = 2;
    const updated = await test.requestUpdate();

    // should evaluate by prioritiy
    expect(didCompute).toMatchObject(["A", "B", "C", "D"]);
    expect(updated).toMatchObject(["X", "A", "B", "C", "D"]);
  })

  it("will not override existing setter", async () => {
    class Test extends Model {
      value = "foo";
      didSet = jest.fn();

      get something(){
        return this.value;
      }

      set something(x){
        this.didSet(x);
      }
    }

    const test = Test.create();

    expect(test.value).toBe("foo");
    test.value = "bar";

    await test.requestUpdate(true);
    expect(test.value).toBe("bar");

    test.something = "foobar";
    expect(test.didSet).toBeCalledWith("foobar");
  })
})

describe("failures", () => {
  class Subject extends Model {
    get never(){
      throw new Error();
    }
  }

  it('will warn if throws', () => {
    const state = Subject.create();
    const attempt = () => state.never;

    const warn = console.warn = jest.fn();
    const failed = Oops.ComputeFailed(Subject.name, "never", true);

    expect(attempt).toThrowError();
    expect(warn).toBeCalledWith(failed.message);
  })

  it('will warn if throws early', () => {
    const state = Subject.create();
    const attempt = () => state.once("never");

    const warn = console.warn = jest.fn();
    const failed = Oops.ComputeFailed(Subject.name, "never", true);
    const early = Oops.ComputedEarly("never");

    expect(attempt).rejects.toThrowError();
    expect(warn).toBeCalledWith(failed.message);
    expect(warn).toBeCalledWith(early.message);
  })

  it('will warn if throws on update', async () => {
    class Test extends Model {
      shouldFail = false;

      get value(){
        if(this.shouldFail)
          throw new Error();
        else
          return undefined;
      }
    }

    const warn = console.warn = jest.fn();
    const error = console.error = jest.fn();
    const state = Test.create();
    const failed = Oops.ComputeFailed(Test.name, "value", false);

    state.once(x => x.value);
    state.shouldFail = true;

    await state.requestUpdate(true);

    expect(warn).toBeCalledWith(failed.message);
    expect(error).toBeCalled();
  })
})

describe("circular", () => {
  it("may access own previous value", async () => {
    class Test extends Model {
      multiplier = 0;
      previous: any;

      get value(): number {
        const { value, multiplier } = this;

        // use set to bypass subscriber
        this.set.previous = value;

        return Math.ceil(Math.random() * 10) * multiplier;
      }
    }

    const test = Test.create();

    // shouldn't exist until getter's side-effect
    expect("previous" in test).toBe(false);

    const initial = test.value;

    // will start at 0 because of multiple
    expect(initial).toBe(0);

    // should now exist but be undefined (initial get)
    expect("previous" in test).toBe(true);
    expect(test.previous).toBeUndefined();

    // change upstream value to trigger re-compute
    test.multiplier = 1;
    await test.requestUpdate(true);

    // getter should see current value while producing new one
    expect(test.previous).toBe(initial);
    expect(test.value).not.toBe(initial);
  })

  it.skip("may cause its own update", async () => {
    class Test extends Model {
      value = 0;
      isEven = true;
  
      get format(){
        const { value, isEven } = this;
        const parity = isEven ? "even" : "odd";
        const quote = `Value ${value} is ${parity}`;
  
        this.isEven = value % 1 == 0;
        
        return quote;
      }
    }

    const test = Test.create();

    expect(test.format).toBe("Value 0 is even");
    test.value++;
    await test.requestUpdate();
    expect(test.format).toBe("Value 1 is odd");
  })
})