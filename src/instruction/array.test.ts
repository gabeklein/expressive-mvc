import { Model } from "..";
import { array } from "./array";

class Test extends Model {
  values = array();
}

it("will update on push to array", async () => {
  const test = Test.create();
  const mock = jest.fn();
  
  test.effect(state => {
    mock([ ...state.values ]);
  })

  expect(mock).toBeCalledWith([]);

  test.values.push("hello");

  await test.update(true);

  expect(mock).toBeCalledTimes(2);
  expect(mock).toBeCalledWith(["hello"]);
})