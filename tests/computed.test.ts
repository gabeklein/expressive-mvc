import Controller, { def } from "./adapter";

describe("ordered computed", () => {
  let computed: string[];
  beforeEach(() => computed = []);

  class Test extends Controller {
    X = 1;

    get A(){
      const value = this.X 
      computed.push("A")
      return value;
    };
    get B(){
      const value = this.A + 1 
      computed.push("B")
      return value;
    };
    get C(){
      const value = this.X + this.B + 1
      computed.push("C")
      return value;
    };
    get D(){
      const value = this.A + this.C + 1
      computed.push("D")
      return value;
    };
  }

  it("computed values are evaluated in-order", async () => {
    const test = Test.create();

    // initialize D, should cascade to dependants
    expect(test.D).toBe(6);
    await test.requestUpdate();
    // should evaluate in order, by use
    expect(computed).toMatchObject(["A", "B", "C", "D"]);

    // empty computed
    computed = [];

    // change value of X, will trigger A & C;
    test.X = 2;
    const updated = await test.requestUpdate();

    // should evaluate by prioritiy
    expect(computed).toMatchObject(["A", "B", "C", "D"]);
    expect(updated).toMatchObject(["X", "A", "B", "C", "D"]);
  })
})

describe("reference computed", () => {
  class Test extends Controller {
    multiplier = 0;
    previous: any;

    get value(): number {
      const { value, multiplier } = this;

      // use set to bypass subscriber
      this.set.previous = value;

      return Math.ceil(Math.random() * 10) * multiplier;
    }
  }

  test("computed may access own previous value", async () => {
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
  class Test extends Controller {
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

  it("getter may cause its own update", async () => {
    const test = Test.create();

    expect(test.format).toBe("Value 0 is even");
    test.value++;
    await test.requestUpdate();
    expect(test.format).toBe("Value 1 is odd");
  })
})

