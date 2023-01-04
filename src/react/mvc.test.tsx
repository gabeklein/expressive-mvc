import { mockAsync, mockSuspense, renderHook } from '../../tests/adapter';
import { use } from '../instruction/use';
import { Global, Oops } from './global';
import { MVC } from './mvc';

const opts = { timeout: 100 };

describe("get method", () => {
  class Test extends Global {
    value = 1;
  }

  beforeEach(() => Test.reset());

  it("will get instance", () => {
    const instance = Test.create();
    const { result } = renderHook(() => Test.get());

    expect(result.current).toBe(instance);
    expect(result.current!.value).toBe(1);
  })

  it("will get instance value", () => {
    Test.create();
    const { result } = renderHook(() => Test.get("value"));

    expect(result.current).toBe(1);
  })

  it("will complain if not-found in expect mode", () => {
    const { result } = renderHook(() => Test.get(true));
    const expected = Oops.DoesNotExist(Test.name);

    expect(() => result.current).toThrowError(expected);
  })
})

describe("use method", () => {
  it('will attach existing model', () => {
    class Test extends MVC {
      value = "";
    }

    const test = Test.create();

    const render = renderHook(() => {
      return test.use();
    });

    expect(render.result.current).not.toBe(test);
    expect(render.result.current.is).toBe(test);

    render.unmount();
  })
})

describe("meta method", () => {
  class Child extends MVC {
    value = "foo";
  }

  class Parent extends MVC {
    static value = "foo";
    static value2 = "bar";
    static child = use(Child);
  }

  beforeEach(() => Parent.value = "foo");

  it('will track static values', async () => {
    const render = renderHook(() => {
      const meta = Parent.meta();
      return meta.value;
    });

    expect(render.result.current).toBe("foo");

    Parent.value = "bar";
    await render.waitForNextUpdate(opts);
    expect(render.result.current).toBe("bar");

    Parent.value = "baz";
    await render.waitForNextUpdate(opts);
    expect(render.result.current).toBe("baz");
  })

  it('will track specific value', async () => {
    const render = renderHook(() => {
      return Parent.meta(x => x.value2);
    });

    expect(render.result.current).toBe("bar");

    Parent.value2 = "foo";
    await render.waitForNextUpdate(opts);
    expect(render.result.current).toBe("foo");
  })

  it('will track child controller values', async () => {
    const {
      result: { current },
      waitForNextUpdate
    } = renderHook(() => {
      const meta = Parent.meta();
      void meta.child.value;
      return meta;
    });

    expect(current.child.value).toBe("foo");

    // Will refresh on sub-value change.
    current.child.value = "bar";
    await waitForNextUpdate(opts);
    expect(current.child.value).toBe("bar");

    // Will refresh on repalcement.
    current.child = new Child();
    await waitForNextUpdate(opts);
    expect(current.child.value).toBe("foo");

    // Fresh subscription still works.
    current.child.value = "bar";
    await waitForNextUpdate(opts);
    expect(current.child.value).toBe("bar");
  })
})

describe("tap method", () => {
  class Parent extends MVC {
    value = "foo";
    empty = undefined;
    child = use(Child);
  }

  class Child extends MVC {
    value = "foo"
    grandchild = new GrandChild();
  }

  class GrandChild extends MVC {
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

describe("tap method computed", () => {
  class Test extends MVC {
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

describe("tap method async", () => {
  class Test extends MVC {
    foo = "bar";
  };

  it('will return undefined then refresh', async () => {
    const promise = mockAsync<string>();
    const control = Test.create();

    const { result, waitForNextUpdate } = renderHook(() => {
      return control.tap(async () => promise.pending());
    });

    expect(result.current).toBeUndefined();

    promise.resolve("foobar");
    await waitForNextUpdate();

    expect(result.current).toBe("foobar");
  });

  it('will not refresh via subscription', async () => {
    const promise = mockAsync<string>();
    const control = Test.create();

    const { result, waitForNextUpdate } = renderHook(() => {
      return control.tap(async $ => {
        void $.foo;
        return promise.pending();
      });
    });

    control.foo = "foo";
    await expect(waitForNextUpdate(opts)).rejects.toThrowError();

    promise.resolve("foobar");
    await waitForNextUpdate();

    expect(result.current).toBe("foobar");
  });
})

describe("tap method suspense", () => {
  class Test extends MVC {
    value?: string = undefined;
  }

  it('will suspend if property undefined', async () => {
    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("value", true);
      promise.resolve();
    })

    test.assertDidSuspend(true);

    instance.value = "foo!";
    await promise.pending();

    test.assertDidRender(true);
  })

  it('will suspend strict compute', async () => {
    const instance = Test.create() as Test;
    const promise = mockAsync();
    const test = mockSuspense();

    const didRender = jest.fn();
    const didCompute = jest.fn();

    test.renderHook(() => {
      promise.resolve();
      didRender();

      instance.tap(state => {
        didCompute();
        if(state.value == "foobar")
          return true;
      }, true);
    })

    test.assertDidSuspend(true);

    expect(didCompute).toBeCalledTimes(1);

    instance.value = "foobar";
    await promise.pending();

    // 1st - render prior to bailing
    // 2nd - successful render
    expect(didRender).toBeCalledTimes(2);

    // 1st - initial render fails
    // 2nd - recheck success (permit render again)
    // 3rd - hook regenerated next render 
    expect(didCompute).toBeCalledTimes(3);
  })

  it('will suspend strict async', async () => {
    const instance = Test.create();
    const promise = mockAsync();
    const test = mockSuspense();

    test.renderHook(() => {
      instance.tap(async () => {
        await promise.pending();
      }, true);
    })

    test.assertDidSuspend(true);

    promise.resolve();
    await test.waitForNextRender();

    test.assertDidRender(true);
  })
})