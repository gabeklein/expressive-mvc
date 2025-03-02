import React, { act, Fragment, Suspense } from 'react';
import { create } from 'react-test-renderer';

import Model, { Consumer, get, has, Provider, set, use } from '.';
import { mockAsync } from './mocks';

const error = jest
  .spyOn(console, "error")
  .mockImplementation(() => {});

afterAll(() => {
  error.mockReset();
});

class Foo extends Model {
  value?: string = undefined;
}
class Bar extends Model {}
class Baz extends Bar {}

describe("Provider", () => {
  it("will create instance of given model", () => {
    create(
      <Provider for={Foo}>
        <Consumer for={Foo}>
          {i => expect(i).toBeInstanceOf(Foo)}
        </Consumer>
      </Provider>
    );
  })
  
  it("will create all models in given object", () => {
    create(
      <Provider for={{ Foo, Bar }}>
        <Consumer for={Foo}>
          {i => expect(i).toBeInstanceOf(Foo)}
        </Consumer>
        <Consumer for={Bar}>
          {i => expect(i).toBeInstanceOf(Bar)}
        </Consumer>
      </Provider>
    )
  })
  
  it("will provide a mix of state and models", () => {
    const foo = Foo.new();
  
    create(
      <Provider for={{ foo, Bar }}>
        <Consumer for={Foo}>
          {({ is }) => expect(is).toBe(foo)}
        </Consumer>
        <Consumer for={Bar}>
          {i => expect(i).toBeInstanceOf(Bar)}
        </Consumer>
      </Provider>
    )
  })
  
  it("will provide children of given model", () => {
    class Foo extends Model {
      value?: string = undefined;
    }
    class Bar extends Model {
      foo = use(Foo);
    }
  
    create(
      <Provider for={Bar}>
        <Consumer for={Foo}>
          {i => expect(i).toBeInstanceOf(Foo)}
        </Consumer>
      </Provider>
    )
  })
  
  it("will destroy created model on unmount", () => {
    const willDestroy = jest.fn();
  
    class Test extends Model {}
  
    const element = create(
      <Provider for={{ Test }}>
        <Consumer for={Test}>
          {i => {
            expect(i).toBeInstanceOf(Test)
            i.get(() => willDestroy);
          }}
        </Consumer>
      </Provider>
    );
  
    act(() => element.unmount());
    expect(willDestroy).toBeCalled();
  })
  
  it("will destroy multiple created on unmount", async () => {
    const willDestroy = jest.fn();
  
    class Foo extends Model {}
    class Bar extends Model {}
  
    const element = create(
      <Provider for={{ Foo, Bar }}>
        <Consumer for={Foo}>
          {i => { i.get(() => willDestroy) }}
        </Consumer>
        <Consumer for={Bar}>
          {i => { i.get(() => willDestroy) }}
        </Consumer>
      </Provider>
    );
  
    
    act(() => element.unmount());
    expect(willDestroy).toBeCalledTimes(2);
  })
  
  it("will not destroy given instance on unmount", async () => {
    const didUnmount = jest.fn();
  
    class Test extends Model {}
  
    const instance = Test.new();
  
    const element = create(
      <Provider for={{ instance }}>
        <Consumer for={Test}>
          {i => void i.get(() => didUnmount)}
        </Consumer>
      </Provider>
    );
  
    await act(() => element.unmount());
    expect(didUnmount).not.toBeCalled();
  })
  
  it("will conflict colliding Model types", () => {
    const foo = Foo.new();
  
    const Consumer: React.FC = jest.fn(() => {
      expect(() => Foo.get()).toThrowError(
        "Did find Foo in context, but multiple were defined."
      );
      return null;
    });
  
    create(
      <Provider for={{ Foo, foo }}>
        <Consumer />
      </Provider>
    )
  
    expect(Consumer).toHaveBeenCalled();
  })

  describe("forEach prop", () => {
    it("will call function for each model", () => {
      const forEach = jest.fn();
  
      create(
        <Provider for={{ Foo, Bar }} forEach={forEach} />
      );
  
      expect(forEach).toBeCalledTimes(2);
      expect(forEach).toBeCalledWith(expect.any(Foo));
      expect(forEach).toBeCalledWith(expect.any(Bar));
    });

    it("will cleanup on unmount", () => {
      const forEach = jest.fn(() => cleanup);
      const cleanup = jest.fn();

      const rendered = create(
        <Provider for={{ Foo, Bar }} forEach={forEach} />
      );
  
      expect(forEach).toBeCalledTimes(2);
      expect(forEach).toBeCalledWith(expect.any(Foo));
      expect(forEach).toBeCalledWith(expect.any(Bar));
      expect(cleanup).not.toBeCalled();

      act(() => rendered.unmount());
      expect(cleanup).toBeCalledTimes(2);
    });
  })

  describe("set prop", () => {
    it("will assign values to instance", () => {
      create(
        <Provider for={Foo} set={{ value: "foobar" }}>
          <Consumer for={Foo}>
            {i => expect(i.value).toBe("foobar")}
          </Consumer>
        </Provider>
      );
    })
  
    it("will trigger set instruction", () => {
      class Foo extends Model {
        value = set("foobar", didSet);
      }
  
      const didSet = jest.fn();
  
      create(
        <Provider for={Foo} set={{ value: "barfoo" }}>
          <Consumer for={Foo}>
            {i => {
              expect(didSet).toBeCalled();
              expect(i.value).toBe("barfoo");
            }}
          </Consumer>
        </Provider>
      );
    })
    
    it("will assign values to muliple", () => {
      class Bar extends Model {
        value = "";
      }
    
      create(
        <Provider for={{ Foo, Bar }} set={{ value: "foobar" }}>
          <Consumer for={Foo}>
            {i => expect(i.value).toBe("foobar")}
          </Consumer>
          <Consumer for={Bar}>
            {i => expect(i.value).toBe("foobar")}
          </Consumer>
        </Provider>
      );
    });
    
    it("will not assign foreign values", () => {
      create(
        <Provider for={Foo} set={{ nonValue: "foobar" }}>
          <Consumer for={Foo}>
            {i => {
              // @ts-expect-error
              expect(i.nonValue).toBeUndefined();
            }}
          </Consumer>
        </Provider>
      );
    })
  });
});

