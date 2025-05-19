import { act, render, screen } from '@testing-library/react';
import React, { Suspense } from 'react';

import Model, { Consumer, get, has, Provider, set, use } from '.';

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
    render(
      <Provider for={Foo}>
        <Consumer for={Foo}>
          {i => expect(i).toBeInstanceOf(Foo)}
        </Consumer>
      </Provider>
    );
  })
  
  it("will create all models in given object", () => {
    render(
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
  
    render(
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
  
    render(
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
  
    const element = render(
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
  
    const element = render(
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
  
    const element = render(
      <Provider for={{ instance }}>
        <Consumer for={Test}>
          {i => void i.get(() => didUnmount)}
        </Consumer>
      </Provider>
    );
  
    act(() => element.unmount());
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
  
    render(
      <Provider for={{ Foo, foo }}>
        <Consumer />
      </Provider>
    )
  
    expect(Consumer).toHaveBeenCalled();
  })

  it("will throw if set prop is used", () => {
    const test = () => render(
      // @ts-expect-error
      <Provider for={Foo} set={jest.fn()} />
    )
  
    expect(test).toThrowError(
      "The `set` prop is deprecated. Use `forEach` or <Foo {...props} /> instead."
    );
  })

  it("will destroy from bottom-up", async () => {
    const didDestroy = jest.fn();
    
    class Test extends Model {
      constructor(...args: Model.Args){
        super(...args);
        this.set(null, () => {
          didDestroy(this.constructor.name);
        });
      }
    }

    class Parent extends Test {}
    class Child extends Test {}
    
    const Example = () => (
      <Provider for={Parent}>
        <Provider for={Child} />
      </Provider>
    )

    const element = render(<Example />);

    act(() => element.unmount());
    
    expect(didDestroy.mock.calls).toEqual([["Child"], ["Parent"]]);
  })

  describe("forEach prop", () => {
    it("will call function for each model", () => {
      const forEach = jest.fn();
  
      render(
        <Provider for={{ Foo, Bar }} forEach={forEach} />
      );
  
      expect(forEach).toBeCalledTimes(2);
      expect(forEach).toBeCalledWith(expect.any(Foo));
      expect(forEach).toBeCalledWith(expect.any(Bar));
    });

    it("will cleanup on unmount", () => {
      const forEach = jest.fn(() => cleanup);
      const cleanup = jest.fn();

      const rendered = render(
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

    render(
      <Provider for={instance}>
        <Consumer for={Test}>
          {onRender}
        </Consumer>
      </Provider>
    )

    expect(didRender).toBeCalledWith("foo");

    screen.getByText("foo");

    await act(async () => {
      return instance.set({ value: "bar" });
    });

    expect(didRender).toBeCalledWith("bar");
    
    screen.getByText("bar");
  })

  it("will throw if not found", () => {
    const test = () => render(
      <Consumer for={Bar}>
        {i => void i}
      </Consumer>
    )
  
    expect(test).toThrowError("Could not find Bar in context.");
  })

  it("will select extended class", () => {
    render(
      <Provider for={Baz}>
        <Consumer for={Bar}>
          {i => expect(i).toBeInstanceOf(Baz)}
        </Consumer>
      </Provider>
    )
  })

  it("will select closest instance of same type", () => {
    render(
      <Provider for={Foo} forEach={x => { x.value = "outer" }}>
        <Provider for={Foo} forEach={x => { x.value = "inner" }}>
          <Consumer for={Foo}>
            {i => expect(i.value).toBe("inner")}
          </Consumer>
        </Provider>
      </Provider>
    )
  });

  it("will select closest match over best match", () => {
    render(
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
  
    render(
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
    render(
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

    render(
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

    render(
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

    const x = render(
      <Provider for={Bar}>
        <Inner />
      </Provider>
    );

    x.rerender(
      <Provider for={Bar}>
        <Inner />
      </Provider>
    );

    expect(Inner).toBeCalledTimes(2);
  })

  it("will attach before model init", () => {
    class Parent extends Model {
      foo = "foo";
    }

    class Child extends Model {
      parent = get(Parent);

      constructor(){
        super(() => {
          expect(this.parent).toBeInstanceOf(Parent);
        });
      }
    }

    render(
      <Provider for={Parent}>
        <Provider for={Child} />
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

    render(
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

    render(
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

    render(
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

    render(
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

    render(
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

    render(
      <Provider for={Foo}>
        <FooBar />
      </Provider>
    );

    screen.getByText("foobar");
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

    render(
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

    render(<Component />);
    expect(didGetBar).toBeCalled();
  });
})

describe("suspense", () => {
  it("will apply fallback and resolve", async () => {
    let resolve!: (value: string) => void;

    class Test extends Model {
      value = set<string>(() => new Promise(res => resolve = res), true);
    }

    const GetValue = () => {
      const { value } = Test.get();
      return <span>{value}</span>;
    };

    const TestComponent = () => (
      <Provider for={Test}>
        <Suspense fallback={<span>Loading...</span>}>
          <GetValue />
        </Suspense>
      </Provider>
    );

    render(<TestComponent />);

    screen.getByText("Loading...")

    await act(async () => {
      resolve("hello!");
    });

    await screen.findByText("hello!")
  });
})

describe("HMR", () => {
  it("will replace model", () => {
    let Control = class Control extends Model {
      value = "foo";
    }

    const Child = () => (
      <>
        {Control.get().value}
      </>
    )

    const element = render(
      <Provider for={Control}>
        <Child />
      </Provider>
    )

    // expect(element.toJSON()).toBe("foo");

    screen.getByText("foo");

    Control = class Control extends Model {
      value = "bar";
    }

    element.rerender(
      <Provider for={Control}>
        <Child />
      </Provider>
    )

    screen.getByText("bar");

    element.unmount();
  })
})