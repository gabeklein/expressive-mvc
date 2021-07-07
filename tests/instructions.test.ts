import { renderHook } from '@testing-library/react-hooks';

import { Oops } from '../src/instructions';
import { Subscriber } from '../src/subscriber';
import { act, from, lazy, get, memo, Model, on, ref, set, use } from './adapter';

describe("on", () => {
  class Subject extends Model {
    checkResult?: any = undefined;
  
    test1 = on<number>(value => {
      this.checkResult = value + 1;
    });
  
    test2 = on<number>(value => {
      return () => {
        this.checkResult = true;
      }
    });
  
    test3 = on("foo", value => {
      this.checkResult = value;
    });
  }
  
  it('will invoke callback on property set', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    expect(state.checkResult).toBe(undefined);
    state.once("test1", callback);

    state.test1 = 1;
    expect(state.checkResult).toBe(2);

    await state.requestUpdate(true)
    expect(callback).toBeCalledWith(1, "test1");
  })
  
  it('will invoke return-callback on overwrite', async () => {
    const state = Subject.create();
  
    state.test2 = 1;

    await state.requestUpdate(true);
    expect(state.checkResult).toBe(undefined);
    state.test2 = 2;

    await state.requestUpdate(true);
    expect(state.checkResult).toBe(true);
  })
  
  it('will assign a default value', async () => {
    const state = Subject.create();
  
    expect(state.test3).toBe("foo");
    state.test3 = "bar";

    await state.requestUpdate();
    expect(state.checkResult).toBe("bar");
  })
})

describe("use", () => {
  const WORLD = "Hello World!";

  class Parent extends Model {
    hello?: string = undefined;

    child = use(Child as any, (child: any) => {
      this.hello = child.hello;
    }) as Child;
  }

  class Child extends Model {
    hello = WORLD;
  }

  let parent: Parent;

  beforeAll(() => {
    parent = Parent.create();
  })

  it('will create instance of child', () => {
    expect(parent.child).toBeInstanceOf(Child);
  })

  it('will run child callback on create', () => {
    expect(parent.hello).toBe(WORLD);
  })
})

describe("ref", () => {
  class Subject extends Model {
    checkValue?: any = undefined;
  
    ref1 = ref<string>();
  
    ref2 = ref<symbol>(value => {
      this.checkValue = value;
    })
  
    ref3 = ref<number>(() => {
      return () => {
        this.checkValue = true;
      }
    })
  }

  it('will fetch value from ref-object', async () => {
    const state = Subject.create();

    state.ref1.current = "foobar";
    await state.requestUpdate(true);
    expect(state.ref1.current).toBe("foobar");
  })
  
  it('will watch "current" of property', async () => {
    const state = Subject.create();
    const callback = jest.fn()
  
    state.once("ref1", callback);
    state.ref1.current = "foobar";
    await state.requestUpdate(true);
    expect(callback).toBeCalledWith("foobar", "ref1");
  })
  
  it('will update "current" when property invoked', async () => {
    const state = Subject.create();
    const callback = jest.fn()
  
    state.once("ref1", callback);
    state.ref1("foobar");
    await state.requestUpdate(true);
    expect(callback).toBeCalledWith("foobar", "ref1");
  })
  
  it('will invoke callback if exists', async () => {
    const state = Subject.create();
    const targetValue = Symbol("inserted object");
    const callback = jest.fn();
  
    expect(state.checkValue).toBe(undefined);
    state.once("ref2", callback);
    state.ref2.current = targetValue;
    expect(state.checkValue).toBe(targetValue);
    await state.requestUpdate(true);
    expect(callback).toBeCalledWith(targetValue, "ref2");
  })
  
  it('will invoke return-callback on overwrite', async () => {
    const state = Subject.create();
  
    state.ref3.current = 1;
    await state.requestUpdate();
    expect(state.checkValue).toBe(undefined);
    state.ref3.current = 2;
    await state.requestUpdate();
    expect(state.checkValue).toBe(true);
  })

  it('will export value of ref-properties', () => {
    const test = Subject.create();
    const values = {
      ref1: "foobar",
      ref2: Symbol("foobar"),
      ref3: 69420
    }

    test.ref1(values.ref1);
    test.ref2(values.ref2);
    test.ref3(values.ref3);

    const state = test.export();

    expect(state).toMatchObject(values);
  })
})

