import VC from "./adapter";

describe("observers", () => {
  class Subject extends VC {
    seconds = 0;
  
    get minutes(){
      return Math.floor(this.seconds / 60)
    }
  }
  
  it('dispatches changes to observer', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on("seconds", callback);
    state.seconds = 30;
  
    await state.requestUpdate();
  
    expect(callback).toBeCalledWith(30, "seconds");
  })
  
  it('dispatches changes to computed value', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on("minutes", callback);
    state.seconds = 60;

    await state.requestUpdate();
  
    expect(callback).toBeCalledWith(1, "minutes");
  })
})

describe("effect", () => {
  class TestValues extends VC {
    value1 = 1;
    value2 = 2;
    value3 = 3;
  
    get value4(){
      return this.value3 + 1;
    }
  }

  it('will watch values', async () => {
    const instance = TestValues.create();
    const mock = jest.fn();
  
    instance.effect(mock, [
      "value1",
      "value2",
      "value3",
      "value4",
    ]);
  
    instance.value1 = 2;

    // wait for update event, thus queue flushed
    await instance.requestUpdate()
    
    instance.value2 = 3;
    instance.value3 = 4;

    // wait for update event to flush queue
    await instance.requestUpdate()
    
    // expect two syncronous groups of updates.
    expect(mock).toBeCalledTimes(2)
  })

  it('will watch values selected via function', async () => {
    const instance = TestValues.create();
    const mock = jest.fn();
  
    instance.effect(mock,
      $ => $.value1.value2.value3.value4
    );
  
    instance.value1 = 2;
    instance.value2 = 3;

    await instance.requestUpdate();

    instance.value3 = 4;

    // expect value4, which relies on 3.
    await instance.requestUpdate();
    
    expect(mock).toBeCalledTimes(2);
  })

  it('will reinvoke self-subscribed effect', async () => {
    const instance = TestValues.create();
    let invokedNTimes = 0;
  
    instance.effect(self => {
      // destructure values to indicate access.
      const { value1, value2, value3 } = self;
      void value1, value2, value3;
      invokedNTimes++;
    });
  
    instance.value1 = 2;
    await instance.requestUpdate();

    instance.value2 = 3;
    await instance.requestUpdate();

    instance.value2 = 4;
    instance.value3 = 4;
    await instance.requestUpdate();
  
    /**
     * must invoke once to detect subscription
     * 
     * invokes three more times:
     * - value 1
     * - value 2
     * - value 2 & 3 (squashed since syncronous)
     */
    expect(invokedNTimes).toBe(4);
  })
});

describe("requests before initialized", () => {
  class TestValues extends VC {
    constructor(mock: () => void){
      super();
      this.effect(mock, [
        "value1",
        "value3"
      ]);
    }

    value1 = 1;
    value2 = 2;
  
    get value3(){
      return this.value2 + 1;
    }
  }

  it('will watch values proactively', async () => {
    const mock = jest.fn();
    const instance = TestValues.create([mock]);

    instance.value1++;
    await instance.requestUpdate();

    expect(mock).toBeCalledTimes(1);

    instance.value2++;
    await instance.requestUpdate();

    // value2 shouldn't trigger anything
    // value3 is not yet initialized
    expect(mock).toBeCalledTimes(1);

    // pull value3, now will be watched
    instance.value3;

    instance.value2++;
    await instance.requestUpdate();

    // expect pre-existing listener to hit
    expect(mock).toBeCalledTimes(2);
  })
});