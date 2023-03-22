import React from 'react';

import { Model } from '.';
import { render, renderHook } from './helper/testing';
import { Provider } from './provider';
import { Oops } from './useContext';

describe("get", () => {
  class Test extends Model {
    value = 1;
  }

  function render<T>(
    hook: () => T,
    inContext?: Model){

    let wrapper: React.FC | undefined;

    if(inContext)
      wrapper = ({ children }) => (
        <Provider for={inContext}>
          {children}
        </Provider>
      )

    return renderHook(hook, { wrapper }).result;
  }

  it("will get instance", () => {
    const instance = Test.new();
    const result = render(() => Test.get(), instance);

    expect(result.current).toBe(instance);
    expect(result.current!.value).toBe(1);
  })

  it("will complain if not found", () => {
    const result = render(() => Test.get());
    const expected = Oops.NotFound(Test.name);

    expect(() => result.current).toThrowError(expected);
  })

  it("will return undefined if not found", () => {
    const result = render(() => Test.get(false));

    expect(result.current).toBeUndefined();
  })
})

describe("tap", () => {
  it("will get model from context", () => {
    class Test extends Model {}

    const Hook = () => {
      const value = Test.tap();
      expect(value).toBeInstanceOf(Test);
      return null;
    }

    render(
      <Provider for={Test}>
        <Hook />
      </Provider>
    );
  })

  it("will run initial callback syncronously", async () => {
    class Parent extends Model {
      values = [] as string[]
    }
    
    type ChildProps = {
      value: string;
    }

    const Child = (props: ChildProps) => {
      Parent.tap($ => {
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

    const element = render(
      <Provider for={parent}>
        <Child value='foo' />
        <Child value='bar' />
        <Child value='baz' />
      </Provider>
    )

    expect(didPushToValues).toBeCalledTimes(3);

    await parent.on(true);

    expect(parent.values.length).toBe(3);

    // Expect updates to have bunched up before new frame.
    expect(didUpdateValues).toBeCalledTimes(1);

    element.unmount();
  })
})