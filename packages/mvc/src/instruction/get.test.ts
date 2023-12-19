import { Model } from '../model';
import { mockError, mockPromise, mockWarn } from '../mocks';
import { get } from './get';
import { use } from './use';

const error = mockError();
const warn = mockWarn();

// is this desirable?
it.todo("will add pending compute to frame immediately");
it.todo("will suspend if necessary");

describe("fetch mode", () => {
  it("will not update on noop", async () => {
    class Remote extends Model {
      value = "foo";
    }

    const remote = Remote.new();

    Remote.at = (_, callback) => callback(remote as any);

    class Test extends Model {
      value = get(Remote, ({ value }) => {
        void value;
        return "foo";
      });
    }

    const test = Test.new();
    const effect = jest.fn();

    test.get($ => effect($.value));

    expect(effect).toBeCalledWith("foo");

    remote.value = "bar";
    await expect(test).not.toUpdate();

    remote.value = "baz";
    await expect(test).not.toUpdate();

    expect(effect).toBeCalledTimes(1);
  })
  
  it("will maintain subscription", async () => {
    class Remote extends Model {
      remote = "foo";
    }

    const remote = Remote.new();
    const effect = jest.fn();
    const compute = jest.fn();

    Remote.at = (_, callback) => callback(remote as any);

    class Test extends Model {
      value = get(Remote, ({ remote }) => {
        compute(remote);
        return remote;
      });
    }

    const test = Test.new();

    test.get($ => effect($.value));

    expect(effect).toBeCalledWith("foo");

    remote.remote = "bar";
    await expect(test).toHaveUpdated("value");
    expect(compute).toBeCalledTimes(2);
    expect(effect).toBeCalledWith("bar");

    remote.remote = "baz";
    await expect(test).toHaveUpdated("value");
    expect(compute).toBeCalledTimes(3);
    expect(effect).toBeCalledWith("baz");

    remote.remote = "boo";
    await expect(test).toHaveUpdated("value");
    expect(compute).toBeCalledTimes(4);
    expect(effect).toBeCalledWith("boo");
  })

  it("will throw if no adapter", () => {
    class Parent extends Model {}

    class Test extends Model {
      value = get(Parent);
    }

    expect(() => Test.new()).toThrowError(
      `Using context requires an adapter. If you are only testing, define \`get.context\` to simulate one.`
    );
  })

  it("will allow overwrite", async () => {
    class Foo extends Model {
      value = "foo";
      bar = use(Bar);
    }
  
    class Bar extends Model {
      value = "foo";
      foo = get(Foo);
    }
  
    const foo = Foo.new();
    const mockEffect = jest.fn();
    let promise = mockPromise();
    
    expect(foo.bar.foo).toBe(foo);
  
    foo.get(state => {
      mockEffect(state.bar.foo.value);
      promise.resolve();
    })
  
    promise = mockPromise();
    foo.value = "bar";
    await promise;
  
    expect(mockEffect).toBeCalledWith("bar");
  
    promise = mockPromise();
    foo.bar.foo = Foo.new();
    await promise;
  
    expect(mockEffect).toBeCalledWith("foo");
    expect(mockEffect).toBeCalledTimes(3);
  })
  
  it("creates parent-child relationship", () => {
    class Foo extends Model {
      child = use(Bar);
    }
    class Bar extends Model {
      parent = get(Foo);
    }
  
    const foo = Foo.new();
    const bar = foo.child;
  
    expect(bar).toBeInstanceOf(Bar);
    expect(bar.parent).toBe(foo);
  })

  it("throws when standalone but expects parent", () => {
    class Parent extends Model {}
    class Child extends Model {
      expects = get(Parent, true);
    }
  
    const attempt = () => Child.new("ID");
  
    expect(attempt).toThrowError(`ID may only exist as a child of type Parent.`);
  })

  it("will throw if not found in context", () => {
    class Parent extends Model {}
    class Child extends Model {
      expects = get(Parent);
    }

    Parent.at = (_, callback) => callback(undefined);

    // should this throw immediately, or only on access?
    expect(() => Child.new("ID")).toThrowError(`Required Parent not found in context for ID.`);
  })
  
  it("retuns undefined if required is false", () => {
    class MaybeParent extends Model {}
    class StandAlone extends Model {
      maybe = get(MaybeParent, false);
    }

    MaybeParent.at = (_, callback) => callback(undefined);
  
    const instance = StandAlone.new();
  
    expect(instance.maybe).toBeUndefined();
  })
  
  it("throws if parent is of incorrect type", () => {
    class Expected extends Model {}
    class Unexpected extends Model {
      child = use(new Adopted("ID"));
    }
    class Adopted extends Model {
      expects = get(Expected);
    }
  
    const attempt = () => Unexpected.new("ID");
  
    expect(attempt).toThrowError(`New ID created as child of ID, but must be instanceof Expected.`);
  })

  it('will track recursively', async () => {
    class Child extends Model {
      value = "foo";
      parent = get(Parent);
    }
    
    class Parent extends Model {
      value = "foo";
      child = use(Child);
    }
  
    const { child } = Parent.new();
    const effect = jest.fn((it: Child) => {
      void it.value;
      void it.parent.value;
    })
  
    child.get(effect);
  
    child.value = "bar";
    await expect(child).toHaveUpdated();
    expect(effect).toHaveBeenCalledTimes(2)
  
    child.parent.value = "bar";
    await expect(child.parent).toHaveUpdated();
    expect(effect).toHaveBeenCalledTimes(3)
  })

  it('will yeild a computed value', async () => {
    class Foo extends Model {
      bar = use(Bar);
      seconds = 0;
    }

    class Bar extends Model {
      minutes = get(Foo, state => {
        return Math.floor(state.seconds / 60);
      })
    }

    const foo = Foo.new();
  
    foo.seconds = 30;
  
    await expect(foo).toHaveUpdated();
  
    expect(foo.seconds).toEqual(30);
    expect(foo.bar.minutes).toEqual(0);
  
    foo.seconds = 60;
  
    // make sure both did declare an update
    await Promise.all([
      expect(foo.bar).toHaveUpdated(),
      expect(foo).toHaveUpdated()
    ])
  
    expect(foo.seconds).toEqual(60);
    expect(foo.bar.minutes).toEqual(1);
  })
})

