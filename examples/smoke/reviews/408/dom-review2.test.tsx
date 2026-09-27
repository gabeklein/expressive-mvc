import { describe, expect, it, vi } from 'vitest';

import { Component, State } from '@expressive/mvc';
import { render } from './index';
import { flushMicrotasks, mockPromise } from '../test.setup';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('review catch', () => {
  it('C1 will reveal when the failing child is removed while catch is pending', async () => {
    const never = mockPromise<void>();
    class Child extends Component {
      fallback = false as const;
      render(): Component.Node { throw new Error('bad'); }
    }
    class Outer extends Component {
      fallback = <i>outer</i>;
      show = true;
      catch() { return never; }
      render() { return <>{this.show ? <Child /> : null}<p>ok</p></>; }
    }
    let outer!: Outer;
    const root = document.createElement('main');
    render(<Outer is={(v) => (outer = v)} />, root);
    await tick();
    expect(root.textContent).toBe('outer');
    outer.show = false;
    await tick();
    expect(root.textContent).toBe('ok');
  });

  it('C2 will reveal after a sync-throwing catch escalates and parent recovers', async () => {
    class Fix extends State { broken = true; }
    const fix = Fix.new();
    class Inner extends Component {
      catch(error: Error): void { throw error; }
      render() {
        if (fix.broken) throw new Error('broken');
        return <p>content</p>;
      }
    }
    class Outer extends Component {
      fallback = <i>outer</i>;
      catch() { fix.broken = false; }
      render() { return <Inner />; }
    }
    const root = document.createElement('main');
    render(<Outer />, root);
    await tick();
    expect(root.textContent).toBe('content');
  });

  it('C3 will reveal once state fixes the render after an unhandled rethrow', async () => {
    class Fix extends State { broken = true; }
    const fix = Fix.new();
    class Inner extends Component {
      fallback = <i>inner</i>;
      async catch(error: Error) { throw error; }
      render() {
        if (fix.broken) throw new Error('broken');
        return <p>content</p>;
      }
    }
    const root = document.createElement('main');
    render(<Inner />, root);
    await tick();
    fix.broken = false;
    await tick();
    expect(root.textContent).toBe('content');
  });

  it('C4 will reveal when a recovered scope fails again and then recovers', async () => {
    let fails = 2;
    class Tick extends State { n = 0; }
    const t = Tick.new();
    class Inner extends Component {
      render() {
        t.n;
        if (fails-- > 0) throw new Error('broken');
        return <p>content</p>;
      }
    }
    class Outer extends Component {
      fallback = <i>outer</i>;
      async catch() {}
      render() { return <Inner />; }
    }
    const root = document.createElement('main');
    render(<Outer />, root);
    await tick();
    await tick();
    expect(root.textContent).toBe('content');
  });

  it('C5 will reveal after nested pending catches both settle', async () => {
    const inner = mockPromise<void>();
    const outer = mockPromise<void>();
    class Fix extends State { broken = true; }
    const fix = Fix.new();
    class Inner extends Component {
      fallback = <i>inner</i>;
      async catch(error: Error) { await inner; throw error; }
      render() {
        if (fix.broken) throw new Error('broken');
        return <p>content</p>;
      }
    }
    class Outer extends Component {
      fallback = <i>outer</i>;
      async catch() { await outer; fix.broken = false; }
      render() { return <Inner />; }
    }
    const root = document.createElement('main');
    render(<Outer />, root);
    await tick();
    inner.resolve();
    await tick();
    expect(root.textContent).toBe('outer');
    outer.resolve();
    await tick();
    expect(root.textContent).toBe('content');
  });
});
