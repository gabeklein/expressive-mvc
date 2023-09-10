import { Model } from "../model";
import { add } from "./add";

it("will delete value prior to instruction", () => {
  class Test extends Model {
    value = add((key) => {
      expect(key in this).toBe(false);
    });
  }

  Test.new();
})

it("will throw error if set is false", () => {
  class Test extends Model {
    value = add(() => {
      return ({ set: false });
    });
  }

  const test = Test.new('ID');
  const assign = () => test.value = "foo";

  expect(assign).toThrowError(`Test-ID.value is read-only.`);
})

it("will not throw suspense if get (required) is false", async () => {
  class Test extends Model {
    value = add(() => ({ get: false }));
  }

  const test = Test.new('ID');
  const effect = jest.fn((test: Test) => void test.value);

  test.get(effect);
  test.value = "foo";

  await expect(test).toUpdate();
  expect(effect).toBeCalledTimes(2);
})