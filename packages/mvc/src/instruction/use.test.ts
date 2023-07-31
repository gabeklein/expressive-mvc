import { mockAsync, mockPromise, timeout } from '../helper/testing';
import { Model } from '../model';
import { use } from './use';

class Child extends Model {
  value = "foo"
}

class Parent extends Model {
  value = "foo";
  child = use(Child);
}

it('will subscribe recursively', async () => {
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

it('will subscribe deeply', async () => {
  class Parent extends Model {
    value = "foo";
    empty = undefined;
    child = use(Child);
  }

  class Child extends Model {
    value = "foo"
    grandchild = use(GrandChild);
  }

  class GrandChild extends Model {
    value = "bar"
  }

  const parent = Parent.new();
  const effect = jest.fn();
  let promise = mockPromise();

  parent.get(state => {
    const { child } = state;
    const { grandchild } = child;

    effect(child.value, grandchild.value);
    promise.resolve();
  })

  expect(effect).toBeCalledWith("foo", "bar");
  effect.mockClear();

  promise = mockPromise();
  parent.child.value = "bar";
  await promise;
  
  expect(effect).toBeCalledWith("bar", "bar");
  effect.mockClear();

  promise = mockPromise();
  parent.child = new Child();
  await promise;
  
  expect(effect).toBeCalledWith("foo", "bar");
  effect.mockClear();

  promise = mockPromise();
  parent.child.value = "bar";
  await promise;
  
  expect(effect).toBeCalledWith("bar", "bar");
  effect.mockClear();

  promise = mockPromise();
  parent.child.grandchild.value = "foo";
  await promise;
  
  expect(effect).toBeCalledWith("bar", "foo");
  effect.mockClear();
});

it('will accept instance', async () => {
  class Parent extends Model {
    child = use(new Child());
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

it('will only reassign a matching model', () => {
  class Child extends Model {}
  class Unrelated extends Model {};
  class Parent extends Model {
    child = use(Child);
  }

  const parent = Parent.new("ID");

  expect(() => {
  parent.child = Unrelated.new("ID");
}).toThrowError(`Parent-ID.child expected Model of type Child but got Unrelated-ID.`)

  expect(() => {
  // @ts-expect-error
  parent.child = undefined;
}).toThrowError(`Parent-ID.child expected Model of type Child but got undefined.`)
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

    await timeout(1);

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

  it.todo("will assign new object")
})