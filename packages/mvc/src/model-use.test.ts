import { mockHook } from "./helper/mocks";
import { Model } from "./model";

class Test extends Model {
  value = "foo";
};

it("will create instance given a class", () => {
  const hook = mockHook(() => Test.use());

  expect(hook.current).toBeInstanceOf(Test);
})

it("will subscribe to instance of controller", async () => {
  const hook = mockHook(() => Test.use());

  expect(hook.current.value).toBe("foo");
  hook.current.value = "bar";

  await hook.refresh;
  expect(hook.current.value).toBe("bar");
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

  const hook = mockHook(() => Test.use());

  expect(didDestroy).not.toBeCalled();
  hook.unmount();
  expect(didDestroy).toBeCalled();
})

it("will ignore updates after unmount", async () => {
  const hook = mockHook(() => {
    const test = Test.use();
    void test.value;
    return test.is;
  });

  const test = hook.current;

  test.value = "bar";
  await hook.refresh;

  hook.unmount();
  test.value = "baz";
})