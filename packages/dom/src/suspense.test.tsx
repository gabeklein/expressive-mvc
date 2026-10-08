import { describe, expect, it, vi } from 'vitest';

import { Component, State, pending, set } from '@expressive/mvc';
import { Portal, render } from './index';
import { flushMicrotasks, lazy, mockPromise, mount, track, html, until } from '../test.setup';

describe('suspense and recovery', () => {
  it('will show a Component fallback until a loaded view resolves', async () => {
    const [Lazy, loaded] = lazy<{ default: () => Component.Node }>();

    class App extends Component {
      fallback = <i>loading</i>;

      render() {
        return <Lazy />;
      }
    }

    const root = document.createElement('main');
    render(<App />, root);
    expect(root.textContent).toBe('loading');

    loaded.resolve({ default: () => <strong>ready</strong> });
    await flushMicrotasks();
    expect(root.textContent).toBe('ready');
  });

  it('will load a failed load again when catch resolves', async () => {
    let attempt = 0;
    let retry!: () => void;
    const caught: string[] = [];
    const Lazy = () =>
      ++attempt == 1
        ? Promise.reject(new Error('chunk'))
        : Promise.resolve(() => <b>ready</b>);

    class Page extends State {
      fallback = <i>wait</i>;

      catch(error: Error) {
        caught.push(error.message);
        return new Promise<void>((resolve) => (retry = resolve));
      }

      render() {
        return <Lazy />;
      }
    }

    const root = document.createElement('main');
    render(<Page />, root);

    await flushMicrotasks();
    expect(caught).toEqual(['chunk']);
    expect(root.textContent).toBe('wait');

    retry();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(attempt).toBe(2);
    expect(caught).toEqual(['chunk']);
    expect(root.textContent).toBe('ready');
  });

  it('will report a failed load without a catch, not reject unhandled', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Lazy = () => Promise.reject(new Error('chunk'));
    const root = document.createElement('main');

    render(<Component fallback={<i>wait</i>}><Lazy /></Component>, root);

    await flushMicrotasks();
    await flushMicrotasks();

    expect(error.mock.calls.flat().some((x) => String(x).includes('chunk'))).toBe(true);
    error.mockRestore();
  });

  it.each([
    ['Component for', { for: class Session extends State {} }],
    ['bare Component', {}]
  ])('will let %s own a loader fallback', async (_, props) => {
    const [Lazy, loaded] = lazy();
    const root = document.createElement('main');

    render(<Component {...(props as {})} fallback={<i>waiting</i>}><Lazy /></Component>, root);
    expect(root.textContent).toBe('waiting');

    loaded.resolve(() => <span>done</span>);
    await flushMicrotasks();
    expect(root.textContent).toBe('done');
  });

  it('will replace a whole boundary with one fallback', async () => {
    const first = mockPromise<() => Component.Node>();
    const second = mockPromise<() => Component.Node>();
    const First = () => first;
    const Second = () => second;

    class App extends Component {
      fallback = <i>loading</i>;

      render() {
        return (
          <div>
            <h1>title</h1>
            <First />
            <Second />
          </div>
        );
      }
    }

    const root = document.createElement('main');
    render(<App />, root);
    expect(root.textContent).toBe('loading');

    first.resolve(() => <span>first</span>);
    await flushMicrotasks();
    expect(root.textContent).toBe('loading');

    second.resolve(() => <span>second</span>);
    await flushMicrotasks();
    expect(root.textContent).toBe('titlefirstsecond');
  });

  it('will keep hidden content live until it reveals', async () => {
    const [Lazy, loaded] = lazy();

    class Label extends State {
      text = 'before';
    }

    function Text() {
      return <b>{Label.get().text}</b>;
    }

    class App extends Component {
      label = new Label();
      fallback = <i>loading</i>;

      render() {
        return <><Text /><Lazy /></>;
      }
    }

    const [app, root] = mount(App);
    expect(root.textContent).toBe('loading');

    app.label.text = 'after';
    await flushMicrotasks();
    expect(root.textContent).toBe('loading');

    loaded.resolve(() => <span>!</span>);
    await flushMicrotasks();
    expect(root.textContent).toBe('after!');
  });

  it('will reveal a boundary when its suspended content unmounts', async () => {
    const [Lazy] = lazy();

    function Spinner() {
      return <i>loading</i>;
    }

    class App extends Component {
      show = true;
      fallback = <Spinner />;

      render() {
        return <><p>ready</p>{this.show && <Lazy />}</>;
      }
    }

    const [app, root] = mount(App);
    expect(root.textContent).toBe('loading');

    app.show = false;
    await flushMicrotasks();
    expect(root.textContent).toBe('ready');
  });

  it('will drop a suspended boundary removed by its parent', async () => {
    const [Lazy, loaded] = lazy();

    class Inner extends Component {
      fallback = <i>loading</i>;

      render() {
        return <Lazy />;
      }
    }

    class Outer extends Component {
      show = true;
      fallback = false as const;

      render() {
        return <><p>outer</p>{this.show && <Inner />}</>;
      }
    }

    const [outer, root] = mount(Outer);
    expect(root.textContent).toBe('outerloading');

    outer.show = false;
    await flushMicrotasks();
    expect(root.textContent).toBe('outer');

    loaded.resolve(() => <b>late</b>);
    await flushMicrotasks();
    expect(root.textContent).toBe('outer');
  });

  it('will retry a transition which suspends from empty content', async () => {
    const [Lazy, loaded] = lazy();

    class Flag extends State {
      on = false;
    }

    function Maybe() {
      return Flag.get().on ? <Lazy /> : null;
    }

    class App extends Component {
      flag = new Flag();
      fallback = <i>loading</i>;

      render() {
        return <><p>stay</p><Maybe /></>;
      }
    }

    const [app, root] = mount(App);

    const settled = track(pending(() => (app.flag.on = true)));
    await until(() => expect(Lazy).toHaveBeenCalled());
    expect(root.textContent).toBe('stay');
    expect(settled()).toBe(false);

    loaded.resolve(() => <b>lazy</b>);
    await flushMicrotasks();
    await flushMicrotasks();
    expect(root.textContent).toBe('staylazy');
    expect(settled()).toBe(true);
  });

  describe('a transition revealing State that loads', () => {
    let root: HTMLElement;
    let lives: string[];

    function setup() {
      const loaded = mockPromise<string>();
      lives = [];

      class Data extends State {
        value = set(() => loaded);

        protected new() {
          lives.push('new');
          return () => lives.push('gone');
        }

        mount() {
          lives.push(`mount: ${root.textContent}`);
        }
      }

      return { loaded, lives, Data };
    }

    async function reveal(Child: () => Component.Node, wrap = false) {
      class App extends Component {
        open = false;
        fallback = <i>loading</i>;

        render() {
          if (!this.open) return <p>closed</p>;
          return wrap ? <section><h2>title</h2><Child /></section> : <Child />;
        }
      }

      const [app, main] = mount(App);
      root = main;
      pending(() => (app.open = true));
      await until(() => expect(lives).toContain('new'));

      return root;
    }

    it('will keep a State.use() instance and commit once it loads', async () => {
      const { loaded, lives, Data } = setup();
      const root = await reveal(() => <b>{Data.use().value}</b>);

      expect(root.textContent).toBe('closed');

      loaded.resolve('ready');
      await until(() => expect(root.textContent).toBe('ready'));

      expect(lives).toEqual(['new', 'mount: ready']);
    });

    it('will keep a State element and commit once it loads', async () => {
      const { loaded, lives, Data } = setup();

      class Panel extends State {
        data = new Data();

        mount() {
          lives.push(`panel mount: ${root.textContent}`);
        }

        render() {
          return <b>{this.data.value}</b>;
        }
      }

      const root = await reveal(() => <Panel />);

      expect(root.textContent).toBe('closed');

      loaded.resolve('ready');
      await until(() => expect(root.textContent).toBe('ready'));

      expect(lives).toEqual(['new', 'panel mount: ready']);
    });

    it('will hold new markup around it off the page until it loads', async () => {
      const { loaded, lives, Data } = setup();
      const root = await reveal(() => <b>{Data.use().value}</b>, true);

      expect(root.textContent).toBe('closed');
      expect(root.querySelector('section')).toBeNull();

      loaded.resolve('ready');
      await until(() => expect(html(root)).toBe('<section><h2>title</h2><b>ready</b></section>'));

      expect(lives).toEqual(['new', 'mount: titleready']);
    });
  });

  it('will hold the current content while new siblings wait on one that loads', async () => {
    const [Lazy, loaded] = lazy();
    const mounted: string[] = [];

    class Tab extends State {
      mount() {
        mounted.push(root.textContent!);
      }

      render() {
        return <b>new</b>;
      }
    }

    class App extends Component {
      next = false;
      fallback = <i>loading</i>;

      render() {
        return this.next ? <><Tab /><Lazy /><u>tail</u></> : <><p>current</p></>;
      }
    }

    const [app, root] = mount(App);

    pending(() => (app.next = true));
    await until(() => expect(Lazy).toHaveBeenCalled());

    expect(html(root)).toBe('<p>current</p>');
    expect(mounted).toEqual([]);

    loaded.resolve(() => <s>lazy</s>);
    await until(() => expect(html(root)).toBe('<b>new</b><s>lazy</s><u>tail</u>'));

    expect(mounted).toEqual(['newlazytail']);
  });

  it('will show content a transition updates in place while new content it adds is held', async () => {
    const [Lazy, loaded] = lazy();

    class App extends Component {
      count = 1;
      fallback = <i>loading</i>;

      render() {
        return <><b>count {this.count}</b>{this.count > 1 && <Lazy />}</>;
      }
    }

    const [app, root] = mount(App);

    pending(() => (app.count = 2));
    await until(() => expect(root.textContent).toBe('count 2'));

    loaded.resolve(() => <s>lazy</s>);
    await until(() => expect(root.textContent).toBe('count 2lazy'));
  });

  it('will not mount new content a failing transition discards', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mounted = vi.fn();

    class Tab extends State {
      mount = mounted;

      render() {
        return <b>tab</b>;
      }
    }

    const Boom = (): Component.Node => {
      throw new Error('boom');
    };

    class Panel extends State {
      render() {
        return <><Tab /><Boom /></>;
      }
    }

    class App extends Component {
      open = false;

      render() {
        return this.open ? <Panel /> : <p>closed</p>;
      }
    }

    const [app, root] = mount(App);

    pending(() => (app.open = true));
    await until(() => expect(error).toHaveBeenCalledWith(new Error('boom')));

    expect(root.textContent).toBe('closed');
    expect(mounted).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('will hold a sibling swap until the incoming scope renders', async () => {
    const gate = mockPromise<void>();
    let open = false;
    gate.then(() => (open = true));

    class Nav extends State {
      page = 'a';
    }

    function A() {
      return Nav.get().page == 'a' ? <p>A</p> : null;
    }

    const B = vi.fn((): Component.Node => {
      if (Nav.get().page != 'b') return null;
      if (!open) throw gate;
      return <p>B</p>;
    });

    class App extends Component {
      nav = new Nav();
      fallback = <i>loading</i>;

      render() {
        return <div><A /><B /></div>;
      }
    }

    const [app, root] = mount(App);

    const settled = track(pending(() => (app.nav.page = 'b')));
    await until(() => expect(B).toHaveBeenCalledTimes(2));
    expect(root.textContent).toBe('A');
    expect(settled()).toBe(false);

    gate.resolve();
    await until(() => {
      expect(root.textContent).toBe('B');
      expect(settled()).toBe(true);
    });
  });

  it('will hold a sibling swap when the incoming scope suspends below its render', async () => {
    const [Lazy, loaded] = lazy();

    class Nav extends State {
      page = 'a';
    }

    function A() {
      return Nav.get().page == 'a' ? <p>A</p> : null;
    }

    function B() {
      return Nav.get().page == 'b' ? <><h2>B</h2><Lazy /></> : null;
    }

    class App extends Component {
      nav = new Nav();
      fallback = <i>loading</i>;

      render() {
        return <div><A /><B /></div>;
      }
    }

    const [app, root] = mount(App);

    pending(() => (app.nav.page = 'b'));
    await until(() => expect(Lazy).toHaveBeenCalled());
    expect(root.textContent).toBe('A');
    expect(root.querySelector('h2')).toBeNull();

    loaded.resolve(() => <b>lazy</b>);
    await until(() => expect(root.textContent).toBe('Blazy'));
  });

  it('will mount staged transition content once it is in the document', async () => {
    const seen: string[] = [];
    const connected = () => !!document.querySelector('#chart');

    class Nav extends State {
      page = 'a';
    }

    class Probe extends State {
      mount() {
        seen.push(`use ${connected()}`);
      }
    }

    class Chart extends Component {
      mount() {
        seen.push(`mount ${connected()}`);
      }

      render() {
        return <div id="chart" ref={(node) => node && seen.push(`ref ${connected()}`)} />;
      }
    }

    function Page() {
      Probe.use();
      return <section><Chart /></section>;
    }

    function Swap() {
      return Nav.get().page == 'b' ? <Page /> : null;
    }

    class App extends Component {
      nav = new Nav();

      render() {
        return <Swap />;
      }
    }

    const [app] = mount(App, {}, document.body.appendChild(document.createElement('main')));

    pending(() => (app.nav.page = 'b'));
    await until(() => expect(seen).toEqual(['ref true', 'mount true', 'use true']));
  });

  it('will not mount staged content dropped before it is inserted', async () => {
    const gate = mockPromise<void>();
    const mounted = vi.fn();
    const attached = vi.fn();

    class Nav extends State {
      page = 'a';
    }

    class Child extends Component {
      mount() {
        mounted();
      }

      render() {
        return <i ref={attached} />;
      }
    }

    const Wait = vi.fn((): Component.Node => {
      throw gate;
    });

    function Swap() {
      const { page } = Nav.get();
      return page == 'b' ? <><Child /><Wait /></> : null;
    }

    class App extends Component {
      nav = new Nav();
      shown = true;

      render() {
        return this.shown ? <Swap /> : null;
      }
    }

    const [app] = mount(App, {}, document.body.appendChild(document.createElement('main')));

    pending(() => (app.nav.page = 'b'));
    await until(() => expect(Wait).toHaveBeenCalled());

    app.shown = false;
    await flushMicrotasks();
    gate.resolve();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mounted).not.toHaveBeenCalled();
    expect(attached).not.toHaveBeenCalledWith(expect.anything());
  });

  describe('superseded and abandoned transitions', () => {
    class Nav extends State {
      page = 'a';
      show = true;
    }

    function setup() {
      const gate = mockPromise<void>();

      function Title() {
        return <h1>{Nav.get().page}</h1>;
      }

      const Page = vi.fn((): Component.Node => {
        const { page } = Nav.get();
        if (page == 'b') throw gate;
        return <p>{page}</p>;
      });

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

      const [app, root] = mount(App);
      const go = (page: string) => track(pending(() => (app.nav.page = page)));
      const held = () => until(() => expect(Page.mock.results.at(-1)?.type).toBe('throw'));
      return { root, go, held, nav: app.nav };
    }

    it('will render a newer transition without waiting on a held one', async () => {
      const { root, go, held } = setup();

      go('b');
      await held();
      expect(root.textContent).toBe('aa');

      const settled = go('c');
      await until(() => {
        expect(root.textContent).toBe('cc');
        expect(settled()).toBe(true);
      });
    });

    it('will settle a transition back to the current page', async () => {
      const { root, go, held } = setup();

      go('b');
      await held();

      const settled = go('a');
      await until(() => {
        expect(root.textContent).toBe('aa');
        expect(settled()).toBe(true);
      });
    });

    it('will release a held batch when the scope holding it unmounts', async () => {
      const { root, go, held, nav } = setup();

      const settled = go('b');
      await held();
      expect(root.textContent).toBe('aa');

      nav.show = false;
      await until(() => {
        expect(root.textContent).toBe('b');
        expect(settled()).toBe(true);
      });
    });

    it('will take a later transition after the holding scope unmounts', async () => {
      const { root, go, held, nav } = setup();

      go('b');
      await held();
      nav.show = false;
      await until(() => expect(root.textContent).toBe('b'));

      const settled = go('c');
      await until(() => {
        expect(root.textContent).toBe('c');
        expect(settled()).toBe(true);
      });
    });
  });

  it('will hold a descendant while its parent suspends in a transition', async () => {
    const gate = mockPromise<void>();
    let open = false;
    gate.then(() => (open = true));

    class Nav extends State {
      page = 'a';
    }

    function Child() {
      return <p>{Nav.get().page}</p>;
    }

    const Guard = vi.fn((): Component.Node => {
      if (Nav.get().page == 'b' && !open) throw gate;
      return <Child />;
    });

    class App extends Component {
      nav = new Nav();
      fallback = <i>loading</i>;

      render() {
        return <Guard />;
      }
    }

    const [app, root] = mount(App);

    pending(() => (app.nav.page = 'b'));
    await until(() => expect(Guard.mock.results.at(-1)?.type).toBe('throw'));
    expect(root.textContent).toBe('a');

    gate.resolve();
    await until(() => expect(root.textContent).toBe('b'));
  });

  it('will recover an error thrown while probing a transition', async () => {
    const caught = vi.fn();

    class Flag extends State {
      on = false;
    }

    function Broken() {
      if (Flag.get().on) throw new Error('broken');
      return <p>fine</p>;
    }

    class App extends Component {
      flag = new Flag();
      fallback = <i>failed</i>;

      catch(error: Error) {
        caught(error.message);
      }

      render() {
        return <Broken />;
      }
    }

    const [app] = mount(App);

    pending(() => (app.flag.on = true));
    await until(() => expect(caught).toHaveBeenCalledWith('broken'));
  });

  it('will retry a caught error once, then wait for an update', async () => {
    const caught = vi.fn();

    class Flag extends State {
      broken = true;
    }

    function Leaf() {
      if (Flag.get().broken) throw new Error('broken');
      return <b>fixed</b>;
    }

    class App extends Component {
      flag = new Flag();
      fallback = <i>recovering</i>;

      catch(error: Error) {
        caught(error.message);
      }

      render() {
        return <Leaf />;
      }
    }

    const [app, root] = mount(App);

    await flushMicrotasks();
    await flushMicrotasks();
    expect(caught).toHaveBeenCalledTimes(2);
    expect(root.textContent).toBe('recovering');

    app.flag.broken = false;
    await flushMicrotasks();
    expect(root.textContent).toBe('fixed');
  });

  it('will return to the nearest boundary after a caught error', async () => {
    const loaded = mockPromise<void>();

    class Mode extends State {
      stage = 0;
    }

    function Leaf() {
      const { stage } = Mode.get();
      if (stage == 0) throw new Error('once');
      if (stage == 2) throw loaded;
      return <b>leaf</b>;
    }

    class Outer extends Component {
      mode = new Mode();
      fallback = <i>outer</i>;

      catch() {
        this.mode.stage = 1;
      }

      render() {
        return <Component for={this.mode} fallback={<i>inner</i>}><Leaf /></Component>;
      }
    }

    const [outer, root] = mount(Outer);

    await flushMicrotasks();
    await flushMicrotasks();
    expect(root.textContent).toBe('leaf');

    outer.mode.stage = 2;
    await flushMicrotasks();
    expect(root.textContent).toBe('inner');
  });

  it('will hide portal content while its boundary shows a fallback', async () => {
    const [Lazy, loaded] = lazy();
    const target = document.createElement('aside');

    class App extends Component {
      fallback = <i>loading</i>;
      extra = true;

      render() {
        return <><Portal into={target}><b>modal</b></Portal>{this.extra && <Portal into={target}><u>extra</u></Portal>}<Lazy /></>;
      }
    }

    const [app, root] = mount(App);
    expect(root.textContent).toBe('loading');
    expect(target.textContent).toBe('');

    app.extra = false;
    await flushMicrotasks();
    loaded.resolve(() => <span>ready</span>);
    await flushMicrotasks();
    expect(root.textContent).toBe('ready');
    expect(target.textContent).toBe('modal');
  });

  it('will create SVG content resolved while its boundary is hidden', async () => {
    const [Lazy, loaded] = lazy();

    class Chart extends Component {
      render() {
        return <Lazy />;
      }
    }

    const root = document.createElement('main');
    render(<svg><Chart /><foreignObject><div /></foreignObject></svg>, root);

    loaded.resolve(() => <circle r="1" />);
    await flushMicrotasks();
    expect(root.querySelector('circle')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(root.querySelector('div')!.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
  });

  it('will suspend on a non-native thenable', async () => {
    let resolve!: () => void;
    let ready = false;
    const thenable = {
      then(done: () => void) {
        resolve = () => {
          ready = true;
          done();
        };
      }
    };

    function Leaf() {
      if (!ready) throw thenable;
      return <b>ready</b>;
    }

    class App extends Component {
      fallback = <i>loading</i>;

      render() {
        return <Leaf />;
      }
    }

    const root = document.createElement('main');
    render(<App />, root);
    expect(root.textContent).toBe('loading');

    resolve();
    await flushMicrotasks();
    expect(root.textContent).toBe('ready');
  });

  it('will re-render a prop-driven child at the priority of a deferred patch', async () => {
    class Child extends Component {
      label = '';

      render() {
        return <span>{this.label}</span>;
      }
    }

    class Parent extends Component {
      label = 'a';

      render() {
        return <Child label={this.label} />;
      }
    }

    const [parent, root] = mount(Parent);

    const settled = pending(() => (parent.label = 'b'));
    expect(root.textContent).toBe('a');

    await settled;
    expect(root.textContent).toBe('b');
  });

  it('will retain committed content until repeated suspension settles', async () => {
    const first = mockPromise<void>();
    const second = mockPromise<void>();
    let stage = 0;

    function Next() {
      if (stage == 0) throw first;
      if (stage == 1) throw second;
      return <p>next</p>;
    }

    class App extends Component {
      next = false;
      fallback = <i>loading</i>;

      render() {
        return this.next ? <Next /> : <p>current</p>;
      }
    }

    const [app, root] = mount(App);

    const settled = track(pending(() => (app.next = true)));
    await flushMicrotasks();
    expect(root.textContent).toBe('current');
    expect(settled()).toBe(false);

    stage = 1;
    first.resolve();
    await flushMicrotasks();
    await flushMicrotasks();
    expect(root.textContent).toBe('current');
    expect(settled()).toBe(false);

    stage = 2;
    second.resolve();
    await flushMicrotasks();
    await flushMicrotasks();
    expect(root.textContent).toBe('next');
    expect(settled()).toBe(true);
  });

  it('will invoke Component.catch and retry rendering', async () => {
    const caught = vi.fn();

    class App extends Component {
      failed = true;
      fallback = <i>recovering</i>;

      catch(error: Error) {
        caught(error.message);
        this.failed = false;
      }

      render() {
        if (this.failed) throw new Error('broken');
        return <p>recovered</p>;
      }
    }

    const root = document.createElement('main');
    render(<App />, root);
    expect(root.textContent).toBe('recovering');

    await flushMicrotasks();
    expect(caught).toHaveBeenCalledWith('broken');
    expect(root.textContent).toBe('recovered');
  });

  it.each([
    ['a load resolving', false, true],
    ['a suspension rejecting', false, false],
    ['a recovery resolving', true, true],
    ['a recovery rejecting', true, false]
  ])('will ignore %s after unmount', async (_, recover, resolve) => {
    const [Lazy, gate] = lazy();

    class App extends Component {
      fallback = <i>loading</i>;

      catch() {
        if (recover) return gate as Promise<any>;
        throw new Error('should not recover');
      }

      render() {
        if (recover) throw new Error('broken');
        if (resolve) return <Lazy />;
        throw gate;
      }
    }

    const [, root, release] = mount(App);
    release();

    if (resolve) gate.resolve(() => <p>late</p>);
    else gate.reject(new Error('late'));
    await flushMicrotasks();

    expect(root.textContent).toBe('');
  });

  it('will settle pending work when a suspended scope unmounts', async () => {
    const [Lazy, loaded] = lazy();

    class App extends Component {
      next = false;
      fallback = <i>loading</i>;

      render() {
        return this.next ? <Lazy /> : <p>current</p>;
      }
    }

    const [app, root, release] = mount(App);

    const settled = track(pending(() => (app.next = true)));
    await until(() => expect(Lazy).toHaveBeenCalled());
    expect(settled()).toBe(false);

    release();
    await flushMicrotasks();

    expect(settled()).toBe(true);
    expect(root.textContent).toBe('');

    loaded.resolve(() => <p>late</p>);
    await flushMicrotasks();

    expect(settled()).toBe(true);
    expect(root.textContent).toBe('');
  });

  it('will reject a promise without a boundary', () => {
    const pending = mockPromise<void>();

    function Wait(): Component.Node {
      throw pending;
    }

    const root = document.createElement('main');
    expect(() => render(<Wait />, root)).toThrow(pending);
    expect(root.textContent).toBe('');
  });

  it('will recover a rejected suspension through Component.catch', async () => {
    const pending = mockPromise<void>();
    const caught = vi.fn();

    function Wait(): Component.Node {
      throw pending;
    }

    class App extends Component {
      ready = false;
      fallback = <i>loading</i>;

      catch(error: Error) {
        caught(error.message);
        this.ready = true;
      }

      render() {
        return this.ready ? <p>ready</p> : <Wait />;
      }
    }

    const root = document.createElement('main');
    render(<App />, root);
    pending.reject(new Error('offline'));
    await flushMicrotasks();

    expect(caught).toHaveBeenCalledWith('offline');
    expect(root.textContent).toBe('ready');
  });

  it('will bubble an unhandled child error to its parent boundary', async () => {
    let failed = true;
    const caught = vi.fn((_message: string) => {
      failed = false;
    });

    class Child extends Component {
      render() {
        if (failed) throw new Error('child');
        return <p>restored</p>;
      }
    }

    class Parent extends Component {
      catch(error: Error) {
        caught(error.message);
      }

      render() {
        return <Child />;
      }
    }

    const root = document.createElement('main');
    render(<Parent />, root);
    await flushMicrotasks();

    expect(caught).toHaveBeenCalledWith('child');
    expect(root.textContent).toBe('restored');
  });

  it('will hold an escalated boundary until its catch completes', async () => {
    const handled = mockPromise<void>();

    class Inner extends Component {
      broken = true;

      async catch(error: Error) {
        this.broken = false;
        throw error;
      }

      render() {
        if (this.broken) throw new Error('broken');
        return <p>content</p>;
      }
    }

    class Outer extends Component {
      fallback = <i>outer</i>;

      catch() {
        return handled;
      }

      render() {
        return <Inner />;
      }
    }

    const root = document.createElement('main');
    render(<Outer />, root);
    await until(() => expect(root.textContent).toBe('outer'));

    handled.resolve();
    await until(() => expect(root.textContent).toBe('content'));
  });

  it('will stop at the last boundary when a catch rethrows', async () => {
    const caught = vi.fn();
    const rejected = vi.fn();
    const handler = (event: PromiseRejectionEvent | Event) => {
      rejected();
      event.preventDefault();
    };

    class Inner extends Component {
      fallback = <i>inner</i>;

      async catch(error: Error) {
        caught(error.message);
        throw error;
      }

      render(): Component.Node {
        throw new Error('broken');
      }
    }

    window.addEventListener('unhandledrejection', handler);
    process.on('unhandledRejection', rejected);

    try {
      const root = document.createElement('main');
      render(<Inner />, root);
      await until(() => expect(rejected).toHaveBeenCalled());

      expect(caught).toHaveBeenCalledOnce();
      expect(root.textContent).toBe('inner');
    } finally {
      window.removeEventListener('unhandledrejection', handler);
      process.off('unhandledRejection', rejected);
    }
  });

  it('will hold until the latest catch for a scope completes', async () => {
    const calls = [mockPromise<void>(), mockPromise<void>()];
    let count = 0;
    let inner!: Inner;

    class Inner extends Component {
      step = 0;

      render() {
        const { step } = this;
        if (step < 2) throw new Error(`broken ${step}`);
        return <p>content</p>;
      }
    }

    class Outer extends Component {
      fallback = <i>outer</i>;

      catch() {
        return calls[count++];
      }

      render() {
        return <Inner is={(value) => (inner = value)} />;
      }
    }

    const root = document.createElement('main');
    render(<Outer />, root);
    await flushMicrotasks();

    inner.step = 1;
    await flushMicrotasks();
    inner.step = 2;
    await flushMicrotasks();

    calls[0].resolve();
    await until(() => {
      expect(count).toBe(2);
      expect(root.textContent).toBe('outer');
    });

    calls[1].resolve();
    await until(() => expect(root.textContent).toBe('content'));
  });

  it('will pass a rejected recovery to the next boundary', async () => {
    let restored = false;
    const outer = vi.fn((_message: string) => {
      restored = true;
    });

    class Inner extends Component {
      catch() {
        return Promise.reject('escalated');
      }

      render() {
        if (!restored) throw 'initial';
        return <p>restored</p>;
      }
    }

    class Outer extends Component {
      catch(error: Error) {
        outer(error.message);
      }

      render() {
        return <Inner />;
      }
    }

    const root = document.createElement('main');
    render(<Outer />, root);
    await flushMicrotasks();

    expect(outer).toHaveBeenCalledWith('escalated');
    expect(root.textContent).toBe('restored');
  });

  it.fails('will not render a child its parent removes in the same transition', async () => {
    const seen: unknown[] = [];

    class Parent extends State {
      value?: { id: number } = { id: 1 };

      render() {
        return this.value ? <Child /> : <p>none</p>;
      }
    }

    const Child = () => {
      const { value } = Parent.get();
      seen.push(value);
      return <b>{value!.id}</b>;
    };

    let parent!: Parent;
    const root = document.createElement('main');

    render(<Parent is={(p) => (parent = p)} fallback={null} />, root);
    pending(() => (parent.value = undefined));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(root.textContent).toBe('none');
    expect(seen).toEqual([{ id: 1 }]);
  });

  describe('loader components', () => {
    it('will render the component a loader resolves with its props', async () => {
      const loaded = mockPromise<{ default: (props: { name: string }) => Component.Node }>();
      const load = vi.fn(() => loaded);
      const Greeting = () => load();
      const root = document.createElement('main');

      render(<Component fallback={<i>loading</i>}><Greeting name="Ada" /><Greeting name="Bob" /></Component>, root);
      expect(root.textContent).toBe('loading');

      loaded.resolve({ default: ({ name }) => <b>{name}</b> });
      await flushMicrotasks();

      expect(root.textContent).toBe('AdaBob');
      expect(load).toBeCalledTimes(1);

      render(<Greeting name="Cy" />, document.createElement('main'));
      expect(load).toBeCalledTimes(1);
    });

    it('will render a resolved State class', async () => {
      class Counter extends State {
        count = 0;

        render() {
          return <b>{this.count}</b>;
        }
      }

      const Lazy = () => Promise.resolve(Counter);
      const root = document.createElement('main');

      render(<Component fallback={<i>loading</i>}><Lazy count={3} /></Component>, root);

      await flushMicrotasks();
      await flushMicrotasks();
      expect(root.textContent).toBe('3');
    });

    it('will catch a loader resolving no component', async () => {
      const caught: string[] = [];
      const Page = () => Promise.resolve({} as { default: () => null });

      class App extends State {
        fallback = <i>wait</i>;

        catch(error: Error) {
          caught.push(error.message);
          return new Promise<void>(() => {});
        }

        render() {
          return <Page />;
        }
      }

      render(<App />, document.createElement('main'));
      await flushMicrotasks();
      await flushMicrotasks();

      expect(caught).toEqual(['Loader resolved no component.']);
    });

    it('will type attributes from the resolved component', () => {
      class Settings extends State {
        theme = 'dark';
      }

      const Fn = (props: { size: number }) => props.size;
      const Lazy = () => Promise.resolve({ default: Fn });
      const LazyState = () => Promise.resolve(Settings);
      const Arity = (_props: { id: number }) => Promise.resolve(Fn);

      void (() => [
        <Lazy size={1} />,
        <LazyState theme="light" />,
        // @ts-expect-error
        <LazyState theme={1} />,
        // @ts-expect-error
        <Arity id={1} />,
        // @ts-expect-error
        <Lazy size="x" />,
        // @ts-expect-error
        <Lazy />
      ]);
    });
  });
});
