import React from 'react';

import { Consumer, Issue, Model, Provider, render } from './adapter';

class Foo extends Model {
  value?: string = undefined;
}
class Bar extends Model {}
class Baz extends Bar {}

describe("Provider", () => {
  it("will provide instance of model", () => {
    const instance = Foo.create();

    render(
      <Provider of={instance}>
        <Consumer of={Foo} get={i => expect(i).toStrictEqual(instance)} />
      </Provider>
    );
  })

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
        <Consumer of={Foo} has={i => i.willDestroy = didUnmount} />
      </Provider>
    );

    result.unmount();

    expect(didUnmount).toHaveBeenCalled()
  });

  it("will accept render function for given model", () => {
    render(
      <Provider of={Foo}>
        {(instance) => {
          return <Consumer of={Foo} get={i => {
            // instance injected should be a subscribe-clone.
            expect(i).not.toStrictEqual(instance);
            // get actual instance via circular-get property.
            expect(i).toStrictEqual(instance.get);
          }} />
        }}
      </Provider>
    );
  })

  it("will assign props to instance", () => {
    render(
      <Provider of={Foo} value="foobar">
        <Consumer of={Foo} has={i => expect(i.value).toStrictEqual("foobar")} />
      </Provider>
    );
  })

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

  it("will create all models in given array", () => {
    render(
      <Provider of={[ Foo, Bar ]}>
        <Consumer of={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
        <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
      </Provider>
    )
  })
})

describe("Consumer", () => {
  it("will handle complex arrangement", () => {
    const instance = Foo.create();

    render(
      <Provider of={instance}>
        <Provider of={Baz}>
          <Provider of={{ Bar }}>
            <Consumer of={Foo} get={i => expect(i).toStrictEqual(instance)} />
            <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
            <Consumer of={Baz} get={i => expect(i).toBeInstanceOf(Baz)} />
          </Provider>
        </Provider>
      </Provider>
    )
  })

  it("will pass undefined if not found for get-prop", () => {
    render(
      <Consumer of={Bar} get={i => expect(i).toBeUndefined()} />
    )
  })

  // React throwing error-boundary warning despite assertion.
  it.skip("will throw if not found for has-prop", () => {
    const test = () => render(
      <Consumer of={Bar} has={i => void i} />
    )

    expect(test).toThrow(
      Issue.NothingInContext(Bar.name)
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
          <Consumer of={Foo} has={i => expect(i.value).toStrictEqual("inner")} />
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