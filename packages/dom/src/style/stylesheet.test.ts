import { describe, it, expect } from 'vitest';

import { createElement, render } from '../index';

import { Style, style } from './stylesheet';

class Sides extends Style {
  edge(side: 'Top' | 'Left') { return { [`border${side}`]: '1px solid' }; }
  row(gap?: string) { return { display: 'flex', gap }; }
  pill(value: number) { return { marginLeft: `${value}px` }; }
  '*'(value: unknown, key: string) { return { [key]: value }; }
}

type Map = style.Map<Sides>;

describe('style map types', () => {
  it('will accept declarations, macros, scopes and variables', () => {
    const map: Map = {
      color: 'red',
      paddingTop: '4px',
      pill: 2,
      '--depth': 1,
      _active: { color: 'blue', _icon: { opacity: 0.5 } }
    };

    expect(map).toBeTypeOf('object');
  });

  it('will reject unknown keys, objects and bad macro arguments', () => {
    // @ts-expect-error - not a CSS property or macro
    const typo: Map = { colr: 'red' };
    // @ts-expect-error - reserved for host instructions
    const reserved: Map = { $hover: { color: 'red' } };
    // @ts-expect-error - a bare key may not open a scope
    const scoped: Map = { margin: { top: 1 } };
    // @ts-expect-error - macro declares a number
    const macro: Map = { pill: 'wide' };
    // @ts-expect-error - a rule must be a map
    const rule: Map = { _active: 'yes' };

    expect([typo, reserved, scoped, macro, rule]).toHaveLength(5);
  });

  it('will type a map without a pack', () => {
    const plain: style.Map = { color: 'red', _active: { opacity: 0.5 } };
    // @ts-expect-error - no pack declares pill
    const pill: style.Map = { pill: 2 };

    expect([plain, pill]).toHaveLength(2);
  });

  it('will accept conditions holding maps', () => {
    const map: style.Map = {
      ':hover': { color: 'blue' },
      '@media (max-width: 900px)': { _grid: { gap: '2px' } },
      _control: { ':focus-within, :active': { color: 'navy' } }
    };
    // @ts-expect-error - a condition holds a map
    const bare: style.Map = { ':hover': 'blue' };
    const key: style.Condition = '@media print';

    expect([map, bare, key]).toHaveLength(3);
  });

  it('will declare a pack from its methods', () => {
    const map: Map = { edge: 'Top', pill: 2, row: true };
    // @ts-expect-error - pill takes a number, so true is not a flag
    const flag: Map = { pill: true };
    // @ts-expect-error - edge declared from its implementation
    const wrong: Map = { edge: 'Bottom' };
    // @ts-expect-error - '*' is not a macro
    const fallback: Map = { '*': true };

    expect([map, flag, wrong, fallback]).toHaveLength(4);
  });

  it('will type style() from its pack', () => {
    const apply: style.Apply<Sides> = Sides.use();
    const type = {};

    expect(apply(type, { pill: 2 }, false)).toBe(type);
    // @ts-expect-error - pill takes a number
    apply(type, { pill: 'wide' });
  });
});

function place(node: any) {
  const root = document.body.appendChild(document.createElement('main'));
  render(node, root);
  return root;
}

describe('Style', () => {
  it('will create one style() per class', () => {
    expect(Sides.use()).toBe(Sides.use());
    expect(Style.use()).not.toBe(Sides.use());
  });

  it('will bind macros to one instance of the pack', () => {
    class Bound extends Style {
      gap(value: number) { return { marginLeft: this.px(value) }; }
      px(value: number) { return `${value * 4}px`; }
    }

    const Gap = () => createElement('i', {});
    Bound.use()(Gap, { gap: 2 });

    expect(getComputedStyle(place(createElement(Gap, {})).querySelector('i')!).marginLeft).toBe('8px');
  });

  it('will style with a bare Style like plain style()', () => {
    const Bare = () => createElement('i', {});
    Style.use()(Bare, { color: 'red' });

    expect(getComputedStyle(place(createElement(Bare, {})).querySelector('i')!).color).toBe('red');
  });

  it('will keep its macros under a caller without them', () => {
    const Card = () => createElement('b', { _label: true });
    const Parent = () => createElement(Card, { _card: true });

    Sides.use()(Card, { _label: { pill: 2 } });
    style(Parent, { _card: { _label: { color: 'red' } } });

    const node = place(createElement(Parent, {})).querySelector('b')!;

    expect(getComputedStyle(node).marginLeft).toBe('2px');
    expect(getComputedStyle(node).color).toBe('red');
  });

  it('will throw for a component styled by two packs', () => {
    class Other extends Style {}
    const Twice = () => null;

    Sides.use()(Twice, { pill: 1 });

    expect(() => Other.use()(Twice, { color: 'red' })).toThrow('"Twice" is already styled by another Style class.');
  });

  it.each([
    ['a field', class Field extends Style { tone = 'red'; }, 'Field "tone" on Field is reserved. Define macros as methods.'],
    ['a prefixed method', class Prefixed extends Style { _rule() { return {}; } }, '"_rule" on Prefixed must be a method with a bare name.'],
    ['a getter', class Getter extends Style { get tone() { return {}; } }, '"tone" on Getter must be a method with a bare name.']
  ] as [string, typeof Style, string][])('will throw for %s', (_, type, message) => {
    expect(() => type.use()({}, { color: 'red' })).toThrow(message);
  });
});
