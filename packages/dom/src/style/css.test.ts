import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { Css } from './css';

const css = new Css();
const glob = (value: unknown, key: string) => css.default(value, key);

describe('css pack', () => {
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
