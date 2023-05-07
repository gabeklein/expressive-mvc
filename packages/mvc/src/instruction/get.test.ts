import { Control } from '../control';
import { mockPromise, mockConsole } from '../helper/testing';
import { Model } from '../model';
import { get, Oops } from './get';

it.todo("will add pending compute to frame immediately");

beforeAll(() => {
  Control.hasModel = (Type, _relative, callback) => {
    callback(undefined);
  }
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
  
    await expect(subject).toUpdate();
  
    expect(subject.seconds).toEqual(30);
    expect(subject.minutes).toEqual(0);
  
    subject.seconds = 60;
  
    await expect(subject).toUpdate();
  
    expect(subject.seconds).toEqual(60);
    expect(subject.minutes).toEqual(1);
  })
  
  it('will trigger when nested inputs change', async () => {
    class Subject extends Model {
      child = new Child();
      seconds = 0;
    
      minutes = get(this, state => {
        return Math.floor(state.seconds / 60);
      })
    
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

    await expect(subject).toUpdate();
    expect(subject.nested).toBe("bar");
  
    subject.child = new Child();
    await expect(subject).toUpdate();
  
    // sanity check
    expect(subject.child.value).toBe("foo");
    expect(subject.nested).toBe("foo");
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
    await expect(test).toUpdate();
    expect(didCompute).toBeCalledWith(2)
    expect(test.plusOne).toBe(2);
  
    test.number++;
  
    // sanity check
    expect(didCompute).not.toBeCalledWith(3);
  
    // accessing value now will force compute
    expect(test.plusOne).toBe(3);
    expect(didCompute).toBeCalledWith(3);
  
    // update should still occur
    await expect(test).toUpdate();
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
      x = new Inner();
    }
  
    const state = Test.new();
  
    expect(state.c).toBe(3);
    expect(exec).toBeCalledTimes(1);
  
    state.on("c", emit);
  
    state.a++;
    state.b++;
    state.x.value++;
  
    await expect(state).toUpdate();
  
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
    const updated = await test.on(0);
  
    // should evaluate by prioritiy
    expect(didCompute).toMatchObject(["A", "B", "C", "D"]);
    expect(updated).toMatchObject(["X", "A", "B", "C", "D"]);
  })
  
  it("will run a bound method", async () => {
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
    await expect(test).toUpdate();
  
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

      const failed = Oops.Failed(state, "never", true);

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
      const failed = Oops.Failed(state, "value", false);

      state.on("value");
      state.shouldFail = true;

      await expect(state).toUpdate();

      expect(warn).toBeCalledWith(failed.message);
      expect(error).toBeCalled();
    })

    it('will throw if source is another instruction', () => {
      class Test extends Model {
        peer = get(this, () => "foobar");

        // @ts-ignore
        value = get(this.peer, () => {});
      }

      const expected = Oops.PeerNotAllowed("Test-ID", "value");

      expect(() => Test.new("ID")).toThrow(expected);
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
      await expect(test).toUpdate();

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
    
      await expect(test).toUpdate();
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

      await expect(test).toUpdate();
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
        // TODO: why is key not implicit?
        // @ts-ignore
        fooBar = get((key) => () => key);
      }

      const test = Test.new();

      expect(test.fooBar).toBe("fooBar");
    })
  })
})

