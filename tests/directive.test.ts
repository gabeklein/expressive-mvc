import Controller, { test, set, use } from "./adapter";

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
  }
  
  it('invokes callback of set property', async () => {
    const { state, assertDidUpdate } = test(Subject, ["test1"]);
    const callback = jest.fn();
  
    expect(state.checkResult).toBe(undefined);
    state.once("test1", callback);
    state.test1 = 1;
    expect(state.checkResult).toBe(2);
    await assertDidUpdate();
    expect(callback).toBeCalledWith(1, "test1");
  })
  
  it('invokes callback on property overwrite', async () => {
    const { state, assertDidUpdate } = test(Subject, ["test2"]);
  
    state.test2 = 1;
    await assertDidUpdate();
    expect(state.checkResult).toBe(undefined);
    state.test2 = 2;
    await assertDidUpdate();
    expect(state.checkResult).toBe(true);
  })
})

describe("use Directive", () => {
  const WORLD = "Hello World!";

  class Parent extends Controller {
    hello?: string = undefined;

    child = use(Child, child => {
      this.hello = child.hello;
    });
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

  it('assigned parent property to child', () => {
    expect(parent.child.parent).toBe(parent);
  })

  it('ran child callback on create', () => {
    expect(parent.hello).toBe(WORLD);
  })
})