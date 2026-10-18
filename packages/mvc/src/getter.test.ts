import { afterEach, describe, expect, it, vi } from 'vitest';

import { Context } from './context';
import { getter, provide } from './getter';
import { Model } from './state';

const release: (() => void)[] = [];

function register(provider: getter.Provider) {
  const done = provide(provider);
  release.push(done);
  return done;
}

afterEach(() => {
  release.forEach((done) => done());
  release.length = 0;
});

describe('standalone', () => {
  class Test extends Model {
    static readonly global = true;
    value = 1;
  }

  it('will look up from root without a provider', () => {
    const lookup = vi.fn((context: Context) => context);

    expect(getter(Test, lookup)).toBe(Context.root);
    expect(lookup).toBeCalledWith(Context.root);
  });

  it('will call provider with type, lookup and flag', () => {
    const lookup = vi.fn(() => 'value');
    const provider = vi.fn<getter.Provider>((_type, lookup) => lookup(new Context()));

    register(provider);

    expect(getter(Test, lookup, true)).toBe('value');
    expect(provider).toBeCalledWith(Test, lookup, expect.any(Function), true);
  });

  it('will run latest provider first', () => {
    const order: string[] = [];

    register((_type, _lookup, next) => {
      order.push('outer');
      return next();
    });

    register((_type, _lookup, next) => {
      order.push('inner');
      return next();
    });

    expect(getter(Test, (context) => context)).toBe(Context.root);
    expect(order).toEqual(['inner', 'outer']);
  });

  it('will not call provider once unregistered', () => {
    const provider = vi.fn<getter.Provider>((_type, _lookup, next) => next());
    const done = register(provider);

    done();
    done();

    getter(Test, () => undefined);

    expect(provider).not.toBeCalled();
  });

  it('will not cache a throw', () => {
    const context = new Context();
    let ready = false;

    register((_type, lookup) => lookup(context));

    const lookup = () => {
      if (!ready) throw new Error('not ready');
      return 'ready';
    };

    expect(() => getter(Test, lookup)).toThrow('not ready');

    ready = true;

    expect(getter(Test, lookup)).toBe('ready');
  });
});

describe('local', () => {
  class Foo extends Model {}

  class Bar extends Model {
    value = 'bar';
  }

  it('will look up from origin context without provider', () => {
    const provider = vi.fn<getter.Provider>((_type, _lookup, next) => next());
    const bar = new Bar();
    const foo = new Foo();

    register(provider);
    new Context(bar).push(foo);

    expect(foo.get(Bar)).toBe(bar);
    expect(provider).not.toBeCalled();
  });

  it('will pass origin to lookup', () => {
    const lookup = vi.fn(() => undefined);

    class Baz extends Model {
      static get(): any {
        return getter(this, lookup);
      }
    }

    const foo = Foo.new();
    const context = new Context(foo);

    foo.get(Baz);

    expect(lookup).toBeCalledWith(context, foo);
  });

  it('will subscribe a tracking origin', async () => {
    const context = new Context({ Foo, Bar });
    const bar = context.get(Bar);
    const effect = vi.fn();

    context.get(Foo).get((self) => {
      effect(self.get(Bar).value);
    });

    bar.value = 'baz';
    await expect(bar).toHaveUpdated();

    expect(effect).toBeCalledTimes(2);
    expect(effect).toHaveBeenLastCalledWith('baz');
  });

  it('will nest origins', () => {
    class Baz extends Model {
      static get(): any {
        return getter(this, (_context, from) => from!.get(Bar));
      }
    }

    const bar = new Bar();
    const foo = new Foo();

    new Context(bar).push(foo);

    expect(foo.get(Baz)).toBe(bar);
  });

  it('will keep origin for its own type', () => {
    const before = vi.fn();

    class Baz extends Model {
      static get(): any {
        before(Bar.get(false));
        return getter(this, (_context, from) => from);
      }
    }

    const foo = Foo.new();

    new Context(foo);

    expect(foo.get(Baz)).toBe(foo);
    expect(before).toBeCalledWith(undefined);
  });

  it('will be standalone after origin is claimed', () => {
    const after = vi.fn();

    class Baz extends Model {
      static get(): any {
        const found = getter(this, (_context, from) => from);
        after(getter(this, (_context, from) => from));
        return found;
      }
    }

    const foo = Foo.new();

    expect(foo.get(Baz)).toBe(foo);
    expect(after).toBeCalledWith(undefined);
  });
});
