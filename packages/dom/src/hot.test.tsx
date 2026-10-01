import { describe, expect, it, vi } from 'vitest';

import { State } from '@expressive/mvc';
import type { Component } from '@expressive/mvc';
import { hot } from './hot';
import { Provider, render, style } from './index';
import { flushMicrotasks } from '../test.setup';

let count = 0;
const module = () => `module-${count++}`;

function mount(node: Component.Node) {
  const root = document.createElement('main');
  document.body.append(root);
  render(node, root);
  return root;
}

class Counter extends State {
  value = 1;
}

describe('hot', () => {
  it('will refresh a component in place', async () => {
    const id = module();
    const instances = new Set<Counter>();

    const Before = () => {
      const counter = Counter.use();
      instances.add(counter.is);
      return <b>before {counter.value}</b>;
    };

    const After = () => {
      const counter = Counter.use();
      instances.add(counter.is);
      return <b>after {counter.value}</b>;
    };

    hot(id, { View: Before });

    const root = mount(<Before />);
    const [instance] = instances;

    instance.value = 2;
    await flushMicrotasks();

    hot(id, { View: After });
    await flushMicrotasks();

    expect(root.textContent).toBe('after 2');
    expect(instances.size).toBe(1);
  });

  it('will keep a component a parent renders anew', async () => {
    const id = module();
    const mounted = vi.fn();

    const version = (label: string) => () => {
      Counter.use();
      mounted();
      return <b>{label}</b>;
    };

    const Before = version('before');
    const After = version('after');

    class Host extends State {
      view = Before;
    }

    hot(id, { View: Before });

    const host = Host.new();
    const Parent = () => {
      const View = Host.get().view;
      return <View />;
    };

    const root = mount(<Provider for={host}><Parent /></Provider>);

    hot(id, { View: After });
    host.view = After;
    await flushMicrotasks();

    expect(root.textContent).toBe('after');
  });

  it('will replace State.use() slots whose order changed', async () => {
    const id = module();
    const destroyed = vi.fn();

    class Other extends State {
      label = 'other';
    }

    class Tracked extends State {
      new() {
        return destroyed;
      }
    }

    const Before = () => {
      Tracked.use();
      return <b>before</b>;
    };

    const After = () => {
      const { label } = Other.use();
      return <b>{label}</b>;
    };

    hot(id, { View: Before });

    const root = mount(<Before />);

    hot(id, { View: After });
    await flushMicrotasks();

    expect(root.textContent).toBe('other');
    expect(destroyed).toHaveBeenCalled();
  });

  it('will drop State.use() slots no longer called', async () => {
    const id = module();
    const destroyed = vi.fn();

    class Tracked extends State {
      new() {
        return destroyed;
      }
    }

    const Before = () => {
      Tracked.use();
      return <b>before</b>;
    };

    const After = () => <b>after</b>;

    hot(id, { View: Before });

    const root = mount(<Before />);

    hot(id, { View: After });
    await flushMicrotasks();

    expect(root.textContent).toBe('after');
    expect(destroyed).toHaveBeenCalled();
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

  it('will not treat unregistered functions as one', () => {
    const First = () => <b>first</b>;
    const Second = () => <b>second</b>;
    const root = document.createElement('main');

    render(<First />, root);
    render(<Second />, root);

    expect(root.textContent).toBe('second');
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
