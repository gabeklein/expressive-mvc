import { afterEach, describe, expect, it, vi } from 'vitest';

import { Component } from '@expressive/mvc';
import { macro, render, style } from './index';
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

declare module './stylesheet' {
  namespace macro {
    interface Registry {
      mex(value: any): unknown;
      pad(value: any): unknown;
      tone(value: any): unknown;
      glow(value?: any): unknown;
      tint(value: any): unknown;
      bare(value?: any): unknown;
      globalTone(value: any): unknown;
    }
  }
}

const called = vi.fn(() => 'zero');

macro({
  mex: (value?: unknown) => ({ marginLeft: `${value}px`, marginRight: `${value}px` }),
  pad: (value?: unknown) => ({ mex: value, paddingTop: `${value}px` }),
  tone: (value?: unknown) => ({ color: value }),
  glow: () => ['glow', { outlineStyle: 'solid' }],
  tint: (value?: unknown) => ['tinted', { color: value }],
  bare: () => 'bare',
  globalTone: (value?: unknown) => ({ color: value }),
  _shared: { letterSpacing: '2px', globalTone: 'brand', fontSize: 3 }
});

macro({
  globalTone: (value: unknown) => ({ globalTone: value == 'brand' ? 'purple' : value }),
  '*': (value: unknown, key: string) => ({ [key]: value === 3 ? '3px' : value })
});

