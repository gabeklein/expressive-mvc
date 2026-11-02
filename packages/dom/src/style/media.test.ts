import { describe, expect, it } from 'vitest';

import { media, style } from '..';

describe('media', () => {
  it('will build a query from features', () => {
    expect(media({ maxWidth: 900 })).toBe('@media (max-width: 900px)');
    expect(media({ minWidth: '40em', prefersColorScheme: 'dark' }))
      .toBe('@media (min-width: 40em) and (prefers-color-scheme: dark)');
  });

  it('will order features by the query interface', () => {
    expect(media({ prefersColorScheme: 'dark', minWidth: '40em' }))
      .toBe('@media (min-width: 40em) and (prefers-color-scheme: dark)');
  });

  it('will type the query as a literal key', () => {
    const mobile = media({ maxWidth: 900 });
    const dark: '@media (min-width: 40em) and (prefers-color-scheme: dark)' =
      media({ prefersColorScheme: 'dark', minWidth: '40em' });

    const map: style.Map = {
      padding: 1,
      [mobile]: { padding: 4, _grid: { gridTemplateColumns: '1fr' } }
    };

    // @ts-expect-error - a widened value gives a pattern, not a literal
    const wide: '@media (max-width: 900px)' = media({ maxWidth: 900 as number });

    expect([dark, map, wide]).toHaveLength(3);
  });
});
