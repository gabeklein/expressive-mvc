import { Model, set } from '.';
import { mockAsync as mockPromise } from './helper/testing';
import { renderHook } from './helper/mocks';

it("will refresh for values accessed", async () => {
  class Test extends Model {
    foo = "foo";
  }

  const test = Test.new();
  const render = renderHook(() => {
    return Test.get().foo;
  });

  expect(render.current).toBe("foo");
  test.foo = "bar";

  await render.refresh;
})

describe("set factory", () => {
  it('will suspend if function is async', async () => {
    class Test extends Model {
      value = set(() => promise);
    }

    Test.new();

    const promise = mockPromise();
    const test = renderHook(() => {
      void Test.get().value;
    });
  
    expect(test.pending).toBe(true);
  
    promise.resolve();
    await test.refresh;
  
    expect(test.mock).toBeCalledTimes(2);
    expect(test.mock).toHaveReturnedTimes(1);
  })

  it('will refresh and throw if async rejects', async () => {
    const promise = mockPromise();
  
    class Test extends Model {
      value = set(async () => {
        await promise;
        throw "oh no";
      })
    }
  
    Test.new();

    const didThrow = mockPromise();
    const test = renderHook(() => {
      try {
        void Test.get().value;
      }
      catch(err: any){
        if(err instanceof Promise)
          throw err;
        else
          didThrow.resolve(err);
      }
    });
  
    expect(test.pending).toBe(true);
  
    promise.resolve();
  
    const error = await didThrow;
  
    expect(error).toBe("oh no");
  })

  it('will suspend if value is promise', async () => {
    const promise = mockPromise<string>();
  
    class Test extends Model {
      value = set(promise);
    }
  
    Test.new();

    const test = renderHook(() => {
      void Test.get().value;
      didRender.resolve();
    });

    const didRender = mockPromise();
  
    expect(test.pending).toBe(true);
  
    promise.resolve("hello");
    await didRender;
  
    expect(test.mock).toBeCalledTimes(2);
  })
});

describe("set placeholder", () => {
  it('will suspend if value is accessed before put', async () => {
    class Test extends Model {
      foobar = set<string>();
    }

    const instance = Test.new();

    const test = renderHook(() => {
      Test.get().foobar;
    })

    expect(test.pending).toBe(true);

    instance.foobar = "foo!";

    // expect refresh caused by update
    await test.refresh;

    expect(test.mock).toBeCalledTimes(2);

  })

  it('will not suspend if value is defined', async () => {
    class Test extends Model {
      foobar = set<string>();
    }

    const instance = Test.new();

    instance.foobar = "foo!";

    const test = renderHook(() => {
      return Test.get().foobar;
    })

    expect(test.mock).toHaveReturnedWith("foo!");
  })
});

