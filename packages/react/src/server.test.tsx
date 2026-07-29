import { describe, it, expect } from 'bun:test';
import { renderToString } from 'react-dom/server';
import { State, Provider, Consumer } from '.';

// Simulate a server render: no DOM.
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

describe('SSR probe (no window)', () => {
  it('renders a State component without crashing', () => {
    class Counter extends State {
      value = 5;
    }
    const View = () => <span>{Counter.use().value}</span>;

    const html = onServer(() => renderToString(<View />));
    expect(html).toContain('>5<');
  });

  it('runs new() on the server as pure init', () => {
    let ran = false;
    class Store extends State {
      ready = 'ok';
      protected new() {
        ran = true; // pure init - runs on the server
        return () => {};
      }
    }
    const View = () => <span>{Store.use().ready}</span>;

    const html = onServer(() => renderToString(<View />));
    expect(ran).toBe(true);
    expect(html).toContain('ok');
  });

  it('isolates Provider-scoped state across two requests (no bleed)', () => {
    class Session extends State {
      user = 'anon';
    }
    const Show = () => (
      <Consumer for={Session}>{(s) => <b>{s.user}</b>}</Consumer>
    );

    const [r1, r2] = onServer(() => [
      renderToString(
        <Provider for={Session} user="alice">
          <Show />
        </Provider>
      ),
      renderToString(
        <Provider for={Session} user="bob">
          <Show />
        </Provider>
      )
    ]);

    expect(r1).toContain('alice');
    expect(r2).toContain('bob');
    expect(r2).not.toContain('alice'); // request 2 never sees request 1
  });

  it('CONFIRMS a declared global is shared across requests (docs caveat)', () => {
    class Flags extends State {
      static global = true;
      enabled = false;
    }
    const Show = () => (
      <Consumer for={Flags}>{(f) => <i>{String(f.enabled)}</i>}</Consumer>
    );

    onServer(() => {
      const flags = Flags.new(); // registers to shared root - even on server

      const a = renderToString(<Show />);
      flags.enabled = true; // mutate between "requests"
      const b = renderToString(<Show />);

      expect(a).toContain('false');
      expect(b).toContain('true'); // BLED - proves globals are process-shared

      flags.set(null);
    });
  });
});
