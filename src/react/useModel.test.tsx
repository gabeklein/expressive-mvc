import React from 'react';

import { Model, useModel } from '..';
import { render, renderHook } from '../../tests/adapter';

const opts = { timeout: 100 };

describe("hook", () => {
  class Test extends Model {
    value = "foo";
  };

  it("will use a given instance", () => {
    const instance = Test.create();
    const render = renderHook(() => useModel(instance));
    const result = render.result.current;

    expect(result).toStrictEqual(instance);
  })

  it("will create instance given a class", () => {
    const render = renderHook(() => useModel(Test));
    const result = render.result.current;

    expect(result).toBeInstanceOf(Test);
  })
  
  it("will use factory function", () => {
    const instance = Test.create();
    const render = renderHook(() => useModel(() => instance));
    const result = render.result.current;

    expect(result).toStrictEqual(instance);
  })

  it("will run callback", () => {
    const callback = jest.fn();

    renderHook(() => useModel(Test, callback));
    expect(callback).toHaveBeenCalledWith(expect.any(Test));
  })

  it("will destroy instance of given class", () => {
    const didDestroy = jest.fn();

    class Test extends Model {
      destroy(){
        super.destroy();
        didDestroy();
      }
    }

    const render = renderHook(() => useModel(Test));

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
      renderHook(() => useModel(Test));

    expect(result.current.value).toBe("foo");
    result.current.value = "bar";

    await waitForNextUpdate(opts);
    expect(result.current.value).toBe("bar");
  })

  it("will ignore causal updates", async () => {
    const didRender = jest.fn();
    const test = Test.create();

    const TestComponent = (props: any) => {
      const { value } = useModel(test, props);
      didRender(value);
      return null;
    }

    const element = render(<TestComponent />);

    expect(didRender).toBeCalledTimes(1);

    element.update(<TestComponent value="bar" />);

    expect(didRender).toBeCalledTimes(2);
    expect(didRender).toBeCalledWith("bar");

    await test.update();

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
      const control = useModel(Test, ["foo"]);

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
    renderHook(() => useModel(Test, [], callback));
    expect(callback).toHaveBeenCalledWith(expect.any(Test));
  })

  it("will destroy on unmount", () => {
    class Test extends Model {
      constructor(){
        super();
        this.effect(() => didDestroy, []);
      }
    }

    const didDestroy = jest.fn();
    const element = renderHook(() => useModel(Test, []));

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
      return useModel(Test, mockExternal);
    });

    const state = render.result.current.export();

    expect(state).toMatchObject(mockExternal);
  })

  it("will apply values per-render", async () => {
    let instance!: Test;

    const TestComponent = (props: any) => {
      ({ get: instance } = useModel(Test, props));
      return null;
    }

    const rendered = render(<TestComponent />);

    expect(instance).toBeInstanceOf(Test);

    const update = instance.update();

    rendered.update(
      <TestComponent foo="foo" bar="bar" />
    );

    expect(await update).toEqual(
      expect.arrayContaining(["foo", "bar"])
    );
  })

  it("will override (untracked) arrow functions", () => {
    class Test extends Model {
      foobar = () => "Hello world!";
    }

    const mockExternal = {
      foobar: () => "Goodbye cruel world!"
    }

    const render = renderHook(() => {
      return useModel(Test, mockExternal);
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
      return useModel(Test, mockExternal);
    });

    const { foobar } = render.result.current;

    expect(foobar).not.toBe(mockExternal.foobar);
  })
})