describe("Consumer", () => {
  it("will render with instance for child-function", async () => {
    class Test extends Model {
      value = "foo";
    }

    const instance = Test.new();
    const didRender = jest.fn();

    function onRender(instance: Test){
      const { value } = instance;
      didRender(value);
      return <span>{value}</span>;
    }

    const result = create(
      <Provider for={instance}>
        <Consumer for={Test}>
          {onRender}
        </Consumer>
      </Provider>
    )

    expect(didRender).toBeCalledWith("foo");
    expect(result.toJSON()).toEqual({
      type: "span",
      props: {},
      children: ["foo"]
    });
    
    instance.value = "bar";
    await instance.set();

    expect(didRender).toBeCalledWith("bar");
    expect(result.toJSON()).toEqual({
      type: "span",
      props: {},
      children: ["bar"]
    });
  })

  it("will throw if not found", () => {
    const test = () => create(
      <Consumer for={Bar}>
        {i => void i}
      </Consumer>
    )
  
    expect(test).toThrowError("Could not find Bar in context.");
  })

  it("will select extended class", () => {
    create(
      <Provider for={Baz}>
        <Consumer for={Bar}>
          {i => expect(i).toBeInstanceOf(Baz)}
        </Consumer>
      </Provider>
    )
  })

  it("will select closest instance of same type", () => {
    create(
      <Provider for={Foo} set={{ value: "outer" }}>
        <Provider for={Foo} set={{ value: "inner" }}>
          <Consumer for={Foo}>
            {i => expect(i.value).toBe("inner")}
          </Consumer>
        </Provider>
      </Provider>
    )
  });

  it("will select closest match over best match", () => {
    create(
      <Provider for={Bar}>
        <Provider for={Baz}>
          <Consumer for={Bar}>
            {i => expect(i).toBeInstanceOf(Baz)}
          </Consumer>
        </Provider>
      </Provider>
    )
  })

  it("will handle complex arrangement", () => {
    const instance = Foo.new();
  
    create(
      <Provider for={instance}>
        <Provider for={Baz}>
          <Provider for={{ Bar }}>
            <Consumer for={Foo}>
              {({ is }) => expect(is).toBe(instance)}
            </Consumer>
            <Consumer for={Bar}>
              {i => expect(i).toBeInstanceOf(Bar)}
            </Consumer>
            <Consumer for={Baz}>
              {i => expect(i).toBeInstanceOf(Baz)}
            </Consumer>
          </Provider>
        </Provider>
      </Provider>
    )
  })
})

