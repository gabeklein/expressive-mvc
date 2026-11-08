import { describe, expect, it, vi } from 'vitest';

import { Component } from '@expressive/mvc';
import { render, Style } from '../index';
import * as hot from '@expressive/mvc/hot';
import { flushMicrotasks, mount } from '../../test.setup';
import { createAppearanceRoute, createStyleScope, resolveAppearance } from './appearance';
import { applyDeclarations } from './declarations';

function place(node: Component.Node) {
  const root = document.body.appendChild(document.createElement('main'));
  render(node, root);
  return root;
}

const called = vi.fn(() => 'zero');

class Base extends Style {
  mex(value?: unknown) { return { marginLeft: `${value}px`, marginRight: `${value}px` }; }
  pad(value?: unknown) { return { mex: value, paddingTop: `${value}px` }; }
  tone(value?: unknown) { return { color: value }; }
  glow() { return ['glow', { outlineStyle: 'solid' }]; }
  tint(value?: unknown) { return ['tinted', { color: value }]; }
  bare() { return 'bare'; }
  layered(value?: unknown): object { return { color: value }; }
  selfish() { return { selfish: true }; }
  glowOn(value?: unknown) { return { ':hover': { tone: value } }; }
}

class Pack extends Base {
  layered(value: unknown) { return { layered: value == 'brand' ? 'purple' : value }; }
  default(value: unknown, key: string) { return { [key]: value === 3 ? '3px' : value }; }
}

