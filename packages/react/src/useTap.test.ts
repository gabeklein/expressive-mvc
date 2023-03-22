import { act } from '@testing-library/react-hooks';

import { Model, set } from '.';
import { mockAsync, mockSuspense, renderHook } from './helper/testing';

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
  static get<T extends Singleton>(this: Model.Type<T>): T;
  static get(){
    return this.instance || this.new();
  }
}

it("will refresh for values accessed", async () => {
  class Test extends Singleton {
    foo = "foo";
  }

  const test = Test.new();
  const render = renderHook(() => {
    return Test.tap().foo;
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
      void Test.tap().value;
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
        void Test.tap().value;
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
      void Test.tap().value;
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
      Test.tap().foobar;
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
      Test.tap().foobar;
    })

    test.assertDidRender(true);
  })
})

describe("required parameter", () => {
  it('will suspend if subvalue is undefined', async () => {
    class Test extends Singleton {
      value?: string = undefined;
    }
  
    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.new();
  
    test.renderHook(() => {
      Test.tap(true).value;
      promise.resolve();
    })
  
    test.assertDidSuspend(true);
  
    instance.value = "foobar!";
    await promise.pending();
  
    test.assertDidRender(true);
  })

  it("will return undefined if not required", async () => {
    class Test extends Singleton {
      value = set(promise.pending);
    }

    const promise = mockAsync<string>();
    const test = mockSuspense();

    let value: string | undefined;

    test.renderHook(() => {
      ({ value } = Test.tap(false));
    })

    test.assertDidRender(true);
    expect(value).toBe(undefined);
  })

  it("will force suspense if required is true", () => {
    class Test extends Singleton {
      value = set(() => undefined);
    }

    const test = mockSuspense();

    test.renderHook(() => {
      Test.tap(true).value;
    })

    test.assertDidSuspend(true);
  });

  it("will cancel out suspense if required is false", () => {
    class Test extends Singleton {
      value = set<never>();
    }

    const test = mockSuspense();

    test.renderHook(() => {
      Test.tap(false).value;
    })

    test.assertDidRender(true);
  });
});

describe("computed", () => {
  const opts = { timeout: 100 };

  class Test extends Singleton {
    foo = 1;
    bar = 2;
    baz = 3;
  }

  it('will select and subscribe to subvalue', async () => {
    const parent = Test.new();

    const { result, waitForNextUpdate } = renderHook(() => {
      return Test.tap(x => x.foo);
    });

    expect(result.current).toBe(1);

    parent.foo = 2;
    await waitForNextUpdate();

    expect(result.current).toBe(2);
  })

  it('will compute output', async () => {
    const parent = Test.new();
    const { result, waitForNextUpdate } = renderHook(() => {
      return Test.tap(x => {
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
      return Test.tap(x => {
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
      return Test.tap($ => null);
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
      return Test.tap($ => {
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
    it("will not update if values are same", async () => {
      const parent = Test.new();
      const didCompute = jest.fn();
      const didRender = jest.fn();
    
      const { result } = renderHook(() => {
        didRender();
        return Test.tap(x => {
          didCompute(x.foo);
          return [1, x.bar, x.baz];
        });
      });
    
      expect(result.current).toEqual([1,2,3]);
    
      await act(async () => {
        parent.foo = 2;
        await parent.on(true);
      })

      expect(didRender).toBeCalledTimes(1);
      expect(didCompute).toBeCalledWith(2);
    })

    it("will update if any value different", async () => {
      const parent = Test.new();
      const didCompute = jest.fn();
      const didRender = jest.fn();
    
      const { result } = renderHook(() => {
        didRender();
        return Test.tap(x => {
          didCompute();
          return [x.foo, x.bar, x.baz];
        });
      });
    
      expect(result.current).toEqual([1,2,3]);
    
      await act(async () => {
        parent.foo = 2;
        await parent.on(true);
      })

      expect(didRender).toBeCalledTimes(2);
      expect(didCompute).toBeCalledTimes(2);
    })
  })

  describe("async", () => {
    class Test extends Singleton {
      foo = "bar";
    };

    it('will return null then refresh', async () => {
      const promise = mockAsync<string>();

      const { result, waitForNextUpdate } = renderHook(() => {
        return Test.tap(() => promise.pending());
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
        return Test.tap($ => {
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

        Test.tap(state => {
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
        Test.tap(() => promise.pending(), true);
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
        return Test.tap(() => undefined);
      });

      expect(result.current).toBe(null);
    })

    it("will convert to null from factory", () => {
      const { result } = renderHook(() => {
        return Test.tap(() => () => undefined);
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
        return Test.tap(($, update) => {
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
        return Test.tap(($, update) => {
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
        return Test.tap(($, update) => {
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
        return Test.tap(($, update) => {
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
        return Test.tap(($, update) => {
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