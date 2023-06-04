import { ref } from './instruction/ref';
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
  describe("export", () => {
    class Test extends Model {
      foo = "foo"
      bar = "bar"
      baz = "baz"
    }

    it("will export single value", () => {
      const test = Test.new();
      const value = test.get("foo");
  
      expect(value).toBe("foo");
    })
    
    it('will export "current" of property', async () => {
      class Test extends Model {
        foo = ref<string>();
      }
  
      const test = Test.new();
  
      expect(test.get("foo")).toBeUndefined();
  
      test.foo("foobar");
      await expect(test).toUpdate();
  
      expect(test.get("foo")).toBe("foobar");
    })
    
    it("will export all values", () => {
      const test = Test.new();
      const values = test.get();
  
      expect(values).toEqual({
        foo: "foo",
        bar: "bar",
        baz: "baz"
      })
    })
    
    it("will export selected values", () => {
      const test = Test.new();
      const values = test.get(["foo", "bar"]);
  
      expect(values).toEqual({
        foo: "foo",
        bar: "bar"
      })
    })
  })

  describe("listener", () => {
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
  })
})

describe("set", () => {
  describe("assign", () => {
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
  
      test.set(values);
  
      await expect(test).toHaveUpdated(["foo", "bar"]);
  
      expect(test.foo).toBe(1);
      expect(test.bar).toBe(2);
    });
  
    it("will assign specific values", async () => {
      const test = Test.new();
      
      test.set(values, ["foo"]);
  
      await expect(test).toHaveUpdated(["foo"]);
  
      expect(test.foo).toBe(1);
      expect(test.bar).toBe(1);
    });

    it("will assign to exotic value", async () => {
      class Test extends Model {
        foo = ref<string>();
      }
  
      const test = Test.new();
  
      await test.set("foo", "bar");
      expect(test.foo.current).toBe("bar");
    })
  })
  
  describe("detect", () => {
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
})
