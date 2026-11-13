/** @jsxImportSource @expressive/dom */
import { Component } from '@expressive/mvc';
import { Css, Portal, render } from '@expressive/dom';

const style = Css.use();

const out: string[] = [];

function report() {
  const pre = document.createElement('pre');
  pre.id = 'out';
  pre.textContent = out.join('\n');
  document.body.append(pre);
}

window.addEventListener('error', (event) => {
  out.push(`FAIL uncaught ${event.message}`);
  report();
});

function check(name: string, actual: string, expected: string) {
  out.push(`${actual === expected ? 'PASS' : 'FAIL'} ${name} expected=${expected} actual=${actual}`);
}

function Leaf() {
  return <b _own>leaf</b>;
}

function Middle() {
  return <Leaf _mid />;
}

function Outer() {
  return <Middle _out />;
}

style(Leaf, { color: 'rgb(1, 1, 1)', _own: { color: 'rgb(2, 2, 2)' } });
style(Middle, { _mid: { color: 'rgb(3, 3, 3)' } });
style(Outer, { _out: { color: 'rgb(4, 4, 4)' } });

function Inline() {
  return <i _hue style={{ color: 'rgb(9, 9, 9)' }}>inline</i>;
}

style(Inline, { _hue: { color: 'rgb(8, 8, 8)' } });

function Units() {
  return <span _box>units</span>;
}

style(Units, { _box: { paddingTop: 5, zIndex: 3, marginBlockEnd: 2, marginInline: 4, rotate: 45, animationDuration: [200, 0], offsetRotate: 30, transition: { opacity: { duration: 300, easing: 'linear', delay: 100 }, color: 50 } } });

function Nested() {
  return <section _frame><em>deep</em></section>;
}

style(Nested, {
  _frame: { '--depth': '7', _em: { color: 'rgb(6, 6, 6)', paddingTop: '3px' } }
});

function Readout() {
  return <output>readout</output>;
}

style(Readout, { color: 'rgb(7, 7, 7)', padding: '1px', _output: { padding: '6px' } });

function Toggle() {
  return <input type="checkbox" checked readOnly />;
}

style(Toggle, {
  color: 'rgb(10, 10, 10)',
  ':checked': { color: 'rgb(11, 11, 11)', outlineColor: 'rgb(11, 11, 11)' },
  '@media (min-width: 1px)': { letterSpacing: '2px' },
  '@media (max-width: 1px)': { wordSpacing: '9px' }
});

function Picker() {
  return <Toggle _pick />;
}

style(Picker, { _pick: { color: 'rgb(12, 12, 12)' } });

function Field() {
  return <label _box><input /><b _hint>hint</b></label>;
}

style(Field, {
  _box: { ':focus-within': { _hint: { color: 'rgb(14, 14, 14)' } } },
  _hint: { color: 'rgb(13, 13, 13)' }
});

function Tip() {
  return <span _tip>tip</span>;
}

style(Tip, { _tip: { '::before': { content: '"x"' } } });

const shell = Css.use({ _kbd: { color: 'rgb(20, 20, 20)', padding: '9px' } });

function Keys() {
  return <kbd _key><kbd /></kbd>;
}

shell(Keys, { color: 'rgb(21, 21, 21)', _key: { padding: '3px' } });

class Theme extends Css {
  readonly $ink = '--probe-ink';
  readonly $gap = '--probe-gap';
  readonly $probeTone = 'rgb(40, 40, 40)';
  readonly $wide = '@media (min-width: 1px)';
  readonly $dark = ':is([data-mode="dark"], [data-mode="dark"] *)';
}

const theme = Theme.use({
  $ink: 'rgb(30, 30, 30)',
  $wide: { $gap: '5px' },
  $dark: { $ink: 'rgb(31, 31, 31)' }
});

function Swatch() {
  return <s>swatch</s>;
}

function Panel() {
  return <aside><Swatch /></aside>;
}

