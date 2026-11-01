import { describe, expect, it } from 'vitest';

import { em, px, rem } from '..';

describe('units', () => {
  it('will suffix a number', () => {
    expect(rem(0.45)).toBe('0.45rem');
    expect(em(1.5)).toBe('1.5em');
    expect(px(1)).toBe('1px');
  });

  it('will join several values with spaces', () => {
    expect(rem(0.2, 0.45)).toBe('0.2rem 0.45rem');
    expect(px(0, 4, 8)).toBe('0px 4px 8px');
  });
});
