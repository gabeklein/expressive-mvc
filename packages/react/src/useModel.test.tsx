import React from 'react';

import { Model } from '.';
import { create, renderHook } from './helper/testing';

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
      gc(){
        super.gc();
        didDestroy();
      }
    }

    const render = renderHook(() => Test.use());

    expect(didDestroy).not.toBeCalled();
    render.unmount();
    expect(didDestroy).toBeCalled();
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
      test = Test.use(props);
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
  })
})

describe("specific", () => {
  class Test extends Model {
    foo = "foo";
    bar = "bar";
  }

  it("will subscribe to only keys specified", async () => {
    const { result, waitForNextUpdate } = renderHook(() => {
      const control = Test.use(["foo"]);

      void control.foo;
      void control.bar;

      return control;
    });

    expect(result.current.foo).toBe("foo");
    result.current.foo = "bar";

    await waitForNextUpdate(opts);
    expect(result.current.foo).toBe("bar");

    result.current.bar = "foo";
    await expect(waitForNextUpdate(opts)).rejects.toThrowError();
  })

  it("will run callback after creation", () => {
    const callback = jest.fn();
    renderHook(() => Test.use([], callback));
    expect(callback).toHaveBeenCalledWith(expect.any(Test));
  })

  it("will destroy on unmount", () => {
    class Test extends Model {
      constructor(){
        super();
        this.on(() => didDestroy, []);
      }
    }

    const didDestroy = jest.fn();
    const element = renderHook(() => Test.use([]));

    element.unmount();

    expect(didDestroy).toBeCalled();
  })
})

describe("import", () => {
  class Test extends Model {
    foo?: string = undefined;
    bar?: string = undefined;
  }

  it("will apply values", () => {
    const mockExternal = {
      foo: "foo",
      bar: "bar"
    }

    const render = renderHook(() => {
      return Test.use(mockExternal);
    });

    const state = render.result.current.get();

    expect(state).toMatchObject(mockExternal);
  })

  it("will apply values per-render", async () => {
    let instance!: Test;

    const TestComponent = (props: any) => {
      ({ is: instance } = Test.use(props));
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