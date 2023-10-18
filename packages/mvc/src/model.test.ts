import { get } from './instruction/get';
import { set } from './instruction/set';
import { use } from './instruction/use';
import { ref } from './instruction/ref';
import { Model } from './model';
import { mockError } from './mocks';

describe("model", () => {
  class Subject extends Model {
    value = 1;
  }

  it('will instantiate from custom class', () => {
    const state = Subject.new();

    expect(state.value).toBe(1);
  })

  it('will enumerate properties', () => {
    class Test extends Subject {
      /* value is inherited */
      value2 = 2;
      method = () => {};
    }

    const state = Test.new();
    const keys = Object.keys(state);

    expect(keys).toEqual([
      "value",
      "value2",
      "method"
    ]);
  });

  it('will send arguments to constructor', () => {
    class Test extends Model {
      constructor(public value: number){
        super();
      }
    }

    const test = Test.new(3);

    expect(test.value).toBe(3);
  })

  it("will ignore getters and setters", () => {
    class Test extends Model {
      foo = "foo";

      get bar(){
        return "bar";
      }

      set baz(value: string){
        this.foo = value;
      }
    }

    const test = Test.new();

    expect(test.bar).toBe("bar");
    expect(test.get()).not.toContain("bar");
  })

  it('will update when a value changes', async () => {
    const state = Subject.new();

    expect(state.value).toBe(1);

    state.value = 2
    await expect(state).toHaveUpdated();

    expect(state.value).toBe(2);
  })

  it('will not update if value is same', async () => {
    const state = Subject.new();

    expect(state.value).toBe(1);

    state.value = 1
    await expect(state).not.toHaveUpdated();
  })

  it('accepts update from within a method', async () => {
    class Subject extends Model {
      value = 1;

      setValue = (to: number) => {
        this.value = to;
      }
    }

    const state = Subject.new();

    state.setValue(3);
    await expect(state).toHaveUpdated();

    expect(state.value).toBe(3)
  })

  it('will watch function properties', async () => {
    const mockFunction = jest.fn();
    const mockFunction2 = jest.fn();
    
    class Test extends Model {
      fn = mockFunction;
    }

    const test = Test.new();

    test.get(state => {
      state.fn();
    });

    expect(mockFunction).toBeCalled();

    test.fn = mockFunction2;

    await expect(test).toHaveUpdated();

    expect(mockFunction2).toBeCalled();
    expect(mockFunction).toBeCalledTimes(1);
  });

  it('will iterate over properties', () => {
    class Test extends Model {
      foo = 1;
      bar = 2;
      baz = 3;
    }

    const test = Test.new();
    const mock = jest.fn<void, [string, unknown]>();

    for(const [key, value] of test)
      mock(key, value);

    expect(mock).toBeCalledWith("foo", 1)
    expect(mock).toBeCalledWith("bar", 2)
    expect(mock).toBeCalledWith("baz", 3)
  })

  it('will call null on all children', () => {
    class Nested extends Model {}
    class Test extends Model {
      nested = use(Nested);
    }

    const test = Test.new();
    const destroyed = jest.fn();

    test.nested.get(() => destroyed);
    test.set(null);

    expect(destroyed).toBeCalled();
  });
})

describe("subscriber", () => {
  class Subject extends Model {
    value = 1;
    value2 = 2;
  }

  it('will detect change to properties accessed', async () => {
    const state = Subject.new();
    const effect = jest.fn(($: Subject) => {
      void $.value;
      void $.value2;
    })

    state.get(effect);

    state.value = 2;
    await expect(state).toHaveUpdated();

    state.value2 = 3;
    await expect(state).toHaveUpdated();

    expect(effect).toBeCalledTimes(3);
  })

  it('will ignore change to property not accessed', async () => {
    const state = Subject.new();
    const effect = jest.fn(($: Subject) => {
      void $.value;
    })

    state.get(effect);

    state.value = 2;
    await expect(state).toHaveUpdated();

    state.value2 = 3;
    await expect(state).toHaveUpdated();

    /**
     * we did not access value2 in above accessor,
     * subscriber assumes we don't care about updates
     * to this property, so it'l drop relevant events
     */ 
    expect(effect).toBeCalledTimes(2);
  });

  it('will not obstruct set-behavior', () => {
    class Test extends Model {
      didSet = jest.fn();
      value = set("foo", this.didSet);
    }

    const test = Test.new();

    expect(test.value).toBe("foo");

    test.get(effect => {
      effect.value = "bar";
    })

    expect(test.value).toBe("bar");
    expect(test.didSet).toBeCalledWith("bar", "foo");
  })
})

