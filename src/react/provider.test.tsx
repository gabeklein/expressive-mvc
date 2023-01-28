import React, { Suspense } from 'react';

import { mockAsync, render } from '../helper/testing';
import { get } from '../instruction/get';
import { Model } from '../model';
import { Consumer } from './consumer';
import { Global } from './global';
import { MVC } from './mvc';
import { Oops, Provider } from './provider';

class Foo extends MVC {
  value?: string = undefined;
}
class Bar extends MVC {}

it("will create instance of given model", () => {
  render(
    <Provider for={Foo}>
      <Consumer for={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
    </Provider>
  );
})

it("will destroy instance of given model", async () => {
  const willDestroy = jest.fn();
  class Test extends MVC {
    end(){
      willDestroy();
      super.end();
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

it("will throw if missing `for` prop", () => {
  // @ts-ignore
  const test = () => render(<Provider />);

  expect(test).toThrow(Oops.NoType());
})

describe("children", () => {
  class Foo extends MVC {
    bar = new Bar();
  }

  class Bar extends MVC {
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
      Bar.tap(gotBar);
      return null;
    }
  
    render(
      <Provider for={foo}>
        <BarConsumer />
      </Provider>
    )

    expect(gotBar).toBeCalledWith(foo.bar);
  })

  it.todo("will pass parent as second argument to useTap");
})

describe("and prop", () => {
  it("will assign values to instance", () => {
    render(
      <Provider for={Foo} and={{ value: "foobar" }}>
        <Consumer for={Foo} has={i => expect(i.value).toBe("foobar")} />
      </Provider>
    );
  })

  it("will assign every render", async () => {
    const foo = Foo.new();
    const element = render(
      <Provider for={foo} and={{ value: "foo" }} />
    );

    expect(foo.value).toBe("foo");

    element.update(
      <Provider for={foo} and={{ value: "bar" }} />
    );

    await foo.on(true);

    expect(foo.value).toBe("bar");
  })

  it("will assign values to muliple", () => {
    class Bar extends Model {
      value = "";
    }

    render(
      <Provider for={{ Foo, Bar }} and={{ value: "foobar" }}>
        <Consumer for={Foo} has={i => expect(i.value).toBe("foobar")} />
        <Consumer for={Bar} has={i => expect(i.value).toBe("foobar")} />
      </Provider>
    );
  });

  it("will not assign foreign values", () => {
    render(
      /// @ts-ignore - type-checking warns against this
      <Provider for={Foo} and={{ nonValue: "foobar" }}>
        <Consumer for={Foo} has={i => {
          // @ts-ignore
          expect(i.nonValue).toBeUndefined();
        }} />
      </Provider>
    );
  })
})

describe("suspense", () => {
  class Test extends MVC {
    value = get(promise.pending);
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
    const test = Test.tap();
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

describe("global", () => {
  it("will create but not destroy instance", () => {
    class Test extends Global {}

    expect(Test.get(false)).toBeUndefined();

    const element = render(<Provider for={Test} />);
    const test = Test.get();

    expect(test).toBeInstanceOf(Test);

    element.unmount();

    expect(Test.get()).toBe(test);

    render(<Provider for={Test} />).unmount();

    test.end(true);
  })
})