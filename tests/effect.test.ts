import Controller from "./adapter";

class TestValues extends Controller {
  value1 = 1;
  value2 = 2;
  value3 = 3;

  get value4(){
    return this.value3 + 1;
  }
}

describe("effect", () => {
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
  
    instance.effect( 
      mock, x => (x
        .value1
        .value2
        .value3
        .value4
      )
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