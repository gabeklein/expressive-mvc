import React, { useState } from 'react';
import { act } from 'react-test-renderer';

import { Oops } from '../src/Peer';
import { Consumer, Model, Provider, render, Singleton, subscribeTo, tap } from './adapter';

describe("tap instruction", () => {
  class Foo extends Model {
    bar = tap(Bar);
  }

  class Bar extends Model {
    value = "bar";
  }

  it("will attach property via tap directive", () => {
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

  it("will return undefined if instance not found", () => {
    const Test = () => {
      const foo = Foo.use();
      expect(foo.bar).toBeUndefined();
      return null;
    }

    render(<Test />);
  })

  it("will throw if strict tap is undefined", () => {
    class Foo extends Model {
      bar = tap(Bar, true);
    }

    const expected = Oops.AmbientRequired(Bar.name, Foo.name, "bar");
    const useStrictFooBar = () => Foo.use().bar;

    const TestComponent = () => {
      expect(useStrictFooBar).toThrowError(expected);
      return null;
    }

    render(<TestComponent />);
  })

  it("will attach a singleton via tap directive", () => {
    class Foo extends Model {
      global = tap(Global);
    }

    class Global extends Singleton {
      value = "bar";
    }

    Global.create();

    const Test = () => {
      const { global } = Foo.use();
      expect(global.value).toBe("bar");
      return null;
    }

    render(<Test />);
  })

  it("will throw if model is tapped by singleton", () => {
    class Normal extends Model {}
    class Global extends Singleton {
      notPossible = tap(Normal);
    }

    const attempt = () => Global.create();
    const issue = Oops.CantAttachGlobal(Global.name, Normal.name);

    expect(attempt).toThrowError(issue);
  })

  it("will access context through Provider", () => {
    class Foo extends Model {}
    class Bar extends Model {
      foo = tap(Foo, true);
    }

    render(
      <Provider of={Foo}>
        <Provider of={Bar}>
          <Consumer of={Bar} has={i => expect(i.foo).toBeInstanceOf(Foo)} />
        </Provider>
      </Provider>
    );
  })

  it("will access peers sharing same provider", () => {
    class Foo extends Model {
      bar = tap(Bar, true);
    }
    class Bar extends Model {
      foo = tap(Foo, true);
    }

    render(
      <Provider of={{ Foo, Bar }}>
        <Consumer of={Bar} has={i => expect(i.foo.bar).toBe(i)} />
        <Consumer of={Foo} has={i => expect(i.bar.foo).toBe(i)} />
      </Provider>
    );
  });
})

describe("Peers", () => {
  class Shared extends Model {
    value = 1;
  };

  class Consumer extends Model {
    shared = tap(Shared);
  };

  it("will assign peer-properties from context", async () => {
    const parent = Shared.create();

    const Inner = () => {
      const { shared } = Consumer.use();
      expect(shared.get).toBe(parent);
      return null;
    }

    render(
      <Provider of={parent}>
        <Inner />
      </Provider>
    );

  })

  it("will subscribe peer-properties from context", async () => {
    class Foo extends Model {
      value = "foo";
    }
    class Bar extends Model {
      foo = tap(Foo, true);
    }

    const foo = Foo.create();
    let bar!: Bar;

    const Child = () => {
      bar = Bar.use();
      return null;
    }

    render(
      <Provider of={foo}>
        <Child />
      </Provider>
    )

    const update = subscribeTo(bar, it => it.foo.value);

    foo.value = "bar";
    await update();
  })

  it("will assign multiple peers from context", async () => {
    class AlsoShared extends Model {
      value = 1;
    };

    class Multiple extends Consumer {
      also = tap(AlsoShared);
    };

    let consumer!: Multiple;

    const Inner = () => {
      consumer = Multiple.use();
      return null;
    }

    render(
      <Provider of={{ Shared, AlsoShared }}>
        <Inner />
      </Provider>
    );

    expect(consumer.shared).toBeInstanceOf(Shared);
    expect(consumer.also).toBeInstanceOf(AlsoShared);
  })

  it("will maintain useContext hook", async () => {
    let refresh!: (x: any) => void;

    const didRender = jest.fn();
    const Inner = () => {
      Consumer.use();
      refresh = useState()[1];
      didRender();
      return null;
    }

    render(
      <Provider of={Shared}>
        <Inner />
      </Provider>
    );

    act(() => refresh(true));
    expect(didRender).toBeCalledTimes(2);
  })
})