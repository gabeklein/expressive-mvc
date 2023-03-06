import React from 'react';

import { render, subscribeTo } from '../helper/testing';
import { Consumer } from './consumer';
import { Global } from './global';
import { MVC } from './mvc';
import { Provider } from './provider';
import { Oops, tap } from './tap';

describe("tap instruction", () => {
  class Foo extends MVC {
    bar = tap(Bar);
  }

  class Bar extends MVC {
    value = "bar";
  }

  it("will attach peer from context", () => {
    const bar = Bar.new();

    const Test = () => {
      const { bar } = Foo.use();
      expect(bar).toBe(bar);
      return null;
    }

    render(
      <Provider for={bar}>
        <Test />
      </Provider>
    );
  })

  it("will subscribe peer from context", async () => {
    class Foo extends MVC {
      bar = tap(Bar, true);
    }

    const bar = Bar.new();
    let foo!: Foo;

    const Child = () => {
      foo = Foo.use();
      return null;
    }

    render(
      <Provider for={bar}>
        <Child />
      </Provider>
    )

    const update = subscribeTo(foo, it => it.bar.value);

    bar.value = "foo";
    await update();
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
    class Foo extends MVC {
      bar = tap(Bar, true);
    }

    const expected = Oops.AmbientRequired(Bar.name, Foo.name, "bar");
    const useStrictFooBar = () => Foo.use().bar;

    const TestComponent = () => {
      expect(useStrictFooBar).toThrowError(expected);
      return null;
    }

    render(<TestComponent />);
  })
})

describe("callback", () => {
  class Foo extends MVC {}
  class Bar extends MVC {
    didTap = jest.fn();
    foo = tap(Foo, this.didTap);
  }

  it("will run on attachment of model", () => {
    render(
      <Provider for={Foo}>
        <Provider for={Bar}>
          <Consumer for={Bar} has={bar => {
            expect(bar.didTap).toBeCalledWith(expect.any(Foo));
          }}/>
        </Provider>
      </Provider>
    )
  })

  it("will pass undefined if not found", () => {
    render(
      <Provider for={Bar}>
        <Consumer for={Bar} has={bar => {
          expect(bar.didTap).toHaveBeenCalledWith(undefined);
        }}/>
      </Provider>
    )
  })

  it("will force undefined if returns false", () => {
    class Bar extends MVC {
      foo = tap(Foo, () => false);
    }

    render(
      <Provider for={Foo}>
        <Provider for={Bar}>
          <Consumer for={Bar} has={bar => {
            expect(bar.foo).toBe(undefined);
          }}/>
        </Provider>
      </Provider>
    )
  })

  it("will not run before first effect", () => {
    const didInit = jest.fn();

    class Bar extends MVC {
      constructor(){
        super();
        this.on(didInit, []);
      }

      foo = tap(Foo, () => {
        expect(didInit).toHaveBeenCalled();
      });
    }

    render(
      <Provider for={Foo}>
        <Provider for={Bar}>
          {null}
        </Provider>
      </Provider>
    )
  })

  it.todo("will suspend if required until processed")
  it.todo("will return undefined if not required")
  it.todo("will update key when resolved")
})

describe("singleton", () => {
  it("will attach to model", () => {
    class Foo extends MVC {
      global = tap(TestGlobal);
    }

    class TestGlobal extends Global {
      value = "bar";
    }

    TestGlobal.new();

    const Test = () => {
      const { global } = Foo.use();
      expect(global.value).toBe("bar");
      return null;
    }

    render(<Test />);
  })

  it("will attach to another singleton", () => {
    class Peer extends Global {}
    class Test extends Global {
      peer = tap(Peer);
    }

    const peer = Peer.new();
    const global = Test.new();    

    expect(global.peer).toBe(peer);
  })

  it("will throw if tries to attach Model", () => {
    class Normal extends MVC {}
    class TestGlobal extends Global {
      notPossible = tap(Normal);
    }

    const attempt = () => TestGlobal.new();
    const issue = Oops.NotAllowed(TestGlobal.name, Normal.name);

    expect(attempt).toThrowError(issue);
  })
})

describe("context", () => {
  class Foo extends MVC {
    bar = tap(Bar, true);
  };

  class Bar extends MVC {
    value = 1;
  };

  it("will assign multiple peers", async () => {
    class Foo extends MVC {
      value = 2;
    };

    class Multi extends MVC {
      bar = tap(Bar);
      foo = tap(Foo);
    };

    const Inner = () => {
      const { bar, foo } = Multi.use();

      expect(bar).toBeInstanceOf(Bar);
      expect(foo).toBeInstanceOf(Foo);

      return null;
    }

    render(
      <Provider for={{ Foo, Bar }}>
        <Inner />
      </Provider>
    );
  })

  it("will still access when created by provider", () => {
    render(
      <Provider for={Bar}>
        <Provider for={Foo}>
          <Consumer for={Foo} has={i => expect(i.bar).toBeInstanceOf(Bar)} />
        </Provider>
      </Provider>
    );
  })

  it("will access peers sharing same provider", () => {
    class Foo extends MVC {
      bar = tap(Bar, true);
    }
    class Bar extends MVC {
      foo = tap(Foo, true);
    }

    render(
      <Provider for={{ Foo, Bar }}>
        <Consumer for={Bar} has={i => expect(i.foo.bar).toBe(i)} />
        <Consumer for={Foo} has={i => expect(i.bar.foo).toBe(i)} />
      </Provider>
    );
  });

  it("will maintain hook", async () => {
    const didRender = jest.fn();

    const Inner = () => {
      Foo.use();
      didRender();
      return null;
    }

    const x = render(
      <Provider for={Bar}>
        <Inner />
      </Provider>
    );

    x.update(
      <Provider for={Bar}>
        <Inner />
      </Provider>
    );

    expect(didRender).toBeCalledTimes(2);
  })
})

describe("suspense", () => {
  it("will throw suspense if not resolved", () => {
    class Foo extends MVC {}
    class Bar extends MVC {
      foo = tap(Foo);
    }

    const bar = Bar.new();
    
    expect(() => bar.foo).toThrow(expect.any(Promise));

    render(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    expect(bar.foo).toBeInstanceOf(Foo);
  });

  it("will resolve when assigned to", async () => {
    class Foo extends MVC {}
    class Bar extends MVC {
      foo = tap(Foo);
    }

    const bar = Bar.new();
    let pending!: Promise<any>;

    try {
      void bar.foo;
    }
    catch(err: unknown){
      if(err instanceof Promise)
        pending = err;
    }
    
    expect(pending).toBeInstanceOf(Promise);

    render(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    await expect(pending).resolves.toBeUndefined();
  })

  it("will refresh an effect when assigned to", async () => {
    class Foo extends MVC {}
    class Bar extends MVC {
      foo = tap(Foo);
    }

    const bar = Bar.new();
    const effect = jest.fn(bar => void bar.foo);

    bar.on(effect);

    expect(effect).toHaveBeenCalled();
    expect(effect).not.toHaveReturned();

    render(
      <Provider for={Foo}>
        <Provider for={bar} />
      </Provider>
    );

    await bar.on();
    
    expect(effect).toHaveBeenCalledTimes(2);
    expect(effect).toHaveReturnedTimes(1);
  })
})