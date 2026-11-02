import { describe, expect, it } from 'vitest';

import { media } from '..';

describe('media', () => {
  it('will build a query from features', () => {
    expect(media({ maxWidth: 900 })).toBe('@media (max-width: 900px)');
    expect(media({ minWidth: '40em', prefersColorScheme: 'dark' }))
      .toBe('@media (min-width: 40em) and (prefers-color-scheme: dark)');
  });
});
