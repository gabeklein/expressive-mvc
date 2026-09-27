import { describe, expect, it } from 'vitest';

import { css } from './css';

const glob = css['*'];

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

  it('will expand the axis and size shorthands', () => {
    expect(css.mx(4)).toEqual({ marginLeft: 4, marginRight: 4 });
    expect(css.my(4)).toEqual({ marginTop: 4, marginBottom: 4 });
    expect(css.px(4)).toEqual({ paddingLeft: 4, paddingRight: 4 });
    expect(css.py(4)).toEqual({ paddingTop: 4, paddingBottom: 4 });
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
