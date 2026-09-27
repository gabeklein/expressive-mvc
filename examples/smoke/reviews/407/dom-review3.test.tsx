import { describe, expect, it } from 'vitest';

import { Component, State, pending } from '@expressive/mvc';
import { createPortal, render } from './index';
import { mockPromise } from '../test.setup';

const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

class Nav extends State {
  page = 'a';
  show = true;
}

describe('review 407 c', () => {
  it('F13 will settle a transition once the scope suspending it unmounts', async () => {
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

    let settled = false;
    pending(() => { app.nav.page = 'b'; }).then(() => (settled = true));
    await tick();

    app.nav.show = false;
    await tick();
    expect(root.textContent).toBe('b');
    expect(settled).toBe(true);
  });

  it('F14 will attach a ref inside a staged portal once connected', async () => {
    const seen: boolean[] = [];

    function Swap() {
      return Nav.get().page == 'b'
        ? <section>{createPortal(<dialog ref={(n: Element | null) => n && seen.push(n.isConnected)} />, document.body)}</section>
        : null;
    }

    class App extends Component {
      nav = new Nav();
      render() {
        return <Swap />;
      }
    }

    let app!: App;
    const root = document.body.appendChild(document.createElement('main'));
    render(<App is={(value) => (app = value)} />, root);

    pending(() => { app.nav.page = 'b'; });
    await tick();
    expect(seen).toEqual([true]);
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
  });
});
