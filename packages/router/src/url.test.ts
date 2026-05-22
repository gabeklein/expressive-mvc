import { describe, expect, it } from '../vitest';

import { fullPattern, matchPattern, patternSegment, specificity } from './url';

describe('matchPattern', () => {
  it('matches root', () => {
    expect(matchPattern('/', '/')).toEqual({ params: {} });
  });

  it('matches literal segments', () => {
    expect(matchPattern('/foo/bar', '/foo/bar')).toEqual({ params: {} });
  });

  it('returns null for non-matching literals', () => {
    expect(matchPattern('/foo/bar', '/foo/baz')).toBeNull();
  });

  it('returns null when segment counts differ', () => {
    expect(matchPattern('/foo', '/foo/bar')).toBeNull();
    expect(matchPattern('/foo/bar', '/foo')).toBeNull();
  });

  it('captures :param', () => {
    expect(matchPattern('/posts/:id', '/posts/foo')).toEqual({
      params: { id: 'foo' }
    });
  });

  it('captures multiple :params', () => {
    expect(
      matchPattern('/users/:userId/posts/:postId', '/users/u1/posts/p1')
    ).toEqual({ params: { userId: 'u1', postId: 'p1' } });
  });

  it('normalizes trailing slashes', () => {
    expect(matchPattern('/foo', '/foo/')).toEqual({ params: {} });
    expect(matchPattern('/foo/', '/foo')).toEqual({ params: {} });
    expect(matchPattern('/posts/:id/', '/posts/foo')).toEqual({
      params: { id: 'foo' }
    });
  });

  it('matches case-insensitively on literal segments', () => {
    expect(matchPattern('/Foo/Bar', '/foo/bar')).toEqual({ params: {} });
  });

  it('preserves case in captured params', () => {
    expect(matchPattern('/posts/:id', '/posts/FOO')).toEqual({
      params: { id: 'FOO' }
    });
  });

  it('handles empty path against root pattern', () => {
    expect(matchPattern('/', '')).toEqual({ params: {} });
  });

  it('returns null for no-match with params', () => {
    expect(matchPattern('/posts/:id/edit', '/posts/foo')).toBeNull();
  });

  describe('catch-all *', () => {
    it('matches any path with empty capture at root', () => {
      expect(matchPattern('*', '/')).toEqual({ params: { '*': '' } });
    });

    it('captures a single-segment remainder', () => {
      expect(matchPattern('*', '/foo')).toEqual({ params: { '*': 'foo' } });
    });

    it('captures multi-segment remainder', () => {
      expect(matchPattern('*', '/foo/bar/baz')).toEqual({
        params: { '*': 'foo/bar/baz' }
      });
    });

    it('matches a prefixed pattern exactly (empty capture)', () => {
      expect(matchPattern('/blog/*', '/blog')).toEqual({
        params: { '*': '' }
      });
    });

    it('matches a prefixed pattern with remainder', () => {
      expect(matchPattern('/blog/*', '/blog/hello-world')).toEqual({
        params: { '*': 'hello-world' }
      });
      expect(matchPattern('/blog/*', '/blog/a/b/c')).toEqual({
        params: { '*': 'a/b/c' }
      });
    });

    it('returns null when prefix does not match', () => {
      expect(matchPattern('/blog/*', '/posts/foo')).toBeNull();
    });

    it('coexists with :param captures', () => {
      expect(matchPattern('/users/:id/*', '/users/alice/posts/42')).toEqual({
        params: { id: 'alice', '*': 'posts/42' }
      });
    });
  });
});

describe('fullPattern', () => {
  it('returns `to` unchanged when absolute', () => {
    expect(fullPattern('/blog', '/posts/:id')).toBe('/posts/:id');
  });

  it('returns base when `to` is empty', () => {
    expect(fullPattern('/blog', '')).toBe('/blog');
  });

  it('joins base and relative `to` with `/`', () => {
    expect(fullPattern('/blog', ':slug')).toBe('/blog/:slug');
    expect(fullPattern('', 'foo')).toBe('/foo');
  });

  it('empty base + empty `to` is empty (matches root only)', () => {
    expect(fullPattern('', '')).toBe('');
  });
});

describe('patternSegment', () => {
  it('returns empty for empty `to`', () => {
    expect(patternSegment('')).toBe('');
  });

  it('returns empty for bare catch-all', () => {
    expect(patternSegment('*')).toBe('');
  });

  it('strips trailing `/*`', () => {
    expect(patternSegment('/blog/*')).toBe('/blog');
  });

  it('strips trailing `*` without slash', () => {
    expect(patternSegment('/blog*')).toBe('/blog');
  });

  it('prefixes leading `/` for relative input', () => {
    expect(patternSegment(':slug')).toBe('/:slug');
    expect(patternSegment('blog/*')).toBe('/blog');
  });

  it('preserves literal patterns unchanged', () => {
    expect(patternSegment('/posts/:id')).toBe('/posts/:id');
  });
});

describe('specificity', () => {
  it('ranks more literal segments higher', () => {
    expect(specificity('/posts/new')).toBeGreaterThan(specificity('/posts/:id'));
  });

  it('ranks :param higher than catch-all', () => {
    expect(specificity('/posts/:id')).toBeGreaterThan(specificity('/posts/*'));
  });

  it('ranks empty pattern (exact root) higher than catch-all', () => {
    expect(specificity('')).toBeGreaterThan(specificity('*'));
  });

  it('catch-all alone is the least specific', () => {
    expect(specificity('*')).toBeLessThan(specificity('/foo'));
    expect(specificity('*')).toBeLessThan(specificity(':id'));
  });

  it('longer pattern with literals beats shorter pattern', () => {
    expect(specificity('/posts/:id/edit')).toBeGreaterThan(
      specificity('/posts/:id')
    );
  });
});
