import React from 'react';
import { create } from 'react-test-renderer';

import { Consumer, Controller, Issue, Provider, Singleton, tap } from './adapter';

class Foo extends Controller {
  value?: string = undefined;
}
class Bar extends Controller {}
class Baz extends Bar {}

describe("Provider", () => {
  it("provides an existing instance of controller", () => {
    const instance = Foo.create();

    create(
      <Provider of={instance}>
        <Consumer of={Foo} got={i => expect(i).toStrictEqual(instance)} />
      </Provider>
    );
  })

  it("creates an instance of given class", () => {
    create(
      <Provider of={Foo}>
        <Consumer of={Foo} got={i => expect(i).toBeInstanceOf(Foo)} />
      </Provider>
    );
  })

  it("will assign props to controller", () => {
    create(
      <Provider of={Foo} value="foobar">
        <Consumer of={Foo} got={i => expect(i.value).toStrictEqual("foobar")} />
      </Provider>
    );
  })

  it("will not assign foriegn props to controller", () => {
    create(
      // @ts-ignore - type-checking warns against this
      <Provider of={Foo} nonValue="foobar">
        <Consumer of={Foo} got={i => {
          // @ts-ignore
          expect(i.nonValue).toBeUndefined();
        }} />
      </Provider>
    );
  })

  it("provides all instances if `of` is an object", () => {
    create(
      <Provider of={{ Foo, Bar }}>
        <Consumer of={Foo} got={i => expect(i).toBeInstanceOf(Foo)} />
        <Consumer of={Bar} got={i => expect(i).toBeInstanceOf(Bar)} />
      </Provider>
    )
  })

  it("will destroy created instance when unmounts", async () => {
    const didUnmount = jest.fn();

    const render = create(
      <Provider of={Foo}>
        <Consumer of={Foo} got={i => i.willDestroy = didUnmount} />
      </Provider>
    );

    render.unmount();

    expect(didUnmount).toHaveBeenCalled()
  });
})

describe("Consumer", () => {
  it("can handle complex arrangement", () => {
    const instance = Foo.create();

    create(
      <Provider of={instance}>
        <Provider of={Baz}>
          <Provider of={{ Bar }}>
            <Consumer of={Foo} got={i => expect(i).toStrictEqual(instance)} />
            <Consumer of={Bar} got={i => expect(i).toBeInstanceOf(Bar)} />
            <Consumer of={Baz} got={i => expect(i).toBeInstanceOf(Baz)} />
          </Provider>
        </Provider>
      </Provider>
    )
  })

  it("will select extended class if found", () => {
    create(
      <Provider of={Baz}>
        <Consumer of={Bar} got={i => expect(i).toBeInstanceOf(Baz)} />
      </Provider>
    )
  })

  it("will select closest instance of same type", () => {
    create(
      <Provider of={Foo} value="outer">
        <Provider of={Foo} value="inner">
          <Consumer of={Foo} got={i => expect(i.value).toStrictEqual("inner")} />
        </Provider>
      </Provider>
    )
  });

  it("prefers closest match over best match", () => {
    create(
      <Provider of={Bar}>
        <Provider of={Baz}>
          <Consumer of={Baz} got={i => expect(i).toBeInstanceOf(Baz)} />
          <Consumer of={Bar} got={i => expect(i).toBeInstanceOf(Baz)} />
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

    create(
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

    create(<Test />);
  })

  it("will reject from context if a singleton", () => {
    class Normal extends Controller {}
    class Global extends Singleton {
      notPossible = tap(Normal);
    }

    const error = Issue.CantAttachGlobal(Global.name, Normal.name);

    expect(() => Global.create()).toThrow(error);
  })

  it.todo("can access peers sharing same provider");
})