import React from 'react';
import { create } from 'react-test-renderer';

import { get, Model, Provider } from '.';

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

  it("will compute immediately in context", () => {
    class Foo extends Model {
      value = "foobar";
    }
    class Bar extends Model {
      foo = get(Foo, foo => foo.value);
    }

    const FooBar = () => {
      return <>{Bar.use().foo}</>
    }

    const render = create(
      <Provider for={Foo}>
        <FooBar />
      </Provider>
    );

    expect(render.toJSON()).toBe("foobar");
  })
})