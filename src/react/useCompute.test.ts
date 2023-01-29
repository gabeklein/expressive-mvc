import { mockAsync, mockSuspense, renderHook } from '../helper/testing';
import { Model } from '../model';
import { useCompute } from './useCompute';

const opts = { timeout: 100 };

class Test extends Model {
  foo = 1;
  bar = 2;
  baz = 3;
}

it('will select and subscribe to subvalue', async () => {
  const parent = Test.new();

  const { result, waitForNextUpdate } = renderHook(() => {
    return useCompute(parent, x => x.foo);
  });

  expect(result.current).toBe(1);

  parent.foo = 2;
  await waitForNextUpdate();

  expect(result.current).toBe(2);
})

it('will compute output', async () => {
  const parent = Test.new();
  const { result, waitForNextUpdate } =
    renderHook(() => useCompute(parent, x => x.foo + x.bar));

  expect(result.current).toBe(3);

  parent.foo = 2;
  await waitForNextUpdate(opts);

  expect(result.current).toBe(4);
})

it('will ignore updates with same result', async () => {
  const parent = Test.new();
  const compute = jest.fn();
  const render = jest.fn();

  const { result } = renderHook(() => {
    render();
    return useCompute(parent, x => {
      compute();
      void x.foo;
      return x.bar;
    });
  });

  expect(result.current).toBe(2);
  expect(compute).toBeCalled();

  parent.foo = 2;
  await parent.on();

  // did attempt a second compute
  expect(compute).toBeCalledTimes(2);

  // compute did not trigger a new render
  expect(render).toBeCalledTimes(1);
  expect(result.current).toBe(2);
})

describe("async", () => {
  class Test extends Model {
    foo = "bar";
  };

  it('will return null then refresh', async () => {
    const promise = mockAsync<string>();
    const control = Test.new();

    const { result, waitForNextUpdate } = renderHook(() => {
      return useCompute(control, () => promise.pending());
    });

    expect(result.current).toBeNull();

    promise.resolve("foobar");
    await waitForNextUpdate();

    expect(result.current).toBe("foobar");
  });

  it('will not subscribe to values', async () => {
    const promise = mockAsync<string>();
    const control = Test.new();

    const { result, waitForNextUpdate } = renderHook(() => {
      return useCompute(control, $ => {
        void $.foo;
        return promise.pending();
      });
    });

    control.foo = "foo";
    await expect(waitForNextUpdate(opts)).rejects.toThrowError();

    promise.resolve("foobar");
    await waitForNextUpdate();

    expect(result.current).toBe("foobar");
  });
})

describe("suspense", () => {
  class Test extends Model {
    value?: string = undefined;
  }

  it('will suspend if value expected', async () => {
    const instance = Test.new() as Test;
    const promise = mockAsync();
    const test = mockSuspense();

    const didRender = jest.fn();
    const didCompute = jest.fn();

    test.renderHook(() => {
      promise.resolve();
      didRender();

      useCompute(instance, state => {
        didCompute();

        if(state.value == "foobar")
          return true;
      }, true);
    })

    test.assertDidSuspend(true);

    expect(didCompute).toBeCalledTimes(1);

    instance.value = "foobar";
    await promise.pending();

    // 1st - render prior to bailing
    // 2nd - successful render
    expect(didRender).toBeCalledTimes(2);

    // 1st - initial render fails
    // 2nd - recheck success (permit render again)
    // 3rd - hook regenerated next render 
    expect(didCompute).toBeCalledTimes(3);
  })

  it('will suspend strict async', async () => {
    const instance = Test.new();
    const promise = mockAsync();
    const test = mockSuspense();

    test.renderHook(() => {
      useCompute(instance, () => promise.pending(), true);
    })

    test.assertDidSuspend(true);

    promise.resolve();
    await test.waitForNextRender();

    test.assertDidRender(true);
  })
})

describe("undefined", () => {
  class Test extends Model {};

  it("will convert to null", () => {
    const test = Test.new();
    const { result } = renderHook(() => {
      return useCompute(test, () => undefined);
    });

    expect(result.current).toBe(null);
  })

  it("will convert to null from factory", () => {
    const test = Test.new();
    const { result } = renderHook(() => {
      return useCompute(test, () => () => undefined);
    });

    expect(result.current).toBe(null);
  })
})