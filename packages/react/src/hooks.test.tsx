import React from 'react';

import { Model, Provider } from '.';
import { create, mockHook } from './tests';

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