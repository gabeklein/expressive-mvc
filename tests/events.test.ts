import { Controller } from "./adapter";

describe("observers", () => {
  class Subject extends Controller {
    seconds = 0;
  
    get minutes(){
      return Math.floor(this.seconds / 60)
    }
  }
  
  it('will dispatch changes to observer', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on("seconds", callback);
    state.seconds = 30;
  
    await state.requestUpdate();
  
    expect(callback).toBeCalledWith(30, "seconds");
  })
  
  it('will dispatch changes to computed value', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on("minutes", callback);
    state.seconds = 60;

    await state.requestUpdate();
  
    expect(callback).toBeCalledWith(1, "minutes");
  })
})

describe("effect", () => {
  class TestValues extends Controller {
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

describe("requests made before init", () => {
  class TestValues extends Controller {
    value1 = 1;
    value2 = 2;
  
    get value3(){
      return this.value2 + 1;
    }
  }

  it('effect method', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.effect(mock, ["value1", "value3"]);
      }
    }

    const mock = jest.fn();
    const instance = Test.create();

    instance.value1++;
    await instance.requestUpdate();

    expect(mock).toBeCalled();

    instance.value2++;
    await instance.requestUpdate();

    // expect pre-existing listener to hit
    expect(mock).toBeCalledTimes(2);
  })

  it('effect method with selector', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        // @ts-ignore
        this.effect(mock, x => x.value1.value3);
      }
    }

    const mock = jest.fn();
    const instance = Test.create();

    instance.value1++;
    await instance.requestUpdate();

    expect(mock).toBeCalled();

    instance.value2++;
    await instance.requestUpdate();

    // expect pre-existing listener to hit
    expect(mock).toBeCalledTimes(2);
  })

  it('effect method with subscription', async () => {
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
    const instance = Test.create();

    // runs immediately to aquire subscription
    expect(mock).toBeCalled();

    instance.value1++;
    await instance.requestUpdate();

    expect(mock).toBeCalledTimes(2);

    instance.value2++;
    await instance.requestUpdate();

    expect(mock).toBeCalledTimes(3);
  })

  it('on method', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        // @ts-ignore
        this.on("value1", mock);
      }
    }

    const mock = jest.fn();
    const instance = Test.create();

    instance.value1++;
    await instance.requestUpdate();

    expect(mock).toBeCalled();
  })

  it('on method with getter', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        // @ts-ignore
        this.on("value3", mock);
      }
    }
    
    const mock = jest.fn();
    const instance = Test.create();

    instance.value2++;
    await instance.requestUpdate();

    expect(mock).toBeCalled();
  })

  it('on method with selector', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.on(x => x.value1, mock);
      }
    }
    
    const mock = jest.fn();
    const instance = Test.create();

    instance.value1++;
    await instance.requestUpdate();

    expect(mock).toBeCalled();
  })
});