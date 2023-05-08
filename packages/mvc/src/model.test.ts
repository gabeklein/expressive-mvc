import { ref } from './instruction/ref';
import { set } from './instruction/set';
import { Model } from './model';

describe("Model", () => {
  class Subject extends Model {
    value: number;
  
    constructor(initial?: number){
      super();
      this.value = initial || 1;
    }
  
    setValue = (to: number) => {
      this.value = to;
    }
  }
  
  it('will instantiate from custom class', () => {
    const state = Subject.new();
  
    expect(state.value).toBe(1);
  })
  
  it('will send arguments to constructor', () => {
    const state = Subject.new(3);
  
    expect(state.value).toBe(3);
  })
  
  it('will assign is as a circular reference', async () => {
    const state = Subject.new();
  
    expect(state.is.value).toBe(1);
  
    state.value = 2;
    await expect(state).toUpdate();
  
    expect(state.is.value).toBe(2)
  })
  
  it("will ignore getters and setters", () => {
    class Test extends Model {
      foo = "foo";
  
      get bar(){
        return "bar";
      }

      set baz(value: string){
        this.foo = value;
      }
    }
  
    const test = Test.new();
  
    expect(test.bar).toBe("bar");
    expect(test.get()).not.toContain("bar");
  })
  
  it('will update when a value changes', async () => {
    const state = Subject.new();
  
    expect(state.value).toBe(1);
  
    state.value = 2
    await expect(state).toUpdate();
  
    expect(state.value).toBe(2);
  })
  
  it('will not update if value is same', async () => {
    const state = Subject.new();
  
    expect(state.value).toBe(1);
  
    state.value = 1
    await expect(state).not.toUpdate();
  })
  
  it('accepts update from within a method', async () => {
    class Subject extends Model {
      value = 1;
  
      setValue = (to: number) => {
        this.value = to;
      }
    }
  
    const state = Subject.new();
  
    state.setValue(3);
    await expect(state).toUpdate();
  
    expect(state.value).toBe(3)
  })
})

describe("dispatch", () => {
  class Test extends Model {
    foo = "foo";
    bar = "bar";

    method = jest.fn();
    methodString = jest.fn((argument: string) => {
      this.foo = argument;
    });
  }

  it("will send synthetic event", async () => {
    const test = Test.new();
    test.set("foo");

    const update = await test.on(0);
    expect(update).toContain("foo");
  })

  it("will squash updates which exist", async () => {
    const test = Test.new();

    test.foo = "bar";
    test.set("foo");

    const update = await test.on(0);
    expect(update).toContain("foo");
  })

  it("will send arbitrary event", async () => {
    const test = Test.new();
    test.set("foobar");

    const update = await test.on(0);
    expect(update).toContain("foobar");
  })

  it("will resolve after event is handled", async () => {
    const test = Test.new();
    const update = await test.set("foo");

    expect(update).toContain("foo");
  })

  it("will resolve with keys already in frame", async () => {
    const test = Test.new();
    test.bar = "foo";

    const update = await test.set("foo");
    expect(update).toMatchObject(["bar", "foo"]);
  })

  it("will assign to exotic value", async () => {
    class Test extends Model {
      foo = ref<string>();
    }

    const test = Test.new();

    await test.set("foo", "bar");
    expect(test.foo.current).toBe("bar");
  })
})

describe("import", () => {
  class Test extends Model {
    foo = 0;
    bar = 1;
    baz?: number;
  }
  
  const values = {
    foo: 1,
    bar: 2,
    baz: 3
  }
  
  it("will assign values", async () => {
    const test = Test.new();

    expect(test.foo).toBe(0);
    expect(test.bar).toBe(1);

    test.set(values);

    await expect(test).toHaveUpdated(["foo", "bar"]);

    expect(test.foo).toBe(1);
    expect(test.bar).toBe(2);
  });

  it("will assign specific values", async () => {
    const test = Test.new();
    
    test.set(values, ["foo"]);

    await expect(test).toHaveUpdated(["foo"]);

    expect(test.foo).toBe(1);
    expect(test.bar).toBe(1);
  });
})

