import { get } from './instruction/get';
import { Model } from './model';

class Subject extends Model {
  seconds = 0;
  hours = 0;

  minutes = get(this, state => {
    return Math.floor(state.seconds / 60)
  })
}

describe("get", () => {
  describe("single", () => {
    it('will callback for value', async () => {
      const state = Subject.new();
      const callback = jest.fn();

      state.get("seconds", callback);

      state.seconds = 30;
      await expect(state).toUpdate();

      expect(callback).toBeCalledWith(30, ["seconds"]);
    })

    it('will callback for computed value', async () => {
      const state = Subject.new();
      const callback = jest.fn<void, [number]>();

      state.get("minutes", callback);

      state.seconds = 60;
      await expect(state).toUpdate();

      expect(callback).toBeCalledWith(1, ["seconds", "minutes"]);
    })

    it.skip('will callback when destroyed', () => {
      const state = Subject.new();
      const callback = jest.fn();

      state.get("seconds", callback);

      state.null();

      expect(callback).toBeCalledWith(null);
    })

    it('will compute pending value early', async () => {
      const state = Subject.new();
      const callback = jest.fn<void, [number]>();

      state.get("minutes", callback);

      state.seconds = 60;
      await expect(state).toUpdate();

      expect(callback).toBeCalled();
    })

    it('will ignore subsequent in once mode', async () => {
      const state = Subject.new();
      const callback = jest.fn<void, [number]>();

      state.get("seconds", callback, true);

      state.seconds = 30;
      await expect(state).toUpdate();

      expect(callback).toBeCalledWith(30, ["seconds"]);

      state.seconds = 45;
      await expect(state).toUpdate();

      expect(callback).toBeCalledTimes(1);
    })
  })

  describe("multiple", () => {
    it('will watch multiple values', async () => {
      const state = Subject.new();
      const callback = jest.fn<void, [
        { hours: number; seconds: number },
        string[]
      ]>();

      state.get(["seconds", "hours"], callback);

      state.seconds = 30;
      await expect(state).toUpdate();

      expect(callback).toBeCalledTimes(1);
      expect(callback).toBeCalledWith({
        "hours": 0,
        "seconds": 30
      }, ["seconds"]);

      state.hours = 2;
      await expect(state).toUpdate();

      expect(callback).toBeCalledWith({
        "hours": 2,
        "seconds": 30
      }, ["hours"]);
    })

    it('will ignore subsequent in once mode', async () => {
      const state = Subject.new();
      const callback = jest.fn();

      state.get(["seconds", "minutes"], callback, true);

      state.seconds = 60;
      await expect(state).toUpdate();

      expect(callback).toBeCalledWith({
        "minutes": 1,
        "seconds": 60
      }, [
        "seconds",
        "minutes"
      ]);

      state.seconds = 61;
      await expect(state).toUpdate();

      expect(callback).toBeCalledTimes(1);
    })
  });

  describe("before ready", () => {
    it('will watch value', async () => {
      class Test extends Model {
        value1 = 1;

        constructor(){
          super();
          this.get(state => mock(state.value1));
        }
      }

      const mock = jest.fn();
      const state = Test.new();

      state.value1++;
      await expect(state).toUpdate();

      expect(mock).toBeCalledTimes(2);
    })

    it('will watch computed value', async () => {
      class Test extends Model {
        value1 = 2;

        value2 = get(this, $ => {
          return $.value1 + 1;
        });
        
        constructor(){
          super();
          this.get(state => mock(state.value2));
        }
      }

      const mock = jest.fn();
      const state = Test.new();

      state.value1++;
      await expect(state).toUpdate();

      expect(mock).toBeCalled();
    })

    it('will remove listener on callback', async () => {
      class Test extends Model {
        value = 1;

        // assigned during constructor phase.
        done = this.get(state => mock(state.value));
      }

      const mock = jest.fn();
      const test = Test.new();

      test.value++;
      await expect(test).toUpdate();
      expect(mock).toBeCalledTimes(2);

      test.value++;
      await expect(test).toUpdate();
      expect(mock).toBeCalledTimes(3);

      test.done();

      test.value++;
      await expect(test).toUpdate();
      expect(mock).toBeCalledTimes(3);
    })
  });
})

describe("set", () => {
  class Control extends Model {
    foo = 1;
    bar = 2;
    baz = get(this, state => {
      return state.bar + 1;
    });
  }

  it("will resolve update after assignment", async () => {
    const control = Control.new();

    control.foo = 2;
    await control.set();

    control.bar = 3;
    await control.set();
  })

  it("will resolve update before assignment", async () => {
    const control = Control.new();
    const update = control.set();

    control.foo = 2;

    await expect(update).resolves.toEqual(["foo"]);
  })

  it("will resolve to keys next update", async () => {
    const control = Control.new();

    control.foo = 2;

    const updated = await control.set(0);
    expect(updated).toMatchObject(["foo"]);
  })

  it('will resolve false if not pending', async () => {
    const control = Control.new();
    const update = await control.set(0);

    expect(update).toBe(false);
  })

  it('will resolve false on timeout', async () => {
    const state = Subject.new();
    const update = await state.set(1);

    expect(update).toBe(false);
  })

  it("will include getters in batch which trigger them", async () => {
    const control = Control.new();

    // we must evaluate baz because it can't be
    // subscribed to without this happening atleast once. 
    expect(control.baz).toBe(3);

    control.bar = 3;

    const update = await control.set();

    expect(update).toMatchObject(["bar", "baz"]);
  })
})
