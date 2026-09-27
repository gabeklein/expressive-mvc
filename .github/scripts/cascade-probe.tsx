/** @jsxImportSource @expressive/dom */
import { Component } from '@expressive/mvc';
import { macro, render, style } from '@expressive/dom';

declare module '@expressive/dom' {
  namespace macro {
    interface Registry {
      pad(value: number): style.Map;
    }
  }
}

macro({ pad: (value: number) => ({ paddingTop: `${value}px` }) });

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

function Nested() {
  return <section _frame><em>deep</em></section>;
}

style(Nested, {
  _frame: { '--depth': '7', _em: { color: 'rgb(6, 6, 6)', paddingTop: '3px' } }
});

const root = document.getElementById('app')!;

render(<><Outer /><Inline /><Nested /></>, root);

const leaf = root.querySelector('b')!;
const inline = root.querySelector('i')!;
const frame = root.querySelector('section')!;
const em = root.querySelector('em')!;

check('outermost caller wins on door count', getComputedStyle(leaf).color, 'rgb(4, 4, 4)');
check('inline beats class', getComputedStyle(inline).color, 'rgb(9, 9, 9)');
check('descendant scope applies', getComputedStyle(em).color, 'rgb(6, 6, 6)');
check('custom property', getComputedStyle(frame).getPropertyValue('--depth').trim(), '7');
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