describe("compute mode", () => {
  it('will reevaluate when inputs change', async () => {
    class Subject extends Model {
      seconds = 0;
  
      minutes = get(this, state => {
        return Math.floor(state.seconds / 60);
      })
    }
  
    const subject = Subject.new();
  
    subject.seconds = 30;
  
    await expect(subject).toHaveUpdated();
  
    expect(subject.seconds).toEqual(30);
    expect(subject.minutes).toEqual(0);
  
    subject.seconds = 60;
  
    await expect(subject).toHaveUpdated();
  
    expect(subject.seconds).toEqual(60);
    expect(subject.minutes).toEqual(1);
  })
  
  it('will trigger when nested inputs change', async () => {
    class Subject extends Model {
      child = use(Child);
      nested = get(this, state => {
        return state.child.value;
      })
    }
  
    class Child extends Model {
      value = "foo";
    }
  
    const subject = Subject.new();
  
    expect(subject.nested).toBe("foo");
  
    subject.child.value = "bar";

    await expect(subject).toHaveUpdated();
    expect(subject.nested).toBe("bar");

    subject.child = new Child();

    await expect(subject).toHaveUpdated();
    expect(subject.child.value).toBe("foo");
    expect(subject.nested).toBe("foo");
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
    await expect(test).toHaveUpdated();
    expect(didCompute).toBeCalledWith(2)
    expect(test.plusOne).toBe(2);
  
    test.number++;
  
    // sanity check
    expect(didCompute).not.toBeCalledWith(3);
  
    // accessing value now will force compute
    expect(test.plusOne).toBe(3);
    expect(didCompute).toBeCalledWith(3);
  
    // update should still occur
    await expect(test).toHaveUpdated();
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
  
    const test = Test.new();
  
    expect(test.c).toBe(3);
    expect(exec).toBeCalledTimes(1);
  
    test.set(emit)
  
    test.a++;
    expect(emit).toBeCalledTimes(1);
    expect(emit).toBeCalledWith("a", test);

    test.b++;
    expect(emit).toBeCalledTimes(2);
    expect(emit).toBeCalledWith("b", test);

    test.x.value++;
  
    await expect(test).toHaveUpdated();

    expect(exec).toBeCalledTimes(2);
    expect(emit).toBeCalledTimes(3);
    expect(emit).toBeCalledWith("c", test);
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

    await expect(test).toHaveUpdated();
  
    // should evaluate by prioritiy
    expect(didCompute).toMatchObject(["A", "B", "C", "D"]);
  })

  describe("failures", () => {
    class Subject extends Model {
      never = get(this, () => {
        throw new Error();
      })
    }

    it('will warn if throws', () => {
      const state = Subject.new();
      const attempt = () => state.never;

      expect(attempt).toThrowError();
      expect(warn).toBeCalledWith(`An exception was thrown while initializing ${state}.never.`);
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

      void state.value;
      state.shouldFail = true;

      await expect(state).toHaveUpdated();

      expect(warn).toBeCalledWith(`An exception was thrown while refreshing ${state}.value.`);
      expect(error).toBeCalled();
    })

    it('will throw if source is another instruction', () => {
      class Test extends Model {
        peer = get(this, () => "foobar");

        // @ts-expect-error
        value = get(this.peer, () => {});
      }

      expect(() => Test.new("ID")).toThrowError(`Attempted to use an instruction result (probably use or get) as computed source for ID.value. This is not allowed.`);
    })
  })

  describe("circular", () => {
    it("will access own previous value", async () => {
      class Test extends Model {
        multiplier = 0;
        previous: number | undefined | null = null;

        value = get(this, state => {
          const { value, multiplier } = state;

          // use set to bypass subscriber
          this.previous = value;

          return Math.ceil(Math.random() * 10) * multiplier;
        });
      }

      const test = Test.new();

      // shouldn't exist until getter's side-effect
      expect(test.previous).toBe(null);

      const initial = test.value;

      // will start at 0 because of multiple
      expect(initial).toBe(0);

      // should now exist but be undefined (initial get)
      expect("previous" in test).toBe(true);
      expect(test.previous).toBe(undefined);

      // change upstream value to trigger re-compute
      test.multiplier = 1;
      await expect(test).toHaveUpdated();

      // getter should see current value while producing new one
      expect(test.previous).toBe(initial);
      expect(test.value).not.toBe(initial);
    })

    it("will not trigger itself", async () => {
      const didGetOldValue = jest.fn();
      const didGetNewValue = jest.fn();

      class Test extends Model {
        input = 1;
        value = get(this, state => {
          const { input, value } = state;
    
          didGetOldValue(value);
    
          return input + 1;
        });
      }
    
      const test = Test.new();
    
      test.get(state => {
        didGetNewValue(state.value);
      })
    
      expect(test.value).toBe(2);
      expect(didGetNewValue).toBeCalledWith(2);
      expect(didGetOldValue).toBeCalledWith(undefined);
    
      test.input = 2;
    
      expect(test.value).toBe(3);
      expect(didGetOldValue).toBeCalledWith(2);
    
      await expect(test).toHaveUpdated();
      expect(didGetNewValue).toBeCalledWith(3);
      expect(didGetOldValue).toBeCalledTimes(2);
    })
  })

  describe("method", () => {
    it("will create computed via factory", async () => {
      class Test extends Model {
        foo = 1;
        bar = get(this.getBar);
  
        getBar(){
          return 1 + this.foo;
        }
      }

      const test = Test.new();

      expect(test.bar).toBe(2);

      test.foo++;

      await expect(test).toHaveUpdated();
      expect(test.bar).toBe(3);
    })
  
    it("will run a method bound to instance", async () => {
      class Hello extends Model {
        friend = "World";
    
        greeting = get(this.generateGreeting);
    
        generateGreeting(){
          return `Hello ${this.friend}!`;
        }
      }
    
      const test = Hello.new();
    
      expect(test.greeting).toBe("Hello World!");
    
      test.friend = "Foo";
      await expect(test).toHaveUpdated();
    
      expect(test.greeting).toBe("Hello Foo!");
    })

    it("will use top-most method of class", () => {
      class Test extends Model {
        foo = 1;
        bar = get(this.getBar);
  
        getBar(){
          return 1 + this.foo;
        }
      }

      class Test2 extends Test {
        getBar(){
          return 2 + this.foo;
        }
      }

      const test = Test2.new();

      expect(test.bar).toBe(3);
    })

    it("will provide key and self to factory", () => {
      const factory = jest.fn<"foo", [string, Test]>(() => "foo");

      class Test extends Model {
        fooBar = get(factory);
      }

      const test = Test.new();

      expect(test.fooBar).toBe("foo");
      expect(factory).toBeCalledWith("fooBar", test);
    })

    it("will subscribe from thisArg", async () => {
      class Test extends Model {
        foo = "foo";

        fooBar = get((key: string, self: Test) => {
          return self.foo;
        });
      }

      const test = Test.new();

      expect(test.fooBar).toBe("foo");

      test.foo = "bar";
      await expect(test).toHaveUpdated();

      expect(test.foo).toBe("bar");
    })
  })
})

