import { expect, it, mock } from 'bun:test';
import { Component } from './component';
import { Context } from './context';

it('will default fallback to null', () => {
  const foo = Component.new({});

  expect(foo.fallback).toBe(null);
});

it('will accept fallback as prop', () => {
  const foo = Component.new({ fallback: 'Loading' });

  expect(foo.fallback).toBe('Loading');
});

it('will render children by default', () => {
  const foo = Component.new({ children: 'hello' });

  expect(foo.render()).toBe('hello');
});

it('will render null without children', () => {
  const foo = Component.new({});

  expect(foo.render()).toBe(null);
});

it('will call is callback once with instance', () => {
  const is = mock();
  const foo = Component.new({ is });

  expect(is).toBeCalledWith(foo);
  expect(is).toHaveBeenCalledTimes(1);

  // ressigning props from another render.
  (foo as any).props = { is };

  expect(is).toHaveBeenCalledTimes(1);
});

it('will merge state when props reassigned', async () => {
  class Foo extends Component {
    value?: number = 10;
    other?: number = 1;
  }

  const foo = Foo.new({ value: 5, other: 2 });

  expect(foo.value).toBe(5);
  expect(foo.other).toBe(2);

  (foo as any).props = { value: 7 };
  await foo.set();

  expect(foo.value).toBe(7);
});

it('will reset omitted props on reassignment', async () => {
  class Foo extends Component {
    value?: number = 10;
    other?: number = 1;
  }

  const foo = Foo.new({ value: 5, other: 2 });

  (foo as any).props = { value: 7 };
  await foo.set();

  expect(foo.other).toBeUndefined();
});

// Seam: React may instantiate the class twice with the same props object
// (e.g. StrictMode / reconciliation) before init completes. The second
// construction must return the first instance, not a duplicate.
it('will dedupe construction by props object', () => {
  const props = { value: 1 };

  const a = new Component(props);
  const b = new Component(props);

  expect(b).toBe(a);
});

// Seam: React passes context as a constructor argument alongside props.
// Context instances must be filtered so they never apply as state overlays.
it('will ignore Context passed as constructor argument', () => {
  class Foo extends Component {
    value?: number = 10;
  }

  const foo = Foo.new({ value: 5 }, new Context() as any);

  expect(foo.value).toBe(5);
  expect(Object.keys(foo.get())).not.toContain('0');
});