const style = Pack.use();

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

    const [view, root] = mount(Styled, {}, document.body.appendChild(document.createElement('main')));
    const node = root.querySelector('div')!;

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

    const alone = place(<Button />).querySelector('button')!;
    expect(getComputedStyle(alone).color).toBe('blue');
    expect(getComputedStyle(alone).letterSpacing).toBe('1px');

    const button = place(<Toolbar />).querySelector('button')!;
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

    const node = place(<Card />).querySelector('span')!;

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

    expect(getComputedStyle(place(<Middle />).querySelector('span')!).color).toBe('green');

    const span = place(<Outer />).querySelector('span')!;
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

    const node = place(<App />).querySelector('b')!;
    expect(node.className).toBe('handed Outer_inner-d1 App_outer-d2');
    expect(getComputedStyle(node).color).toBe('purple');
  });

  it('will not take descendant scopes from forwarded tokens', () => {
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

    place(<><Deep /><Shallow /></>);

    const [deep, shallow] = handles;
    const root = place(<section style={{ ...deep, ...shallow }}><strong>deep</strong></section>);
    const { color } = getComputedStyle(root.querySelector('strong')!);

    expect(color).not.toBe('red');
    expect(color).not.toBe('blue');
  });

  it('will compose rules from macros without expanding a macro into itself', () => {
    function Card() {
      return <section _raised />;
    }

    style(Card, {
      _raised: { pad: 6, tone: 'red', glow: true, boxShadow: '0 0 1px black', '--depth': 1 }
    });

    const node = place(<Card />).querySelector('section')!;
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

    const root = place(<Parent />);
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

    const root = place(<Parent />);
    expect(root.querySelector('section')?.className).toBe('');
    expect(getComputedStyle(root.querySelector('span')!).color).toBe('red');
    expect(getComputedStyle(root.querySelector('b')!).fontWeight).not.toBe('700');
    expect(getComputedStyle(root.querySelector('i')!).color).toBe('blue');
  });

  it('will layer a subclass over its pack and fall through to the layer below', () => {
    function Layered() {
      return <i />;
    }

    style(Layered, { padding: '2px', layered: 'brand', fontSize: 3 });
    const node = place(<Layered />).querySelector('i')!;

    expect(node.className).toBe('Layered');
    expect(getComputedStyle(node).color).toBe('purple');
    expect(getComputedStyle(node).padding).toBe('2px');
    expect(getComputedStyle(node).fontSize).toBe('3px');
    expect(() => style(Layered, { _late: { color: 'red' } })).toThrow('after a component');
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

    const flag = createStyleScope(undefined, { _flag: { margin: true } })!;
    expect(() => resolveAppearance(flag, { _flag: true }))
      .toThrow('No macro handles "margin".');
  });

  it('will throw for a macro that returns itself', () => {
    function Selfish() {
      return <i _loop />;
    }

    style(Selfish, { _loop: { selfish: true } });

    expect(() => place(<Selfish />)).toThrow('Macro "selfish" returned itself.');
  });

  it('will apply base declarations to each component root', () => {
    function Plain() {
      return <><hr /><br /></>;
    }

    style(Plain, { tint: 'green', padding: '1px' });

    const [rule, line] = [...place(<Plain />).children] as HTMLElement[];
    expect(rule.className.split(' ')).toEqual(['Plain', 'tinted']);
    expect(line.className.split(' ')).toEqual(['Plain', 'tinted']);
    expect(getComputedStyle(rule).color).toBe('green');
    expect(getComputedStyle(rule).padding).toBe('1px');

    function Bare() {
      return <wbr />;
    }

    style(Bare, { bare: true });

    expect(place(<Bare />).querySelector('wbr')!.className).toBe('bare');
  });

  it('will not activate a rule for a falsy flag', () => {
    function Gate() {
      return <><kbd _on={0} /><samp _on={''} /><var _on={1} /></>;
    }

    style(Gate, { _on: { color: 'olive' } });

    const root = place(<Gate />);

    expect(root.querySelector('kbd')!.className).toBe('');
    expect(root.querySelector('samp')!.className).toBe('');
    expect(root.querySelector('var')!.className).toBe('Gate_on');
  });

  it.each([
    ['a rule is a function', { _bad: () => null }, 'Rule "_bad" must be an object. Macros are defined on a Style class.'],
    ['a rule is a token', { _also: 'token' }, 'Rule "_also" must be an object.'],
    ['a rule array holds a token', { _also: [{ color: 'red' }, 'token'] }, 'Rule "_also" must be an object.'],
    ['a map uses an unknown condition', { $hover: { color: 'red' } }, 'Unknown condition "$hover".'],
    ['a subcomponent is nested', { _Title: { color: 'red' } }, 'Subcomponent "_Title" must be at the top of a style() map.']
  ])('will throw if %s', (_, map, message) => {
    expect(() => createStyleScope(undefined, map as any)).toThrow(message);
  });

  it('will ignore a non-object descendant scope', () => {
    const scope = createStyleScope(undefined, {
      _outer: { color: 'red', _inner: false }
    })!;
    const resolved = resolveAppearance(scope, { _outer: true });

    expect(resolved?.context).toBeUndefined();
    expect(resolved?.blocks?.[0].declarations).toEqual({ color: 'red' });
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

    const node = place(<Styled />).querySelector('div')!;
    expect(node.className).toBe('Styled_tone');
    expect(getComputedStyle(node).color).toBe('blue');
    expect(getComputedStyle(node).marginLeft).toBe('3px');
    expect(getComputedStyle(node).padding).toBe('2px');
  });

  it('will layer several maps from one call and skip falsy ones', () => {
    function Meta() {
      return <div _name />;
    }

    const shared = { _name: { color: 'red', padding: '2px' } };
    const wide = false as boolean;

    style(Meta, shared, wide && { padding: '9px' }, null, { _name: { color: 'blue' } });

    const node = place(<Meta />).querySelector('div')!;
    expect(getComputedStyle(node).color).toBe('blue');
    expect(getComputedStyle(node).padding).toBe('2px');
  });

  it('will merge an array rule body in order and skip falsy entries', () => {
    function Pick() {
      return <ul _select><li _item /></ul>;
    }

    const shared = { color: 'gray', padding: '2px', ':hover': { color: 'black' } };
    const wide = false as boolean;

    style(Pick, {
      _select: [shared, wide && { padding: '9px' }, [null, { color: 'red', ':hover': { opacity: 0.5 } }]]
    });

    const node = place(<Pick />).querySelector('ul')!;
    expect(node.className).toBe('Pick_select Pick_select-hover');
    expect(getComputedStyle(node).color).toBe('red');
    expect(getComputedStyle(node).padding).toBe('2px');
  });

  it('will merge an array descendant scope and subcomponent body', () => {
    class Menu extends Component {
      Title() {
        return <b _mark />;
      }

      render() {
        return <ul _list><li _item /><this.Title /></ul>;
      }
    }

    const shared = { color: 'gray', padding: '2px' };

    style(Menu, {
      _list: { _item: [shared, { color: 'red' }] },
      _Title: [{ _mark: shared }, { _mark: { color: 'blue' } }]
    });

    const root = place(<Menu />);
    const item = root.querySelector('li')!;
    const title = root.querySelector('b')!;

    expect(getComputedStyle(item).color).toBe('red');
    expect(getComputedStyle(item).padding).toBe('2px');
    expect(getComputedStyle(title).color).toBe('blue');
    expect(getComputedStyle(title).padding).toBe('2px');
  });

  it('will merge descendant scopes across layers', () => {
    function Rows() {
      return <ul _list><li _item /></ul>;
    }

    style(Rows, { _list: { _item: { color: 'red' } } }, { _list: { _item: { padding: '2px' } } });

    const item = place(<Rows />).querySelector('li')!;
    expect(getComputedStyle(item).color).toBe('red');
    expect(getComputedStyle(item).padding).toBe('2px');
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

    const node = place(<Foo />).querySelector('div')!;

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

    const node = place(<Tinted />).querySelector('span')!;

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

    const root = place(<Outer />);

    expect(getComputedStyle(root.querySelector('i')!).padding).toBe('9px');
    expect(getComputedStyle(root.querySelector('b')!).padding).toBe('');
    expect(getComputedStyle(root.querySelector('b')!).color).toBe('blue');
  });

  it('will not leak a base rule into a placed component instance', () => {
    class Card extends Component {
      render() {
        return <b>card</b>;
      }
    }

    class Deck extends Component {
      cards = [new Card()];

      render() {
        return <i>{this.cards}</i>;
      }
    }

    style(Card, { color: 'blue' });
    style(Deck, { padding: '9px', _b: { margin: '3px' } });

    const root = place(<Deck />);
    const card = root.querySelector('b')!;

    expect(getComputedStyle(root.querySelector('i')!).padding).toBe('9px');
    expect(card.className).toBe('Card');
    expect(getComputedStyle(card).padding).toBe('');
    expect(getComputedStyle(card).margin).toBe('');
    expect(getComputedStyle(card).color).toBe('blue');
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

    const inside = place(<Host />).querySelector('u')!;
    const alone = place(<Kid />).querySelector('u')!;

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

    const [own, leaf] = [...place(<Shell />).querySelectorAll('p')];

    expect(getComputedStyle(own).color).toBe('red');
    expect(getComputedStyle(leaf).color).not.toBe('red');
  });

  it('will keep the descendant scope an element owns under a forwarded one', () => {
    function Child({ style: forwarded }: { style?: any }) {
      return <section _frame style={forwarded}><em>own</em></section>;
    }

    function Parent() {
      return <Child _outer />;
    }

    style(Child, { _frame: { _em: { color: 'green' } } });
    style(Parent, { _outer: { _em: { color: 'red' } } });

    expect(getComputedStyle(place(<Parent />).querySelector('em')!).color).toBe('green');
  });

  it('will not carry a descendant scope into a child component', () => {
    function Deep() {
      return <em>deep</em>;
    }

    function Top() {
      return <Mid _wrap><s _mark>own</s></Mid>;
    }

    function Mid({ children }: { children?: Component.Node }) {
      return <><q _mark>mid</q><Deep />{children}</>;
    }

    style(Top, { _wrap: { _mark: { color: 'orange' }, _em: { color: 'teal' } } });

    const root = place(<Top />);

    expect(getComputedStyle(root.querySelector('s')!).color).toBe('orange');
    expect(getComputedStyle(root.querySelector('q')!).color).not.toBe('orange');
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

    const root = place(<><First /><Second /><Third /></>);
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

    const root = place(<Nested />);
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

    const root = place(<Icon />);
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

    place(<First />);
    document.head.querySelector('style[data-expressive]')!.remove();

    const node = place(<Second />).querySelector('b')!;
    expect(getComputedStyle(node).color).toBe('blue');
  });

  it('will resolve class-only, empty and plain routes', () => {
    const defined = createStyleScope(undefined, {
      empty: () => null,
      token: () => 'one  two',
      zero: called
    }, 'style', { label: 'style', layers: [], rules: [] })!;
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

describe('authoring scope', () => {
  it('will style children by the component that wrote them', () => {
    class Page extends Component {}

    function Wrap({ children }: { children?: Component.Node }) {
      return <section>{children}</section>;
    }

    function Author() {
      return (
        <Page>
          <div _grid />
          <Wrap><p _note>note</p></Wrap>
        </Page>
      );
    }

    style(Wrap, { _p: { color: 'red' }, _note: { color: 'red' } });
    style(Author, { _grid: { display: 'grid' }, _note: { color: 'green' } });

    const root = place(<Author />);
    const note = root.querySelector('p')!;

    expect(root.querySelector('div')!.className).toBe('Author_grid');
    expect(note.className).toBe('Author_note');
    expect(getComputedStyle(note).color).toBe('green');
  });

  it('will keep rules nested under the wrapper element', () => {
    function Link({ children, style: appearance }: { children?: Component.Node; style?: any }) {
      return <a style={appearance}>{children}</a>;
    }

    function Preview() {
      return (
        <Link _link>
          <img />
          <span _caption>caption</span>
          <em _frame><b>deep</b></em>
        </Link>
      );
    }

    style(Link, { _img: { display: 'inline' } });
    style(Preview, {
      _img: { display: 'block' },
      _link: { color: 'blue', _caption: { fontWeight: 700 } },
      _frame: { _b: { color: 'red' } }
    });

    const root = place(<Preview />);

    expect(getComputedStyle(root.querySelector('a')!).color).toBe('blue');
    expect(root.querySelector('img')!.className).toBe('Preview_img');
    expect(getComputedStyle(root.querySelector('span')!).fontWeight).toBe('700');
    expect(getComputedStyle(root.querySelector('b')!).color).toBe('red');
  });

  it('will resolve children passed through several wrappers', () => {
    function Inner({ children }: { children?: Component.Node }) {
      return <ins>{children}</ins>;
    }

    function Outer({ children }: { children?: Component.Node }) {
      return <Inner _inner>{children}</Inner>;
    }

    function Writer() {
      return <Outer><mark _hit>hit</mark></Outer>;
    }

    style(Outer, { _inner: { _hit: { color: 'red' } } });
    style(Inner, { _hit: { color: 'red' } });
    style(Writer, { _hit: { color: 'purple' } });

    const mark = place(<Writer />).querySelector('mark')!;

    expect(mark.className).toBe('Writer_hit');
    expect(getComputedStyle(mark).color).toBe('purple');
  });

  it('will style a node written elsewhere by where it is placed', () => {
    let made: Component.Node;

    function Maker() {
      made = <dfn _term>term</dfn>;
      return null;
    }

    function Shower() {
      return made;
    }

    style(Maker, { _term: { color: 'red' } });
    style(Shower, { _term: { color: 'teal' } });

    const term = place(<><Maker /><Shower /></>).querySelector('dfn')!;

    expect(term.className).toBe('Shower_term');
  });

  it('will keep base declarations of a wrapper on its roots', () => {
    function Shell({ children }: { children?: Component.Node }) {
      return <>{children}</>;
    }

    function Uses() {
      return <Shell><h6 _title>title</h6></Shell>;
    }

    style(Shell, { padding: '4px' });
    style(Uses, { _title: { color: 'navy' } });

    const title = place(<Uses />).querySelector('h6')!;

    expect(title.className.split(' ')).toEqual(['Uses_title', 'Shell']);
    expect(getComputedStyle(title).padding).toBe('4px');
  });
});

describe('subcomponent', () => {
  it('will not reach a subcomponent with owner rules', () => {
    class Card extends Component {
      Title() {
        return <h1 _active>sub</h1>;
      }

      render() {
        return <div><h1 _active>own</h1><this.Title /></div>;
      }
    }

    style(Card, { padding: '1px', _active: { color: 'red' }, _h1: { margin: 0 } });

    const root = place(<Card />);
    const [own, sub] = root.querySelectorAll('h1');

    expect(root.querySelector('div')!.className).toBe('Card');
    expect(own.className).toBe('Card_h1 Card_active');
    expect(sub.className).toBe('');
  });

  it('will style a subcomponent by its key', () => {
    class Card extends Component {
      Title() {
        return <h1><b _active>title</b><i>note</i></h1>;
      }

      render() {
        return <div><b _active>own</b><this.Title /></div>;
      }
    }

    style(Card, { _active: { color: 'red' } });
    style(Card, {
      _Title: {
        padding: '1px',
        _active: { color: 'blue' },
        _i: { margin: 0 }
      }
    });

    const root = place(<Card />);
    const [own, sub] = root.querySelectorAll('b');

    expect(own.className).toBe('Card_active');
    expect(root.querySelector('h1')!.className).toBe('Card_Title');
    expect(sub.className).toBe('Card_Title_active');
    expect(root.querySelector('i')!.className).toBe('Card_Title_i');
  });

  it('will style only subcomponents from a map of keys', () => {
    class Card extends Component {
      Title() {
        return <h1>title</h1>;
      }

      render() {
        return <div><this.Title /></div>;
      }
    }

    style(Card, { _Title: { padding: '1px' } });

    const root = place(<Card />);

    expect(root.querySelector('div')!.className).toBe('');
    expect(root.querySelector('h1')!.className).toBe('Card_Title');
  });

  it('will style a subcomponent by its owner wherever placed', () => {
    class Card extends Component {
      Title() {
        return <h1 _active>title</h1>;
      }
    }

    class Page extends Component {
      card = new Card();

      render() {
        return <section><this.card.Title /></section>;
      }
    }

    style(Card, { _active: { color: 'red' }, _Title: { _active: { color: 'blue' } } });
    style(Page, { _active: { color: 'green' }, _Title: { _active: { color: 'pink' } } });

    const root = place(<Page />);

    expect(root.querySelector('h1')!.className).toBe('Card_Title_active');
  });

  it('will compose subcomponent maps through the class chain', () => {
    class Card extends Component {
      Title() {
        return <h1 _active _muted>title</h1>;
      }

      render() {
        return <div><this.Title /><this.Badge /></div>;
      }

      Badge() {
        return null as Component.Node;
      }
    }

    class Fancy extends Card {
      Badge() {
        return <b _active>badge</b>;
      }
    }

    style(Card, { _active: { color: 'red' }, _Title: { _active: { color: 'blue' } } });
    style(Fancy, { _Title: { _muted: { opacity: 0.5 } } });

    const root = place(<Fancy />);

    expect(root.querySelector('h1')!.className).toBe('Card_Title_active Fancy_Title_muted');
    expect(root.querySelector('b')!.className).toBe('');
  });

  it('will still apply rules a caller hands a subcomponent', () => {
    class Card extends Component {
      Title() {
        return <h1>title</h1>;
      }

      render() {
        return <div><this.Title _accent /></div>;
      }
    }

    style(Card, { _accent: { color: 'red' } });

    const root = place(<Card />);

    expect(root.querySelector('h1')!.className).toBe('Card_accent-d1');
  });

  it('will throw for a subcomponent key on an element', () => {
    function Host() {
      return <div {...{ _Title: true }} />;
    }

    function Child() {
      return null;
    }

    function Caller() {
      return <Child {...{ _Title: true }} />;
    }

    expect(() => place(<Host />)).toThrow('"_Title" is reserved for subcomponents in style() maps.');
    expect(() => place(<Caller />)).toThrow('"_Title" is reserved for subcomponents in style() maps.');
  });

  it('will throw if a subcomponent map is not an object', () => {
    class Card extends Component {}

    expect(() => style(Card, { _Title: 'title' } as any)).toThrow('Subcomponent "_Title" must be an object.');
  });
});

describe('hot patch', () => {
  it('will carry a style map to the patched class', async () => {
    const version = (color: string) => {
      class Swatch extends Component {
        render() {
          return <div />;
        }
      }

      style(Swatch, { color });

      return Swatch;
    };

    const Swatch = version('red');

    hot.accept('dom-style', { Swatch });

    const node = place(<Swatch />).querySelector('div')!;
    const rule = () => {
      const { sheet } = document.head.querySelector<HTMLStyleElement>('style[data-expressive=dom]')!;
      return [...sheet!.cssRules].find((rule) => rule.cssText.startsWith(`.${node.className}{`)
        || rule.cssText.startsWith(`.${node.className} {`))!.cssText;
    };

    expect(rule()).toContain('red');

    hot.accept('dom-style', { Swatch: version('blue') });
    await flushMicrotasks();

    expect(rule()).toContain('blue');
  });
});

describe('conditions', () => {
  function sheet(match: string) {
    const { sheet } = document.head.querySelector<HTMLStyleElement>('style[data-expressive=dom]')!;
    return [...sheet!.cssRules]
      .map((rule) => rule.cssText.replace(/\s+/g, ' '))
      .filter((rule) => rule.includes(match));
  }

  it('will emit a state block after its rule', () => {
    function Field() {
      return <div _control />;
    }

    style(Field, {
      ':hover': { opacity: 1 },
      _control: {
        color: 'gray',
        ':hover': { color: 'blue' },
        ':focus-within, :is(:active, :checked)': { color: 'navy' }
      }
    });

    const node = place(<Field />).querySelector('div')!;
    expect(node.className).toBe(
      'Field_control Field_control-hover Field_control-focus-within Field_control-is_active_checked Field-hover'
    );
    expect(sheet('.Field')).toEqual([
      '.Field-hover:where(:hover) { opacity: 1; }',
      '.Field_control { color: gray; }',
      '.Field_control-hover:where(:hover) { color: blue; }',
      '.Field_control-focus-within:where(:focus-within) { color: navy; }',
      '.Field_control-is_active_checked:where(:is(:active, :checked)) { color: navy; }'
    ]);
  });

  it('will place pseudo-elements after the state', () => {
    function Entry() {
      return <input _field />;
    }

    style(Entry, {
      _field: {
        '::placeholder': { color: 'gray' },
        ':hover': { '::after': { content: '"!"' } },
        ':focus::before': { content: '"?"' }
      }
    });

    place(<Entry />);
    expect(sheet('.Entry')).toEqual([
      '.Entry_field-placeholder::placeholder { color: gray; }',
      '.Entry_field-focus_before:where(:focus)::before { content: "?"; }',
      '.Entry_field-hover-after:where(:hover)::after { content: "!"; }'
    ]);
  });

  it('will wrap media blocks and hoist rules into them', () => {
    function Grid() {
      return <div _grid />;
    }

    style(Grid, {
      _grid: {
        gridTemplateColumns: '1fr 1fr',
        '@media (max-width: 900px)': { gridTemplateColumns: '1fr', ':hover': { opacity: 0.5 } }
      },
      '@media (max-width: 600px)': { padding: '4px', _grid: { gap: '2px' } }
    });

    const node = place(<Grid />).querySelector('div')!;
    expect(node.className).toBe(
      'Grid_grid Grid_grid-media_max-width_900px Grid_grid-media_max-width_900px-hover Grid_grid-media_max-width_600px Grid-media_max-width_600px'
    );
    expect(sheet('.Grid')).toEqual([
      '@media (max-width: 600px) { .Grid-media_max-width_600px { padding: 4px; } }',
      '.Grid_grid { grid-template-columns: 1fr 1fr; }',
      '@media (max-width: 900px) { .Grid_grid-media_max-width_900px { grid-template-columns: 1fr; } }',
      '@media (max-width: 600px) { .Grid_grid-media_max-width_600px { gap: 2px; } }',
      '@media (max-width: 900px) { .Grid_grid-media_max-width_900px-hover:where(:hover) { opacity: 0.5; } }'
    ]);
  });

  it('will hoist media into rules declared before or after it', () => {
    function Sheet() {
      return <div _page _only />;
    }

    style(Sheet, {
      '@media print': { _page: { margin: '0px' }, _only: { display: 'block' } },
      _page: { margin: '8px' }
    });

    const node = place(<Sheet />).querySelector('div')!;
    expect(node.className).toBe('Sheet_page Sheet_page-media_print Sheet_only-media_print');
  });

  it('will hoist media around a descendant scope', () => {
    function List() {
      return <ul _list><li _item /></ul>;
    }

    style(List, {
      _list: { '@media print': { _item: { color: 'black' } } }
    });

    const item = place(<List />).querySelector('li')!;
    expect(item.className).toBe('List_ul_item-media_print');
    expect(sheet('List_ul_item')).toEqual(['@media print { .List_ul_item-media_print { color: black; } }']);
  });

  it('will merge conditions across layers and classes', () => {
    class Base extends Component {
      render() {
        return <div _tone />;
      }
    }
    class Derived extends Base {}

    style(Base, { ':hover': { color: 'red' }, _tone: { ':hover': { color: 'red', padding: '2px' } } });
    style(Derived, { _tone: { ':hover': { color: 'blue' } } });
    style(Derived, { ':hover': { padding: '3px' } });

    place(<Derived />);
    expect(sheet('Derived')).toEqual([
      '.Derived-hover:where(:hover) { color: red; padding: 3px; }',
      '.Derived_tone-hover:where(:hover) { color: blue; padding: 2px; }'
    ]);
  });

  it('will run macros and skip falsy bodies inside a condition', () => {
    function Lift() {
      return <div />;
    }

    style(Lift, { ':hover': { mex: 2 }, ':focus': false as any, ':active': null as any });

    place(<Lift />);
    expect(sheet('.Lift')).toEqual([
      '.Lift-hover:where(:hover) { margin-left: 2px; margin-right: 2px; }'
    ]);
  });

  it('will style a descendant while a rule holds a state', () => {
    function Gallery() {
      return <div _thumb><button _delete /></div>;
    }

    style(Gallery, {
      _thumb: { position: 'relative', ':hover': { _delete: { opacity: 1 } } },
      _delete: { opacity: 0 }
    });

    const thumb = place(<Gallery />).querySelector('div')!;
    const button = thumb.querySelector('button')!;
    expect(thumb.className).toBe('Gallery_thumb Gallery_thumb-group');
    expect(button.className).toBe('Gallery_div_delete Gallery_div_delete-Gallery_thumb_hover');
    expect(sheet('Gallery')).toEqual([
      '.Gallery_thumb { position: relative; }',
      '.Gallery_div_delete { opacity: 0; }',
      ':where(.Gallery_thumb-group:hover) .Gallery_div_delete-Gallery_thumb_hover { opacity: 1; }'
    ]);
  });

  it('will style a descendant while the root holds a state', () => {
    function Tile() {
      return <div><b _label /></div>;
    }

    style(Tile, { ':hover': { _label: { color: 'blue' } } });

    const root = place(<Tile />).querySelector('div')!;
    expect(root.className).toBe('Tile-group');
    expect(root.querySelector('b')!.className).toBe('Tile_label-Tile_hover');
    expect(sheet('Tile')).toEqual([':where(.Tile-group:hover) .Tile_label-Tile_hover { color: blue; }']);
  });

  it('will style a descendant while the root holds a state under media', () => {
    function Dock() {
      return <div><b _label /></div>;
    }

    style(Dock, { ':hover, :focus-within': { '@media print': { _label: { color: 'blue' } } } });

    const root = place(<Dock />).querySelector('div')!;
    expect(root.className).toBe('Dock-group');
    expect(root.querySelector('b')!.className).toBe(
      'Dock_label-Dock_hover-media_print Dock_label-Dock_focus-within-media_print'
    );
    expect(sheet('Dock')).toEqual([
      '@media print { :where(.Dock-group:hover) .Dock_label-Dock_hover-media_print { color: blue; } }',
      '@media print { :where(.Dock-group:focus-within) .Dock_label-Dock_focus-within-media_print { color: blue; } }'
    ]);
  });

  it('will style a descendant under media while the root holds a state', () => {
    function Capsule() {
      return <div><b _label /></div>;
    }

    style(Capsule, {
      '@media print': {
        ':hover': { _label: { color: 'blue' }, opacity: 0.5 },
        '@media (min-width: 1px)': { _label: { color: 'red' } }
      }
    });

    const root = place(<Capsule />).querySelector('div')!;
    expect(root.className).toBe('Capsule-media_print-hover Capsule-group');
    expect(root.querySelector('b')!.className).toBe(
      'Capsule_label-media_print-Capsule_hover Capsule_label-media_print-media_min-width_1px'
    );
    expect(sheet('Capsule')).toEqual([
      '@media print { .Capsule-media_print-hover:where(:hover) { opacity: 0.5; } }',
      '@media print { :where(.Capsule-group:hover) .Capsule_label-media_print-Capsule_hover { color: blue; } }',
      '@media print { @media (min-width: 1px) { .Capsule_label-media_print-media_min-width_1px { color: red; } } }'
    ]);
  });

  it('will merge array condition bodies at the top and inside a rule', () => {
    function Ledger() {
      return <div _page><b _label /></div>;
    }

    const quiet = { opacity: 0.5 };

    style(Ledger, {
      ':hover': [{ '@media print': [{ _label: { color: 'blue' } }, { _label: quiet }] }],
      _page: { ':focus-within': [quiet, { color: 'red' }] }
    });

    const root = place(<Ledger />).querySelector('div')!;
    expect(root.querySelector('b')!.className).toBe('Ledger_label-Ledger_hover-media_print');
    expect(sheet('Ledger')).toEqual([
      '@media print { :where(.Ledger-group:hover) .Ledger_label-Ledger_hover-media_print { color: blue; opacity: 0.5; } }',
      '.Ledger_page-focus-within:where(:focus-within) { opacity: 0.5; color: red; }'
    ]);
  });

  it('will merge a scope nested in a condition from a shared map', () => {
    function Bar() {
      return <nav _tabs><button _button /></nav>;
    }

    const wide = '@media (min-width: 600px)';
    const tabs = { display: 'flex', [wide]: { gap: '2px', _button: { fontSize: '12px', height: '20px' } } };

    style(Bar, { _tabs: [tabs, { display: 'none', [wide]: { display: 'grid', _button: { height: '30px' } } }] });

    place(<Bar />);
    expect(sheet('Bar')).toEqual([
      '.Bar_tabs { display: none; }',
      '@media (min-width: 600px) { .Bar_tabs-media_min-width_600px { gap: 2px; display: grid; } }',
      '@media (min-width: 600px) { .Bar_nav_button-media_min-width_600px { font-size: 12px; height: 30px; } }'
    ]);
  });

  it('will split a root state list before grouping', () => {
    function Thumb() {
      return <div><button _delete /></div>;
    }

    style(Thumb, { ':hover, :focus-within': { _delete: { opacity: 1 } } });

    place(<Thumb />);
    expect(sheet('Thumb')).toEqual([
      ':where(.Thumb-group:hover) .Thumb_delete-Thumb_hover { opacity: 1; }',
      ':where(.Thumb-group:focus-within) .Thumb_delete-Thumb_focus-within { opacity: 1; }'
    ]);
  });

  it('will expand a condition returned by a macro', () => {
    function Lit() {
      return <a />;
    }

    style(Lit, { tone: 'red', glowOn: 'blue' });

    place(<Lit />);
    expect(sheet('.Lit')).toEqual([
      '.Lit { color: red; }',
      '.Lit-hover:where(:hover) { color: blue; }'
    ]);
  });

  it('will chain ancestor states and media', () => {
    function Menu() {
      return <ul _list><li _item><span _icon /></li></ul>;
    }

    style(Menu, {
      _list: {
        ':focus-within': {
          _item: { ':hover': { _icon: { color: 'red' } } },
          '@media print': { _icon: { display: 'none' } }
        }
      }
    });

    const root = place(<Menu />);
    const classes = ['ul', 'li', 'span'].map((tag) => root.querySelector(tag)!.className);
    expect(classes).toEqual([
      'Menu_list-group',
      'Menu_ul_item-group',
      'Menu_ul_li_icon-Menu_list_focus-within-media_print Menu_ul_li_icon-Menu_list_focus-within-Menu_ul_item_hover'
    ]);
    expect(sheet('Menu')).toEqual([
      '@media print { :where(.Menu_list-group:focus-within) .Menu_ul_li_icon-Menu_list_focus-within-media_print { display: none; } }',
      ':where(.Menu_list-group:focus-within) :where(.Menu_ul_item-group:hover) .Menu_ul_li_icon-Menu_list_focus-within-Menu_ul_item_hover { color: red; }'
    ]);
  });

  it('will keep root groups across layers and subclasses', () => {
    class Panel extends Component {
      render() {
        return <div><b _title /><i _note /></div>;
      }
    }
    class Wide extends Panel {}

    style(Panel, { ':hover': { _title: { color: 'red' } } });
    style(Wide, { padding: '1px' }, { ':focus-within': { _note: { color: 'blue' } } });

    const root = place(<Wide />).querySelector('div')!;
    expect(root.className).toBe('Wide Panel-group Wide-group');
  });

  it('will throw for a rule inside a pseudo-element', () => {
    function Quote() {
      return <q _mark />;
    }

    style(Quote, { _mark: { '::before': { _inner: { color: 'red' } } } });

    expect(() => place(<Quote />)).toThrow('Rules cannot nest inside pseudo-element "::before".');
  });

  it('will throw for a bare value or a class inside a condition', () => {
    function Bare() {
      return <div />;
    }

    function Classy() {
      return <div />;
    }

    style(Bare, { ':hover': 'red' as any });
    style(Classy, { ':hover': { bare: true } });

    expect(() => place(<Bare />)).toThrow('Condition ":hover" must be an object.');
    expect(() => place(<Classy />)).toThrow('Classes are not supported inside ":hover".');
  });
});
