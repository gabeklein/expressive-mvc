import { Model } from '../src/model';

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
    const test = Test.new();
    test.update("foo");

    const update = await test.on(true);
    expect(update).toContain("foo");
  })

  it("will squash updates which exist", async () => {
    const test = Test.new();

    test.foo = "bar";
    test.update("foo");

    const update = await test.on(true);
    expect(update).toContain("foo");
  })

  it("will send arbitrary event", async () => {
    const test = Test.new();
    test.update("foobar");

    const update = await test.on(true);
    expect(update).toContain("foobar");
  })

  it("will resolve after event is handled", async () => {
    const test = Test.new();
    const update = await test.update("foo");

    expect(update).toContain("foo");
  })

  it("will resolve with keys already in frame", async () => {
    const test = Test.new();
    test.bar = "foo";

    const update = await test.update("foo");
    expect(update).toMatchObject(["bar", "foo"]);
  })

  it("will call function of same name", async () => {
    const test = Test.new();
    await test.update("method", true);
    expect(test.method).toBeCalled();
  })

  it("will not call function if false", async () => {
    const test = Test.new();
    await test.update("method", false);
    expect(test.method).not.toBeCalled();
  })

  it("will call function with argument", async () => {
    const test = Test.new();
    await test.update("methodString", "foobar");
    expect(test.methodString).toBeCalledWith("foobar");
  })

  it.todo("will set value to argument if not a function");

  it("will throw if callback is undefined", async () => {
    const test = Test.new();
    const attempt = () => {
      // @ts-ignore
      test.update("foo").then();
    }

    expect(attempt).toThrowError();
  })

  it("will include caused-by-method updates", async () => {
    const test = Test.new();
    const updates = await test.update("methodString", "foobar");

    expect(test.methodString).toBeCalledWith("foobar");
    expect(test.foo).toBe("foobar");
    expect(updates).toMatchObject(["methodString", "foo"])
  })
})

describe("import", () => {
  class Test extends Model {
    foo = 0;
    bar = 1;
    baz?: number;
  }
  
  const values = {
    foo: 1,
    bar: 2,
    baz: 3
  }
  
  it("will assign values", async () => {
    const test = Test.new();

    expect(test.foo).toBe(0);
    expect(test.bar).toBe(1);

    const keys = await test.update(values);
    expect(keys).toEqual(["foo", "bar"]);

    expect(test.foo).toBe(1);
    expect(test.bar).toBe(2);
  });

  it("will assign specific values", async () => {
    const test = Test.new();
    const keys = await test.update(values, ["foo"]);

    expect(keys).toEqual(["foo"]);

    expect(test.foo).toBe(1);
    expect(test.bar).toBe(1);
  });

  it("will force assign values from source", async () => {
    const test = Test.new();
    const baz = test.on("baz");
    const keys = await test.update(values, true);

    expect(keys).toEqual(["foo", "bar", "baz"]);

    expect(test.foo).toBe(1);
    expect(test.bar).toBe(2);

    // sanity check
    // we didn't set baz - only dispatched it.
    expect(test.baz).toBeUndefined();

    await expect(baz).resolves.toBe(3);
  });
})