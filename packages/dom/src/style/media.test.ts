import { describe, expect, it } from 'vitest';

import { media, style } from '..';
import type { Query } from './media';

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

    const skipped: '@media (min-width: 10px)' = media({ maxWidth: undefined, minWidth: 10 });
    const either: '@media (max-width: 10px)' | '@media (max-width: 20px)' =
      media({ maxWidth: 10 as 10 | 20 });

    const query: Query = { maxWidth: 900 };
    const pattern: `@media ${string}` = media(query);

    // @ts-expect-error - a widened value gives a pattern, not a literal
    const wide: '@media (max-width: 900px)' = media({ maxWidth: 900 as number });
    // @ts-expect-error - a Query-typed variable gives a pattern, not a literal
    const loose: '@media (max-width: 900px)' = media(query);

    expect([dark, map, skipped, either, pattern, wide, loose]).toHaveLength(7);
  });
});