describe('appearance', () => {
  it('will emit named blocks for rules', async () => {
    class Styled extends Component {
      active = true;
      count = 0;

      render() {
        return (
          <div _active={this.active} data-count={this.count}>
            styled
          </div>
        );
      }
    }

    style(Styled, {
      _active: { fontWeight: 700 },
      _div: { padding: '4px' },
      color: 'blue'
    });

    let view!: Styled;
    const node = mount(<Styled is={(value) => (view = value)} />).querySelector('div')!;

    expect(node.className.split(' ')).toEqual(['Styled_div', 'Styled_active', 'Styled']);
    expect(node.hasAttribute('_active')).toBe(false);
    expect(getComputedStyle(node).fontWeight).toBe('700');
    expect(getComputedStyle(node).padding).toBe('4px');
    expect(getComputedStyle(node).color).toBe('blue');
    expect(node.style.color).toBe('');

    view.count++;
    await flushMicrotasks();
    view.active = false;
    await flushMicrotasks();
    expect(getComputedStyle(node).fontWeight).not.toBe('700');
  });

  it('will let caller rules win over the callee regardless of emission order', () => {
    function Button() {
      return <button style={{ letterSpacing: 1 }}>go</button>;
    }

    style(Button, { color: 'blue', letterSpacing: '2px' });

    function Toolbar() {
      return <nav><Button _accent /></nav>;
    }

    style(Toolbar, { _accent: { color: 'red', letterSpacing: '3px' } });

    const alone = mount(<Button />).querySelector('button')!;
    expect(getComputedStyle(alone).color).toBe('blue');
    expect(getComputedStyle(alone).letterSpacing).toBe('1px');

    const button = mount(<Toolbar />).querySelector('button')!;
    expect(button.className).toBe('Toolbar_accent-d1 Button');
    expect(getComputedStyle(button).color).toBe('red');
    expect(getComputedStyle(button).letterSpacing).toBe('1px');
  });

  it('will pass a caller rule to an unmanaged component field', async () => {
    class Badge extends Component {
      _accent?: boolean = false;

      render() {
        return <span>{String(this._accent)}</span>;
      }
    }

    function Card() {
      return <Badge _accent />;
    }

    style(Card, { _accent: { color: 'red' } });

    const node = mount(<Card />).querySelector('span')!;

    expect(node.textContent).toBe('true');
    expect(node.className).toBe('Card_accent-d1');
    expect(getComputedStyle(node).color).toBe('red');
  });

  it('will let the caller with the most doors win', () => {
    function Leaf() {
      return <span>leaf</span>;
    }

    function Middle() {
      return <Leaf _leaf />;
    }

    function Outer() {
      return <Middle _mid />;
    }

    style(Middle, { _leaf: { color: 'green' } });
    style(Outer, { _mid: { color: 'purple' } });

    expect(getComputedStyle(mount(<Middle />).querySelector('span')!).color).toBe('green');

    const span = mount(<Outer />).querySelector('span')!;
    expect(span.className).toBe('Middle_leaf-d1 Outer_mid-d2');
    expect(getComputedStyle(span).color).toBe('purple');
  });

  it('will count explicit hand-offs as doors', () => {
    function Inner({ style: forwarded }: { style?: any }) {
      return <b style={forwarded}>inner</b>;
    }

    function Outer({ style: forwarded }: { style?: any }) {
      return <Inner _inner style={[forwarded, 'handed']} />;
    }

    function App() {
      return <Outer _outer />;
    }

    style(Outer, { _inner: { color: 'green' } });
    style(App, { _outer: { color: 'purple' } });

    const node = mount(<App />).querySelector('b')!;
    expect(node.className).toBe('handed Outer_inner-d1 App_outer-d2');
    expect(getComputedStyle(node).color).toBe('purple');
  });

  it('will take descendant scopes from the token with the most doors', () => {
    const handles: any[] = [];

    function Capture({ style: forwarded }: { style?: any }) {
      handles.push(forwarded);
      return null;
    }

    function Relay({ style: forwarded }: { style?: any }) {
      return <Capture _capture style={forwarded} />;
    }

    function Deep() {
      return <Relay _relay />;
    }

    function Shallow() {
      return <Capture _capture />;
    }

    style(Deep, { _relay: { _strong: { color: 'red' } } });
    style(Shallow, { _capture: { _strong: { color: 'blue' } } });

    mount(<><Deep /><Shallow /></>);

    const [deep, shallow] = handles;
    const root = mount(<section style={{ ...deep, ...shallow }}><strong>deep</strong></section>);

    expect(getComputedStyle(root.querySelector('strong')!).color).toBe('red');
  });

  it('will compose rules from macros without expanding a macro into itself', () => {
    function Card() {
      return <section _raised />;
    }

    style(Card, {
      _raised: { pad: 6, tone: 'red', glow: true, boxShadow: '0 0 1px black', '--depth': 1 }
    });

    const node = mount(<Card />).querySelector('section')!;
    expect(node.className.split(' ')).toEqual(['Card_raised', 'glow']);
    expect(getComputedStyle(node).marginLeft).toBe('6px');
    expect(getComputedStyle(node).paddingTop).toBe('6px');
    expect(getComputedStyle(node).color).toBe('red');
    expect(getComputedStyle(node).getPropertyValue('--depth')).toBe('1');
    expect(getComputedStyle(node).outlineStyle).toBe('solid');
  });

  it('will inherit and shadow function component rules', () => {
    function Child() {
      return <span _tone />;
    }

    style(Child, { _tone: { color: 'blue' } });

    function Parent() {
      return (
        <div>
          <i _tone />
          <Child />
        </div>
      );
    }

    style(Parent, { _tone: { color: 'red' } });

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
      return <><Child _child /><Plain _plain /></>;
    }

    style(Parent, {
      _child: {
        color: 'red',
        _mark: { fontWeight: 700 }
      },
      _plain: { color: 'blue' }
    });

    const root = mount(<Parent />);
    expect(root.querySelector('section')?.className).toBe('');
    expect(getComputedStyle(root.querySelector('span')!).color).toBe('red');
    expect(getComputedStyle(root.querySelector('b')!).fontWeight).toBe('700');
    expect(getComputedStyle(root.querySelector('i')!).color).toBe('blue');
  });

  it('will layer global macros and fall through to the layer below', () => {
    function Global() {
      return <i _shared />;
    }

    style(Global, { padding: '2px' });
    const node = mount(<Global />).querySelector('i')!;

    expect(node.className).toBe('global_shared Global');
    expect(getComputedStyle(node).color).toBe('purple');
    expect(getComputedStyle(node).padding).toBe('2px');
    expect(getComputedStyle(node).letterSpacing).toBe('2px');
    expect(getComputedStyle(node).fontSize).toBe('3px');
    expect(() => macro({ _late: { color: 'red' } })).toThrow('after rendering');
    expect(() => macro({ bad: { color: 'red' } }))
      .toThrow('Macro "bad" must be a function. Use "_bad" to register a rule.');
    expect(() => style(Global, { _late: { color: 'red' } })).toThrow('after a component');
  });

  it('will join array values and throw for unhandled keys', () => {
    const joined = createStyleScope(undefined, { _box: { margin: ['1px', '2px'] } })!;
    const resolved = resolveAppearance(joined, { _box: true });

    expect(resolved?.blocks?.[0].declarations).toEqual({ margin: '1px 2px' });

    const nested = createStyleScope(undefined, { _bad: { margin: { top: '1px' } } })!;
    expect(() => resolveAppearance(nested, { _bad: true }))
      .toThrow('No macro handles "margin".');

    const fn = createStyleScope(undefined, { _fn: { margin: () => '1px' } })!;
    expect(() => resolveAppearance(fn, { _fn: true }))
      .toThrow('No macro handles "margin".');
  });

  it('will apply base declarations to each component root', () => {
    function Plain() {
      return <><hr /><br /></>;
    }

    style(Plain, { tint: 'green', padding: '1px' });

    const [rule, line] = [...mount(<Plain />).children] as HTMLElement[];
    expect(rule.className.split(' ')).toEqual(['Plain', 'tinted']);
    expect(line.className.split(' ')).toEqual(['Plain', 'tinted']);
    expect(getComputedStyle(rule).color).toBe('green');
    expect(getComputedStyle(rule).padding).toBe('1px');

    function Bare() {
      return <wbr />;
    }

    style(Bare, { bare: true });

    expect(mount(<Bare />).querySelector('wbr')!.className).toBe('bare');
  });

  it('will not activate a rule for a falsy flag', () => {
    function Gate() {
      return <><kbd _on={0} /><samp _on={''} /><var _on={1} /></>;
    }

    style(Gate, { _on: { color: 'olive' } });

    const root = mount(<Gate />);

    expect(root.querySelector('kbd')!.className).toBe('');
    expect(root.querySelector('samp')!.className).toBe('');
    expect(root.querySelector('var')!.className).toBe('Gate_on');
  });

  it('will throw if a rule is not an object', () => {
    expect(() => createStyleScope(undefined, { _bad: (() => null) as any }))
      .toThrow('Rule "_bad" must be an object. Macros are defined by macro().');
    expect(() => createStyleScope(undefined, { _also: 'token' as any }))
      .toThrow('Rule "_also" must be an object.');
  });

  it('will ignore a non-object descendant scope', () => {
    const scope = createStyleScope(undefined, {
      _outer: { color: 'red', _inner: false }
    })!;
    const resolved = resolveAppearance(scope, { _outer: true });

    expect(resolved?.context).toBeUndefined();
    expect(resolved?.blocks?.[0].declarations).toEqual({ color: 'red' });
  });

  it('will throw if a map uses a reserved key', () => {
    expect(() => createStyleScope(undefined, { $hover: { color: 'red' } }))
      .toThrow('Reserved key "$hover" in style map.');
  });

  it('will compose repeated and inherited registrations', () => {
    class Base extends Component {
      render() {
        return <div _tone />;
      }
    }
    class Styled extends Base {}

    style(Base, { _tone: { color: 'red', padding: '2px' } });
    style(Styled, { _tone: { color: 'blue' } });
    style(Styled, { _tone: { marginLeft: '3px' } });

    const node = mount(<Styled />).querySelector('div')!;
    expect(node.className).toBe('Styled_tone');
    expect(getComputedStyle(node).color).toBe('blue');
    expect(getComputedStyle(node).marginLeft).toBe('3px');
    expect(getComputedStyle(node).padding).toBe('2px');
  });

  it('will apply rules from every class in the chain', () => {
    class Bar extends Component {
      render() {
        return <div _a _b />;
      }
    }
    class Foo extends Bar {}

    style(Bar, { _a: { color: 'red' } });
    style(Foo, { _b: { paddingTop: '4px' } });

    const node = mount(<Foo />).querySelector('div')!;

    expect(node.className.split(' ')).toEqual(['Bar_a', 'Foo_b']);
    expect(getComputedStyle(node).color).toBe('red');
    expect(getComputedStyle(node).paddingTop).toBe('4px');
  });

  it('will resolve an inherited render against the derived scope', () => {
    class Plain extends Component {
      render() {
        return <span _tint>base</span>;
      }
    }
    class Tinted extends Plain {}

    style(Tinted, { _tint: { color: 'green' } });

    const node = mount(<Tinted />).querySelector('span')!;

    expect(node.className).toBe('Tinted_tint');
    expect(getComputedStyle(node).color).toBe('green');
  });

  it('will not leak a base rule into a child component', () => {
    function Inner() {
      return <b>inner</b>;
    }

    function Outer() {
      return <i><Inner /></i>;
    }

    style(Inner, { color: 'blue' });
    style(Outer, { padding: '9px' });

    const root = mount(<Outer />);

    expect(getComputedStyle(root.querySelector('i')!).padding).toBe('9px');
    expect(getComputedStyle(root.querySelector('b')!).padding).toBe('');
    expect(getComputedStyle(root.querySelector('b')!).color).toBe('blue');
  });

  it('will not merge a same-named rule across a component', () => {
    function Kid() {
      return <u _tone>k</u>;
    }

    function Host() {
      return <s><Kid /></s>;
    }

    style(Kid, { _tone: { color: 'blue' } });
    style(Host, { _tone: { color: 'red', paddingTop: '7px' } });

    const inside = mount(<Host />).querySelector('u')!;
    const alone = mount(<Kid />).querySelector('u')!;

    expect(inside.className).toBe(alone.className);
    expect(getComputedStyle(inside).paddingTop).toBe('');
    expect(getComputedStyle(inside).color).toBe('blue');
  });

  it('will not match a tag rule inside a child component', () => {
    function Leaf() {
      return <p>leaf</p>;
    }

    function Shell() {
      return <div><p>own</p><Leaf /></div>;
    }

    style(Shell, { _p: { color: 'red' } });

    const [own, leaf] = [...mount(<Shell />).querySelectorAll('p')];

    expect(getComputedStyle(own).color).toBe('red');
    expect(getComputedStyle(leaf).color).not.toBe('red');
  });

  it('will carry a descendant scope one component deep', () => {
    function Deep() {
      return <em>deep</em>;
    }

    function Mid() {
      return <><q _mark>mid</q><Deep /></>;
    }

    function Top() {
      return <Mid _wrap />;
    }

    style(Top, { _wrap: { _mark: { color: 'orange' }, _em: { color: 'teal' } } });

    const root = mount(<Top />);

    expect(getComputedStyle(root.querySelector('q')!).color).toBe('orange');
    expect(getComputedStyle(root.querySelector('em')!).color).not.toBe('teal');
  });

  it('will keep block names unique and reuse identical blocks', () => {
    const first = () => <i _x />;
    const second = () => <b _x />;
    const third = () => <u _x />;
    const First = Object.assign(first, { displayName: 'Dup' });
    const Second = Object.assign(second, { displayName: 'Dup' });
    const Third = Object.assign(third, { displayName: 'Dup' });

    style(First, { _x: { color: 'red' } });
    style(Second, { _x: { color: 'blue' } });
    style(Third, { _x: { color: 'red' } });

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
      _nested: {
        fontStyle: 'italic',
        _strong: { fontWeight: 700 }
      },
      _frame: { _em: { color: 'red' } }
    });

    const root = mount(<Nested />);
    expect(getComputedStyle(root.querySelector('strong')!).fontWeight).toBe('700');
    expect(root.querySelector('strong')!.className).toBe('Nested_section_strong');
    expect(root.querySelector('section')!.className).toBe('Nested_nested');
    expect(getComputedStyle(root.querySelector('em')!).color).toBe('red');
  });

  it('will open descendant scopes only under prefixed keys', () => {
    function Icon() {
      return <svg _frame><filter /></svg>;
    }

    style(Icon, { _frame: { filter: 'blur(1px)', _filter: { opacity: 0.5 } } });

    const root = mount(<Icon />);
    expect(root.querySelector('filter')!.getAttribute('class')).toBe('Icon_svg_filter');
    expect(getComputedStyle(root.querySelector('svg')!).filter).toBe('blur(1px)');
  });

  it('will recreate a removed stylesheet', () => {
    function First() {
      return <i _tone />;
    }

    function Second() {
      return <b _tone />;
    }

    style(First, { _tone: { color: 'red' } });
    style(Second, { _tone: { color: 'blue' } });

    mount(<First />);
    document.head.querySelector('style[data-expressive]')!.remove();

    const node = mount(<Second />).querySelector('b')!;
    expect(getComputedStyle(node).color).toBe('blue');
  });

  it('will resolve class-only, empty and plain routes', () => {
    const defined = createStyleScope(undefined, {
      empty: () => null,
      token: () => 'one  two',
      zero: called
    }, 'style', true)!;
    const scope = createStyleScope(defined, {
      _classes: { token: true, zero: true },
      _blank: { empty: true, token: false },
      _plain: { opacity: 0.5 }
    })!;
    const props = { _classes: true, _blank: true, _plain: false, _token: true };
    const resolved = resolveAppearance(scope, props);

    expect(resolved).toEqual({ classes: ['one', 'two', 'zero'] });
    expect(called).toHaveBeenCalledWith(undefined, 'zero');

    expect(resolveAppearance(scope, { _blank: true })).toBeUndefined();
    expect(resolveAppearance(scope, { _blank: false })).toBeUndefined();
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
    expect(createAppearanceRoute(undefined, {})).toBeUndefined();
    expect(resolveAppearance(undefined, {})).toBeUndefined();
  });

  it('will share immutable scopes and structural routes', () => {
    const parentMap = { _tone: { color: 'red' } };
    const childMap = { _tone: { color: 'blue' } };
    const parent = createStyleScope(undefined, parentMap)!;
    const child = createStyleScope(parent, childMap)!;

    expect(createStyleScope(undefined, parentMap)).toBe(parent);
    expect(createStyleScope(parent, childMap)).toBe(child);

    const route = createAppearanceRoute(child, { _tone: true });
    expect(createAppearanceRoute(child, { _tone: false })).toBe(route);
  });

  it('will discover a rule key added after the first render', () => {
    const scope = createStyleScope(undefined, {
      _active: { color: 'red' }
    })!;

    expect(resolveAppearance(scope, {})).toBeUndefined();
    expect(resolveAppearance(scope, { _active: true })?.blocks).toHaveLength(1);
  });

});
