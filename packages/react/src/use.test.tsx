import { Model } from './';
import { mockHook } from './tests';

class Test extends Model {
  value = "foo";
};

it("will create instance given a class", () => {
  const hook = mockHook(() => Test.use());

  expect(hook.current).toBeInstanceOf(Test);
})
  
it('will assign is as a circular reference', async () => {
  const { current } = mockHook(() => Test.use());

  expect(current.is.value).toBe("foo");

  current.value = "bar";
  await expect(current).toUpdate();

  expect(current.is.value).toBe("bar")
})

it("will subscribe to instance of controller", async () => {
  const hook = mockHook(() => Test.use());

  expect(hook.current.value).toBe("foo");

  await hook.waitFor(() => {
    hook.current.value = "bar";
  });

  expect(hook.current.value).toBe("bar");
})

it("will run callback", () => {
  const callback = jest.fn();

  mockHook(() => Test.use(callback));
  expect(callback).toBeCalledWith(expect.any(Test));
})

it("will destroy instance of given class", async () => {
  const didDestroy = jest.fn();

  class Test extends Model {
    null(){
      super.null();
      didDestroy();
    }
  }

  const hook = mockHook(() => Test.use());

  expect(didDestroy).not.toBeCalled();

  await hook.unmount();

  expect(didDestroy).toBeCalled();
})

it("will ignore updates after unmount", async () => {
  const hook = mockHook(() => {
    const test = Test.use();
    void test.value;
    return test.is;
  });

  const test = hook.current;

  await hook.waitFor(() => {
    test.value = "bar";
  });

  hook.unmount();

  test.value = "baz";
})

describe("callback argument", () => {
  class Test extends Model {
    foo?: string = undefined;
    bar?: string = undefined;
  }

  it.skip("will run callback once", async () => {
    const callback = jest.fn();

    const element = mockHook(() => Test.use(callback));
    expect(callback).toHaveBeenCalledTimes(1);

    await element.update(() => Test.use(callback));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(element).toHaveBeenCalledTimes(2);
  })

  it.skip("will run callback on every render", async () => {
    const callback = jest.fn();

    const element = mockHook(() => Test.use(callback, true));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(element).toHaveBeenCalledTimes(1);

    await element.update(() => Test.use(callback, true));

    expect(callback).toHaveBeenCalledTimes(2);
    expect(element).toHaveBeenCalledTimes(2);
  })

  it.skip("will include updates in callback without reload", async () => {
    class Test extends Model {
      foo = 0;
      bar = 0;
    };
  
    const hook = mockHook(() => {
      const test = Test.use(test => {
        test.foo += 1;
      }, true);

      void test.foo;
      void test.bar;
      
      return test;
    });

    // does have value change in callback
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.current.foo).toBe(1);

    // does still respond to normal updates
    await hook.waitFor(() => {
      hook.current.bar = 2;
    });

    expect(hook).toHaveBeenCalledTimes(2);
    expect(hook.current.foo).toBe(2);
  });
})

describe("props argument", () => {
  class Test extends Model {
    foo?: string = undefined;
    bar?: string = undefined;
  }
  
  it.skip("will apply props to model", async () => {
    const mockExternal = {
      foo: "foo",
      bar: "bar"
    }
  
    const didRender = jest.fn();
  
    const hook = mockHook(() => {
      didRender();
      return Test.use(mockExternal);
    });
  
    expect(hook.current).toMatchObject(mockExternal);
  })
  
  it.skip("will apply props only once by default", async () => {
    const hook = mockHook(() => {
      return Test.use({ foo: "foo", bar: "bar" });
    });

    expect(hook.current).toMatchObject({ foo: "foo", bar: "bar" });
    
    // TODO: Can this update be supressed?
    await expect(hook.current).toUpdate();

    hook.update(() => {
      return Test.use({ foo: "bar", bar: "foo" })
    });

    await expect(hook.current).not.toUpdate();

    hook.current.foo = "bar";

    await expect(hook.current).toUpdate();

    expect(hook.current.foo).toBe("bar");
    expect(hook).toBeCalledTimes(3);
  })
  
  it.skip("will apply props per-render", async () => {
    const hook = mockHook(() => {
      return Test.use({ foo: "foo", bar: "bar" }, true);
    });

    expect(hook.current).toMatchObject({ foo: "foo", bar: "bar" });
    
    // TODO: Can this update be supressed?
    await expect(hook.current).toUpdate();

    hook.update(() => {
      return Test.use({ foo: "bar", bar: "foo" }, true)
    });

    await expect(hook.current).toUpdate();

    expect(hook.current.foo).toBe("bar");
    expect(hook).toBeCalledTimes(2);
  })
  
  it("will apply props over (untracked) arrow functions", () => {
    class Test extends Model {
      foobar = () => "Hello world!";
    }
  
    const mockExternal = {
      foobar: () => "Goodbye cruel world!"
    }
  
    const hook = mockHook(() => {
      return Test.use(mockExternal);
    });
  
    const { foobar } = hook.current;
  
    expect(foobar).toBe(mockExternal.foobar);
  })
  
  it.skip("will not apply props over methods", () => {
    class Test extends Model {
      foobar(){
        return "Hello world!";
      };
    }
  
    const mockExternal = {
      foobar: () => "Goodbye cruel world!"
    }
  
    const hook = mockHook(() => {
      return Test.use(mockExternal);
    });
  
    const { foobar } = hook.current;
  
    expect(foobar).not.toBe(mockExternal.foobar);
  })
  
  it.skip("will ignore updates itself caused", async () => {
    const hook = mockHook(() => {
      return Test.use({}, true);
    })

    hook.update(() => {
      return Test.use({ foo: "bar" }, true);
    })

    await expect(hook.current).toUpdate();

    expect(hook).toBeCalledTimes(2);
  })
})