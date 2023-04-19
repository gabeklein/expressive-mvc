import { Oops } from './effect';
import { get } from './instruction/get';
import { set } from './instruction/set';
import { Model } from './model';

describe("explicit", () => {
  class TestValues extends Model {
    value1 = 1;
    value2 = 2;
    value3 = 3;
    value4 = get(this, $ => $.value3 + 1);
  }

  it('will watch values', async () => {
    const state = TestValues.new();
    const mock = jest.fn();

    state.on(mock, [
      "value1",
      "value2",
      "value3",
      "value4",
    ]);

    state.value1 = 2;

    // wait for update event, thus queue flushed
    await state.on()

    state.value2 = 3;
    state.value3 = 4;

    // wait for update event to flush queue
    await state.on()

    // expect two syncronous groups of updates.
    expect(mock).toBeCalledTimes(3)
  })

  it("will update for nested values", async () => {
    class Nested extends Model {
      value = "foo";
    }
  
    class Test extends Model {
      nested = new Nested();
    }
  
    const test = Test.new();
    const effect = jest.fn((state: Test) => {
      void state.nested.value;
    });
  
    test.on(effect);
  
    expect(effect).toBeCalledTimes(1);
    test.nested.value = "bar";
  
    await expect(test.nested).toUpdate();
    
    expect(effect).toBeCalledTimes(2);
  })

  it('will squash simultaneous updates', async () => {
    const state = TestValues.new();
    const mock = jest.fn();

    state.on(mock, ["value1", "value2"]);

    state.value1 = 2;
    state.value2 = 3;

    await state.on()

    // expect two syncronous groups of updates.
    expect(mock).toBeCalledTimes(2)
  })

  it('will squash simultaneous compute update', async () => {
    const state = TestValues.new();
    const mock = jest.fn();

    state.on(mock, ["value3", "value4"]);

    state.value3 = 4;

    await state.on()

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

    const state = Test.new();
    const mock = jest.fn();

    state.on(state.testEffect, ["value1"]);

    expect(mock).not.toBeCalled();

    state.value1 = 2;
    await state.on();

    expect(mock).toBeCalled();
  })

  it('will register before ready', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.on(mock, ["value1", "value3"]);
      }
    }

    const mock = jest.fn();
    const state = Test.new();

    state.value1++;
    await state.on();

    expect(mock).toBeCalled();

    state.value3++;
    await state.on();

    // expect pre-existing listener to hit
    expect(mock).toBeCalledTimes(3);
  })

  it('will call on create by default', async () => {
    class Test extends Model {}

    const didCreate = jest.fn();
    const test = Test.new();

    test.on(didCreate, []);

    expect(didCreate).toBeCalled();
  })

  it("will bind to model called upon", () => {
    class Test extends Model {}

    function testEffect(this: Test){
      didCreate(this);
    }

    const didCreate = jest.fn();
    const test = Test.new();

    test.on(testEffect, []);

    expect(didCreate).toBeCalledWith(test);
  })

  it('will callback on willDestroy by default', async () => {
    class Test extends Model {}

    const willDestroy = jest.fn();
    const test = Test.new();

    test.on(() => willDestroy, []);
    test.gc();

    expect(willDestroy).toBeCalled();
  })

  it('will cancel destroy callback', async () => {
    class Test extends Model {}

    const willDestroy = jest.fn();
    const test = Test.new();
    const cancel = test.on(() => willDestroy, []);

    cancel();
    test.gc();

    expect(willDestroy).not.toBeCalled();
  })
})

describe("implicit", () => {
  class TestValues extends Model {
    value1 = 1;
    value2 = 2;
    value3 = 3;
    value4 = get(this, $ => $.value3 + 1);
  }

  it('will watch values via arrow function', async () => {
    const state = TestValues.new();
    const mock = jest.fn();

    state.on(self => {
      // destructure values to indicate access.
      const { value1, value2, value3 } = self;
      void value1, value2, value3;
      mock();
    });

    state.value1 = 2;
    await state.on();

    state.value2 = 3;
    await state.on();

    state.value2 = 4;
    state.value3 = 4;
    await state.on();

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
    const state = TestValues.new();
    const mock = jest.fn();

    function testEffect(this: TestValues){
      // destructure values to indicate access.
      const { value1, value2, value3 } = this;
      void value1, value2, value3;
      mock();

    }

    state.on(testEffect);

    state.value1 = 2;
    await state.on();

    state.value2 = 3;
    await state.on();

    state.value2 = 4;
    state.value3 = 4;
    await state.on();

    expect(mock).toBeCalledTimes(4);
  })

  it('will squash simultaneous updates', async () => {
    const state = TestValues.new();
    const mock = jest.fn();

    state.on(self => {
      void self.value1
      void self.value2;
      mock();
    });

    state.value1 = 2;
    state.value2 = 3;

    await state.on()

    // expect two syncronous groups of updates.
    expect(mock).toBeCalledTimes(2)
  })

  it('will squash simultaneous compute', async () => {
    const state = TestValues.new();
    const mock = jest.fn();

    state.on(self => {
      void self.value3;
      void self.value4;
      mock();
    });

    state.value3 = 4;

    await state.on()

    // expect two syncronous groups of updates.
    expect(mock).toBeCalledTimes(2)
  })

  it('will register before ready', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.on(this.test);
      }

      test(){
        void this.value1;
        void this.value3;
        mock();
      }
    }

    const mock = jest.fn();
    const state = Test.new();

    // runs immediately to aquire subscription
    expect(mock).toBeCalled();

    state.value1++;
    await state.on();

    expect(mock).toBeCalledTimes(2);

    state.value3++;
    await state.on();

    expect(mock).toBeCalledTimes(3);
  })

  it("will throw if.on returns non-function", () => {
    const state = TestValues.new();
    const expected = Oops.BadCallback();
    const attempt = () => {
      // @ts-ignore
      state.on(() => "foobar");
    }

    expect(attempt).toThrowError(expected);
  })

  it("will not throw if.on returns promise", () => {
    const state = TestValues.new();
    const attempt = () => {
      state.on(async () => {});
    }

    expect(attempt).not.toThrowError();
  })
});

describe("suspense", () => {
  class Test extends Model {
    value = set<string>();
    other = "foo";
  }

  it("will retry", async () => {
    const test = Test.new();
    const didTry = jest.fn();
    const didInvoke = jest.fn();

    test.on($ => {
      didTry();
      didInvoke($.value);
    });

    expect(didTry).toBeCalled();
    expect(didInvoke).not.toBeCalled();

    test.value = "foobar";

    await test.on();
    expect(didInvoke).toBeCalledWith("foobar");
  })

  it("will still subscribe", async () => {
    const test = Test.new();
    const didTry = jest.fn();
    const didInvoke = jest.fn();

    test.on($ => {
      didTry();
      didInvoke($.value);
    });

    test.value = "foo";

    await test.on();
    expect(didInvoke).toBeCalledWith("foo");

    test.value = "bar";

    await test.on();
    expect(didInvoke).toBeCalledWith("bar");
    expect(didTry).toBeCalledTimes(3);
  })

  it("will not update while pending", async () => {
    const test = Test.new();
    const didTry = jest.fn();
    const didInvoke = jest.fn();

    test.on($ => {
      didTry();
      didInvoke($.value);
    }, ["value", "other"]);

    expect(didTry).toBeCalledTimes(1);

    test.other = "bar";

    await test.on();
    expect(didTry).toBeCalledTimes(1);

    test.value = "foo";

    await test.on();
    expect(didInvoke).toBeCalledWith("foo");
    expect(didTry).toBeCalledTimes(2);
  })
})