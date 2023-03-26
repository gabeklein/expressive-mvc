import React, { Suspense } from 'react';

import { Model, set } from '.';
import { Consumer } from './consumer';
import { mockAsync, render } from './helper/testing';
import { Oops, Provider } from './provider';
import { Oops as Context } from './useContext';

class Foo extends Model {
  value?: string = undefined;
}
class Bar extends Model {}

it("will create instance of given model", () => {
  render(
    <Provider for={Foo}>
      <Consumer for={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
    </Provider>
  );
})

it("will destroy instance of given model", async () => {
  const willDestroy = jest.fn();
  class Test extends Model {
    gc(){
      willDestroy();
      super.gc();
    }
  };

  const element = render(
    <Provider for={Test} />
  );

  element.unmount();
  expect(willDestroy).toBeCalledTimes(1);
});

it("will create all models in given object", () => {
  render(
    <Provider for={{ Foo, Bar }}>
      <Consumer for={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
      <Consumer for={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
    </Provider>
  )
})

it("will destroy created model on unmount", () => {
  const willDestroy = jest.fn();

  class Test extends Model {}

  const rendered = render(
    <Provider for={{ Test }}>
      <Consumer for={Test} has={i => {
        expect(i).toBeInstanceOf(Test)
        i.on(() => willDestroy, []);
      }} />
    </Provider>
  );

  rendered.unmount();
  expect(willDestroy).toBeCalled();
})

it("will destroy multiple created on unmount", () => {
  const willDestroy = jest.fn();

  class Foo extends Model {}
  class Bar extends Model {}

  const rendered = render(
    <Provider for={{ Foo, Bar }}>
      <Consumer for={Foo} has={i => {
        i.on(() => willDestroy, []);
      }} />
      <Consumer for={Bar} has={i => {
        i.on(() => willDestroy, []);
      }} />
    </Provider>
  );

  rendered.unmount();
  expect(willDestroy).toBeCalledTimes(2);
})

it("will not destroy given instance on unmount", () => {
  const didUnmount = jest.fn();

  class Test extends Model {}

  const instance = Test.new();

  const rendered = render(
    <Provider for={{ instance }}>
      <Consumer for={Test} has={i => {
        i.on(() => didUnmount, []);
      }} />
    </Provider>
  );

  rendered.unmount();
  expect(didUnmount).not.toBeCalled();
})

it("will create all models in given array", () => {
  render(
    <Provider for={[ Foo, Bar ]}>
      <Consumer for={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
      <Consumer for={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
    </Provider>
  )
})

it("will provide a mix of state and models", () => {
  const foo = Foo.new();

  render(
    <Provider for={{ foo, Bar }}>
      <Consumer for={Foo} get={i => expect(i).toBe(foo)} />
      <Consumer for={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
    </Provider>
  )
})

it("will conflict colliding Model types", () => {
  const foo = Foo.new();
  const expected = Context.MultipleExist("Foo");

  const Consumer: React.VFC = jest.fn(() => {
    expect(() => Foo.get()).toThrowError(expected);
    return null;
  });

  render(
    <Provider for={{ Foo, foo }}>
      <Consumer />
    </Provider>
  )

  expect(Consumer).toHaveBeenCalled();
})

it("will throw if missing `for` prop", () => {
  // @ts-ignore
  const test = () => render(<Provider />);

  expect(test).toThrow(Oops.NoType());
})

describe("children", () => {
  class Foo extends Model {
    bar = new Bar();
  }

  class Bar extends Model {
    value = 3;
  }

  it("will be provided to Consumer", () => {
    const foo = Foo.new();
  
    render(
      <Provider for={foo}>
        <Consumer for={Foo} get={i => expect(i).toBe(foo)} />
        <Consumer for={Bar} get={i => expect(i).toBe(foo.bar)} />
      </Provider>
    )
  })

  it("will be provided to useTap", () => {
    const foo = Foo.new();
    const gotBar = jest.fn();

    const BarConsumer = () => {
      Bar.get(gotBar);
      return null;
    }
  
    render(
      <Provider for={foo}>
        <BarConsumer />
      </Provider>
    )

    expect(gotBar).toBeCalledWith(foo.bar, expect.any(Function));
  })

  it.todo("will pass parent as second argument to useTap");
})

describe("and prop", () => {
  it("will assign values to instance", () => {
    render(
      <Provider for={Foo} use={{ value: "foobar" }}>
        <Consumer for={Foo} has={i => expect(i.value).toBe("foobar")} />
      </Provider>
    );
  })

  it("will assign every render", async () => {
    const foo = Foo.new();
    const element = render(
      <Provider for={foo} use={{ value: "foo" }} />
    );

    expect(foo.value).toBe("foo");

    element.update(
      <Provider for={foo} use={{ value: "bar" }} />
    );

    await foo.on(true);

    expect(foo.value).toBe("bar");
  })

  it("will assign values to muliple", () => {
    class Bar extends Model {
      value = "";
    }

    render(
      <Provider for={{ Foo, Bar }} use={{ value: "foobar" }}>
        <Consumer for={Foo} has={i => expect(i.value).toBe("foobar")} />
        <Consumer for={Bar} has={i => expect(i.value).toBe("foobar")} />
      </Provider>
    );
  });

  it("will not assign foreign values", () => {
    render(
      /// @ts-ignore - type-checking warns against this
      <Provider for={Foo} use={{ nonValue: "foobar" }}>
        <Consumer for={Foo} has={i => {
          // @ts-ignore
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
    const element = render(
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
    const element = render(
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
    const element = render(
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

it.todo("will apply tap instructions to new instances");
it.todo("will remove replaced instances");
it.todo("will ignore child if type exists");
it.todo("will not nullify if conflict has same value");