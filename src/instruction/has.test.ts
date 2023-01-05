import { Model } from '..';
import { has, Oops } from './has';
import { use } from './use';

it("creates parent-child relationship", () => {
  class Foo extends Model {
    child = use(Bar);
  }
  class Bar extends Model {
    parent = has(Foo);
  }

  const foo = Foo.new();
  const bar = foo.child;

  expect(bar).toBeInstanceOf(Bar);
  expect(bar.parent).toBe(foo);
})

it("throws when required parent is absent :(", () => {
  class Detatched extends Model {}
  class NonStandalone extends Model {
    expects = has(Detatched);
  }

  const attempt = () => 
    NonStandalone.new();

  const error = Oops.Required(
    Detatched.name, NonStandalone.name
  )

  expect(attempt).toThrowError(error);
})

it("retuns undefined if set not-required", () => {
  class MaybeParent extends Model {}
  class StandAlone extends Model {
    maybe = has(MaybeParent, false);
  }

  const instance = StandAlone.new();

  expect(instance.maybe).toBeUndefined();
})

it("throws if parent is of incorrect type", () => {
  class Expected extends Model {}
  class Unexpected extends Model {
    child = use(Adopted as any) as Adopted;
  }
  class Adopted extends Model {
    expects = has(Expected);
  }

  const attempt = () => Unexpected.new();
  const error = Oops.Unexpected(
    Expected.name, Adopted.name, Unexpected.name
  )

  expect(attempt).toThrowError(error);
})