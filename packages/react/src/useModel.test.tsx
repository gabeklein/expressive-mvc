import React from 'react';

import { Model } from '.';
import { create, renderHook } from './helper/testing';
import { act } from 'react-test-renderer';

describe("props", () => {
  class Test extends Model {
    foo?: string = undefined;
    bar?: string = undefined;
  }
  
  it("will be applied to model", async () => {
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
  
  it("will apply on initial render only by default", async () => {
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
  
  it("will apply values per-render", async () => {
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
  
  it("will override (untracked) arrow functions", () => {
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
  
  it("will not override prototype methods", () => {
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
  
  it("will ignore updates caused", async () => {
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