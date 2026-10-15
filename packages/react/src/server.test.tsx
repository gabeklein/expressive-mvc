import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Model } from '@expressive/mvc';
import { Component } from '.';

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
    class Store extends Model {
      value = 5;
      protected new() {
        ran = true;
        return () => {};
      }
    }
    const View = () => <span>{Store.use().value}</span>;

    expect(onServer(() => renderToString(<View />))).toContain('>5<');
    expect(ran).toBe(true);
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

  it('will share a declared global across requests', () => {
    class Flags extends Model {
      static global = true;
      enabled = false;
    }
    const Show = () => <i>{String(Flags.get().enabled)}</i>;

    onServer(() => {
      const flags = Flags.new();
      const a = renderToString(<Show />);

      flags.enabled = true;

      expect(a).toContain('false');
      expect(renderToString(<Show />)).toContain('true');

      flags.set(null);
    });
  });
});
