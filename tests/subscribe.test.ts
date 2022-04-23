import { Model, set } from '../src';
import { STATE } from '../src/model';
import { subscribeTo } from './adapter';

describe("subscriber", () => {
  class Subject extends Model {
    value = 1;
    value2 = 2;
  }

  it('will detect change to properties accessed', async () => {
    const state = Subject.create();
    const update = subscribeTo(state, it => {
      void it.value;
      void it.value2;
    })

    state.value = 2;
    await update();

    state.value2 = 3;
    await update();
  })

  it('will ignore change to property not accessed', async () => {
    const state = Subject.create();
    const update = subscribeTo(state, it => {
      void it.value;
    })

    state.value = 2;
    await update();

    /**
     * we did not access value2 in above accessor,
     * subscriber assumes we don't care about updates
     * to this property, so it'l drop relevant events
     **/ 
    state.value2 = 3;
    await update(false);
  });

  it('will ignore properties accessed through get', async () => {
    const state = Subject.create();
    const update = subscribeTo(state, it => {
      void it.value;
      void it.get.value2;
    })

    state.value = 2;
    await update();

    state.value2 = 3;
    await update(false);
  })

  it('will not obstruct set-behavior', () => {
    class Test extends Model {
      didSet = jest.fn();
      value = set(() => "foo", this.didSet);
    }

    const control = Test.create();
    const state = control[STATE];

    expect(control.value).toBe("foo");

    subscribeTo(control, it => {
      it.value = "bar";
    })

    expect(control.value).toBe("bar");
    expect(control.didSet).toBeCalledWith("bar", state);
  })
})