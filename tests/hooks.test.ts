import { Controller, Singleton, test } from './adapter';

describe("tap", () => {
  class Parent extends Singleton {
    value = "foo";
    child = new Child();
  }
  
  class Child extends Controller {
    value = "foo"
    grandchild = new GrandChild();
  }
  
  class GrandChild extends Controller {
    value = "bar"
  }
  
  let singleton!: Parent;

  beforeEach(() => {
    if(Parent.current)
      singleton.destroy();

    singleton = Parent.create();
  });
  
  it('access subvalue directly with tap', async () => {
    const { state, assertDidUpdate } = test(() => {
      return Parent.tap("value");
    })
  
    expect(state).toBe("foo");
  
    singleton.value = "bar";
  
    await assertDidUpdate();
  })
  
  it('access subvalue directly with tap', async () => {
    const { state } = test(() => {
      return Parent.tap(x => x.value);
    });
  
    expect(state).toBe("foo");
  })
  
  it('access child controller with tap', async () => {
    const { state, assertDidUpdate } = test(() => {
      return Parent.tap("child");
    })
  
    expect(state.value).toBe("foo");
  
    state.value = "bar"
  
    await assertDidUpdate();
  
    expect(state.value).toBe("bar");
  
    singleton.child = new Child();
  
    await assertDidUpdate();
  })
  
  it.todo('access nested controllers with tap')
})

describe("meta", () => {
  class Child extends Controller {
    constructor(
      public value: string){
      super();
    }
  }
  
  class Parent extends Controller {
    static value = "foo";
    static child = new Child("foo");
  }

  beforeEach(() => Parent.value = "foo")
  
  it('tracks static values on meta', async () => {
    const { state, assertDidUpdate } = test(() => {
      const meta = Parent.meta();
      void meta.value;
      return meta;
    });
  
    expect(state.value).toBe("foo");
  
    state.value = "bar";
  
    await assertDidUpdate();
    expect(state.value).toBe("bar");
  })
  
  it('pulls static values via selector', async () => {
    const { state } = test(() => {
      return Parent.meta(x => x.value);
    });
  
    expect(state).toBe("foo");
  })
  
  it('tracks child controller values on meta', async () => {
    const { state, assertDidUpdate } = test(() => {
      const meta = Parent.meta();
      void meta.child.value;
      return meta;
    });
  
    expect(state.child.value).toBe("foo");
  
    // Will refresh on sub-value change.
    state.child.value = "bar";
    await assertDidUpdate();
    expect(state.child.value).toBe("bar");
  
    // Will refresh on repalcement.
    state.child = new Child("foo");
    await assertDidUpdate();
    expect(state.child.value).toBe("foo");
  
    // Fresh subscription does still work.
    state.child.value = "bar";
    await assertDidUpdate();
    expect(state.child.value).toBe("bar");
  })
})