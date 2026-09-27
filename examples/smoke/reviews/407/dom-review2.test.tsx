import { describe, expect, it, vi } from 'vitest';

import { Component, State, pending } from '@expressive/mvc';
import { lazy, render } from './index';
import { mockPromise } from '../test.setup';

const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

class Nav extends State {
  page = 'a';
  show = true;
}

describe('review 407 b', () => {
  it('F9 will apply a later transition to a scope whose batch-mate was unmounted', async () => {
    const gate = mockPromise<void>();

    function Title() {
      return <h1>{Nav.get().page}</h1>;
    }

    function Page() {
      const { page } = Nav.get();
      if (page == 'b') throw gate;
      return <p>{page}</p>;
    }

    function Body() {
      return Nav.get().show ? <Page /> : null;
    }

    class App extends Component {
      nav = new Nav();
      fallback = <i>loading</i>;
      render() {
        return <><Title /><Body /></>;
      }
    }

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);

    pending(() => { app.nav.page = 'b'; });
    await tick();

    app.nav.show = false;
    await tick();

    let settled = false;
    pending(() => { app.nav.page = 'c'; }).then(() => (settled = true));
    await tick();
    expect(root.textContent).toBe('c');
    expect(settled).toBe(true);
  });

  it('F10 will not mount content staged off-document when an urgent update reaches it', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);
    const seen: boolean[] = [];

    class Clock extends State {
      now = 0;
    }

    class Inner extends Component {
      mount() {
        seen.push(!!document.getElementById('inner'));
      }
      render() {
        return <span id="inner" />;
      }
    }

    function Chart() {
      return Clock.get().now > 0 ? <Inner /> : null;
    }

    function Swap() {
      return Nav.get().page == 'b' ? <><Chart /><Lazy /></> : null;
    }

    function A() {
      return Nav.get().page == 'a' ? <p>A</p> : null;
    }

    class App extends Component {
      nav = new Nav();
      clock = new Clock();
      fallback = <i>loading</i>;
      render() {
        return <div><A /><Swap /></div>;
      }
    }

    let app!: App;
    const root = document.body.appendChild(document.createElement('main'));
    render(<App is={(value) => (app = value)} />, root);

    pending(() => { app.nav.page = 'b'; });
    await tick();
    expect(root.textContent).toBe('A');

    app.clock.now = 1;
    await tick();
    expect(seen.every(Boolean)).toBe(true);

    loaded.resolve(() => <b>lazy</b>);
    await tick();
    expect(root.textContent).toBe('lazy');
    expect(seen).toEqual([true]);
  });

  it('F11 will mount staged children before parents, like initial render', async () => {
    const log: string[] = [];

    class Child extends Component {
      mount() {
        log.push('child');
        return () => log.push('child-');
      }
      render() {
        return <span ref={(n: Element | null) => n && log.push('ref')} />;
      }
    }

    class Parent extends Component {
      mount() {
        log.push('parent');
        return () => log.push('parent-');
      }
      render() {
        return <Child />;
      }
    }

    function Swap() {
      return Nav.get().page == 'b' ? <Parent /> : null;
    }

    class App extends Component {
      nav = new Nav();
      render() {
        return <Swap />;
      }
    }

    const initial: string[] = [];
    {
      const root = document.createElement('main');
      const unmount = render(<Parent />, root);
      initial.push(...log.splice(0));
      unmount();
      initial.push(...log.splice(0));
    }

    let app!: App;
    const root = document.body.appendChild(document.createElement('main'));
    const unmount = render(<App is={(value) => (app = value)} />, root);
    pending(() => { app.nav.page = 'b'; });
    await tick();
    unmount();
    expect(log).toEqual(initial);
  });

  it('F12 will eventually show the newest page once the superseded one resolves', async () => {
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
    pending(() => { app.nav.page = 'c'; }).then(() => (settled = true));
    await tick();
    gate.resolve();
    await tick();
    expect(root.textContent).toBe('c');
    expect(settled).toBe(true);
  });
});
