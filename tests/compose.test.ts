import { Oops } from '../src/instruction/use';
import { Model, parent, subscribeTo, use } from './adapter';

describe("use instruction", () => {
  class Child extends Model {
    value = "foo"
  }
  
  class Parent extends Model {
    value = "foo";
    child = use(Child);
  }
  
  it('will track recursively', async () => {
    const state = Parent.create();
    const update = subscribeTo(state, it => {
      void it.value;
      void it.child.value;
    })

    expect(state.value).toBe("foo");
    expect(state.child.value).toBe("foo");
  
    state.value = "bar";
    await update();
  
    state.child.value = "bar";
    await update();
  })
 
  it('will accept instance', async () => {
    const child = Child.create();
    
    class Parent extends Model {
      child = use(child);
    }

    const state = Parent.create();
    const update = subscribeTo(state, it => {
      void it.child.value;
    })

    expect(state.child.value).toBe("foo");
  
    state.child.value = "bar";
    await update();

    expect(state.child.value).toBe("bar");
  })

  it('will accept simple object', async () => {
    class Parent extends Model {
      child = use({
        value: "foo"
      });
    }

    const state = Parent.create();
    const update = subscribeTo(state, it => {
      void it.child.value;
    })

    expect(state.child.value).toBe("foo");
  
    state.child.value = "bar";
    await update();

    expect(state.child.value).toBe("bar");
  })

  it('will accept simple object as new value', async () => {
    class Parent extends Model {
      child = use({ value: "foo" });
    }

    const state = Parent.create();
    const update = subscribeTo(state, it => {
      void it.child.value;
    })

    expect(state.child.value).toBe("foo");
  
    state.child.value = "bar";
    await update();
    expect(state.child.value).toBe("bar");

    // Will refresh on repalcement.
    state.child = { value: "baz" };
    await update();
    expect(state.child.value).toBe("baz");
  
    // New subscription still works.
    state.child.value = "bar";
    await update();
    expect(state.child.value).toBe("bar");
  })
  
  it('will create from factory', async () => {
    class Child extends Model {
      parent!: Parent;
    }

    class Parent extends Model {
      child = use(() => {
        const child = Child.create();
        child.parent = this;
        return child;
      });
    }

    const state = Parent.create();

    expect(state.child).toBeInstanceOf(Child);
    expect(state.child.parent).toBe(state);
  })
  
  it('will accept undefined from factory', async () => {
    class Parent extends Model {
      child = use(() => undefined);
    }

    const state = Parent.create();

    expect(state.child).toBeUndefined();
  })

  it('will update on new value', async () => {
    const state = Parent.create();
    const update = subscribeTo(state, it => {
      void it.value;
      void it.child.value;
    })
  
    expect(state.child.value).toBe("foo");
  
    // Will refresh on sub-value change.
    state.child.value = "bar";
    await update();
    expect(state.child.value).toBe("bar");
  
    // Will refresh on repalcement.
    state.child = new Child();
    await update();
    expect(state.child.value).toBe("foo");
  
    // New subscription still works.
    state.child.value = "bar";
    await update();
    expect(state.child.value).toBe("bar");
  })

  it('will reset if value is undefined', async () => {
    class Parent extends Model {
      value = "foo";
      child = use<Child>();
    }

    const state = Parent.create();
    const update = subscribeTo(state, it => {
      void it.value;

      if(it.child)
        void it.child.value;
    })

    state.child = new Child();

    await update();
  
    // Will refresh on sub-value change.
    state.child!.value = "bar";
    await update();
  
    // Will refresh on undefined.
    state.child = undefined;
    await update();
    expect(state.child).toBeUndefined();
  
    // Will refresh on repalcement.
    state.child = new Child();
    await update();
  
    // New subscription still works.
    state.child.value = "bar";
    await update();
  })

  it('will still subscribe if initially undefined', async () => {
    class Parent extends Model {
      value = "foo";
      child = use<Child>();
    }

    const state = Parent.create();
    const update = subscribeTo(state, it => {
      void it.value;

      if(it.child)
        void it.child.value;
    })

    expect(state.child).toBeUndefined();

    // Will refresh on repalcement.
    state.child = new Child();
    await update();
  
    // New subscription does work.
    state.child.value = "bar";
    await update();

    // Will refresh on deletion.
    state.child = undefined;
    await update();
  })

  it('will throw if bad argument type', () => {
    class Parent extends Model {
      // @ts-ignore
      child = use(1);
    }

    const expected = Oops.BadArgument("number");
    const attempt = () => Parent.create();

    expect(attempt).toThrowError(expected)
  })
})

describe("parent instruction", () => {
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
    expect(bar.parent).toBe(foo);
  })

  it("throws when required parent is absent :(", () => {
    class Detatched extends Model {}
    class NonStandalone extends Model {
      expects = parent(Detatched, true);
    }

    const attempt = () => 
      NonStandalone.create();

    const error = Oops.ParentRequired(
      Detatched.name, NonStandalone.name
    )

    expect(attempt).toThrowError(error);
  })

  it("retuns undefined if expected not set", () => {
    class MaybeParent extends Model {}
    class StandAlone extends Model {
      maybe = parent(MaybeParent);
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
    const error = Oops.UnexpectedParent(
      Expected.name, Adopted.name, Unexpected.name
    )

    expect(attempt).toThrowError(error);
  })
});