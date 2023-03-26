import { act } from '@testing-library/react-hooks';

import { Model, set } from '.';
import { mockAsync, mockSuspense, renderHook } from './helper/testing';
import { Oops } from './useContext';

/**
 * Bypass context to fascilitate tests.
 */
class Singleton extends Model {
  static instance: Singleton;

  static new<T extends Singleton>(this: Model.Type<T>): T;
  static new(){
    return this.instance = super.new();
  }

  /** Inherited by `tap`, will return (or create) only one instance. */
  static find<T extends Singleton>(this: Model.Type<T>): T;
  static find(){
    return this.instance || this.new();
  }
}

it("will refresh for values accessed", async () => {
  class Test extends Singleton {
    foo = "foo";
  }

  const test = Test.new();
  const render = renderHook(() => {
    return Test.get().foo;
  });

  expect(render.result.current).toBe("foo");
  test.foo = "bar";

  await render.waitForNextUpdate();
})

describe("set factory", () => {
  it('will suspend if function is async', async () => {
    class Test extends Singleton {
      value = set(() => promise.pending());
    }
  
    const test = mockSuspense();
    const promise = mockAsync();
    const didRender = mockAsync();
  
    test.renderHook(() => {
      void Test.get().value;
      didRender.resolve();
    })
  
    test.assertDidSuspend(true);
  
    promise.resolve();
    await didRender.pending();
  
    test.assertDidRender(true);
  })

  it('will refresh and throw if async rejects', async () => {
    const promise = mockAsync();
  
    class Test extends Singleton {
      value = set(async () => {
        await promise.pending();
        throw "oh no";
      })
    }
  
    const test = mockSuspense();
    const didThrow = mockAsync();
  
    test.renderHook(() => {
      try {
        void Test.get().value;
      }
      catch(err: any){
        if(err instanceof Promise)
          throw err;
        else
          didThrow.resolve(err);
      }
    })
  
    test.assertDidSuspend(true);
  
    promise.resolve();
  
    const error = await didThrow.pending();
  
    expect(error).toBe("oh no");
  })

  it('will suspend if value is promise', async () => {
    const promise = mockAsync<string>();
  
    class Test extends Singleton {
      value = set(promise.pending());
    }
  
    const test = mockSuspense();
    const didRender = mockAsync();
  
    test.renderHook(() => {
      void Test.get().value;
      didRender.resolve();
    })
  
    test.assertDidSuspend(true);
  
    promise.resolve("hello");
    await didRender.pending();
  
    test.assertDidRender(true);
  })
});

describe("set placeholder", () => {
  it('will suspend if value is accessed before put', async () => {
    class Test extends Singleton {
      foobar = set<string>();
    }

    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.new();

    test.renderHook(() => {
      Test.get().foobar;
      promise.resolve();
    })

    test.assertDidSuspend(true);

    instance.foobar = "foo!";

    // expect refresh caused by update
    await promise.pending();

    test.assertDidRender(true);
  })

  it('will not suspend if value is defined', async () => {
    class Test extends Singleton {
      foobar = set<string>();
    }

    const test = mockSuspense();
    const instance = Test.new();

    instance.foobar = "foo!";

    test.renderHook(() => {
      Test.get().foobar;
    })

    test.assertDidRender(true);
  })
});

describe("passive mode", () => {
  it("will not subscribe", async () => {
    class Test extends Singleton {
      value = 1;
    }

    const test = Test.new();
    const didRender = jest.fn();

    renderHook(() => {
      didRender(Test.get(true).value);
    });

    expect(didRender).toBeCalledWith(1);

    test.value++;

    await test.on(true);
    
    expect(didRender).not.toBeCalledWith(2);
    expect(didRender).toBeCalledTimes(1);
  });

  it("will throw if not found", () => {
    class Test extends Model {
      value = 1;
    }

    const expected = Oops.NotFound("Test");
    const useTest = jest.fn(() => {
      try {
        Test.get(true);
      }
      catch(err){
        expect(err).toEqual(expected);
      }
    });
    
    renderHook(useTest);
    expect(useTest).toHaveReturned();
  });

  it("will return undefined if not requred", () => {
    class Test extends Model {
      value = 1;
    }

    const useTest = jest.fn(() => Test.get(false));
    
    renderHook(useTest);
    expect(useTest).toHaveReturnedWith(undefined);
  })
})

