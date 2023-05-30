import React from 'react';
import { create } from 'react-test-renderer';

import { Model, Provider, get } from '.';
import { mockHook } from './tests';

describe("useContext", () => {
  it("will refresh for values accessed", async () => {
    class Test extends Model {
      foo = "foo";
    }
  
    const test = Test.new();
    const render = mockHook(() => {
      return Test.get().foo;
    }, test);
  
    expect(render.result.current).toBe("foo");
    test.foo = "bar";
  
    await render.waitForNextUpdate();
  })
  
  it("will return instance", () => {
    class Test extends Model {
      value = 1;
    }
  
    const instance = Test.new();
    const render = mockHook(() => Test.get(), instance);
  
    expect(render.result.current).toBeInstanceOf(Test);
    expect(render.result.current.value).toBe(1);
  })

  it("will return null if factory does", () => {
    class Test extends Model {}
  
    const instance = Test.new();
    const render = mockHook(() => Test.get(() => null), instance);

    expect(render.result.current).toBe(null);
  })
  
  it("will run initial callback syncronously", async () => {
    class Parent extends Model {
      values = [] as string[]
    }
    
    type ChildProps = {
      value: string;
    }
  
    const Child = (props: ChildProps) => {
      Parent.get($ => {
        didPushToValues();
        $.values.push(props.value);
        $.set("values");
  
        return () => null;
      });
  
      return null;
    }
  
    const parent = Parent.new();
    const didUpdateValues = jest.fn();
    const didPushToValues = jest.fn();
  
    parent.on("values", didUpdateValues);
  
    const element = create(
      <Provider for={parent}>
        <Child value='foo' />
        <Child value='bar' />
        <Child value='baz' />
      </Provider>
    )
  
    expect(didPushToValues).toBeCalledTimes(3);
  
    await expect(parent).toUpdate();
  
    expect(parent.values.length).toBe(3);
  
    // Expect updates to have bunched up before new frame.
    expect(didUpdateValues).toBeCalledTimes(1);
  
    element.unmount();
  })
});

describe("useModel", () => {
  it("will subscriber to created instance", async () => {
    class Test extends Model {
      value = 1;
    }

    let test!: Test;
  
    const render = mockHook(() => {
      test = Test.use();
      return test.value;
    });

    expect(render.result.current).toBe(1);

    test.value = 2;

    await render.waitForNextUpdate();

    expect(render.result.current).toBe(2);
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

    bar.get(effect);

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