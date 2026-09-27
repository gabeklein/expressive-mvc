import { describe, expect, it } from 'vitest';
import { Component, has } from '@expressive/mvc';
import { render } from './index';
import { flushMicrotasks } from '../test.setup';

describe('review 406 c', () => {
  it('Q tracked collection view rendered as root', async () => {
    class S extends Component { list = has(['a']); render() { return null; } }
    const s = S.new();
    let view!: has.List<string>;
    s.get(({ list }) => { view = list; });
    const root = document.createElement('main');
    render(view, root);
    expect(root.textContent).toBe('a');
    s.list.push('b');
    await flushMicrotasks();
    expect(root.textContent).toBe('ab');
  });

  it('R toggling a collection off and on remounts cleanly', async () => {
    class P extends Component {
      list = has(['a']);
      show = true;
      render() { const { show, list } = this; return <div>{show ? list : null}</div>; }
    }
    let p!: P;
    const root = document.createElement('main');
    render(<P is={(v) => (p = v)} />, root);
    p.show = false;
    await flushMicrotasks();
    p.list.push('b');
    await flushMicrotasks();
    expect(root.textContent).toBe('');
    p.show = true;
    await flushMicrotasks();
    expect(root.textContent).toBe('ab');
  });
});
