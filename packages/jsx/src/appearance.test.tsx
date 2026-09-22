import { describe, expect, it, vi } from 'vitest';

import { Component, render } from './index';
import { flushMicrotasks } from '../test.setup';
import {
  CACHE_LIMIT,
  createAppearanceRoute,
  createStyleScope,
  resolveAppearance,
  styleOf
} from './appearance';
import { applyDeclarations } from './declarations';
import { createRender } from './render';

describe('appearance', () => {
  it('will compile tag, boolean and parameter rules into a class', async () => {
    const color = vi.fn((value?: unknown) => [
      'macro-class',
      { color: value, marginLeft: 0 }
    ] as const);

    class Styled extends Component {
      static style = {
        active: { fontWeight: 700 },
        color,
        div: { padding: 4 }
      };

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

    Child.style = {
      tone: { color: 'blue' }
    };

    function Parent() {
      return (
        <div>
          <i _tone />
          <Child />
        </div>
      );
    }

    Parent.style = {
      tone: { color: 'red' }
    };

    const root = document.createElement('main');
    document.body.append(root);
    const release = render(<Parent />, root);

    expect(getComputedStyle(root.querySelector('i')!).color).toBe('red');
    expect(getComputedStyle(root.querySelector('span')!).color).toBe('blue');
    release();
    root.remove();
  });

  it('will preserve zero and fall back inline after the route cache fills', async () => {
    class Variable extends Component {
      static style = {
        width: (value?: unknown) => ({ width: value })
      };

      width = 0;

      render() {
        return <div _width={this.width} />;
      }
    }

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

    applyDeclarations(style, { '--count': 2, '--empty': null });

    expect(right.appearance?.className).toBe(left.appearance?.className);
    expect(style.getPropertyValue('--count')).toBe('2');
    expect(style.getPropertyValue('--empty')).toBe('');
  });

  it('will ignore invalid maps and expose style only from component types', () => {
    function Styled() {
      return null;
    }
    Styled.style = { div: { color: 'red' } };

    expect(createStyleScope(undefined, null)).toBeUndefined();
    expect(createStyleScope(undefined, [])).toBeUndefined();
    expect(styleOf(Styled)).toBe(Styled.style);
    expect(styleOf({ style: Styled.style })).toBeUndefined();
  });

  it('will keep the dry renderer independent of appearance compilation', () => {
    function Styled() {
      return <div _tone style={{ color: 'blue' }} />;
    }
    Styled.style = { tone: { color: 'red' } };

    const root = document.createElement('main');
    const release = createRender()(<Styled />, root);
    const node = root.querySelector('div')!;

    expect(node.className).toBe('');
    expect(node.hasAttribute('_tone')).toBe(false);
    expect(node.style.color).toBe('blue');
    release();
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

  it.fails('will activate nested descendant scopes', () => {
    function Nested() {
      return (
        <section _nested>
          <strong>nested</strong>
        </section>
      );
    }

    Nested.style = {
      nested: {
        fontStyle: 'italic',
        strong: { fontWeight: 700 }
      }
    };

    const root = document.createElement('main');
    render(<Nested />, root);
    expect(getComputedStyle(root.querySelector('strong')!).fontWeight).toBe('700');
  });
});
