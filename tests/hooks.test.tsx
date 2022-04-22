import React from 'react';

import { Oops } from '../src/react/global';
import { Global, Model, render, renderHook, use } from './adapter';

const opts = { timeout: 100 };

describe("use", () => {
  class Test extends Model {
    value = "foo";
  };

  it("will use a given instance", () => {
    const instance = Test.create();
    const render = renderHook(() => instance.use());
    const result = render.result.current;

    expect(result).toStrictEqual(instance);

  })

  it("will create instance given a class", () => {
    const render = renderHook(() => Test.use());
    const result = render.result.current;

    expect(result).toBeInstanceOf(Test);
  })

  it("will destroy instance of given class", () => {
    const didDestroy = jest.fn();

    class Test extends Model {
      destroy(){
        super.destroy();
        didDestroy();
      }
    }

    const render = renderHook(() => Test.use());

    expect(didDestroy).not.toBeCalled();
    render.unmount();
    expect(didDestroy).toBeCalled();
  })

  it("will run callback", () => {
    const callback = jest.fn();

    renderHook(() => Test.use(callback));
    expect(callback).toHaveBeenCalledWith(expect.any(Test));
  })

  it("will subscribe to instance of controller", async () => {
    const { result, waitForNextUpdate } =
      renderHook(() => Test.use());

    expect(result.current.value).toBe("foo");
    result.current.value = "bar";

    await waitForNextUpdate(opts);
    expect(result.current.value).toBe("bar");
  })
})

describe("uses", () => {
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
      return Test.uses(mockExternal);
    });

    const state = render.result.current.export();

    expect(state).toMatchObject(mockExternal);
  })

  it("will apply select values", () => {
    const mockExternal = {
      foo: "foo",
      bar: "bar"
    }

    const render = renderHook(() => {
      return Test.uses(mockExternal, ["foo"]);
    });

    const state = render.result.current.export();

    expect(state).toMatchObject({
      bar: undefined,
      foo: "foo"
    });
  })

  it("will override (untracked) arrow functions", () => {
    class Test extends Model {
      foobar = () => "Hello world!";
    }

    const mockExternal = {
      foobar: () => "Goodbye cruel world!"
    }

    const render = renderHook(() => {
      return Test.uses(mockExternal);
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
      return Test.uses(mockExternal);
    });

    const { foobar } = render.result.current;

    expect(foobar).not.toBe(mockExternal.foobar);
  })
})

describe("using", () => {
  class Test extends Model {
    foo?: string = undefined;
    bar?: string = undefined;
  }

  it("will apply values per-render", async () => {
    let instance!: Test;

    const TestComponent = (props: any) => {
      ({ get: instance } = Test.using(props));
      return null;
    }

    const rendered = render(<TestComponent />);

    expect(instance).toBeInstanceOf(Test);

    const update = instance.update();

    rendered.update(<TestComponent foo="foo" bar="bar" />);

    expect(await update).toEqual(
      expect.arrayContaining(["foo", "bar"])
    );
  })
})

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
    const { result } = renderHook(() => {
      return Test.get("value");
    });

    expect(result.current).toBe(1);
  })

  it("will complain if not-found in expect mode", () => {
    const { result } = renderHook(() => Test.get(true));
    const expected = Oops.GlobalDoesNotExist(Test.name);

    expect(() => result.current).toThrowError(expected);
  })
})

describe("new", () => {
  class Test extends Model {
    value = 1;
    destroy = jest.fn();
  }

  it("will get instance value", () => {
    const { result } = renderHook(() => Test.new());

    expect(result.current).toBeInstanceOf(Test);
  });

  it("will run callback after creation", () => {
    const callback = jest.fn();
    renderHook(() => Test.new(callback));
    expect(callback).toHaveBeenCalledWith(expect.any(Test));
  })

  it("will destroy on unmount", () => {
    const { result, unmount } = renderHook(() => Test.new());
    const { destroy } = result.current!;

    expect(result.current).toBeInstanceOf(Test);
    unmount();

    expect(destroy).toBeCalled();
  })
})

describe("meta", () => {
  class Child extends Model {
    value = "foo";
  }
  
  class Parent extends Model {
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
    const { result: { current }, waitForNextUpdate } = renderHook(() => {
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