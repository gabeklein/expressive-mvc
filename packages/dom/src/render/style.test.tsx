import { describe, expect, it } from 'vitest';

import { Component, has } from '@expressive/mvc';
import { render } from '../index';
import { flushMicrotasks, mount, place } from '../../test.setup';

describe('style prop', () => {
  it('will recursively compose classes and inline styles', async () => {
    class Styled extends Component {
      native: string | undefined = 'external';
      mode = 0;
      initial = [
        ' base\ttwo height: 12px ',
        false,
        null,
        undefined,
        '',
        [
          { color: 'red', height: 12, opacity: 1, width: 10 },
          [{ color: 'blue', height: null, opacity: 0, width: 20 }]
        ]
      ] as const;

      render() {
        return (
          <div
            {...({ class: 'legacy' } as any)}
            className={this.native}
            style={this.mode == 0 ? this.initial : this.mode == 1 ? ['next', { height: 4 }] : null}
          />
        );
      }
    }

    const [view, root] = mount(Styled);
    const node = root.querySelector('div')!;

    expect(node.className).toBe('external base two height: 12px');
    expect(node.style.color).toBe('blue');
    expect(node.style.height).toBe('');
    expect(node.style.opacity).toBe('0');
    expect(node.style.width).toBe('20px');

    view.native = 'changed';
    await flushMicrotasks();
    expect(node.className).toBe('changed base two height: 12px');
    expect(node.style.width).toBe('20px');

    view.mode = 1;
    await flushMicrotasks();
    expect(node.className).toBe('changed next');
    expect(node.style.color).toBe('');
    expect(node.style.height).toBe('4px');
    expect(node.style.width).toBe('');

    view.native = undefined;
    await flushMicrotasks();
    expect(node.className).toBe('next');

    view.mode = 2;
    await flushMicrotasks();
    expect(node.hasAttribute('class')).toBe(false);
    expect(node.style.height).toBe('');
  });

  it('will forward style through component roots', async () => {
    const Leaf = (_props: any) => <div className="leaf" style={['local', { color: 'blue' }]} />;
    const Middle = (_props: any) => <Leaf style={['inner', { color: 'green', height: 4 }]} />;

    class View extends Component {
      active = true;

      render() {
        return (
          <Middle style={[false, this.active ? 'call' : 'updated', { color: 'red', width: this.active ? 3 : 6 }]} />
        );
      }
    }

    const [view, root] = mount(View);
    const node = root.querySelector('div')!;

    expect(node.className).toBe('leaf local inner call');
    expect(node.style.color).toBe('red');
    expect(node.style.height).toBe('4px');
    expect(node.style.width).toBe('3px');

    view.active = false;
    await flushMicrotasks();
    expect(node.className).toBe('leaf local inner updated');
    expect(node.style.width).toBe('6px');
  });

  it('will not forward class through components', () => {
    const Leaf = (_props: any) => <div className="leaf" />;
    const root = place(<Leaf {...({ class: 'outer' } as any)} />);

    expect(root.querySelector('div')?.className).toBe('leaf');
  });

  it('will not forward style a component derives from', () => {
    const Field = ({ style }: { style?: any }) => (
      <label>
        <input style={{ ...style, outlineStyle: 'none' }} />
      </label>
    );
    const root = place(<Field style={['invalid', { color: 'red' }]} />);

    const input = root.querySelector('input')!;
    expect(root.querySelector('label')?.hasAttribute('class')).toBe(false);
    expect(input.className).toBe('invalid');
    expect(input.style.color).toBe('red');
    expect(input.style.outlineStyle).toBe('none');
  });

  it('will pass readable, frozen declarations through a component', () => {
    const received: any[] = [];
    const Read = ({ style }: { style?: any }) => {
      received.push(style);
      return <i />;
    };
    place(<><Read style={[{ color: 'red' }, false, ['tag', { color: 'blue', width: 2 }]]} /><Read style={[false, null]} /></>);

    const [style, empty] = received;
    expect({ ...style }).toMatchObject({ color: 'blue', width: 2 });
    expect(Object.keys(style)).toEqual(['color', 'width']);
    expect(Object.isFrozen(style)).toBe(true);
    expect(empty).toBeUndefined();
  });

  it('will keep forwarded classes through spread, pluck and merge', () => {
    const handles: any[] = [];
    const Capture = ({ style }: { style?: any }) => {
      handles.push(style);
      return null;
    };
    place(<><Capture style={['a', { color: 'red', width: 1 }]} /><Capture style={['b', { height: 2 }]} /></>);

    const [a, b] = handles;
    const { color, ...rest } = a;
    const target = document.createElement('main');

    render(
      <>
        <i style={{ ...a, color: 'blue' }} />
        <b style={rest} />
        <u style={{ ...a, ...b }} />
        <s style={{ [Symbol('foreign')]: {}, color: 'red' } as any} />
      </>,
      target
    );

    const [override, plucked, merged, foreign] = [...target.children] as HTMLElement[];
    expect(color).toBe('red');
    expect(override.className).toBe('a');
    expect(override.style.color).toBe('blue');
    expect(plucked.className).toBe('a');
    expect(plucked.style.color).toBe('');
    expect(plucked.style.width).toBe('1px');
    expect(merged.className).toBe('a b');
    expect(merged.style.height).toBe('2px');
    expect(foreign.hasAttribute('class')).toBe(false);
    expect(foreign.style.color).toBe('red');
  });

  it('will keep styled props stable for a reused element', async () => {
    const received: object[] = [];
    const Leaf = (props: { style?: string }) => {
      received.push(props);
      return <i />;
    };
    const leaf = <Leaf style="kept" />;

    class View extends Component {
      count = 0;

      render() {
        return <>{this.count}{leaf}</>;
      }
    }

    const [view, root] = mount(View);

    view.count = 1;
    await flushMicrotasks();

    expect(received).toHaveLength(2);
    expect(received[0]).toBe(received[1]);
    expect(root.querySelector('i')?.className).toBe('kept');
  });

  it('will not forward style a Component reads', () => {
    class Field extends Component {
      render() {
        return <label><input style={(this.props as any).style} /></label>;
      }
    }

    class Declared extends Component {
      style?: string = undefined;

      render() {
        return <p><b style={this.style} /></p>;
      }
    }

    const root = place(<><Field style="read" /><Declared style="owned" /></>);

    expect(root.querySelector('label')?.hasAttribute('class')).toBe(false);
    expect(root.querySelector('input')?.className).toBe('read');
    expect(root.querySelector('p')?.hasAttribute('class')).toBe(false);
    expect(root.querySelector('b')?.className).toBe('owned');
  });

  it('will honor explicit appearance placement, also through component instances', () => {
    class Inner extends Component {
      render() {
        return <span />;
      }
    }

    const Placed = ({ style }: any) => (
      <section>
        <span style={style} />
      </section>
    );
    const Instance = ({ style }: any) => new Inner({ style });
    const root = place(<><Placed style={['selected', { color: 'red' }]} /><Instance {...({ style: 'placed' } as any)} /></>);
    const [selected, placed] = root.querySelectorAll('span');

    expect(root.querySelector('section')?.hasAttribute('class')).toBe(false);
    expect(root.querySelector('section')?.getAttribute('style')).toBeNull();
    expect(selected.className).toBe('selected');
    expect(selected.style.color).toBe('red');
    expect(placed.className).toBe('placed');
  });

  it('will update forwarded appearance on collection roots', async () => {
    const items = new has.List([<span />]);

    const Items = (_props: any) => items as any;
    class View extends Component {
      active = true;

      render() {
        return <Items {...({ style: this.active ? 'active' : 'inactive' } as any)} />;
      }
    }

    const [view, root] = mount(View);
    expect(root.querySelector('span')?.className).toBe('active');

    view.active = false;
    await flushMicrotasks();
    expect(root.querySelector('span')?.className).toBe('inactive');
  });

  it('will forward appearance to fragment roots', () => {
    const Pair = () => <><i /><b /></>;
    const root = place(<Pair style="shared" />);

    expect([...root.children].map((node) => node.className)).toEqual(['shared', 'shared']);
  });
});
