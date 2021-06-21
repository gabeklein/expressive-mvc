import { Model, use } from "./adapter";

describe("computed", () => {
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

  class Child extends Model {
    value = "foo";
  }
  
  it('will trigger compute when input value changes', async () => {
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

  it('will trigger compute when nested value changes', async () => {
    const state = Subject.create();

    expect(state.nested).toBe("foo");
  
    state.child.value = "bar";
    await state.requestUpdate(true);

    expect(state.nested).toBe("bar");

    state.child = new Child();
    await state.requestUpdate(true);

    expect(state.nested).toBe("foo");
  })
})

describe("co-dependant computed", () => {
  let didCompute: string[];

  beforeEach(() => didCompute = []);

  class Test extends Model {
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

  it("will be evaluated in order", async () => {
    const test = Test.create();

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
})

describe("circular computed", () => {
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

  it("may access own previous value", async () => {
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
})

describe.skip("recursive computed", () => {
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

  it("may cause its own update", async () => {
    const test = Test.create();

    expect(test.format).toBe("Value 0 is even");
    test.value++;
    await test.requestUpdate();
    expect(test.format).toBe("Value 1 is odd");
  })
})