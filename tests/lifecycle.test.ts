import { Controller } from "./adapter";

describe("declare method", () => {
  class Sample extends Controller {
    constructor(
      public didSomething?: Function
    ){
      super();
    }
  }

  it("emits update with given name", async () => {
    const test = Sample.create();

    test.declare("didSomething");

    const update = await test.requestUpdate(true);
    
    expect(update).toMatchObject(["didSomething"]);
  })
  
  it("calls function matching event if exists", () => {
    const mock = jest.fn();
    const test = Sample.create(mock);

    test.declare("didSomething");
    
    expect(mock).toHaveBeenCalled();
  })
  
  it("will pass arguments to event handler", () => {
    const mock = jest.fn();
    const test = Sample.create(mock);

    test.declare("didSomething", ["foo", "bar"]);
    
    expect(mock).toHaveBeenCalledWith("foo", "bar");
  })
})