// not yet implemented by Context yet; this is a hack.
describe.skip("replaced source", () => {
  let source: Source;
  let gotContext: (got: any) => void;

  beforeAll(() => {
    Source.at = (_, got) => {
      gotContext = got;
      got(source as any);
    }
  })

  class Source extends Model {
    constructor(public arg: Model.Argument){
      super(arg);
      source = this;

      if(gotContext)
        gotContext(this);
    }
  }

  class Test extends Model {
    greeting = get(Source, source => {
      return `Hello ${source.arg}!`;
    })
  }

  it("will update", async () => {
    const test = Test.new();
    const oldSource = Source.new("Foo");
  
    expect(test.greeting).toBe("Hello Foo!");

    oldSource.arg = "Baz";
    await expect(test).toHaveUpdated();
    expect(test.greeting).toBe("Hello Baz!");

    const newSource = Source.new("Bar");

    await expect(test).toHaveUpdated();
    expect(test.greeting).toBe("Hello Bar!");

    newSource.arg = "Baz";
    await expect(test).toHaveUpdated();
    expect(test.greeting).toBe("Hello Baz!");
  })

  it("will not update from previous source", async () => {
    const test = Test.new();
    const oldSource = Source.new("Foo");
  
    expect(test.greeting).toBe("Hello Foo!");

    Source.new("Bar");

    await expect(test).toHaveUpdated();
    expect(test.greeting).toBe("Hello Bar!");

    oldSource.arg = "Baz";
    await expect(test).not.toHaveUpdated();
  })
})

describe("async", () => {
  class Foo extends Model {
    value = "foobar";
  }

  Foo.at = (_, callback) => {
    setTimeout(() => {
      callback(Foo.new() as any);
    }, 0);
  };

  it("will suspend if not ready", async () => {
    class Bar extends Model {
      foo = get(Foo);
    }
  
    const bar = Bar.new();
    let caught: unknown;

    try {
      void bar.foo;
      throw false;
    }
    catch(err){
      expect(err).toBeInstanceOf(Promise);
      caught = err;
    }

    await expect(caught).resolves.toBeInstanceOf(Foo);
    expect(bar.foo).toBeInstanceOf(Foo);
  })
  
  it("will prevent compute if not ready", async () => {
    class Bar extends Model {
      foo = get(Foo, foo => foo.value);
    }
  
    const bar = Bar.new();
    let caught: unknown;

    try {
      void bar.foo;
      throw false;
    }
    catch(err){
      caught = err;
    }

    await expect(caught).resolves.toBe("foobar");
  
    expect(bar.foo).toBe("foobar");
  })
})