import Controller, { ref, set, test, use } from './adapter';

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
    const { state, assertDidUpdate } = test(Subject, ["ref1"]);
    const callback = jest.fn()
  
    state.once("ref1", callback);
    state.ref1.current = "value1";
    await assertDidUpdate();
    expect(callback).toBeCalledWith("value1", "ref1");
  })
  
  it('invokes callback of ref property', async () => {
    const { state, assertDidUpdate } = test(Subject, ["ref2"]);
    const targetValue = Symbol("inserted object");
    const callback = jest.fn();
  
    expect(state.checkValue).toBe(undefined);
    state.once("ref2", callback);
    state.ref2.current = targetValue;
    expect(state.checkValue).toBe(targetValue);
    await assertDidUpdate();
    expect(callback).toBeCalledWith(targetValue, "ref2");
  })
  
  it('invokes callback on ref overwrite', async () => {
    const { state, assertDidUpdate } = test(Subject, ["ref3"]);
  
    state.ref3.current = 1;
    await assertDidUpdate();
    expect(state.checkValue).toBe(undefined);
    state.ref3.current = 2;
    await assertDidUpdate();
    expect(state.checkValue).toBe(true);
  })
})