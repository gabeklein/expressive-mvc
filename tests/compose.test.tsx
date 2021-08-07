import React from 'react';

import { Oops as Compose } from '../src/compose';
import { Oops as Peers } from '../src/Peer';
import { Model, parent, Provider, render, Singleton, subscribeTo, tap, use } from './adapter';

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
  
    // New subscription does still work.
    state.child.value = "bar";
    await update();
    expect(state.child.value).toBe("bar");
  })
  
  it('will reset if value is undefined', async () => {
    class Parent extends Model {
      value = "foo";
      child = use(Child, false);
    }

    const state = Parent.create();
    const update = subscribeTo(state, it => {
      void it.value;

      if(it.child)
        void it.child.value;
    })
  
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
  
    // New subscription does still work.
    state.child.value = "bar";
    await update();
  })

  it('will subscribe if initially undefined', async () => {
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

  it('will complain if undefined in required mode', () => {
    class Parent extends Model {
      child = use(Child, true);
    }

    const state = Parent.create();

    const expected = Compose.UndefinedNotAllowed("child");
    const setUndefined = () => {
      // @ts-ignore
      state.child = undefined;
    }

    expect(state.child).toBeInstanceOf(Child);
    expect(setUndefined).toThrowError(expected);
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

    const error = Compose.ParentRequired(
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
    const error = Compose.UnexpectedParent(
      Expected.name, Adopted.name, Unexpected.name
    )

    expect(attempt).toThrowError(error);
  })
});

describe("tap instruction", () => {
  class Foo extends Model {
    bar = tap(Bar);
  }

  class Bar extends Model {
    value = "bar";
  }

  it("will attach property via tap directive", () => {
    const Test = () => {
      const { bar } = Foo.use();
      expect(bar.value).toBe("bar");
      return null;
    }

    render(
      <Provider of={Bar}>
        <Test />
      </Provider>
    );
  })

  it("will return undefined if instance not found", () => {
    const Test = () => {
      const foo = Foo.use();
      expect(foo.bar).toBeUndefined();
      return null;
    }

    render(<Test />);
  })

  it("will throw if strict tap is undefined", () => {
    class Foo extends Model {
      bar = tap(Bar, true);
    }

    const expected = Peers.AmbientRequired(Bar.name, Foo.name, "bar");
    const useStrictFooBar = () => Foo.use().bar;

    const TestComponent = () => {
      expect(useStrictFooBar).toThrowError(expected);
      return null;
    }

    render(<TestComponent />);
  })

  it("will attach a singleton via tap directive", () => {
    class Foo extends Model {
      global = tap(Global);
    }

    class Global extends Singleton {
      value = "bar";
    }

    Global.create();

    const Test = () => {
      const { global } = Foo.use();
      expect(global.value).toBe("bar");
      return null;
    }

    render(<Test />);
  })

  it("will throw if model is tapped by singleton", () => {
    class Normal extends Model {}
    class Global extends Singleton {
      notPossible = tap(Normal);
    }

    const attempt = () => Global.create();
    const issue = Peers.CantAttachGlobal(Global.name, Normal.name);

    expect(attempt).toThrowError(issue);
  })

  it.todo("can access peers sharing same provider");
})