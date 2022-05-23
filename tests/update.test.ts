import { Model } from "../src";

describe("basics", () => {
  class Subject extends Model {
    value = 1;
  }

  it('will update when a value changes', async () => {
    const state = Subject.create();
    
    expect(state.value).toBe(1);

    state.value = 2
    await state.update(true);

    expect(state.value).toBe(2);
  })

  it('will not update if value is same', async () => {
    const state = Subject.create();
    
    expect(state.value).toBe(1);

    state.value = 1
    await state.update(false);
  })
  
  it('accepts update from within a method', async () => {
    class Subject extends Model {
      value = 1;
    
      setValue = (to: number) => {
        this.value = to;
      }
    }

    const state = Subject.create();
    
    state.setValue(3);
    await state.update(true);

    expect(state.value).toBe(3)
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