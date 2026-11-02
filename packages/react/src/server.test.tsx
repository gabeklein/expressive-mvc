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

  it('will hold readiness until the request context pops', async () => {
    const ready = vi.fn();
    const settled = vi.fn();
    const teardown = vi.fn();
    const request = Context.root.push();
    let store!: Store;

    class Store extends Component {
      protected new() {
        return teardown;
      }

      render() {
        return <span>hello</span>;
      }
    }

    Store.on({ ready });

    const html = onServer(() =>
      renderToString(
        <Component for={request}>
          <Store is={(s: Store) => void (store = s)} />
        </Component>
      )
    );

    expect(html).toContain('hello');

    const readiness = store.get(() => {}).then(settled, settled);

    await flushMicrotasks();
    expect(settled).not.toBeCalled();

    request.pop();
    await readiness;

    expect(settled).toBeCalledWith(expect.objectContaining({ message: `${store} is destroyed.` }));
    expect(teardown).toBeCalledTimes(1);
    expect(ready).not.toBeCalled();
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
