import { mockPromise } from '../helper/testing';
import { Model } from '../model';
import { get } from './get';
import { set } from './set';
import { Oops, use } from './use';

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

  parent.on(mock);

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

  state.on(mock);

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

  state.on(mock);

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

  state.on(mock);

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

  state.on(mock);
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

it('will throw if bad argument type', () => {
  class Parent extends Model {
    // @ts-ignore
    child = use(1);
  }

  const expected = Oops.BadArgument("number");
  const attempt = () => Parent.new();

  expect(attempt).toThrowError(expected)
})

describe("factory", () => {
  it('will create from factory', async () => {
    class Child extends Model {
      parent = get(Parent);
    }

    class Parent extends Model {
      child = use(() => new Child());
    }

    const state = Parent.new();

    expect(state.child).toBeInstanceOf(Child);
    expect(state.child.parent).toBe(state);
  })

  it('will rethrow error', () => {
    class Parent extends Model {
      child = use(() => {
        throw new Error("foobar");
      });
    }

    const test = () => void Parent.new();

    expect(test).toThrowError();
  })

  it('will create via async factory', async () => {
    class Parent extends Model {
      child = use(async () => new Child());
    }

    const parent = Parent.new();
    await parent.on();

    expect(parent.child).toBeInstanceOf(Child);
    
    parent.child.value = "foobar";
    await expect(parent.child).toUpdate();
  });

  it('will rethrow rejection upon access', async () => {
    class Parent extends Model {
      child = use(async () => {
        throw new Error("foobar");
      });
    }

    const parent = Parent.new();

    await parent.on();

    const test = () => void parent.child;

    expect(test).toThrowError();
  })

  it('will suspend if accessed before resolved', async () => {
    class Parent extends Model {
      child = use(async () => {
        return await child;
      });
    }

    const child = mockPromise<Child>();
    const parent = Parent.new();
    const mock = jest.fn((it: Parent) => {
      void it.child;
    });

    parent.on(mock);

    expect(mock).toBeCalledTimes(1);
    expect(mock).toHaveReturnedTimes(0);

    child.resolve(new Child());

    await parent.on();
    expect(parent.child).toBeInstanceOf(Child);

    // mayRetry is refreshing in addition to natural update;
    // expect(mock).toBeCalledTimes(2);
    
    parent.child.value = "foobar";

    await expect(parent.child).toUpdate();
    expect(mock).toBeCalledTimes(3);
  });

  it('will return undefined if not required', async () => {
    class Parent extends Model {
      child = use(async () => new Child(), false);
    }

    const parent = Parent.new();

    expect(parent.child).toBeUndefined();

    await parent.on();
    expect(parent.child).toBeInstanceOf(Child);
  });

  it('will wait for dependancies on suspense', async () => {
    class Parent extends Model {
      value = set<string>();
      child = use(() => {
        tryCreateChild();
        void this.value;
    
        return new Child();
      });
    }

    const tryCreateChild = jest.fn();
    const parent = Parent.new();

    parent.value = "foo";

    await parent.on();
    expect(tryCreateChild).toBeCalledTimes(2);
  });
})