import { act, Issue, Model, ref, on, use } from './adapter';

describe("set Directive", () => {
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
  
  it('invokes callback of set property', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    expect(state.checkResult).toBe(undefined);
    state.once("test1", callback);

    state.test1 = 1;
    expect(state.checkResult).toBe(2);

    await state.requestUpdate(true)
    expect(callback).toBeCalledWith(1, "test1");
  })
  
  it('invokes callback on property overwrite', async () => {
    const state = Subject.create();
  
    state.test2 = 1;

    await state.requestUpdate(true);
    expect(state.checkResult).toBe(undefined);
    state.test2 = 2;

    await state.requestUpdate(true);
    expect(state.checkResult).toBe(true);
  })
  
  it('may assign a default value', async () => {
    const state = Subject.create();
  
    expect(state.test3).toBe("foo");
    state.test3 = "bar";

    await state.requestUpdate();
    expect(state.checkResult).toBe("bar");
  })
})

describe("use Directive", () => {
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

  it('created instance of child', () => {
    expect(parent.child).toBeInstanceOf(Child);
  })

  it('ran child callback on create', () => {
    expect(parent.hello).toBe(WORLD);
  })
})

describe("ref Directive", () => {
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
  
  it('watches "current" of ref property', async () => {
    const state = Subject.create();
    const callback = jest.fn()
  
    state.once("ref1", callback);
    state.ref1.current = "foobar";
    await state.requestUpdate(true);
    expect(callback).toBeCalledWith("foobar", "ref1");
  })
  
  it('updates "current" when property invoked', async () => {
    const state = Subject.create();
    const callback = jest.fn()
  
    state.once("ref1", callback);
    state.ref1("foobar");
    await state.requestUpdate(true);
    expect(callback).toBeCalledWith("foobar", "ref1");
  })
  
  it('invokes callback of ref property', async () => {
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
  
  it('invokes callback on ref overwrite', async () => {
    const state = Subject.create();
  
    state.ref3.current = 1;
    await state.requestUpdate();
    expect(state.checkValue).toBe(undefined);
    state.ref3.current = 2;
    await state.requestUpdate();
    expect(state.checkValue).toBe(true);
  })
})

describe("act directive", () => {
  class Test extends Model {
    test = act(this.wait);

    async wait<T>(input?: T){
      return new Promise<T | undefined>(res => {
        setTimeout(() => res(input), 1)
      });
    }
  }

  it("passes arguments to wrapped function", async () => {
    const control = Test.create();
    const input = Symbol("unique");
    const output = control.test(input);
    
    await expect(output).resolves.toBe(input);
  });

  it("sets active to true for run-duration", async () => {
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

  it("throws immediately if already in-progress", () => {
    const { test } = Test.create();
    const expected = Issue.DuplicateAction("test");

    test();
    expect(() => test()).rejects.toThrowError(expected);
  })
})