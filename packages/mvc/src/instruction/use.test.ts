import { Context } from '../context';
import { Model } from '../model';
import { use } from './use';

describe("instruction", () => {
  it("will delete value prior to instruction", () => {
    class Test extends Model {
      value = use((key) => {
        expect(key in this).toBe(false);
      });
    }
  
    Test.new();
  })
  
  it("will throw error if set is false", () => {
    class Test extends Model {
      value = use(() => ({ set: false }));
    }
  
    const test = Test.new('ID');
    const assign = () => test.value = "foo";
  
    expect(assign).toThrowError(`ID.value is read-only.`);
  })
  
  it("will not throw suspense if get (required) is false", async () => {
    class Test extends Model {
      value = use(() => ({ get: false }));
    }
  
    const test = Test.new('ID');
    const effect = jest.fn((test: Test) => void test.value);
  
    test.get(effect);
    test.value = "foo";
  
    await expect(test).toHaveUpdated();
    expect(effect).toBeCalledTimes(2);
  })
})

describe("model", () => {
  it("will init upon access", () => {
    class Child extends Model {
      value = "foo"
    }
    class Test extends Model {
      child = use(Child, mockInit);
    }
  
    const mockInit = jest.fn();

    Test.new();

    expect(mockInit).toBeCalledTimes(1);
  })

  it("will not create base Model", () => {
    class Test extends Model {
      // @ts-expect-error
      child = use(Model);
    }
  
    const attempt = () => Test.new();

    expect(attempt).toThrowError(
      "Model is abstract and not a valid type."
    );
  })

  it('will run callback on every assign', () => {
    class Child extends Model {
      value = "foo"
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
  })

  it.todo("will run callback after assign completes");
  it.todo("will run cleanup on reassign");
  
  it('will only reassign a matching model', () => {
    class Child extends Model {}
    class Unrelated extends Model {};
    class Parent extends Model {
      child = use(Child);
    }
  
    const parent = Parent.new("ID");
  
    expect(() => {
      parent.child = Unrelated.new("ID");
    }).toThrowError(`ID.child expected Model of type Child but got Unrelated.`)
  
    expect(() => {
      // @ts-expect-error
      parent.child = undefined;
    }).toThrowError(`ID.child expected Model of type Child but got undefined.`)
  })
  
  it('will allow undefined', () => {
    class Child extends Model {}
    class Parent extends Model {
      child = use(Child, false);
    }
  
    const parent = Parent.new("ID");

    expect(parent.child).toBeInstanceOf(Child);

    parent.child = undefined;

    expect(parent.child).toBeUndefined();
  })

  it("will be provided by parent", () => {
    class Child extends Model {};
    class Test extends Model {
      child = use(Child);
    }
  
    const context = new Context({ Test });
  
    expect(context.get(Child)).toBeInstanceOf(Child);
  });
})