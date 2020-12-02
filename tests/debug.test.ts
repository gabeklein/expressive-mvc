import Controller from "./adapter";

describe("requestUpdate method", () => {
  class Control extends Controller {
    foo = 1;
    bar = 2;

    get baz(){
      return this.bar + 1;
    }
  }

  it("provides promise resolving next update", async () => {
    const control = Control.create();
    
    // actual update is async so this should work
    control.foo = 2;
    await control.requestUpdate();
    
    control.bar = 3;
    await control.requestUpdate();
  })
  
  it("runs callback for next update emitted", async () => {
    const control = Control.create();
    const mock = jest.fn();

    control.requestUpdate(mock);
    control.bar = 3;

    await control.requestUpdate();
    expect(mock).toHaveBeenCalled();
  })

  it("resolves keys next updates involved", async () => {
    const control = Control.create();

    control.foo = 2;

    const updated = await control.requestUpdate();
    expect(updated).toMatchObject(["foo"]);
  })

  it('resolves immediately when no updates pending', async () => {
    const control = Control.create();
    const update = await control.requestUpdate();

    expect(update).toBe(false);
  })

  it('rejects immediately in strict mode', async () => {
    const control = Control.create();
    const update = await control
      .requestUpdate(true)
      .catch((e) => e);

    expect(update).toBeInstanceOf(Error);
  })

  it("includes getters in batch which trigger them", async () => {
    const control = Control.create();

    // we must evaluate baz because it can't be
    // subscribed to without this happening atleast once. 
    expect(control.baz).toBe(3);

    control.bar = 3;

    const updated = await control.requestUpdate();
    expect(updated).toMatchObject(["bar", "baz"]);
  })
})