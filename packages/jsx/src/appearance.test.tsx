import { afterEach, describe, expect, it, vi } from 'vitest';

import { Component, macro, render, style } from './index';
import { flushMicrotasks } from '../test.setup';
import { createAppearanceRoute, createStyleScope, resolveAppearance } from './appearance';
import { applyDeclarations } from './declarations';

const roots: HTMLElement[] = [];

function mount(node: Component.Node) {
  const root = document.createElement('main');
  document.body.append(root);
  roots.push(root);
  render(node, root);
  return root;
}

afterEach(() => {
  roots.splice(0).forEach((root) => root.remove());
});

describe('appearance', () => {
  it('will emit named blocks for rules and a location block for macros', async () => {
    const color = vi.fn((value?: unknown) => ['macro-class', { color: value, marginLeft: 0 }] as const);

    class Styled extends Component {
      active = true;
      color = 'red';
      count = 0;

      render() {
        return (
          <div _active={this.active} _color={this.color} data-count={this.count}>
            styled
          </div>
        );
      }
    }

    style(Styled, {
      active: { fontWeight: 700 },
      color,
      div: { padding: 4 }
    });

    let view!: Styled;
    const node = mount(<Styled is={(value) => (view = value)} />).querySelector('div')!;

    expect(node.className.split(' ')).toEqual(['Styled_div', 'Styled_active', 'Styled_div-color', 'macro-class']);
    expect(node.hasAttribute('_active')).toBe(false);
    expect(getComputedStyle(node).color).toBe('red');
    expect(getComputedStyle(node).fontWeight).toBe('700');
    expect(getComputedStyle(node).marginLeft).toBe('0px');
    expect(getComputedStyle(node).padding).toBe('4px');
    expect(node.style.color).toBe('');

    view.count++;
    await flushMicrotasks();
    view.active = false;
    await flushMicrotasks();
    expect(getComputedStyle(node).fontWeight).not.toBe('700');
    expect(color).toHaveBeenCalledTimes(1);

    view.color = 'blue';
    await flushMicrotasks();
    expect(color).toHaveBeenCalledTimes(2);
    expect(node.className.split(' ')).toContain('Styled_div-color-v2');
    expect(node.style.color).toBe('blue');
    expect(getComputedStyle(node).marginLeft).toBe('0px');
  });

  it('will demote only the properties whose values change', async () => {
    class Box extends Component {
      x?: number = 1;

      render() {
        return <div _mx={this.x} _gap={2} />;
      }
    }

    style(Box, {
      mx: (value?: unknown) => ({ marginLeft: value, marginRight: value }),
      gap: (value?: unknown) => ({ paddingTop: value })
    });

    let view!: Box;
    const node = mount(<Box is={(value) => (view = value)} />).querySelector('div')!;

    expect(node.className).toBe('Box_div-mx-gap');
    expect(getComputedStyle(node).marginLeft).toBe('1px');

    view.x = 5;
    await flushMicrotasks();
    expect(node.className).toBe('Box_div-mx-gap-v2');
    expect(node.style.marginLeft).toBe('5px');
    expect(node.style.marginRight).toBe('5px');
    expect(node.style.paddingTop).toBe('');
    expect(getComputedStyle(node).paddingTop).toBe('2px');

    view.x = undefined;
    await flushMicrotasks();
    expect(node.style.marginLeft).toBe('');
    expect(getComputedStyle(node).paddingTop).toBe('2px');
  });

  it('will let caller rules win over the callee regardless of emission order', () => {
    function Button() {
      return <button style={{ letterSpacing: 1 }}>go</button>;
    }

    style(Button, { button: { color: 'blue', letterSpacing: 2 } });

    function Toolbar() {
      return <nav><Button /></nav>;
    }

    style(Toolbar, { Button: { color: 'red', letterSpacing: 3 } });

    const alone = mount(<Button />).querySelector('button')!;
    expect(getComputedStyle(alone).color).toBe('blue');
    expect(getComputedStyle(alone).letterSpacing).toBe('1px');

    const button = mount(<Toolbar />).querySelector('button')!;
    expect(button.className).toBe('Button_button Toolbar_Button-d1');
    expect(getComputedStyle(button).color).toBe('red');
    expect(getComputedStyle(button).letterSpacing).toBe('1px');
  });

  it('will let the caller with the most doors win', () => {
    function Leaf() {
      return <span>leaf</span>;
    }

    function Middle() {
      return <Leaf />;
    }

    function Outer() {
      return <Middle />;
    }

    style(Middle, { Leaf: { color: 'green' } });
    style(Outer, { Middle: { color: 'purple' } });

    expect(getComputedStyle(mount(<Middle />).querySelector('span')!).color).toBe('green');

    const span = mount(<Outer />).querySelector('span')!;
    expect(span.className).toBe('Middle_Leaf-d1 Outer_Middle-d2');
    expect(getComputedStyle(span).color).toBe('purple');
  });

  it('will count explicit hand-offs as doors', () => {
    function Inner({ style: forwarded }: { style?: any }) {
      return <b style={forwarded}>inner</b>;
    }

    function Outer({ style: forwarded }: { style?: any }) {
      return <Inner style={[forwarded, 'handed']} />;
    }

    function App() {
      return <Outer />;
    }

    style(Outer, { Inner: { color: 'green' } });
    style(App, { Outer: { color: 'purple' } });

    const node = mount(<App />).querySelector('b')!;
    expect(node.className).toBe('handed Outer_Inner-d1 App_Outer-d2');
    expect(getComputedStyle(node).color).toBe('purple');
  });

  it('will compose rules from macros without expanding a macro into itself', () => {
    function Card() {
      return <><section _raised _tone="red" /><em _glow /></>;
    }

    style(Card, {
      mx: (value?: unknown) => ({ marginLeft: value, marginRight: value }),
      pad: (value?: unknown) => ({ mx: value, paddingTop: value }),
      tone: (value?: unknown) => ({ color: value }),
      glow: () => 'glow',
      raised: { pad: 6, boxShadow: '0 0 1px black', '--depth': 1 }
    });

    const node = mount(<Card />).querySelector('section')!;
    expect(node.className).toBe('Card_raised Card_section-tone');
    expect(getComputedStyle(node).marginLeft).toBe('6px');
    expect(getComputedStyle(node).paddingTop).toBe('6px');
    expect(getComputedStyle(node).color).toBe('red');
    expect(getComputedStyle(node).getPropertyValue('--depth')).toBe('1');
    expect(node.parentElement!.querySelector('em')!.className).toBe('glow');
  });

  it('will match component rules by displayName', () => {
    const b = () => <button>go</button>;
    const Button = Object.assign(b, { displayName: 'Button' });

    function Toolbar() {
      return <nav><Button /></nav>;
    }

    style(Toolbar, {
      Button: { color: 'red' },
      b: { color: 'blue' }
    });

    expect(getComputedStyle(mount(<Toolbar />).querySelector('button')!).color).toBe('red');
  });

  it('will inherit and shadow function component rules', () => {
    function Child() {
      return <span _tone />;
    }

    style(Child, { tone: { color: 'blue' } });

    function Parent() {
      return (
        <div>
          <i _tone />
          <Child />
        </div>
      );
    }

    style(Parent, { tone: { color: 'red' } });

    const root = mount(<Parent />);
    expect(getComputedStyle(root.querySelector('i')!).color).toBe('red');
    expect(getComputedStyle(root.querySelector('span')!).color).toBe('blue');
  });

  it('will forward component rules to their explicit placement', () => {
    function Child({ style: appearance }: any) {
      return (
        <section>
          <span style={appearance}>
            <b _mark>child</b>
          </span>
        </section>
      );
    }

    function Plain() {
      return <i />;
    }

    function Parent() {
      return <><Child /><Plain /></>;
    }

    style(Parent, {
      Child: {
        color: 'red',
        mark: { fontWeight: 700 }
      },
      Plain: { color: 'blue' }
    });

    const root = mount(<Parent />);
    expect(root.querySelector('section')?.className).toBe('');
    expect(getComputedStyle(root.querySelector('span')!).color).toBe('red');
    expect(getComputedStyle(root.querySelector('b')!).fontWeight).toBe('700');
    expect(getComputedStyle(root.querySelector('i')!).color).toBe('blue');
  });

  it('will register global macros before rendering', () => {
    macro({
      globalTone: (value?: unknown) => ({ color: value }),
      shared: { letterSpacing: 2 }
    });

    function Global() {
      return <i _globalTone="purple" _shared />;
    }

    style(Global, { i: { padding: 2 } });
    const node = mount(<Global />).querySelector('i')!;

    expect(node.className).toBe('Global_i global_shared Global_i-globalTone');
    expect(getComputedStyle(node).color).toBe('purple');
    expect(getComputedStyle(node).padding).toBe('2px');
    expect(getComputedStyle(node).letterSpacing).toBe('2px');
    expect(() => macro({ late: { color: 'red' } })).toThrow('after rendering');
    expect(() => style(Global, { late: { color: 'red' } })).toThrow('after a component');
  });

  it('will compose repeated and inherited registrations', () => {
    class Base extends Component {
      render() {
        return <div _tone />;
      }
    }
    class Styled extends Base {}

    style(Base, { tone: { color: 'red', padding: 2 } });
    style(Styled, { tone: { color: 'blue' } });
    style(Styled, { tone: { marginLeft: 3 } });

    const node = mount(<Styled />).querySelector('div')!;
    expect(node.className).toBe('Styled_tone');
    expect(getComputedStyle(node).color).toBe('blue');
    expect(getComputedStyle(node).marginLeft).toBe('3px');
    expect(getComputedStyle(node).padding).toBe('2px');
  });

  it('will keep block names unique and reuse identical blocks', () => {
    const first = () => <i _x />;
    const second = () => <b _x />;
    const third = () => <u _x />;
    const First = Object.assign(first, { displayName: 'Dup' });
    const Second = Object.assign(second, { displayName: 'Dup' });
    const Third = Object.assign(third, { displayName: 'Dup' });

    style(First, { x: { color: 'red' } });
    style(Second, { x: { color: 'blue' } });
    style(Third, { x: { color: 'red' } });

    const root = mount(<><First /><Second /><Third /></>);
    expect(root.querySelector('i')!.className).toBe('Dup_x');
    expect(root.querySelector('b')!.className).toBe('Dup_x-2');
    expect(root.querySelector('u')!.className).toBe('Dup_x');
    expect(getComputedStyle(root.querySelector('b')!).color).toBe('blue');
  });

  it('will activate nested descendant scopes', () => {
    function Nested() {
      return (
        <section _nested _frame>
          <strong>nested</strong>
          <em>framed</em>
        </section>
      );
    }

    style(Nested, {
      nested: {
        fontStyle: 'italic',
        strong: { fontWeight: 700 }
      },
      frame: { em: { color: 'red' } }
    });

    const root = mount(<Nested />);
    expect(getComputedStyle(root.querySelector('strong')!).fontWeight).toBe('700');
    expect(root.querySelector('strong')!.className).toBe('Nested_section_strong');
    expect(root.querySelector('section')!.className).toBe('Nested_nested');
    expect(getComputedStyle(root.querySelector('em')!).color).toBe('red');
  });

  it('will resolve class-only, empty and plain routes', () => {
    const called = vi.fn(() => 'zero');
    const scope = createStyleScope(undefined, {
      bad: 'not a rule' as any,
      empty: () => null,
      token: () => 'one  two',
      zero: called,
      plain: { opacity: 0.5 }
    })!;
    const props = { _bad: true, _empty: true, _token: true, _zero: true, _plain: false };
    const resolved = resolveAppearance(undefined, scope, 'div', props, document);

    expect(resolved.appearance).toEqual({ classes: ['one', 'two', 'zero'] });
    expect(called).toHaveBeenCalledWith(undefined);

    const empty = createAppearanceRoute(scope, 'div', { _empty: true });
    expect(resolveAppearance(empty, scope, 'div', { _empty: true }, document)).toEqual({ route: empty });
    expect(resolveAppearance(empty, scope, 'div', { _empty: false }, document)).toEqual({ route: empty });
  });

  it('will distinguish signed zero macro arguments', () => {
    const scope = createStyleScope(undefined, {
      signed: (value?: unknown) => ({ zIndex: Object.is(value, -0) ? -1 : 1 })
    })!;
    const route = createAppearanceRoute(scope, 'div', { _signed: 0 });
    const positive = resolveAppearance(route, scope, 'div', { _signed: 0 }, document);
    const negative = resolveAppearance(route, scope, 'div', { _signed: -0 }, document);

    expect(positive.appearance?.blocks?.[0].declarations).toEqual({ zIndex: 1 });
    expect(negative.appearance?.declarations).toEqual({ zIndex: -1 });
  });

  it('will apply custom properties when serializing', () => {
    const declarations = document.createElement('div').style;

    applyDeclarations(declarations, { '--count': 2, '--empty': null, color: null });

    expect(declarations.getPropertyValue('--count')).toBe('2');
    expect(declarations.getPropertyValue('--empty')).toBe('');
    expect(declarations.color).toBe('');
  });

  it('will ignore invalid maps', () => {
    expect(createStyleScope(undefined, null)).toBeUndefined();
    expect(createStyleScope(undefined, [])).toBeUndefined();
    expect(createAppearanceRoute(undefined, 'div', {})).toBeUndefined();
    expect(resolveAppearance(undefined, undefined, 'div', {}, document)).toEqual({});
  });

  it('will share immutable scopes and structural routes', () => {
    const parentMap = { tone: { color: 'red' } };
    const childMap = { tone: { color: 'blue' } };
    const parent = createStyleScope(undefined, parentMap)!;
    const child = createStyleScope(parent, childMap)!;

    expect(createStyleScope(undefined, parentMap)).toBe(parent);
    expect(createStyleScope(parent, childMap)).toBe(child);

    const route = createAppearanceRoute(child, 'div', { _tone: true });
    expect(createAppearanceRoute(child, 'div', { _tone: false })).toBe(route);
  });

  it.fails('will discover selector keys added by a dynamic spread', () => {
    const scope = createStyleScope(undefined, {
      active: { color: 'red' }
    })!;
    const route = createAppearanceRoute(scope, 'div', {});
    const result = resolveAppearance(route, scope, 'div', { _active: true }, document);

    expect(result.appearance?.blocks).toHaveLength(1);
  });
});
