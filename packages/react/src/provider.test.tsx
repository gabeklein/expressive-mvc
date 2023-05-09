import React, { Suspense } from 'react';

import { Consumer, Model, set } from '.';
import { Provider } from './provider';
import { create, mockAsync } from './tests';

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

it("will destroy created model on unmount", () => {
  const willDestroy = jest.fn();

  class Test extends Model {}

  const rendered = create(
    <Provider for={{ Test }}>
      <Consumer for={Test} has={i => {
        expect(i).toBeInstanceOf(Test)
        i.on(() => willDestroy);
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

  const rendered = create(
    <Provider for={{ Foo, Bar }}>
      <Consumer for={Foo} has={i => {
        i.on(() => willDestroy);
      }} />
      <Consumer for={Bar} has={i => {
        i.on(() => willDestroy);
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

  const rendered = create(
    <Provider for={{ instance }}>
      <Consumer for={Test} has={i => {
        i.on(() => didUnmount);
      }} />
    </Provider>
  );

  rendered.unmount();
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

describe("use prop", () => {
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

it.todo("will apply get instructions to new instances");
it.todo("will remove replaced instances");
it.todo("will ignore child if type exists");
it.todo("will not nullify if conflict has same value");