theme(Swatch, ($) => ({ color: $.ink, paddingTop: $.gap, border: ['1px', 'solid', $.ink], outlineColor: $.probeTone }));
theme(Panel, { $ink: 'rgb(32, 32, 32)' });

const root = document.getElementById('app')!;

render(<><Outer /><Inline /><Nested /><Units /><Readout /><Toggle /><Picker /><Tip /><Field /><Keys /><Swatch /><Panel /></>, root);

const leaf = root.querySelector('b')!;
const inline = root.querySelector('i')!;
const frame = root.querySelector('section')!;
const em = root.querySelector('em')!;

check('outermost caller wins on door count', getComputedStyle(leaf).color, 'rgb(4, 4, 4)');
check('inline beats class', getComputedStyle(inline).color, 'rgb(9, 9, 9)');
check('descendant scope applies', getComputedStyle(em).color, 'rgb(6, 6, 6)');
check('custom property', getComputedStyle(frame).getPropertyValue('--depth').trim(), '7');
const box = root.querySelector('span')!;
const readout = root.querySelector('output')!;

check('own rule beats base', getComputedStyle(readout).padding, '6px');

check('px appended where required', getComputedStyle(box).paddingTop, '5px');
check('unitless left alone', getComputedStyle(box).zIndex, '3');
check('logical property sized', getComputedStyle(box).marginBlockEnd, '2px');
check('logical axis sized', getComputedStyle(box).marginLeft, '4px');
check('rotate in degrees', getComputedStyle(box).rotate, '45deg');
check('durations in ms', getComputedStyle(box).animationDuration, '0.2s, 0s');
check('transitions by property', `${getComputedStyle(box).transitionProperty} / ${getComputedStyle(box).transitionDuration} / ${getComputedStyle(box).transitionDelay}`, 'opacity, color / 0.3s, 0.05s / 0.1s, 0s');
check('offset rotate in degrees', getComputedStyle(box).offsetRotate, '30deg');
const [toggle, picked] = root.querySelectorAll('input');

check('state beats base', getComputedStyle(toggle).color, 'rgb(11, 11, 11)');
check('caller door beats callee state', getComputedStyle(picked).color, 'rgb(12, 12, 12)');
check('callee state still applies under a door', getComputedStyle(picked).outlineColor, 'rgb(11, 11, 11)');
check('matching media applies', getComputedStyle(toggle).letterSpacing, '2px');
check('other media does not', getComputedStyle(toggle).wordSpacing, '0px');
check('pseudo-element applies', getComputedStyle(root.querySelector('span[class*=Tip]')!, '::before').content, '"x"');

const hint = root.querySelector('label b')!;

check('group state off', getComputedStyle(hint).color, 'rgb(13, 13, 13)');
root.querySelector<HTMLInputElement>('label input')!.focus();
check('group state styles descendant', getComputedStyle(hint).color, 'rgb(14, 14, 14)');
const [key, inner] = root.querySelectorAll('kbd');
check('base beats pack rule', getComputedStyle(key).color, 'rgb(21, 21, 21)');
check('own rule beats pack rule', getComputedStyle(key).padding, '3px');
check('pack rule applies', getComputedStyle(inner).color, 'rgb(20, 20, 20)');
check('leaf carries door classes', String(leaf.className.includes('-d1') && leaf.className.includes('-d2')), 'true');

const [swatch, nested] = root.querySelectorAll('s');

check('variable default at root', getComputedStyle(swatch).color, 'rgb(30, 30, 30)');
check('variable default under media', getComputedStyle(swatch).paddingTop, '5px');
check('token in a shorthand', getComputedStyle(swatch).borderTopColor, 'rgb(30, 30, 30)');
check('field default named from its key', getComputedStyle(swatch).outlineColor, 'rgb(40, 40, 40)');
check('variable overridden for a subtree', getComputedStyle(nested).color, 'rgb(32, 32, 32)');
document.documentElement.dataset.mode = 'dark';
check('variable default under a root state', getComputedStyle(swatch).color, 'rgb(31, 31, 31)');
delete document.documentElement.dataset.mode;

