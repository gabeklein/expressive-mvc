import React from 'react';

import { render, renderHook } from '../helper/testing';
import { use } from '../instruction/use';
import { Global } from './global';
import { MVC } from './mvc';
import { Provider } from './provider';
import { Oops } from './useContext';

const opts = { timeout: 100 };

describe("get", () => {
  class Test extends Global {
    value = 1;
  }

  afterEach(() => {
    Test.get(instance => {
      instance.end(true);
    });
  });

  it("will get instance", () => {
    const instance = Test.new();
    const { result } = renderHook(() => Test.get());

    expect(result.current).toBe(instance);
    expect(result.current!.value).toBe(1);
  })

  it("will complain if not found", () => {
    const { result } = renderHook(() => Test.get());
    const expected = Oops.DoesNotExist(Test.name);

    expect(() => result.current).toThrowError(expected);
  })

  it("will return undefined if not found", () => {
    const { result } = renderHook(() => Test.get(false));

    expect(result.current).toBeUndefined();
  })

  it("will only callback if instance exists", () => {
    const didGet = jest.fn();
    renderHook(() => Test.get(didGet));

    expect(didGet).not.toBeCalled();

    Test.new();
    renderHook(() => Test.get(didGet));
    expect(didGet).toBeCalledWith(expect.any(Test));
  })

  it("will callback with undefined", () => {
    const didGet = jest.fn();
    renderHook(() => Test.get(false, didGet));
    expect(didGet).toBeCalledWith(undefined);
  })

  it("will callback with undefined outside component", () => {
    const didGet = jest.fn();
    Test.get(false, didGet)
    expect(didGet).toBeCalledWith(undefined);
  })

  it("will get instance outside component", () => {
    const instance = Test.new();
    const got = Test.get();

    expect(got).toBe(instance);
    expect(got.value).toBe(1);
  })

  it("will call return-effect on unmount", () => {
    const effect = jest.fn(() => effect2);
    const effect2 = jest.fn();

    Test.new();

    const element = renderHook(() => Test.get(effect));

    expect(effect).toBeCalled();
    expect(effect2).not.toBeCalled();

    element.unmount();

    expect(effect2).toBeCalled();
  })

  it("will call return-effect on destroy", () => {
    const effect = jest.fn(() => effect2);
    const effect2 = jest.fn();
    const test = Test.new();

    Test.get(effect)

    expect(effect).toBeCalled();
    expect(effect2).not.toBeCalled();

    test.end(true);

    expect(effect2).toBeCalled();
  })
})

describe("meta", () => {
  it('will track static values', async () => {
    class Parent extends MVC {
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
    class Parent extends MVC {
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
    class Child extends MVC {
      value = "foo";
    }

    class Parent extends MVC {
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

describe("tap", () => {
  it("will get model from context", () => {
    class Test extends MVC {}

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
    class Parent extends MVC {
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