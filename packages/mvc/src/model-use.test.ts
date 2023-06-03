import { render } from './helper/mocks';
import { Model } from './model';

class Test extends Model {
  value = "foo";
};

it("will create instance given a class", () => {
  const hook = render(() => Test.use());

  expect(hook.output).toBeInstanceOf(Test);
})
  
it('will assign is as a circular reference', async () => {
  const { output } = render(() => Test.use());

  expect(output.is.value).toBe("foo");

  output.value = "bar";
  await expect(output).toUpdate();

  expect(output.is.value).toBe("bar")
})

it("will subscribe to instance of controller", async () => {
  const hook = render(() => Test.use());

  expect(hook.output.value).toBe("foo");
  hook.output.value = "bar";

  await hook.update();
  expect(hook.output.value).toBe("bar");
})

it("will run callback", () => {
  const callback = jest.fn();

  render(() => Test.use(callback));
  expect(callback).toHaveBeenCalledWith(expect.any(Test));
})

it("will destroy instance of given class", () => {
  const didDestroy = jest.fn();

  class Test extends Model {
    null(){
      super.null();
      didDestroy();
    }
  }

  const hook = render(() => Test.use());

  expect(didDestroy).not.toBeCalled();
  hook.unmount();
  expect(didDestroy).toBeCalled();
})

it("will ignore updates after unmount", async () => {
  const hook = render(() => {
    const test = Test.use();
    void test.value;
    return test.is;
  });

  const test = hook.output;

  test.value = "bar";
  await hook.update();

  hook.unmount();
  test.value = "baz";
})

describe("callback argument", () => {
  class Test extends Model {
    foo?: string = undefined;
    bar?: string = undefined;
  }

  it("will run callback once", async () => {
    const callback = jest.fn();

    const element = render(() => Test.use(callback));
    expect(callback).toHaveBeenCalledTimes(1);

    await element.update(() => Test.use(callback));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(element).toHaveBeenCalledTimes(2);
  })

  it("will run callback on every render", async () => {
    const callback = jest.fn();

    const element = render(() => Test.use(callback, true));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(element).toHaveBeenCalledTimes(1);

    await element.update(() => Test.use(callback, true));

    expect(callback).toHaveBeenCalledTimes(2);
    expect(element).toHaveBeenCalledTimes(2);
  })

  it("will include updates in callback without reload", async () => {
    class Test extends Model {
      foo = 0;
      bar = 0;
    };
  
    const hook = render(() => {
      const test = Test.use(test => {
        test.foo += 1;
      }, true);

      void test.foo;
      void test.bar;
      
      return test;
    });

    // does have value change in callback
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.output.foo).toBe(1);

    // does still respond to normal updates
    hook.output.bar = 2;
    await hook.update();

    expect(hook).toHaveBeenCalledTimes(2);
    expect(hook.output.foo).toBe(2);
  });
})

describe("props argument", () => {
  class Test extends Model {
    foo?: string = undefined;
    bar?: string = undefined;
  }
  
  it("will apply props to model", async () => {
    const mockExternal = {
      foo: "foo",
      bar: "bar"
    }
  
    const didRender = jest.fn();
  
    const hook = render(() => {
      didRender();
      return Test.use(mockExternal);
    });
  
    expect(hook.output).toMatchObject(mockExternal);
  })
  
  it("will apply props only once by default", async () => {
    const hook = render(() => {
      return Test.use({ foo: "foo", bar: "bar" });
    });

    expect(hook.output).toMatchObject({ foo: "foo", bar: "bar" });
    
    // TODO: Can this update be supressed?
    await expect(hook.output).toUpdate();

    hook.update(() => {
      return Test.use({ foo: "bar", bar: "foo" })
    });

    await expect(hook.output).not.toUpdate();

    hook.output.foo = "bar";

    await expect(hook.output).toUpdate();

    expect(hook.output.foo).toBe("bar");
    expect(hook).toBeCalledTimes(3);
  })
  
  it("will apply props per-render", async () => {
    const hook = render(() => {
      return Test.use({ foo: "foo", bar: "bar" }, true);
    });

    expect(hook.output).toMatchObject({ foo: "foo", bar: "bar" });
    
    // TODO: Can this update be supressed?
    await expect(hook.output).toUpdate();

    hook.update(() => {
      return Test.use({ foo: "bar", bar: "foo" }, true)
    });

    await expect(hook.output).toUpdate();

    expect(hook.output.foo).toBe("bar");
    expect(hook).toBeCalledTimes(2);
  })
  
  it("will apply props over (untracked) arrow functions", () => {
    class Test extends Model {
      foobar = () => "Hello world!";
    }
  
    const mockExternal = {
      foobar: () => "Goodbye cruel world!"
    }
  
    const hook = render(() => {
      return Test.use(mockExternal);
    });
  
    const { foobar } = hook.output;
  
    expect(foobar).toBe(mockExternal.foobar);
  })
  
  it("will not apply props over methods", () => {
    class Test extends Model {
      foobar(){
        return "Hello world!";
      };
    }
  
    const mockExternal = {
      foobar: () => "Goodbye cruel world!"
    }
  
    const hook = render(() => {
      return Test.use(mockExternal);
    });
  
    const { foobar } = hook.output;
  
    expect(foobar).not.toBe(mockExternal.foobar);
  })
  
  it("will ignore updates itself caused", async () => {
    const hook = render(() => {
      return Test.use({}, true);
    })

    hook.update(() => {
      return Test.use({ foo: "bar" }, true);
    })

    await expect(hook.output).toUpdate();

    expect(hook).toBeCalledTimes(2);
  })
})