describe("fetch mode", () => {
  it("will allow overwrite", async () => {
    class Foo extends Model {
      value = "foo";
      bar = new Bar();
    }
  
    class Bar extends Model {
      value = "foo";
      foo = get(Foo);
    }
  
    const foo = Foo.new();
    const mockEffect = jest.fn();
    let promise = mockPromise();
    
    expect(foo.bar.foo).toBe(foo);
  
    foo.on(state => {
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
      child = new Bar();
    }
    class Bar extends Model {
      parent = get(Foo);
    }
  
    const foo = Foo.new();
    const bar = foo.child;
  
    expect(bar).toBeInstanceOf(Bar);
    expect(bar.parent).toBe(foo);
  })

  it("throws when required parent is absent :(", () => {
    class Detatched extends Model {}
    class NonStandalone extends Model {
      expects = get(Detatched, true);
    }
  
    const attempt = () => NonStandalone.new("ID");
    const error = Oops.Required(Detatched, "NonStandalone-ID");
  
    expect(attempt).toThrowError(error);
  })
  
  it("retuns undefined if required is false", () => {
    class MaybeParent extends Model {}
    class StandAlone extends Model {
      maybe = get(MaybeParent, false);
    }
  
    const instance = StandAlone.new();
  
    expect(instance.maybe).toBeUndefined();
  })
  
  it("throws if parent is of incorrect type", () => {
    class Expected extends Model {}
    class Unexpected extends Model {
      child = new Adopted("ID");
    }
    class Adopted extends Model {
      expects = get(Expected);
    }
  
    const attempt = () => Unexpected.new("ID");
    const error = Oops.Unexpected(Expected, "Adopted-ID", "Unexpected-ID");
  
    expect(attempt).toThrowError(error);
  })

  it('will track recursively', async () => {
    class Child extends Model {
      value = "foo";
      parent = get(Parent);
    }
    
    class Parent extends Model {
      value = "foo";
      child = new Child();
    }
  
    const { child } = Parent.new();
    const effect = jest.fn((it: Child) => {
      void it.value;
      void it.parent.value;
    })
  
    child.on(effect);
  
    child.value = "bar";
    await expect(child).toUpdate();
    expect(effect).toHaveBeenCalledTimes(2)
  
    child.parent.value = "bar";
    await expect(child.parent).toUpdate();
    expect(effect).toHaveBeenCalledTimes(3)
  })

  it('will yeild a computed value', async () => {
    class Foo extends Model {
      bar = new Bar();
      seconds = 0;
    }

    class Bar extends Model {
      minutes = get(Foo, state => {
        return Math.floor(state.seconds / 60);
      })
    }

    const { is: foo, bar } = Foo.new();
  
    foo.seconds = 30;
  
    await expect(foo).toUpdate();
  
    expect(foo.seconds).toEqual(30);
    expect(bar.minutes).toEqual(0);
  
    foo.seconds = 60;
  
    // make sure both did declare an update
    await Promise.all([
      expect(bar).toUpdate(),
      expect(foo).toUpdate()
    ])
  
    expect(foo.seconds).toEqual(60);
    expect(bar.minutes).toEqual(1);
  })
})

describe("replaced source", () => {
  let didUpdate: (got: Source) => void;
  let current: Source;

  beforeAll(() => {
    Control.hasModel = (Type, relativeTo, callback) => {
      didUpdate = callback;
      callback(current);
    }
  })

  class Source extends Model {
    constructor(public value: string){
      super();
    }
  }

  class Test extends Model {
    greeting = get(Source, source => {
      return `Hello ${source.value}!`;
    })
  }

  it("will update", async () => {
    const test = Test.new();
    const oldSource = current = Source.new("Foo");
  
    expect(test.greeting).toBe("Hello Foo!");

    oldSource.value = "Baz";
    await expect(test).toUpdate();
    expect(test.greeting).toBe("Hello Baz!");

    const newSource = current = Source.new("Bar");

    didUpdate(newSource);

    await expect(test).toUpdate();
    expect(test.greeting).toBe("Hello Bar!");

    newSource.value = "Baz";
    await expect(test).toUpdate();
    expect(test.greeting).toBe("Hello Baz!");
  })

  it("will not update from previous source", async () => {
    const test = Test.new();
    const oldSource = current = Source.new("Foo");
  
    expect(test.greeting).toBe("Hello Foo!");

    const newSource = current = Source.new("Bar");

    didUpdate(newSource);

    await expect(test).toUpdate();
    expect(test.greeting).toBe("Hello Bar!");

    oldSource.value = "Baz";
    await expect(test).not.toUpdate();
  })
})

describe("async", () => {
  beforeAll(() => {
    Control.hasModel = (Type, _relative, callback) => {
      setTimeout(() => {
        callback(Type.new());
      }, 0);
    }
  })

  it("will suspend if not ready", async () => {
    class Foo extends Model {}
    class Bar extends Model {
      foo = get(Foo);
    }
  
    const bar = Bar.new();
    let suspense: Model.Suspense;

    try {
      void bar.foo;
      throw false;
    }
    catch(err){
      expect(err).toBeInstanceOf(Promise);
      suspense = err as Model.Suspense;
    }

    await suspense;
  
    expect(bar.foo).toBeInstanceOf(Foo);
  })
  
  it("will prevent compute if not ready", async () => {
    class Foo extends Model {
      value = "foobar";
    }
    class Bar extends Model {
      foo = get(Foo, foo => foo.value);
    }
  
    const bar = Bar.new();
    let suspense: Model.Suspense;

    try {
      void bar.foo;
      throw false;
    }
    catch(err){
      expect(err).toBeInstanceOf(Promise);
      suspense = err as Model.Suspense;
    }

    await suspense;
  
    expect(bar.foo).toBe("foobar");
  })
})