describe("get", () => {
  class Test extends Model {
    foo = "foo"
    bar = "bar"
    baz = "baz"
  }
  
  it("will export all values", () => {
    const test = Test.new();
    const values = test.get();

    expect(values).toEqual({
      foo: "foo",
      bar: "bar",
      baz: "baz"
    })
  })
  
  it("will export selected values", () => {
    const test = Test.new();
    const values = test.get(["foo", "bar"]);

    expect(values).toEqual({
      foo: "foo",
      bar: "bar"
    })
  })

  it("will export single value", () => {
    const test = Test.new();
    const value = test.get("foo");

    expect(value).toBe("foo");
  })
  
  it('will export "current" of property', async () => {
    class Test extends Model {
      foo = ref<string>();
    }

    const test = Test.new();

    expect(test.get("foo")).toBeUndefined();

    test.foo("foobar");
    await expect(test).toUpdate();

    expect(test.get("foo")).toBe("foobar");
  })

  it("will observe value", async () => {
    const test = Test.new();
    const didUpdate = jest.fn();
    const cancel = test.get("foo", didUpdate);
    
    await test.set("foo", "foobar");

    expect(didUpdate).toBeCalledWith("foobar");
    
    await test.set("foo", "foobarbaz");

    expect(didUpdate).toBeCalledWith("foobarbaz");
    expect(didUpdate).toBeCalledTimes(2);

    cancel();

    await test.set("foo", "foo");

    expect(didUpdate).toBeCalledTimes(2);
  })

  it("will observe values", async () => {
    const test = Test.new();
    const didUpdate = jest.fn();
    const cancel = test.get(["foo"], didUpdate);
    
    await test.set("foo", "foobar");

    expect(didUpdate).toBeCalledWith({ foo: "foobar" });
    
    await test.set("foo", "foobarbaz");

    expect(didUpdate).toBeCalledWith({ foo: "foobarbaz" });
    expect(didUpdate).toBeCalledTimes(2);

    cancel();

    await test.set("foo", "foo");

    expect(didUpdate).toBeCalledTimes(2);
  })
})

describe("subscriber", () => {
  class Subject extends Model {
    value = 1;
    value2 = 2;
  }

  it('will detect change to properties accessed', async () => {
    const state = Subject.new();
    const effect = jest.fn(($: Subject) => {
      void $.value;
      void $.value2;
    })

    state.on(effect);

    state.value = 2;
    await state.on(0);

    state.value2 = 3;
    await state.on(0);

    expect(effect).toBeCalledTimes(3);
  })

  it('will ignore change to property not accessed', async () => {
    const state = Subject.new();
    const effect = jest.fn(($: Subject) => {
      void $.value;
    })

    state.on(effect);

    state.value = 2;
    await state.on(0);

    state.value2 = 3;
    await state.on(0);

    /**
     * we did not access value2 in above accessor,
     * subscriber assumes we don't care about updates
     * to this property, so it'l drop relevant events
     */ 
    expect(effect).toBeCalledTimes(2);
  });

  it('will ignore properties accessed through get', async () => {
    const state = Subject.new();
    const effect = jest.fn(($: Subject) => {
      void $.value;
      void $.is.value;
    })

    state.on(effect);

    state.value = 2;
    await state.on(0);

    state.value2 = 3;
    await state.on(0);

    expect(effect).toBeCalledTimes(2);
  })

  it('will not obstruct set-behavior', () => {
    class Test extends Model {
      didSet = jest.fn();
      value = set("foo", this.didSet);
    }

    const test = Test.new();

    expect(test.value).toBe("foo");

    test.on(effect => {
      effect.value = "bar";
    })

    expect(test.value).toBe("bar");
    expect(test.didSet).toBeCalledWith("bar", test);
  })
})