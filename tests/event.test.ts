import { get } from '../src/instruction/get';
import { Model, Oops } from '../src/model';

class Subject extends Model {
  seconds = 0;
  hours = 0;

  minutes = get(this, state => {
    return Math.floor(state.seconds / 60)
  })
}

describe("on single", () => {
  it('will watch for specified value', async () => {
    const state = Subject.new();
    const callback = jest.fn();

    state.on("seconds", callback);

    state.seconds = 30;
    await state.update();

    expect(callback).toBeCalledWith(30, "seconds");
  })

  it('will watch for computed value', async () => {
    const state = Subject.new();
    const callback = jest.fn();

    state.on("minutes", callback);

    state.seconds = 60;
    await state.update();

    expect(callback).toBeCalledWith(1, "minutes");
  })

  it('will compute pending value early', async () => {
    const state = Subject.new();
    const callback = jest.fn();

    state.on("minutes", callback);

    state.seconds = 60;
    await state.update();

    expect(callback).toBeCalledWith(1, "minutes");
  })

  it('will ignore subsequent events in once mode', async () => {
    const state = Subject.new();
    const callback = jest.fn();

    state.on("seconds", callback, true);

    state.seconds = 30;
    await state.update();

    expect(callback).toBeCalledWith(30, "seconds");

    state.seconds = 45;
    await state.update();

    expect(callback).not.toBeCalledWith(45, "seconds");
  })
})

describe("on multiple", () => {
  it('will watch all if empty', async () => {
    const state = Subject.new();
    const callback = jest.fn();

    state.on([], callback);

    state.seconds = 30;
    await state.update();

    expect(callback).toBeCalledWith(["seconds"]);
    expect(callback).not.toBeCalledWith(["minutes"]);

    state.seconds = 61;
    await state.update();

    expect(callback).toBeCalledWith(["seconds", "minutes"]);
  })

  it('will watch for synthetic if empty', async () => {
    const state = Subject.new();
    const callback = jest.fn();

    state.on([], callback);

    await state.update("seconds");

    expect(callback).toBeCalledWith(["seconds"]);

    await state.update("minutes");

    expect(callback).toBeCalledWith(["minutes"]);
  })

  it('will watch multiple keys', async () => {
    const state = Subject.new();
    const callback = jest.fn();

    state.on(["seconds", "hours"], callback);

    state.seconds = 30;
    await state.update();

    expect(callback).toBeCalledTimes(1);
    expect(callback).toBeCalledWith(["seconds"]);

    state.hours = 2;
    await state.update();

    expect(callback).toBeCalledWith(["hours"]);
  })

  it('will halt in once mode', async () => {
    const state = Subject.new();
    const callback = jest.fn();

    state.on(["seconds", "minutes"], callback, true);

    state.seconds = 60;
    await state.update();

    expect(callback).toBeCalledWith(["seconds", "minutes"]);

    state.seconds = 61;
    await state.update();

    expect(callback).toBeCalledTimes(1);
  })

  it('will call once for simultaneous in squash-mode', async () => {
    const state = Subject.new();
    const callback = jest.fn();

    state.on(["seconds", "minutes"], callback, true);

    state.seconds = 60;
    await state.update();

    expect(callback).toBeCalledWith(["seconds", "minutes"]);
  })
})

describe("on promise", () => {
  it('will return with update value', async () => {
    const state = Subject.new();
    const pending = state.on("seconds");

    state.seconds = 30;

    await expect(pending).resolves.toBe(30);
  })

  it('will return with updated updates', async () => {
    const state = Subject.new();
    const pending = state.on(["seconds"]);

    state.seconds = 30;

    await expect(pending).resolves.toEqual(["seconds"]);
  })

  it('will reject on timeout', async () => {
    const state = Subject.new();
    const promise = state.on("seconds", 0);
    const expected = Oops.Timeout(["seconds"], "0ms");

    await expect(promise).rejects.toThrow(expected);
  })

  it('will reject on destroy state', async () => {
    const state = Subject.new();
    const promise = state.on("seconds");
    const expected = Oops.Timeout(["seconds"], `lifetime of ${state}`);

    state.kill();

    await expect(promise).rejects.toThrow(expected);
  })
})

describe("on callback", () => {
  it('will call immediately in raw event mode', async () => {
    const state = Subject.new();
    const callback = jest.fn();

    state.on(key => callback(key));

    state.seconds = 30;

    expect(callback).toBeCalledWith("seconds");
  })

  it('will call request for raw event', async () => {
    const state = Subject.new();
    const callback = jest.fn();

    state.on(key => () => callback(key));

    state.seconds = 30;

    expect(callback).not.toBeCalledWith("seconds")

    await state.update();

    expect(callback).toBeCalledWith("seconds")
  })

  it('will call for computed as raw event', async () => {
    const state = Subject.new();
    const onImmediate = jest.fn();
    const onFrame = jest.fn();

    state.on(key => {
      onImmediate(key);
      return () => onFrame(key);
    });

    void state.minutes;
    state.seconds = 60;

    await state.update();

    expect(onImmediate).toBeCalledWith("minutes");
    expect(onFrame).toBeCalledWith("minutes");
  })
})

describe("before ready", () => {
  class TestValues extends Model {
    value1 = 1;
    value2 = 2;

    value3 = get(this, state => {
      return state.value2 + 1;
    });
  }

  it('will watch value', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.on("value1", mock);
      }
    }

    const mock = jest.fn();
    const state = Test.new();

    state.value1++;
    await state.update();

    expect(mock).toBeCalled();
  })

  it('will watch computed value', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.on("value3", mock);
      }
    }

    const mock = jest.fn();
    const state = Test.new();

    state.value2++;
    await state.update();

    expect(mock).toBeCalled();
  })

  it('will return callback to remove listener', async () => {
    class Test extends Model {
      value = 1;
    }

    const mock = jest.fn();
    const test = Test.new();
    const done = test.on("value", mock);

    test.value++;
    await test.update(true);
    expect(mock).toBeCalledTimes(1);

    test.value++;
    await test.update(true);
    expect(mock).toBeCalledTimes(2);

    done();

    test.value++;
    await test.update(true);
    expect(mock).toBeCalledTimes(2);
  })
});