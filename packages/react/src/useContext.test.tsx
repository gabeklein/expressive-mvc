import React from 'react';

import { Model } from '.';
import { create, assertDidUpdate, renderHook } from './helper/testing';
import { Provider } from './provider';

describe("get", () => {
  it("will get instance", () => {
    class Test extends Model {
      value = 1;
    }
    const instance = Test.new();
    const wrapper: React.FC = ({ children }) => (
      <Provider for={instance}>
        {children}
      </Provider>
    )

    const render = renderHook(() => Test.get(), { wrapper });

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

    await assertDidUpdate(parent);

    expect(parent.values.length).toBe(3);

    // Expect updates to have bunched up before new frame.
    expect(didUpdateValues).toBeCalledTimes(1);

    element.unmount();
  })
})