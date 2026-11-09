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

  it('will throw for a condition used as a value', () => {
    const Misused = () => createElement('i', {});

    Sides.use()(Misused, { color: '$wide' });

    expect(() => place(createElement(Misused, {}))).toThrow('Condition "$wide" is not a value of "color".');
  });

  it('will create a separate style() for each use() with maps', () => {
    class Kit extends Style {}

    expect(Kit.use({ _a: { color: 'red' } })).not.toBe(Kit.use({ _a: { color: 'red' } }));
    expect(Kit.use(false, null)).toBe(Kit.use());
  });

  it('will not register a component style() gives no maps', () => {
    const Bare = () => createElement('b', {});

    style(Bare, false, null);
    place(createElement(Bare, {}));

    expect(() => style(Bare, { color: 'red' })).not.toThrow();
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

    it('will keep pack rules in order across components', () => {
      class Order extends Style {}

      const apply = Order.use({ _a: { color: 'red' } }, { _b: { color: 'blue' } });
      const One = () => createElement('i', { _a: true });
      const Many = () => createElement('b', { _a: true, _b: true });

      apply(One);
      apply(Many, { _x: { order: 1 }, _y: { order: 2 }, _z: { order: 3 } });

      place(createElement(One, {}));

      const node = place(createElement(Many, {})).querySelector('b')!;

      expect(getComputedStyle(node).color).toBe('blue');
    });

    it('will throw for a declaration outside a rule', () => {
      const Loose = () => createElement('b', {});

      Kit.use({ color: 'red' })(Loose);

      expect(() => place(createElement(Loose, {}))).toThrow('Pack rules must be _rules; "color" would style every root.');
    });
  });

  it('will pass an object to a macro whole and keep private methods out', () => {
    interface Shift { x?: number; y?: number }

    class Moves extends Css {
      #px(value = 0) { return `${value}px`; }

      shift({ x, y }: Shift) {
        return { transform: `translate(${this.#px(x)}, ${this.#px(y)})` };
      }
    }

    const Chip = () => createElement('i', { _lift: true });
    const apply = Moves.use();
    // @ts-expect-error - shift takes a Shift
    const wrong: style.Map<Moves> = { shift: { z: 1 } };

    apply(Chip, { _lift: { shift: { x: 1, y: 2 } } }, { _lift: { shift: { y: 3 } } });

    const node = place(createElement(Chip, {})).querySelector('i')!;

    expect(wrong).toBeTypeOf('object');
    expect(getComputedStyle(node).transform).toBe('translate(0px, 3px)');
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
    ['an alias that is not a string', class Count extends Style { $size = 2; }, '"$size" on Count must be a string.'],
    ['a prefixed method', class Prefixed extends Style { _rule() { return {}; } }, '"_rule" on Prefixed must be a method with a bare name.'],
    ['a getter', class Getter extends Style { get tone() { return {}; } }, '"tone" on Getter must be a method with a bare name.'],
    ['a $ method', class Hook extends Style { $tone() { return {}; } }, '"$tone" on Hook must be a method with a bare name.']
  ] as [string, typeof Style, string][])('will throw for %s', (_, type, message) => {
    expect(() => type.use()({}, { color: 'red' })).toThrow(message);
  });
});

