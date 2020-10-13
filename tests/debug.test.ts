import Controller from "./adapter";

describe("requestUpdate method", () => {
  class Control extends Controller {
    foo = 1;
    bar = 2;

    get baz(){
      return this.bar + this.foo;
    }
  }

  let control: Control;

  beforeEach(() => {
    control = Control.create();
  })

  it("provides promise resolving next update", async () => {
    // actual update is async so this should work
    control.foo = 2;
    await control.requestUpdate();
    
    control.bar = 3;
    await control.requestUpdate();
  })
  
  it("runs callback on next update", async () => {
    const mock = jest.fn();

    const update = control.requestUpdate();
    control.requestUpdate(mock);

    control.foo = 2;

    await update;
    expect(mock).toHaveBeenCalled();
  })

  it("includes getters in batch which trigger them", async () => {
    // we must evaluate baz because it can't be
    // subscribed to without this happening anyway. 
    expect(control.baz).toBe(3);

    control.foo = 2;
    const updated = await control.requestUpdate();
    expect(updated).toMatchObject(["foo", "baz"]);
  })
})