import { Oops } from '../src/compute';
import { Oops as Instruction } from '../src/instruction/from';
import { from, Global, Model, tap, use } from '../src';

describe("computed", () => {
  class Child extends Model {
    value = "foo";
  }

  class Subject extends Model {
    child = use(Child);
    seconds = 0;
    
    minutes = from(this, state => {
      return Math.floor(state.seconds / 60);
    })

    nested = from(this, state => {
      return state.child.value;
    })
  }
  
  it('will trigger when input changes', async () => {
    const state = Subject.create();
  
    state.seconds = 30;
  
    await state.update(true);
  
    expect(state.seconds).toEqual(30);
    expect(state.minutes).toEqual(0);
  
    await state.update(false);
    
    state.seconds = 60;
  
    await state.update(true);
  
    expect(state.seconds).toEqual(60);
    expect(state.minutes).toEqual(1);
  })

  it('will trigger when nested input changes', async () => {
    const state = Subject.create();

    expect(state.nested).toBe("foo");
  
    state.child.value = "bar";
    await state.update(true);

    expect(state.nested).toBe("bar");

    state.child = new Child();
    await state.update(true);

    // sanity check
    expect(state.child.value).toBe("foo");
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

      c = from(this, state => {
        exec();
        return state.a + state.b + state.x.value;
      })

      // make sure multi-source updates work
      x = use(Inner);
    }

    const state = Test.create();

    expect(state.c).toBe(3);
    expect(exec).toBeCalledTimes(1);

    state.on("c", emit);

    state.a++;
    state.b++;
    state.x.value++;

    await state.update(true);

    expect(exec).toBeCalledTimes(2);
    expect(emit).toBeCalledTimes(1);
  })

  it("will be evaluated in order", async () => {
    let didCompute: string[] = [];

    class Ordered extends Model {
      X = 1;

      A = from(this, state => {
        const value = state.X
        didCompute.push("A")
        return value;
      })

      B = from(this, state => {
        const value = state.A + 1
        didCompute.push("B")
        return value;
      })

      C = from(this, state => {
        const value = state.X + state.B + 1
        didCompute.push("C")
        return value;
      })

      D = from(this, state => {
        const value = state.A + state.C + 1
        didCompute.push("D")
        return value;
      })
    }

    const test = Ordered.create();

    // initialize D, should cascade to dependancies
    expect(test.D).toBe(6);
    await test.update();

    // should evaluate in order, by use
    expect(didCompute).toMatchObject(["A", "B", "C", "D"]);

    // empty computed
    didCompute = [];

    // change value of X, will trigger A & C;
    test.X = 2;
    const updated = await test.update();

    // should evaluate by prioritiy
    expect(didCompute).toMatchObject(["A", "B", "C", "D"]);
    expect(updated).toMatchObject(["X", "A", "B", "C", "D"]);
  })

  it("will create a computed from method", async () => {
    class Hello extends Model {
      friend = "World";
  
      greeting = from(() => this.generateGreeting);
  
      generateGreeting(){
        return `Hello ${this.friend}!`;
      }
    }

    const test = Hello.create();

    expect(test.greeting).toBe("Hello World!");

    test.friend = "Foo";
    await test.update(true);

    expect(test.greeting).toBe("Hello Foo!");
  })
})

describe("failures", () => {
  const { error, warn } = console;
  
  afterAll(() => {
    console.warn = warn;
    console.error = error;
  });

  class Subject extends Model {
    never = from(this, () => {
      throw new Error();
    })
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

      value = from(this, state => {
        if(state.shouldFail)
          throw new Error();
        else
          return undefined;
      })
    }

    const warn = console.warn = jest.fn();
    const error = console.error = jest.fn();
    const state = Test.create();
    const failed = Oops.ComputeFailed(Test.name, "value", false);

    state.once("value");
    state.shouldFail = true;

    await state.update(true);

    expect(warn).toBeCalledWith(failed.message);
    expect(error).toBeCalled();
  })

  it('will throw if source is another instruction', () => {
    class Peer extends Global {
      value = 1;
    }

    Peer.create();

    class Test extends Model {
      peer = tap(Peer);
      value = from(this.peer, () => {});
    }

    const expected = Instruction.PeerNotAllowed("Test", "value");

    expect(() => Test.create()).toThrow(expected);
  })
})

describe("circular", () => {
  it("may access own previous value", async () => {
    class Test extends Model {
      multiplier = 0;
      previous: any;

      value = from(this, state => {
        const { value, multiplier } = state;

        // use set to bypass subscriber
        this.previous = value;

        return Math.ceil(Math.random() * 10) * multiplier;
      });
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
    await test.update(true);

    // getter should see current value while producing new one
    expect(test.previous).toBe(initial);
    expect(test.value).not.toBe(initial);
  })
})

describe("factory", () => {
  class Test extends Model {
    foo = 1;
    bar = from(() => this.getBar);

    getBar(){
      return 1 + this.foo;
    }
  }

  it("will create computed via factory", async () => {
    const test = Test.create();

    expect(test.bar).toBe(2);

    test.foo++;

    await test.update(true);
    expect(test.bar).toBe(3);
  })

  it("will use top-most method of extended class", () => {
    class Extended extends Test {
      getBar(){
        return 2 + this.foo;
      }
    }

    const test = Extended.create();

    expect(test.bar).toBe(3);
  })

  it("will provide property key to factory", () => {
    class Test extends Model {
      fooBar = from((key) => () => key);
    }

    const test = Test.create();

    expect(test.fooBar).toBe("fooBar");
  })

  it("will throw if factory isn't an arrow function", () => {
    function factory(){
      return () => "foobar";
    }
    
    class Test extends Model {
      value = from(factory);
    }

    const expected = Instruction.BadComputedSource("Test", "value", factory);

    expect(() => Test.create()).toThrow(expected);
  })
})

// describe("external", () => {
//   class Peer extends Global {
//     value = 1;
//   }

//   afterEach(() => Peer.reset());

//   it('will accept source other than \'this\'', async () => {
//     const peer = Peer.create();

//     class Test extends Model {
//       value = from(peer, state => state.value + 1);
//     }
    
//     const test = Test.create();

//     expect(test.value).toBe(2);

//     peer.value = 2;

//     await test.update(true);

//     expect(test.value).toBe(3);
//   });

//   it('will accept Model in-context as source', () => {
//     class Peer extends Model {
//       value = 1;
//     }

//     class Test extends Model {
//       value = from(Peer, state => state.value + 1);
//     }

//     const Component = () => {
//       const test = Test.use();

//       expect(test.value).toBe(2);
//       return null;
//     }

//     render(
//       <Provider of={Peer}>
//         <Component />
//       </Provider>
//     );
//   })

//   it('will accept Global as source', () => {
//     Peer.create();

//     class Test extends Model {
//       value = from(Peer, state => state.value + 1);
//     }
    
//     const test = Test.create();

//     expect(test.value).toBe(2);
//   })
// })