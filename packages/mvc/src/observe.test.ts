import { get } from './instruction/get';
import { ref } from './instruction/ref';
import { use } from './instruction/use';
import { Model } from './model';

describe("get", () => {
  it.todo("will handle recursive get");

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

    it("will export values recursively", () => {
      class Nested extends Model {
        foo = 1;
        bar = 2;
        baz = 3;
      }
      
      class Test extends Model {
        foo = "foo";
        bar = "bar";
        baz = "baz";

        nested = use(Nested);
      }

      const test = Test.new();
      const exported = test.get();

      // We want a copy, not the original.
      expect(exported.nested).not.toBeInstanceOf(Nested);

      expect(exported).toEqual({
        foo: "foo",
        bar: "bar",
        baz: "baz",
        nested: {
          foo: 1,
          bar: 2,
          baz: 3
        }
      })
    })
  })

  describe("listener", () => {
    it('will callback for value', async () => {
      class Subject extends Model {
        seconds = 0;
      }

      const state = Subject.new();
      const callback = jest.fn();

      state.get("seconds", callback);

      // will call back immediately with current value
      expect(callback).toBeCalledWith(0, []);

      state.seconds = 30;
      await expect(state).toUpdate();

      expect(callback).toBeCalledWith(30, { seconds: 30 });
      expect(callback).toBeCalledTimes(2);
    })

    it('will callback for computed value', async () => {
      class Subject extends Model {
        seconds = 0;
        minutes = get(this, $ => Math.floor($.seconds / 60))
      }
    
      const state = Subject.new();
      const callback = jest.fn<void, [number]>();

      state.get("minutes", callback);

      expect(callback).toBeCalledWith(0, []);

      state.seconds = 60;
      await expect(state).toUpdate();

      expect(callback).toBeCalledWith(1, { seconds: 60, minutes: 1 });
      expect(callback).toBeCalledTimes(2);
    })

    it('will compute pending value early', async () => {
      class Subject extends Model {
        seconds = 0;
        minutes = get(this, $ => Math.floor($.seconds / 60))
      }

      const state = Subject.new();
      const callback = jest.fn<void, [number]>();

      state.get("minutes", callback);

      expect(callback).toBeCalledWith(0, []);

      state.seconds = 60;
      await expect(state).toUpdate();

      expect(callback).toBeCalledWith(1, { seconds: 60, minutes: 1 });
      expect(callback).toBeCalledTimes(2);
    })
  })
})

describe("set", () => {
  it("will assign values", async () => {
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

    const test = Test.new();

    expect(test.foo).toBe(0);
    expect(test.bar).toBe(1);

    test.set(values);

    await expect(test).toHaveUpdated("foo", "bar");

    expect(test.foo).toBe(1);
    expect(test.bar).toBe(2);
  });

  describe("timeout", () => {
    it('will reject if not pending', async () => {
      const control = Model.new();
      const update = control.set(0);

      await expect(update).rejects.toBe(0);
    })

    it('will reject on timeout', async () => {
      const state = Model.new();
      const update = state.set(1);

      await expect(update).rejects.toBe(1);
    })

    it("will resolve promise made after assignment", async () => {
      class Test extends Model {
        foo = 0;
        bar = 1;
      }
    
      const control = Test.new();

      control.foo = 2;
      await control.set(0);

      control.bar = 3;
      await control.set(0);
    })

    it("will resolve promise made before assignment", async () => {
      class Test extends Model {
        foo = 0;
      }

      const control = Test.new();
      const update = control.set(0);

      control.foo = 2;

      await expect(update).resolves.toEqual({ foo: 2 });
    })

    it("will not call test on update if satisfied", async () => {
      class Test extends Model {
        foo = 0;
        bar = 1;
        baz = 2;
      }

      const control = Test.new();
      const test = jest.fn((key: string) => key === "bar");
      const update = control.set(0, test);

      control.foo = 2;
      control.bar = 3;
      control.baz = 4;

      expect(test).toBeCalledWith("foo", 2);
      expect(test).toBeCalledWith("bar", 3);
      expect(test).not.toBeCalledWith("baz", 4);

      await expect(update).resolves.toEqual({ foo: 2, bar: 3, baz: 4 });
    })

    it("will still timeout if test returns false", async () => {
      class Test extends Model {
        foo = 0;
      }

      const control = Test.new();
      const test = jest.fn(() => false);
      const update = control.set(0, test);

      control.foo = 2;

      expect(test).toBeCalledWith("foo", 2);
      await expect(update).rejects.toBe(0);
    })
  })

  describe("effect", () => {
    class Test extends Model {
      foo = 0;
      bar = 1;
      baz = 2;
    }

    it('will call every update', async () => {
      const test = Test.new();
      const mock = jest.fn();

      const done = test.set(mock);

      test.foo = 1;
      test.foo = 2;
      test.bar = 2;

      expect(mock).toBeCalledWith("foo", 1);
      expect(mock).toBeCalledWith("foo", 2);
      expect(mock).toBeCalledWith("bar", 2);

      done();
    })

    it("will callback after frame", async () => {
      const test = Test.new();
      const didUpdate = jest.fn<any, [string, unknown]>(() => didUpdateAsync);
      const didUpdateAsync = jest.fn();
      
      const done = test.set(didUpdate);

      test.foo = 1;
      test.bar = 2;

      expect(didUpdate).toBeCalledTimes(2);
      expect(didUpdateAsync).not.toBeCalled();

      await expect(test).toUpdate();

      expect(didUpdateAsync).toBeCalledTimes(1);

      done();
    })

    it('will not activate Model prematurely', () => {
      class Test extends Model {
        foo = 0;

        constructor(){
          super();
          this.set(callback)
        }
      }

      class Subject extends Test {
        bar = 1;
      }

      const callback = jest.fn();
      const subject = Subject.new();

      subject.bar = 2;

      expect(callback).toBeCalledWith("bar", 2);
    })
  })
})