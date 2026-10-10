import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { State, Provider } from '.';

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
  it('renders a State component and runs new() as pure init', () => {
    let ran = false;
    class Store extends State {
      value = 5;
      protected new() {
        ran = true; // pure init - runs on the server
        return () => {};
      }
    }
    const View = () => <span>{Store.use().value}</span>;

    const html = onServer(() => renderToString(<View />));
    expect(html).toContain('>5<');
    expect(ran).toBe(true);
  });

  it('isolates Provider-scoped state across two requests (no bleed)', () => {
    class Session extends State {
      user = 'anon';
    }
    const Show = () => <b>{Session.get().user}</b>;

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
    const Show = () => <i>{String(Flags.get().enabled)}</i>;

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
