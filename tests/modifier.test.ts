import { act, Issue, Model, ref, on, use } from './adapter';

describe("set modifier", () => {
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

describe("use modifier", () => {
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

describe("ref modifier", () => {
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
})

describe("act modifier", () => {
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

    const result = test();
    expect(test.active).toBe(true);

    await result;
    expect(test.active).toBe(false);
  });

  // non-deterministic; may fail due to race condition.
  it.skip("emits method key before/after activity", async () => {
    let update: string[] | false;
    const { test, requestUpdate } = Test.create();

    expect(test.active).toBe(false);

    const result = test();
    update = await requestUpdate(true);

    expect(test.active).toBe(true);
    expect(update).toContain("test");

    await result;
    update = await requestUpdate(true);

    expect(test.active).toBe(false);
    expect(update).toContain("test");
  });

  it("will throw immediately if already in-progress", () => {
    const { test } = Test.create();
    const expected = Issue.DuplicateAction("test");

    test();
    expect(() => test()).rejects.toThrowError(expected);
  })
})

describe("lazy modifier", () => {
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
    expect(state).toMatchObject(assign);
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