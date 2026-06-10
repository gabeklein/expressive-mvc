import { renderHook, render } from '@solidjs/testing-library';
import { describe, expect, it, mock } from 'bun:test';
import { createComponent, createSignal, JSX } from 'solid-js';

import { State, Consumer, Provider, get } from '.';

class Foo extends State {
  value = 'foo';
}
class Bar extends State {}

function provide(props: Record<string, unknown>, children?: () => JSX.Element) {
  return render(() =>
    createComponent(Provider, {
      ...props,
      get children() {
        return children && children();
      }
    } as any)
  );
}

describe('Provider', () => {
  it('will create instance of given model', () => {
    const didRender = mock((foo: State.Reactive<Foo>) => {
      expect(foo.is).toBeInstanceOf(Foo);
      return undefined;
    });

    provide({ for: Foo }, () =>
      createComponent(Consumer, { for: Foo, children: didRender })
    );

    expect(didRender).toBeCalled();
  });

  it('will create all models in given object', () => {
    const sawFoo = mock((foo: State.Reactive<Foo>) => void foo);
    const sawBar = mock((bar: State.Reactive<Bar>) => void bar);

    provide({ for: { Foo, Bar } }, () => [
      createComponent(Consumer, { for: Foo, children: sawFoo as any }),
      createComponent(Consumer, { for: Bar, children: sawBar as any })
    ]);

    expect(sawFoo).toBeCalled();
    expect(sawBar).toBeCalled();
  });

  it('will provide given instance', () => {
    const foo = Foo.new();
    const children = mock((got: State.Reactive<Foo>) => {
      expect(got.is).toBe(foo);
      return undefined;
    });

    provide({ for: foo }, () =>
      createComponent(Consumer, { for: Foo, children })
    );

    expect(children).toBeCalled();
  });

  it('will assign rest props to instance', () => {
    class Test extends State {
      foo = 'default';
      bar = 0;
    }

    const children = mock((test: State.Reactive<Test>) => {
      expect(test.foo()).toBe('hello');
      expect(test.bar()).toBe(42);
      return undefined;
    });

    provide({ for: Test, foo: 'hello', bar: 42 }, () =>
      createComponent(Consumer, { for: Test, children })
    );

    expect(children).toBeCalled();
  });

  it('will re-assign reactive rest props', () => {
    const test = Foo.new();
    const [value, setValue] = createSignal('hello');

    render(() =>
      createComponent(Provider, {
        for: test,
        get value() {
          return value();
        }
      } as any)
    );

    expect(test.value).toBe('hello');

    setValue('world');

    expect(test.value).toBe('world');
  });

  it('will ignore rest props for multiple models', () => {
    provide({ for: { Foo, Bar }, value: 'ignored' });
  });

  it('will call is callback with created instance', () => {
    const is = mock();

    provide({ for: Foo, is });

    expect(is).toBeCalledWith(expect.any(Foo));
  });

  it('will destroy created instance on unmount', () => {
    const didDestroy = mock();

    class Test extends State {
      protected new() {
        return didDestroy;
      }
    }

    const rendered = provide({ for: Test });

    expect(didDestroy).not.toBeCalled();

    rendered.unmount();

    expect(didDestroy).toBeCalled();
  });

  it('will not destroy given instance on unmount', () => {
    const foo = Foo.new();
    const rendered = provide({ for: foo });

    rendered.unmount();

    expect(() => (foo.value = 'bar')).not.toThrow();
  });

  it('will override upstream provider', () => {
    const foo = Foo.new();
    const inner = Foo.new();
    const children = mock((got: State.Reactive<Foo>) => {
      expect(got.is).toBe(inner);
      return undefined;
    });

    provide({ for: foo }, () =>
      createComponent(Provider, {
        for: inner,
        get children() {
          return createComponent(Consumer, { for: Foo, children });
        }
      } as any)
    );

    expect(children).toBeCalled();
  });
});

describe('Consumer', () => {
  it('will render output reactively', () => {
    const foo = Foo.new();
    const rendered = provide({ for: foo }, () =>
      createComponent(Consumer, {
        for: Foo,
        children: (got: State.Reactive<Foo>) => got.value as any
      })
    );

    expect(rendered.container.textContent).toBe('foo');

    foo.value = 'bar';

    expect(rendered.container.textContent).toBe('bar');
  });

  it('will throw if not found in context', () => {
    expect(() =>
      render(() =>
        createComponent(Consumer, {
          for: Foo,
          children: () => undefined
        })
      )
    ).toThrow('Could not find Foo in context.');
  });
});

describe('get instruction', () => {
  class Parent extends State {
    value = 'foo';
  }

  class Child extends State {
    parent = get(Parent);
  }

  it('will resolve parent provided by Provider', () => {
    const parent = Parent.new();
    const { result } = renderHook(() => Child.use(), {
      wrapper: (props: { children: JSX.Element }) =>
        createComponent(Provider, {
          for: parent,
          get children() {
            return props.children;
          }
        } as any)
    });

    expect(result.parent()).toBe(parent);
  });

  it('will throw if parent is not in context', () => {
    expect(() => renderHook(() => Child.use())).toThrow();
  });

  it('will collect downstream children', () => {
    class Item extends State {}

    class Registry extends State {
      items = get(Item, true);
    }

    let registry!: Registry;

    provide(
      {
        for: Registry,
        is: (got: Registry) => {
          registry = got;
        }
      },
      () =>
        createComponent(Provider, {
          for: Item,
          get children() {
            return undefined;
          }
        } as any)
    );

    expect(registry.items.length).toBe(1);
    expect(registry.items[0]).toBeInstanceOf(Item);
  });
});
