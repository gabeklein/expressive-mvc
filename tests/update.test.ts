import { from, Model } from "../src";

describe("assertion", () => {
  class Control extends Model {
    foo = 1;
    bar = 2;
    baz = from(this, state => {
      return state.bar + 1;
    });
  }

  it("provides promise resolving on next update", async () => {
    const control = Control.create();

    control.foo = 2;
    await control.update();

    control.bar = 3;
    await control.update();
  })

  it("resolves to keys next update", async () => {
    const control = Control.create();

    control.foo = 2;

    const updated = await control.update();
    expect(updated).toMatchObject(["foo"]);
  })

  it('resolves immediately when no updates pending', async () => {
    const control = Control.create();
    const update = await control.update(false);

    expect(update).toBe(false);
  })

  it('rejects if no update pending in strict mode', async () => {
    const control = Control.create();
    const update = control.update(true);

    await expect(update).rejects.toThrowError();
  })

  it("includes getters in batch which trigger them", async () => {
    const control = Control.create();

    // we must evaluate baz because it can't be
    // subscribed to without this happening atleast once. 
    expect(control.baz).toBe(3);

    control.bar = 3;

    const update = await control.update();

    expect(update).toMatchObject(["bar", "baz"]);
  })
})

describe("dispatch", () => {
  class Test extends Model {
    foo = "foo";
    bar = "bar";

    method = jest.fn();
    methodString = jest.fn((argument: string) => {
      this.foo = argument;
    });
  }

  it("will send synthetic event", async () => {
    const test = Test.create();
    test.update("foo");

    const update = await test.update(true);
    expect(update).toContain("foo");
  })

  it("will squash updates which exist", async () => {
    const test = Test.create();

    test.foo = "bar";
    test.update("foo");

    const update = await test.update(true);
    expect(update).toContain("foo");
  })

  it("will send arbitrary event", async () => {
    const test = Test.create();
    test.update("foobar");

    const update = await test.update(true);
    expect(update).toContain("foobar");
  })

  it("will resolve after event is handled", async () => {
    const test = Test.create();
    const update = await test.update("foo");

    expect(update).toContain("foo");
  })

  it("will resolve with keys already in frame", async () => {
    const test = Test.create();
    test.bar = "foo";

    const update = await test.update("foo");
    expect(update).toMatchObject(["bar", "foo"]);
  })

  it("will call function of same name", async () => {
    const test = Test.create();
    await test.update("method", true);
    expect(test.method).toBeCalled();
  })

  it("will not call function if false", async () => {
    const test = Test.create();
    await test.update("method", false);
    expect(test.method).not.toBeCalled();
  })

  it("will call function with argument", async () => {
    const test = Test.create();
    await test.update("methodString", "foobar");
    expect(test.methodString).toBeCalledWith("foobar");
  })

  it.todo("will set value to argument if not a function");

  it("will throw if callback is undefined", async () => {
    const test = Test.create();
    const attempt = () => {
      // @ts-ignore
      test.update("foo").then();
    }

    expect(attempt).toThrowError();
  })

  it("will include caused-by-method updates", async () => {
    const test = Test.create();
    const updates = await test.update("methodString", "foobar");

    expect(test.methodString).toBeCalledWith("foobar");
    expect(test.foo).toBe("foobar");
    expect(updates).toMatchObject(["methodString", "foo"])
  })
})