import { get } from './instruction/get';
import { set } from './instruction/set';
import { use } from './instruction/use';
import { Model } from './model';

describe("get", () => {
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
      await expect(test).toUpdate();

      test.value2 = 3;
      test.value3 = 4;

      // wait for update event to flush queue
      await expect(test).toUpdate();

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

      await expect(test.nested).toUpdate();

      expect(effect).toBeCalledTimes(2);
    })

    it.skip("will not update for removed children", async () => {
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
      await expect(test.nested).toUpdate();
      expect(effect).toBeCalledTimes(2);

      const old = test.nested;

      test.nested = Nested.new();
      await expect(test).toUpdate();
      // Updates because nested property is new.
      expect(effect).toBeCalledTimes(3);

      old.value++;
      await expect(old).toUpdate();
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

      await test.set(0);

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

      await test.set(0);

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
      await expect(state).toUpdate();

      expect(mock).toBeCalled();
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
      await expect(state).toUpdate();

      expect(mock).toBeCalled();

      state.value3++;
      await expect(state).toUpdate();

      // expect pre-existing listener to hit
      expect(mock).toBeCalledTimes(3);
    })

    it('will call immediately', async () => {
      class Test extends Model { }

      const testEffect = jest.fn();
      const test = Test.new();

      test.get(testEffect);

      expect(testEffect).toBeCalled();
    })

    it("will bind to model called upon", () => {
      class Test extends Model { }

      function testEffect(this: Test) {
        didCreate(this);
      }

      const didCreate = jest.fn();
      const test = Test.new();

      test.get(testEffect);

      expect(didCreate).toBeCalledWith(test);
    })

    it('will callback on willDestroy by default', async () => {
      class Test extends Model { }

      const willDestroy = jest.fn();
      const test = Test.new();

      test.get(() => willDestroy);
      test.null();

      expect(willDestroy).toBeCalled();
    })

    it('will cancel effect on callback', async () => {
      class Test extends Model {
        value = 0;
      }

      const test = Test.new();
      const didEffect = jest.fn((test: Test) => {
        void test.value;
      });

      const done = test.get(didEffect);

      test.value += 1;

      await expect(test).toUpdate();
      expect(didEffect).toBeCalledTimes(2);

      done();

      test.value += 1;
      await expect(test).toUpdate();

      expect(didEffect).toBeCalledTimes(2);
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
      await expect(state).toUpdate();

      state.value2 = 3;
      await expect(state).toUpdate();

      state.value2 = 4;
      state.value3 = 4;
      await expect(state).toUpdate();

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
      await expect(state).toUpdate();

      state.value2 = 3;
      await expect(state).toUpdate();

      state.value2 = 4;
      state.value3 = 4;
      await expect(state).toUpdate();

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

      await state.set(0);

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

      await state.set(0);

      // expect two syncronous groups of updates.
      expect(mock).toBeCalledTimes(2)
    })

    it('will register before ready', async () => {
      class Test2 extends Test {
        constructor() {
          super();
          this.get(this.test);
        }

        test() {
          void this.value1;
          void this.value3;
          mock();
        }
      }

      const mock = jest.fn();
      const state = Test2.new();

      // runs immediately to aquire subscription
      expect(mock).toBeCalled();

      state.value1++;
      await expect(state).toUpdate();

      expect(mock).toBeCalledTimes(2);

      state.value3++;
      await expect(state).toUpdate();

      expect(mock).toBeCalledTimes(3);
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

        await expect(test).toUpdate();
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

        await expect(test).toUpdate();
        expect(didInvoke).toBeCalledWith("foo");

        test.value = "bar";

        await expect(test).toUpdate();
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

        await expect(test).toUpdate();
        expect(willUpdate).toBeCalledTimes(1);

        test.value = "foo";

        await expect(test).toUpdate();
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
        await expect(state).toUpdate();

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
})

describe("set", () => {
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

      expect(test).toBeCalledWith("foo");
      expect(test).toBeCalledWith("bar");
      expect(test).not.toBeCalledWith("baz");

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

      expect(test).toBeCalledWith("foo");
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

      expect(mock).toBeCalledWith("foo");
      expect(mock).toBeCalledWith("foo");
      expect(mock).toBeCalledWith("bar");

      done();
    })

    it("will callback after frame", async () => {
      const test = Test.new();
      const didUpdate = jest.fn<any, [string]>(() => didUpdateAsync);
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

        constructor() {
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

      expect(callback).toBeCalledWith("bar");
    })

    it('will disallow update if model is destroyed', () => {
      class Test extends Model {
        foo = 0;
      }

      const callback = jest.fn();
      const test = Test.new();

      test.set(callback);
      test.foo++;

      test.null();

      expect(() => test.foo++).toThrowError();
      expect(callback).toBeCalledTimes(1);
    })

    it.todo("will throw clear error on bad update");
  })
})