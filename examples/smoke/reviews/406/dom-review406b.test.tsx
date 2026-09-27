import { describe, expect, it, vi } from 'vitest';
import { Component, has } from '@expressive/mvc';
import { render } from './index';
import { flushMicrotasks } from '../test.setup';

class Item extends Component {
  name = '';
  render() { return <li>{this.name}</li>; }
}

describe('review 406 b', () => {
  it('H1 same instance rendered twice keeps both nodes', async () => {
    class P extends Component {
      panel = new Item({ name: 'x' } as any);
      tick = 0;
      render() { return <div data-t={this.tick}>{this.panel}{this.panel}</div>; }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    const [first, second] = root.querySelectorAll('li');
    p.tick++;
    await flushMicrotasks();
    const [a, b] = root.querySelectorAll('li');
    expect(root.textContent).toBe('xx');
    expect({ first: a === first, second: b === second }).toEqual({ first: true, second: true });
  });

  it('H2 same instance twice updates both copies', async () => {
    class P extends Component {
      panel = new Item({ name: 'x' } as any);
      render() { return <div>{this.panel}{this.panel}</div>; }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    p.panel.name = 'y';
    await flushMicrotasks();
    expect(root.textContent).toBe('yy');
  });

  it('O has.List of instances reordered by set keeps nodes', async () => {
    const a = new Item({ name: 'a' } as any);
    const b = new Item({ name: 'b' } as any);
    class P extends Component {
      list = has([a, b]);
      render() { return <ul>{this.list}</ul>; }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    const [la, lb] = root.querySelectorAll('li');
    p.list.set(0, b); p.list.set(1, a);
    await flushMicrotasks();
    expect(root.textContent).toBe('ba');
    expect([...root.querySelectorAll('li')]).toEqual([lb, la]);
  });

  it('P destroyed instance field child does not throw on parent re-render', async () => {
    class P extends Component {
      panel = new Item({ name: 'x' } as any);
      tick = 0;
      render() { return <div data-t={this.tick}>{this.panel}</div>; }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    const panel = p.panel;
    panel.set(null);
    await flushMicrotasks();
    p.tick++;
    await flushMicrotasks();
    expect(root.querySelector('div')!.dataset.t).toBe('1');
  });
});
