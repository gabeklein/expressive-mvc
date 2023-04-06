import { set } from './instruction/set';
import { Model } from './model';

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

    state.on(effect);

    state.value = 2;
    await state.on(0);

    state.value2 = 3;
    await state.on(0);

    expect(effect).toBeCalledTimes(3);
  })

  it('will ignore change to property not accessed', async () => {
    const state = Subject.new();
    const effect = jest.fn(($: Subject) => {
      void $.value;
    })

    state.on(effect);

    state.value = 2;
    await state.on(0);

    state.value2 = 3;
    await state.on(0);

    /**
     * we did not access value2 in above accessor,
     * subscriber assumes we don't care about updates
     * to this property, so it'l drop relevant events
     */ 
    expect(effect).toBeCalledTimes(2);
  });

  it('will ignore properties accessed through get', async () => {
    const state = Subject.new();
    const effect = jest.fn(($: Subject) => {
      void $.value;
      void $.is.value;
    })

    state.on(effect);

    state.value = 2;
    await state.on(0);

    state.value2 = 3;
    await state.on(0);

    expect(effect).toBeCalledTimes(2);
  })

  it('will not obstruct set-behavior', () => {
    class Test extends Model {
      didSet = jest.fn();
      value = set("foo", this.didSet);
    }

    const test = Test.new();

    expect(test.value).toBe("foo");

    test.on(effect => {
      effect.value = "bar";
    })

    expect(test.value).toBe("bar");
    expect(test.didSet).toBeCalledWith("bar", test);
  })
})