import { describe, it, expect } from 'vitest';

import { Component } from '@expressive/mvc';

import { createElement, render } from '../index';

import { Css } from './css';
import { Style, style } from './stylesheet';

class Sides extends Style {
  $wide = '@media (min-width: 600px)';
  $lit = ':hover';
  edge(side: 'Top' | 'Left') { return { [`border${side}`]: '1px solid' }; }
  row(gap?: string) { return { display: 'flex', gap }; }
  pill(value: number) { return { marginLeft: `${value}px` }; }
  flat() { return { display: 'flex' }; }
  default(value: unknown, key: string) { return { [key]: value }; }
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
    // @ts-expect-error - no condition named on the pack
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

  it('will accept conditions named on the pack', () => {
    const map: Map = {
      $wide: { pill: 2, _grid: { $lit: { color: 'blue' } } },
      _item: { $lit: [{ flat: true }] }
    };
    // @ts-expect-error - a condition holds a map
    const bare: Map = { $wide: 'red' };
    // @ts-expect-error - a plain map names no conditions
    const plain: style.Map = { $wide: { color: 'red' } };

    expect([map, bare, plain]).toHaveLength(3);
  });

  it('will accept arrays of maps as rule and condition bodies', () => {
    const shared: Map = { color: 'gray', ':hover': { color: 'black' } };
    const wide = false as boolean;
    const map: Map = {
      _select: [shared, wide && { padding: '8px' }, { color: 'red' }],
      _list: { _item: [shared, [null, { pill: 2 }]] },
      ':focus-within': [shared, { outline: 'none' }]
    };
    // @ts-expect-error - entries are maps
    const token: Map = { _select: [shared, 'yes'] };
    // @ts-expect-error - entries are checked like any map
    const typo: Map = { _select: [{ colr: 'red' }] };

    expect([map, token, typo]).toHaveLength(3);
  });

  it('will keep property and macro names on a rule body for typo suggestions', () => {
    type Named<T> = T extends unknown ? 'paddingTop' | 'pill' extends keyof T ? true : false : never;
    const named: false extends Named<NonNullable<Map['_select']>> ? never : true = true;

    expect(named).toBe(true);
  });

  it('will declare a pack from its methods', () => {
    const map: Map = { edge: 'Top', pill: 2, row: true };
    // @ts-expect-error - pill takes a number, so true is not a flag
    const flag: Map = { pill: true };
    // @ts-expect-error - edge declared from its implementation
    const wrong: Map = { edge: 'Bottom' };
    // @ts-expect-error - default is not a macro
    const fallback: Map = { default: true };
    const bare: Map = { flat: true };
    // @ts-expect-error - a macro without a parameter only takes true
    const value: Map = { flat: 'x' };

    expect([map, flag, wrong, fallback, bare, value]).toHaveLength(6);
  });

