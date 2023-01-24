import { mockConsole } from '../helper/testing';
import { Model } from '../model';
import { get, Oops as Compute } from './get';
import { use } from './use';

class Child extends Model {
  value = "foo";
}

class Subject extends Model {
  child = use(Child);
  seconds = 0;

  minutes = get(this, state => {
    return Math.floor(state.seconds / 60);
  })

  nested = get(this, state => {
    return state.child.value;
  })
}

it.todo("will add pending compute to frame immediately");

it('will reevaluate when inputs change', async () => {
  const state = Subject.new();

  state.seconds = 30;

  await state.on(true);

  expect(state.seconds).toEqual(30);
  expect(state.minutes).toEqual(0);

  await state.on(null);

  state.seconds = 60;

  await state.on(true);

  expect(state.seconds).toEqual(60);
  expect(state.minutes).toEqual(1);
})

it('will trigger when nested inputs change', async () => {
  const state = Subject.new();

  expect(state.nested).toBe("foo");

  state.child.value = "bar";
  await state.on(true);

  expect(state.nested).toBe("bar");

  state.child = new Child();
  await state.on(true);

  // sanity check
  expect(state.child.value).toBe("foo");
  expect(state.nested).toBe("foo");
})

it('will compute immediately if needed', () => {
  const mockFactory = jest.fn(() => "foobar");

  class Test extends Model {
    value = get(() => mockFactory);

    constructor(){
      super();
      this.on("value", () => {});
    }
  }

  const test = Test.new();

  expect(mockFactory).toBeCalled();
  expect(test.value).toBe("foobar");
})

it("will compute immediately if exported", () => {
  const mockFactory = jest.fn(() => "foobar");

  class Test extends Model {
    value = get(() => mockFactory);

    constructor(){
      super();
      this.on("value", () => {});
    }
  }

  const test = Test.new();
  const values = test.get();

  expect(mockFactory).toBeCalled();
  expect(values.value).toBe("foobar");
})

it("will compute early if value is accessed", async () => {
  class Test extends Model {
    number = 0;
    plusOne = get(this, state => {
      const value = state.number + 1;
      didCompute(value);
      return value;
    });
  }

  const didCompute = jest.fn();
  const test = Test.new();

  expect(test.plusOne).toBe(1);

  test.number++;

  // not accessed; compute will wait for frame
  expect(didCompute).not.toBeCalledWith(2)

  // does compute eventually
  await test.on(true);
  expect(didCompute).toBeCalledWith(2)
  expect(test.plusOne).toBe(2);

  test.number++;

  // sanity check
  expect(didCompute).not.toBeCalledWith(3);

  // accessing value now will force compute
  expect(test.plusOne).toBe(3);
  expect(didCompute).toBeCalledWith(3);

  // update should still occur
  await test.on(true);
})

it('will be squashed with regular updates', async () => {
  const exec = jest.fn();
  const emit = jest.fn();

  class Inner extends Model {
    value = 1;
  }

  class Test extends Model {
    a = 1;
    b = 1;

    c = get(this, state => {
      exec();
      return state.a + state.b + state.x.value;
    })

    // sanity check; multi-source updates do work
    x = use(Inner);
  }

  const state = Test.new();

  expect(state.c).toBe(3);
  expect(exec).toBeCalledTimes(1);

  state.on("c", emit);

  state.a++;
  state.b++;
  state.x.value++;

  await state.on(true);

  expect(exec).toBeCalledTimes(2);
  expect(emit).toBeCalledTimes(1);
})

it("will be evaluated in order", async () => {
  let didCompute: string[] = [];

  class Ordered extends Model {
    X = 1;

    A = get(this, state => {
      const value = state.X
      didCompute.push("A")
      return value;
    })

    B = get(this, state => {
      const value = state.A + 1
      didCompute.push("B")
      return value;
    })

    C = get(this, state => {
      const value = state.X + state.B + 1
      didCompute.push("C")
      return value;
    })

    D = get(this, state => {
      const value = state.A + state.C + 1
      didCompute.push("D")
      return value;
    })
  }

  const test = Ordered.new();

  // initialize D, should cascade to dependancies
  expect(test.D).toBe(6);

  // should evaluate in order, by use
  expect(didCompute).toMatchObject(["A", "B", "C", "D"]);

  // empty computed
  didCompute = [];

  // change value of X, will trigger A & C;
  test.X = 2;
  const updated = await test.on(true);

  // should evaluate by prioritiy
  expect(didCompute).toMatchObject(["A", "B", "C", "D"]);
  expect(updated).toMatchObject(["X", "A", "B", "C", "D"]);
})

it("will create a computed from method", async () => {
  class Hello extends Model {
    friend = "World";

    greeting = get(() => this.generateGreeting);

    generateGreeting(){
      return `Hello ${this.friend}!`;
    }
  }

  const test = Hello.new();

  expect(test.greeting).toBe("Hello World!");

  test.friend = "Foo";
  await test.on(true);

  expect(test.greeting).toBe("Hello Foo!");
})