describe('variables', () => {
  class Theme extends Css {
    readonly $ink = '--theme-ink';
    readonly $gap = '--theme-gap';
    readonly $tone = 'cyan';
    readonly $wide = '@media (min-width: 600px)';
    readonly $dark = ':is([data-mode="dark"], [data-mode="dark"] *)';
  }

  function roots() {
    return [...document.head.querySelectorAll('style[data-expressive=root]')]
      .map((element) => element.textContent!.replace(/\s+/g, ' '));
  }

  it('will type variables, constants and tokens', () => {
    const apply = Theme.use();
    const map: style.Map<Theme> = { $ink: 'red', color: apply.$.ink, $wide: { $gap: '4px' } };
    // @ts-expect-error - a variable holds a value
    const scoped: style.Map<Theme> = { $ink: { color: 'red' } };
    // @ts-expect-error - a constant is not a key
    const constant: style.Map<Theme> = { $tone: 'red' };
    // @ts-expect-error - a condition has no token
    const token = apply.$.wide;

    apply.define({ ink: 'red', $dark: { ink: 'blue' }, '@media print': { gap: '1px' } });
    // @ts-expect-error - a constant is not a variable
    expect(() => apply.define({ tone: 'red' })).toThrow('"tone" is not a variable of Theme.');

    expect([map, scoped, constant, token]).toHaveLength(4);
  });

  it('will declare a variable from its $ key and read it through a token', () => {
    const { $ } = Theme.use();
    const Swatch = () => createElement('i', {});

    Theme.use()(Swatch, { $ink: 'red', color: $.ink });

    const node = place(createElement(Swatch, {})).querySelector('i')!;

    expect(getComputedStyle(node).getPropertyValue('--theme-ink')).toBe('red');
    expect(getComputedStyle(node).color).toBe('red');
  });

  it('will rewrite a token inside a template or an array', () => {
    const { $ } = Theme.use();
    const Framed = () => createElement('i', {});

    Theme.use()(Framed, { boxShadow: ['0 0 1px', $.ink], outline: `2px dashed ${$.tone}` });

    const node = place(createElement(Framed, {})).querySelector('i')!;
    const rule = [...document.head.querySelector<HTMLStyleElement>('style[data-expressive=dom]')!.sheet!.cssRules]
      .find((rule) => rule.cssText.includes('.Framed'))!;

    expect(rule.cssText).toContain('box-shadow: 0 0 1px var(--theme-ink)');
    expect(getComputedStyle(node).outlineColor).toBe('cyan');
  });

  it('will rewrite a token in an inline style', () => {
    const { $ } = Theme.use();

    const node = place(createElement('b', { style: { color: $.tone } })).querySelector('b')!;

    expect(node.style.color).toBe('cyan');
  });

  it('will declare a variable under a condition', () => {
    const Wide = () => createElement('i', {});

    Theme.use()(Wide, { $wide: { $gap: '9px' } });

    place(createElement(Wide, {}));

    const rules = [...document.head.querySelector<HTMLStyleElement>('style[data-expressive=dom]')!.sheet!.cssRules]
      .map((rule) => rule.cssText.replace(/\s+/g, ' '))
      .filter((rule) => rule.includes('.Wide'));

    expect(rules).toEqual(['@media (min-width: 600px) { .Wide-media_min-width_600px { --theme-gap: 9px; } }']);
  });

  it('will set defaults at the root from pack rules', () => {
    class Deck extends Style {
      readonly $line = '--deck-line';
      readonly $wide = '@media (min-width: 600px)';
      readonly $dark = ':is([data-mode="dark"], [data-mode="dark"] *)';
    }

    const deck = Deck.use({
      $line: '#222',
      _button: { color: Deck.use().$.line },
      $wide: { $line: '#444', _button: { opacity: 0.5 } },
      $dark: { $line: '#eee' }
    });

    const Bar = () => createElement('button', {});

    deck(Bar);

    const button = place(createElement(Bar, {})).querySelector('button')!;

    expect(roots()).toContain(
      ':where(:root){--deck-line: #222;}\n'.replace(/\s+/g, ' ') +
      '@media (min-width: 600px){:where(:root){--deck-line: #444;}} ' +
      ':where(:root:is(:is([data-mode="dark"], [data-mode="dark"] *))){--deck-line: #eee;}'
    );
    expect(getComputedStyle(button).color).toBe('#444');
    expect(button.className).toBe('Deck_button Deck_button-media_min-width_600px');
  });

  it('will define variables at the root over their defaults', () => {
    class Brand extends Style {
      readonly $accent = '--brand-accent';
      readonly $print = '@media print';
    }

    const brand = Brand.use({ $accent: 'blue' });
    const Chip = () => createElement('i', {});

    brand(Chip, { color: brand.$.accent });
    brand.define({ accent: 'green', $print: { accent: 'black' }, ':hover': { accent: 'red' } });

    const node = place(createElement(Chip, {})).querySelector('i')!;

    expect(roots()).toContain(
      ':root{--brand-accent: green;} @media print{:root{--brand-accent: black;}} :root:is(:hover){--brand-accent: red;}'
    );
    expect(getComputedStyle(node).color).toBe('green');

    brand.define({ accent: 'teal' });

    expect(roots()).toContain(':root{--brand-accent: teal;}');
    expect(getComputedStyle(node).color).toBe('teal');
  });

  it('will let a later default of a variable win, as a re-run module does', () => {
    function edition(color: string) {
      class Edition extends Style {
        readonly $hue = '--edition-hue';
      }

      const apply = Edition.use({ $hue: color });
      const Mark = () => createElement('i', {});

      apply(Mark, { color: apply.$.hue });
      return place(createElement(Mark, {})).querySelector('i')!;
    }

    edition('red');
    const node = edition('blue');
    const texts = roots().filter((text) => text.includes('--edition-hue'));

    expect(texts).toEqual([':where(:root){--edition-hue: red;}', ':where(:root){--edition-hue: blue;}']);
    expect(getComputedStyle(node).color).toBe('blue');
  });

  it('will rewrite roots into a recreated head', () => {
    class Late extends Style {
      readonly $hue = '--late-hue';
    }

    const late = Late.use();
    const Dot = () => createElement('i', {});

    late(Dot, { color: late.$.hue });
    late.define({ hue: 'navy' });
    place(createElement(Dot, {}));

    for (const element of document.head.querySelectorAll('style[data-expressive]')) element.remove();

    const Again = () => createElement('b', {});

    late(Again, { color: late.$.hue });

    const node = place(createElement(Again, {})).querySelector('b')!;

    expect(roots()).toContain(':root{--late-hue: navy;}');
    expect(getComputedStyle(node).color).toBe('navy');
  });

  it.each([
    ['a condition used as a value', { color: (Theme.use().$ as Record<string, string>).wide }, 'Condition "$wide" is not a value.'],
    ['a constant used as a key', { $tone: { color: 'red' } }, '"$tone" is a value, not a condition.']
  ] as [string, {}, string][])('will throw for %s', (_, map, message) => {
    const Misused = () => createElement('i', {});

    Theme.use()(Misused, map);

    expect(() => place(createElement(Misused, {}))).toThrow(message);
  });

  it('will throw for a define key that is not a condition', () => {
    expect(() => Theme.use().define({ $tone: { ink: 'red' } } as {})).toThrow('"$tone" is not a condition of Theme.');
  });
});
