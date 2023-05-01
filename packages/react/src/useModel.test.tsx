import React from 'react';

import { Model } from '.';
import { create, renderHook } from './helper/testing';
import { act } from 'react-test-renderer';

const opts = { timeout: 100 };

describe("hook", () => {
  class Test extends Model {
    value = "foo";
  };

  it("will create instance given a class", () => {
    const render = renderHook(() => Test.use());
    const result = render.result.current;

    expect(result).toBeInstanceOf(Test);
  })

  it("will run callback", () => {
    const callback = jest.fn();

    renderHook(() => Test.use(callback));
    expect(callback).toHaveBeenCalledWith(expect.any(Test));
  })

  it("will destroy instance of given class", () => {
    const didDestroy = jest.fn();

    class Test extends Model {
      null(){
        super.null();
        didDestroy();
      }
    }

    const render = renderHook(() => Test.use());

    expect(didDestroy).not.toBeCalled();
    render.unmount();
    expect(didDestroy).toBeCalled();
  })

  it("will ignore updates after unmount", async () => {
    const render = renderHook(() => {
      const test = Test.use();
      void test.value;
      return test.is;
    });

    const test = render.result.current;

    test.value = "bar";

    await render.waitForNextUpdate();

    render.unmount();
    test.value = "baz";
  })
})

describe("subscription", () => {
  class Test extends Model {
    value = "foo";
  };

  it("will subscribe to instance of controller", async () => {
    const { result, waitForNextUpdate } =
      renderHook(() => Test.use());

    expect(result.current.value).toBe("foo");
    result.current.value = "bar";

    await waitForNextUpdate(opts);
    expect(result.current.value).toBe("bar");
  })

  it("will ignore causal updates", async () => {
    const didRender = jest.fn();
    let test!: Test;

    const TestComponent = (props: any) => {
      test = Test.use(props, true);
      didRender(test.value);
      return null;
    }

    const element = create(<TestComponent />);

    expect(didRender).toBeCalledTimes(1);

    element.update(<TestComponent value="bar" />);

    expect(didRender).toBeCalledTimes(2);
    expect(didRender).toBeCalledWith("bar");

    await expect(test).toUpdate();

    expect(didRender).toBeCalledTimes(2);

    // remove value prop to prevent snap-back
    element.update(<TestComponent />);
    expect(didRender).toBeCalledTimes(3);

    await act(async () => {
      await test.on(0);
      test.value = "foo";
      await test.on(0);
    })

    // expect updates re-enabled
    expect(didRender).toBeCalledTimes(4);
  })
})

describe("import", () => {
  class Test extends Model {
    foo?: string = undefined;
    bar?: string = undefined;
  }

  it("will apply values", async () => {
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

  it.todo("will not refresh from updates caused");
  it.todo("will still subscribe to updates");
})