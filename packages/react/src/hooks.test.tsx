import React from 'react';

import { Model, Provider } from '.';
import { create, mockHook, renderHook } from './helper/testing';
import { act } from 'react-test-renderer';

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

describe("useModel", () => {
  class Test extends Model {
    foo?: string = undefined;
    bar?: string = undefined;
  }
  
  it("will apply props to model", async () => {
    const mockExternal = {
      foo: "foo",
      bar: "bar"
    }
  
    const didRender = jest.fn();
  
    const { result } = renderHook(() => {
      didRender();
      return Test.use(mockExternal);
    });
  
    expect(result.current.is).toMatchObject(mockExternal);
  })
  
  it("will apply props only once by default", async () => {
    let instance!: Test;
  
    const TestComponent = (props: any) => {
      ({ is: instance } = Test.use(props));
      return null;
    }
  
    const rendered = create(
      <TestComponent foo="foo" bar="bar" />
    );
  
    expect(instance).toMatchObject({ foo: "foo", bar: "bar" });
  
    await expect(instance).toUpdate();
  
    rendered.update(
      <TestComponent foo="bar" bar="foo" />
    );
  
    await expect(instance).not.toUpdate();
  })
  
  it("will apply props per-render", async () => {
    let instance!: Test;
  
    const TestComponent = (props: any) => {
      ({ is: instance } = Test.use(props, true));
      return null;
    }
  
    const rendered = create(<TestComponent />);
  
    expect(instance).toBeInstanceOf(Test);
  
    rendered.update(
      <TestComponent foo="foo" bar="bar" />
    );
  
    await expect(instance).toHaveUpdated(["foo", "bar"]);
  })
  
  it("will apply props over (untracked) arrow functions", () => {
    class Test extends Model {
      foobar = () => "Hello world!";
    }
  
    const mockExternal = {
      foobar: () => "Goodbye cruel world!"
    }
  
    const render = renderHook(() => {
      return Test.use(mockExternal);
    });
  
    const { foobar } = render.result.current;
  
    expect(foobar).toBe(mockExternal.foobar);
  })
  
  it("will not apply props over methods", () => {
    class Test extends Model {
      foobar(){
        return "Hello world!";
      };
    }
  
    const mockExternal = {
      foobar: () => "Goodbye cruel world!"
    }
  
    const render = renderHook(() => {
      return Test.use(mockExternal);
    });
  
    const { foobar } = render.result.current;
  
    expect(foobar).not.toBe(mockExternal.foobar);
  })
  
  it("will ignore updates itself caused", async () => {
    const didRender = jest.fn();
    let test!: Test;
  
    const TestComponent = (props: any) => {
      test = Test.use(props, true);
      didRender(test.foo);
      return null;
    }
  
    const element = create(<TestComponent />);
  
    expect(didRender).toBeCalledTimes(1);
  
    element.update(<TestComponent foo="bar" />);
  
    expect(didRender).toBeCalledTimes(2);
    expect(didRender).toBeCalledWith("bar");
  
    await expect(test).toUpdate();
  
    expect(didRender).toBeCalledTimes(2);
  
    // remove value prop to prevent snap-back
    element.update(<TestComponent />);
    expect(didRender).toBeCalledTimes(3);
  
    await act(async () => {
      await test.on(0);
      test.foo = "foo";
      await test.on(0);
    })
  
    // expect updates re-enabled
    expect(didRender).toBeCalledTimes(4);
  })
})