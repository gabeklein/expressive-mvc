import { Context } from './context';
import { get } from './instruction/get';
import { ref } from './instruction/ref';
import { set } from './instruction/set';
import { mockError, mockPromise } from './mocks';
import { Model } from './model';

it('will extend custom class', () => {
  class Subject extends Model {
    value = 1;
  }
  
  const state = Subject.new();

  expect(state.value).toBe(1);
})

it('will update on assignment', async () => {
  class Subject extends Model {
    value = 1;
  }
  
  const state = Subject.new();

  expect(state.value).toBe(1);

  state.value = 2

  const update = await state.set();

  expect(update).toEqual(["value"]);
  expect(state.value).toBe(2);
})

it('will ignore assignment with same value', async () => {
  class Subject extends Model {
    value = 1;
  }
  
  const state = Subject.new();

  expect(state.value).toBe(1);

  state.value = 1;

  const update = await state.set();

  expect(update).toBeUndefined();
})

it('will update from within a method', async () => {
  class Subject extends Model {
    value = 1;

    setValue(to: number){
      this.value = to;
    }
  }

  const state = Subject.new();

  state.setValue(3);

  const update = await state.set();

  expect(update).toEqual(["value"]);
  expect(state.value).toBe(3)
})

it('will not ignore function properties', async () => {
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

it('will destroy children before self', () => {
  class Nested extends Model {}
  class Test extends Model {
    nested = new Nested();
  }

  const test = Test.new();
  const destroyed = jest.fn();

  test.nested.get(null, destroyed);
  test.set(null);

  expect(destroyed).toBeCalled();
});

it("will not break super calls", () => {
  class Test extends Model {
    greeting = "";

    action(){
      this.greeting += "Foo ";
    }
  }
  
  class Test2 extends Test {
    action(){
      super.action();
      this.greeting += "Bar ";
    }
  }

  class Test3 extends Test2 {
    action(){
      super.action();
      this.greeting += "Baz";
    }
  }

  const { is: test, action } = Test3.new();

  expect(test.greeting).toBe("");    

  action();

  expect(test.greeting).toBe("Foo Bar Baz");
});

it("will allow method to be overwritten", () => {
  class Test extends Model {
    foo = "foo";

    method(){
      return this.foo;
    }
  }

  const test = Test.new();

  test.method = () => "bar";

  expect(test.method()).toBe("bar");

  test.method = () => "baz";

  expect(test.method()).toBe("baz");
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

  it("will work inside subscriber", () => {
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

    it("will export frozen object", () => {
      const test = Test.new();
      const values = test.get();

      expect(Object.isFrozen(values)).toBe(true);
    })

    it("will ignore getters", () => {
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

        nested = new Nested();
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

    it("will defer to get method exporting properties", () => {
      class Bar extends Model {
        foo = "foo";
      }

      class Test extends Model {
        foo = { get: () => 3 }
        bar = ref<boolean>();
        baz = new Bar();
      }

      const test = Test.new();
      const exported = test.get();

      type Expected = {
        foo: number;
        bar: boolean | null;
        baz: { foo: string };
      }

      expect<Expected>(exported).toEqual({
        foo: 3,
        bar: null,
        baz: { foo: "foo" },
      });
    })

    it("will export infinite loop", () => {
      class Parent extends Model {
        child = new Child();
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

      expect(test.get("foo")).toBe(null);

      test.foo("foobar");

      expect<ref.Object>(test.foo).toBeInstanceOf(Function);
      expect<string | null>(test.get("foo")).toBe("foobar");
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

  describe("effect", () => {
    class Test extends Model {
      value1 = 1;
      value2 = 2;
      value3 = 3;
      value4 = get(this, $ => $.value3 + 1);
    }

    it('will watch values', async () => {
      const test = Test.new();
      const effect = jest.fn((state: Test) => {
        void state.value1;
        void state.value2;
        void state.value3;
        void state.value4;
      });

      test.get(effect);

      expect(effect).toBeCalledWith(test, new Set());

      test.value1 = 2;

      // wait for update event, thus queue flushed
      await expect(test).toHaveUpdated();

      expect(effect).toBeCalledWith(test, new Set(["value1"]));

      test.value2 = 3;
      test.value3 = 4;

      // wait for update event to flush queue
      await expect(test).toHaveUpdated();

      expect(effect).toBeCalledWith(test, new Set(["value2", "value3", "value4"]));

      // expect two syncronous groups of updates.
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

    it('will squash computed updates', async () => {
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

    it("will update for nested values", async () => {
      class Child extends Model {
        value = "foo";
      }

      class Test extends Model {
        child = new Child();
      }

      const test = Test.new();
      const effect = jest.fn((state: Test) => {
        void state.child.value;
      });

      test.get(effect);

      expect(effect).toBeCalledTimes(1);
      test.child.value = "bar";

      await expect(test.child).toHaveUpdated();

      expect(effect).toBeCalledTimes(2);
    })
  
    it('will subscribe deeply', async () => {
      class Parent extends Model {
        value = "foo";
        empty = undefined;
        child = new Child();
      }
    
      class Child extends Model {
        value = "foo"
        grandchild = new GrandChild();
      }
    
      class GrandChild extends Model {
        value = "bar"
      }
    
      const parent = Parent.new();
      const effect = jest.fn();
      let promise = mockPromise();
    
      parent.get(state => {
        const { child } = state;
        const { grandchild } = child;
    
        effect(child.value, grandchild.value);
        promise.resolve();
      })
    
      expect(effect).toBeCalledWith("foo", "bar");
      effect.mockClear();
    
      promise = mockPromise();
      parent.child.value = "bar";
      await promise;
      
      expect(effect).toBeCalledWith("bar", "bar");
      effect.mockClear();
    
      promise = mockPromise();
      parent.child = new Child();
      await promise;
      
      expect(effect).toBeCalledWith("foo", "bar");
      effect.mockClear();
    
      promise = mockPromise();
      parent.child.value = "bar";
      await promise;
      
      expect(effect).toBeCalledWith("bar", "bar");
      effect.mockClear();
    
      promise = mockPromise();
      parent.child.grandchild.value = "foo";
      await promise;
      
      expect(effect).toBeCalledWith("bar", "foo");
      effect.mockClear();
    });
  
    it('will subscribe if value starts undefined', async () => {
      class Child extends Model {
        value = "foo"
      }
      
      class Parent extends Model {
        value = "foo";
        child?: Child = undefined;
      }
    
      const state = Parent.new();
      const mock = jest.fn((it: Parent) => {
        void it.value;
    
        if(it.child)
          void it.child.value;
      })
    
      state.get(mock);
    
      state.child = new Child();
      await expect(state).toHaveUpdated();
      expect(mock).toBeCalledTimes(2)
    
      // Will refresh on sub-value change.
      state.child.value = "bar";
      await expect(state.child).toHaveUpdated();
      expect(mock).toBeCalledTimes(3);
    
      // Will refresh on undefined.
      state.child = undefined;
      await expect(state).toHaveUpdated();
      expect(state.child).toBeUndefined();
      expect(mock).toBeCalledTimes(4);
    
      // Will refresh on repalcement.
      state.child = new Child();
      await expect(state).toHaveUpdated();
      expect(mock).toBeCalledTimes(5);
    
      // New subscription still works.
      state.child.value = "bar";
      await expect(state.child).toHaveUpdated();
      expect(mock).toBeCalledTimes(6);
    })

    it("will not update for removed children", async () => {
      class Nested extends Model {
        value = 1;
      }

      class Test extends Model {
        nested = new Nested();
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

    it('will call immediately', async () => {
      const testEffect = jest.fn();
      const test = Test.new();

      test.get(testEffect);

      expect(testEffect).toBeCalled();
    })

    it('will only when ready', async () => {
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

    it('will work without Model.new', async () => {
      const test = new Test();
      const mock = jest.fn();

      test.get(mock);

      expect(mock).not.toBeCalled();

      test.set("EVENT");

      expect(mock).toBeCalled();
    })

    it('will not subscribe from method', async () => {
      class Test extends Model {
        foo = 1;
        bar = 2;
        
        action(){
          void this.bar;
        }
      }

      const test = Test.new();
      const effect = jest.fn((self: Test) => {
        self.action();
        void self.foo;
      })

      test.get(effect);

      test.foo++;

      await expect(test).toHaveUpdated();
      expect(effect).toBeCalledTimes(2);

      test.bar++;

      await expect(test).toHaveUpdated();
      expect(effect).toBeCalledTimes(2);
    })

    describe("return value", () => {
      it("will callback on next update", async () => {
        class Test extends Model {
          value1 = 1;
        }
  
        const state = Test.new();
        const mock = jest.fn();
  
        state.get(state => {
          void state.value1;
          return mock;
        });
  
        expect(mock).not.toBeCalled();
  
        state.value1 = 2;
  
        await expect(state).toHaveUpdated();
  
        expect(mock).toBeCalledWith(true);
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

      it('will cancel if null', async () => {
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

      it('will cancel if null after callback', async () => {
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

      // TODO: should this complain?
      it("will void return value", () => {
        const state = Test.new();
        const attempt = () => {
          // @ts-expect-error
          state.get(() => "foobar");
        }
  
        expect(attempt).not.toThrowError();
      })
  
      it("will ignore returned promise", () => {
        const state = Test.new();
        const attempt = () => {
          state.get(async () => {});
        }
  
        expect(attempt).not.toThrowError();
      })
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

  describe("promise-like", () => {
    it("will resolve update frame", async () => {
      class Test extends Model {
        foo = "foo";
      }

      const test = Test.new();

      test.foo = "bar";

      const update = test.set();

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

    it("will force initial update", async () => {
      class Test extends Model {
        foo = "foo";
      }

      const test = new Test();
      const effect = jest.fn();

      test.get(effect);
      expect(effect).not.toBeCalled();

      test.set();
      expect(effect).toBeCalled();
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

  describe("assign", () => {
    it("will merge object into model", async () => {
      class Test extends Model {
        foo = "foo";
        bar = "bar";
      }

      const test = Test.new();

      test.set({ foo: "bar" });

      await expect(test).toHaveUpdated("foo");

      expect(test.foo).toBe("bar");
      expect(test.bar).toBe("bar");
    })

    it("will merge methods into model", async () => {
      class Test extends Model {
        foo = "foo";

        method(){
          return this.foo;
        }
      }

      const test = Test.new();

      test.set({
        foo: "bar",
        method(){
          return this.foo;
        }
      });
      
      await Promise.all([
        expect(test).toHaveUpdated("foo"),
        // method is not a managed property so will ignore update
        // TODO: investigate if this behavior should change.
        expect(test).not.toHaveUpdated("method")
      ]);

      expect(test.foo).toBe("bar");
    })

    it("will ignore properties not on model", async () => {
      class Test extends Model {
        foo = "foo";
      }

      const test = Test.new();

      test.set({ bar: "bar" });

      await expect(test).not.toHaveUpdated();

      expect(test).not.toHaveProperty("bar");
    })

    it("will assign from inside method", () => {
      class Test extends Model {
        foo = "foo";

        method(){
          // TODO: Can this be fixed?
          // @ts-expect-error
          this.set({ foo: "bar" });
        }
      }

      const test = Test.new();

      test.method();

      expect(test.foo).toBe("bar");
    })
  })
})

describe("new method (static)", () => {
  it("will use string argument as ID", () => {
    const state = Model.new("ID");
  
    expect(String(state)).toBe("ID");
  })
  
  it("will call argument as lifecycle", () => {
    const didDestroy = jest.fn();
    const didCreate = jest.fn(() => didDestroy);
  
    const state = Model.new(didCreate);
  
    expect(didCreate).toBeCalledTimes(1);
    expect(didDestroy).not.toBeCalled();
  
    state.set(null);
  
    expect(didDestroy).toBeCalledTimes(1);
  })
  
  it("will apply object returned by callback", () => {
    class Test extends Model {
      foo = "foo";
    }
  
    const willCreate = jest.fn(() => ({
      foo: "bar",
    }));
  
    const state = Test.new(willCreate);
    
    expect(state.foo).toBe("bar");
  })

  it("will apply all arguments", () => {
    class Test extends Model {
      foo = 0;
      bar = 1;
    }

    const willCreate = jest.fn(() => ({ foo: 2 }));
    const willDestroy = jest.fn();

    const test = Test.new("Test-ID", willCreate, () => willDestroy, { bar: 3 });

    expect(test.foo).toBe(2);
    expect(test.bar).toBe(3);
    expect(String(test)).toBe("Test-ID");
    expect(willCreate).toBeCalledTimes(1);
    expect(willDestroy).not.toBeCalled();

    test.set(null);

    expect(willDestroy).toBeCalledTimes(1);
  })

  it("will prefer last ID provided", () => {
    const test = Model.new("ID", "ID2");

    expect(String(test)).toBe("ID2");
  })

  it("will prefer later assignments", () => {
    class Test extends Model {
      foo = 1;
      bar = 2;
    }

    const test = Test.new(
      { foo: 3 },
      { foo: 4, bar: 5 },
      () => ({ bar: 6 })
    );
    
    expect(test.foo).toBe(4);
    expect(test.bar).toBe(6);
  })
  
  it("will run callbacks in order", () => {
    const willDestroy2 = jest.fn();
    const willDestroy1 = jest.fn(() => {
      expect(willDestroy2).not.toBeCalled();
    });

    const willCreate2 = jest.fn(() => willDestroy2);
    const willCreate1 = jest.fn(() => {
      expect(willCreate2).not.toBeCalled();
      return willDestroy1;
    });

    const test = Model.new(willCreate1, willCreate2);

    expect(willCreate1).toBeCalledTimes(1);
    expect(willCreate2).toBeCalledTimes(1);

    test.set(null);
    
    expect(willDestroy1).toBeCalledTimes(1);
    expect(willDestroy2).toBeCalledTimes(1);
  })
  
  it("will run callbacks asyncronously in order", async () => {
    const promise = mockPromise();

    const willDestroy2 = jest.fn();
    const willDestroy1 = jest.fn(() => {
      expect(willDestroy2).not.toBeCalled();
    });

    const willCreate2 = jest.fn(() => willDestroy2);
    const willCreate1 = jest.fn(async () => {
      await promise;
      expect(willDestroy1).not.toBeCalled();
      return willDestroy1;
    });

    const test = Model.new(willCreate1, willCreate2);

    expect(willCreate1).toBeCalledTimes(1);
    expect(willCreate2).not.toBeCalled();
    
    promise.resolve();
    await expect(test).not.toHaveUpdated();
    
    expect(willCreate2).toBeCalledTimes(1);

    test.set(null);
    
    expect(willDestroy1).toBeCalledTimes(1);
    expect(willDestroy2).toBeCalledTimes(1);
  })

  it("will throw if destroyed before ready", () => {
    const promise = mockPromise();
    const test = Model.new("ID", () => promise);

    expect(() => test.set(null)).toThrowError(
      "Tried to destroy ID but not fully initialized."
    );

    promise.resolve();
  });

  it("will ingore promise from callback", () => {
    const didCreate = jest.fn(() => Promise.resolve());
  
    Model.new(didCreate);
  
    expect(didCreate).toBeCalledTimes(1);
  })
  
  it("will log error from rejected initializer", async () => {
    // TODO: why does mock helper not work for this?
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const expects = new Error("Model callback rejected.");

    const init = jest.fn(() => Promise.reject(expects));
    const test = Model.new("ID", init);
  
    expect(init).toBeCalledTimes(1);
    
    await expect(test).not.toHaveUpdated();

    expect(error).toBeCalledWith("Async error in constructor for ID:");
    expect(error).toBeCalledWith(expects);

    error.mockRestore();
  })

  it("will inject both properties and methods", () => {
    class Test extends Model {
      value = 1;

      method(){
        return this.value;
      }
    }

    class Test2 extends Test {
      method2(){
        return this.value + 1;
      }
    }

    const test = Test2.new({
      value: 2,
      method(){
        expect<Test2>(this);
        return this.value + 1;
      },
      method2(){
        expect<Test2>(this);
        return this.value - 1;
      }
    });

    // expect are bound to instance
    const { method, method2 } = test;

    expect(test.value).toBe(2);
    expect(method()).toBe(3);
    expect(method2()).toBe(1);
  })

  it("will ignore non-applicable properties", () => {
    class Test extends Model {
      value = 1;

      method(){
        return this.value;
      }
    }

    const test = Test.new({
      value: 2,
      method(){
        expect<Test>(this);
        return this.value + 1;
      },
      notManaged: 3,
      notMethod: () => 4
    });
    
    expect(test.value).toBe(2);
    expect(test.method()).toBe(3);

    expect(test).not.toHaveProperty("notManaged");
    expect(test).not.toHaveProperty("notMethod");
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

describe("context method (static)", () => {
  it("will get context", () => {
    class Test extends Model {}

    const test = Test.new();

    expect(Context.get(test)).toBeUndefined();

    const context = new Context({ test })

    expect(Context.get(test)).toBe(context);
  });

  it("will callback when attached", () => {
    class Test extends Model {}

    const test = Test.new();
    const mock = jest.fn();

    Context.get(test, mock);

    expect(mock).not.toBeCalled();

    const context = new Context({ test });

    expect(mock).toBeCalledWith(context);
  });
})