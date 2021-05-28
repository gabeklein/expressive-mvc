import { Issue, Model, parent, use } from './adapter';

describe("Parent-Child", () => {
  it("creates parent-child relationship", () => {
    class Foo extends Model {
      child = use(Bar as any) as Bar;
    }
    class Bar extends Model {
      parent = parent(Foo as any) as Foo;
    }

    const foo = Foo.create();
    const bar = foo.child;

    expect(bar).toBeInstanceOf(Bar);
    expect(bar.parent).toStrictEqual(foo);
  })

  it("throws when required parent is absent :(", () => {
    class Detatched extends Model {}
    class NonStandalone extends Model {
      expects = parent(Detatched, true);
    }

    const attempt = () => 
      NonStandalone.create();

    const error = Issue.ParentRequired(
      Detatched.name, NonStandalone.name
    )

    expect(attempt).toThrowError(error);
  })

  it("throws if parent is incorrect type", () => {
    class Expected extends Model {}
    class Unexpected extends Model {
      child = use(Adopted as any) as Adopted;
    }
    class Adopted extends Model {
      expects = parent(Expected);
    }

    const attempt = () => 
      Unexpected.create();

    const error = Issue.UnexpectedParent(
      Expected.name, Adopted.name, Unexpected.name
    )

    expect(attempt).toThrowError(error);
  })
});