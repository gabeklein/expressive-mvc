import { context, render } from './helper/mocks';
import { mockPromise } from './helper/testing';
import { set } from './instruction/set';
import { Model } from './model';

describe("use", () => {
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
})

describe("get", () => {
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
  
    await hook.update();
  })
  
  it("will not update on death event", async () => {
    class Test extends Ambient {
      foo = "foo";
    }
  
    const test = Test.new();
    const hook = render(() => {
      return Test.get().foo;
    });
  
    test.null();
  
    expect(hook).toBeCalledTimes(1);
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
      await hook.update();
    
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
      await hook.update();
  
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
      await hook.update();
  
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
      await hook.update();
  
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
      await parent.set(0);
  
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
  
      await hook.update();
  
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
  
      await test.set(0);
  
      expect(willCompute).toBeCalledTimes(1);
      expect(hook.output).toBe(2);
  
      test.bar = 3;
  
      await hook.update();
  
      expect(willCompute).toBeCalledTimes(2);
      expect(hook.output).toBe(3);
    })
  })
  
  describe("async", () => {
    class Test extends Ambient {
      foo = "bar";
    };
  
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
      await hook.update();
  
      expect(hook).toBeCalledTimes(2);
      expect(hook.output).toBe("foobar");
  
      control.foo = "foo";
      await expect(control).toUpdate();
  
      expect(hook).toBeCalledTimes(2);
    });
  
    it('will suspend', async () => {
      Test.new();
  
      const promise = mockPromise();
      const compute = jest.fn(() => promise)
      const hook = render(() => {
        return Test.get(compute);
      });
  
      expect(hook.pending).toBe(true);
  
      promise.resolve();
      await hook.update();
  
      expect(hook).toBeCalledTimes(2);
      expect(compute).toBeCalledTimes(1);
    })
  })
  
  describe("undefined", () => {
    class Test extends Ambient {};
  
    it("will convert to null", () => {
      Test.new();
  
      const hook = render(() => {
        return Test.get(() => {});
      });
  
      expect(hook.output).toBe(null);
    })
  
    it("will convert to null from factory", () => {
      Test.new();
  
      const hook = render(() => {
        return Test.get(() => () => {});
      });
  
      expect(hook.output).toBe(null);
    })
  })
  
  describe("update callback", () => {
    class Test extends Ambient {
      foo = "bar";
    };
  
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
  
      expect<null>(hook.output).toBe(null);
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
      
      await hook.update();
      expect(hook).toHaveBeenCalledTimes(3);
      expect(pending).toBe(false);
    })
  })
})