import React from 'react';

import { Consumer, get, Model, Provider } from '.';
import { create } from './tests';

describe("context", () => {
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

  it("will access peers sharing same provider", () => {
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

  it("will assign multiple peers", async () => {
    class Foo extends Model {
      value = 2;
    };

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
    const didRender = jest.fn();

    const Inner = () => {
      Foo.use();
      didRender();
      return null;
    }

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

    expect(didRender).toBeCalledTimes(2);
  })
})

describe("suspense", () => {
  it("will throw if not resolved", () => {
    class Foo extends Model {}
    class Bar extends Model {
      foo = get(Foo);
    }

    const bar = Bar.new();
    
    expect(() => bar.foo).toThrow(expect.any(Promise));

    create(
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

    create(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    await expect(pending).resolves.toBeUndefined();
  })

  it("will refresh an effect when assigned to", async () => {
    class Foo extends Model {}
    class Bar extends Model {
      foo = get(Foo);
    }

    const bar = Bar.new();
    const effect = jest.fn(bar => void bar.foo);

    bar.on(effect);

    expect(effect).toHaveBeenCalled();
    expect(effect).not.toHaveReturned();

    create(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    await bar.on();
    
    expect(effect).toHaveBeenCalledTimes(2);
    expect(effect).toHaveReturnedTimes(1);
  })

  it("will prevent compute if not yet resolved", () => {
    class Foo extends Model {
      value = "foobar";
    }
    class Bar extends Model {
      foo = get(Foo, foo => foo.value);
    }

    const bar = Bar.new();
    
    expect(() => bar.foo).toThrow(expect.any(Promise));

    create(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    expect(bar.foo).toBe("foobar");
  })
})