import { renderHook } from '@testing-library/react-hooks';

import { lazy, Model } from './adapter';

describe("lazy", () => {
  class Test extends Model {
    lazy = lazy("foo");
    eager = "bar";
  }

  it("will set starting value", async () => {
    const state = Test.create();

    expect(state.lazy).toBe("foo");
  });

  it("will ignore updates", async () => {
    const state = Test.create();

    expect(state.lazy).toBe("foo");
    state.lazy = "bar";

    await state.update(false);
    expect(state.lazy).toBe("bar");
    state.eager = "foo";

    await state.update(true);
  });

  it("will include key on import", () => {
    const state = Test.create();
    const assign = {
      lazy: "bar",
      eager: "foo"
    };
    
    state.import(assign);
    expect(assign).toMatchObject(state);
  });

  it("will include value on export", async () => {
    const state = Test.create();
    const values = state.export();

    expect(values).toMatchObject({
      lazy: "foo",
      eager: "bar"
    })
  });

  it("will not include in subscriber", async () => {
    const element = renderHook(() => Test.use());
    const proxy = element.result.current;
    const subscriberOverlay =
      Object.getOwnPropertyNames(proxy);

    // lazy should be still be visible
    expect(proxy.lazy).toBe("foo");

    // there should be no spy getter however
    expect(subscriberOverlay).not.toContain("lazy");
    expect(subscriberOverlay).toContain("eager");
  });
})