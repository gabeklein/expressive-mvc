import { Model } from "./adapter";

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

it("will send synthetic event using selector", async () => {
  const test = Test.create();
  test.update(x => x.foo);
  
  const update = await test.update(true);
  expect(update).toContain("foo");
})

it("will resolve after event is handled", async () => {
  const test = Test.create();
  const update = await test.update(x => x.foo);

  expect(update).toContain("foo");
})

it("will resolve with keys already in frame", async () => {
  const test = Test.create();
  test.bar = "foo";

  const update = await test.update(x => x.foo);
  expect(update).toMatchObject(["bar", "foo"]);
})

it("will call function of same name", async () => {
  const test = Test.create();
  await test.update("method", true);
  expect(test.method).toBeCalled();
})

it("will call function via selector", async () => {
  const test = Test.create();
  await test.update(x => x.method, true);
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

it("will call function via selector with argument", async () => {
  const test = Test.create();
  await test.update(x => x.methodString, "foobar");
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