import VC, { use, parent, Issue } from "./adapter";

describe("Parent-Child", () => {
  it("creates parent-child relationship", () => {
    class Foo extends VC {
      child = use(Bar);
    }
    class Bar extends VC {
      parent = parent(Foo);
    }

    const foo = Foo.create();
    const bar = foo.child;

    expect(bar).toBeInstanceOf(Bar);
    expect(bar.parent).toStrictEqual(foo);
  })

  it("throws when required parent is absent :(", () => {
    class Detatched extends VC {}
    class NonStandalone extends VC {
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
    class Expected extends VC {}
    class Unexpected extends VC {
      child = use(Adopted);
    }
    class Adopted extends VC {
      expects = parent(Expected);
    }

    const attempt = () => 
      Unexpected.create();

    const error = Issue.UnexpectedParent(
      Expected.name, Adopted.name, Unexpected.name
    )

    expect(attempt).toThrowError(error);
  })
})