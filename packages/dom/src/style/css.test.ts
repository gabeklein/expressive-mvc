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

  it('will give rotate degrees', () => {
    expect(css.rotate(45)).toEqual({ rotate: '45deg' });
    expect(css.rotate('0.25turn')).toEqual({ rotate: '0.25turn' });
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
