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

it("will update on unshift to array", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect(state => {
    mock([ ...state.values ]);
  })

  expect(mock).toBeCalledWith([]);

  test.values.unshift("hello");

  await test.update(true);

  expect(mock).toBeCalledTimes(2);
  expect(mock).toBeCalledWith(["hello"]);
})

it("will update on splice to array", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect(state => {
    mock([ ...state.values ]);
  })

  expect(mock).toBeCalledWith([]);

  test.values.splice(0, 0, "hello");

  await test.update(true);

  test.values.splice(0, 1, "goodbye");

  await test.update(true);

  expect(mock).toBeCalledTimes(3);
  expect(mock).toBeCalledWith(["hello"]);
  expect(mock).toBeCalledWith(["goodbye"]);
})

it.todo("will subscribe to a specific slice");
it.todo("will update only spliced range");
it.todo("will update all after spliced range");
it.todo("will watch specific indicies");
it.todo("will subscribe to model values")