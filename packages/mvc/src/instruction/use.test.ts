import { Context } from '../context';
import { Model } from '../model';
import { use } from './use';

describe('instruction', () => {
  it('will run on create', () => {
    class Test extends Model {
      property = use((key) => {
        didRunInstruction(key);
      });
    }

    const didRunInstruction = jest.fn();

    Test.new();

    expect(didRunInstruction).toBeCalledWith('property');
  });

  describe('symbol', () => {
    it('will use unique symbol as placeholder', async () => {
      class Test extends Model {
        value = use(() => ({ value: 1 })) as unknown;
      }

      const test = new Test();

      if (typeof test.value !== 'symbol')
        throw new Error('value is not a symbol');
      else expect(test.value.description).toMatch(/instruction-\w{6}/);

      await test.set();

      expect(test.value).toBe(1);
    });

    it('will be deleted prior to instruction', () => {
      class Test extends Model {
        value = use(() => {
          expect('value' in this).toBe(false);
        });
      }

      Test.new();
    });

    it('will ignore normal symbol', () => {
      class Test extends Model {
        value = Symbol('hello');
      }

      const test = Test.new();

      expect(typeof test.value).toBe('symbol');
    });
  });

  describe('getter', () => {
    it('will run upon access', () => {
      const mockAccess = jest.fn((_subscriber) => 'foobar');
      const mockApply = jest.fn((_key) => mockAccess);

      class Test extends Model {
        property = use(mockApply);
      }

      const instance = Test.new();

      expect(mockApply).toBeCalledWith('property', expect.any(Test), {});
      expect(mockAccess).not.toBeCalled();

      expect(instance.property).toBe('foobar');
      expect(mockAccess).toBeCalledWith(instance);
    });

    it('will pass subscriber if within one', () => {
      const didGetValue = jest.fn();

      class Test extends Model {
        property = use(() => didGetValue);
      }

      const state = Test.new();

      state.get((own) => {
        void own.property;
      });

      expect(didGetValue).toBeCalledWith(state);
    });

    it('will not throw suspense if get (required) is false', async () => {
      class Test extends Model {
        value = use(() => ({ get: false }));
      }

      const test = Test.new('ID');
      const effect = jest.fn((test: Test) => void test.value);

      test.get(effect);
      test.value = 'foo';

      await expect(test).toHaveUpdated();
      expect(effect).toBeCalledTimes(2);
    });
  });

  describe('setter', () => {
    it('will reject update if false', () => {
      class Test extends Model {
        value = use(() => ({ set: false }));
      }

      const test = Test.new('ID');
      const assign = () => (test.value = 'foo');

      expect(assign).toThrowError(`ID.value is read-only.`);
    });

    it('will prevent update if returns false', async () => {
      const didSetValue = jest.fn((newValue) => {
        if (newValue == 'ignore') return false;
      });

      class Test extends Model {
        property = use(() => {
          return {
            value: 'foobar',
            set: didSetValue
          };
        });
      }

      const test = Test.new();

      expect(test.property).toBe('foobar');

      test.property = 'test';
      expect(didSetValue).toBeCalledWith('test', 'foobar');
      expect(test.property).toBe('test');
      await expect(test).toHaveUpdated();

      test.property = 'ignore';
      expect(didSetValue).toBeCalledWith('ignore', 'test');
      expect(test.property).toBe('test');
      await expect(test).not.toHaveUpdated();
    });

    // duplicate test?
    it('will revert update if returns false', async () => {
      let ignore = false;

      class Test extends Model {
        property = use(() => {
          return {
            value: 0,
            set: (value) => (ignore ? false : () => value + 10)
          };
        });
      }

      const instance = Test.new();

      expect(instance.property).toBe(0);

      instance.property = 10;
      expect(instance.property).toBe(20);
      await expect(instance).toHaveUpdated();

      ignore = true;

      instance.property = 0;
      expect(instance.property).toBe(20);
      await expect(instance).not.toHaveUpdated();
    });

    it('will not duplicate explicit update', () => {
      class Test extends Model {
        property = use<string>(() => ({
          value: 'foobar',
          set: (value) => () => value + '!'
        }));
      }

      const test = Test.new();
      const didUpdate = jest.fn();

      test.set(didUpdate);

      expect(test.property).toBe('foobar');

      test.property = 'test';

      expect(test.property).toBe('test!');
      expect(didUpdate).toBeCalledTimes(1);
    });

    it('will not update on reassignment', () => {
      class Test extends Model {
        property = use<string>((key) => ({
          value: 'foobar',
          set: (value: any) => {
            return () => value + '!';
          }
        }));
      }

      const test = Test.new();
      const didUpdate = jest.fn();

      test.set(didUpdate);

      expect(test.property).toBe('foobar');

      test.property = 'test';

      expect(test.property).toBe('test!');
      expect(didUpdate).toBeCalledTimes(1);
    });
  });
});

describe('model', () => {
  it('will init upon access', () => {
    class Child extends Model {
      value = 'foo';
    }
    class Test extends Model {
      child = use(Child, mockInit);
    }

    const mockInit = jest.fn();

    Test.new();

    expect(mockInit).toBeCalledTimes(1);
  });

  it('will not create base Model', () => {
    class Test extends Model {
      // @ts-expect-error
      child = use(Model);
    }

    const attempt = () => Test.new();

    expect(attempt).toThrowError('Cannot create base Model.');
  });

  it('will run callback on every assign', () => {
    class Child extends Model {
      value = 'foo';
    }
    class Parent extends Model {
      child = use(Child, callback);
    }

    const callback = jest.fn();
    const parent = Parent.new();

    // Initial assignment
    expect(callback).toBeCalledTimes(1);

    parent.child = new Child();
    expect(callback).toBeCalledTimes(2);
  });

  it.todo('will run callback after assign completes');
  it.todo('will run cleanup on reassign');

  it('will only reassign a matching model', () => {
    class Child extends Model {}
    class Unrelated extends Model {}
    class Parent extends Model {
      child = use(Child);
    }

    const parent = Parent.new('ID');

    expect(() => {
      parent.child = Unrelated.new('ID');
    }).toThrowError(`ID.child expected Model of type Child but got Unrelated.`);

    expect(() => {
      // @ts-expect-error
      parent.child = undefined;
    }).toThrowError(`ID.child expected Model of type Child but got undefined.`);
  });

  it('will allow undefined', () => {
    class Child extends Model {}
    class Parent extends Model {
      child = use(Child, false);
    }

    const parent = Parent.new('ID');

    expect(parent.child).toBeInstanceOf(Child);

    parent.child = undefined;

    expect(parent.child).toBeUndefined();
  });

  it('will be provided by parent', () => {
    class Child extends Model {}
    class Test extends Model {
      child = use(Child);
    }

    const context = new Context({ Test });

    expect(context.get(Child)).toBeInstanceOf(Child);
  });
});
