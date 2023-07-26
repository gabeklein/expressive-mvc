import { mockAsync, timeout } from '../helper/testing';
import { Model } from '../model';
import { use } from './use';

class Child extends Model {
  value = "foo"
}

class Parent extends Model {
  value = "foo";
  child = use(Child);
}

it('will track recursively', async () => {
  const parent = Parent.new();
  const mock = jest.fn((it: Parent) => {
    void it.value;
    void it.child.value;
  })

  expect(parent.value).toBe("foo");
  expect(parent.child.value).toBe("foo");

  parent.get(mock);

  parent.value = "bar";
  await expect(parent).toUpdate();
  expect(mock).toHaveBeenCalledTimes(2)

  parent.child.value = "bar";
  await expect(parent.child).toUpdate();
  expect(mock).toHaveBeenCalledTimes(3)
})

it('will accept instance', async () => {
  const child = Child.new();

  class Parent extends Model {
    child = use(child);
  }

  const state = Parent.new();
  const mock = jest.fn((it: Parent) => {
    void it.child.value;
  })

  state.get(mock);

  expect(state.child.value).toBe("foo");

  state.child.value = "bar";
  await expect(state.child).toUpdate();

  expect(mock).toBeCalledTimes(2);
  expect(state.child.value).toBe("bar");
})

it('will run callback', () => {
  const callback = jest.fn();

  class Parent extends Model {
    child = use(Child, callback);
  }

  Parent.new();

  expect(callback).toBeCalled();
})

it('will update on new value', async () => {
  const state = Parent.new();
  const mock = jest.fn((it: Parent) => {
    void it.value;
    void it.child.value;
  })

  state.get(mock);

  expect(state.child.value).toBe("foo");

  // Will refresh on sub-value change.
  state.child.value = "bar";
  await expect(state.child).toUpdate();
  expect(state.child.value).toBe("bar");
  expect(mock).toBeCalledTimes(2);

  // Will refresh on repalcement.
  state.child = new Child();
  await expect(state).toUpdate();
  expect(state.child.value).toBe("foo");
  expect(mock).toBeCalledTimes(3);

  // New subscription still works.
  state.child.value = "bar";
  await expect(state.child).toUpdate();
  expect(state.child.value).toBe("bar");
  expect(mock).toBeCalledTimes(4);
})

it('will reset if value is undefined', async () => {
  class Parent extends Model {
    value = "foo";
    child = use<Child>();
  }

  const state = Parent.new();
  const mock = jest.fn((it: Parent) => {
    void it.value;

    if(it.child)
      void it.child.value;
  })

  state.get(mock);

  state.child = new Child();
  await expect(state).toUpdate();
  expect(mock).toBeCalledTimes(2)

  // Will refresh on sub-value change.
  state.child.value = "bar";
  await expect(state.child).toUpdate();
  expect(mock).toBeCalledTimes(3);

  // Will refresh on undefined.
  state.child = undefined;
  await expect(state).toUpdate();
  expect(state.child).toBeUndefined();
  expect(mock).toBeCalledTimes(4);

  // Will refresh on repalcement.
  state.child = new Child();
  await expect(state).toUpdate();
  expect(mock).toBeCalledTimes(5);

  // New subscription still works.
  state.child.value = "bar";
  await expect(state.child).toUpdate();
  expect(mock).toBeCalledTimes(6);
})

it('will still subscribe if initially undefined', async () => {
  class Parent extends Model {
    value = "foo";
    child = use<Child>();
  }

  const state = Parent.new();
  const mock = jest.fn((it: Parent) => {
    void it.value;

    if(it.child)
      void it.child.value;
  })

  state.get(mock);
  expect(state.child).toBeUndefined();

  // Will refresh on repalcement.
  state.child = new Child();
  await expect(state).toUpdate();
  expect(mock).toBeCalledTimes(2)

  // New subscription does work.
  state.child.value = "bar";
  await expect(state.child).toUpdate();
  expect(mock).toBeCalledTimes(3)

  // Will refresh on deletion.
  state.child = undefined;
  await expect(state).toUpdate();
  expect(mock).toBeCalledTimes(4)
})

describe("object", () => {
  it("will track object values", async () => {
    class Test extends Model {
      info = use({ foo: "foo" });
    }

    const test = Test.new();
    const effect = mockAsync((state: Test) => {
      void state.info.foo;
    });

    test.get(effect);
    test.info.foo = "bar";

    await effect.next();

    expect(effect).toBeCalledTimes(2);
  })

  it("will ignore untracked values", async () => {
    class Test extends Model {
      info = use({
        foo: "foo",
        bar: "bar"
      });
    }

    const test = Test.new();
    const effect = jest.fn((state: Test) => {
      void state.info.foo;
    });

    test.get(effect);

    expect(effect).toBeCalledTimes(1);

    test.info.bar = "foo";

    await timeout(0);

    expect(effect).toBeCalledTimes(1);
  })

  it("will update original object", async () => {
    const data = { foo: "foo" };

    class Test extends Model {
      info = use(data);
    }

    const test = Test.new();
    
    test.info.foo = "bar";

    expect(data.foo).toBe("bar");
  })

  it("will passthru original object", async () => {
    const data = {
      foo: "foo",
      action(){
        this.foo = "bar";
      }
    }

    class Test extends Model {
      info = use(data);
    }

    const test = Test.new();
    
    test.info.action();

    expect(test.info.foo).toBe("bar");
  })

  // TODO: inspect this behavior
  describe("set method", () => {
    it("will assign to property", () => {
      class Test extends Model {
        info = use({
          foo: "foo"
        });
      }

      const { info } = Test.new();

      info.set({ foo: "bar" });
      
      expect(info.foo).toBe("bar");
    })

    it("will add value to observe", async () => {
      class Test extends Model {
        info = use<string>({});
      }

      const { info } = Test.new();
      const gotFoo = jest.fn();
  
      await info.set({ foo: "bar" }, true);
      expect(info.foo).toBe("bar");

      info.get("foo", gotFoo);
      info.foo = "foo";
  
      await info.set(0);
      expect(gotFoo).toHaveBeenCalled();
    })

    it("will callback on update", async () => {
      class Test extends Model {
        info = use({ foo: "foo" });
      }
  
      const { info } = Test.new();
      const gotFoo = mockAsync();

      expect<{ foo: string }>(info);

      const done = info.set(gotFoo);

      info.foo = "bar";

      expect(gotFoo).toHaveBeenCalledTimes(1);

      /* will unsubscribe when done is called */

      done();
      info.foo = "baz";

      expect(gotFoo).toHaveBeenCalledTimes(1);
    })
  
    it("will watch keys added to record", async () => {
      class Test extends Model {
        info = use<string>({});
      }

      const { info } = Test.new();
      const gotFoo = jest.fn();

      expect<Record<string, string>>(info);
  
      info.get("foo", gotFoo);
      info.foo = "bar";
  
      await info.set(0);
      expect(gotFoo).toHaveBeenCalled();
    })
  })
})