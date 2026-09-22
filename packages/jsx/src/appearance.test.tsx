import { describe, expect, it, vi } from 'vitest';

import { Component, macro, render, style } from './index';
import { flushMicrotasks } from '../test.setup';
import {
  CACHE_LIMIT,
  createAppearanceRoute,
  createStyleScope,
  resolveAppearance
} from './appearance';
import { applyDeclarations } from './declarations';

describe('appearance', () => {
  it('will compile tag, boolean and parameter rules into a class', async () => {
    const color = vi.fn((value?: unknown) => [
      'macro-class',
      { color: value, marginLeft: 0 }
    ] as const);

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
    const root = document.createElement('main');
    document.body.append(root);
    const release = render(<Styled is={(value) => (view = value)} />, root);
    const node = root.querySelector('div')!;

    expect(node.className).toMatch(/macro-class e\d+/);
    expect(node.hasAttribute('_active')).toBe(false);
    expect(node.hasAttribute('_color')).toBe(false);
    expect(getComputedStyle(node).color).toBe('red');
    expect(getComputedStyle(node).fontWeight).toBe('700');
    expect(getComputedStyle(node).marginLeft).toBe('0px');
    expect(getComputedStyle(node).padding).toBe('4px');
    expect(color).toHaveBeenCalledTimes(1);

    view.count++;
    await flushMicrotasks();
    expect(color).toHaveBeenCalledTimes(1);

    view.active = false;
    await flushMicrotasks();
    expect(getComputedStyle(node).fontWeight).not.toBe('700');
    expect(color).toHaveBeenCalledTimes(2);

    view.active = true;
    await flushMicrotasks();
    expect(color).toHaveBeenCalledTimes(2);

    release();
    root.remove();
  });

  it('will inherit and shadow function component rules', () => {
    function Child() {
      return <span _tone />;
    }

    style(Child, {
      tone: { color: 'blue' }
    });

    function Parent() {
      return (
        <div>
          <i _tone />
          <Child />
        </div>
      );
    }

    style(Parent, {
      tone: { color: 'red' }
    });

    const root = document.createElement('main');
    document.body.append(root);
    const release = render(<Parent />, root);

    expect(getComputedStyle(root.querySelector('i')!).color).toBe('red');
    expect(getComputedStyle(root.querySelector('span')!).color).toBe('blue');
    release();
    root.remove();
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

    const root = document.createElement('main');
    document.body.append(root);
    const release = render(<Parent />, root);

    expect(root.querySelector('section')?.className).toBe('');
    expect(getComputedStyle(root.querySelector('span')!).color).toBe('red');
    expect(getComputedStyle(root.querySelector('b')!).fontWeight).toBe('700');
    expect(getComputedStyle(root.querySelector('i')!).color).toBe('blue');
    release();
    root.remove();
  });

  it('will register global macros before rendering', () => {
    macro({ globalTone: (value?: unknown) => ({ color: value }) });

    function Global() {
      return <i _globalTone="purple" />;
    }

    style(Global, { i: { padding: 2 } });
    const root = document.createElement('main');
    document.body.append(root);
    const release = render(<Global />, root);

    expect(getComputedStyle(root.querySelector('i')!).color).toBe('purple');
    expect(getComputedStyle(root.querySelector('i')!).padding).toBe('2px');
    expect(() => macro({ late: { color: 'red' } })).toThrow('after rendering');
    expect(() => style(Global, { late: { color: 'red' } })).toThrow('after a component');
    release();
    root.remove();
  });

  it('will preserve zero and fall back inline after the route cache fills', async () => {
    class Variable extends Component {
      width = 0;

      render() {
        return <div _width={this.width} />;
      }
    }

    style(Variable, {
      width: (value?: unknown) => ({ width: value })
    });

    let view!: Variable;
    const root = document.createElement('main');
    document.body.append(root);
    const release = render(<Variable is={(value) => (view = value)} />, root);
    const node = root.querySelector('div')!;

    expect(node.style.width).toBe('');
    expect(getComputedStyle(node).width).toBe('0px');

    for (let width = 1; width <= CACHE_LIMIT; width++) {
      view.width = width;
      await flushMicrotasks();
    }

    expect(node.style.width).toBe(`${CACHE_LIMIT}px`);
    release();
    root.remove();
  });

  it('will resolve nonprimitive values inline', () => {
    const scope = createStyleScope(undefined, {
      value: (value?: unknown) => ({ '--value': String(value) })
    });
    const first = { _value: { id: 1 } };
    const route = createAppearanceRoute(scope, 'div', first);
    const resolved = resolveAppearance(route, scope, 'div', first, document);
    const symbol = resolveAppearance(route, scope, 'div', { _value: Symbol('one') }, document);

    expect(resolved.appearance).toEqual({
      className: undefined,
      declarations: { '--value': '[object Object]' }
    });
    expect(symbol.appearance?.declarations).toEqual({ '--value': 'Symbol(one)' });

    const emptyScope = createStyleScope(undefined, { empty: () => false })!;
    const emptyRoute = createAppearanceRoute(emptyScope, 'div', { _empty: Symbol('empty') });
    expect(resolveAppearance(
      emptyRoute,
      emptyScope,
      'div',
      { _empty: Symbol('empty') },
      document
    )).toEqual({ route: emptyRoute });
  });

  it('will distinguish signed zero macro arguments', () => {
    const scope = createStyleScope(undefined, {
      signed: (value?: unknown) => ({ zIndex: Object.is(value, -0) ? -1 : 1 })
    })!;
    const route = createAppearanceRoute(scope, 'div', { _signed: 0 });
    const positive = resolveAppearance(route, scope, 'div', { _signed: 0 }, document);
    const negative = resolveAppearance(route, scope, 'div', { _signed: -0 }, document);

    expect(negative.appearance?.className).not.toBe(positive.appearance?.className);
  });

  it('will handle empty, class-only, zero-argument and large selector routes', () => {
    const called = vi.fn(() => 'zero');
    const map: Record<string, unknown> = {
      bad: 'not a rule',
      empty: () => null,
      token: () => 'one  two',
      zero: called
    };
    const props: Record<string, unknown> = {
      _bad: true,
      _empty: true,
      _token: true,
      _zero: true
    };

    for (let index = 0; index < 32; index++) {
      map[`rule${index}`] = { opacity: index / 100 };
      props[`_rule${index}`] = true;
    }

    const scope = createStyleScope(undefined, map)!;
    const resolved = resolveAppearance(undefined, scope, 'div', props, document);

    expect(resolved.appearance?.className).toBe('one two zero');
    expect(resolved.appearance?.declarations).toEqual({ opacity: 0.31 });
    expect(called).toHaveBeenCalledWith(undefined);

    const emptyScope = createStyleScope(undefined, { empty: () => false })!;
    const emptyRoute = createAppearanceRoute(emptyScope, 'div', { _empty: true });
    const empty = resolveAppearance(emptyRoute, emptyScope, 'div', { _empty: true }, document);
    expect(empty).toEqual({
      appearance: {},
      route: emptyRoute
    });
    expect(resolveAppearance(emptyRoute, emptyScope, 'div', { _empty: true }, document).appearance)
      .toBe(empty.appearance);
  });

  it('will reuse emitted declarations and apply custom properties', () => {
    const first = createStyleScope(undefined, { tone: { letterSpacing: 3 } })!;
    const second = createStyleScope(undefined, { tone: { letterSpacing: 3 } })!;
    const left = resolveAppearance(undefined, first, 'div', { _tone: true }, document);
    const right = resolveAppearance(undefined, second, 'div', { _tone: true }, document);
    const style = document.createElement('div').style;

    applyDeclarations(style, { '--count': 2, '--empty': null, color: null });

    expect(right.appearance?.className).toBe(left.appearance?.className);
    expect(style.getPropertyValue('--count')).toBe('2');
    expect(style.getPropertyValue('--empty')).toBe('');
    expect(style.color).toBe('');
  });

  it('will ignore invalid maps', () => {
    expect(createStyleScope(undefined, null)).toBeUndefined();
    expect(createStyleScope(undefined, [])).toBeUndefined();
    expect(createAppearanceRoute(undefined, 'div', {})).toBeUndefined();
    expect(resolveAppearance(undefined, undefined, 'div', {}, document)).toEqual({});
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

    const root = document.createElement('main');
    document.body.append(root);
    const release = render(<Styled />, root);
    const node = root.querySelector('div')!;

    expect(getComputedStyle(node).color).toBe('blue');
    expect(getComputedStyle(node).marginLeft).toBe('3px');
    expect(getComputedStyle(node).padding).toBe('2px');
    release();
    root.remove();
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

    expect(result.appearance?.className).toMatch(/^e\d+$/);
  });

  it('will activate nested descendant scopes', () => {
    function Nested() {
      return (
        <section _nested>
          <strong>nested</strong>
        </section>
      );
    }

    style(Nested, {
      nested: {
        fontStyle: 'italic',
        strong: { fontWeight: 700 }
      }
    });

    const root = document.createElement('main');
    document.body.append(root);
    render(<Nested />, root);
    expect(getComputedStyle(root.querySelector('strong')!).fontWeight).toBe('700');
    root.remove();
  });
});
