import { Model, ref } from '..';


class Subject extends Model {
  didTrigger = jest.fn();

  ref1 = ref<string>();

  ref2 = ref<symbol>(value => {
    this.didTrigger(value);
  })

  ref3 = ref<number>(() => {
    return () => {
      this.didTrigger(true);
    }
  })
}

it('will fetch value from ref-object', async () => {
  const state = Subject.create();

  state.ref1.current = "foobar";

  await state.update(true);
  expect(state.ref1.current).toBe("foobar");
})

it('will watch "current" of property', async () => {
  const state = Subject.create();
  const callback = jest.fn()

  state.once("ref1", callback);
  state.ref1.current = "foobar";

  await state.update(true);
  expect(callback).toBeCalledWith("foobar", "ref1");
})

it('will update "current" when property invoked', async () => {
  const state = Subject.create();
  const callback = jest.fn()

  state.once("ref1", callback);
  state.ref1("foobar");

  await state.update(true);
  expect(callback).toBeCalledWith("foobar", "ref1");
})

it('will invoke callback if exists', async () => {
  const state = Subject.create();
  const targetValue = Symbol("inserted object");
  const callback = jest.fn();

  expect(state.didTrigger).not.toBeCalled();
  state.once("ref2", callback);
  state.ref2.current = targetValue;
  expect(state.didTrigger).toBeCalledWith(targetValue);

  await state.update(true);
  expect(callback).toBeCalledWith(targetValue, "ref2");
})

it('will invoke return-callback on overwrite', async () => {
  const state = Subject.create();

  state.ref3.current = 1;

  await state.update();
  expect(state.didTrigger).not.toBeCalled();
  state.ref3.current = 2;

  await state.update();
  expect(state.didTrigger).toBeCalledWith(true);
})

it('will export value of ref-properties', () => {
  const test = Subject.create();
  const values = {
    ref1: "foobar",
    ref2: Symbol("foobar"),
    ref3: 69420
  }

  test.ref1(values.ref1);
  test.ref2(values.ref2);
  test.ref3(values.ref3);

  const state = test.export();

  expect(state).toMatchObject(values);
})

it('will be accessible from a proxy', () => {
  const test = Subject.create();

  test.effect(state => {
    expect(state.ref1).not.toBeUndefined();
  })
})