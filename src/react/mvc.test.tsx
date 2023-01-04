import React from 'react';

import { render, renderHook } from '../../tests/adapter';
import { use } from '../instruction/use';
import { Model } from '../model';
import { Global, Oops } from './global';
import { MVC } from './mvc';
import { Provider } from './provider';
import { useTap } from './useTap';

const opts = { timeout: 100 };

describe("get", () => {
  class Test extends Global {
    value = 1;
  }

  beforeEach(() => Test.reset());

  it("will get instance", () => {
    const instance = Test.create();
    const { result } = renderHook(() => Test.get());

    expect(result.current).toBe(instance);
    expect(result.current!.value).toBe(1);
  })

  it("will get instance value", () => {
    Test.create();
    const { result } = renderHook(() => Test.get("value"));

    expect(result.current).toBe(1);
  })

  it("will complain if not-found in expect mode", () => {
    const { result } = renderHook(() => Test.get(true));
    const expected = Oops.DoesNotExist(Test.name);

    expect(() => result.current).toThrowError(expected);
  })
})

describe("meta", () => {
  class Child extends MVC {
    value = "foo";
  }

  class Parent extends MVC {
    static value = "foo";
    static value2 = "bar";
    static child = use(Child);
  }

  beforeEach(() => Parent.value = "foo");

  it('will track static values', async () => {
    const render = renderHook(() => {
      const meta = Parent.meta();
      return meta.value;
    });

    expect(render.result.current).toBe("foo");

    Parent.value = "bar";
    await render.waitForNextUpdate(opts);
    expect(render.result.current).toBe("bar");

    Parent.value = "baz";
    await render.waitForNextUpdate(opts);
    expect(render.result.current).toBe("baz");
  })

  it('will track specific value', async () => {
    const render = renderHook(() => {
      return Parent.meta(x => x.value2);
    });

    expect(render.result.current).toBe("bar");

    Parent.value2 = "foo";
    await render.waitForNextUpdate(opts);
    expect(render.result.current).toBe("foo");
  })

  it('will track child controller values', async () => {
    const {
      result: { current },
      waitForNextUpdate
    } = renderHook(() => {
      const meta = Parent.meta();
      void meta.child.value;
      return meta;
    });

    expect(current.child.value).toBe("foo");

    // Will refresh on sub-value change.
    current.child.value = "bar";
    await waitForNextUpdate(opts);
    expect(current.child.value).toBe("bar");

    // Will refresh on repalcement.
    current.child = new Child();
    await waitForNextUpdate(opts);
    expect(current.child.value).toBe("foo");

    // Fresh subscription still works.
    current.child.value = "bar";
    await waitForNextUpdate(opts);
    expect(current.child.value).toBe("bar");
  })
})

describe("tap", () => {
  it("will get model from context", () => {
    class Test extends Model {}

    const Hook = () => {
      const value = useTap(Test);
      expect(value).toBeInstanceOf(Test);
      return null;
    }

    render(
      <Provider for={Test}>
        <Hook />
      </Provider>
    );
  })
})