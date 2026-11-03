import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createElement, render } from '../index';

import { StyleSheet } from './sheet';

const css = new StyleSheet();
const glob = (value: unknown, key: string) => css.default(value, key);

function place(node: any) {
  const root = document.body.appendChild(document.createElement('main'));
  render(node, root);
  return root;
}

describe('StyleSheet', () => {
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

  it('will join numbers with a unit', () => {
    expect(css.$rem(0.45)).toBe('0.45rem');
    expect(css.$rem(0.2, 0.45)).toBe('0.2rem 0.45rem');
    expect(css.$em(1.5)).toBe('1.5em');
    expect(css.$px(0, 4, 8)).toBe('0px 4px 8px');
  });

  it('will size lengths through an overridden $length', () => {
    class Rem extends StyleSheet {
      $length(value: number) {
        const { $rem } = this;
        return $rem(value);
      }
    }

    const Box = () => createElement('div', {});

    Rem.use()(Box, { paddingTop: 8, zIndex: 2, margin: [16, 0] });

    const node = place(createElement(Box, {})).querySelector('div')!;

    expect(getComputedStyle(node).paddingTop).toBe('128px');
    expect(getComputedStyle(node).zIndex).toBe('2');
    expect(getComputedStyle(node).marginTop).toBe('256px');
  });

  it('will give durations and delays milliseconds', () => {
    expect(css.transitionDuration(200)).toEqual({ transitionDuration: '200ms' });
    expect(css.transitionDelay(0)).toEqual({ transitionDelay: '0ms' });
    expect(css.animationDuration([200, '1s'])).toEqual({ animationDuration: '200ms, 1s' });
    expect(css.animationDelay('2s')).toEqual({ animationDelay: '2s' });
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
