import { act, render, renderHook } from '@testing-library/react';

import { get, Model, Provider, set } from '.';

class Test extends Model {
  value = "foo";
};

describe("hook", () => {
  it("will create instance given a class", () => {
    const hook = renderHook(() => Test.use());
  
    expect(hook.result.current).toBeInstanceOf(Test);
  })

  it("will not create abstract class", () => {
    const Test = () => {
      // @ts-expect-error
      expect(() => Model.use()).toThrowError();
      return null;
    }

    render(<Test />);
  })
  
  it("will subscribe to instance of controller", async () => {
    const { result } = renderHook(() => Test.use());
  
    expect(result.current.value).toBe("foo");
  
    await act(async () => {
      result.current.value = "bar";
    });
  
    expect(result.current.value).toBe("bar");
  })
    
  it('will assign `is` as a circular reference', async () => {
    const { result } = renderHook(() => Test.use());
  
    expect(result.current.value).toBe("foo");
  
    await act(async () => {
      result.current.is.value = "bar";
    });
  
    expect(result.current.value).toBe("bar")
  })
  
  it("will run callback", () => {
    const callback = jest.fn();
  
    renderHook(() => Test.use(callback));
  
    expect(callback).toHaveBeenCalledWith(expect.any(Test));
  })
  
  it("will destroy instance of given class", async () => {
    const didDestroy = jest.fn();
  
    class Test extends Model {
      constructor(){
        super();
        this.get(null, didDestroy);
      }
    }

    const Component = () => void Test.use();

    const rendered = render(<Component />);
    
    rendered.unmount()

    expect(didDestroy).toHaveBeenCalled();
  })
  
  it("will ignore updates after unmount", async () => {
    const hook = renderHook(() => {
      const test = Test.use();
      void test.value;
      return test.is;
    });
  
    await act(async () => {
      hook.result.current.value = "bar";
    });
  
    hook.unmount();

    expect(() => {
      hook.result.current.value = "baz";
    }).toThrow()
  })

  it("will bind methods to instance", async () => {
    class Test extends Model {
      current = 0;

      action(){
        this.current++;
      }
    }
    
    const hook = renderHook(() => {
      const { action, current } = Test.use();

      action();

      return current;
    });

    expect(hook.result.current).toBe(0);    

    hook.rerender();

    expect(hook.result.current).toBe(1);

    hook.unmount();
  });

  it.skip("will not refresh for assignment in component", async () => {
    class Test extends Model {
      foo = 0;
      bar = 0;
    };
  
    const hook = renderHook(() => {
      const test = Test.use();

      void test.foo;
      void test.bar;

      test.foo += 1;
      
      return test;
    });

    // does have value change in callback
    expect(hook.result.current.foo).toBe(1);
 
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));

    // does still respond to normal updates
    await act(async () => {
      hook.result.current.bar = 2;
    });

    expect(hook.result.current.foo).toBe(2);
  });
  
  it.skip("will not refresh for update in componet", async () => {
    class Test extends Model {
      foo?: string = undefined;
      bar?: string = undefined;
    }

    const didRender = jest.fn();
    const hook = renderHook(({ foo }) => {
      const test = Test.use();
 
      didRender();
      test.set({ foo, bar: "bar" });

      return test;
    }, { initialProps: { foo: "foo" } });

    expect(hook.result.current).toMatchObject({ foo: "foo", bar: "bar" });
    
    hook.rerender({ foo: "bar" });

    expect(hook.result.current.foo).toBe("bar");

    await act(() => new Promise(resolve => setTimeout(resolve, 0)));

    expect(didRender).toHaveBeenCalledTimes(2);
  })
})

describe("callback argument", () => {
  class Test extends Model {
    foo?: string = undefined;
    bar?: string = undefined;
  }

  it("will run callback once", async () => {
    const callback = jest.fn();
    const hook = renderHook(() => Test.use(callback));

    expect(callback).toHaveBeenCalledTimes(1);

    hook.rerender(() => Test.use(callback));

    expect(callback).toHaveBeenCalledTimes(1);
  })

  it("will run argument before effects", () => {
    const effect = jest.fn();
    const argument = jest.fn(() => {
      expect(effect).not.toHaveBeenCalled();
    });

    class Test extends Model {
      constructor(...args: Model.Args){
        super(args);
        this.get(effect);
      }
    }

    renderHook(() => {
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
  
    const hook = renderHook(() => {
      didRender();
      return Test.use(mockExternal);
    });
  
    expect(hook.result.current).toMatchObject(mockExternal);
  })
  
  it("will apply props only once by default", async () => {
    const hook = renderHook(() => {
      return Test.use({ foo: "foo", bar: "bar" });
    });

    expect(hook.result.current).toMatchObject({ foo: "foo", bar: "bar" });

    await expect(hook.result.current).not.toHaveUpdated();

    hook.rerender(() => {
      return Test.use({ foo: "bar", bar: "foo" })
    });

    await expect(hook.result.current).not.toHaveUpdated();

    await act(async () => {
      hook.result.current.foo = "bar";
    });

    expect(hook.result.current.foo).toBe("bar");
  })
  
  it("will apply props over (untracked) arrow functions", () => {
    class Test extends Model {
      foobar = () => "Hello world!";
    }
  
    const mockExternal = {
      foobar: () => "Goodbye cruel world!"
    }
  
    const hook = renderHook(() => {
      return Test.use(mockExternal);
    });
  
    const { foobar } = hook.result.current;
  
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
  
    const { result } = renderHook(() => {
      return Test.use(mockExternal);
    });
  
    expect(result.current).not.toBe(mockExternal.foobar);
  })
  
  it("will not trigger updates it caused", async () => {
    const didRender = jest.fn();
    const hook = renderHook((props) => {
      didRender();
      return Test.use(props, true);
    }, { initialProps: { foo: "foo" } });

    hook.rerender({ foo: "bar" });

    expect(didRender).toHaveBeenCalledTimes(2);
  })

  it("will trigger set instruction", () => {
    const mock = jest.fn();

    class Test extends Model {
      foo = set("foo", mock);
    }

    const { result } = renderHook(() => {
      return Test.use({ foo: "bar" });
    });

    expect(result.current.foo).toBe("bar");
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

    render(
      <Provider for={Ambient}>
        <Element />
      </Provider>
    )
  })
})