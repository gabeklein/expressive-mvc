import React from 'react';
import { create } from 'react-test-renderer';

import { get, Model } from '.';
import { Provider } from './provider';
import { mockHook } from './mocks';

describe("useContext", () => {
  it("will refresh for values accessed", async () => {
    class Test extends Model {
      foo = "foo";
    }
  
    const test = Test.new();
    const render = mockHook(test, () => Test.get().foo);
  
    expect(render.output).toBe("foo");

    await render.act(() => {
      test.foo = "bar"
    });
  })
  
  it("will return instance", () => {
    class Test extends Model {
      value = 1;
    }
  
    const test = Test.new();
    const render = mockHook(test, () => Test.get());
  
    expect(render.output).toBeInstanceOf(Test);
    expect(render.output.value).toBe(1);
  })

  it("will return null if factory does", () => {
    class Test extends Model {}
  
    const test = Test.new();
    const render = mockHook(test, () => Test.get(() => null));

    expect(render.output).toBe(null);
  })
  
  it("will run initial callback syncronously", async () => {
    class Parent extends Model {
      values = [] as string[]
    }
    
    type ChildProps = {
      value: string;
    }
  
    const Child = (props: ChildProps) => (
      Parent.get($ => {
        didPushToValues();
        $.values = [...$.values, props.value];
        return null;
      })
    )
  
    const parent = Parent.new();
    const didUpdateValues = jest.fn();
    const didPushToValues = jest.fn();

    parent.get(state => {
      didUpdateValues(state.values.length);
    })
  
    const element = create(
      <Provider for={parent}>
        <Child value='foo' />
        <Child value='bar' />
        <Child value='baz' />
      </Provider>
    )
  
    expect(didPushToValues).toBeCalledTimes(3);
  
    await expect(parent).toUpdate();
  
    // Expect updates to have bunched up before new frame.
    expect(didUpdateValues).toBeCalledTimes(2);
    expect(didUpdateValues).toBeCalledWith(3);
  
    element.unmount();
  })
});

describe("useModel", () => {
  it("will subscribe to created instance", async () => {
    class Test extends Model {
      value = 1;
    }

    let test!: Test;
  
    const render = mockHook(() => {
      test = Test.use();
      return test.value;
    });

    expect(render.output).toBe(1);

    await render.act(() => {
      test.value = 2;
    });

    expect(render.output).toBe(2);
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

    await expect(pending).resolves.toBeInstanceOf(Foo);
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

    await expect(bar).toUpdate();
    
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