import VC, { Singleton, test } from "./adapter";

describe("basic", () => {
  class Subject extends VC {
    value = 1;
    value2 = 2;
  }

  it('ignore updates to not-accessed values', async () => {
    const { state, assertDidUpdate, assertDidNotUpdate } = test(() => {
      const state = Subject.use();

      void state.value;
      // Here we neglect to access value2.
      // void state.value2;

      return state;
    });
    
    state.value = 2
    await assertDidUpdate();

    state.value2 = 3;
    await assertDidNotUpdate();
  });

  it('expose get/set to dodge tracking', async () => {
    const { state, assertDidUpdate ,assertDidNotUpdate } = test(() => {
      const state = Subject.use();

      void state.value;
      // here we access value2, but indirectly
      // this bypasses spy which auto-subscribed value
      void state.get.value2;

      return state;
    });
    
    state.value = 2
    await assertDidUpdate();

    state.value2 = 3;
    await assertDidNotUpdate();
  })
})

describe("computed", () => {
  class Subject extends VC {
    seconds = 0;
  
    get minutes(){
      return Math.floor(this.seconds / 60)
    }
  }
  
  it('triggers computed value when input values change', async () => {
    const { state, assertDidNotUpdate, assertDidUpdate } = 
      test(Subject, ["minutes"]);
  
    state.seconds = 30;
  
    await assertDidNotUpdate();
  
    expect(state.seconds).toEqual(30);
    expect(state.minutes).toEqual(0);
  
    await assertDidNotUpdate();
    
    state.seconds = 60;
  
    await assertDidUpdate();
  
    expect(state.seconds).toEqual(60);
    expect(state.minutes).toEqual(1);
  })
})

describe("tap", () => {
  class Parent extends Singleton {
    value = "foo";
    child = new Child();
  }
  
  class Child extends VC {
    value = "foo"
    grandchild = new GrandChild();
  }
  
  class GrandChild extends VC {
    value = "bar"
  }
  
  const singleton = Parent.create();
  
  it('access subvalue directly with tap', async () => {
    const { state, assertDidUpdate } = test(() => {
      return Parent.tap("value");
    })
  
    expect(state).toBe("foo");
  
    singleton.value = "bar";
  
    await assertDidUpdate();
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
  
  it('access nested controllers with tap', async () => {
    const { state } = test(() => {
      return Parent.tap("child", "grandchild");
    })
  
    expect(state.value).toBe("bar");
  })
})

describe("meta", () => {
  class Child extends VC {
    constructor(
      public value: string){
      super();
    }
  }
  
  class Parent extends VC {
    static value = "foo";
    static child = new Child("foo");
  }
  
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