import { describe, expect, it, vi } from 'vitest';
import { Component, State, has, map } from '@expressive/mvc';
import { render } from './index';
import { flushMicrotasks } from '../test.setup';

class Item extends Component {
  name = '';
  order = 0;
  render() { return <li>{this.name}</li>; }
}

describe('review 406', () => {
  it('A nested has.List of has.List updates inner membership', async () => {
    const inner = new (has.List as any)(['x']);
    class Outer extends Component {
      rows = has<any>([inner]);
      render() { return <div>{this.rows}</div>; }
    }
    let o!: Outer;
    const root = document.createElement('main');
    render(<Outer is={(v) => (o = v)} />, root);
    expect(root.textContent).toBe('x');
    inner.push('y');
    await flushMicrotasks();
    expect(root.textContent).toBe('xy');
    o.rows.push(new (has.List as any)(['z']));
    await flushMicrotasks();
    expect(root.textContent).toBe('xyz');
  });

  it('B map.Managed of Components keeps nodes and updates child fields', async () => {
    class M extends Component {
      items = map<string, Item>();
      tick = 0;
      new() { this.items.set('a', new Item({ name: 'a' } as any)); this.items.set('b', new Item({ name: 'b' } as any)); }
      render() { return <ul data-t={this.tick}>{this.items}</ul>; }
    }
    let m!: M;
    const root = document.createElement('main');
    render(<M is={(v) => (m = v)} />, root);
    expect(root.textContent).toBe('ab');
    const [a, b] = root.querySelectorAll('li');
    m.tick++;
    await flushMicrotasks();
    expect([...root.querySelectorAll('li')]).toEqual([a, b]);
    (m.items.get('a') as Item).name = 'A';
    await flushMicrotasks();
    expect(root.textContent).toBe('Ab');
    expect(root.querySelectorAll('li')[0]).toBe(a);
  });

  it('C collection passed through props to a function child', async () => {
    const Show = (props: { items: has.List<string> }) => <p>{props.items}</p>;
    class P extends Component {
      list = has(['a']);
      render() { return <Show items={this.list} />; }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    expect(root.textContent).toBe('a');
    p.list.push('b');
    await flushMicrotasks();
    expect(root.textContent).toBe('ab');
  });

  it('D collection read through context by a descendant', async () => {
    class Store extends Component {
      list = has(Item);
      new() { this.list.add({ name: 'a' }); }
      render() { return <Child />; }
    }
    const Child = () => { const { list } = Store.get(); return <ul>{list}</ul>; };
    let s!: Store;
    const root = document.createElement('main');
    render(<Store is={(v) => (s = v)} />, root);
    expect(root.textContent).toBe('a');
    const [a] = root.querySelectorAll('li');
    s.list.add({ name: 'b' });
    await flushMicrotasks();
    expect(root.textContent).toBe('ab');
    expect(root.querySelectorAll('li')[0]).toBe(a);
    [...s.list][0].name = 'A';
    await flushMicrotasks();
    expect(root.textContent).toBe('Ab');
  });

  it('E reassigning an instance field re-renders; child field does not re-render parent', async () => {
    const renders = vi.fn();
    const first = new Item({ name: 'one' } as any);
    const second = new Item({ name: 'two' } as any);
    class P extends Component {
      panel: Item = first;
      render() { renders(); return <section>{this.panel}</section>; }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    expect(root.textContent).toBe('one');
    expect(renders).toHaveBeenCalledTimes(1);
    p.panel.name = 'ONE';
    await flushMicrotasks();
    expect(root.textContent).toBe('ONE');
    expect(renders).toHaveBeenCalledTimes(1);
    p.panel = second;
    await flushMicrotasks();
    expect(root.textContent).toBe('two');
    expect(renders).toHaveBeenCalledTimes(2);
  });

  it('F pool member field change does not re-render owner', async () => {
    const renders = vi.fn();
    class P extends Component {
      list = has(Item);
      new() { this.list.add({ name: 'a' }); }
      render() { renders(); return <ul>{this.list}</ul>; }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    [...p.list][0].name = 'A';
    await flushMicrotasks();
    expect(root.textContent).toBe('A');
    p.list.add({ name: 'b' });
    await flushMicrotasks();
    expect(root.textContent).toBe('Ab');
    expect(renders).toHaveBeenCalledTimes(1);
  });

  it('G instance passed through props to a function child keeps node', async () => {
    const Frame = (props: { panel: Item }) => <div>{props.panel}</div>;
    class P extends Component {
      panel = new Item({ name: 'x' } as any);
      tick = 0;
      render() { return <Frame panel={this.panel} data-t={this.tick} />; }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    const li = root.querySelector('li');
    p.tick++;
    await flushMicrotasks();
    expect(root.querySelector('li')).toBe(li);
    p.panel.name = 'y';
    await flushMicrotasks();
    expect(root.textContent).toBe('y');
  });

  it('H same instance rendered twice', async () => {
    class P extends Component {
      panel = new Item({ name: 'x' } as any);
      tick = 0;
      render() { return <div data-t={this.tick}>{this.panel}{this.panel}</div>; }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    expect(root.textContent).toBe('xx');
    const lis = [...root.querySelectorAll('li')];
    p.tick++;
    await flushMicrotasks();
    expect([...root.querySelectorAll('li')]).toEqual(lis);
    p.panel.name = 'y';
    await flushMicrotasks();
    expect(root.textContent).toBe('yy');
  });

  it('I instance moved between parent elements', async () => {
    class P extends Component {
      panel = new Item({ name: 'x' } as any);
      left = true;
      render() {
        const { left, panel } = this;
        return <div><span>{left ? panel : null}</span><b>{left ? null : panel}</b></div>;
      }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    expect(root.querySelector('span')!.textContent).toBe('x');
    p.left = false;
    await flushMicrotasks();
    expect(root.querySelector('b')!.textContent).toBe('x');
    expect(root.querySelector('span')!.textContent).toBe('');
    p.panel.name = 'y';
    await flushMicrotasks();
    expect(root.textContent).toBe('y');
  });

  it('J reorder mixing vnodes and instances with keys', async () => {
    class P extends Component {
      a = new Item({ name: 'a' } as any);
      b = new Item({ name: 'b' } as any);
      flip = false;
      render() {
        const { a, b, flip } = this;
        const list = [a, <li key="v">v</li>, b];
        return <ul>{flip ? list.reverse() : list}</ul>;
      }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    const [a, v, b] = root.querySelectorAll('li');
    p.flip = true;
    await flushMicrotasks();
    expect(root.textContent).toBe('bva');
    expect([...root.querySelectorAll('li')]).toEqual([b, v, a]);
  });

  it('K collections inside keyed fragments reordered', async () => {
    class P extends Component {
      x = has(['x']);
      y = has(['y']);
      flip = false;
      render() {
        const { x, y, flip } = this;
        const parts = [<ul key="x">{x}</ul>, <ul key="y">{y}</ul>];
        return <div>{flip ? parts.reverse() : parts}</div>;
      }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    p.flip = true;
    await flushMicrotasks();
    expect(root.textContent).toBe('yx');
    p.x.push('X');
    await flushMicrotasks();
    expect(root.textContent).toBe('yxX');
  });

  it('L unkeyed collections swapped between positions keep content', async () => {
    class P extends Component {
      x = has(['x']);
      y = has(['y']);
      flip = false;
      render() {
        const { x, y, flip } = this;
        return <div>{flip ? [y, x] : [x, y]}</div>;
      }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    expect(root.textContent).toBe('xy');
    p.flip = true;
    await flushMicrotasks();
    expect(root.textContent).toBe('yx');
    p.y.push('Y');
    await flushMicrotasks();
    expect(root.textContent).toBe('yYx');
  });

  it('M removing a pool member unmounts it; deleting destroyed member', async () => {
    class P extends Component {
      list = has(Item);
      new() { this.list.add({ name: 'a' }); this.list.add({ name: 'b' }); }
      render() { return <ul>{this.list}</ul>; }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    const [a] = [...p.list];
    a.set(null);
    await flushMicrotasks();
    expect(root.textContent).toBe('b');
  });

  it('N rendering tracked view as root', async () => {
    const item = Item.new({ name: 'r' } as any);
    const root = document.createElement('main');
    let view!: Item;
    item.get((v) => { view = v; });
    render(view, root);
    expect(root.textContent).toBe('r');
    item.name = 's';
    await flushMicrotasks();
    expect(root.textContent).toBe('s');
  });
});

if (false) {
  class Plain extends State { name = ''; }
  class Holder extends Component {
    plain = has(Plain);
    list = has<Plain>([]);
    m = map<string, Plain>();
    render() {
      // @ts-expect-error pool of non-renderable State
      const a = <ul>{this.plain}</ul>;
      // @ts-expect-error list of non-renderable State
      const b = <ul>{this.list}</ul>;
      // @ts-expect-error map of non-renderable State
      const c = <ul>{this.m}</ul>;
      return <>{a}{b}{c}</>;
    }
  }
  void Holder;
}