describe("get method", () => {
  describe("export", () => {
    class Test extends Model {
      foo = "foo"
      bar = "bar"
      baz = "baz"
    }

    it("will export all values", () => {
      const test = Test.new();
      const values = test.get();

      expect(values).toEqual({
        foo: "foo",
        bar: "bar",
        baz: "baz"
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

    it("will export infinite loop", () => {
      class Parent extends Model {
        child = use(Child);
        foo = "foo";
      }

      class Child extends Model {
        parent = get(Parent);
        bar = "bar";
      }

      const parent = Parent.new();
      const exported = parent.get();

      expect(exported.child.parent).toBe(exported);
    })
  })

  describe("effect", () => {
    class Test extends Model {
      value1 = 1;
      value2 = 2;
      value3 = 3;
      value4 = get(this, $ => $.value3 + 1);
    }

    it('will watch values', async () => {
      const test = Test.new();
      const mock = jest.fn();

      test.get(state => {
        void state.value1;
        void state.value2;
        void state.value3;
        void state.value4;
        mock();
      });

      test.value1 = 2;

      // wait for update event, thus queue flushed
      await expect(test).toHaveUpdated();

      test.value2 = 3;
      test.value3 = 4;

      // wait for update event to flush queue
      await expect(test).toHaveUpdated();

      // expect two syncronous groups of updates.
      expect(mock).toBeCalledTimes(3)
    })

    it("will update for nested values", async () => {
      class Nested extends Model {
        value = "foo";
      }

      class Test extends Model {
        nested = use(Nested);
      }

      const test = Test.new();
      const effect = jest.fn((state: Test) => {
        void state.nested.value;
      });

      test.get(effect);

      expect(effect).toBeCalledTimes(1);
      test.nested.value = "bar";

      await expect(test.nested).toHaveUpdated();

      expect(effect).toBeCalledTimes(2);
    })

    it("will not update for removed children", async () => {
      class Nested extends Model {
        value = 1;
      }

      class Test extends Model {
        nested = use(Nested);
      }

      const test = Test.new();
      const effect = jest.fn((state: Test) => {
        void state.nested.value;
      });

      test.get(effect);
      expect(effect).toBeCalledTimes(1);

      test.nested.value++;
      await expect(test.nested).toHaveUpdated();
      expect(effect).toBeCalledTimes(2);

      const old = test.nested;

      test.nested = Nested.new();
      await expect(test).toHaveUpdated();
      // Updates because nested property is new.
      expect(effect).toBeCalledTimes(3);

      old.value++;
      await expect(old).toHaveUpdated();
      // Should not update on new event from previous.
      expect(effect).toBeCalledTimes(3);
    })

    it('will squash simultaneous updates', async () => {
      const test = Test.new();
      const mock = jest.fn();

      test.get(state => {
        void state.value1;
        void state.value2;
        mock();
      });

      test.value1 = 2;
      test.value2 = 3;

      await expect(test).toHaveUpdated();

      // expect two syncronous groups of updates.
      expect(mock).toBeCalledTimes(2)
    })

    it('will squash simultaneous compute update', async () => {
      const test = Test.new();
      const mock = jest.fn();

      test.get(state => {
        void state.value3;
        void state.value4;
        mock();
      });

      test.value3 = 4;

      await expect(test).toHaveUpdated();

      // expect two syncronous groups of updates.
      expect(mock).toBeCalledTimes(2)
    })

    it("will call return-function on subsequent update", async () => {
      class Test extends Model {
        value1 = 1;

        testEffect() {
          void this.value1;
          return mock;
        }
      }

      const state = Test.new();
      const mock = jest.fn();

      state.get(state.testEffect);

      expect(mock).not.toBeCalled();

      state.value1 = 2;
      await expect(state).toHaveUpdated();

      expect(mock).toBeCalled();
      expect(mock).toBeCalledWith(true);
    })

    it('will register before ready', async () => {
      class Test2 extends Test {
        constructor() {
          super();
          this.get(state => {
            void state.value1;
            void state.value3;
            mock();
          });
        }
      }

      const mock = jest.fn();
      const state = Test2.new();

      state.value1++;
      await expect(state).toHaveUpdated();

      expect(mock).toBeCalled();

      state.value3++;
      await expect(state).toHaveUpdated();

      // expect pre-existing listener to hit
      expect(mock).toBeCalledTimes(3);
    })

    it('will call immediately', async () => {
      const testEffect = jest.fn();
      const test = Test.new();

      test.get(testEffect);

      expect(testEffect).toBeCalled();
    })

    it("will bind to model called upon", () => {
      class Test extends Model {}

      function testEffect(this: Test) {
        didCreate(this);
      }

      const didCreate = jest.fn();
      const test = Test.new();

      test.get(testEffect);

      expect(didCreate).toBeCalledWith(test);
    })

    it('will callback on null event', async () => {
      const willDestroy = jest.fn();
      const test = Test.new();

      test.get(() => willDestroy);
      test.set(null);

      expect(willDestroy).toBeCalledWith(null);
    })

    it('will cancel effect on callback', async () => {
      const test = Test.new();
      const mock = jest.fn();
      const didEffect = jest.fn((test: Test) => {
        void test.value1;
        return mock;
      });

      const done = test.get(didEffect);

      test.value1 += 1;

      await expect(test).toHaveUpdated();
      expect(didEffect).toBeCalledTimes(2);

      mock.mockReset();

      done();

      expect(mock).toBeCalledWith(false);

      test.value1 += 1;
      await expect(test).toHaveUpdated();

      expect(didEffect).toBeCalledTimes(2);
    })

    it('will cancel effect if returns null', async () => {
      const test = Test.new();
      const didEffect = jest.fn((test: Test) => {
        void test.value1;
        return null;
      });

      test.get(didEffect);

      test.value1 += 1;
      await expect(test).toHaveUpdated();

      expect(didEffect).toBeCalledTimes(1);
    })

    it('will cancel if returns null after callback', async () => {
      const test = Test.new();
      const cleanup = jest.fn();

      let callback: (() => void) | null = cleanup;

      const didEffect = jest.fn((test: Test) => {
        void test.value1;
        return callback;
      });

      test.get(didEffect);

      callback = null;
      test.value1 += 1;
      await expect(test).toHaveUpdated();

      expect(didEffect).toBeCalledTimes(2);

      test.value1 += 1;
      await expect(test).toHaveUpdated();

      expect(didEffect).toBeCalledTimes(2);
      expect(cleanup).toBeCalledTimes(1);
    })

    it('will watch values via arrow function', async () => {
      const state = Test.new();
      const mock = jest.fn();

      state.get(state => {
        // destructure values to indicate access.
        const { value1, value2, value3 } = state;
        void value1, value2, value3;
        mock();
      });

      state.value1 = 2;
      await expect(state).toHaveUpdated();

      state.value2 = 3;
      await expect(state).toHaveUpdated();

      state.value2 = 4;
      state.value3 = 4;
      await expect(state).toHaveUpdated();

      /**
       * must invoke once to detect subscription
       * 
       * invokes three more times:
       * - value 1
       * - value 2
       * - value 2 & 3 (squashed)
       */
      expect(mock).toBeCalledTimes(4);
    })

    it('will watch values from method', async () => {
      const state = Test.new();
      const mock = jest.fn();

      function testEffect(this: Test) {
        // destructure values to indicate access.
        const { value1, value2, value3 } = this;
        void value1, value2, value3;
        mock();

      }

      state.get(testEffect);

      state.value1 = 2;
      await expect(state).toHaveUpdated();

      state.value2 = 3;
      await expect(state).toHaveUpdated();

      state.value2 = 4;
      state.value3 = 4;
      await expect(state).toHaveUpdated();

      expect(mock).toBeCalledTimes(4);
    })

    it('will squash simultaneous updates', async () => {
      const state = Test.new();
      const mock = jest.fn();

      state.get(state => {
        void state.value1
        void state.value2;
        mock();
      });

      state.value1 = 2;
      state.value2 = 3;

      await expect(state).toHaveUpdated();

      // expect two syncronous groups of updates.
      expect(mock).toBeCalledTimes(2)
    })

    it('will squash simultaneous compute', async () => {
      const state = Test.new();
      const mock = jest.fn();

      state.get(state => {
        void state.value3;
        void state.value4;
        mock();
      });

      state.value3 = 4;

      await expect(state).toHaveUpdated();

      // expect two syncronous groups of updates.
      expect(mock).toBeCalledTimes(2)
    })

    it('will register before ready', async () => {
      class Test2 extends Test {
        constructor() {
          super();
          this.get($ => {
            void $.value1;
            void $.value3;
            mock();
          });
        }
      }

      const mock = jest.fn();
      const state = Test2.new();

      // runs immediately to aquire subscription
      expect(mock).toBeCalled();

      state.value1++;
      await expect(state).toHaveUpdated();

      expect(mock).toBeCalledTimes(2);

      state.value3++;
      await expect(state).toHaveUpdated();

      expect(mock).toBeCalledTimes(3);
    })

    it('will initialize without Model.new', async () => {
      const test = new Test();
      const mock = jest.fn();

      test.get(mock);

      expect(mock).not.toBeCalled();

      test.set("EVENT");

      expect(mock).toBeCalled();
    })

    it("will ignore if get returns non-function", () => {
      const state = Test.new();
      const attempt = () => {
        // @ts-expect-error
        state.get(() => "foobar");
      }

      expect(attempt).not.toThrowError();
    })

    it("will not throw if get returns promise", () => {
      const state = Test.new();
      const attempt = () => {
        state.get(async () => { });
      }

      expect(attempt).not.toThrowError();
    })

    describe("suspense", () => {
      class Test extends Model {
        value = set<string>();
        other = "foo";
      }

      it("will retry", async () => {
        const test = Test.new();
        const didTry = jest.fn();
        const didInvoke = jest.fn();

        test.get($ => {
          didTry();
          didInvoke($.value);
        });

        expect(didTry).toBeCalled();
        expect(didInvoke).not.toBeCalled();

        test.value = "foobar";

        await expect(test).toHaveUpdated();
        expect(didInvoke).toBeCalledWith("foobar");
      })

      it("will still subscribe", async () => {
        const test = Test.new();
        const didTry = jest.fn();
        const didInvoke = jest.fn();

        test.get($ => {
          didTry();
          didInvoke($.value);
        });

        test.value = "foo";

        await expect(test).toHaveUpdated();
        expect(didInvoke).toBeCalledWith("foo");

        test.value = "bar";

        await expect(test).toHaveUpdated();
        expect(didInvoke).toBeCalledWith("bar");
        expect(didTry).toBeCalledTimes(3);
      })

      it("will not update while pending", async () => {
        const test = Test.new();
        const willUpdate = jest.fn();
        const didUpdate = jest.fn();

        test.get(state => {
          willUpdate();
          void state.value;
          void state.other;
          didUpdate(state.value);
        });

        expect(willUpdate).toBeCalledTimes(1);

        test.other = "bar";

        await expect(test).toHaveUpdated();
        expect(willUpdate).toBeCalledTimes(1);

        test.value = "foo";

        await expect(test).toHaveUpdated();
        expect(didUpdate).toBeCalledWith("foo");
        expect(willUpdate).toBeCalledTimes(2);
      })
    })

    describe("before ready", () => {
      it('will watch value', async () => {
        class Test extends Model {
          value1 = 1;

          constructor() {
            super();
            this.get(state => mock(state.value1));
          }
        }

        const mock = jest.fn();
        const state = Test.new();

        state.value1++;
        await expect(state).toHaveUpdated();

        expect(mock).toBeCalledTimes(2);
      })

      it('will watch computed value', async () => {
        class Test extends Model {
          value1 = 2;

          value2 = get(this, $ => {
            return $.value1 + 1;
          });

          constructor() {
            super();
            this.get(state => mock(state.value2));
          }
        }

        const mock = jest.fn();
        const state = Test.new();

        state.value1++;
        await expect(state).toHaveUpdated();

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
        await expect(test).toHaveUpdated();
        expect(mock).toBeCalledTimes(2);

        test.value++;
        await expect(test).toHaveUpdated();
        expect(mock).toBeCalledTimes(3);

        test.done();

        test.value++;
        await expect(test).toHaveUpdated();
        expect(mock).toBeCalledTimes(3);
      })
    });

  })

  describe("fetch", () => {
    it("will get value", () => {
      class Test extends Model {
        foo = "foo";
      }

      const test = Test.new();

      expect(test.get("foo")).toBe("foo");
    })

    it("will get ref value", () => {
      class Test extends Model {
        foo = ref<string>();
      }

      const test = Test.new();

      test.foo("foobar");

      expect<ref.Object>(test.foo).toBeInstanceOf(Function);
      expect<string>(test.get("foo")).toBe("foobar");
    })

    it("will throw suspense if not yet available", async () => {
      class Test extends Model {
        foo = set<string>();
      }

      const test = Test.new("ID");
      let suspense;

      try {
        void test.get("foo");
      }
      catch(error){
        expect(error).toBeInstanceOf(Promise);
        expect(String(error)).toMatch("Error: ID.foo is not yet available.");
        suspense = error;
      }

      test.foo = "foobar";
      
      await expect(suspense).resolves.toBe("foobar");
    })

    it("will suspend if undefined in strict mode", async () => {
      class Test extends Model {
        foo?: string = undefined;
      }

      const test = Test.new("ID");
      let suspense;

      try {
        void test.get("foo", true)
      }
      catch(error){
        expect(error).toBeInstanceOf(Promise);
        expect(String(error)).toMatch("Error: ID.foo is not yet available.")
        suspense = error;
      }

      test.foo = "foobar";
      
      await expect(suspense).resolves.toBe("foobar");
    })
  })

  describe("callback", () => {
    class Test extends Model {
      foo = "foo";
    }

    it("will call callback on update", async () => {
      const test = Test.new();
      const mock = jest.fn();

      test.get("foo", mock);

      test.foo = "bar";
      test.foo = "baz";

      expect(mock).toBeCalledWith("bar", "foo", test);
      expect(mock).toBeCalledWith("baz", "foo", test);
    })

    it("will call immediately if defined", () => {
      const test = Test.new();
      const mock = jest.fn();

      test.get("foo", mock);

      expect(mock).toBeCalledWith("foo", "foo", test);
    })

    it("will call on event if not defined", async () => {
      const test = Test.new();
      const mock = jest.fn();

      test.get("baz", mock);

      expect(mock).not.toBeCalled();
      
      // dispatch explicit event
      test.set("baz");

      expect(mock).toBeCalledWith("baz", "baz", test);
    })
  })

  describe("null", () => {
    it("will return true if model is not destroyed", () => {
      const test = Model.new();

      expect(test.get(null)).toBe(false);

      test.set(null);

      expect(test.get(null)).toBe(true);
    })

    it("will callback when model is destroyed", () => {
      const test = Model.new();
      const mock = jest.fn();

      test.get(null, mock);

      expect(mock).not.toBeCalled();

      test.set(null);

      expect(mock).toBeCalled();
    })
  })
})

describe("set method", () => {
  describe("update", () => {
    class Test extends Model {
      foo = "foo";
    }

    it("will update value", async () => {
      const test = Test.new();

      expect(test.foo).toBe("foo");

      test.set("foo", "bar");

      await expect(test).toHaveUpdated("foo");

      expect(test.foo).toBe("bar");
    })

    it("will ignore update with same value", async () => {
      const test = Test.new();

      expect(test.foo).toBe("foo");

      test.set("foo", "foo");

      await expect(test).not.toHaveUpdated();
      
      expect(test.foo).toBe("foo");
    })

    it("will force update", async () => {
      const test = Test.new();

      expect(test.foo).toBe("foo");

      test.set("foo");

      await expect(test).toHaveUpdated("foo");

      expect(test.foo).toBe("foo");
    })

    it("will update for untracked key", async () => {
      const test = Test.new();

      test.set("bar");

      await expect(test).toHaveUpdated("bar");
    });

    it("will update for symbol", async () => {
      const test = Test.new();
      const event = Symbol("event");

      test.set(event);

      await expect(test).toHaveUpdated(event);
    });

    it("will update for number", async () => {
      const test = Test.new();

      test.set(42);

      await expect(test).toHaveUpdated(42);
    });
  });

  describe("promise", () => {
    it("will resolve update frame", async () => {
      class Test extends Model {
        foo = "foo";
      }

      const test = Test.new();

      test.foo = "bar";

      const update = test.set();

      expect(update).toBeInstanceOf(Promise);
      await expect(update).resolves.toEqual(["foo"]);
    })

    it("will resolve with symbols", async () => {
      class Test extends Model {}

      const test = Test.new();
      const event = Symbol("event");

      test.set(event);

      const update = await test.set();

      expect(update).toEqual([event]);
    })

    it("will be undefined if no update", async () => {
      class Test extends Model {
        foo = "foo";
      }

      const test = Test.new();
      const update = test.set();

      expect(update).toBeUndefined();
    })
  })

  describe("callback", () => {
    it("will call callback on update", async () => {
      class Test extends Model {
        foo = "foo";
      }

      const test = Test.new();
      const mock = jest.fn();

      test.set(mock);

      test.foo = "bar";
      test.foo = "baz";

      expect(mock).toBeCalledWith("foo", test);
      expect(mock).toBeCalledWith("foo", test);
    })
  })

  describe("effect", () => {
    const error = mockError();

    class Test extends Model {
      foo = 0;
      bar = 1;
      baz = 2;
    }

    it('will call every update', async () => {
      const test = Test.new();
      const mock = jest.fn();

      const done = test.set((a, b) => {
        mock(a, Object.assign({}, b))
      });

      test.foo = 1;
      test.foo = 2;
      test.bar = 2;

      expect(mock).toBeCalledWith("foo", { foo: 1, bar: 1, baz: 2 });
      expect(mock).toBeCalledWith("foo", { foo: 2, bar: 1, baz: 2 });
      expect(mock).toBeCalledWith("bar", { foo: 2, bar: 2, baz: 2 });

      done();
    })

    it("will callback after frame", async () => {
      const test = Test.new();
      const didUpdate = jest.fn(() => didUpdateAsync);
      const didUpdateAsync = jest.fn();

      const done = test.set(didUpdate);

      test.foo = 1;
      test.bar = 2;

      expect(didUpdate).toBeCalledTimes(2);
      expect(didUpdateAsync).not.toBeCalled();

      await expect(test).toHaveUpdated();

      expect(didUpdateAsync).toBeCalledTimes(1);

      done();
    })

    it("will log error thrown by async callback", async () => {
      const test = Test.new();
      const oops = new Error("oops");

      const done = test.set(() => () => {
        throw oops;
      });

      test.foo = 1;

      await expect(test).toHaveUpdated();
      expect(error).toBeCalledWith(oops);

      done();
    });

    it('will not activate Model prematurely', () => {
      class Test extends Model {
        foo = 0;

        constructor() {
          super();
          this.set(callback)
        }
      }

      class Subject extends Test {
        bar = 1;
      }

      const callback = jest.fn();
      const test = Subject.new();

      test.bar = 2;

      expect(callback).toBeCalledWith("bar", test);
    })

    it('will disallow update if model is destroyed', () => {
      class Test extends Model {
        foo = 0;
      }

      const callback = jest.fn();
      const test = Test.new("ID");

      test.set(callback);
      test.foo++;

      test.set(null);

      expect(() => test.foo++).toThrowError("Tried to update foo but ID is destroyed.");
      expect(callback).toBeCalledTimes(1);
    })

    it.todo("will throw clear error on bad update");
  })
})

describe("is method (static)", () => {
  class Test extends Model {}

  it("will assert if Model extends another", () => {
    class Test2 extends Test {}

    expect(Test.is(Test2)).toBe(true);
  })

  it("will be falsy if not super", () => {
    class NotATest extends Model {}

    expect(Model.is(NotATest)).toBe(true);
    expect(Test.is(NotATest)).toBe(false);
  })
})

describe("on method (static)", () => {
  class Test extends Model {
    foo = "bar";
  }

  it("will run callback on create", () => {
    const mock = jest.fn();
    const done = Test.on(mock);
    const test = Test.new();

    expect(mock).toBeCalledWith(true, test);

    done();
  });

  it("will run on various events", async () => {
    const mock = jest.fn();
    const done = Test.on(mock);
    const test = Test.new();

    test.set("event")
    test.foo = "baz";

    expect(mock).toBeCalledWith("event", test);
    expect(mock).toBeCalledWith("foo", test);

    await test.set();
    expect(mock).toBeCalledWith(false, test);

    test.set(null);
    expect(mock).toBeCalledWith(null, test);

    done();
  })

  it("will run callback for inherited classes", () => {
    class Test2 extends Test {}
    
    const createModel = jest.fn();
    const createTest = jest.fn();
    const createTest2 = jest.fn();

    const done = [
      Test.on(createTest),
      Test2.on(createTest2),
      Model.on(createModel)
    ]

    const test = Test2.new();

    expect(createModel).toBeCalledWith(true, test);
    expect(createTest).toBeCalledWith(true, test);
    expect(createTest2).toBeCalledWith(true, test);

    done.forEach(done => done());
  });

  it("will squash same callback for multiple classes", () => {
    class Test2 extends Test {}
    
    const didCreate = jest.fn();
    const done = [
      Test.on(didCreate),
      Test2.on(didCreate),
      Model.on(didCreate)
    ]

    Test2.new();

    expect(didCreate).toBeCalledTimes(1);

    done.forEach(done => done());
  })

  it("will remove callback", () => {
    const mock = jest.fn();
    const done = Test.on(mock);

    Test.new();
    expect(mock).toBeCalled();
    
    done();

    Test.new();
    expect(mock).toBeCalledTimes(1);
  });

  it("will run callback on event", () => {
    const mock = jest.fn();
    const done = Test.on((key: any, state: any) => {
      mock(key, state[key]);
    });

    const test = Test.new();

    expect(mock).toBeCalledWith(true, undefined);

    test.foo = "baz";

    expect(mock).toBeCalledWith("foo", "baz");

    done();
  });
})

describe("string coercion", () => {
  it("will output a unique ID", () => {
    const foo = String(Model.new());
    const bar = String(Model.new());

    expect(foo).not.toBe(bar);
  })

  it("will be class name and 6 random characters", () => {
    class FooBar extends Model {}

    const foobar = String(FooBar.new());

    expect(foobar).toMatch(/^FooBar-\w{6}/)
  })

  it("will be class name and supplied ID", () => {
    const a = Model.new("ID");

    expect(String(a)).toBe("ID");
  })

  it("will work within subscriber", () => {
    class Test extends Model {
      foo = "foo";
    }

    const test = Test.new("ID");
    const mock = jest.fn();

    test.get(state => {
      mock(String(state));
    })

    expect(mock).toBeCalledWith("ID");
  })
})