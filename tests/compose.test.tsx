import React from 'react';

import { Oops as Instruct } from '../src/instructions';
import { Oops as Peers } from '../src/Peer';
import { Model, parent, Provider, render, Singleton, tap, use } from './adapter';

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

    const error = Instruct.ParentRequired(
      Detatched.name, NonStandalone.name
    )

    expect(attempt).toThrowError(error);
  })

  it("throws if parent is of incorrect type", () => {
    class Expected extends Model {}
    class Unexpected extends Model {
      child = use(Adopted as any) as Adopted;
    }
    class Adopted extends Model {
      expects = parent(Expected);
    }

    const attempt = () => 
      Unexpected.create();

    const error = Instruct.UnexpectedParent(
      Expected.name, Adopted.name, Unexpected.name
    )

    expect(attempt).toThrowError(error);
  })
});

describe("Peers", () => {
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

    const issue = Peers.AmbientRequired(Bar.name, Foo.name, "bar");
    const useStrictFooBar = () => Foo.use().bar;

    const TestComponent = () => {
      expect(useStrictFooBar).toThrow(issue);
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

    expect(attempt).toThrow(issue);
  })

  it.todo("can access peers sharing same provider");
})