import { describe, expect, it, vi } from 'vitest';

import { Component, State, pending } from '@expressive/mvc';
import { Provider, createPortal, lazy, render } from './index';
import { flushMicrotasks, mockPromise } from '../test.setup';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('review', () => {
  it('A1 will focus autofocus in transition content that suspends first', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);

    class Nav extends State { page = 'a'; }

    function Swap() {
      return Nav.get().page == 'b' ? <><input autofocus /><Lazy /></> : <p>A</p>;
    }

    class App extends Component {
      nav = new Nav();
      fallback = <i>loading</i>;
      render() { return <Swap />; }
    }

    let app!: App;
    const root = document.body.appendChild(document.createElement('main'));
    render(<App is={(value) => (app = value)} />, root);

    pending(() => { app.nav.page = 'b'; });
    await tick();
    expect(root.textContent).toBe('A');

    loaded.resolve(() => <b>lazy</b>);
    await tick();
    const input = root.querySelector('input')!;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    root.remove();
  });

  it('A2 will focus autofocus in plain staged transition content', async () => {
    class Nav extends State { page = 'a'; }
    function Swap() {
      return Nav.get().page == 'b' ? <input autofocus /> : null;
    }
    class App extends Component {
      nav = new Nav();
      render() { return <Swap />; }
    }
    let app!: App;
    const root = document.body.appendChild(document.createElement('main'));
    render(<App is={(value) => (app = value)} />, root);
    pending(() => { app.nav.page = 'b'; });
    await tick();
    expect(document.activeElement).toBe(root.querySelector('input'));
    root.remove();
  });

  it('A3 will focus autofocus rendered into a portal', async () => {
    const target = document.body.appendChild(document.createElement('aside'));
    class App extends Component {
      open = false;
      render() { return this.open ? createPortal(<input autofocus />, target) : null; }
    }
    let app!: App;
    const root = document.body.appendChild(document.createElement('main'));
    render(<App is={(value) => (app = value)} />, root);
    app.open = true;
    await flushMicrotasks();
    expect(document.activeElement).toBe(target.querySelector('input'));
    root.remove(); target.remove();
  });

  it('A4 will not refocus autofocus on update', async () => {
    class App extends Component {
      n = 0;
      render() { return <><input autofocus data-n={this.n} /><button /></>; }
    }
    let app!: App;
    const root = document.body.appendChild(document.createElement('main'));
    render(<App is={(value) => (app = value)} />, root);
    expect(document.activeElement).toBe(root.querySelector('input'));
    root.querySelector('button')!.focus();
    app.n++;
    await flushMicrotasks();
    expect(document.activeElement).toBe(root.querySelector('button'));
    root.remove();
  });

  it('S1 will remove tabindex from svg when unset', async () => {
    class App extends Component {
      on = true;
      render() { return <svg tabIndex={this.on ? 0 : undefined} />; }
    }
    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);
    const svg = root.querySelector('svg')!;
    expect(svg.getAttribute('tabindex')).toBe('0');
    app.on = false;
    await flushMicrotasks();
    expect(svg.hasAttribute('tabindex')).toBe(false);
  });

  it('S2 will render HTML inside foreignObject', () => {
    const root = document.createElement('main');
    render(<svg><foreignObject><div tabIndex={0} /></foreignObject></svg>, root);
    const div = root.querySelector('div')!;
    expect(div.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
    expect(div.getAttribute('tabindex')).toBe('0');
  });

  it('B1 will write contentEditable false as "false"', () => {
    const root = document.createElement('main');
    render(<div contentEditable={false} />, root);
    expect(root.querySelector('div')!.getAttribute('contenteditable')).toBe('false');
  });

  it('B2 will toggle data attr true -> undefined -> false', async () => {
    class App extends Component {
      v: boolean | undefined = true;
      render() { return <div data-x={this.v} aria-pressed={this.v} />; }
    }
    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);
    const div = root.querySelector('div')!;
    app.v = undefined; await flushMicrotasks();
    expect(div.hasAttribute('data-x')).toBe(false);
    expect(div.hasAttribute('aria-pressed')).toBe(false);
    app.v = false; await flushMicrotasks();
    expect(div.getAttribute('data-x')).toBe('false');
    expect(div.getAttribute('aria-pressed')).toBe('false');
  });
});
