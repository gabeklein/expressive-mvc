import { Model, renderHook, testAsync, use } from './adapter';

const opts = { timeout: 100 };

describe("tap", () => {
  class Parent extends Model {
    value = "foo";
    empty = undefined;
    child = use(Child);
  }
  
  class Child extends Model {
    value = "foo"
    grandchild = new GrandChild();
  }
  
  class GrandChild extends Model {
    value = "bar"
  }

  it('will access subvalue directly', async () => {
    const parent = Parent.create();

    const { result, waitForNextUpdate } =
      renderHook(() => parent.tap("value"))
  
    expect(result.current).toBe("foo");
  
    parent.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  })
  
  it('will access child controller', async () => {
    const parent = Parent.create();
    const { result, waitForNextUpdate } = renderHook(() => {
      return parent.tap("child").value;
    })
  
    expect(result.current).toBe("foo");
  
    parent.child.value = "bar"
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  
    parent.child = new Child();
    await waitForNextUpdate(opts);
    expect(result.current).toBe("foo");
  
    parent.child.value = "bar"
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  })
})

describe("computed", () => {
  class Test extends Model {
    foo = 1;
    bar = 2;
    baz = 3;
  }

  it('will select and subscribe to subvalue', async () => {
    const parent = Test.create();

    const { result, waitForNextUpdate } = renderHook(() => {
      return parent.tap(x => x.foo);
    });

    expect(result.current).toBe(1);

    parent.foo = 2;
    await waitForNextUpdate();

    expect(result.current).toBe(2);
  })

  it('will compute output', async () => {
    const parent = Test.create();
    const { result, waitForNextUpdate } =
      renderHook(() => parent.tap(x => x.foo + x.bar));
  
    expect(result.current).toBe(3);

    parent.foo = 2;
    await waitForNextUpdate(opts);

    expect(result.current).toBe(4);
  })  

  it('will ignore updates with same result', async () => {
    const parent = Test.create();
    const compute = jest.fn();
    const render = jest.fn();

    const { result } = renderHook(() => {
      render();
      return parent.tap(x => {
        compute();
        void x.foo;
        return x.bar;
      });
    });

    expect(result.current).toBe(2);
    expect(compute).toBeCalled();

    parent.foo = 2;
    await parent.update();

    // did attempt a second compute
    expect(compute).toBeCalledTimes(2);

    // compute did not trigger a new render
    expect(render).toBeCalledTimes(1);
    expect(result.current).toBe(2);
  })
})

describe("async", () => {
  class Test extends Model {
    foo = "bar";
  };

  it('will return undefined then refresh', async () => {
    const promise = testAsync<string>();
    const control = Test.create();

    const { result, waitForNextUpdate } = renderHook(() => {
      return control.tap(async () => promise.await());
    });

    expect(result.current).toBeUndefined();

    promise.resolve("foobar");
    await waitForNextUpdate();

    expect(result.current).toBe("foobar");
  });

  it('will not refresh via subscription', async () => {
    const promise = testAsync<string>();
    const control = Test.create();

    const { result, waitForNextUpdate } = renderHook(() => {
      return control.tap(async $ => {
        void $.foo;
        return promise.await();
      });
    });

    control.foo = "foo";
    await expect(waitForNextUpdate(opts)).rejects.toThrowError();

    promise.resolve("foobar");
    await waitForNextUpdate();

    expect(result.current).toBe("foobar");
  });
})