import { describe, it, expect } from 'vitest';

import type { macro, style } from './stylesheet';

const sides = {
  edge: (side: 'Top' | 'Left') => ({ [`border${side}`]: '1px solid' }),
  row: (gap?: string) => ({ display: 'flex', gap }),
  _raised: { boxShadow: '0 1px 2px black' },
  '*': (value: unknown, key: string) => ({ [key]: value })
};

declare module './stylesheet' {
  namespace macro {
    interface Registry extends macro.From<typeof sides> {
      pill(value: number): { marginLeft: string };
    }
  }
}

describe('style map types', () => {
  it('will accept declarations, macros, scopes and variables', () => {
    const map: style.Map = {
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
    const typo: style.Map = { colr: 'red' };
    // @ts-expect-error - reserved for host instructions
    const reserved: style.Map = { $hover: { color: 'red' } };
    // @ts-expect-error - a bare key may not open a scope
    const scoped: style.Map = { margin: { top: 1 } };
    // @ts-expect-error - macro declares a number
    const macro: style.Map = { pill: 'wide' };
    // @ts-expect-error - a rule must be a map
    const rule: style.Map = { _active: 'yes' };

    expect([typo, reserved, scoped, macro, rule]).toHaveLength(5);
  });

  it('will check a declared macro against its declaration', () => {
    const pack: macro.Map = {
      pill: (value: number) => ({ marginLeft: `${value}px` }),
      pad: (value: unknown) => ({ padding: value }),
      _raised: { boxShadow: '0 1px 2px black' }
    };

    // @ts-expect-error - Registry declares pill as (value: number)
    const wrong: macro.Map = { pill: (value: string) => ({ marginLeft: value }) };

    expect([pack, wrong]).toHaveLength(2);
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

  it('will declare a pack from its value', () => {
    const map: style.Map = { edge: 'Top', pill: 2, row: true };
    // @ts-expect-error - pill takes a number, so true is not a flag
    const flag: style.Map = { pill: true };
    // @ts-expect-error - edge declared from its implementation
    const wrong: style.Map = { edge: 'Bottom' };
    // @ts-expect-error - rules and '*' are not macros
    const rule: style.Map = { raised: true };

    expect([map, flag, wrong, rule, sides]).toHaveLength(5);
  });
});
