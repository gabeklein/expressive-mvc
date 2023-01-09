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

  it('will callback on death if empty', async () => {
    const state = Subject.new();
    const callback = jest.fn();

    state.on([], callback);

    state.seconds = 30;
    await state.update();

    expect(callback).not.toBeCalled();

    state.kill();

    expect(callback).toBeCalledWith([]);
  })
});

describe("on null", () => {
  it('will resolve immediately', async () => {
    const state = Subject.new();
    const update = await state.on(null);

    expect(update).toEqual(null);
  })

  it('will reject immediately if update', async () => {
    const state = Subject.new();
    const expected = Oops.StrictNoUpdate();

    state.seconds = 61;
    
    const update = state.on(null);
    await expect(update).rejects.toThrow(expected);
  })
})

describe("on promise", () => {
  it('will resolve with update value', async () => {
    const state = Subject.new();
    const pending = state.on("seconds");

    state.seconds = 30;

    await expect(pending).resolves.toBe(30);
  })

  it('will resolve with updated keys', async () => {
    const state = Subject.new();
    const pending = state.on(["seconds"]);

    state.seconds = 30;

    await expect(pending).resolves.toEqual(["seconds"]);
  })

  it('will resolve any updated', async () => {
    const state = Subject.new();

    state.seconds = 61;

    const update = await state.on();

    // should this also expect minutes?
    expect(update).toEqual(["seconds"]);
  })

  it('will resolve any updated expected', async () => {
    const state = Subject.new();

    state.seconds = 61;

    const update = await state.on(true);

    // should this also expect minutes?
    expect(update).toEqual(["seconds"]);
  })

  it('will resolve on destroy', async () => {
    const state = Subject.new();
    const update = state.on([]);

    state.kill();

    await expect(update).resolves.toEqual([]);
  })

  it('will reject on required update', async () => {
    const state = Subject.new();
    const promise = state.on(true);
    const expected = Oops.StrictUpdate();

    await expect(promise).rejects.toThrow(expected);
  })
})

describe("timeout", () => {
  it('will reject on required key', async () => {
    const state = Subject.new();
    const promise = state.on("seconds", 0);
    const expected = Oops.KeysExpected("seconds");

    await expect(promise).rejects.toThrow(expected);
  })

  it('will reject', async () => {
    const state = Subject.new();
    const promise = state.on("seconds", 1);
    const expected = Oops.Timeout("seconds", "1ms");

    await expect(promise).rejects.toThrow(expected);
  })

  it('will reject multiple keys', async () => {
    const state = Subject.new();
    const promise = state.on(["seconds", "minutes"], 1);
    const expected = Oops.Timeout("seconds, minutes", "1ms");

    await expect(promise).rejects.toThrow(expected);
  })

  it('will reject undefined', async () => {
    const state = Subject.new();
    const promise = state.on(undefined, 1);
    const expected = Oops.Timeout("any", "1ms");

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

      // assigned during constructor phase.
      done = this.on("value", mock);
    }

    const mock = jest.fn();
    const test = Test.new();

    test.value++;
    await test.update(true);
    expect(mock).toBeCalledTimes(1);

    test.value++;
    await test.update(true);
    expect(mock).toBeCalledTimes(2);

    test.done();

    test.value++;
    await test.update(true);
    expect(mock).toBeCalledTimes(2);
  })
});