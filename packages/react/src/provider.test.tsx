import React, { Fragment, Suspense } from 'react';
import { create } from 'react-test-renderer';

import { Consumer, Model, get, set } from '.';
import { Provider } from './provider';
import { mockAsync } from './tests';

const timeout = (ms: number) => new Promise(res => setTimeout(res, ms));

describe("component", () => {
  class Foo extends Model {
    value?: string = undefined;
  }
  class Bar extends Model {}

  it("will create instance of given model", () => {
    create(
      <Provider for={Foo}>
        <Consumer for={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
      </Provider>
    );
  })
  
  it("will destroy instance of given model", async () => {
    const willDestroy = jest.fn();
  
    class Test extends Model {
      null(){
        willDestroy();
        super.null();
      }
    };
  
    const element = create(
      <Provider for={Test} />
    );
  
    element.unmount();
    await timeout(1);
    expect(willDestroy).toBeCalledTimes(1);
  });
  
  it("will create all models in given object", () => {
    create(
      <Provider for={{ Foo, Bar }}>
        <Consumer for={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
        <Consumer for={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
      </Provider>
    )
  })
  
  it("will destroy created model on unmount", async () => {
    const willDestroy = jest.fn();
  
    class Test extends Model {}
  
    const rendered = create(
      <Provider for={{ Test }}>
        <Consumer for={Test} has={i => {
          expect(i).toBeInstanceOf(Test)
          i.get(() => willDestroy);
        }} />
      </Provider>
    );
  
    rendered.unmount();
    await timeout(0);
    expect(willDestroy).toBeCalled();
  })
  
  it("will destroy multiple created on unmount", async () => {
    const willDestroy = jest.fn();
  
    class Foo extends Model {}
    class Bar extends Model {}
  
    const rendered = create(
      <Provider for={{ Foo, Bar }}>
        <Consumer for={Foo} has={i => {
          i.get(() => willDestroy);
        }} />
        <Consumer for={Bar} has={i => {
          i.get(() => willDestroy);
        }} />
      </Provider>
    );
  
    rendered.unmount();
    await timeout(0);
    expect(willDestroy).toBeCalledTimes(2);
  })
  
  it("will not destroy given instance on unmount", async () => {
    const didUnmount = jest.fn();
  
    class Test extends Model {}
  
    const instance = Test.new();
  
    const rendered = create(
      <Provider for={{ instance }}>
        <Consumer for={Test} has={i => {
          i.get(() => didUnmount);
        }} />
      </Provider>
    );
  
    rendered.unmount();
    await timeout(0);
    expect(didUnmount).not.toBeCalled();
  })
  
  it("will provide a mix of state and models", () => {
    const foo = Foo.new();
  
    create(
      <Provider for={{ foo, Bar }}>
        <Consumer for={Foo} get={i => expect(i).toBe(foo)} />
        <Consumer for={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
      </Provider>
    )
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

  const error = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});

  afterAll(() => error.mockRestore());

  it("will throw on bad for prop", () => {
    const render = () => create(
      <Provider for={undefined as any} />
    )
    
    expect(render).toThrowError("Provider expects a Model instance or class but got undefined.");
  })

  it("will throw on bad property in for prop", () => {
    const render = () => create(
      <Provider for={{ Thing: undefined as any }} />
    )
    
    expect(render).toThrowError("Provider expects a Model instance or class but got undefined as Thing.");
  })
})

describe("use prop", () => {
  class Foo extends Model {
    value?: string = undefined;
  }

  it("will assign values to instance", () => {
    create(
      <Provider for={Foo} use={{ value: "foobar" }}>
        <Consumer for={Foo} has={i => expect(i.value).toBe("foobar")} />
      </Provider>
    );
  })

  it("will assign values to muliple", () => {
    class Bar extends Model {
      value = "";
    }

    create(
      <Provider for={{ Foo, Bar }} use={{ value: "foobar" }}>
        <Consumer for={Foo} has={i => expect(i.value).toBe("foobar")} />
        <Consumer for={Bar} has={i => expect(i.value).toBe("foobar")} />
      </Provider>
    );
  });

  it("will not assign foreign values", () => {
    create(
      // @ts-expect-error - type-checking warns against this
      <Provider for={Foo} use={{ nonValue: "foobar" }}>
        <Consumer for={Foo} has={i => {
          // @ts-expect-error
          expect(i.nonValue).toBeUndefined();
        }} />
      </Provider>
    );
  })
})

describe("suspense", () => {
  class Test extends Model {
    value = set(promise.pending);
  }

  const DidSuspend = () => {
    didSuspend();
    return null;
  }

  const TestComponent = (
    props: { fallback?: React.ReactNode }) => {

    willRender();
    return (
      <Provider for={Test} fallback={props.fallback}>
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

  beforeEach(() => {
    willRender.mockClear();
    didSuspend.mockClear();
    didRender.mockClear();
  })

  it("will apply fallback", async () => {
    const element = create(
      <TestComponent fallback={<DidSuspend />} />
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

  it("will apply fallback implicitly", async () => {
    const element = create(
      <Suspense fallback={<DidSuspend />}>
        <TestComponent />
      </Suspense>
    )
  
    // Provider itself suspended with default null.
    expect(didSuspend).not.toBeCalled();
    expect(didRender).not.toBeCalled();

    promise.resolve("hello!");
    await didRefresh.pending();

    expect(didRender).toBeCalledWith("hello!");

    element.unmount();
  })

  it("will not apply fallback", async () => {
    const element = create(
      <Suspense fallback={<DidSuspend />}>
        <TestComponent fallback={false} />
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
          <Consumer for={Foo} has={i => expect(i.bar).toBeInstanceOf(Bar)} />
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
        <Consumer for={Bar} has={i => expect(i.foo.bar).toBe(i)} />
        <Consumer for={Foo} has={i => expect(i.bar.foo).toBe(i)} />
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

it.todo("will apply get instructions to new instances");
it.todo("will remove replaced instances");