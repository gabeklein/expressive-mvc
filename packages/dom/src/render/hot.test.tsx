import { describe, expect, it, vi } from 'vitest';

import { Component, Model } from '@expressive/mvc';
import { hot } from './hot';
import { render, style } from '../index';
import { flushMicrotasks } from '../../test.setup';

let count = 0;
const module = () => `module-${count++}`;

function mount(node: Component.Node) {
  const root = document.createElement('main');
  document.body.append(root);
  render(node, root);
  return root;
}

class Counter extends Model {
  value = 1;
}

describe('hot', () => {
  it('will refresh a component in place', async () => {
    const id = module();
    const counter = Counter.new();

    const Before = () => <b>before {Counter.get().value}</b>;
    const After = () => <b>after {Counter.get().value}</b>;

    hot(id, { View: Before });

    const root = mount(<Component for={counter}><Before /></Component>);
    const node = root.querySelector('b');

    counter.value = 2;
    await flushMicrotasks();

    hot(id, { View: After });
    await flushMicrotasks();

    expect(root.textContent).toBe('after 2');
    expect(root.querySelector('b')).toBe(node);
  });

  it('will keep a component a parent renders anew', async () => {
    const id = module();
    const mounted = vi.fn();

    const version = (label: string) => () => {
      mounted();
      return <b>{label}</b>;
    };

    const Before = version('before');
    const After = version('after');

    class Host extends Model {
      view = Before;
    }

    hot(id, { View: Before });

    const host = Host.new();
    const Parent = () => {
      const View = Host.get().view;
      return <View />;
    };

    const root = mount(<Component for={host}><Parent /></Component>);

    hot(id, { View: After });
    host.view = After;
    await flushMicrotasks();

    expect(root.textContent).toBe('after');
  });

  it('will not refresh an unmounted component', async () => {
    const id = module();
    const rendered = vi.fn();

    const Before = () => <b>before</b>;
    const After = () => {
      rendered();
      return <b>after</b>;
    };

    hot(id, { View: Before });

    const root = document.createElement('main');

    render(<Before />, root)();
    hot(id, { View: After });
    await flushMicrotasks();

    expect(rendered).not.toHaveBeenCalled();
  });

  it('will ignore values which are not functions', () => {
    expect(() => hot(module(), { View: 1 })).not.toThrow();
  });

  it('will style a component by its latest version', async () => {
    const id = module();

    const version = (color: string) => {
      const View = () => <div />;
      style(View, { color });
      return View;
    };

    const Before = version('red');

    hot(id, { View: Before });

    const node = mount(<Before />).querySelector('div')!;

    hot(id, { View: version('blue') });
    await flushMicrotasks();

    const { sheet } = document.head.querySelector<HTMLStyleElement>('style[data-expressive=dom]')!;
    const rule = [...sheet!.cssRules].find((rule) => rule.cssText.startsWith(`.${node.className}`))!;

    expect(rule.cssText).toContain('blue');
  });
});
