import { Model } from '../model';
import { use } from './use';

describe("model", () => {
  it('will run callback on every assign', () => {
    const callback = jest.fn();

    class Child extends Model {
      value = "foo"
    }
  
    class Parent extends Model {
      child = use(Child, callback);
    }
  
    const parent = Parent.new();
    expect(callback).toBeCalled();

    parent.child = new Child();
    expect(callback).toBeCalledTimes(2);
  })
  
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
})