describe("computed", () => {
  const opts = { timeout: 100 };

  class Test extends Singleton {
    foo = 1;
    bar = 2;
  }

  it('will select and subscribe to subvalue', async () => {
    const parent = Test.new();

    const { result, waitForNextUpdate } = renderHook(() => {
      return Test.get(x => x.foo);
    });

    expect(result.current).toBe(1);

    parent.foo = 2;
    await waitForNextUpdate();

    expect(result.current).toBe(2);
  })

  it('will compute output', async () => {
    const parent = Test.new();
    const { result, waitForNextUpdate } = renderHook(() => {
      return Test.get(x => {
        return x.foo + x.bar;
      });
    });

    expect(result.current).toBe(3);

    parent.foo = 2;
    await waitForNextUpdate(opts);

    expect(result.current).toBe(4);
  })

  it('will ignore updates with same result', async () => {
    const parent = Test.new();
    const compute = jest.fn();
    const render = jest.fn();

    const { result } = renderHook(() => {
      render();
      return Test.get(x => {
        compute();
        void x.foo;
        return x.bar;
      });
    });

    expect(result.current).toBe(2);
    expect(compute).toBeCalled();

    parent.foo = 2;
    await parent.on();

    // did attempt a second compute
    expect(compute).toBeCalledTimes(2);

    // compute did not trigger a new render
    expect(render).toBeCalledTimes(1);
    expect(result.current).toBe(2);
  })

  it("will disable updates if null returned", async () => {
    const instance = Test.new();
    const didRender = jest.fn(() => {
      return Test.get($ => null);
    })

    const { result } = renderHook(didRender);

    expect(didRender).toBeCalledTimes(1);
    expect(result.current).toBe(null);

    instance.foo = 2;

    await instance.on(true);
    expect(didRender).toBeCalledTimes(1);
  })

  it("will use returned function as compute", async () => {
    const test = Test.new();
    const willCompute = jest.fn();
    const willMount = jest.fn();

    const { result, waitForNextUpdate } = renderHook(() => {
      return Test.get($ => {
        willMount();
        void $.foo;
  
        return () => {
          willCompute();
          return $.foo + $.bar;
        };
      });
    });

    expect(result.current).toBe(3);

    expect(willMount).toBeCalledTimes(1);
    expect(willCompute).toBeCalledTimes(1);

    test.foo = 2;

    await waitForNextUpdate(opts);

    expect(willMount).toBeCalledTimes(1);
    expect(willCompute).toBeCalledTimes(2);

    expect(result.current).toBe(4);
  })

  describe("tuple", () => {
    class Test extends Singleton {
      foo = 1;
      bar = true;
      baz = "foo";
    }

    it("will not update if values are same", async () => {
      const parent = Test.new();
      const didCompute = jest.fn();
      const didRender = jest.fn();
    
      const { result } = renderHook(() => {
        didRender();
        return Test.get(x => {
          didCompute(x.foo);
          return ["something", x.bar, x.baz];
        });
      });

      const returned = result.current;
    
      expect(returned).toStrictEqual(["something", true, "foo"]);
    
      await act(async () => {
        parent.foo = 2;
        await parent.on(true);
      })

      expect(didRender).toBeCalledTimes(1);
      expect(didCompute).toBeCalledWith(2);

      expect(result.current).toBe(returned);
    })

    it("will update if any value differs", async () => {
      const parent = Test.new();
      const didCompute = jest.fn();
      const didRender = jest.fn();
    
      const { result } = renderHook(() => {
        didRender();
        return Test.get(x => {
          didCompute();
          return [x.foo, x.bar, x.baz];
        });
      });
    
      expect(result.current).toStrictEqual([1, true, "foo"]);
    
      await act(async () => {
        parent.foo = 2;
        parent.bar = false;
        await parent.on(true);
      })

      expect(didRender).toBeCalledTimes(2);
      expect(didCompute).toBeCalledTimes(2);
    
      expect(result.current).toEqual([2, false, "foo"]);
    })
  })

  describe("async", () => {
    class Test extends Singleton {
      foo = "bar";
    };

    it('will return null then refresh', async () => {
      const promise = mockAsync<string>();

      const { result, waitForNextUpdate } = renderHook(() => {
        return Test.get(() => promise.pending());
      });

      expect(result.current).toBeNull();

      promise.resolve("foobar");
      await waitForNextUpdate();

      expect(result.current).toBe("foobar");
    });

    it('will not subscribe to values', async () => {
      const promise = mockAsync<string>();
      const control = Test.new();

      const { result, waitForNextUpdate } = renderHook(() => {
        return Test.get($ => {
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

  describe("suspense", () => {
    class Test extends Singleton {
      value?: string = undefined;
    }

    it('will suspend if value expected', async () => {
      const instance = Test.new() as Test;
      const promise = mockAsync();
      const test = mockSuspense();

      const didRender = jest.fn();
      const didCompute = jest.fn();

      test.renderHook(() => {
        promise.resolve();
        didRender();

        Test.get(state => {
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
      const promise = mockAsync();
      const test = mockSuspense();

      test.renderHook(() => {
        Test.get(() => promise.pending(), true);
      })

      test.assertDidSuspend(true);

      promise.resolve();
      await test.waitForNextRender();

      test.assertDidRender(true);
    })
  })

  describe("undefined", () => {
    class Test extends Singleton {};

    it("will convert to null", () => {
      const { result } = renderHook(() => {
        return Test.get(() => undefined);
      });

      expect(result.current).toBe(null);
    })

    it("will convert to null from factory", () => {
      const { result } = renderHook(() => {
        return Test.get(() => () => undefined);
      });

      expect(result.current).toBe(null);
    })
  })

  describe("update callback", () => {
    it("will force a refresh", () => {
      const didRender = jest.fn();
      const didEvaluate = jest.fn();
      let forceUpdate!: () => Promise<void>;

      const { unmount } = renderHook(() => {
        didRender();
        return Test.get(($, update) => {
          didEvaluate();
          forceUpdate = update;
        });
      });

      expect(didEvaluate).toHaveBeenCalledTimes(1);
      expect(didRender).toHaveBeenCalledTimes(1);
      
      act(() => {
        forceUpdate();
      });
      
      expect(didEvaluate).toHaveBeenCalledTimes(2);
      expect(didRender).toHaveBeenCalledTimes(2);

      unmount();
    })

    it("will refresh without reevaluating", () => {
      const didRender = jest.fn();
      const didEvaluate = jest.fn();
      let forceUpdate!: () => void;

      const { unmount } = renderHook(() => {
        didRender();
        return Test.get(($, update) => {
          didEvaluate();
          forceUpdate = update;
          // return null to stop subscription.
          return null;
        });
      });

      expect(didEvaluate).toHaveBeenCalledTimes(1);
      expect(didRender).toHaveBeenCalledTimes(1);
      
      act(() => {
        forceUpdate();
      });
      
      expect(didEvaluate).toHaveBeenCalledTimes(1);
      expect(didRender).toHaveBeenCalledTimes(2);

      unmount();
    })

    it("will refresh returned function instead", () => {
      const didEvaluate = jest.fn();
      const didEvaluateInner = jest.fn();

      let updateValue!: (value: string) => void;

      const { unmount, result } = renderHook(() => {
        return Test.get(($, update) => {
          let value = "foo";

          didEvaluate();
          updateValue = (x: string) => {
            value = x;
            update();
          };

          return () => {
            didEvaluateInner();
            return value;
          };
        });
      });

      expect(result.current).toBe("foo");
      expect(didEvaluate).toHaveBeenCalledTimes(1);
      
      act(() => {
        updateValue("bar");
      });
      
      expect(result.current).toBe("bar");
      expect(didEvaluate).toHaveBeenCalledTimes(1);
      expect(didEvaluateInner).toHaveBeenCalledTimes(2);

      unmount();
    })

    it("will refresh again after promise", async () => {
      const didRender = jest.fn();
      const promise = mockAsync<string>();
      
      let forceUpdate!: <T>(after: Promise<T>) => Promise<T>;

      const { unmount } = renderHook(() => {
        didRender();
        return Test.get(($, update) => {
          forceUpdate = update;
          return null;
        });
      });

      expect(didRender).toHaveBeenCalledTimes(1);

      let out;
      
      act(() => {
        out = forceUpdate(promise.pending());
      });

      expect(didRender).toHaveBeenCalledTimes(2);

      await act(async () => {
        await promise.resolve("hello");
      })

      await expect(out).resolves.toBe("hello");
      
      expect(didRender).toHaveBeenCalledTimes(3);

      unmount();
    })

    it("will invoke async function", async () => {
      const didRender = jest.fn();
      const promise = mockAsync();
      
      let forceUpdate!: <T>(after: () => Promise<T>) => Promise<T>;

      const { unmount } = renderHook(() => {
        didRender();
        return Test.get(($, update) => {
          forceUpdate = update;
          return null;
        });
      });

      expect(didRender).toHaveBeenCalledTimes(1);

      let pending: boolean;
      
      act(() => {
        forceUpdate(async () => {
          pending = true;
          await promise.pending();
          pending = false;
        });

        // refresh should not occur until after first `await`
        expect(didRender).toHaveBeenCalledTimes(1);
        expect(pending).toBe(true);
      });

      expect(didRender).toHaveBeenCalledTimes(2);

      await act(async () => {
        await promise.resolve();
      })
      
      expect(didRender).toHaveBeenCalledTimes(3);

      unmount();
    })
  })
})