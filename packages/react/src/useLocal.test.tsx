import React from 'react';
import { create } from 'react-test-renderer';

import Model, { get, Provider, set } from '.';
import { mockHook, mockPromise } from './mocks';

class Test extends Model {
  value = "foo";
};

describe("hook", () => {
  it("will create instance given a class", () => {
    const hook = mockHook(() => Test.use());
  
    expect(hook.output).toBeInstanceOf(Test);
  })

  it("will not create abstract class", () => {
    const Test = () => {
      // @ts-expect-error
      expect(() => Model.use()).toThrowError();
      return null;
    }

    create(<Test />);
  })
    
  it('will assign `is` as a circular reference', async () => {
    const { output } = mockHook(() => Test.use());
  
    expect(output.is.value).toBe("foo");
  
    output.value = "bar";
    await expect(output).toHaveUpdated();
  
    expect(output.is.value).toBe("bar")
  })
  
  it("will subscribe to instance of controller", async () => {
    const hook = mockHook(() => Test.use());
  
    expect(hook.output.value).toBe("foo");
  
    await hook.act(() => {
      hook.output.value = "bar";
    });
  
    expect(hook.output.value).toBe("bar");
  })
  
  it("will run callback", () => {
    const callback = jest.fn();
  
    mockHook(() => Test.use(callback));
  
    expect(callback).toHaveBeenCalledWith(expect.any(Test));
  })
  
  it("will destroy instance of given class", async () => {
    const didDestroy = mockPromise();
  
    class Test extends Model {
      constructor(){
        super();
        this.get(null, didDestroy.resolve);
      }
    }
  
    const hook = mockHook(() => Test.use());
  
    hook.unmount();
  
    await didDestroy;
  })
  
  it("will ignore updates after unmount", async () => {
    const hook = mockHook(() => {
      const test = Test.use();
      void test.value;
      return test.is;
    });
  
    const test = hook.output;
  
    await hook.act(() => {
      test.value = "bar";
    });
  
    hook.unmount();
    test.value = "baz";
  })

  it("will bind methods to instance", async () => {
    class Test extends Model {
      current = 0;

      action(){
        this.current += 1;
      }
    }
    
    const hook = mockHook(() => {
      const { action, current } = Test.use();

      action();

      return current;
    });

    expect(hook.output).toBe(0);    

    await hook.update();

    expect(hook.output).toBe(1);

    hook.unmount();
  });
})

describe("callback argument", () => {
  class Test extends Model {
    foo?: string = undefined;
    bar?: string = undefined;
  }

  it("will run callback once", async () => {
    const callback = jest.fn();

    const hook = mockHook(() => Test.use(callback));
    expect(callback).toHaveBeenCalledTimes(1);

    await hook.update(() => Test.use(callback));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledTimes(2);
  })

  it("will run callback on every render", async () => {
    const callback = jest.fn();
    const hook = mockHook(() => {
      Test.use(callback, true);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledTimes(1);

    await hook.update(() => Test.use(callback, true));

    expect(callback).toHaveBeenCalledTimes(2);
    expect(hook).toHaveBeenCalledTimes(2);
  })

  it("will include updates in callback without reload", async () => {
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
    expect(hook.output.foo).toBe(1);

    // does still respond to normal updates
    await hook.act(() => {
      hook.output.bar = 2;
    });

    expect(hook).toHaveBeenCalledTimes(2);
    expect(hook.output.foo).toBe(2);
  });

  it("will run argument before effects", () => {
    const effect = jest.fn();
    const argument = jest.fn(() => {
      expect(effect).not.toHaveBeenCalled();
    });

    class Test extends Model {
      constructor(arg?: Model.Argument){
        super(arg);
        this.get(effect);
      }
    }

    mockHook(() => {
      Test.use(argument);
    });

    expect(argument).toHaveBeenCalled();
    expect(effect).toHaveBeenCalled();
  })
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
  
    const hook = mockHook(() => {
      didRender();
      return Test.use(mockExternal);
    });
  
    expect(hook.output).toMatchObject(mockExternal);
  })
  
  it("will apply props only once by default", async () => {
    const hook = mockHook(() => {
      return Test.use({ foo: "foo", bar: "bar" });
    });

    expect(hook.output).toMatchObject({ foo: "foo", bar: "bar" });

    await expect(hook.output).not.toHaveUpdated();

    hook.update(() => {
      return Test.use({ foo: "bar", bar: "foo" })
    });

    await expect(hook.output).not.toHaveUpdated();

    await hook.act(() => {
      hook.output.foo = "bar";
    });

    expect(hook.output.foo).toBe("bar");
    expect(hook).toBeCalledTimes(3);
  })
  
  it("will apply props per-render", async () => {
    const hook = mockHook(() => {
      return Test.use({ foo: "foo", bar: "bar" }, true);
    });

    expect(hook.output).toMatchObject({ foo: "foo", bar: "bar" });
    
    await expect(hook.output).not.toHaveUpdated();

    hook.update(() => {
      return Test.use({ foo: "bar", bar: "foo" }, true)
    });

    await expect(hook.output).toHaveUpdated();

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
  
    const hook = mockHook(() => {
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
  
    const { output } = mockHook(() => {
      return Test.use(mockExternal);
    });
  
    expect(output.foobar).not.toBe(mockExternal.foobar);
  })
  
  it("will ignore updates itself caused", async () => {
    const hook = mockHook(() => {
      return Test.use({}, true);
    })

    hook.update(() => {
      return Test.use({ foo: "bar" }, true);
    })

    await expect(hook.output).toHaveUpdated();

    expect(hook).toBeCalledTimes(2);
  })

  it("will trigger set instruction", () => {
    const mock = jest.fn();

    class Test extends Model {
      foo = set("foo", mock);
    }

    const { output } = mockHook(() => {
      return Test.use({ foo: "bar" });
    });

    expect(output.foo).toBe("bar");
    expect(mock).toHaveBeenCalledWith("bar", "foo");
  })
})

describe("context", () => {
  it("will attach before model init", () => {
    class Ambient extends Model {
      foo = "foo";
    }

    class Test extends Model {
      ambient = get(Ambient);

      constructor(){
        super(() => {
          expect(this.ambient).toBeInstanceOf(Ambient);
        });
      }
    }

    const Element = () => {
      const test = Test.use();
      expect(test.ambient.foo).toBe("foo");
      return null;
    }

    create(
      <Provider for={Ambient}>
        <Element />
      </Provider>
    )
  })
})