describe("act", () => {
  class Test extends Model {
    test = act(this.wait);

    async wait<T>(input?: T){
      return new Promise<T | undefined>(res => {
        setTimeout(() => res(input), 1)
      });
    }
  }

  it("will pass arguments to wrapped function", async () => {
    const control = Test.create();
    const input = Symbol("unique");
    const output = control.test(input);
    
    await expect(output).resolves.toBe(input);
  });

  it("will set active to true for run-duration", async () => {
    const { test } = Test.create();

    expect(test.active).toBe(false);

    const result = test("foobar");
    expect(test.active).toBe(true);

    const output = await result;

    expect(output).toBe("foobar");
    expect(test.active).toBe(false);
  });

  it("emits method key before/after activity", async () => {
    let update: string[] | false;
    const { test, requestUpdate } = Test.create();

    expect(test.active).toBe(false);

    const result = test("foobar");
    update = await requestUpdate(true);

    expect(test.active).toBe(true);
    expect(update).toContain("test");

    const output = await result;
    update = await requestUpdate(true);

    expect(test.active).toBe(false);
    expect(update).toContain("test");
    expect(output).toBe("foobar");
  });

  it("will throw immediately if already in-progress", () => {
    const { test } = Test.create();
    const expected = Oops.DuplicateAction("test");

    test();
    expect(() => test()).rejects.toThrowError(expected);
  })

  it("will complain if property is redefined", () => {
    const state = Test.create();
    const expected = Oops.SetActionProperty("test");
    const assign = () => state.test = 0 as any;

    expect(assign).toThrowError(expected);
  })
})

describe("lazy", () => {
  class Test extends Model {
    lazy = lazy("foo");
    eager = "bar";
  }

  it("will set starting value", async () => {
    const state = Test.create();

    expect(state.lazy).toBe("foo");
  });

  it("will ignore updates", async () => {
    const state = Test.create();

    expect(state.lazy).toBe("foo");
    
    state.lazy = "bar";
    await state.requestUpdate(false);

    expect(state.lazy).toBe("bar");
    
    state.eager = "foo";
    await state.requestUpdate(true);
  });

  it("will include key on import", () => {
    const state = Test.create();
    const assign = {
      lazy: "bar",
      eager: "foo"
    };
    
    state.import(assign);
    expect(assign).toMatchObject(state);
  });

  it("will include value on export", async () => {
    const state = Test.create();
    const values = state.export();

    expect(values).toMatchObject({
      lazy: "foo",
      eager: "bar"
    })
  });

  it("will not include in subscriber", async () => {
    const element = renderHook(() => Test.use());
    const proxy = element.result.current;
    const subscriberOverlay =
      Object.getOwnPropertyNames(proxy);

    // lazy should be still be visible
    expect(proxy.lazy).toBe("foo");

    // there should be no spy getter however
    expect(subscriberOverlay).not.toContain("lazy");
    expect(subscriberOverlay).toContain("eager");
  });
})

describe("from", () => {
  class Hello extends Model {
    friend = "World";

    greeting = from(this.generateGreeting);

    generateGreeting(){
      return `Hello ${this.friend}!`;
    }
  }

  it("will create a computed property", async () => {
    const test = Hello.create();

    expect(test.greeting).toBe("Hello World!");

    test.friend = "Foo";
    await test.requestUpdate(true);

    expect(test.greeting).toBe("Hello Foo!");
  })
})

describe("memo", () => {
  class Test extends Model {
    ranMemo = jest.fn();
    ranLazyMemo = jest.fn();

    memoized = memo(() => {
      this.ranMemo();
      return "foobar";
    });

    memoLazy = memo(() => {
      this.ranLazyMemo();
      return "foobar";
    }, true);
  }

  it("will run memoize on create", () => {
    const state = Test.create();

    expect(state.memoized).toBe("foobar");
    expect(state.ranMemo).toBeCalled();
  })

  it("will run memoLazy on first access", () => {
    const state = Test.create();

    expect(state.ranLazyMemo).not.toBeCalled();

    expect(state.memoLazy).toBe("foobar");
    expect(state.ranLazyMemo).toBeCalled();
  })
})

describe("set", () => {
  class Test extends Model {
    didRunInstruction = jest.fn();

    property = set((key, _controller) => {
      this.didRunInstruction(key);
    })
  }

  it("will run instruction on create", () => {
    const { didRunInstruction: ran } = Test.create();

    expect(ran).toBeCalledWith("property");
  })
})

describe("get", () => {
  class Test extends Model {
    didRunInstruction = jest.fn();
    didGetSubscriber = jest.fn();

    property = get((key, _controller, subscriber) => {
      this.didRunInstruction(key);
      this.didGetSubscriber(subscriber);

      return "foobar";
    })
  }

  it("will run instruction on access", () => {
    const { didRunInstruction: ran, get } = Test.create();

    expect(ran).not.toBeCalled();
    expect(get.property).toBe("foobar");
    expect(ran).toBeCalledWith("property");
  })

  it("will pass undefined for subscriber", () => {
    const { didGetSubscriber: got, get } = Test.create();

    expect(get.property).toBe("foobar");
    expect(got).toBeCalledWith(undefined);
  })

  it("will pass undefined for subscriber", () => {
    const { didGetSubscriber: got, get } = Test.create();

    expect(get.property).toBe("foobar");
    expect(got).toBeCalledWith(undefined);
  })

  it("will pass subscriber if within one", () => {
    const state = Test.create();
    const got = state.didGetSubscriber;

    state.effect(own => {
      expect(own.property).toBe("foobar");
    });

    expect(got).toBeCalledWith(expect.any(Subscriber));
  });
})