describe("get instruction", () => {
  class Foo extends Model {
    bar = get(Bar);
  }

  class Bar extends Model {
    value = "bar";
  }

  it("will attach where created by provider", () => {
    create(
      <Provider for={Bar}>
        <Provider for={Foo}>
          <Consumer for={Foo}>
            {i => expect(i.bar).toBeInstanceOf(Bar)}
          </Consumer>
        </Provider>
      </Provider>
    );
  })

  it("will see peers sharing same provider", () => {
    class Foo extends Model {
      bar = get(Bar);
    }
    class Bar extends Model {
      foo = get(Foo);
    }

    create(
      <Provider for={{ Foo, Bar }}>
        <Consumer for={Bar}>
          {({ is }) => expect(is.foo.bar).toBe(is)}
        </Consumer>
        <Consumer for={Foo}>
          {({ is }) => expect(is.bar.foo).toBe(is)}
        </Consumer>
      </Provider>
    );
  });

  it("will see multiple peers provided", async () => {
    class Foo extends Model {};
    class Baz extends Model {
      bar = get(Bar);
      foo = get(Foo);
    };

    const Inner = () => {
      const { bar, foo } = Baz.use();

      expect(bar).toBeInstanceOf(Bar);
      expect(foo).toBeInstanceOf(Foo);

      return null;
    }

    create(
      <Provider for={{ Foo, Bar }}>
        <Inner />
      </Provider>
    );
  })

  it("will maintain hook", async () => {
    const Inner: React.FC = jest.fn(() => {
      Foo.use();
      return null;
    })

    const x = create(
      <Provider for={Bar}>
        <Inner />
      </Provider>
    );

    x.update(
      <Provider for={Bar}>
        <Inner />
      </Provider>
    );

    expect(Inner).toBeCalledTimes(2);
  })

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

    create(
      <Provider for={Ambient}>
        <Provider for={Test} />
      </Provider>
    )
  })

  it("will throw if not resolved", () => {
    class Foo extends Model {}
    class Bar extends Model {
      foo = get(Foo);
    }

    const bar = Bar.new();
    
    expect(() => bar.foo).toThrow(expect.any(Promise));

    create(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    expect(bar.foo).toBeInstanceOf(Foo);
  });

  it("will resolve when assigned to", async () => {
    class Foo extends Model {}
    class Bar extends Model {
      foo = get(Foo);
    }

    const bar = Bar.new();
    let pending!: Promise<any>;

    try {
      void bar.foo;
    }
    catch(err: unknown){
      if(err instanceof Promise)
        pending = err;
    }
    
    expect(pending).toBeInstanceOf(Promise);

    create(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    await expect(pending).resolves.toBeInstanceOf(Foo);
  })

  it("will resolve multiple", async () => {
    class Foo extends Model {}
    class Bar extends Model {
      foo = get(Foo, false);
      bar = get(Foo, false);
    }

    const foo = Foo.new();
    const bar = Bar.new();

    expect(bar.foo).toBeUndefined();
    expect(bar.bar).toBeUndefined();

    create(
      <Provider for={foo}>
        <Provider for={bar} />
      </Provider>
    );

    expect(bar.foo).toBe(foo);
    expect(bar.bar).toBe(foo);
  })

  it("will refresh an effect when assigned to", async () => {
    class Foo extends Model {}
    class Bar extends Model {
      foo = get(Foo);
    }

    const bar = Bar.new();
    const effect = jest.fn(bar => void bar.foo);

    bar.get(effect);

    expect(effect).toHaveBeenCalled();
    expect(effect).not.toHaveReturned();

    create(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    await expect(bar).toHaveUpdated();
    
    expect(effect).toHaveBeenCalledTimes(2);
    expect(effect).toHaveReturnedTimes(1);
  })

  it("will prevent compute if not yet resolved", () => {
    class Foo extends Model {
      value = "foobar";
    }
    class Bar extends Model {
      foo = get(Foo);
    }

    const bar = Bar.new();
    
    expect(() => bar.foo.value).toThrow(expect.any(Promise));

    create(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    expect(bar.foo.value).toBe("foobar");
  })

  it("will compute immediately in context", () => {
    class Foo extends Model {
      value = "foobar";
    }
    class Bar extends Model {
      foo = get(Foo);
    }

    const FooBar = () => {
      return <>{Bar.use().foo.value}</>
    }

    const render = create(
      <Provider for={Foo}>
        <FooBar />
      </Provider>
    );

    expect(render.toJSON()).toBe("foobar");
  })
})

describe("has instruction", () => {
  it("will notify parent", () => {
    class Foo extends Model {
      value = has(Bar, didGetBar);
    }

    class Bar extends Model {
      foo = get(Foo);
    }

    const didGetBar = jest.fn();
    const FooBar = () => void Bar.use();
    const foo = Foo.new();

    create(
      <Provider for={foo}>
        <FooBar />
        <FooBar />
      </Provider>
    );

    expect(didGetBar).toBeCalledTimes(2);
    expect(foo.value).toEqual([expect.any(Bar), expect.any(Bar)]);
    expect(foo.value.map(i => i.foo)).toEqual([foo, foo]);
  });

  it.skip("will notify parent of instance", () => {
    class Foo extends Model {
      value = has(Bar, didGetBar);
    }

    class Bar extends Model {
      foo = get(Foo);
    }

    const didGetBar = jest.fn();
    const FooBar = () => void Bar.use();

    const Component = () => {
      const foo = Foo.use();

      return (
        <Provider for={foo}>
          <FooBar />
        </Provider>
      )
    }

    create(<Component />);
    expect(didGetBar).toBeCalled();
  });
})

describe("suspense", () => {
  class Test extends Model {
    value = set(promise.pending, true);
  }

  const DidSuspend = () => {
    didSuspend();
    return null;
  }

  const TestComponent = (props: {}) => {
    willRender();
    return (
      <Provider for={Test}>
        <GetValue />
      </Provider>
    )
  }

  const GetValue = () => {
    const test = Test.get();
    didRender(test.value);
    didRefresh.resolve();
    return null;
  }

  const promise = mockAsync<string>();
  const didRefresh = mockAsync();

  const willRender = jest.fn();
  const didRender = jest.fn();
  const didSuspend = jest.fn();

  afterEach(() => {
    willRender.mockClear();
    didSuspend.mockClear();
    didRender.mockClear();
  })

  it("will apply fallback", async () => {
    const element = create(
      <Suspense fallback={<DidSuspend />}>
        <TestComponent />
      </Suspense>
    )

    expect(willRender).toBeCalledTimes(1);
    expect(didSuspend).toBeCalledTimes(1);
    expect(didRender).not.toBeCalled();

    promise.resolve("hello!");
    await didRefresh.pending();

    expect(willRender).toBeCalledTimes(1);
    expect(didSuspend).toBeCalledTimes(1);
    expect(didRender).toBeCalledWith("hello!");

    element.unmount();
  });
})

describe("HMR", () => {
  it("will replace model", () => {
    let Control = class Control extends Model {
      value = "foo";
    }

    const Child = () => (
      <Fragment>
        {Control.get().value}
      </Fragment>
    )

    const element = create(
      <Provider for={Control}>
        <Child />
      </Provider>
    )

    expect(element.toJSON()).toBe("foo");

    Control = class Control extends Model {
      value = "bar";
    }

    element.update(
      <Provider for={Control}>
        <Child />
      </Provider>
    )

    expect(element.toJSON()).toBe("bar");

    element.unmount();
  })
})