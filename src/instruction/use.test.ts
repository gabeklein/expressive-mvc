import { Model } from '..';
import { subscribeTo } from '../../tests/adapter';
import { Oops, use } from './use';
import { set } from './set';

class Child extends Model {
  value = "foo"
}

class Parent extends Model {
  value = "foo";
  child = use(Child);
}

it('will track recursively', async () => {
  const state = Parent.create();
  const mock = jest.fn((it: Parent) => {
    void it.value;
    void it.child.value;
  })

  expect(state.value).toBe("foo");
  expect(state.child.value).toBe("foo");

  state.effect(mock);

  state.value = "bar";
  await state.update(true);
  expect(mock).toHaveBeenCalledTimes(2)

  state.child.value = "bar";
  await state.child.update(true);
  expect(mock).toHaveBeenCalledTimes(3)
})

it('will accept instance', async () => {
  const child = Child.create();

  class Parent extends Model {
    child = use(child);
  }

  const state = Parent.create();
  const mock = jest.fn((it: Parent) => {
    void it.child.value;
  })

  state.effect(mock);

  expect(state.child.value).toBe("foo");

  state.child.value = "bar";
  await state.child.update(true);

  expect(mock).toBeCalledTimes(2);

  expect(state.child.value).toBe("bar");
})

it('will run callback', () => {
  const callback = jest.fn();

  class Parent extends Model {
    child = use(Child, callback);
  }

  Parent.create();

  expect(callback).toBeCalled();
})

it('will accept simple object', async () => {
  class Parent extends Model {
    child = use({ value: "foo" });
  }

  const state = Parent.create();
  const mock = jest.fn((it: Parent) => {
    void it.child.value;
  })

  state.effect(mock);

  // TODO: remove subscribeTo helper
  const update = subscribeTo(state, it => {
    void it.child.value;
  })

  expect(state.child.value).toBe("foo");

  state.child.value = "bar";
  await update();

  expect(state.child.value).toBe("bar");
})

it('will accept simple object as new value', async () => {
  class Parent extends Model {
    child = use({ value: "foo" });
  }

  const state = Parent.create();
  // TODO: remove subscribeTo helper
  const update = subscribeTo(state, it => {
    void it.child.value;
  })

  expect(state.child.value).toBe("foo");

  state.child.value = "bar";
  await update();
  expect(state.child.value).toBe("bar");

  // Will refresh on repalcement.
  state.child = { value: "baz" };
  await update();
  expect(state.child.value).toBe("baz");

  // New subscription still works.
  state.child.value = "bar";
  await update();
  expect(state.child.value).toBe("bar");
})

it('will create from factory', async () => {
  class Child extends Model {
    parent!: Parent;
  }

  class Parent extends Model {
    child = use(() => {
      const child = Child.create();
      child.parent = this;
      return child;
    });
  }

  const state = Parent.create();

  expect(state.child).toBeInstanceOf(Child);
  expect(state.child.parent).toBe(state);
})

it('will create from async factory', async () => {
  class Parent extends Model {
    child = use(async () => new Child());
  }

  const parent = Parent.create();
  await parent.update();

  expect(parent.child).toBeInstanceOf(Child);
  
  parent.child.value = "foobar";
  await parent.child.update(true);
});

it('will suspend if required', async () => {
  class Parent extends Model {
    child = use(async () => new Child());
  }

  const parent = Parent.create();
  const mock = jest.fn((it: Parent) => {
    void it.child;
  });

  parent.effect(mock);

  await parent.update();
  expect(parent.child).toBeInstanceOf(Child);
  
  parent.child.value = "foobar";

  await parent.child.update(true);
});

it('will return undefined if not required', async () => {
  class Parent extends Model {
    child = use(async () => new Child(), false);
  }

  const parent = Parent.create();

  expect(parent.child).toBeUndefined();

  await parent.update();
  expect(parent.child).toBeInstanceOf(Child);
});

it('will wait for dependancies on suspense', async () => {
  const createChild = jest.fn((it: Parent) => {
    void it.value;

    return new Child();
  });

  class Parent extends Model {
    value = set<string>();
    child = use(createChild);
  }

  const parent = Parent.create();

  parent.value = "foo";

  await parent.update();
  expect(createChild).toBeCalledTimes(2);
});

it('will accept undefined from factory', async () => {
  class Parent extends Model {
    child = use(() => undefined);
  }

  const state = Parent.create();

  expect(state.child).toBeUndefined();
})

it('will update on new value', async () => {
  const state = Parent.create();
  const mock = jest.fn((it: Parent) => {
    void it.value;
    void it.child.value;
  })

  state.effect(mock);

  expect(state.child.value).toBe("foo");

  // Will refresh on sub-value change.
  state.child.value = "bar";
  await state.child.update(true);
  expect(state.child.value).toBe("bar");
  expect(mock).toBeCalledTimes(2);

  // Will refresh on repalcement.
  state.child = new Child();
  await state.update(true);
  expect(state.child.value).toBe("foo");
  expect(mock).toBeCalledTimes(3);

  // New subscription still works.
  state.child.value = "bar";
  await state.child.update(true);
  expect(state.child.value).toBe("bar");
  expect(mock).toBeCalledTimes(4);
})

it('will reset if value is undefined', async () => {
  class Parent extends Model {
    value = "foo";
    child = use<Child>();
  }

  const state = Parent.create();
  const mock = jest.fn((it: Parent) => {
    void it.value;

    if(it.child)
      void it.child.value;
  })

  state.effect(mock);

  state.child = new Child();
  await state.update(true);
  expect(mock).toBeCalledTimes(2)

  // Will refresh on sub-value change.
  state.child.value = "bar";
  await state.child.update(true);
  expect(mock).toBeCalledTimes(3);

  // Will refresh on undefined.
  state.child = undefined;
  await state.update(true);
  expect(state.child).toBeUndefined();
  expect(mock).toBeCalledTimes(4);

  // Will refresh on repalcement.
  state.child = new Child();
  await state.update(true);
  expect(mock).toBeCalledTimes(5);

  // New subscription still works.
  state.child.value = "bar";
  await state.child.update(true);
  expect(mock).toBeCalledTimes(6);
})

it('will still subscribe if initially undefined', async () => {
  class Parent extends Model {
    value = "foo";
    child = use<Child>();
  }

  const state = Parent.create();
  const mock = jest.fn((it: Parent) => {
    void it.value;

    if(it.child)
      void it.child.value;
  })

  state.effect(mock);
  expect(state.child).toBeUndefined();

  // Will refresh on repalcement.
  state.child = new Child();
  await state.update(true);
  expect(mock).toBeCalledTimes(2)

  // New subscription does work.
  state.child.value = "bar";
  await state.child.update(true);
  expect(mock).toBeCalledTimes(3)

  // Will refresh on deletion.
  state.child = undefined;
  await state.update(true);
  expect(mock).toBeCalledTimes(4)
})

it('will throw if bad argument type', () => {
  class Parent extends Model {
    // @ts-ignore
    child = use(1);
  }

  const expected = Oops.BadArgument("number");
  const attempt = () => Parent.create();

  expect(attempt).toThrowError(expected)
})
