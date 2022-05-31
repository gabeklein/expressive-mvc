import { Model, parent, use } from '..';
import { Oops } from './parent';

it("creates parent-child relationship", () => {
  class Foo extends Model {
    child = use(Bar);
  }
  class Bar extends Model {
    parent = parent(Foo);
  }

  const foo = Foo.create();
  const bar = foo.child;

  expect(bar).toBeInstanceOf(Bar);
  expect(bar.parent).toBe(foo);
})

it("throws when required parent is absent :(", () => {
  class Detatched extends Model {}
  class NonStandalone extends Model {
    expects = parent(Detatched);
  }

  const attempt = () => 
    NonStandalone.create();

  const error = Oops.Required(
    Detatched.name, NonStandalone.name
  )

  expect(attempt).toThrowError(error);
})

it("retuns undefined if set not-required", () => {
  class MaybeParent extends Model {}
  class StandAlone extends Model {
    maybe = parent(MaybeParent, false);
  }

  const instance = StandAlone.create();

  expect(instance.maybe).toBeUndefined();
})

it("throws if parent is of incorrect type", () => {
  class Expected extends Model {}
  class Unexpected extends Model {
    child = use(Adopted as any) as Adopted;
  }
  class Adopted extends Model {
    expects = parent(Expected);
  }

  const attempt = () => Unexpected.create();
  const error = Oops.Unexpected(
    Expected.name, Adopted.name, Unexpected.name
  )

  expect(attempt).toThrowError(error);
})