describe("passive mode", () => {
  it("will not subscribe", async () => {
    class Test extends Model {
      value = 1;
    }

    const test = Test.new();
    const render = renderHook(() => {
      return Test.get(true).value;
    });

    expect(render.mock).toBeCalledTimes(1);
    expect(render.current).toBe(1);

    test.value++;

    await expect(test).toUpdate();

    expect(render.mock).toBeCalledTimes(1);
  });

  it("will throw if not found", () => {
    class Test extends Model {
      value = 1;
    }

    const useTest = jest.fn(() => {
      expect(() => Test.get()).toThrow("Could not find Test in context.");
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
  class Test extends Model {
    foo = 1;
    bar = 2;
  }

  it('will select and subscribe to subvalue', async () => {
    const parent = Test.new();

    const hook = renderHook(() => {
      return Test.get(x => x.foo);
    });

    expect(hook.current).toBe(1);

    parent.foo = 2;
    await hook.refresh;

    expect(hook.current).toBe(2);
  })

  it('will compute output', async () => {
    const parent = Test.new();
    const hook = renderHook(() => {
      return Test.get(x => x.foo + x.bar);
    });

    expect(hook.current).toBe(3);

    parent.foo = 2;
    await hook.refresh;

    expect(hook.current).toBe(4);
  })

  it('will ignore updates with same result', async () => {
    const parent = Test.new();
    const compute = jest.fn();
    const render = jest.fn();

    const hook = renderHook(() => {
      render();
      return Test.get(x => {
        compute();
        void x.foo;
        return x.bar;
      });
    });

    expect(hook.current).toBe(2);
    expect(compute).toBeCalled();

    parent.foo = 2;
    await parent.on();

    // did attempt a second compute
    expect(compute).toBeCalledTimes(2);

    // compute did not trigger a new render
    expect(render).toBeCalledTimes(1);
    expect(hook.current).toBe(2);
  })

  it("will disable updates if null returned", async () => {
    const instance = Test.new();
    const didRender = jest.fn(() => {
      return Test.get($ => null);
    })

    const hook = renderHook(didRender);

    expect(didRender).toBeCalledTimes(1);
    expect(hook.current).toBe(null);

    instance.foo = 2;

    await expect(instance).toUpdate();

    expect(didRender).toBeCalledTimes(1);
  })

  it("will use returned function as compute", async () => {
    const test = Test.new();
    const willCompute = jest.fn();
    const willCreate = jest.fn();

    const hook = renderHook(() => {
      return Test.get($ => {
        willCreate();
        void $.foo;
  
        return () => {
          willCompute();
          return $.foo + $.bar;
        };
      });
    });

    expect(hook.current).toBe(3);

    expect(willCreate).toBeCalledTimes(1);
    expect(willCompute).toBeCalledTimes(1);

    test.foo = 2;

    await hook.refresh;

    expect(willCreate).toBeCalledTimes(1);
    expect(willCompute).toBeCalledTimes(2);

    expect(hook.current).toBe(4);
  })

  it("will not subscribe to keys pulled by factory", async () => {
    const test = Test.new();
    const willCompute = jest.fn();

    const hook = renderHook(() => {
      return Test.get($ => {
        void $.foo;
  
        return () => {
          willCompute();
          return $.bar;
        };
      });
    });

    expect(hook.current).toBe(2);

    test.foo = 2;

    await test.on(0);

    expect(willCompute).toBeCalledTimes(1);
    expect(hook.current).toBe(2);

    test.bar = 3;

    await hook.refresh;

    expect(willCompute).toBeCalledTimes(2);
    expect(hook.current).toBe(3);
  })

  describe("tuple", () => {
    class Test extends Model {
      foo = 1;
      bar = true;
      baz = "foo";
    }

    it("will not update if values are same", async () => {
      const parent = Test.new();
      const didCompute = jest.fn();
      const didRender = jest.fn();
    
      const hook = renderHook(() => {
        didRender();
        return Test.get(x => {
          didCompute(x.foo);
          return ["something", x.bar, x.baz];
        });
      });

      const returned = hook.current;
    
      expect(returned).toStrictEqual(["something", true, "foo"]);
    
      parent.foo = 2;
      await expect(parent).toUpdate();

      expect(didRender).toBeCalledTimes(1);
      expect(didCompute).toBeCalledWith(2);

      expect(hook.current).toBe(returned);
    })

    it("will update if any value differs", async () => {
      const parent = Test.new();
      const didCompute = jest.fn();
      const didRender = jest.fn();
    
      const hook = renderHook(() => {
        didRender();
        return Test.get(x => {
          didCompute();
          return [x.foo, x.bar, x.baz];
        });
      });
    
      expect(hook.current).toStrictEqual([1, true, "foo"]);
    
      parent.foo = 2;
      parent.bar = false;
      await expect(parent).toUpdate();

      expect(didRender).toBeCalledTimes(2);
      expect(didCompute).toBeCalledTimes(2);
    
      expect(hook.current).toEqual([2, false, "foo"]);
    })
  })

  describe("async", () => {
    class Test extends Model {
      foo = "bar";
    };

    it('will return null then refresh', async () => {
      Test.new();

      const promise = mockPromise<string>();
      const hook = renderHook(() => {
        return Test.get(() => promise);
      });

      expect(hook.current).toBeNull();

      promise.resolve("foobar");
      await hook.refresh;

      expect(hook.current).toBe("foobar");
    });

    it('will not subscribe to values', async () => {
      const promise = mockPromise<string>();
      const control = Test.new();
      const hook = renderHook(() => {
        return Test.get(async $ => {
          void $.foo;
          return promise;
        });
      });

      expect(hook.mock).toBeCalledTimes(1);

      promise.resolve("foobar");
      await hook.refresh;

      expect(hook.mock).toBeCalledTimes(2);
      expect(hook.current).toBe("foobar");

      control.foo = "foo";
      await expect(control).toUpdate();

      expect(hook.mock).toBeCalledTimes(2);
    });
  })

  describe("suspense", () => {
    class Test extends Model {
      value?: string = undefined;
    }

    it('will suspend if value expected', async () => {
      const instance = Test.new();
      const compute = jest.fn();
      const test = renderHook(() => {
        Test.get(state => {
          compute();

          if(state.value == "foobar")
            return true;
        }, true);
      })

      expect(test.pending).toBe(true);

      expect(test.mock).toBeCalledTimes(1);
      instance.value = "foobar";

      await test.refresh

      // 1st - render prior to bailing
      // 2nd - successful render
      expect(test.mock).toBeCalledTimes(2);
      expect(test.mock).toHaveReturnedTimes(1);

      // 1st - initial render fails
      // 2nd - recheck success (permit render again)
      // 3rd - hook regenerated next render 
      expect(compute).toBeCalledTimes(2);
    })

    it('will suspend strict async', async () => {
      Test.new();

      const promise = mockPromise();
      const test = renderHook(() => {
        return Test.get(() => promise, true);
      })

      expect(test.pending).toBe(true);

      promise.resolve();
      await test.refresh;

      expect(test.mock).toBeCalledTimes(2);
    })
  })

  describe("undefined", () => {
    class Test extends Model {};

    it("will convert to null", () => {
      Test.new();

      const hook = renderHook(() => {
        return Test.get(() => undefined);
      });

      expect(hook.current).toBe(null);
    })

    it("will convert to null from factory", () => {
      Test.new();

      const hook = renderHook(() => {
        return Test.get(() => () => undefined);
      });

      expect(hook.current).toBe(null);
    })
  })

  describe("update callback", () => {
    beforeEach(() => {
      Test.new();
    })

    it("will force a refresh", () => {
      const didEvaluate = jest.fn();
      let forceUpdate!: () => void;

      const hook = renderHook(() => {
        return Test.get(($, update) => {
          didEvaluate();
          forceUpdate = update;
        });
      });

      expect(didEvaluate).toHaveBeenCalledTimes(1);
      expect(hook.mock).toHaveBeenCalledTimes(1);
      
      forceUpdate();
      
      expect(didEvaluate).toHaveBeenCalledTimes(2);
      expect(hook.mock).toHaveBeenCalledTimes(2);
    })

    it("will refresh without reevaluating", () => {
      const didEvaluate = jest.fn();
      let forceUpdate!: () => void;

      const hook = renderHook(() => {
        return Test.get(($, update) => {
          didEvaluate();
          forceUpdate = update;
          // return null to stop subscription.
          return null;
        });
      });

      expect(didEvaluate).toHaveBeenCalledTimes(1);
      expect(hook.mock).toHaveBeenCalledTimes(1);
      
      forceUpdate();
      
      expect(didEvaluate).toHaveBeenCalledTimes(1);
      expect(hook.mock).toHaveBeenCalledTimes(2);
    })

    it("will refresh returned function instead", () => {
      const didEvaluate = jest.fn();
      const didEvaluateInner = jest.fn();

      let updateValue!: (value: string) => void;

      const hook = renderHook(() => {
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

      expect(hook.current).toBe("foo");
      expect(didEvaluate).toHaveBeenCalledTimes(1);
      
      updateValue("bar");
      
      expect(hook.current).toBe("bar");
      expect(didEvaluate).toHaveBeenCalledTimes(1);
      expect(didEvaluateInner).toHaveBeenCalledTimes(2);
    })

    it("will refresh again after promise", async () => {
      const promise = mockPromise<string>();
      
      let forceUpdate!: <T>(after: Promise<T>) => Promise<T>;

      const hook = renderHook(() => {
        return Test.get(($, update) => {
          forceUpdate = update;
          return null;
        });
      });

      expect(hook.mock).toHaveBeenCalledTimes(1);

      const out = forceUpdate(promise);

      expect(hook.mock).toHaveBeenCalledTimes(2);

      promise.resolve("hello");

      await expect(out).resolves.toBe("hello");
      
      expect(hook.mock).toHaveBeenCalledTimes(3);
    })

    it("will invoke async function", async () => {
      const promise = mockPromise();
      
      let forceUpdate!: <T>(after: () => Promise<T>) => Promise<T>;

      const hook = renderHook(() => {
        return Test.get(($, update) => {
          forceUpdate = update;
          return null;
        });
      });

      expect(hook.mock).toHaveBeenCalledTimes(1);

      let pending: boolean | undefined;

      forceUpdate(async () => {
        pending = true;
        await promise;
        pending = false;
      });

      expect(pending).toBe(true);
      expect(hook.mock).toHaveBeenCalledTimes(2);

      promise.resolve();
      
      await hook.refresh;
      expect(hook.mock).toHaveBeenCalledTimes(3);
      expect(pending).toBe(false);
    })
  })
})