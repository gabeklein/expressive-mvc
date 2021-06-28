import { Oops as Hooks } from '../src/hooks';
import { Oops as Global } from '../src/singleton';
import { Model, Singleton, renderHook } from './adapter';

const opts = { timeout: 100 };

describe("get", () => {
  class Test extends Singleton {
    value = 1;
  }

  beforeEach(() => Test.reset());

  it("will get instance", () => {
    const instance = Test.create();
    const { result } = renderHook(() => Test.get());

    expect(result.current).toStrictEqual(instance);
    expect(result.current!.value).toBe(1);
  })

  it("will get instance value", () => {
    Test.create();
    const { result } = renderHook(() => Test.get("value"));

    expect(result.current).toBe(1);
  })

  it("will complain if not-found in expect mode", () => {
    const { result } = renderHook(() => Test.get(true));
    const expected = Global.GlobalDoesNotExist(Test.name);

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

  it("will destroy on unmount", () => {
    const { result, unmount } = renderHook(() => Test.new());
    const { destroy } = result.current!;

    expect(result.current).toBeInstanceOf(Test);
    unmount();

    expect(destroy).toBeCalled();
  })
})

describe("tap", () => {
  class Parent extends Model {
    value = "foo";
    empty = undefined;
    child = new Child();
  }
  
  class Child extends Model {
    value = "foo"
    grandchild = new GrandChild();
  }
  
  class GrandChild extends Model {
    value = "bar"
  }

  it('access subvalue directly', async () => {
    const parent = Parent.create();

    const { result, waitForNextUpdate } =
      renderHook(() => parent.tap("value"))
  
    expect(result.current).toBe("foo");
  
    parent.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  })

  it('will throw if undefined in expect-mode', () => {
    const parent = Parent.create();
    const hook = renderHook(() => parent.tap("empty", true));
    const expected = Hooks.HasPropertyUndefined(Parent.name, "empty");
    
    expect(() => hook.result.current).toThrowError(expected);
  })

  it('select subvalue directly', async () => {
    const parent = Parent.create();
    const { result, waitForNextUpdate } =
      renderHook(() => parent.tap(x => x.value));
  
    expect(result.current).toBe("foo");

    parent.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  })
  
  it('access child controller', async () => {
    const parent = Parent.create();
    const { result, waitForNextUpdate } =
      renderHook(() => parent.tap("child"))
  
    expect(result.current.value).toBe("foo");
  
    result.current.value = "bar"
    await waitForNextUpdate(opts);
    expect(result.current.value).toBe("bar");
  
    parent.child = new Child();
    await waitForNextUpdate(opts);
    expect(result.current.value).toBe("foo");
  
    result.current.value = "bar"
    await waitForNextUpdate(opts);
    expect(result.current.value).toBe("bar");
  })
  
  it.todo('access nested controllers')
})

describe("tag", () => {
  class Test extends Model {
    value = "foo";
  }

  it("will subscribe to instance", async () => {
    const control = Test.create();

    const { result, waitForNextUpdate } =
      renderHook(() => control.tag("value"));

    expect(result.current.value).toBe("foo");
  
    control.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current.value).toBe("bar");
  })
})

describe("meta", () => {
  class Child extends Model {
    value = "foo";
  }
  
  class Parent extends Model {
    static value = "foo";
    static child = new Child();
  }

  beforeEach(() => Parent.value = "foo")
  
  it('will track static values', async () => {
    const { result, waitForNextUpdate } = renderHook(() => {
      const meta = Parent.meta();
      return meta.value;
    });

    expect(result.current).toBe("foo");

    Parent.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  })
  
  it.skip('will track specific values', async () => {
    const { result, waitForNextUpdate } =
      renderHook(() => Parent.meta(x => x.value));

    expect(result.current).toBe("foo");

    Parent.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
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
  
    // Fresh subscription does still work.
    current.child.value = "bar";
    await waitForNextUpdate(opts);
    expect(current.child.value).toBe("bar");
  })
})