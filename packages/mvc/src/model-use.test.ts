import { mockHook } from "./helper/mocks";
import { Model } from "./model";

class Test extends Model {
  value = "foo";
};

it("will create instance given a class", () => {
  const render = mockHook(() => Test.use());

  expect(render.current).toBeInstanceOf(Test);
})

it("will subscribe to instance of controller", async () => {
  const render = mockHook(() => Test.use());

  expect(render.current.value).toBe("foo");
  render.current.value = "bar";

  await render.refresh;
  expect(render.current.value).toBe("bar");
})

it("will run callback", () => {
  const callback = jest.fn();

  mockHook(() => Test.use(callback));
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

  const render = mockHook(() => Test.use());

  expect(didDestroy).not.toBeCalled();
  render.unmount();
  expect(didDestroy).toBeCalled();
})

it("will ignore updates after unmount", async () => {
  const render = mockHook(() => {
    const test = Test.use();
    void test.value;
    return test.is;
  });

  const test = render.current;

  test.value = "bar";
  await render.refresh;

  render.unmount();
  test.value = "baz";
})