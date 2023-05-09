import { Model, set } from '.';
import { mockPromise } from './helper/testing';
import { render, context } from './helper/mocks';

abstract class Ambient extends Model {
  constructor(){
    super();
    context.add(this);
  }
}

it("will target abstract class", () => {
  class Test extends Ambient {}

  const test = Test.new();
  const hook = render(() => {
    return Ambient.get(true);
  });

  expect(hook.output).toBe(test);
})

it("will refresh for values accessed", async () => {
  class Test extends Ambient {
    foo = "foo";
  }

  const test = Test.new();
  const hook = render(() => {
    return Test.get().foo;
  });

  expect(hook.output).toBe("foo");
  test.foo = "bar";

  await hook.didUpdate();
})

describe("set factory", () => {
  it('will suspend if function is async', async () => {
    class Test extends Ambient {
      value = set(() => promise);
    }

    Test.new();

    const promise = mockPromise();
    const hook = render(() => {
      void Test.get().value;
    });
  
    expect(hook.pending).toBe(true);
  
    promise.resolve();
    await hook.didUpdate();
  
    expect(hook).toBeCalledTimes(2);
    expect(hook).toHaveReturnedTimes(1);
  })

  it('will refresh and throw if async rejects', async () => {
    const promise = mockPromise();
  
    class Test extends Ambient {
      value = set(async () => {
        await promise;
        throw "oh no";
      })
    }
  
    Test.new();

    const didThrow = mockPromise();
    const hook = render(() => {
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
  
    expect(hook.pending).toBe(true);
  
    promise.resolve();
  
    const error = await didThrow;
  
    expect(error).toBe("oh no");
  })

  it('will suspend if value is promise', async () => {
    const promise = mockPromise<string>();
  
    class Test extends Ambient {
      value = set(promise);
    }
  
    Test.new();

    const hook = render(() => {
      void Test.get().value;
      didRender.resolve();
    });

    const didRender = mockPromise();
  
    expect(hook.pending).toBe(true);
  
    promise.resolve("hello");
    await didRender;
  
    expect(hook).toBeCalledTimes(2);
  })
});

describe("set placeholder", () => {
  it('will suspend if value is accessed before put', async () => {
    class Test extends Ambient {
      foobar = set<string>();
    }

    const instance = Test.new();

    const hook = render(() => {
      Test.get().foobar;
    })

    expect(hook.pending).toBe(true);

    instance.foobar = "foo!";

    // expect refresh caused by update
    await hook.didUpdate();

    expect(hook).toBeCalledTimes(2);

  })

  it('will not suspend if value is defined', async () => {
    class Test extends Ambient {
      foobar = set<string>();
    }

    const instance = Test.new();

    instance.foobar = "foo!";

    const hook = render(() => {
      return Test.get().foobar;
    })

    expect(hook).toHaveReturnedWith("foo!");
  })
});

describe("passive mode", () => {
  it("will not subscribe", async () => {
    class Test extends Ambient {
      value = 1;
    }

    const test = Test.new();
    const hook = render(() => {
      return Test.get(true).value;
    });

    expect(hook).toBeCalledTimes(1);
    expect(hook.output).toBe(1);

    test.value++;

    await expect(test).toUpdate();

    expect(hook).toBeCalledTimes(1);
  });

  it("will throw if not found", () => {
    class Test extends Ambient {
      value = 1;
    }

    const useTest = jest.fn(() => {
      expect(() => Test.get()).toThrow("Could not find Test in context.");
    });
    
    render(useTest);
    expect(useTest).toHaveReturned();
  });

  it("will return undefined if not requred", () => {
    class Test extends Ambient {
      value = 1;
    }

    const useTest = jest.fn(() => Test.get(false));
    
    render(useTest);
    expect(useTest).toHaveReturnedWith(undefined);
  })
})

describe("computed", () => {
  class Test extends Ambient {
    foo = 1;
    bar = 2;
  }

  it('will select and subscribe to subvalue', async () => {
    const parent = Test.new();

    const hook = render(() => {
      return Test.get(x => x.foo);
    });

    expect(hook.output).toBe(1);

    parent.foo = 2;
    await hook.didUpdate();

    expect(hook.output).toBe(2);
  })

  it("will throw if instance not found", () => {
    class Test extends Ambient {
      value = 1;
    }

    const useTest = jest.fn(() => {
      expect(() => Test.get(x => x)).toThrow("Could not find Test in context.");
    });
    
    render(useTest);
    expect(useTest).toHaveReturned();
  });

  it('will compute output', async () => {
    const parent = Test.new();
    const hook = render(() => {
      return Test.get(x => x.foo + x.bar);
    });

    expect(hook.output).toBe(3);

    parent.foo = 2;
    await hook.didUpdate();

    expect(hook.output).toBe(4);
  })

  it('will ignore updates with same result', async () => {
    const parent = Test.new();
    const compute = jest.fn();

    const hook = render(() => {
      return Test.get(x => {
        compute();
        void x.foo;
        return x.bar;
      });
    });

    expect(hook.output).toBe(2);
    expect(compute).toBeCalled();

    parent.foo = 2;
    await parent.on();

    // did attempt a second compute
    expect(compute).toBeCalledTimes(2);

    // compute did not trigger a new render
    expect(hook).toBeCalledTimes(1);
    expect(hook.output).toBe(2);
  })

  it("will disable updates if null returned", async () => {
    const instance = Test.new();
    const didRender = jest.fn(() => {
      return Test.get($ => null);
    })

    const hook = render(didRender);

    expect(didRender).toBeCalledTimes(1);
    expect(hook.output).toBe(null);

    instance.foo = 2;

    await expect(instance).toUpdate();

    expect(didRender).toBeCalledTimes(1);
  })

  it("will use returned function as compute", async () => {
    const test = Test.new();
    const willCompute = jest.fn();
    const willCreate = jest.fn();

    const hook = render(() => {
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

    test.foo = 2;

    await hook.didUpdate();

    expect(willCreate).toBeCalledTimes(1);
    expect(willCompute).toBeCalledTimes(2);

    expect(hook.output).toBe(4);
  })

  it("will not subscribe to keys pulled by factory", async () => {
    const test = Test.new();
    const willCompute = jest.fn();

    const hook = render(() => {
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

    await test.on(0);

    expect(willCompute).toBeCalledTimes(1);
    expect(hook.output).toBe(2);

    test.bar = 3;

    await hook.didUpdate();

    expect(willCompute).toBeCalledTimes(2);
    expect(hook.output).toBe(3);
  })

  describe("tuple", () => {
    class Test extends Ambient {
      foo = 1;
      bar = true;
      baz = "foo";
    }

    it("will not update if values are same", async () => {
      const parent = Test.new();
      const didCompute = jest.fn();
      const didRender = jest.fn();
    
      const hook = render(() => {
        didRender();
        return Test.get(x => {
          didCompute(x.foo);
          return ["something", x.bar, x.baz];
        });
      });

      const returned = hook.output;
    
      expect(returned).toStrictEqual(["something", true, "foo"]);
    
      parent.foo = 2;
      await expect(parent).toUpdate();

      expect(didRender).toBeCalledTimes(1);
      expect(didCompute).toBeCalledWith(2);

      expect(hook.output).toBe(returned);
    })

    it("will update if any value differs", async () => {
      const parent = Test.new();
      const didCompute = jest.fn();
      const didRender = jest.fn();
    
      const hook = render(() => {
        didRender();
        return Test.get(x => {
          didCompute();
          return [x.foo, x.bar, x.baz];
        });
      });
    
      expect(hook.output).toStrictEqual([1, true, "foo"]);
    
      parent.foo = 2;
      parent.bar = false;
      await expect(parent).toUpdate();

      expect(didRender).toBeCalledTimes(2);
      expect(didCompute).toBeCalledTimes(2);
    
      expect(hook.output).toEqual([2, false, "foo"]);
    })
  })

  describe("async", () => {
    class Test extends Ambient {
      foo = "bar";
    };

    it('will return null then refresh', async () => {
      Test.new();

      const promise = mockPromise<string>();
      const hook = render(() => {
        return Test.get(() => promise);
      });

      expect(hook.output).toBeNull();

      promise.resolve("foobar");
      await hook.didUpdate();

      expect(hook.output).toBe("foobar");
    });

    it('will not subscribe to values', async () => {
      const promise = mockPromise<string>();
      const control = Test.new();
      const hook = render(() => {
        return Test.get(async $ => {
          void $.foo;
          return promise;
        });
      });

      expect(hook).toBeCalledTimes(1);

      promise.resolve("foobar");
      await hook.didUpdate();

      expect(hook).toBeCalledTimes(2);
      expect(hook.output).toBe("foobar");

      control.foo = "foo";
      await expect(control).toUpdate();

      expect(hook).toBeCalledTimes(2);
    });
  })

  describe("suspense", () => {
    class Test extends Ambient {
      value?: string = undefined;
    }

    it('will suspend if value expected', async () => {
      const instance = Test.new();
      const compute = jest.fn();
      const hook = render(() => {
        Test.get(state => {
          compute();

          if(state.value == "foobar")
            return true;
        }, true);
      })

      expect(hook.pending).toBe(true);

      expect(hook).toBeCalledTimes(1);
      instance.value = "foobar";

      await hook.didUpdate();

      // 1st - render prior to bailing
      // 2nd - successful render
      expect(hook).toBeCalledTimes(2);
      expect(hook).toHaveReturnedTimes(1);

      // 1st - initial render fails
      // 2nd - recheck success (permit render again)
      // 3rd - hook regenerated next render 
      expect(compute).toBeCalledTimes(2);
    })

    it('will suspend strict async', async () => {
      Test.new();

      const promise = mockPromise();
      const hook = render(() => {
        return Test.get(() => promise, true);
      })

      expect(hook.pending).toBe(true);

      promise.resolve();
      await hook.didUpdate();

      expect(hook).toBeCalledTimes(2);
    })
  })

  describe("undefined", () => {
    class Test extends Ambient {};

    it("will convert to null", () => {
      Test.new();

      const hook = render(() => {
        return Test.get(() => undefined);
      });

      expect(hook.output).toBe(null);
    })

    it("will convert to null from factory", () => {
      Test.new();

      const hook = render(() => {
        return Test.get(() => () => undefined);
      });

      expect(hook.output).toBe(null);
    })
  })

  describe("update callback", () => {
    beforeEach(() => Test.new());

    it("will force a refresh", () => {
      const didEvaluate = jest.fn();
      let forceUpdate!: () => void;

      const hook = render(() => {
        return Test.get(($, update) => {
          didEvaluate();
          forceUpdate = update;
        });
      });

      expect(didEvaluate).toHaveBeenCalledTimes(1);
      expect(hook).toHaveBeenCalledTimes(1);
      
      forceUpdate();
      
      expect(didEvaluate).toHaveBeenCalledTimes(2);
      expect(hook).toHaveBeenCalledTimes(2);
    })

    it("will refresh without reevaluating", () => {
      const didEvaluate = jest.fn();
      let forceUpdate!: () => void;

      const hook = render(() => {
        return Test.get(($, update) => {
          didEvaluate();
          forceUpdate = update;
          // return null to stop subscription.
          return null;
        });
      });

      expect(didEvaluate).toHaveBeenCalledTimes(1);
      expect(hook).toHaveBeenCalledTimes(1);
      
      forceUpdate();
      
      expect(didEvaluate).toHaveBeenCalledTimes(1);
      expect(hook).toHaveBeenCalledTimes(2);
    })

    it("will refresh returned function instead", () => {
      const didEvaluate = jest.fn();
      const didEvaluateInner = jest.fn();

      let updateValue!: (value: string) => void;

      const hook = render(() => {
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

      expect(hook.output).toBe("foo");
      expect(didEvaluate).toHaveBeenCalledTimes(1);
      
      updateValue("bar");
      
      expect(hook.output).toBe("bar");
      expect(didEvaluate).toHaveBeenCalledTimes(1);
      expect(didEvaluateInner).toHaveBeenCalledTimes(2);
    })

    it("will refresh again after promise", async () => {
      const promise = mockPromise<string>();
      
      let forceUpdate!: <T>(after: Promise<T>) => Promise<T>;

      const hook = render(() => {
        return Test.get(($, update) => {
          forceUpdate = update;
          return null;
        });
      });

      expect(hook).toHaveBeenCalledTimes(1);

      const out = forceUpdate(promise);

      expect(hook).toHaveBeenCalledTimes(2);

      promise.resolve("hello");

      await expect(out).resolves.toBe("hello");
      
      expect(hook).toHaveBeenCalledTimes(3);
    })

    it("will invoke async function", async () => {
      const promise = mockPromise();
      
      let forceUpdate!: <T>(after: () => Promise<T>) => Promise<T>;

      const hook = render(() => {
        return Test.get(($, update) => {
          forceUpdate = update;
          return null;
        });
      });

      expect(hook).toHaveBeenCalledTimes(1);

      let pending: boolean | undefined;

      forceUpdate(async () => {
        pending = true;
        await promise;
        pending = false;
      });

      expect(pending).toBe(true);
      expect(hook).toHaveBeenCalledTimes(2);

      promise.resolve();
      
      await hook.didUpdate();
      expect(hook).toHaveBeenCalledTimes(3);
      expect(pending).toBe(false);
    })
  })
})