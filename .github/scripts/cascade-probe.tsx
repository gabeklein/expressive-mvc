/** @jsxImportSource @expressive/dom */
import { Component } from '@expressive/mvc';
import { Css, render } from '@expressive/dom';

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

style(Units, { _box: { paddingTop: 5, zIndex: 3, marginBlockEnd: 2, marginInline: 4, rotate: 45, transitionDuration: [200, 0] } });

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

const root = document.getElementById('app')!;

render(<><Outer /><Inline /><Nested /><Units /><Readout /><Toggle /><Picker /><Tip /><Field /><Keys /></>, root);

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
check('durations in ms', getComputedStyle(box).transitionDuration, '0.2s, 0s');
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

document.querySelector('style[data-expressive]')!.remove();

function Late() {
  return <u _late>late</u>;
}

style(Late, { _late: { color: 'rgb(5, 5, 5)' } });

const second = document.createElement('div');
document.body.append(second);
render(<><Late /><Field /></>, second);

check('stylesheet recreated', getComputedStyle(second.querySelector('u')!).color, 'rgb(5, 5, 5)');
second.querySelector('input')!.focus();
check('group anchor recreated', getComputedStyle(second.querySelector('label b')!).color, 'rgb(14, 14, 14)');

report();
