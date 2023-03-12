import { mockConsole } from '../helper/testing';
import { Model } from '../model';
import { get, Oops } from './get';
import { Oops as Child } from '../children';
import { use } from './use';

it.todo("will add pending compute to frame immediately");

it("will throw if missing factory", () => {
  class Test extends Model {
    // @ts-ignore
    value = get(this);
  }

  expect(() => Test.new()).toThrowError(
    "Factory argument cannot be undefined"
  );
})

it('will reevaluate when inputs change', async () => {
  class Subject extends Model {
    seconds = 0;

    minutes = get(this, state => {
      return Math.floor(state.seconds / 60);
    })
  }

  const subject = Subject.new();

  subject.seconds = 30;

  await subject.on(true);

  expect(subject.seconds).toEqual(30);
  expect(subject.minutes).toEqual(0);

  subject.seconds = 60;

  await subject.on(true);

  expect(subject.seconds).toEqual(60);
  expect(subject.minutes).toEqual(1);
})

it('will trigger when nested inputs change', async () => {
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

  class Child extends Model {
    value = "foo";
  }

  const subject = Subject.new();

  expect(subject.nested).toBe("foo");

  subject.child.value = "bar";
  await subject.on(true);

  expect(subject.nested).toBe("bar");

  subject.child = new Child();
  await subject.on(true);

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

    const failed = Oops.Failed(Subject.name, "never", true);

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
    const failed = Oops.Failed(Test.name, "value", false);

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

    const expected = Oops.PeerNotAllowed("Test", "value");

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
      // TODO: why is key not implicit?
      // @ts-ignore
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

describe("parent-child", () => {
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

  it("throws when required parent is absent :(", () => {
    class Detatched extends Model {}
    class NonStandalone extends Model {
      expects = get(Detatched);
    }
  
    const attempt = () => 
      NonStandalone.new();
  
    const error = Child.Required(
      Detatched.name, NonStandalone.name
    )
  
    expect(attempt).toThrowError(error);
  })
  
  it("retuns undefined if set not-required", () => {
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
      child = use(Adopted as any) as Adopted;
    }
    class Adopted extends Model {
      expects = get(Expected);
    }
  
    const attempt = () => Unexpected.new();
    const error = Child.Unexpected(
      Expected.name, Adopted.name, Unexpected.name
    )
  
    expect(attempt).toThrowError(error);
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
  
    child.on(effect);
  
    child.value = "bar";
    await child.on(true);
    expect(effect).toHaveBeenCalledTimes(2)
  
    child.parent.value = "bar";
    await child.parent.on(true);
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

    const { is: foo, bar } = Foo.new();
  
    foo.seconds = 30;
  
    await foo.on(true);
  
    expect(foo.seconds).toEqual(30);
    expect(bar.minutes).toEqual(0);
  
    foo.seconds = 60;
  
    // make sure both did declare an update
    await Promise.all([
      bar.on(true),
      foo.on(true)
    ])
  
    expect(foo.seconds).toEqual(60);
    expect(bar.minutes).toEqual(1);
  })
})