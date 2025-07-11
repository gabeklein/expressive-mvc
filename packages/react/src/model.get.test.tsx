import { act, render, renderHook } from '@testing-library/react';
import { Suspense } from 'react';

import { get, Model, Provider, set } from '.';

export function renderWith<T>(Type: Model.Init | Model, hook: () => T) {
  return renderHook(hook, {
    wrapper: ({ children }) => (
      <Provider for={Type}>
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </Provider>
    )
  });
}

interface MockPromise<T> extends Promise<T> {
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

function mockPromise<T = void>() {
  const methods = {} as MockPromise<T>;
  const promise = new Promise((res, rej) => {
    methods.resolve = res;
    methods.reject = rej;
  }) as MockPromise<T>;

  return Object.assign(promise, methods);
}

const error = jest
  .spyOn(console, "error")
  .mockImplementation(() => {});

afterEach(() => {
  // expect(error).not.toBeCalled();
  error.mockReset()
});

afterAll(() => error.mockRestore());

it("will fetch model", () => {
  class Test extends Model {}

  const test = Test.new();
  const hook = renderWith(test, () => Test.get());

  expect(hook.result.current.is).toBe(test);
})

it("will refresh for values accessed", async () => {
  class Test extends Model {
    foo = "foo";
  }

  const test = Test.new();
  const didRender = jest.fn();
  const hook = renderWith(test, () => {
    didRender();
    return Test.get().foo;
  });

  expect(hook.result.current).toBe("foo");

  await act(async () => test.set({ foo: "bar" }));

  expect(hook.result.current).toBe("bar");
  expect(didRender).toBeCalledTimes(2);
})

it("will not update on death event", async () => {
  class Test extends Model {
    foo = "foo";
  }

  const test = Test.new();
  const didRender = jest.fn();
  const hook = renderWith(test, () => {
    didRender();
    return Test.get().foo;
  });

  expect(hook.result.current).toBe("foo");
  test.set(null);

  expect(didRender).toBeCalledTimes(1);
})

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

it("will not throw if optional", () => {
  class Test extends Model {
    value = 1;
  }

  const useTest = jest.fn(() => {
    expect(Test.get(false)).toBeUndefined();
  });
  
  renderHook(useTest);
  expect(useTest).toHaveReturned();
});

it("will throw if expected value undefined", () => {
  class Test extends Model {
    constructor(){
      super('ID');
    }
    value?: number = undefined;
  }

  renderWith(Test, () => {
    expect(() => {
      void Test.get(true).value;
    }).toThrow("ID.value is required in this context.");
  });
})

describe("computed", () => {
  class Test extends Model {
    foo = 1;
    bar = 2;
  }

  it.todo("will suspend if factory does");

  it('will select and subscribe to subvalue', async () => {
    const test = Test.new();
    const hook = renderWith(test, () => {
      return Test.get(x => x.foo);
    });

    expect(hook.result.current).toBe(1);

    await act(async () => test.set({ foo: 2 }))

    expect(hook.result.current).toBe(2);
  })

  it("will throw if instance not found", () => {
    class Test extends Model {
      value = 1;
    }

    const useTest = jest.fn(() => {
      expect(() => Test.get(x => x)).toThrow("Could not find Test in context.");
    });
    
    renderHook(useTest);
    expect(useTest).toHaveReturned();
  });

  it('will compute output', async () => {
    const test = Test.new();
    const hook = renderWith(test, () => {
      return Test.get(x => x.foo + x.bar);
    });

    expect(hook.result.current).toBe(3);

    await act(async () => test.set({ foo: 2 }));

    expect(hook.result.current).toBe(4);
  })

  it('will ignore updates with same result', async () => {
    const test = Test.new();
    const compute = jest.fn();
    const didRender = jest.fn();

    const hook = renderWith(test, () => {
      didRender();
      return Test.get(x => {
        compute();
        void x.foo;
        return x.bar;
      });
    });

    expect(hook.result.current).toBe(2);
    expect(compute).toBeCalled();

    test.foo = 2;
    await expect(test).toHaveUpdated();

    // did attempt a second compute
    expect(compute).toBeCalledTimes(2);

    // compute did not trigger a new render
    expect(didRender).toBeCalledTimes(1);
    expect(hook.result.current).toBe(2);
  })

  it("will return null", () => {
    class Test extends Model {}
  
    const test = Test.new();
    const rendered = renderWith(test, () => Test.get(() => null));

    expect(rendered.result.current).toBe(null);
  })

  it("will convert undefined to null", () => {
    const hook = renderWith(Test, () => {
      return Test.get(() => {});
    });

    expect(hook.result.current).toBe(null);
  })

  it("will disable updates if null returned", async () => {
    const factory = jest.fn(($: Test) => {
      void $.foo;
      return null;
    });

    const didRender = jest.fn(() => {
      return Test.get(factory);
    })

    const test = Test.new();
    const hook = renderWith(test, didRender);

    expect(didRender).toBeCalledTimes(1);
    expect(hook.result.current).toBe(null);

    test.foo = 2;

    await expect(test).toHaveUpdated();

    expect(factory).toBeCalledTimes(1);
    expect(didRender).toBeCalledTimes(1);
  })

  it("will run initial callback syncronously", async () => {
    class Parent extends Model {
      values = [] as string[]
    }
    
    type ChildProps = {
      value: string;
    }
  
    const Child = (props: ChildProps) => (
      Parent.get($ => {
        didPushToValues();
        $.values = [...$.values, props.value];
        return null;
      })
    )
  
    const parent = Parent.new();
    const didUpdateValues = jest.fn();
    const didPushToValues = jest.fn();

    parent.get(state => {
      didUpdateValues(state.values.length);
    })
  
    render(
      <Provider for={parent}>
        <Child value='foo' />
        <Child value='bar' />
        <Child value='baz' />
      </Provider>
    )
  
    expect(didPushToValues).toBeCalledTimes(3);
  
    await expect(parent).toHaveUpdated();
  
    // Expect updates to have bunched up before new frame.
    expect(didUpdateValues).toBeCalledTimes(2);
    expect(didUpdateValues).toBeCalledWith(3);
  })
})

describe("force update", () => {
  class Test extends Model {
    foo = "bar";
  };

  it("will force a refresh", async () => {
    const didRender = jest.fn();
    const didEvaluate = jest.fn();
    let forceUpdate!: () => void;

    renderWith(Test, () => {
      didRender();
      return Test.get((_, update) => {
        didEvaluate();
        forceUpdate = update;
      });
    });

    expect(didEvaluate).toHaveBeenCalledTimes(1);
    expect(didRender).toHaveBeenCalledTimes(1);
    
    await act(async () => {
      forceUpdate();
    });
    
    expect(didEvaluate).toHaveBeenCalledTimes(1);
    expect(didRender).toHaveBeenCalledTimes(2);
  })

  it("will refresh without reevaluating", async () => {
    const didEvaluate = jest.fn();
    const didRender = jest.fn();
    let forceUpdate!: () => void;
    
    renderWith(Test, () => {
      didRender();
      return Test.get((_, update) => {
        didEvaluate();
        forceUpdate = update;
        // return null to stop subscription.
        return null;
      });
    });

    expect(didEvaluate).toHaveBeenCalledTimes(1);
    expect(didRender).toHaveBeenCalledTimes(1);
    
    act(forceUpdate);
    
    expect(didEvaluate).toHaveBeenCalledTimes(1);
    expect(didRender).toHaveBeenCalledTimes(2);
  })

  it("will refresh again after promise", async () => {
    const promise = mockPromise();
    const didRender = jest.fn();
    
    let forceUpdate!: <T>(after: Promise<T>) => Promise<T>;

    const { result } = renderWith(Test, () => {
      didRender();
      return Test.get((_, update) => {
        forceUpdate = update;
        return null;
      });
    });

    expect<null>(result.current).toBe(null);
    expect(didRender).toHaveBeenCalledTimes(1);

    await act(async () => {
      forceUpdate(promise);
    })

    expect(didRender).toHaveBeenCalledTimes(2);

    await act(async () => {
       promise.resolve();
    });

    expect(didRender).toHaveBeenCalledTimes(3);
  })

  it("will invoke async function", async () => {
    const promise = mockPromise();
    const didRender = jest.fn();
    
    let forceUpdate!: <T>(after: () => Promise<T>) => Promise<T>;

    renderWith(Test, () => {
      didRender();
      return Test.get((_, update) => {
        forceUpdate = update;
        return null;
      });
    });

    expect(didRender).toHaveBeenCalledTimes(1);

    await act(async () => {
      forceUpdate(() => promise);
    })

    expect(didRender).toHaveBeenCalledTimes(2);

    await act(async () => {
      promise.resolve();
    });

    expect(didRender).toHaveBeenCalledTimes(3);
  })
})

describe("async", () => {
  class Test extends Model {
    foo = "bar";
  };

  it("will convert void to null", async () => {
    const promise = mockPromise<void>();

    const hook = renderWith(Test, () => {
      return Test.get(async () => promise);
    });

    await act(async () => promise.resolve(undefined));

    expect(hook.result.current).toBe(null);
  })

  it('will not subscribe to values', async () => {
    const promise = mockPromise<string>();

    const test = Test.new();
    const didRender = jest.fn();
    const hook = renderWith(test, () => {
      didRender();
      return Test.get(async $ => {
        void $.foo;
        return promise;
      });
    });

    expect(didRender).toBeCalledTimes(1);
    expect(hook.result.current).toBe(null);

    await act(async () => {
      promise.resolve("foobar");
    })

    expect(didRender).toBeCalledTimes(2);
    expect(hook.result.current).toBe("foobar");

    test.foo = "foo";
    await expect(test).toHaveUpdated();

    expect(didRender).toBeCalledTimes(2);
  });
  
  it('will refresh and throw if async rejects', async () => {
    class Test extends Model {}
    
    const promise = mockPromise();
    const hook = renderWith(Test, () => {
      try {
        Test.get(async () => {
          await promise;
          throw "oh no";
        })
      }
      catch(err: any){
        return err;
      }
    });

    expect(hook.result.current).toBeUndefined();
  

    await act(async () => {
      promise.resolve();
    });

    expect(hook.result.current).toBe("oh no");
  })
})

describe("get instruction", () => {
  class Foo extends Model {
    bar = get(Bar);
  }

  class Bar extends Model {
    value = "bar";
  }

  it("will attach peer from context", async () => {
    const bar = Bar.new();
    const hook = renderWith(bar, () => Foo.use().is.bar);

    expect(hook.result.current).toBe(bar);
  })

  it("will subscribe peer from context", async () => {
    const bar = Bar.new();
    const didRender = jest.fn();
    const hook = renderWith(bar, () => {
      didRender();
      return Foo.use().bar.value;
    });

    expect(hook.result.current).toBe("bar");

    await act(async () => {
      bar.value = "foo";
    });

    expect(hook.result.current).toBe("foo");
    expect(didRender).toBeCalledTimes(2);
  })

  it("will return undefined if instance not found", () => {
    class Foo extends Model {
      bar = get(Bar, false);
    }

    const hook = renderHook(() => Foo.use().bar);

    expect(hook.result.current).toBeUndefined();
  })

  it("will throw if instance not found", () => {
    class Foo extends Model {
      bar = get(Bar);

      constructor(){
        super("ID");
      }
    }

    const tryToRender = () => renderHook(() => Foo.use());

    expect(tryToRender).toThrowError(`Required Bar not found in context for ID.`);
  })

  it("will prefer parent over context", () => {
    class Parent extends Model {
      child = new Child();
      value = "foo";
    }

    class Child extends Model {
      parent = get(Parent);
    }

    const { result } = renderWith(Parent, () => Parent.use().is);

    expect(result.current.child.parent).toBe(result.current);
  })

  it("will throw if parent required in-context", () => {
    class Ambient extends Model {}
    class Child extends Model {
      expects = get(Ambient, true);
    }
  
    const attempt = () => Child.new("ID");
  
    expect(attempt).toThrowError(`ID may only exist as a child of type Ambient.`);
  })
})

describe("set instruction", () => {
  describe("factory", () => {
    it('will suspend if function is async', async () => {
      const promise = mockPromise<string>();
  
      class Test extends Model {
        value = set(() => promise, true);
      }

      const hook = renderWith(Test, () => {
        return Test.get().value;
      });
    
      expect(hook.result.current).toBe(null);
  
      await act(async () => {
        promise.resolve("hello");
      })

      expect(hook.result.current).toBe("hello");
    })
  
    it('will refresh and throw if async rejects', async () => {
      const promise = mockPromise();
    
      class Test extends Model {
        value = set(promise, true);
      }
    
      const hook = renderWith(Test, () => {
        try {
          void Test.get().value;
        }
        catch(err: any){
          if(err instanceof Promise)
            throw err;
          else
            return err;
        }
      });
    
      expect(hook.result.current).toBe(null);
    
      await act(async () => {
        promise.reject("oh no");
      });

      expect(hook.result.current).toBe("oh no");
    })
  });
  
  describe("placeholder", () => {
    it('will suspend if value not yet assigned', async () => {
      class Test extends Model {
        foobar = set<string>();
      }
  
      const test = Test.new();
      const hook = renderWith(test, () => {
        return Test.get().foobar;
      });

      expect(hook.result.current).toBe(null);
  
      // expect refresh caused by update
      await act(async () => {
        test.foobar = "foo!";
      });
  
      expect(hook.result.current).toBe("foo!");
    })
  
    it('will not suspend if already defined', async () => {
      class Test extends Model {
        foobar = set<string>();
      }
  
      const test = Test.new();
  
      test.foobar = "foo!";
  
      const hook = renderWith(test, () => {
        return Test.get().foobar;
      })
      expect(hook.result.current).toBe("foo!");
    })
  });
})