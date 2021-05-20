import { Controller } from "./adapter";

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

  it("resolves keys next update involved", async () => {
    const control = Control.create();

    control.foo = 2;

    const updated = control.requestUpdate();
    await expect(updated).resolves.toMatchObject(["foo"]);
  })

  it('resolves immediately when no updates pending', async () => {
    const control = Control.create();
    const update = control.requestUpdate();

    await expect(update).resolves.toBe(false);
  })

  it('resolves false after timeout when provided', async () => {
    let resolved = false;

    const control = Control.create();
    const check = control.requestUpdate(100);

    // forked-then, intercepts resolve
    check.then(() => resolved = true);

    // wait until just before update
    await new Promise(res => setTimeout(res, 99));

    // check intercept didn't resolve yet
    expect(resolved).toBe(false);

    // wait for the expected timeout
    await expect(check).resolves.toBe(false);

    // check intercept resolved, for good measure
    expect(resolved).toBe(true);
  })

  it('rejects if no update pending in strict mode', async () => {
    const control = Control.create();
    const update = control.requestUpdate(true);
    
    await expect(update).rejects.toBeInstanceOf(Error);
  })

  it('rejects if update not expected in strict mode', async () => {
    const control = Control.create();

    control.foo = 2;

    const update = control.requestUpdate(false);
    
    await expect(update).rejects.toBeInstanceOf(Error);
  })

  it("includes getters in batch which trigger them", async () => {
    const control = Control.create();

    // we must evaluate baz because it can't be
    // subscribed to without this happening atleast once. 
    expect(control.baz).toBe(3);

    control.bar = 3;

    const update = control.requestUpdate();

    await expect(update).resolves.toMatchObject(["bar", "baz"]);
  })
})