  it('will type macros a pack inherits', () => {
    class App extends Css {}

    const map: style.Map<App> = { size: 4 };
    // @ts-expect-error - not a macro of Css
    const typo: style.Map<App> = { size2: 4 };

    expect([map, typo]).toHaveLength(2);
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

  it('will layer its macros over a base styled without them', () => {
    class Base extends Component {
      render() {
        return createElement('b', { _label: true });
      }
    }

    class Derived extends Base {}

    style(Base, { _label: { color: 'red' } });
    Sides.use()(Derived, { _label: { pill: 2 } });

    const node = place(createElement(Derived, {})).querySelector('b')!;

    expect(getComputedStyle(node).marginLeft).toBe('2px');
    expect(getComputedStyle(node).color).toBe('red');
  });

  it('will extend a macro it overrides through super', () => {
    class Wide extends Sides {
      pill(value: number) { return { ...super.pill(value), paddingLeft: '1px' }; }
    }

    const Pill = () => createElement('i', {});
    Wide.use()(Pill, { pill: 3 });

    const node = place(createElement(Pill, {})).querySelector('i')!;

    expect(getComputedStyle(node).marginLeft).toBe('3px');
    expect(getComputedStyle(node).paddingLeft).toBe('1px');
  });

  it('will layer a subclass pack over the pack of its base', () => {
    class Cool extends Style {
      default(value: unknown, key: string) { return { [key]: value == 'tone' ? 'blue' : value }; }
    }

    class Loud extends Style {
      default(value: unknown, key: string) { return { [key]: value == 'tone' ? 'red' : value == 'blue' ? 'green' : value }; }
    }

    class Base extends Component {
      render() {
        return createElement('b', { _label: true });
      }
    }

    class Derived extends Base {}

    Cool.use()(Base, { _label: { marginLeft: '2px' } });
    Loud.use()(Derived, { _label: { color: 'tone' } });

    const node = place(createElement(Derived, {})).querySelector('b')!;

    expect(getComputedStyle(node).color).toBe('red');
    expect(getComputedStyle(node).marginLeft).toBe('2px');
  });

  it('will keep a base rule beside a pack macro of the same name', () => {
    class Rowed extends Style {
      row() { return { display: 'flex' }; }
    }

    class Base extends Component {
      render() {
        return createElement('b', { _row: true });
      }
    }

    class Derived extends Base {}

    style(Base, { _row: { color: 'red' } });
    Rowed.use()(Derived, { row: true });

    const node = place(createElement(Derived, {})).querySelector('b')!;

    expect(node.className).toContain('Base_row');
    expect(getComputedStyle(node).color).toBe('red');
    expect(getComputedStyle(node).display).toBe('flex');
  });

  it('will keep packs apart across a component boundary with colliding names', () => {
    class Lib extends Style {
      gutter(value: number) { return { marginLeft: `${value * 10}px` }; }
    }

    class App extends Style {
      gutter(value: number) { return { marginLeft: `${value}px` }; }
    }

    const Card = ({ children }: { children?: any }) =>
      createElement('section', {}, createElement('b', { _label: true }), children);

    const Page = () => createElement('div', {},
      createElement(Card, { _card: true }, createElement('u', { _label: true })),
      createElement('i', { _label: true })
    );

    Lib.use()(Card, { gutter: 1, _label: { gutter: 2 } });
    App.use()(Page, { _card: { gutter: 3, _label: { gutter: 4 } }, _label: { gutter: 5 } });

    const root = place(createElement(Page, {}));
    const left = (selector: string) => getComputedStyle(root.querySelector(selector)!).marginLeft;

    expect(left('section')).toBe('3px');
    expect(left('b')).toBe('20px');
    expect(left('u')).toBe('4px');
    expect(left('i')).toBe('5px');
  });

  it('will apply conditions named on the pack', () => {
    class Base extends Style {
      $wide = '@media (min-width: 600px)';
      $lit = ':hover';
    }

    class Narrow extends Base {
      $wide = '@media (max-width: 300px)';
    }

    const Panel = () => createElement('div', { _grid: true });

    Narrow.use()(Panel, {
      $wide: { padding: '4px', $lit: { color: 'red' } },
      _grid: { $lit: { opacity: 0.5 } }
    });

    const node = place(createElement(Panel, {})).querySelector('div')!;
    const { sheet } = document.head.querySelector<HTMLStyleElement>('style[data-expressive=dom]')!;
    const rules = [...sheet!.cssRules]
      .map((rule) => rule.cssText.replace(/\s+/g, ' '))
      .filter((rule) => rule.includes('.Panel'));

    expect(node.className).toBe('Panel_grid-hover Panel-media_max-width_300px Panel-media_max-width_300px-hover');
    expect(rules).toEqual([
      '@media (max-width: 300px) { .Panel-media_max-width_300px { padding: 4px; } }',
      '@media (max-width: 300px) { .Panel-media_max-width_300px-hover:where(:hover) { color: red; } }',
      '.Panel_grid-hover:where(:hover) { opacity: 0.5; }'
    ]);
  });

  it('will throw for default as a map key', () => {
    const Fallback = () => createElement('i', {});

    Sides.use()(Fallback, { default: 1 } as Map);

    expect(() => place(createElement(Fallback, {}))).toThrow('"default" is not a style key.');
  });

  it('will create a separate style() for each use() with maps', () => {
    class Kit extends Style {}

    expect(Kit.use({ _a: { color: 'red' } })).not.toBe(Kit.use({ _a: { color: 'red' } }));
    expect(Kit.use(false, null)).not.toBe(Kit.use());
  });

  describe('pack rules', () => {
    class Kit extends Style {
      $print = '@media print';
      row() { return { display: 'flex' }; }
    }

    const shell = Kit.use(false, {
      _button: { color: 'blue', row: true },
      _muted: { opacity: 0.5 },
      $print: { _muted: { opacity: 1 } }
    });

    it('will style elements written by components it styles', () => {
      const Bar = () => createElement('nav', {}, createElement('button', {}), createElement('i', { _muted: true }));

      shell(Bar);

      const root = place(createElement(Bar, {}));
      const button = root.querySelector('button')!;

      expect(button.className).toBe('Kit_button');
      expect(getComputedStyle(button).display).toBe('flex');
      expect(root.querySelector('i')!.className).toBe('Kit_muted Kit_muted-media_print');
    });

    it('will not style elements of other components', () => {
      const Plain = () => createElement('button', {});
      const Other = () => createElement('button', {});

      style(Plain, { padding: '1px' });
      Kit.use()(Other, { padding: '1px' });

      const root = place(createElement('div', {}, createElement(Plain, {}), createElement(Other, {}), createElement('button', {})));

      expect([...root.querySelectorAll('button')].map((node) => node.className)).toEqual(['Plain', 'Other', '']);
    });

    it('will sort below the component', () => {
      const Base = () => createElement('button', {}, createElement('button', { _hot: true }));
      const Merged = () => createElement('button', {});

      shell(Base, { color: 'red', _hot: { color: 'green' } });
      shell(Merged, { _button: { color: 'green' } });

      const root = place(createElement('div', {}, createElement(Base, {}), createElement(Merged, {})));
      const [outer, inner, merged] = [...root.querySelectorAll('button')];

      expect(getComputedStyle(outer).color).toBe('red');
      expect(getComputedStyle(inner).color).toBe('green');
      expect(getComputedStyle(merged).color).toBe('green');
    });

    it('will reach subclasses and subcomponents without a call of their own', () => {
      class Card extends Component {
        Title() {
          return createElement('i', { _muted: true });
        }

        render() {
          return createElement('button', {}, createElement(this.Title, {}));
        }
      }

      class Wide extends Card {}

      shell(Card);

      const root = place(createElement(Wide, {}));

      expect(root.querySelector('button')!.className).toBe('Kit_button');
      expect(root.querySelector('i')!.className).toContain('Kit_muted');
    });

    it('will keep the rules of the component that wrote the children', () => {
      class Lib extends Style {}

      const Frame = ({ children }: { children?: any }) => createElement('div', {}, createElement('button', {}), children);
      const Page = () => createElement(Frame, {}, createElement('button', {}));

      Lib.use({ _button: { color: 'red' } })(Frame);
      shell(Page);

      const [own, passed] = [...place(createElement(Page, {})).querySelectorAll('button')];

      expect(own.className).toBe('Lib_button');
      expect(passed.className).toBe('Kit_button');
    });

    it('will keep two scopes of one class apart', () => {
      const widget = Kit.use({ _button: { color: 'green' } });
      const Embed = () => createElement('button', {});
      const Shared = () => null;

      widget(Embed);
      shell(Shared);

      expect(getComputedStyle(place(createElement(Embed, {})).querySelector('button')!).color).toBe('green');
      expect(() => widget(Shared)).toThrow('"Shared" is already styled by another pack.');
    });

    it('will throw for a declaration outside a rule', () => {
      const Loose = () => createElement('b', {});

      Kit.use({ color: 'red' })(Loose);

      expect(() => place(createElement(Loose, {}))).toThrow('Pack rules must be _rules; "color" would style every root.');
    });
  });

  it('will throw for a component styled by two packs', () => {
    class Other extends Style {}
    const Twice = () => null;

    Sides.use()(Twice, { pill: 1 });

    expect(() => Other.use()(Twice, { color: 'red' })).toThrow('"Twice" is already styled by another pack.');

    const Named = Object.assign(() => null, { displayName: 'Shown' });
    Sides.use()(Named, { pill: 1 });

    expect(() => Other.use()(Named, { color: 'red' })).toThrow('"Shown" is already styled by another pack.');
  });

  it.each([
    ['a field', class Field extends Style { tone = 'red'; }, 'Field "tone" on Field is reserved. Define macros as methods.'],
    ['a condition without a prefix', class Bare extends Style { $tone = 'red'; }, 'Condition "$tone" on Bare must start with "@" or ":".'],
    ['a condition that is not a string', class Count extends Style { $size = 2; }, 'Condition "$size" on Count must start with "@" or ":".'],
    ['a prefixed method', class Prefixed extends Style { _rule() { return {}; } }, '"_rule" on Prefixed must be a method with a bare name.'],
    ['a getter', class Getter extends Style { get tone() { return {}; } }, '"tone" on Getter must be a method with a bare name.']
  ] as [string, typeof Style, string][])('will throw for %s', (_, type, message) => {
    expect(() => type.use()({}, { color: 'red' })).toThrow(message);
  });
});
