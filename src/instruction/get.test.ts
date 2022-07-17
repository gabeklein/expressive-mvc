import { Global, Model } from '..';
import { mockAsync, mockSuspense } from '../../tests/adapter';
import { tap } from '../react/tap';
import { Oops as Suspense } from '../suspense';
import { get, Oops as Compute } from './get';
import { put } from './put';
import { use } from './use';

describe("computed", () => {
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

  it('will reevaluate when inputs change', async () => {
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

  it('will trigger when nested inputs change', async () => {
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

  it('will compute immediately if needed', () => {
    const mockFactory = jest.fn(() => "foobar");

    class Test extends Model {
      value = get(() => mockFactory);

      constructor(){
        super();
        this.on("value", () => {});
      }
    }

    const test = Test.create();

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

    const test = Test.create();
    const values = test.export();

    expect(mockFactory).toBeCalled();
    expect(values.value).toBe("foobar");
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

    const test = Ordered.create();

    // initialize D, should cascade to dependancies
    expect(test.D).toBe(6);

    // should evaluate in order, by use
    expect(didCompute).toMatchObject(["A", "B", "C", "D"]);

    // empty computed
    didCompute = [];

    // change value of X, will trigger A & C;
    test.X = 2;
    const updated = await test.update(true);

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

    const test = Hello.create();

    expect(test.greeting).toBe("Hello World!");

    test.friend = "Foo";
    await test.update(true);

    expect(test.greeting).toBe("Hello Foo!");
  })
})

describe("failures", () => {
  const warn = jest
    .spyOn(global.console, "warn")
    .mockImplementation(() => {});

  const error = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});

  afterEach(() => {
    warn.mockReset();
    error.mockReset();
  });

  afterAll(() => {
    warn.mockReset();
    error.mockRestore();
  });

  class Subject extends Model {
    never = get(this, () => {
      throw new Error();
    })
  }

  it('will warn if throws', () => {
    const state = Subject.create();
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

    const state = Test.create();
    const failed = Compute.Failed(Test.name, "value", false);

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
      value = get(this.peer, () => {});
    }

    const expected = Compute.PeerNotAllowed("Test", "value");

    expect(() => Test.create()).toThrow(expected);
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
    bar = get(() => this.getBar);

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
      fooBar = get((key) => () => key);
    }

    const test = Test.create();

    expect(test.fooBar).toBe("fooBar");
  })

  it("will throw if factory resembles a class", () => {
    function Factory(){
      return () => "foobar";
    }

    class Test extends Model {
      value = get(Factory);
    }

    const expected = Compute.BadSource("Test", "value", Factory);

    expect(() => Test.create()).toThrow(expected);
  })
})

describe("suspense", () => {
  class Test extends Model {
    random = 0;
    source?: string = undefined;

    value = get(this, x => {
      void x.random;
      return x.source;
    }, true);
  }

  it("will suspend if value is undefined", async () => {
    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("value");
      promise.resolve();
    })

    test.assertDidSuspend(true);

    instance.source = "foobar!";

    await promise.pending();

    test.assertDidRender(true);
  })

  it("will suspend in method mode", async () => {
    class Test extends Model {
      source?: string = undefined;
      value = get(() => this.getValue, true);

      getValue(){
        return this.source;
      }
    }

    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("value");
      promise.resolve();
    })

    test.assertDidSuspend(true);

    instance.source = "foobar!";

    await promise.pending();

    test.assertDidRender(true);
  })

  it("will seem to throw error outside react", () => {
    const instance = Test.create();
    const expected = Suspense.NotReady(instance, "value");
    let didThrow: Error | undefined;

    try {
      void instance.value;
    }
    catch(err: any){
      didThrow = err;
    }

    expect(String(didThrow)).toBe(String(expected));
  })

  it("will return immediately if value is defined", async () => {
    const test = mockSuspense();
    const instance = Test.create();

    instance.source = "foobar!";

    let value: string | undefined;

    test.renderHook(() => {
      value = instance.tap("value");
    })

    test.assertDidRender(true);

    expect(value).toBe("foobar!");
  })

  it("will not resolve if value stays undefined", async () => {
    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("value");
      promise.resolve();
    })

    test.assertDidSuspend(true);

    instance.random = 1;

    // update to value is expected
    const pending = await instance.update(true);
    expect(pending).toContain("random");

    // value will still be undefined
    expect(instance.export().value).toBe(undefined);

    // give react a moment to render (if it were)
    await new Promise(res => setTimeout(res, 100));

    // expect no action - value still is undefined
    test.assertDidRender(false);

    instance.source = "foobar!";

    // we do expect a render this time
    await promise.pending();

    test.assertDidRender(true);
  })

  it("will return undefined if not required", async () => {
    const promise = mockAsync<string>();
    const mock = jest.fn();

    class Test extends Model {
      value = put(promise.pending, false);
    }

    const test = Test.create();

    test.effect(state => mock(state.value));

    expect(mock).toBeCalledWith(undefined);

    promise.resolve("foobar");
    await test.update();

    expect(mock).toBeCalledWith("foobar");
  })

  it.todo("will start suspense if value becomes undefined");
})

/* Feature is temporarily removed - evaluating usefulness.
describe("external", () => {
  class Peer extends Global {
    value = 1;
  }

  afterEach(() => Peer.reset());

  it('will accept source other than \'this\'', async () => {
    const peer = Peer.create();

    class Test extends Model {
      value = from(peer, state => state.value + 1);
    }

    const test = Test.create();

    expect(test.value).toBe(2);

    peer.value = 2;

    await test.update(true);

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
    Peer.create();

    class Test extends Model {
      value = from(Peer, state => state.value + 1);
    }

    const test = Test.create();

    expect(test.value).toBe(2);
  })
})
*/