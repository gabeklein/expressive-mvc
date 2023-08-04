import Model, { get, set, use } from '.';
import { mockHook, mockPromise } from './mocks';

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
  const hook = mockHook(test, () => {
    return Test.get(true);
  });

  expect(hook.output).toBe(test);
})

it("will refresh for values accessed", async () => {
  class Test extends Model {
    foo = "foo";
  }

  const test = Test.new();
  const hook = mockHook(test, () => {
    return Test.get().foo;
  });

  expect(hook.output).toBe("foo");

  await hook.act(() => {
    test.foo = "bar";
  });

  expect(hook.output).toBe("bar");
  expect(hook).toBeCalledTimes(2);
})

it("will not update on death event", async () => {
  class Test extends Model {
    foo = "foo";
  }

  const test = Test.new();
  const hook = mockHook(test, () => {
    return Test.get().foo;
  });

  test.null();

  expect(hook).toBeCalledTimes(1);
})

describe("set factory", () => {
  it.skip('will suspend if function is async', async () => {
    const promise = mockPromise();

    class Test extends Model {
      value = set(() => promise);
    }

    const hook = mockHook(Test, () => {
      void Test.get().value;
    });
  
    expect(hook.suspense).toBe(true);

    await hook.act(() => {
      promise.resolve();
    })
  
    expect(hook).toBeCalledTimes(2);
    expect(hook).toHaveReturnedTimes(1);
  })

  it('will refresh and throw if async rejects', async () => {
    const promise = mockPromise();
  
    class Test extends Model {
      value = set(async () => {
        await promise;
        throw "oh no";
      })
    }
  
    const didThrow = mockPromise();
    const hook = mockHook(Test, () => {
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
  
    expect(hook.suspense).toBe(true);
  
    promise.resolve();
  
    const error = await didThrow;
  
    expect(error).toBe("oh no");
  })

  it('will suspend if value is promise', async () => {
    const promise = mockPromise<string>();
  
    class Test extends Model {
      value = set(promise);
    }

    const hook = mockHook(Test, () => {
      void Test.get().value;
      didRender.resolve();
    });

    const didRender = mockPromise();
  
    expect(hook.suspense).toBe(true);
  
    promise.resolve("hello");
    await didRender;
  
    expect(hook).toBeCalledTimes(2);
  })
});

describe("set placeholder", () => {
  it.skip('will suspend if value is accessed before put', async () => {
    class Test extends Model {
      foobar = set<string>();
    }

    const test = Test.new();
    const hook = mockHook(test, () => {
      Test.get().foobar;
    })

    expect(hook.suspense).toBe(true);

    // expect refresh caused by update
    await hook.act(() => {
      test.foobar = "foo!";
    });

    expect(hook).toBeCalledTimes(2);
  })

  it('will not suspend if value is defined', async () => {
    class Test extends Model {
      foobar = set<string>();
    }

    const test = Test.new();

    test.foobar = "foo!";

    const hook = mockHook(test, () => {
      return Test.get().foobar;
    })

    expect(hook).toHaveReturnedWith("foo!");
  })
});

describe("passive mode", () => {
  it("will not subscribe", async () => {
    class Test extends Model {
      value = 1;
    }

    const test = Test.new();
    const hook = mockHook(test, () => {
      return Test.get(true).value;
    });

    expect(hook).toBeCalledTimes(1);
    expect(hook.output).toBe(1);

    test.value++;

    await expect(test).toUpdate();

    expect(hook).toBeCalledTimes(1);
  });

  it("will throw if not found", () => {
    class Test extends Model {
      value = 1;
    }

    const useTest = jest.fn(() => {
      expect(() => Test.get()).toThrow("Could not find Test in context.");
    });
    
    mockHook(useTest);
    expect(useTest).toHaveReturned();
  });

  it("will return undefined if not requred", () => {
    class Test extends Model {
      value = 1;
    }

    const useTest = jest.fn(() => Test.get(false));
    
    mockHook(useTest);
    expect(useTest).toHaveReturnedWith(undefined);
  })
})

describe("computed", () => {
  class Test extends Model {
    foo = 1;
    bar = 2;
  }

  it('will select and subscribe to subvalue', async () => {
    const test = Test.new();
    const hook = mockHook(test, () => {
      return Test.get(x => x.foo);
    });

    expect(hook.output).toBe(1);

    await hook.act(() => {
      test.foo = 2;
    })

    expect(hook.output).toBe(2);
  })

  it("will throw if instance not found", () => {
    class Test extends Model {
      value = 1;
    }

    const useTest = jest.fn(() => {
      expect(() => Test.get(x => x)).toThrow("Could not find Test in context.");
    });
    
    mockHook(useTest);
    expect(useTest).toHaveReturned();
  });

  it('will compute output', async () => {
    const test = Test.new();
    const hook = mockHook(test, () => {
      return Test.get(x => x.foo + x.bar);
    });

    expect(hook.output).toBe(3);

    await hook.act(() => {
      test.foo = 2;
    })

    expect(hook.output).toBe(4);
  })

  it('will ignore updates with same result', async () => {
    const test = Test.new();
    const compute = jest.fn();

    const hook = mockHook(test, () => {
      return Test.get(x => {
        compute();
        void x.foo;
        return x.bar;
      });
    });

    expect(hook.output).toBe(2);
    expect(compute).toBeCalled();

    test.foo = 2;
    await test.set(0);

    // did attempt a second compute
    expect(compute).toBeCalledTimes(2);

    // compute did not trigger a new render
    expect(hook).toBeCalledTimes(1);
    expect(hook.output).toBe(2);
  })

  it("will disable updates if null returned", async () => {
    const test = Test.new();
    const didRender = jest.fn(() => {
      return Test.get($ => null);
    })

    const hook = mockHook(test, didRender);

    expect(didRender).toBeCalledTimes(1);
    expect(hook.output).toBe(null);

    test.foo = 2;

    await expect(test).toUpdate();

    expect(didRender).toBeCalledTimes(1);
  })

  it("will use returned function as compute", async () => {
    const test = Test.new();
    const willCompute = jest.fn();
    const willCreate = jest.fn();

    const hook = mockHook(test, () => {
      return Test.get($ => {
        willCreate();
        void $.foo;
  
        return () => {
          willCompute();
          return $.foo + $.bar;
        };
      });
    });

    expect(hook.output).toBe(3);

    expect(willCreate).toBeCalledTimes(1);
    expect(willCompute).toBeCalledTimes(1);

    await hook.act(() => {
      test.foo = 2;
    });

    expect(willCreate).toBeCalledTimes(1);
    expect(willCompute).toBeCalledTimes(2);

    expect(hook.output).toBe(4);
  })

  it("will not subscribe to keys pulled by factory", async () => {
    const test = Test.new();
    const willCompute = jest.fn();

    const hook = mockHook(test, () => {
      return Test.get($ => {
        void $.foo;
  
        return () => {
          willCompute();
          return $.bar;
        };
      });
    });

    expect(hook.output).toBe(2);

    test.foo = 2;

    await test.set(0);

    expect(willCompute).toBeCalledTimes(1);
    expect(hook.output).toBe(2);

    await hook.act(() => {
      test.bar = 3;
    });

    expect(willCompute).toBeCalledTimes(2);
    expect(hook.output).toBe(3);
  })
})

describe.skip("async", () => {
  class Test extends Model {
    foo = "bar";
  };

  it('will not subscribe to values', async () => {
    const promise = mockPromise<string>();

    const test = Test.new();
    const hook = mockHook(test, () => {
      return Test.get(async $ => {
        void $.foo;
        return promise;
      });
    });

    expect(hook).toBeCalledTimes(1);

    promise.resolve("foobar");

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(hook).toBeCalledTimes(2);
    expect(hook.output).toBe("foobar");

    test.foo = "foo";
    await expect(test).toUpdate();

    expect(hook).toBeCalledTimes(2);
  });

  it('will suspend', async () => {
    const promise = mockPromise();
    const compute = jest.fn(() => promise)

    const hook = mockHook(Test, () => {
      return Test.get(compute);
    });

    expect(hook.suspense).toBe(true);

    await hook.act(() => {
      promise.resolve();
    });

    expect(hook).toBeCalledTimes(2);
    expect(compute).toBeCalledTimes(1);
  })
})

describe("undefined", () => {
  class Test extends Model {};

  it("will convert to null", () => {
    const hook = mockHook(Test, () => {
      return Test.get(() => {});
    });

    expect(hook.output).toBe(null);
  })

  it("will convert to null from factory", () => {
    const hook = mockHook(Test, () => {
      return Test.get(() => () => {});
    });

    expect(hook.output).toBe(null);
  })
})

describe("update callback", () => {
  class Test extends Model {
    foo = "bar";
  };

  it("will force a refresh", async () => {
    const didEvaluate = jest.fn();
    let forceUpdate!: () => void;

    const hook = mockHook(Test, () => {
      return Test.get((_, update) => {
        didEvaluate();
        forceUpdate = update;
      });
    });

    expect(didEvaluate).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledTimes(1);
    
    await hook.act(() => {
      forceUpdate();
    });
    
    expect(didEvaluate).toHaveBeenCalledTimes(2);
    expect(hook).toHaveBeenCalledTimes(2);
  })

  it("will refresh without reevaluating", async () => {
    const didEvaluate = jest.fn();
    let forceUpdate!: () => void;
    
    const hook = mockHook(Test, () => {
      return Test.get((_, update) => {
        didEvaluate();
        forceUpdate = update;
        // return null to stop subscription.
        return null;
      });
    });

    expect(didEvaluate).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledTimes(1);
    
    await hook.act(() => {
      forceUpdate();
    })
    
    expect(didEvaluate).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledTimes(2);
  })

  it("will refresh returned function instead", async () => {
    const didEvaluate = jest.fn();
    const didEvaluateInner = jest.fn();
    
    let updateValue!: (value: string) => void;
    
    const hook = mockHook(Test, () => {
      return Test.get((_, update) => {
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

    expect(hook.output).toBe("foo");
    expect(didEvaluate).toHaveBeenCalledTimes(1);
    
    await hook.act(() => {
      updateValue("bar");
    });
    
    expect(hook.output).toBe("bar");
    expect(didEvaluate).toHaveBeenCalledTimes(1);
    expect(didEvaluateInner).toHaveBeenCalledTimes(2);
  })

  it("will refresh again after promise", async () => {
    const promise = mockPromise();
    
    let forceUpdate!: <T>(after: Promise<T>) => Promise<T>;

    const hook = mockHook(Test, () => {
      return Test.get((_, update) => {
        forceUpdate = update;
        return null;
      });
    });

    expect<null>(hook.output).toBe(null);
    expect(hook).toHaveBeenCalledTimes(1);

    await hook.act(() => {
      forceUpdate(promise)
    });

    expect(hook).toHaveBeenCalledTimes(2);

    await hook.act(() => {
      promise.resolve();
    });

    expect(hook).toHaveBeenCalledTimes(3);
  })

  it("will invoke async function", async () => {
    const promise = mockPromise();
    
    let forceUpdate!: <T>(after: () => Promise<T>) => Promise<T>;

    const hook = mockHook(Test, () => {
      return Test.get((_, update) => {
        forceUpdate = update;
        return null;
      });
    });

    expect(hook).toHaveBeenCalledTimes(1);

    await hook.act(() => {
      forceUpdate(() => promise);
    })

    expect(hook).toHaveBeenCalledTimes(2);

    await hook.act(() => {
      promise.resolve();
    });

    expect(hook).toHaveBeenCalledTimes(3);
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
    const hook = mockHook(bar, () => Foo.use().is.bar);

    expect(hook.output).toBe(bar);
  })

  it("will subscribe peer from context", async () => {
    const bar = Bar.new();
    const hook = mockHook(bar, () => Foo.use().bar.value);

    expect(hook.output).toBe("bar");

    await hook.act(() => {
      bar.value = "foo";
    });

    expect(hook.output).toBe("foo");
    expect(hook).toBeCalledTimes(2);
  })

  it("will return undefined if instance not found", () => {
    class Foo extends Model {
      bar = get(Bar, false);
    }

    const hook = mockHook(() => Foo.use().bar);

    expect(hook.output).toBeUndefined();
  })

  it("will throw if instance not found", () => {
    class Foo extends Model {
      bar = get(Bar);

      constructor(){
        super("ID");
      }
    }

    const tryToRender = () => mockHook(() => Foo.use().bar);

    expect(tryToRender).toThrowError(`Attempted to find an instance of Bar in context. It is required by Foo-ID, but one could not be found.`);
  })

  it("will prefer parent over context", () => {
    class Parent extends Model {
      child = use(Child);
      value = "foo";
    }

    class Child extends Model {
      parent = get(Parent);
    }

    const { output } = mockHook(Parent, () => Parent.use().is);

    expect(output.child.parent).toBe(output);
  })

  it("will throw if parent required in-context", () => {
    class Ambient extends Model {}
    class Child extends Model {
      expects = get(Ambient, true);
    }
  
    const attempt = () => Child.new("ID");
  
    expect(attempt).toThrowError(`New Child-ID created standalone but requires parent of type Ambient.`);
  })
})