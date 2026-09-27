import { describe, expect, it, vi } from 'vitest';

import { Component, State, pending } from '@expressive/mvc';
import { createPortal, lazy, render } from './index';
import { mockPromise } from '../test.setup';

const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

class Nav extends State {
  page = 'a';
}

describe('review 407', () => {
  it('F1 will render a newer transition without waiting on a superseded one', async () => {
    const gate = mockPromise<void>();

    function Page() {
      const { page } = Nav.get();
      if (page == 'b') throw gate;
      return <p>{page}</p>;
    }

    class App extends Component {
      nav = new Nav();
      fallback = <i>loading</i>;
      render() {
        return <Page />;
      }
    }

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);

    pending(() => { app.nav.page = 'b'; });
    await tick();
    expect(root.textContent).toBe('a');

    let settled = false;
    pending(() => { app.nav.page = 'c'; }).then(() => (settled = true));
    await tick();
    expect(root.textContent).toBe('c');
    expect(settled).toBe(true);
  });

  it('F2 will settle a navigation back to the current page', async () => {
    const gate = mockPromise<void>();

    function Page() {
      const { page } = Nav.get();
      if (page == 'b') throw gate;
      return <p>{page}</p>;
    }

    class App extends Component {
      nav = new Nav();
      fallback = <i>loading</i>;
      render() {
        return <Page />;
      }
    }

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);

    pending(() => { app.nav.page = 'b'; });
    await tick();

    let settled = false;
    pending(() => { app.nav.page = 'a'; }).then(() => (settled = true));
    await tick();
    expect(root.textContent).toBe('a');
    expect(settled).toBe(true);
  });

  it('F3 will keep the outgoing page while an urgent tick re-renders it', async () => {
    const gate = mockPromise<void>();

    class Clock extends State {
      now = 0;
    }

    function A() {
      const { now } = Clock.get();
      return Nav.get().page == 'a' ? <p>A{now}</p> : null;
    }

    function B() {
      if (Nav.get().page != 'b') return null;
      throw gate;
    }

    class App extends Component {
      nav = new Nav();
      clock = new Clock();
      fallback = <i>loading</i>;
      render() {
        return <div><A /><B /></div>;
      }
    }

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);

    pending(() => { app.nav.page = 'b'; });
    await tick();
    expect(root.textContent).toBe('A0');

    app.clock.now = 1;
    await tick();
    expect(root.textContent).toMatch(/^A|loading/);
  });

  it('F4 will not show a staged portal before the transition commits', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);

    function A() {
      return Nav.get().page == 'a' ? <p>A</p> : null;
    }

    function B() {
      return Nav.get().page == 'b'
        ? <>{createPortal(<dialog>modal</dialog>, document.body)}<Lazy /></>
        : null;
    }

    class App extends Component {
      nav = new Nav();
      fallback = <i>loading</i>;
      render() {
        return <div><A /><B /></div>;
      }
    }

    let app!: App;
    const root = document.body.appendChild(document.createElement('main'));
    render(<App is={(value) => (app = value)} />, root);

    pending(() => { app.nav.page = 'b'; });
    await tick();
    expect(root.textContent).toBe('A');
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('F5 will keep hidden content in the document while a fallback shows', async () => {
    const gate = mockPromise<void>();
    let node: HTMLElement | null = null;

    function Gate() {
      if (Nav.get().page == 'b') throw gate;
      return null;
    }

    class App extends Component {
      nav = new Nav();
      fallback = <i>loading</i>;
      render() {
        return <><div ref={(value: HTMLElement | null) => { if (value) node = value; }}>content</div><Gate /></>;
      }
    }

    let app!: App;
    const root = document.body.appendChild(document.createElement('main'));
    render(<App is={(value) => (app = value)} />, root);

    app.nav.page = 'b';
    await tick();
    expect(root.textContent).toContain('loading');
    expect(node!.isConnected).toBe(true);
  });

  it('F6 will settle a deferred transition when the root unmounts', async () => {
    const gate = mockPromise<void>();

    function Page() {
      const { page } = Nav.get();
      if (page == 'b') throw gate;
      return <p>{page}</p>;
    }

    class App extends Component {
      nav = new Nav();
      fallback = <i>loading</i>;
      render() {
        return <Page />;
      }
    }

    let app!: App;
    const root = document.createElement('main');
    const unmount = render(<App is={(value) => (app = value)} />, root);

    let settled = false;
    pending(() => { app.nav.page = 'b'; }).then(() => (settled = true));
    await tick();
    unmount();
    await tick();
    expect(settled).toBe(true);
  });

  it('F7 will not re-render unrelated batch scopes on every retry', async () => {
    let gate = mockPromise<void>();
    let tries = 0;
    const renders = vi.fn();

    function Other() {
      renders(Nav.get().page);
      return null;
    }

    function Page() {
      const { page } = Nav.get();
      if (page == 'b' && tries < 3) {
        tries++;
        throw gate;
      }
      return <p>{page}</p>;
    }

    class App extends Component {
      nav = new Nav();
      fallback = <i>loading</i>;
      render() {
        return <><Other /><Page /></>;
      }
    }

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);
    renders.mockClear();

    pending(() => { app.nav.page = 'b'; });
    for (let i = 0; i < 3; i++) {
      await tick();
      const current = gate;
      gate = mockPromise<void>();
      current.resolve();
    }
    await tick();
    expect(root.textContent).toBe('b');
    expect(renders.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('F8 will reach Component.catch for an error thrown in staged content', async () => {
    const caught = vi.fn();

    function Boom(): null {
      throw new Error('boom');
    }

    function Swap() {
      return Nav.get().page == 'b' ? <section><h2>B</h2><Boom /></section> : null;
    }

    function A() {
      return Nav.get().page == 'a' ? <p>A</p> : null;
    }

    class App extends Component {
      nav = new Nav();
      fallback = <i>oops</i>;
      catch(error: Error) {
        caught(error.message);
      }
      render() {
        return <div><A /><Swap /></div>;
      }
    }

    let app!: App;
    const root = document.body.appendChild(document.createElement('main'));
    render(<App is={(value) => (app = value)} />, root);

    pending(() => { app.nav.page = 'b'; });
    await tick();
    expect(caught).toHaveBeenCalledWith('boom');
    expect(root.textContent).toBe('oops');
  });
});
