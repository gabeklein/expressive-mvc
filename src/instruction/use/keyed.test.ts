import { Model } from '../..';
import { get } from '../get';
import { use } from './use';

describe("Map", () => {
  class Test extends Model {
    map = use(new Map());
  }

  it("will update on set", async () => {
    const test = Test.create();
    const mock = jest.fn();

    test.map.set("foo", "foo");
  
    test.effect($ => {
      mock($.map.get("foo"));
    });

    expect(mock).toBeCalledWith("foo");
  
    test.map.set("foo", "bar");
    await test.update(true);
  
    expect(mock).toBeCalledTimes(2);
    expect(mock).toBeCalledWith("bar");
  })
})

for(const T of [Map, Set])
  describe(T, () => {
    class Test extends Model {
      values = use(T === Map ? new Map() : new Set());
      size = get(this, $ => $.values.size);

      insert = (key: any) => {
        const { values } = this;

        if(T === Map)
          (values as Map<any, any>).set(key, key);
        else
          (values as Set<any>).add(key);
      }
    }
    
    it("will update on add", async () => {
      const test = Test.create();
      const mock = jest.fn();
    
      test.effect(($) => {
        mock($.values.has("foo"));
      })
    
      expect(mock).toBeCalledWith(false);
    
      test.insert("foo");
      await test.update(true);
    
      expect(mock).toBeCalledWith(true);
      test.destroy();
    })
    
    it("will not update for unwatched", async () => {
      const test = Test.create();
      const mock = jest.fn(($: Test) => void $.values.has("foo"));
    
      test.effect(mock);
    
      expect(mock).toBeCalledTimes(1);
  
      test.insert("bar");
      await test.update(true);
    
      expect(mock).toBeCalledTimes(1);
    })
    
    it("will update on delete", async () => {
      const test = Test.create();
      const mock = jest.fn(($: Test) => void $.values.has("foo"));
    
      test.effect(mock);
    
      test.insert("foo");
      await test.update(true);
    
      test.values.delete("foo");
      await test.update(true);
    
      expect(mock).toBeCalledTimes(3);
    })
    
    it("will update on clear", async () => {
      const test = Test.create();
      const mock = jest.fn(($: Test) => void $.values.has("foo"));
    
      test.effect(mock)
    
      test.values.clear();
      await test.update(true);
    
      expect(mock).toBeCalledTimes(2);
    })
    
    it("will update any key where iterated", async () => {
      const test = Test.create();
    
      const mockIterator = jest.fn(({ values }: Test) => void [...values]);
      const mockValues = jest.fn(({ values }: Test) => void values.values());
      const mockKeys = jest.fn(({ values }: Test) => void values.keys());
      const mockEntries = jest.fn(({ values }: Test) => void values.entries());
    
      test.effect(mockIterator);
      test.effect(mockEntries);
      test.effect(mockValues);
      test.effect(mockKeys);
    
      test.insert("foo");
      await test.update(true);
    
      expect(mockIterator).toBeCalledTimes(2);
      expect(mockEntries).toBeCalledTimes(2);
      expect(mockValues).toBeCalledTimes(2);
      expect(mockKeys).toBeCalledTimes(2);
    })
    
    it("will update any key where not accessed", () => {
      const test = Test.create();
      const mock = jest.fn(($: Test) => void $.values);
    
      test.effect(mock);
    })
    
    it("will update any key on replacement", async () => {
      const test = Test.create();
      const mock = jest.fn(($: Test) => void $.values.has("foo"));
    
      test.effect(mock);

      test.values = new Set();
      await test.update(true);
    
      expect(mock).toBeCalledTimes(2);
    })
    
    it("will squash multiple updates", async () => {
      const test = Test.create();
      const mock = jest.fn((state: Test) => {
        state.values.has("foo");
        state.values.has("bar");
      });
    
      test.effect(mock);
    
      test.insert("foo");
      test.insert("bar");
      await test.update(true);
    
      expect(mock).toBeCalledTimes(2);
    })
    
    it("will spread multiple updates", async () => {
      const test = Test.create();
      const mock1 = jest.fn(($: Test) => void $.values.has(1));
      const mock2 = jest.fn(($: Test) => void $.values.has(2));
      const mock3 = jest.fn(($: Test) => void $.values.has(3));
    
      test.effect(mock1);
      test.effect(mock2);
      test.effect(mock3);
    
      test.insert(1);
      test.insert(2);
      test.insert(3);
    
      await test.update();
    
      expect(mock1).toBeCalledTimes(2);
      expect(mock2).toBeCalledTimes(2);
      expect(mock3).toBeCalledTimes(2);
    })
    
    it("will allow normal methods outside proxy", () => {
      const test = Test.create();
    
      test.insert("foo");
      expect(test.values.has("foo")).toBe(true);
    })
    
    it("will not update a stopped subscriber", async () => {
      const test = Test.create();
      const mock1 = jest.fn(($: Test) => void $.values);
      const mock2 = jest.fn(($: Test) => void $.values);
    
      const release1 = test.effect(mock1);
      const release2 = test.effect(mock2);
    
      expect(mock1).toBeCalledTimes(1);
      expect(mock2).toBeCalledTimes(1);
    
      test.values = new Set();
      await test.update(true);
    
      expect(mock1).toBeCalledTimes(2);
      expect(mock2).toBeCalledTimes(2);
    
      release1();
      test.values = new Set();
      await test.update(true);
    
      expect(mock1).toBeCalledTimes(2);
      expect(mock2).toBeCalledTimes(3);
    
      release2();
    })

    it("will update size for any change", async () => {
      const test = Test.create();
      const mock = jest.fn();
    
      test.effect($ => {
        mock($.values.size);
      })
    
      expect(mock).toBeCalledWith(0);
    
      test.insert("foo");
      await test.update(true);
    
      expect(mock).toBeCalledWith(1);
    })
  
    it("will update size on replacement", async () => {
      const test = Test.create();
      const mock = jest.fn();
    
      test.effect($ => {
        mock($.values.size);
      })
    
      expect(mock).toBeCalledWith(0);
    
      test.values = new Set(["foo", "bar"])
      await test.update(true);
    
      expect(mock).toBeCalledWith(2);
    })
    
    it("will update computed for used keys", async () => {
      const test = Test.create();
      const mock = jest.fn();
    
      test.effect($ => mock($.size));
    
      expect(mock).toBeCalledWith(0);
    
      test.insert("foo");
      await test.update(true);
    
      expect(mock).toBeCalledTimes(2)
      expect(mock).toBeCalledWith(1);
    })
    
    it("will update computed for used keys only", async () => {
      class Test extends Model {
        values = use(new Set());
        size = get(this, $ => $.values.has("bar"));
      }
    
      const test = Test.create();
      const mock = jest.fn();
    
      test.effect($ => mock($.size));
    
      expect(mock).toBeCalledWith(false);
    
      test.values.add("foo");
      await test.update(true);
  
      expect(mock).toBeCalledTimes(1);
    })
  })