describe("failures", () => {
  const { warn, error } = mockConsole();

  class Subject extends Model {
    never = get(this, () => {
      throw new Error();
    })
  }

  it('will warn if throws', () => {
    const state = Subject.new();
    const attempt = () => state.never;

    const failed = Compute.Failed(Subject.name, "never", true);

    expect(attempt).toThrowError();
    expect(warn).toBeCalledWith(failed.message);
  })

  it('will warn if throws on update', async () => {
    class Test extends Model {
      shouldFail = false;

      value = get(this, state => {
        if(state.shouldFail)
          throw new Error();
        else
          return undefined;
      })
    }

    const state = Test.new();
    const failed = Compute.Failed(Test.name, "value", false);

    state.on("value");
    state.shouldFail = true;

    await state.on(true);

    expect(warn).toBeCalledWith(failed.message);
    expect(error).toBeCalled();
  })

  it('will throw if source is another instruction', () => {
    class Peer extends Model {
      value = 1;
    }

    class Test extends Model {
      peer = use(Peer);
      value = get(this.peer, () => {});
    }

    const expected = Compute.PeerNotAllowed("Test", "value");

    expect(() => Test.new()).toThrow(expected);
  })
})

describe("circular", () => {
  it("will access own previous value", async () => {
    class Test extends Model {
      multiplier = 0;
      previous: any;

      value = get(this, state => {
        const { value, multiplier } = state;

        // use set to bypass subscriber
        this.previous = value;

        return Math.ceil(Math.random() * 10) * multiplier;
      });
    }

    const test = Test.new();

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
    await test.on(true);

    // getter should see current value while producing new one
    expect(test.previous).toBe(initial);
    expect(test.value).not.toBe(initial);
  })

  it("will not trigger itself", async () => {
    class Test extends Model {
      input = 1;
      value = get(() => this.computeValue);
  
      computeValue(){
        const { input, value } = this;
  
        didGetOldValue(value);
  
        return input + 1;
      }
    }
  
    const didGetOldValue = jest.fn();
    const didGetNewValue = jest.fn();
  
    const test = Test.new();
  
    test.on(state => {
      didGetNewValue(state.value);
    })
  
    expect(test.value).toBe(2);
    expect(didGetNewValue).toBeCalledWith(2);
    expect(didGetOldValue).toBeCalledWith(undefined);
  
    test.input = 2;
  
    expect(test.value).toBe(3);
    expect(didGetOldValue).toBeCalledWith(2);
  
    await test.on(true);
    expect(didGetNewValue).toBeCalledWith(3);
    expect(didGetOldValue).toBeCalledTimes(2);
  })
})

describe("method", () => {
  class Test extends Model {
    foo = 1;
    bar = get(() => this.getBar);

    getBar(){
      return 1 + this.foo;
    }
  }

  it("will create computed via factory", async () => {
    const test = Test.new();

    expect(test.bar).toBe(2);

    test.foo++;

    await test.on(true);
    expect(test.bar).toBe(3);
  })

  it("will use top-most method of class", () => {
    class Extended extends Test {
      getBar(){
        return 2 + this.foo;
      }
    }

    const test = Extended.new();

    expect(test.bar).toBe(3);
  })

  it("will provide property key to factory", () => {
    class Test extends Model {
      fooBar = get((key) => () => key);
    }

    const test = Test.new();

    expect(test.fooBar).toBe("fooBar");
  })

  // it("will throw if factory resembles a class", () => {
  //   function Factory(){
  //     return () => "foobar";
  //   }

  //   class Test extends Model {
  //     value = get(Factory);
  //   }

  //   const expected = Compute.BadSource("Test", "value", Factory);

  //   expect(() => Test.new()).toThrow(expected);
  // })
})

/* Feature is temporarily removed - evaluating usefulness.
describe("external", () => {
  class Peer extends Global {
    value = 1;
  }

  afterEach(() => Peer.reset());

  it('will accept source other than \'this\'', async () => {
    const peer = Peer.new();

    class Test extends Model {
      value = from(peer, state => state.value + 1);
    }

    const test = Test.new();

    expect(test.value).toBe(2);

    peer.value = 2;

    await test.on(true);

    expect(test.value).toBe(3);
  });

  it('will accept Model in-context as source', () => {
    class Peer extends Model {
      value = 1;
    }

    class Test extends Model {
      value = from(Peer, state => state.value + 1);
    }

    const Component = () => {
      const test = Test.use();

      expect(test.value).toBe(2);
      return null;
    }

    render(
      <Provider for={Peer}>
        <Component />
      </Provider>
    );
  })

  it('will accept Global as source', () => {
    Peer.new();

    class Test extends Model {
      value = from(Peer, state => state.value + 1);
    }

    const test = Test.new();

    expect(test.value).toBe(2);
  })
})
*/