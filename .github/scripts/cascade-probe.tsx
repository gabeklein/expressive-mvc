/** @jsxImportSource @expressive/dom */
import { Component } from '@expressive/mvc';
import { css, macro, render, style } from '@expressive/dom';

macro(css);

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

style(Units, { _box: { paddingTop: 5, zIndex: 3, marginBlockEnd: 2, mx: 4 } });

function Nested() {
  return <section _frame><em>deep</em></section>;
}

style(Nested, {
  _frame: { '--depth': '7', _em: { color: 'rgb(6, 6, 6)', paddingTop: '3px' } }
});

const root = document.getElementById('app')!;

render(<><Outer /><Inline /><Nested /><Units /></>, root);

const leaf = root.querySelector('b')!;
const inline = root.querySelector('i')!;
const frame = root.querySelector('section')!;
const em = root.querySelector('em')!;

check('outermost caller wins on door count', getComputedStyle(leaf).color, 'rgb(4, 4, 4)');
check('inline beats class', getComputedStyle(inline).color, 'rgb(9, 9, 9)');
check('descendant scope applies', getComputedStyle(em).color, 'rgb(6, 6, 6)');
check('custom property', getComputedStyle(frame).getPropertyValue('--depth').trim(), '7');
const box = root.querySelector('span')!;

check('px appended where required', getComputedStyle(box).paddingTop, '5px');
check('unitless left alone', getComputedStyle(box).zIndex, '3');
check('logical property sized', getComputedStyle(box).marginBlockEnd, '2px');
check('axis shorthand', getComputedStyle(box).marginLeft, '4px');
check('leaf carries door classes', String(leaf.className.includes('-d1') && leaf.className.includes('-d2')), 'true');

document.querySelector('style[data-expressive]')!.remove();

function Late() {
  return <u _late>late</u>;
}

style(Late, { _late: { color: 'rgb(5, 5, 5)' } });

const second = document.createElement('div');
document.body.append(second);
render(<Late />, second);

check('stylesheet recreated', getComputedStyle(second.querySelector('u')!).color, 'rgb(5, 5, 5)');

report();