function Select({ menu }: { menu?: boolean }) {
  return (
    <div __control _box>
      <input __input _field />
      <a _link>owned</a>
      <a>plain</a>
      {menu && <Portal into={document.body}><ul __menu data-open=""><li __option>option</li></ul></Portal>}
    </div>
  );
}

style(Select, {
  _box: { color: 'rgb(50, 50, 50)' },
  _field: { color: 'rgb(51, 51, 51)', padding: '1px', outlineStyle: 'dotted' },
  _link: { color: 'rgb(52, 52, 52)' }
});

function Card() {
  return <article><Select /></article>;
}

style(Card, { __input: { color: 'rgb(53, 53, 53)' } });

const kit = Css.use({ __input: { color: 'rgb(59, 59, 59)', padding: '2px', margin: '3px' } });

function Page() {
  return (
    <main data-on="">
      <Select menu />
      <Select _year />
      <Card />
    </main>
  );
}

kit(Page, {
  __input: { color: 'rgb(54, 54, 54)', margin: '4px' },
  __a: { color: 'rgb(55, 55, 55)' },
  _year: { __control: { borderTopWidth: '5px', borderTopStyle: 'solid' }, __input: { color: 'rgb(56, 56, 56)' } },
  ':is([data-on])': { _year: { __input: { letterSpacing: '3px' } }, __control: { wordSpacing: '6px' } },
  __menu: { ':is([data-open])': { __option: { color: 'rgb(57, 57, 57)' } } }
});

const parts = document.createElement('div');
document.body.append(parts);
render(<Page />, parts);

const [first, year, carded] = parts.querySelectorAll('input');
const [owned, plain] = parts.querySelectorAll('a');
const [control, yearControl] = parts.querySelectorAll<HTMLElement>('div.__control');

check('part beats owner rule', getComputedStyle(first).color, 'rgb(54, 54, 54)');
check('owner declarations still apply under a part', getComputedStyle(first).outlineStyle, 'dotted');
check('pack part beats owner rule', getComputedStyle(first).paddingTop, '2px');
check('page part beats pack part', getComputedStyle(first).marginTop, '4px');
check('tag default loses to owner rule', getComputedStyle(owned).color, 'rgb(52, 52, 52)');
check('tag default styles unowned tag', getComputedStyle(plain).color, 'rgb(55, 55, 55)');
check('nearest scope wins', getComputedStyle(carded).color, 'rgb(53, 53, 53)');
check('nested under flag wins over top level', getComputedStyle(year).color, 'rgb(56, 56, 56)');
check('nested under flag reaches the child root', getComputedStyle(yearControl).borderTopWidth, '5px');
check('nested under flag skips other children', getComputedStyle(control).borderTopWidth, '0px');
check('anchor state reaches parts', getComputedStyle(control).wordSpacing, '6px');
check('outer state before a nested anchor', getComputedStyle(year).letterSpacing, '3px');
check('outer state skips other anchors', getComputedStyle(first).letterSpacing, 'normal');
check('portal root carries anchors', getComputedStyle(document.body.querySelector('li.__option')!).color, 'rgb(57, 57, 57)');

document.querySelector('style[data-expressive=dom]')!.remove();

function Late() {
  return <u _late>late</u>;
}

style(Late, { _late: { color: 'rgb(5, 5, 5)' } });

const second = document.createElement('div');
document.body.append(second);
render(<><Late /><Field /><Card /></>, second);

check('stylesheet recreated', getComputedStyle(second.querySelector('u')!).color, 'rgb(5, 5, 5)');
second.querySelector('input')!.focus();
check('part rules recreated', getComputedStyle(second.querySelector('input.__input')!).color, 'rgb(53, 53, 53)');
check('group anchor recreated', getComputedStyle(second.querySelector('label b')!).color, 'rgb(14, 14, 14)');

report();
