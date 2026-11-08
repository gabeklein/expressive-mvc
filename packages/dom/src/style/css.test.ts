import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createElement, render } from '../index';

import { Css } from './css';
import type { style } from './stylesheet';

const css = new Css();
const glob = (value: unknown, key: string) => css.default(value, key);

function place(node: any) {
  const root = document.body.appendChild(document.createElement('main'));
  render(node, root);
  return root;
}

describe('Css', () => {
  it('will append px only where the CSSOM rejects a bare number', () => {
    expect(glob(8, 'paddingTop')).toEqual({ paddingTop: '8px' });
    expect(glob(10, 'zIndex')).toEqual({ zIndex: 10 });
    expect(glob(1.5, 'lineHeight')).toEqual({ lineHeight: 1.5 });
    expect(glob(700, 'fontWeight')).toEqual({ fontWeight: 700 });
    expect(glob(0, 'margin')).toEqual({ margin: 0 });
    expect(glob('4em', 'width')).toEqual({ width: '4em' });
  });

  it('will size every entry of a sequence', () => {
    expect(glob([1, 2], 'margin')).toEqual({ margin: ['1px', '2px'] });
    expect(glob([1, 'auto'], 'margin')).toEqual({ margin: ['1px', 'auto'] });
  });

  it('will expand the size shorthand', () => {
    expect(css.size(4)).toEqual({ width: 4, height: 4 });
    expect(css.size([1, 2])).toEqual({ width: 1, height: 2 });
  });

  it('will give durations and delays milliseconds', () => {
    expect(css.transitionDuration(200)).toEqual({ transitionDuration: '200ms' });
    expect(css.transitionDelay(0)).toEqual({ transitionDelay: '0ms' });
    expect(css.animationDuration([200, '1s'])).toEqual({ animationDuration: '200ms, 1s' });
    expect(css.animationDelay('2s')).toEqual({ animationDelay: '2s' });
  });

  it('will list transitions by property with times in milliseconds', () => {
    expect(css.transition({
      opacity: 200,
      backgroundColor: { duration: 150, delay: 0 },
      webkitTransform: { duration: '1s', easing: 'ease-out', delay: 50 },
      color: null,
      width: { duration: 100, easing: 'linear' }
    })).toEqual({ transition: 'opacity 200ms, background-color 150ms 0ms, -webkit-transform 1s ease-out 50ms, width 100ms linear' });
    expect(css.transition('all 1s')).toEqual({ transition: 'all 1s' });
  });

  it('will type transitions by property', () => {
    const map: style.Map<Css> = { transition: { all: '1s', '--tint': 100, opacity: { duration: 0 } } };
    // @ts-expect-error - keys are property names
    const typo: style.Map<Css> = { transition: { opacty: 200 } };
    // @ts-expect-error - an array is not a transition
    const list: style.Map<Css> = { transition: ['opacity', 200] };

    expect([map, typo, list]).toHaveLength(3);
  });

  it('will give rotations degrees', () => {
    expect(css.rotate(45)).toEqual({ rotate: '45deg' });
    expect(css.rotate('0.25turn')).toEqual({ rotate: '0.25turn' });
    expect(css.offsetRotate(90)).toEqual({ offsetRotate: '90deg' });
    expect(css.offsetRotate('auto 45deg')).toEqual({ offsetRotate: 'auto 45deg' });
  });

  it('will accept numbers only for properties where one is valid', () => {
    const valid: style.Map<Css> = {
      zIndex: 2,
      boxShadow: [0, 2, 4, 'black'],
      webkitLineClamp: 2,
      flex: 1,
      '--gap': 4,
      color: 'red'
    };
    // @ts-expect-error - color takes no number
    const color: style.Map<Css> = { color: 5 };
    // @ts-expect-error - a number in animation could be a time or a count
    const animation: style.Map<Css> = { webkitAnimation: ['spin', 1] };
    // @ts-expect-error - a number in font could be a weight or a size
    const font: style.Map<Css> = { font: [16, 'serif'] };
    // @ts-expect-error - one unit for every number would break the basis
    const flex: style.Map<Css> = { flex: [1, 1, 200] };

    expect([valid, color, animation, font, flex]).toHaveLength(5);
  });

  it('will accept only unitless numbers and zero without a default', () => {
    const valid: style.Map = { zIndex: 2, opacity: 0.5, margin: [0, '8px'], padding: 0 };
    // @ts-expect-error - without a default, padding gets no px
    const padding: style.Map = { padding: 8 };
    // @ts-expect-error - a counter's number would get px
    const counter: style.Map<Css> = { counterReset: ['item', 1] };

    expect([valid, padding, counter]).toHaveLength(3);
  });

  it('will type time and angle keys from their macros', () => {
    const Clip = () => createElement('i', {});
    const map: style.Map<Css> = { transitionDuration: [200, '1s'], animationDelay: 0, rotate: 90 };
    // @ts-expect-error - a duration is a number or string
    const flag: style.Map<Css> = { transitionDuration: true };
    // @ts-expect-error - rotate takes no array
    const list: style.Map<Css> = { rotate: [1, 2] };

    Css.use()(Clip, map);

    const node = place(createElement(Clip, {})).querySelector('i')!;

    expect([flag, list]).toHaveLength(2);
    expect(getComputedStyle(node).transitionDuration).toBe('200ms, 1s');
    expect(getComputedStyle(node).animationDelay).toBe('0ms');
  });

  it('will decide a property once and stay consistent', () => {
    expect(glob(1, 'marginTop')).toEqual({ marginTop: '1px' });
    expect(glob(2, 'marginTop')).toEqual({ marginTop: '2px' });
    expect(glob(3, 'zIndex')).toEqual({ zIndex: 3 });
    expect(glob(4, 'zIndex')).toEqual({ zIndex: 4 });
  });
});

it('will typecheck a program that reaches the package through its entry alone', () => {
  const root = join(__dirname, '../..');
  const config = ts.getParsedCommandLineOfConfigFile(join(root, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} })!;
  const program = ts.createProgram([join(root, 'src/index.ts')], { ...config.options, noEmit: true });
  const errors = ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));

  expect(errors).toEqual([]);
}, 60_000);
