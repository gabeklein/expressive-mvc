import { Oops } from '../src/util';
import { from, Model } from './adapter';

describe("method", () => {
  class TestValues extends Model {
    value1 = 1;
    value2 = 2;
    value3 = 3;
    value4 = from(this, $ => $.value3 + 1);
  }

  it('will watch values', async () => {
    const state = TestValues.create();
    const mock = jest.fn();

    state.effect(mock, [
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
    expect(mock).toBeCalledTimes(3)
  })

  it('will squash simultaneous updates', async () => {
    const state = TestValues.create();
    const mock = jest.fn();

    state.effect(mock, ["value1", "value2"]);
  
    state.value1 = 2;
    state.value2 = 3;

    await state.update()
    
    // expect two syncronous groups of updates.
    expect(mock).toBeCalledTimes(2)
  })

  it('will squash simultaneous compute update', async () => {
    const state = TestValues.create();
    const mock = jest.fn();

    state.effect(mock, ["value3", "value4"]);
  
    state.value3 = 4;

    await state.update()
    
    // expect two syncronous groups of updates.
    expect(mock).toBeCalledTimes(2)
  })

  it("will call return-function on subsequent update", async () => {
    class Test extends Model {
      value1 = 1;

      testEffect(){
        return mock;
      }
    }

    const state = Test.create();
    const mock = jest.fn();
    
    state.effect(state.testEffect, ["value1"]);

    expect(mock).not.toBeCalled();

    state.value1 = 2;
    await state.update();

    expect(mock).toBeCalled();
  })

  it('will register before ready', async () => {
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

    state.value3++;
    await state.update();

    // expect pre-existing listener to hit
    expect(mock).toBeCalledTimes(3);
  })

  it('will call on create by default', async () => {
    class Test extends Model {}

    const didCreate = jest.fn();
    const test = Test.create();

    test.effect(didCreate, []);
    
    expect(didCreate).toBeCalled();
  })

  it('will callback on willDestroy by default', async () => {
    class Test extends Model {}

    const willDestroy = jest.fn();
    const test = Test.create();

    test.effect(() => willDestroy, []);
    test.destroy();

    expect(willDestroy).toBeCalled();
  })

  it('will cancel destroy callback', async () => {
    class Test extends Model {}

    const willDestroy = jest.fn();
    const test = Test.create();

    const cancel =
      test.effect(() => willDestroy, []);

    cancel();
    test.destroy();

    expect(willDestroy).not.toBeCalled();
  })
})

describe("subscriber", () => {
  class TestValues extends Model {
    value1 = 1;
    value2 = 2;
    value3 = 3;
    value4 = from(this, $ => $.value3 + 1);
  }

  it('will watch values via arrow function', async () => {
    const state = TestValues.create();
    const mock = jest.fn();

    state.effect(self => {
      // destructure values to indicate access.
      const { value1, value2, value3 } = self;
      void value1, value2, value3;
      mock();
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
    expect(mock).toBeCalledTimes(4);
  })

  it('will watch values from method', async () => {
    const state = TestValues.create();
    const mock = jest.fn();

    function testEffect(this: TestValues){
      // destructure values to indicate access.
      const { value1, value2, value3 } = this;
      void value1, value2, value3;
      mock();

    }

    state.effect(testEffect);
  
    state.value1 = 2;
    await state.update();

    state.value2 = 3;
    await state.update();

    state.value2 = 4;
    state.value3 = 4;
    await state.update();

    expect(mock).toBeCalledTimes(4);
  })

  it('will squash simultaneous updates', async () => {
    const state = TestValues.create();
    const mock = jest.fn();

    state.effect(self => {
      void self.value1
      void self.value2;
      mock();
    });
  
    state.value1 = 2;
    state.value2 = 3;

    await state.update()
    
    // expect two syncronous groups of updates.
    expect(mock).toBeCalledTimes(2)
  })

  it('will squash simultaneous compute', async () => {
    const state = TestValues.create();
    const mock = jest.fn();

    state.effect(self => {
      void self.value3;
      void self.value4;
      mock();
    });
  
    state.value3 = 4;

    await state.update()
    
    // expect two syncronous groups of updates.
    expect(mock).toBeCalledTimes(2)
  })

  it('will register before ready', async () => {
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

    state.value3++;
    await state.update();

    expect(mock).toBeCalledTimes(3);
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