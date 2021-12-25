import { from, Model } from './adapter';

describe("on method", () => {
  class Subject extends Model {
    seconds = 0;
    hours = 0;

    minutes = from(this, state => {
      return Math.floor(state.seconds / 60)
    })
  }
  
  it('will watch for specified value', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on("seconds", callback);

    state.seconds = 30;
    await state.update();
  
    expect(callback).toBeCalledWith(30, "seconds");
  })

  it('will watch for computed value', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on("minutes", callback);

    state.seconds = 60;
    await state.update();
  
    expect(callback).toBeCalledWith(1, "minutes");
  })

  it('will compute pending value early', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on("minutes", callback);

    state.seconds = 60;
    await state.update();
  
    expect(callback).toBeCalledWith(1, "minutes");
  })
  
  it('will watch for multiple values', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on(["seconds", "minutes"], callback);

    state.seconds = 30;
    await state.update();
  
    // sanity check
    expect(callback).toBeCalledWith(30, "seconds");
    expect(callback).not.toBeCalledWith(expect.anything, "minutes");

    state.seconds = 61;
    await state.update();
  
    expect(callback).toBeCalledWith(61, "seconds");
    expect(callback).toBeCalledWith(1, "minutes");
  })
  
  it('will watch for any value', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on([], callback);

    state.seconds = 30;
    await state.update();
  
    expect(callback).toBeCalledWith(30, "seconds");
    expect(callback).not.toBeCalledWith(expect.anything, "minutes");

    state.seconds = 61;
    await state.update();
  
    expect(callback).toBeCalledWith(61, "seconds");
    expect(callback).toBeCalledWith(1, "minutes");
  })
  
  it('will watch for any (synthetic) value', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on([], callback);

    await state.update("seconds");
  
    expect(callback).toBeCalledWith(0, "seconds");
    expect(callback).not.toBeCalledWith(expect.anything, "minutes");

    await state.update("minutes");
  
    expect(callback).toBeCalledWith(0, "minutes");
    expect(callback).not.toBeCalledWith(expect.anything, "seconds");
  })

  it('will watch values with selector', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on(x => x.seconds, callback);

    state.seconds = 30;
    await state.update();
  
    expect(callback).toBeCalledWith(30, "seconds");
  })

  it('will watch multiple keys', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.on(x => x.seconds.hours, callback);

    state.seconds = 30;
    await state.update();

    expect(callback).toBeCalledTimes(1);
    expect(callback).toBeCalledWith(30, "seconds");

    state.hours = 2;
    await state.update();

    expect(callback).toBeCalledWith(2, "hours");
  })

  it('will call for all simultaneous', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.on(x => x.minutes.seconds, callback);

    state.seconds = 60;
    await state.update();

    expect(callback).toBeCalledWith(60, "seconds");
    expect(callback).toBeCalledWith(1, "minutes");
  })

  it('will call once for simultaneous in squash-mode', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.on(x => x.seconds.minutes, callback, true);

    state.seconds = 60;
    await state.update();

    expect(callback).toBeCalledWith(["seconds", "minutes"]);
  })
})

describe("once method", () => {
  class Subject extends Model {
    seconds = 0;
    hours = 0;

    minutes = from(this, state => {
      return Math.floor(state.seconds / 60)
    })
  }

  it('will ignore subsequent events', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.once(x => x.seconds, callback);

    state.seconds = 30;
    await state.update();

    expect(callback).toBeCalledWith(30, "seconds");

    state.seconds = 45;
    await state.update();

    expect(callback).not.toBeCalledWith(45, "seconds");
  })

  it('will return promise with update keys', async () => {
    const state = Subject.create();
    const pending = state.once(x => x.seconds);

    state.seconds = 30;

    const updated = await pending;

    expect(updated).toMatchObject(["seconds"]);
  })

  it('will call for all simultaneous', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.once(x => x.seconds.minutes, callback);

    state.seconds = 60;
    await state.update();

    expect(callback).toBeCalledWith(60, "seconds");
    expect(callback).toBeCalledWith(1, "minutes");

    state.seconds = 61;
    await state.update();

    expect(callback).not.toBeCalledWith(61, "seconds");
  })
})

describe("update method", () => {
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
})

describe("will accept before ready", () => {
  class TestValues extends Model {
    value1 = 1;
    value2 = 2;

    value3 = from(this, state => {
      return state.value2 + 1;
    });
  }

  it('on method', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.on("value1", mock);
      }
    }

    const mock = jest.fn();
    const state = Test.create();

    state.value1++;
    await state.update();

    expect(mock).toBeCalled();
  })

  it('on method with getter', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.on("value3", mock);
      }
    }
    
    const mock = jest.fn();
    const state = Test.create();

    state.value2++;
    await state.update();

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
    const state = Test.create();

    state.value1++;
    await state.update();

    expect(mock).toBeCalled();
  })

  it('on method using cancel', async () => {
    class Test extends TestValues {
      cancel = this.on("value1", mock);
    }

    const mock = jest.fn();
    const state = Test.create();

    state.value1++;
    await state.update(true);
    expect(mock).toBeCalledTimes(1);

    state.value1++;
    await state.update(true);
    expect(mock).toBeCalledTimes(2);

    state.cancel();

    state.value1++;
    await state.update(true);
    expect(mock).toBeCalledTimes(2);
  })
});