import { Model } from "../model";
import { map } from "./map";

it("will subscribe to map property", () => {
  class Test extends Model {
    items = map<string, number>([
      ["foo", 1],
      ["bar", 2]
    ]);
  }

  const test = Test.new();
  
  expect(test.items.get("foo")).toBe(1);

  const effect = jest.fn((state: Test) => {
    void state.items.get("bar");
  });

  test.get(effect);

  expect(effect).toBeCalledTimes(1);

  test.items.set("foo", 2);
})