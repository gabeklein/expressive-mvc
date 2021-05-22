import React from 'react';

import { Consumer, Controller, Issue, Provider, render, Singleton, tap } from './adapter';

class Foo extends Controller {
  value?: string = undefined;
}
class Bar extends Controller {}
class Baz extends Bar {}

describe("Provider", () => {
  it("provides an existing instance of controller", () => {
    const instance = Foo.create();

    render(
      <Provider of={instance}>
        <Consumer of={Foo} get={i => expect(i).toStrictEqual(instance)} />
      </Provider>
    );
  })

  it("creates an instance of given class", () => {
    render(
      <Provider of={Foo}>
        <Consumer of={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
      </Provider>
    );
  })

  it("will assign props to controller", () => {
    render(
      <Provider of={Foo} value="foobar">
        <Consumer of={Foo} has={i => expect(i.value).toStrictEqual("foobar")} />
      </Provider>
    );
  })

  it("will accept render function on class-type", () => {
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

  it("will not assign foriegn props to controller", () => {
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

  it("provides all instances if `of` is an object", () => {
    render(
      <Provider of={{ Foo, Bar }}>
        <Consumer of={Foo} get={i => expect(i).toBeInstanceOf(Foo)} />
        <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
      </Provider>
    )
  })

  it("will destroy created instance when unmounts", async () => {
    const didUnmount = jest.fn();

    const result = render(
      <Provider of={Foo}>
        <Consumer of={Foo} has={i => i.willDestroy = didUnmount} />
      </Provider>
    );

    result.unmount();

    expect(didUnmount).toHaveBeenCalled()
  });
})

describe("Consumer", () => {
  it("can handle complex arrangement", () => {
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

  it("get prop will pass undefined if not found", () => {
    render(
      <Consumer of={Bar} get={i => expect(i).toBeUndefined()} />
    )
  })

  it.skip("has prop will throw if not found", () => {
    // React throwing error-boundary warning despite assertion.

    const test = () => render(
      <Consumer of={Bar} has={i => void i} />
    )

    expect(test).toThrow(
      Issue.NothingInContext(Bar.name)
    );
  })

  it("will select extended class if found", () => {
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

  it("prefers closest match over best match", () => {
    render(
      <Provider of={Bar}>
        <Provider of={Baz}>
          <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Baz)} />
        </Provider>
      </Provider>
    )
  })
});

describe("Peers", () => {
  it("will attach property via tap directive", () => {
    class Foo extends Controller {
      bar = tap(Bar);
    }

    class Bar extends Controller {
      value = "bar";
    }

    const Test = () => {
      const { bar } = Foo.use();

      expect(bar.value).toBe("bar");

      return null;
    }

    render(
      <Provider of={Bar}>
        <Test />
      </Provider>
    );
  })

  it("will attach a singleton via tap directive", () => {
    class Foo extends Controller {
      bar = tap(Bar);
    }

    class Bar extends Singleton {
      value = "bar";
    }

    Bar.create();

    const Test = () => {
      const { bar } = Foo.use();
      expect(bar.value).toBe("bar");
      return null;
    }

    render(<Test />);
  })

  it("will reject from context if a singleton", () => {
    class Normal extends Controller {}
    class Global extends Singleton {
      notPossible = tap(Normal);
    }

    expect(() => Global.create()).toThrow(
      Issue.CantAttachGlobal(Global.name, Normal.name)
    );
  })

  it.todo("can access peers sharing same provider");
})