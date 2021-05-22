import { act, Controller, event, Issue, ref, set, use } from './adapter';

describe("set Directive", () => {
  class Subject extends Controller {
    checkResult?: any = undefined;
  
    test1 = set<number>(value => {
      this.checkResult = value + 1;
    });
  
    test2 = set<number>(value => {
      return () => {
        this.checkResult = true;
      }
    });
  
    test3 = set("foo", value => {
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

  class Parent extends Controller {
    hello?: string = undefined;

    child = use(Child as any, (child: any) => {
      this.hello = child.hello;
    }) as Child;
  }

  class Child extends Controller {
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
  class Subject extends Controller {
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
    state.ref1.current = "value1";
    await state.requestUpdate(true);
    expect(callback).toBeCalledWith("value1", "ref1");
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

describe("event Directive", () => {
  let control: Events;
  let mockCallback: jest.Mock;

  class Events extends Controller {
    foo = event();
    bar = event(mockCallback);
    baz = event(() => mockCallback)
  }

  beforeEach(() => {
    control = Events.create();
    mockCallback = jest.fn();
  })

  it("applies callback function to key", () => {
    expect(control.foo).toBeInstanceOf(Function);
  })

  it("emits standard event from property", async () => {
    const updated = control.once(x => x.foo); 
    control.foo();
    await updated;
  })

  it("calls effect when events fired", async () => {
    control.update(x => x.bar);
    const updates = await control.requestUpdate(true);
    expect(updates).toMatchObject(["bar"]);
  })

  it("calls previous callback when event fires again", async () => {
    const fire = async () => {
      control.update(x => x.baz);
      const updates = await control.requestUpdate(true);
      expect(updates).toMatchObject(["baz"]);
    }

    await fire();
    expect(mockCallback).not.toBeCalled();
    await fire();
    expect(mockCallback).toBeCalled();
  })
})

describe("act directive", () => {
  class Test extends Controller {
    action = act(this.wait);

    async wait<T>(input?: T){
      return new Promise<T>(res => {
        setTimeout(() => res(input), 0)
      });
    }
  }

  it("passes arguments to wrapped function", async () => {
    const control = Test.create();
    const input = Symbol("unique");
    const output = control.action!(input);
    
    await expect(output).resolves.toBe(input);
  });

  it("sets method to undefined for duration", async () => {
    const control = Test.create();
    const promise = control.action!();
    expect(control.action).toBeUndefined();
    await promise;
    expect(control.action).toBeInstanceOf(Function);
  });

  it("exposes 'allowed' for closured action", async () => {
    const act = Test.create().action!;

    expect(act.allowed).toBe(true);
    const promise = act();
    expect(act.allowed).toBe(false);
    await promise;
    expect(act.allowed).toBe(true);
  });

  it("emits method key before/after activity", async () => {
    const control = Test.create();
    const promise = control.action!();

    const onBegin = await control.requestUpdate();
    expect(onBegin).toContain("action");
    expect(control.action).toBeUndefined();

    await promise;

    const onEnd = await control.requestUpdate();
    expect(onEnd).toContain("action");
    expect(control.action).toBeInstanceOf(Function);
  });

  it("throws immediately if already in-progress", () => {
    const { action } = Test.create();
    const expected = Issue.DuplicateAction("action");
    const run = () => action!();

    run();
    expect(run).rejects.toThrowError(expected);
  })
})