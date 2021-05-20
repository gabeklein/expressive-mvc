import { Controller, Issue, parent, use } from './adapter';

describe("Parent-Child", () => {
  it("creates parent-child relationship", () => {
    class Foo extends Controller {
      child = use(Bar as any) as Bar;
    }
    class Bar extends Controller {
      parent = parent(Foo as any) as Foo;
    }

    const foo = Foo.create();
    const bar = foo.child;

    expect(bar).toBeInstanceOf(Bar);
    expect(bar.parent).toStrictEqual(foo);
  })

  it("throws when required parent is absent :(", () => {
    class Detatched extends Controller {}
    class NonStandalone extends Controller {
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
    class Expected extends Controller {}
    class Unexpected extends Controller {
      child = use(Adopted as any) as Adopted;
    }
    class Adopted extends Controller {
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