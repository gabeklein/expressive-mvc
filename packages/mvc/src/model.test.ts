import { set } from './instruction/set';
import { Model } from './model';

class Subject extends Model {
  value = 1;
}

it('will instantiate from custom class', () => {
  const state = Subject.new();

  expect(state.value).toBe(1);
})

it('will enumerate properties', () => {
  class Test extends Subject {
    /* value is inherited */
    value2 = 2;
    method = () => {};
  }

  const state = Test.new();
  const keys = Object.keys(state);

  expect(keys).toEqual([
    "value",
    "value2",
    "method"
  ]);
});

it('will send arguments to constructor', () => {
  class Test extends Model {
    constructor(public value: number){
      super();
    }
  }

  const test = Test.new(3);

  expect(test.value).toBe(3);
})

it("will ignore getters and setters", () => {
  class Test extends Model {
    foo = "foo";

    get bar(){
      return "bar";
    }

    set baz(value: string){
      this.foo = value;
    }
  }

  const test = Test.new();

  expect(test.bar).toBe("bar");
  expect(test.get()).not.toContain("bar");
})

it('will update when a value changes', async () => {
  const state = Subject.new();

  expect(state.value).toBe(1);

  state.value = 2
  await expect(state).toUpdate();

  expect(state.value).toBe(2);
})

it('will not update if value is same', async () => {
  const state = Subject.new();

  expect(state.value).toBe(1);

  state.value = 1
  await expect(state).not.toUpdate();
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
  await expect(state).toUpdate();

  expect(state.value).toBe(3)
})

it('will watch function properties', async () => {
  const mockFunction = jest.fn();
  const mockFunction2 = jest.fn();
  
  class Test extends Model {
    fn = mockFunction;
  }

  const test = Test.new();

  test.get(state => {
    state.fn();
  });

  expect(mockFunction).toBeCalled();

  test.fn = mockFunction2;

  await expect(test).toUpdate();

  expect(mockFunction2).toBeCalled();
  expect(mockFunction).toBeCalledTimes(1);
});

describe("subscriber", () => {
  class Subject extends Model {
    value = 1;
    value2 = 2;
  }

  it('will detect change to properties accessed', async () => {
    const state = Subject.new();
    const effect = jest.fn(($: Subject) => {
      void $.value;
      void $.value2;
    })

    state.get(effect);

    state.value = 2;
    await state.set(0);

    state.value2 = 3;
    await state.set(0);

    expect(effect).toBeCalledTimes(3);
  })

  it('will ignore change to property not accessed', async () => {
    const state = Subject.new();
    const effect = jest.fn(($: Subject) => {
      void $.value;
    })

    state.get(effect);

    state.value = 2;
    await state.set(0);

    state.value2 = 3;
    await state.set(0);

    /**
     * we did not access value2 in above accessor,
     * subscriber assumes we don't care about updates
     * to this property, so it'l drop relevant events
     */ 
    expect(effect).toBeCalledTimes(2);
  });

  it('will not obstruct set-behavior', () => {
    class Test extends Model {
      didSet = jest.fn();
      value = set("foo", this.didSet);
    }

    const test = Test.new();

    expect(test.value).toBe("foo");

    test.get(effect => {
      effect.value = "bar";
    })

    expect(test.value).toBe("bar");
    expect(test.didSet).toBeCalledWith("bar", "foo");
  })
})