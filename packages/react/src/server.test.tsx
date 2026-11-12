import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { flushMicrotasks } from '../test.setup';
import { Context, Model } from '@expressive/mvc';
import '.';
import { Component } from '@expressive/mvc';

function onServer<T>(fn: () => T): T {
  const saved = (globalThis as any).window;
  try {
    delete (globalThis as any).window;
    expect(typeof window).toBe('undefined');
    return fn();
  } finally {
    (globalThis as any).window = saved;
  }
}

describe('server render', () => {
  it('will run new() and render state', () => {
    let ran = false;
    class Store extends Component {
      value = 5;
      protected new() {
        ran = true;
        return () => {};
      }
      render() {
        return <span>{this.value}</span>;
      }
    }

    expect(onServer(() => renderToString(<Store />))).toContain('>5<');
    expect(ran).toBe(true);
  });

  it('will not run an effect from new()', async () => {
    const effect = vi.fn();

    class Store extends Component {
      protected new() {
        this.get(effect);
      }

      render() {
        return <span>hello</span>;
      }
    }

    expect(onServer(() => renderToString(<Store />))).toContain('hello');

    await flushMicrotasks();
    expect(effect).not.toBeCalled();
  });

  it('will not run ready handlers or resolve readiness', async () => {
    const ready = vi.fn();
    const resolved = vi.fn();
    let store!: Store;

    class Store extends Component {
      render() {
        return <span>hello</span>;
      }
    }

    Store.on({ ready });

    expect(onServer(() => renderToString(<Store is={(s: Store) => void (store = s)} />))).toContain('hello');

    store.get(() => {}).then(resolved, () => {});

    await flushMicrotasks();
    expect(ready).not.toBeCalled();
    expect(resolved).not.toBeCalled();
  });

  it('will end a request by popping its root context', async () => {
    const order: string[] = [];
    const rejected = vi.fn();
    let app!: App;
    let store!: Store;

    class Store extends Component {
      protected new() {
        return () => void order.push('store');
      }

      render() {
        return <span>store</span>;
      }
    }

    class App extends Component {
      protected new() {
        return () => void order.push('app');
      }

      render() {
        return <Store is={(s: Store) => void (store = s)} />;
      }
    }

    expect(onServer(() => renderToString(<App is={(a: App) => void (app = a)} />))).toContain('store');

    store.get(() => {}).then(undefined, rejected);
    Context.get(app)!.pop();

    await flushMicrotasks();
    expect(order).toEqual(['store', 'app']);
    expect(rejected).toBeCalledWith(expect.objectContaining({ message: `${store} is destroyed.` }));
  });

  it('will isolate provided state per request', () => {
    class Session extends Model {
      user = 'anon';
    }
    const Show = () => <b>{Session.get().user}</b>;

    const [r1, r2] = onServer(() => [
      renderToString(
        <Component for={Session} user="alice">
          <Show />
        </Component>
      ),
      renderToString(
        <Component for={Session} user="bob">
          <Show />
        </Component>
      )
    ]);

    expect(r1).toContain('alice');
    expect(r2).toContain('bob');
    expect(r2).not.toContain('alice');
  });

  it('will share an instance held in root across requests', () => {
    class Flags extends Model {
      enabled = false;
    }
    const Show = () => <i>{String(Flags.get().enabled)}</i>;

    onServer(() => {
      const flags = Flags.new(Context.root);
      const a = renderToString(<Show />);

      flags.enabled = true;

      expect(a).toContain('false');
      expect(renderToString(<Show />)).toContain('true');

      flags.set(null);
    });
  });
});
