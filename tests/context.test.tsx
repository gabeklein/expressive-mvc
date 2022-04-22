import React from 'react';
import { act } from 'react-test-renderer';

import { Oops as Context } from '../src/react/hooks';
import { Oops as Provide } from '../src/react/provider';
import { Consumer, Model, Provider, render } from './adapter';

class Foo extends Model {
  value?: string = undefined;
}
class Bar extends Model {}
class Baz extends Bar {}

describe("get", () => {
  class Test extends Model {
    value = "foo";
  }

  it("will get instance of model", () => {
    const Hook = () => {
      const value = Test.get("value");
      expect(value).toBe("foo")
      return null;
    }

    render(
      <Provider of={Test}>
        <Hook />
      </Provider>
    );
  })

  it("will fail if not found", () => {
    const Hook = () => {
      Test.get();
      return null;
    }

    const test = () => render(<Hook />);

    expect(test).toThrowError(
      Context.NothingInContext(Test.name)
    );
  })
})

describe("Provider", () => {
  it("will create instance of given model", () => {
    render(
      <Provider of={Foo}>
        <Consumer of={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
      </Provider>
    );
  })

  it("will destroy instance of given model", async () => {
    const didUnmount = jest.fn();

    const result = render(
      <Provider of={Foo}>
        <Consumer of={Foo} has={i => {
          i.effect(() => didUnmount, []);
        }} />
      </Provider>
    );

    result.unmount();

    expect(didUnmount).toHaveBeenCalled()
  });

  it("will accept render function when model given", () => {
    render(
      <Provider of={Foo}>
        {(instance) => {
          return <Consumer of={Foo} get={i => {
            // instance injected should be a subscribe-clone.
            expect(instance).not.toBe(i);
            // get actual instance via circular-get property.
            expect(instance.get).toBe(i);
          }} />
        }}
      </Provider>
    );
  })

  it("will pass undefined to render function if multiple", () => {
    render(
      <Provider of={{ Foo, Bar }}>
        {(instance) => {
          expect(instance).toBeUndefined();
          return null;
        }}
      </Provider>
    );
  })

  it("will refresh render function as a subscriber", async () => {
    const didRender = jest.fn();
    const test = Foo.create();

    render(
      <Provider of={test}>
        {({ value }) => {
          didRender(value);
          return null;
        }}
      </Provider>
    );

    expect(didRender).toBeCalledWith(undefined);

    await act(async () => {
      test.value = "foobar";
      await test.update(true);
    })
    
    expect(didRender).toBeCalledWith("foobar");
  })

  it("will assign props to instance", () => {
    render(
      <Provider of={Foo} value="foobar">
        <Consumer of={Foo} has={i => expect(i.value).toBe("foobar")} />
      </Provider>
    );
  })

  it("will assign props to muliple controllers", () => {
    class Bar extends Model {
      value = "";
    }

    render(
      <Provider of={{ Foo, Bar }} value="foobar">
        <Consumer of={Foo} has={i => expect(i.value).toBe("foobar")} />
        <Consumer of={Bar} has={i => expect(i.value).toBe("foobar")} />
      </Provider>
    );
  });

  it("will not assign foreign props to controller", () => {
    render(
      // @ts-ignore - type-checking warns against this
      <Provider of={Foo} nonValue="foobar">
        <Consumer of={Foo} has={i => {
          // @ts-ignore
          expect(i.nonValue).toBeUndefined();
        }} />
      </Provider>
    );
  })

  it("will create all models in given object", () => {
    render(
      <Provider of={{ Foo, Bar }}>
        <Consumer of={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
        <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
      </Provider>
    )
  })

  it("will destroy created model on unmount", () => {
    const willDestroy = jest.fn();

    class Test extends Model {}

    const rendered = render(
      <Provider of={{ Test }}>
        <Consumer of={Test} has={i => {
          expect(i).toBeInstanceOf(Test)
          i.effect(() => willDestroy, []);
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
      <Provider of={{ Foo, Bar }}>
        <Consumer of={Foo} has={i => {
          i.effect(() => willDestroy, []);
        }} />
        <Consumer of={Bar} has={i => {
          i.effect(() => willDestroy, []);
        }} />
      </Provider>
    );

    rendered.unmount();
    expect(willDestroy).toBeCalledTimes(2);
  })

  it("will not destroy given instance on unmount", () => {
    const didUnmount = jest.fn();

    class Test extends Model {}

    const instance = Test.create();

    const rendered = render(
      <Provider of={{ instance }}>
        <Consumer of={Test} has={i => {
          i.effect(() => didUnmount, []);
        }} />
      </Provider>
    );

    rendered.unmount();
    expect(didUnmount).not.toBeCalled();
  })


  it("will create all models in given array", () => {
    render(
      <Provider of={[ Foo, Bar ]}>
        <Consumer of={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
        <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
      </Provider>
    )
  })

  it("will provide a mix of state and models", () => {
    const foo = Foo.create();

    render(
      <Provider of={{ foo, Bar }}>
        <Consumer of={Foo} get={i => expect(i).toBe(foo)} />
        <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
      </Provider>
    )
  })

  it("will throw if no `of` or `for` prop given", () => {
    // @ts-ignore
    const test = () => render(<Provider />);

    expect(test).toThrow(Provide.NoProviderType());
  })
})

describe("Consumer", () => {
  it("will handle complex arrangement", () => {
    const instance = Foo.create();

    render(
      <Provider of={instance}>
        <Provider of={Baz}>
          <Provider of={{ Bar }}>
            <Consumer of={Foo} get={i => expect(i).toBe(instance)} />
            <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
            <Consumer of={Baz} get={i => expect(i).toBeInstanceOf(Baz)} />
          </Provider>
        </Provider>
      </Provider>
    )
  })

  it("will render with instance for child-function", async () => {
    class Test extends Model {
      value = "foobar";
    }

    const instance = Test.create();
    const didRender = jest.fn();

    function onRender(instance: Test){
      const { value } = instance;
      didRender(value);
      return <span>{value}</span>;
    }

    render(
      <Provider of={instance}>
        <Consumer of={Test}>
          {onRender}
        </Consumer>
      </Provider>
    )

    expect(didRender).toBeCalledWith("foobar");
  })

  it("will throw if expected-prop missing", () => {
    const instance = Foo.create();
    const attempt = () => render(
      <Provider of={instance}>
        { /* @ts-ignore */}
        <Consumer of={Foo} />
      </Provider>
    );

    expect(attempt).toThrowError();
  })


  it("will pass undefined if not found for get-prop", () => {
    render(
      <Consumer of={Bar} get={i => expect(i).toBeUndefined()} />
    )
  })

  it("will throw if not found where required", () => {
    const test = () => render(
      <Consumer of={Bar} has={i => void i} />
    )

    expect(test).toThrowError(
      Context.NothingInContext(Bar.name)
    );
  })

  it("will eagerly select extension", () => {
    render(
      <Provider of={Baz}>
        <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Baz)} />
      </Provider>
    )
  })

  it("will select closest instance of same type", () => {
    render(
      <Provider of={Foo} value="outer">
        <Provider of={Foo} value="inner">
          <Consumer of={Foo} has={i => expect(i.value).toBe("inner")} />
        </Provider>
      </Provider>
    )
  });

  it("will select closest match over best match", () => {
    render(
      <Provider of={Bar}>
        <Provider of={Baz}>
          <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Baz)} />
        </Provider>
      </Provider>
    )
  })
});