import { describe, expect, it, vi } from 'vitest';

import { Component, Provider, State, lazy, pending, render } from './index';
import { flushMicrotasks, mockPromise } from '../test.setup';

describe('suspense and recovery', () => {
  it('will show a Component fallback until a lazy view resolves', async () => {
    const loaded = mockPromise<{ default: () => Component.Node }>();
    const Lazy = lazy(() => loaded);

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

  it('will let a Provider own a lazy fallback', async () => {
    class Session extends State {}
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);
    const root = document.createElement('main');

    render(
      <Provider for={Session} fallback={<i>waiting</i>}>
        <Lazy />
      </Provider>,
      root
    );
    expect(root.textContent).toBe('waiting');

    loaded.resolve(() => <span>done</span>);
    await flushMicrotasks();
    expect(root.textContent).toBe('done');
  });

  it('will replace a whole boundary with one fallback', async () => {
    const first = mockPromise<() => Component.Node>();
    const second = mockPromise<() => Component.Node>();
    const First = lazy(() => first);
    const Second = lazy(() => second);

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
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);

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

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);
    expect(root.textContent).toBe('loading');

    app.label.text = 'after';
    await flushMicrotasks();
    expect(root.textContent).toBe('loading');

    loaded.resolve(() => <span>!</span>);
    await flushMicrotasks();
    expect(root.textContent).toBe('after!');
  });

  it('will reveal a boundary when its suspended content unmounts', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);

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

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);
    expect(root.textContent).toBe('loading');

    app.show = false;
    await flushMicrotasks();
    expect(root.textContent).toBe('ready');
  });

  it('will drop a suspended boundary removed by its parent', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);

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

    let outer!: Outer;
    const root = document.createElement('main');
    render(<Outer is={(value) => (outer = value)} />, root);
    expect(root.textContent).toBe('outerloading');

    outer.show = false;
    await flushMicrotasks();
    expect(root.textContent).toBe('outer');

    loaded.resolve(() => <b>late</b>);
    await flushMicrotasks();
    expect(root.textContent).toBe('outer');
  });

  it('will retry a transition which suspends from empty content', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);

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

    let app!: App;
    let settled = false;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);

    pending(() => {
      app.flag.on = true;
    }).then(() => (settled = true));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(root.textContent).toBe('stay');
    expect(settled).toBe(false);

    loaded.resolve(() => <b>lazy</b>);
    await flushMicrotasks();
    await flushMicrotasks();
    expect(root.textContent).toBe('staylazy');
    expect(settled).toBe(true);
  });

  it('will keep siblings consistent when a transition suspends mid-list', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);

    class App extends Component {
      next = false;
      fallback = <i>loading</i>;

      render() {
        return this.next
          ? <><b>new</b><Lazy /><i>tail</i></>
          : <><p>current</p></>;
      }
    }

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);

    pending(() => {
      app.next = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));

    loaded.resolve(() => <span>lazy</span>);
    await flushMicrotasks();
    await flushMicrotasks();
    expect(root.textContent).toBe('newlazytail');
    expect(root.querySelectorAll('b')).toHaveLength(1);
  });

  it('will retain committed content while a transition suspends', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);

    class App extends Component {
      next = false;
      fallback = <i>loading</i>;

      render() {
        return this.next ? <Lazy /> : <p>current</p>;
      }
    }

    let app!: App;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);

    let settled = false;

    pending(() => {
      app.next = true;
    }).then(() => (settled = true));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(root.textContent).toBe('current');
    expect(settled).toBe(false);

    loaded.resolve(() => <p>next</p>);
    await flushMicrotasks();
    await flushMicrotasks();
    expect(root.textContent).toBe('next');
    expect(settled).toBe(true);
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

    let app!: App;
    let settled = false;
    const root = document.createElement('main');
    render(<App is={(value) => (app = value)} />, root);

    pending(() => {
      app.next = true;
    }).then(() => (settled = true));
    await flushMicrotasks();
    expect(root.textContent).toBe('current');
    expect(settled).toBe(false);

    stage = 1;
    first.resolve();
    await flushMicrotasks();
    await flushMicrotasks();
    expect(root.textContent).toBe('current');
    expect(settled).toBe(false);

    stage = 2;
    second.resolve();
    await flushMicrotasks();
    await flushMicrotasks();
    expect(root.textContent).toBe('next');
    expect(settled).toBe(true);
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

  it('will clean an unmounted suspended scope before resolution', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);

    class App extends Component {
      fallback = <i>loading</i>;
      render() {
        return <Lazy />;
      }
    }

    const root = document.createElement('main');
    const release = render(<App />, root);
    release();
    loaded.resolve(() => <p>late</p>);
    await flushMicrotasks();

    expect(root.textContent).toBe('');
  });

  it('will settle pending work when a suspended scope unmounts', async () => {
    const loaded = mockPromise<() => Component.Node>();
    const Lazy = lazy(() => loaded);

    class App extends Component {
      next = false;
      fallback = <i>loading</i>;

      render() {
        return this.next ? <Lazy /> : <p>current</p>;
      }
    }

    let app!: App;
    let settled = false;
    const root = document.createElement('main');
    const release = render(<App is={(value) => (app = value)} />, root);

    pending(() => {
      app.next = true;
    }).then(() => (settled = true));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(settled).toBe(false);

    release();
    await flushMicrotasks();

    expect(settled).toBe(true);
    expect(root.textContent).toBe('');

    loaded.resolve(() => <p>late</p>);
    await flushMicrotasks();

    expect(settled).toBe(true);
    expect(root.textContent).toBe('');
  });

  it('will ignore a suspension rejected after unmount', async () => {
    const pending = mockPromise<void>();

    function Wait(): Component.Node {
      throw pending;
    }

    class App extends Component {
      fallback = <i>loading</i>;
      catch() {
        throw new Error('should not recover');
      }
      render() {
        return <Wait />;
      }
    }

    const root = document.createElement('main');
    const release = render(<App />, root);
    release();
    pending.reject(new Error('late'));
    await flushMicrotasks();

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

  it('will not retry a recovered Component after it unmounts', async () => {
    const recovery = mockPromise<void>();

    class App extends Component {
      fallback = <i>recovering</i>;

      catch() {
        return recovery;
      }

      render(): Component.Node {
        throw new Error('broken');
      }
    }

    const root = document.createElement('main');
    const release = render(<App />, root);
    release();
    recovery.resolve();
    await flushMicrotasks();

    expect(root.textContent).toBe('');
  });

  it('will ignore a failed recovery after unmount', async () => {
    const recovery = mockPromise<void>();

    class App extends Component {
      fallback = <i>recovering</i>;
      catch() {
        return recovery;
      }
      render(): Component.Node {
        throw new Error('broken');
      }
    }

    const root = document.createElement('main');
    const release = render(<App />, root);
    release();
    recovery.reject(new Error('late'));
    await flushMicrotasks();

    expect(root.textContent).toBe('');
  });
});
