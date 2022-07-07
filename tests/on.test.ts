import { get, Model } from '../src';

describe("on method", () => {
  class Subject extends Model {
    seconds = 0;
    hours = 0;

    minutes = get(this, state => {
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

  it('will watch multiple keys', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.on(["seconds", "hours"], callback);

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

    state.on(["seconds", "minutes"], callback);

    state.seconds = 60;
    await state.update();

    expect(callback).toBeCalledWith(60, "seconds");
    expect(callback).toBeCalledWith(1, "minutes");
  })

  it('will call once for simultaneous in squash-mode', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.on(["seconds", "minutes"], callback, true);

    state.seconds = 60;
    await state.update();

    expect(callback).toBeCalledWith(["seconds", "minutes"]);
  })

  it('will call immediately in raw event mode', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.on(key => callback(key));

    state.seconds = 30;

    expect(callback).toBeCalledWith("seconds");
  })

  it('will call request for raw event', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.on(key => () => callback(key));

    state.seconds = 30;

    expect(callback).not.toBeCalledWith("seconds")

    await state.update();

    expect(callback).toBeCalledWith("seconds")
  })

  it('will call for computed as raw event', async () => {
    const state = Subject.create();
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