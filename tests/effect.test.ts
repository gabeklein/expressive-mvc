import { Oops } from '../src/util';
import { from, Model } from './adapter';

describe("method", () => {
  class TestValues extends Model {
    value1 = 1;
    value2 = 2;
    value3 = 3;

    value4 = from(this, state => {
      return state.value3 + 1;
    });
  }

  it('will watch values', async () => {
    const state = TestValues.create();
    const callback = jest.fn();

    state.effect(callback, [
      "value1",
      "value2",
      "value3",
      "value4",
    ]);
  
    state.value1 = 2;

    // wait for update event, thus queue flushed
    await state.update()
    
    state.value2 = 3;
    state.value3 = 4;

    // wait for update event to flush queue
    await state.update()
    
    // expect two syncronous groups of updates.
    expect(callback).toBeCalledTimes(3)
  })

  it('will squash simultaneous updates', async () => {
    const state = TestValues.create();
    const callback = jest.fn();

    state.effect(callback, ["value1", "value2"]);
  
    state.value1 = 2;
    state.value2 = 3;

    await state.update()
    
    // expect two syncronous groups of updates.
    expect(callback).toBeCalledTimes(2)
  })

  it('will squash simultaneous compute update', async () => {
    const state = TestValues.create();
    const callback = jest.fn();

    state.effect(callback, ["value3", "value4"]);
  
    state.value3 = 4;

    await state.update()
    
    // expect two syncronous groups of updates.
    expect(callback).toBeCalledTimes(2)
  })

  it('will watch for any value', async () => {
    const state = TestValues.create();
    const callback = jest.fn();

    state.effect(callback, []);
  
    state.value1 = 2;

    // wait for update event, thus queue flushed
    await state.update()
    
    state.value2 = 3;
    state.value3 = 4;

    // wait for update event to flush queue
    await state.update()
    
    // expect two syncronous groups of updates.
    expect(callback).toBeCalledTimes(3)
  })

  it('will watch values with selector', async () => {
    const state = TestValues.create();
    const callback = jest.fn();

    state.effect(callback,
      $ => $.value1.value2.value3.value4
    );
  
    state.value1 = 2;
    state.value2 = 3;

    await state.update();

    state.value3 = 4;

    // expect value4, which relies on 3.
    await state.update();
    
    expect(callback).toBeCalledTimes(3);
  })

  it('will squash simultaneous updates via subscriber', async () => {
    const state = TestValues.create();
    const callback = jest.fn();

    state.effect(self => {
      void self.value1
      void self.value2;
      callback();
    });
  
    state.value1 = 2;
    state.value2 = 3;

    await state.update()
    
    // expect two syncronous groups of updates.
    expect(callback).toBeCalledTimes(2)
  })

  it('will squash simultaneous compute via subscriber', async () => {
    const state = TestValues.create();
    const callback = jest.fn();

    state.effect(self => {
      void self.value3;
      void self.value4;
      callback();
    });
  
    state.value3 = 4;

    await state.update()
    
    // expect two syncronous groups of updates.
    expect(callback).toBeCalledTimes(2)
  })

  it('will watch values with subscriber', async () => {
    const state = TestValues.create();
    const callback = jest.fn();

    state.effect(self => {
      // destructure values to indicate access.
      const { value1, value2, value3 } = self;
      void value1, value2, value3;
      callback();
    });
  
    state.value1 = 2;
    await state.update();

    state.value2 = 3;
    await state.update();

    state.value2 = 4;
    state.value3 = 4;
    await state.update();
  
    /**
     * must invoke once to detect subscription
     * 
     * invokes three more times:
     * - value 1
     * - value 2
     * - value 2 & 3 (squashed)
     */
    expect(callback).toBeCalledTimes(4);
  })

  it('will watch values with method subscriber', async () => {
    class Test extends TestValues {
      testEffect(){
        // destructure values to indicate access.
        const { value1, value2, value3 } = this;
        void value1, value2, value3;
        callback();
      }
    }

    const state = Test.create();
    const callback = jest.fn();
  
    state.effect(state.testEffect);
  
    state.value1 = 2;
    await state.update();

    state.value2 = 3;
    await state.update();

    state.value2 = 4;
    state.value3 = 4;
    await state.update();

    expect(callback).toBeCalledTimes(4);
  })

  it("will call function effect returns on subsequent update", async () => {
    class Test extends TestValues {
      testEffect(){
        return callback;
      }
    }

    const state = Test.create();
    const callback = jest.fn();
    
    state.effect(state.testEffect, ["value1"]);

    expect(callback).not.toBeCalled();

    state.value1 = 2;
    await state.update();

    expect(callback).toBeCalled();
  })

  it("will throw if effect returns non-function", () => {
    const state = TestValues.create();
    const expected = Oops.BadEffectCallback();
    const attempt = () => {
      // @ts-ignore
      state.effect(() => "foobar");
    }

    expect(attempt).toThrowError(expected);
  })

  it("will not throw if effect returns promise", () => {
    const state = TestValues.create();
    const attempt = () => {
      state.effect(async () => {});
    }

    expect(attempt).not.toThrowError();
  })
});

describe("before ready", () => {
  class TestValues extends Model {
    value1 = 1;
    value2 = 2;

    value3 = from(this, state => {
      return state.value2 + 1;
    });
  }

  it('will register effect', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.effect(mock, ["value1", "value3"]);
      }
    }

    const mock = jest.fn();
    const state = Test.create();

    state.value1++;
    await state.update();

    expect(mock).toBeCalled();

    state.value2++;
    await state.update();

    // expect pre-existing listener to hit
    expect(mock).toBeCalledTimes(3);
  })

  it('will register via selector', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        // @ts-ignore
        this.effect(mock, x => x.value1.value3);
      }
    }

    const mock = jest.fn();
    const state = Test.create();

    state.value1++;
    await state.update();

    expect(mock).toBeCalled();

    state.value2++;
    await state.update();

    // expect pre-existing listener to hit
    expect(mock).toBeCalledTimes(3);
  })

  it('will register via subscriber', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.effect(this.test);
      }

      test(){
        void this.value1;
        void this.value3;
        mock();
      }
    }

    const mock = jest.fn();
    const state = Test.create();

    // runs immediately to aquire subscription
    expect(mock).toBeCalled();

    state.value1++;
    await state.update();

    expect(mock).toBeCalledTimes(2);

    state.value2++;
    await state.update();

    expect(mock).toBeCalledTimes(3);
  })

})