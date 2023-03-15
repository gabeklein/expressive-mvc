import React from 'react';

import { Model } from '..';
import { render, renderHook } from '../helper/testing';
import { use } from '../instruction/use';
import { Provider } from './provider';
import { Oops } from './useContext';

const opts = { timeout: 100 };

describe("get", () => {
  class Test extends Model {
    value = 1;
  }

  function render<T>(
    hook: () => T,
    provide?: Model){

    let wrapper: React.FC | undefined;

    if(provide)
      wrapper = ({ children }) => (
        <Provider for={provide}>
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

describe("meta", () => {
  it('will track static values', async () => {
    class Parent extends Model {
      static value = "foo";
      static getValue(){
        return this.meta().value;
      }
    }

    const render = renderHook(() => {
      return Parent.getValue();
    });

    expect(render.result.current).toBe("foo");

    Parent.value = "bar";
    await render.waitForNextUpdate(opts);
    expect(render.result.current).toBe("bar");

    Parent.value = "baz";
    await render.waitForNextUpdate(opts);
    expect(render.result.current).toBe("baz");
  })

  it('will compute value', async () => {
    class Parent extends Model {
      static value = "foo";
      static getValue(){
        return this.meta(x => x.value);
      }
    }

    const {
      result,
      waitForNextUpdate
    } = renderHook(() => {
      return Parent.getValue();
    });

    expect(result.current).toBe("foo");

    Parent.value = "bar";

    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  })

  it('will track recursive values', async () => {
    class Child extends Model {
      value = "foo";
    }

    class Parent extends Model {
      static child = use(Child);
      static getValue(){
        return this.meta().child.value;
      }
    }

    const {
      result,
      waitForNextUpdate
    } = renderHook(() => {
      return Parent.getValue();
    });

    expect(result.current).toBe("foo");

    // Will refresh on sub-value change.
    Parent.child.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");

    // Will refresh on repalcement.
    Parent.child = new Child();
    await waitForNextUpdate(opts);
    expect(result.current).toBe("foo");

    // Fresh subscription still works.
    Parent.child.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  })
})