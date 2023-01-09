import { Model } from '../src/model';

class Subject extends Model {
  value: number;

  constructor(initial?: number){
    super();
    this.value = initial || 1;
  }

  setValue = (to: number) => {
    this.value = to;
  }
}

it('will instantiate from custom class', () => {
  const state = Subject.new();

  expect(state.value).toBe(1);
})

it('will send arguments to constructor', () => {
  const state = Subject.new(3);

  expect(state.value).toBe(3);
})

it('will assign is as a circular reference', async () => {
  const state = Subject.new();

  expect(state.is.value).toBe(1);

  state.value = 2;
  await state.on(true);

  expect(state.is.value).toBe(2)
})

it("will ignore getters and setters", () => {
  class Test extends Model {
    foo = "foo";

    get bar(){
      return "bar";
    }
  }

  const test = Test.new();

  expect(test.bar).toBe("bar");
  expect(test.export()).not.toContain("bar");
})

it('will update when a value changes', async () => {
  const state = Subject.new();

  expect(state.value).toBe(1);

  state.value = 2
  await state.on(true);

  expect(state.value).toBe(2);
})

it('will not update if value is same', async () => {
  const state = Subject.new();

  expect(state.value).toBe(1);

  state.value = 1
  await state.on(null);
})

it('accepts update from within a method', async () => {
  class Subject extends Model {
    value = 1;

    setValue = (to: number) => {
      this.value = to;
    }
  }

  const state = Subject.new();

  state.setValue(3);
  await state.on(true);

  expect(state.value).toBe(3)
})