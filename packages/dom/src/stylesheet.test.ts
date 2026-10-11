import { describe, it, expect } from 'vitest';

import type { macro, style } from './stylesheet';

declare module './stylesheet' {
  namespace macro {
    interface Registry {
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
});
